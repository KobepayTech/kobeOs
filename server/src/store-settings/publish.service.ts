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
 * Manages store publishing via Cloudflare Tunnels.
 *
 * Each KobeOS instance is self-hosted on the user's local machine.
 * Publishing works without a static IP or port forwarding:
 *
 *   1. Cloudflare Tunnel is created for the store slug
 *   2. CNAME DNS record is created: {slug}.kobeapptz.com → tunnel endpoint
 *   3. Tunnel ingress is configured to route to localhost:{port}
 *   4. `cloudflared tunnel run --token <token>` is spawned as a child process
 *   5. Store is immediately live at https://{slug}.kobeapptz.com
 *
 * On unpublish the tunnel is deleted and the DNS record removed.
 * On server restart, published stores automatically reconnect (see onModuleInit).
 */
@Injectable()
export class PublishService implements OnModuleDestroy {
  private readonly logger = new Logger(PublishService.name);

  /** Active cloudflared child processes keyed by ownerId */
  private readonly tunnelProcesses = new Map<string, ChildProcess>();

  constructor(
    @InjectRepository(StoreSettings)
    private readonly repo: Repository<StoreSettings>,
    private readonly cf: CloudflareService,
    private readonly config: ConfigService,
  ) {}

  private get localPort(): number {
    return Number(this.config.get('PORT', 3000));
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

    // Stop any existing tunnel for this owner before creating a new one
    this.stopTunnelProcess(ownerId);

    // 1. Create (or reuse) the Cloudflare Tunnel
    const { tunnelId, tunnelToken } = await this.cf.createTunnel(settings.domainSlug);

    // 2. Create/update the CNAME DNS record
    const cfRecordId = await this.cf.upsertTunnelCname(settings.domainSlug, tunnelId);

    // 3. Push ingress configuration to the tunnel
    await this.cf.configureTunnelIngress(tunnelId, settings.domainSlug, this.localPort);

    // 4. Spawn cloudflared on the local machine
    await this.spawnCloudflared(ownerId, tunnelToken);

    // 5. Persist publish state
    settings.isPublished    = true;
    settings.publishedUrl   = `https://${settings.domainSlug}.kobeapptz.com`;
    settings.publishedAt    = new Date();
    // Store tunnel metadata in the notes fields we have available
    (settings as any).cfTunnelId  = tunnelId;
    (settings as any).cfRecordId  = cfRecordId;
    (settings as any).cfToken     = tunnelToken;

    const saved = await this.repo.save(settings);
    this.logger.log(`Store published: ${settings.publishedUrl}`);
    return saved;
  }

  // ── Unpublish ────────────────────────────────────────────────────────────

  async unpublish(ownerId: string): Promise<StoreSettings> {
    const settings = await this.repo.findOne({ where: { ownerId } });
    if (!settings || !settings.isPublished) {
      throw new BadRequestException('No published store found.');
    }

    // Stop the local cloudflared process
    this.stopTunnelProcess(ownerId);

    // Delete the Cloudflare Tunnel and DNS record
    const tunnelId  = (settings as any).cfTunnelId as string | undefined;
    const recordId  = (settings as any).cfRecordId as string | undefined;

    if (tunnelId) {
      try { await this.cf.deleteTunnel(tunnelId); } catch (e) {
        this.logger.warn(`Could not delete tunnel ${tunnelId}: ${(e as Error).message}`);
      }
    }
    if (recordId) {
      try { await this.cf.deleteDnsRecord(recordId); } catch (e) {
        this.logger.warn(`Could not delete DNS record ${recordId}: ${(e as Error).message}`);
      }
    }

    settings.isPublished  = false;
    settings.publishedUrl = null;
    (settings as any).cfTunnelId = null;
    (settings as any).cfRecordId = null;
    (settings as any).cfToken    = null;

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
