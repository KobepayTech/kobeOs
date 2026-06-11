import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChildProcess, spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { StoreSettings } from './store-settings.entity';
import { CloudflareService } from '../store-registry/cloudflare.service';

/**
 * Manages store publishing — two deployment modes:
 *
 * MODE 1: hosted (default) — multi-tenant cloud.
 *   One wildcard `*.kobeapptz.com` CNAME + one shared Cloudflare Tunnel
 *   set up via CloudflareService.bootstrapWildcardTunnel() at install time
 *   serves every store. "Publishing" is a single DB-flag flip; zero
 *   Cloudflare API calls. Scales to millions of stores. TenantMiddleware
 *   resolves the slug from the Host header and the store service gates on
 *   `isPublished`.
 *
 * MODE 2: self-hosted — user runs KobeOS on their own laptop.
 *   Per-store tunnel + per-store CNAME + per-store `cloudflared` process.
 *   The original behaviour, kept for backward compatibility. Trades scale
 *   for "works behind any NAT without a public IP".
 *
 * Toggle with `KOBEOS_DEPLOYMENT=hosted | self-hosted` (default: hosted).
 */
@Injectable()
export class PublishService implements OnModuleDestroy {
  private readonly logger = new Logger(PublishService.name);

  /** Active cloudflared child processes keyed by ownerId (self-hosted only) */
  private readonly tunnelProcesses = new Map<string, ChildProcess>();
  private readonly deploymentMode: 'hosted' | 'self-hosted';

  constructor(
    @InjectRepository(StoreSettings)
    private readonly repo: Repository<StoreSettings>,
    private readonly cf: CloudflareService,
    private readonly config: ConfigService,
  ) {
    const raw = (this.config.get<string>('KOBEOS_DEPLOYMENT') ?? 'hosted').toLowerCase();
    this.deploymentMode = raw === 'self-hosted' ? 'self-hosted' : 'hosted';
    this.logger.log(`Publish deployment mode: ${this.deploymentMode}`);
  }

  private get localPort(): number {
    return Number(this.config.get('PORT', 3000));
  }

  /** Exposed so other services + tests can branch on it. */
  getDeploymentMode(): 'hosted' | 'self-hosted' {
    return this.deploymentMode;
  }

  // ── Publish ──────────────────────────────────────────────────────────────

  async publish(ownerId: string): Promise<StoreSettings> {
    const settings = await this.repo.findOne({ where: { ownerId } });
    if (!settings) {
      throw new BadRequestException('Store settings not found. Save your store first.');
    }
    if (!settings.domainSlug) {
      throw new BadRequestException('Set a store name before publishing.');
    }

    return this.deploymentMode === 'hosted'
      ? this.publishHosted(settings)
      : this.publishSelfHosted(ownerId, settings);
  }

  /**
   * Hosted mode — zero Cloudflare calls. The wildcard CNAME + shared
   * tunnel were created once at bootstrap; making a store reachable is
   * just `isPublished=true`.
   */
  private async publishHosted(settings: StoreSettings): Promise<StoreSettings> {
    settings.isPublished  = true;
    settings.publishedUrl = `https://${settings.domainSlug}.kobeapptz.com`;
    settings.publishedAt  = new Date();
    const saved = await this.repo.save(settings);
    this.logger.log(`Store published (hosted, wildcard): ${settings.publishedUrl}`);
    return saved;
  }

  /**
   * Self-hosted mode — per-store tunnel + DNS + local cloudflared. The
   * original behaviour, kept for KobeOS running on a user's laptop where
   * a wildcard tunnel doesn't make sense.
   */
  private async publishSelfHosted(ownerId: string, settings: StoreSettings): Promise<StoreSettings> {
    this.stopTunnelProcess(ownerId);

    const { tunnelId, tunnelToken } = await this.cf.createTunnel(settings.domainSlug);
    const cfRecordId = await this.cf.upsertTunnelCname(settings.domainSlug, tunnelId);
    await this.cf.configureTunnelIngress(tunnelId, settings.domainSlug, this.localPort);
    await this.spawnCloudflared(ownerId, tunnelToken);

    settings.isPublished    = true;
    settings.publishedUrl   = `https://${settings.domainSlug}.kobeapptz.com`;
    settings.publishedAt    = new Date();
    settings.cfTunnelId     = tunnelId;
    settings.cfRecordId     = cfRecordId;
    settings.cfToken        = tunnelToken;

    const saved = await this.repo.save(settings);
    this.logger.log(`Store published (self-hosted, per-tunnel): ${settings.publishedUrl}`);
    return saved;
  }

  /**
   * Bootstrap the shared wildcard tunnel + DNS record. Admin-only; meant
   * to be called once per KobeOS install. Returns the cloudflared run
   * token — persist it as CLOUDFLARED_TOKEN and run cloudflared as a
   * system service. Returns null in self-hosted mode (no shared tunnel).
   */
  async bootstrapWildcardTunnel() {
    if (this.deploymentMode !== 'hosted') {
      throw new BadRequestException('Wildcard bootstrap is only valid in hosted deployment mode (KOBEOS_DEPLOYMENT=hosted).');
    }
    return this.cf.bootstrapWildcardTunnel(this.localPort);
  }

