import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChildProcess, spawn } from 'child_process';
import { chmodSync, createWriteStream, existsSync, mkdirSync, statSync, unlinkSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import * as https from 'https';
import { StoreSettings } from './store-settings.entity';
import { CloudflareService } from '../store-registry/cloudflare.service';

const CLOUDFLARED_RELEASE = '2026.5.2';
const CLOUDFLARED_BINARY_NAME =
  process.platform === 'win32' ? 'cloudflared-windows-amd64.exe'
  : process.platform === 'darwin' ? (process.arch === 'arm64' ? 'cloudflared-darwin-arm64' : 'cloudflared-darwin-amd64')
  : 'cloudflared-linux-amd64';

/** Where we drop downloaded cloudflared binaries when the operator clicks
 *  "Install cloudflared" in System Settings. Outside the install dir so it
 *  survives KobeOS upgrades. */
function userDataCloudflaredPath(): string {
  const dataRoot = process.env.KOBEOS_DATA_PATH || join(homedir(), '.kobeos');
  const dir = join(dataRoot, 'cloudflared');
  const fname = process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared';
  return join(dir, fname);
}

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

    // Hosted mode = pure DB flip (wildcard tunnel handles routing).
    // Self-hosted mode = per-store tunnel + cloudflared spawn — BUT only
    // when CF_API_TOKEN is actually set. If the operator hasn't configured
    // Cloudflare credentials yet, we silently fall back to the hosted DB
    // flip so the storefront still gets a `publishedUrl` and the UI can
    // proceed. Operator can come back later, set the env vars, restart,
    // and re-publish for a real tunnel.
    if (this.deploymentMode === 'hosted') {
      return this.publishHosted(settings);
    }
    if (!this.cf.isCloudflareConfigured()) {
      this.logger.warn(
        `Self-hosted publish for ${settings.domainSlug} falling back to DB-only — CF_API_TOKEN not set. ` +
        `Run System Settings → Cloudflare Tunnel → Bootstrap to enable real tunnels.`,
      );
      return this.publishHosted(settings);
    }
    return this.publishSelfHosted(ownerId, settings);
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
    if (!this.cf.isCloudflareConfigured()) {
      throw new BadRequestException(
        'Cloudflare credentials not configured. Set CF_API_TOKEN and CF_ACCOUNT_ID on the server first.',
      );
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
   *   3. User-data binary at ~/.kobeos/cloudflared/cloudflared — written by
   *      installCloudflared() when the operator clicks "Install Cloudflare"
   *      in System Settings (works for installs that didn't ship the
   *      bundled binary, e.g. self-built docker images).
   *   4. `cloudflared` on PATH (dev or when the user installed it manually).
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

    const userInstalled = userDataCloudflaredPath();
    if (existsSync(userInstalled)) return userInstalled;

    // Dev fallback — server running outside Electron. `spawn('cloudflared')`
    // resolves through PATH; an error here just means the user has to install it.
    return 'cloudflared';
  }

  /** True when a runnable cloudflared exists somewhere we can spawn it from.
   *  Used by the System Settings UI to decide whether to surface an
   *  "Install Cloudflare" button. Also reports the deployment mode so the
   *  UI can hide the CTA entirely on hosted backends (the wildcard tunnel
   *  runs centrally; no per-machine binary needed). */
  isCloudflaredInstalled(): {
    installed: boolean;
    source: 'env' | 'bundled' | 'user-data' | 'path' | 'none';
    path: string | null;
    deploymentMode: 'hosted' | 'self-hosted';
  } {
    const deploymentMode = this.deploymentMode;
    const envOverride = process.env.CLOUDFLARED_BIN;
    if (envOverride && existsSync(envOverride)) return { installed: true, source: 'env', path: envOverride, deploymentMode };

    const resourcesRoot = process.env.KOBEOS_RESOURCES_PATH;
    if (resourcesRoot) {
      const platformName =
        process.platform === 'win32' ? 'cloudflared-win-x64.exe'
        : process.platform === 'darwin' ? (process.arch === 'arm64' ? 'cloudflared-mac-arm64' : 'cloudflared-mac-x64')
        : 'cloudflared-linux-x64';
      const candidate = join(resourcesRoot, 'cloudflared', platformName);
      if (existsSync(candidate)) return { installed: true, source: 'bundled', path: candidate, deploymentMode };
    }

    const userInstalled = userDataCloudflaredPath();
    if (existsSync(userInstalled)) return { installed: true, source: 'user-data', path: userInstalled, deploymentMode };

    // PATH check is fire-and-forget; surface unknown rather than blocking the API.
    return { installed: false, source: 'none', path: null, deploymentMode };
  }

  /** Download the cloudflared binary for the current platform into the
   *  user-data dir, make it executable, and return the install location.
   *  Idempotent — calling twice re-downloads (so users can refresh stale
   *  binaries). Follows GitHub release redirects to S3/CDN. */
  async installCloudflared(): Promise<{ installed: boolean; path: string; source: 'user-data'; version: string }> {
    const dest = userDataCloudflaredPath();
    const dir  = join(dest, '..');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const url = `https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED_RELEASE}/${CLOUDFLARED_BINARY_NAME}`;

    this.logger.log(`Downloading cloudflared ${CLOUDFLARED_RELEASE} from ${url}`);

    // Clean up partial leftovers from a previous failed attempt.
    if (existsSync(dest)) {
      try { unlinkSync(dest); } catch { /* permission — best-effort */ }
    }

    await downloadFollowingRedirects(url, dest);

    // Sanity check — non-empty file.
    const stats = statSync(dest);
    if (stats.size < 1024 * 100) {
      try { unlinkSync(dest); } catch { /* */ }
      throw new InternalServerErrorException(
        `cloudflared download was too small (${stats.size} bytes) — likely an HTML error page. Check connectivity to github.com.`,
      );
    }

    // Mark executable on unix.
    if (process.platform !== 'win32') {
      try { chmodSync(dest, 0o755); } catch (e) {
        this.logger.warn(`Could not chmod ${dest}: ${(e as Error).message}`);
      }
    }

    this.logger.log(`cloudflared installed at ${dest}`);
    return { installed: true, path: dest, source: 'user-data', version: CLOUDFLARED_RELEASE };
  }

  // ── Cleanup on shutdown ──────────────────────────────────────────────────

  onModuleDestroy() {
    for (const [ownerId] of this.tunnelProcesses) {
      this.stopTunnelProcess(ownerId);
    }
  }
}

/** Stream-download from `url` to `dest`, following 301/302/307 redirects.
 *  GitHub releases redirect a few times to S3 — node's https.get won't
 *  follow them on its own. */
function downloadFollowingRedirects(url: string, dest: string, hops = 0): Promise<void> {
  if (hops > 5) return Promise.reject(new Error('Too many redirects following cloudflared download'));
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'kobeos-installer' } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        resolve(downloadFollowingRedirects(res.headers.location, dest, hops + 1));
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`Download failed: HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const file = createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
      file.on('error', (err) => { try { unlinkSync(dest); } catch { /* */ } reject(err); });
    });
    req.on('error', reject);
    req.setTimeout(120_000, () => req.destroy(new Error('Download timed out')));
  });
}
