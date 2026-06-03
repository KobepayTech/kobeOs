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
import * as path from 'path';
import * as fs from 'fs';
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

  /**
   * Resolve the cloudflared binary path.
   *
   * Priority:
   *   1. Bundled binary in Electron's extraResources/cloudflared/ directory
   *      (present in all installed builds — Windows, Linux, macOS)
   *   2. System PATH (fallback for dev mode where no binary is bundled)
   */
  private resolveBinaryPath(): string | null {
    // When running inside Electron, process.resourcesPath is set
    const resourcesPath = (process as any).resourcesPath as string | undefined;
    if (resourcesPath) {
      const platform = process.platform; // 'win32' | 'linux' | 'darwin'
      const arch     = process.arch;     // 'x64' | 'arm64'

      let binaryName: string;
      if (platform === 'win32')        binaryName = 'cloudflared-win-x64.exe';
      else if (platform === 'darwin')  binaryName = `cloudflared-mac-${arch}`;
      else                             binaryName = 'cloudflared-linux-x64';

      const bundled = path.join(resourcesPath, 'cloudflared', binaryName);
      if (fs.existsSync(bundled)) return bundled;
    }

    // Dev mode fallback — check system PATH
    return null; // commandExists() will try 'cloudflared' from PATH
  }

  private async spawnCloudflared(ownerId: string, token: string): Promise<void> {
    const bundledPath = this.resolveBinaryPath();
    let binaryCmd: string;

    if (bundledPath) {
      binaryCmd = bundledPath;
      this.logger.log(`Using bundled cloudflared: ${bundledPath}`);
    } else {
      // Fall back to system PATH (dev mode)
      const onPath = await this.commandExists('cloudflared');
      if (!onPath) {
        throw new BadRequestException(
          'cloudflared is not installed. ' +
          'Download it from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/ ' +
          'and restart KobeOS.',
        );
      }
      binaryCmd = 'cloudflared';
      this.logger.log('Using system cloudflared from PATH');
    }

    const proc = spawn(binaryCmd, ['tunnel', 'run', '--token', token], {
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

  /** Check whether a command exists on the system PATH. */
  private commandExists(cmd: string): Promise<boolean> {
    return new Promise((resolve) => {
      const checker = spawn(process.platform === 'win32' ? 'where' : 'which', [cmd], {
        stdio: 'ignore',
      });
      checker.on('exit', (code) => resolve(code === 0));
      checker.on('error', () => resolve(false));
    });
  }

  // ── Cleanup on shutdown ──────────────────────────────────────────────────

  onModuleDestroy() {
    for (const [ownerId] of this.tunnelProcesses) {
      this.stopTunnelProcess(ownerId);
    }
  }
}