  // ── Unpublish ────────────────────────────────────────────────────────────

  async unpublish(ownerId: string): Promise<StoreSettings> {
    const settings = await this.repo.findOne({ where: { ownerId } });
    if (!settings || !settings.isPublished) {
      throw new BadRequestException('No published store found.');
    }

    if (this.deploymentMode === 'self-hosted') {
      // Tear down per-store Cloudflare resources.
      this.stopTunnelProcess(ownerId);
      if (settings.cfTunnelId) {
        try { await this.cf.deleteTunnel(settings.cfTunnelId); } catch (e) {
          this.logger.warn(`Could not delete tunnel ${settings.cfTunnelId}: ${(e as Error).message}`);
        }
      }
      if (settings.cfRecordId) {
        try { await this.cf.deleteDnsRecord(settings.cfRecordId); } catch (e) {
          this.logger.warn(`Could not delete DNS record ${settings.cfRecordId}: ${(e as Error).message}`);
        }
      }
      settings.cfTunnelId = null;
      settings.cfRecordId = null;
      settings.cfToken    = null;
    }
    // Hosted mode: nothing to tear down upstream; the wildcard tunnel
    // stays — TenantMiddleware + the isPublished gate handle visibility.

    settings.isPublished  = false;
    settings.publishedUrl = null;
    return this.repo.save(settings);
  }

  // ── Tunnel status ────────────────────────────────────────────────────────

  tunnelStatus(ownerId: string): { running: boolean } {
    return { running: this.tunnelProcesses.has(ownerId) };
  }

  // ── cloudflared process management ───────────────────────────────────────

  private async spawnCloudflared(ownerId: string, token: string): Promise<void> {
    // Resolve the binary: prefer the one bundled with the installer
    // (KOBEOS_RESOURCES_PATH/cloudflared/cloudflared-{plat}-x64{ext}),
    // then fall back to PATH for developers running the server directly.
    const binary = this.resolveCloudflaredBinary();
    if (!binary) {
      throw new BadRequestException(
        'cloudflared binary not found. Reinstall KobeOS (the installer bundles cloudflared) ' +
        'or place a cloudflared binary on PATH.',
      );
    }

    const proc = spawn(binary, ['tunnel', 'run', '--token', token], {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    proc.stdout?.on('data', (d: Buffer) =>
      this.logger.log(`[cloudflared:${ownerId}] ${d.toString().trim()}`),
    );
    proc.stderr?.on('data', (d: Buffer) =>
      this.logger.warn(`[cloudflared:${ownerId}] ${d.toString().trim()}`),
    );
    proc.on('exit', (code) => {
      this.logger.warn(`cloudflared exited for owner ${ownerId} (code ${code})`);
      this.tunnelProcesses.delete(ownerId);
    });

    this.tunnelProcesses.set(ownerId, proc);
    this.logger.log(`cloudflared started for owner ${ownerId} (pid ${proc.pid})`);
  }

  private stopTunnelProcess(ownerId: string): void {
    const proc = this.tunnelProcesses.get(ownerId);
    if (proc) {
      proc.kill('SIGTERM');
      this.tunnelProcesses.delete(ownerId);
      this.logger.log(`Stopped cloudflared for owner ${ownerId}`);
    }
  }

  private commandExists(cmd: string): Promise<boolean> {
    return new Promise((resolve) => {
      const check = spawn(process.platform === 'win32' ? 'where' : 'which', [cmd], {
        stdio: 'ignore',
      });
      check.on('exit', (code) => resolve(code === 0));
      check.on('error', () => resolve(false));
    });
  }

  /**
   * Returns the path to a runnable cloudflared, in priority order:
   *   1. Override via CLOUDFLARED_BIN env var.
   *   2. Bundled binary at <resourcesPath>/cloudflared/<platform-name>.
   *      In packaged Electron this is /resources/cloudflared/ — main.cjs
   *      exports KOBEOS_RESOURCES_PATH so the Nest server can find it.
   *   3. `cloudflared` on PATH (dev or when the user installed it manually).
   * Returns null if nothing is runnable.
   */
  private resolveCloudflaredBinary(): string | null {
    const envOverride = process.env.CLOUDFLARED_BIN;
    if (envOverride && existsSync(envOverride)) return envOverride;

    const resourcesRoot = process.env.KOBEOS_RESOURCES_PATH;
    if (resourcesRoot) {
      const platformName =
        process.platform === 'win32' ? 'cloudflared-win-x64.exe'
        : process.platform === 'darwin' ? (process.arch === 'arm64' ? 'cloudflared-mac-arm64' : 'cloudflared-mac-x64')
        : 'cloudflared-linux-x64';
      const candidate = join(resourcesRoot, 'cloudflared', platformName);
      if (existsSync(candidate)) return candidate;
    }

    // Dev fallback — server running outside Electron. `spawn('cloudflared')`
    // resolves through PATH; an error here just means the user has to install it.
    return 'cloudflared';
  }

  // ── Cleanup on shutdown ──────────────────────────────────────────────────

  onModuleDestroy() {
    for (const [ownerId] of this.tunnelProcesses) {
      this.stopTunnelProcess(ownerId);
    }
  }
}
