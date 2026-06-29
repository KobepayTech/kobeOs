import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface CfApiResponse<T> {
  success: boolean;
  errors: { message: string }[];
  result: T;
}

interface CfTunnel {
  id: string;
  name: string;
  status: string;
}

interface CfTunnelToken {
  token: string;
}

/**
 * Cloudflare Tunnel API wrapper.
 *
 * Each KobeOS user gets their own named Cloudflare Tunnel when they publish
 * their store. The tunnel runs as `cloudflared tunnel run` on their local
 * machine — no static IP or port forwarding required.
 *
 * Flow:
 *   1. Create a named tunnel via Cloudflare API  → returns tunnel ID + token
 *   2. Create a CNAME DNS record: {slug}.kobeapptz.com → {tunnelId}.cfargotunnel.com
 *   3. Configure tunnel ingress rules (routes hostname → localhost:3000)
 *   4. Return the tunnel token to the KobeOS backend
 *   5. KobeOS spawns `cloudflared tunnel run --token <token>` locally
 *
 * Required env vars (set in server/.env):
 *   CF_API_TOKEN   — Cloudflare API token with Account:Cloudflare Tunnel:Edit + Zone:DNS:Edit
 *   CF_ACCOUNT_ID  — Cloudflare Account ID (d379a7d03f3714377f11cc7e22c96b5d)
 *   CF_ZONE_ID     — Zone ID for kobeapptz.com (c5f9da50402b712eaa6dd0c83751198b)
 *   CF_DOMAIN      — Base domain (default: kobeapptz.com)
 */
@Injectable()
export class CloudflareService {
  private readonly logger = new Logger(CloudflareService.name);
  private readonly baseUrl = 'https://api.cloudflare.com/client/v4';

  private static readonly DEFAULT_ZONE_ID = 'c5f9da50402b712eaa6dd0c83751198b';
  private static readonly DEFAULT_DOMAIN  = 'kobeapptz.com';

  constructor(private readonly config: ConfigService) {}

  private get apiToken(): string {
    const t = this.config.get<string>('CF_API_TOKEN', '');
    if (!t) throw new InternalServerErrorException('CF_API_TOKEN is not set in server/.env');
    return t;
  }

  /** True when the operator has set CF_API_TOKEN + CF_ACCOUNT_ID. Lets
   *  callers branch on "Cloudflare is reachable" without provoking the
   *  throwing getter above. */
  isCloudflareConfigured(): boolean {
    return Boolean(this.config.get<string>('CF_API_TOKEN', ''))
        && Boolean(this.config.get<string>('CF_ACCOUNT_ID', ''));
  }

  private get accountId(): string {
    const a = this.config.get<string>('CF_ACCOUNT_ID', '');
    if (!a) throw new InternalServerErrorException('CF_ACCOUNT_ID is not set in server/.env');
    return a;
  }

  private get zoneId(): string {
    return this.config.get<string>('CF_ZONE_ID', CloudflareService.DEFAULT_ZONE_ID);
  }

  private get domain(): string {
    return this.config.get<string>('CF_DOMAIN', CloudflareService.DEFAULT_DOMAIN);
  }

  private async cfFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
    });
    const body = (await res.json()) as CfApiResponse<T>;
    if (!body.success) {
      const msg = body.errors.map((e) => e.message).join(', ');
      this.logger.error(`Cloudflare API error on ${path}: ${msg}`);
      throw new InternalServerErrorException(`Cloudflare error: ${msg}`);
    }
    return body.result;
  }

  /**
   * Create (or reuse) a named Cloudflare Tunnel for a store slug.
   * Returns the tunnel ID and the run token needed by cloudflared.
   */
  async createTunnel(slug: string): Promise<{ tunnelId: string; tunnelToken: string }> {
    const tunnelName = `kobeos-${slug}`;

    // Reuse if already exists
    const existing = await this.cfFetch<CfTunnel[]>(
      `/accounts/${this.accountId}/cfd_tunnel?name=${encodeURIComponent(tunnelName)}&is_deleted=false`,
    );

    let tunnelId: string;
    if (existing.length > 0) {
      tunnelId = existing[0].id;
      this.logger.log(`Reusing tunnel ${tunnelId} for "${slug}"`);
    } else {
      const secret = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64');
      const tunnel = await this.cfFetch<CfTunnel>(
        `/accounts/${this.accountId}/cfd_tunnel`,
        { method: 'POST', body: JSON.stringify({ name: tunnelName, tunnel_secret: secret }) },
      );
      tunnelId = tunnel.id;
      this.logger.log(`Created tunnel ${tunnelId} for "${slug}"`);
    }

    const tokenResult = await this.cfFetch<CfTunnelToken>(
      `/accounts/${this.accountId}/cfd_tunnel/${tunnelId}/token`,
    );

    return { tunnelId, tunnelToken: tokenResult.token };
  }

  /**
   * Create or update the CNAME record:
   *   {slug}.kobeapptz.com  →  {tunnelId}.cfargotunnel.com  (proxied)
   */
  async upsertTunnelCname(slug: string, tunnelId: string): Promise<string> {
    const name    = `${slug}.${this.domain}`;
    const content = `${tunnelId}.cfargotunnel.com`;

    const existing = await this.cfFetch<{ id: string }[]>(
      `/zones/${this.zoneId}/dns_records?type=CNAME&name=${encodeURIComponent(name)}`,
    );

    if (existing.length > 0) {
      const recordId = existing[0].id;
      await this.cfFetch(`/zones/${this.zoneId}/dns_records/${recordId}`, {
        method: 'PUT',
        body: JSON.stringify({ type: 'CNAME', name, content, proxied: true, ttl: 1 }),
      });
      this.logger.log(`Updated CNAME ${name} → ${content}`);
      return recordId;
    }

    const record = await this.cfFetch<{ id: string }>(`/zones/${this.zoneId}/dns_records`, {
      method: 'POST',
      body: JSON.stringify({ type: 'CNAME', name, content, proxied: true, ttl: 1 }),
    });
    this.logger.log(`Created CNAME ${name} → ${content}`);
    return record.id;
  }

  /**
   * Push ingress rules to the tunnel so cloudflared knows to route
   * {slug}.kobeapptz.com traffic to localhost:{localPort}.
   * This avoids the need for a config.yml on the user's machine.
   */
  async configureTunnelIngress(tunnelId: string, slug: string, localPort: number): Promise<void> {
    await this.cfFetch(`/accounts/${this.accountId}/cfd_tunnel/${tunnelId}/configurations`, {
      method: 'PUT',
      body: JSON.stringify({
        config: {
          ingress: [
            { hostname: `${slug}.${this.domain}`, service: `http://localhost:${localPort}` },
            { service: 'http_status:404' }, // required catch-all
          ],
        },
      }),
    });
    this.logger.log(`Configured ingress for tunnel ${tunnelId}: ${slug}.${this.domain} → localhost:${localPort}`);
  }

  /**
   * Tear down a tunnel when a store is unpublished.
   * Cleans up active connections first, then deletes the tunnel.
   */
  async deleteTunnel(tunnelId: string): Promise<void> {
    try {
      await this.cfFetch(`/accounts/${this.accountId}/cfd_tunnel/${tunnelId}/connections`, {
        method: 'DELETE',
      });
    } catch { /* already disconnected */ }

    await this.cfFetch(`/accounts/${this.accountId}/cfd_tunnel/${tunnelId}`, { method: 'DELETE' });
    this.logger.log(`Deleted tunnel ${tunnelId}`);
  }

  /** Delete a DNS record by ID (used during unpublish). */
  async deleteDnsRecord(recordId: string): Promise<void> {
    try {
      await this.cfFetch(`/zones/${this.zoneId}/dns_records/${recordId}`, { method: 'DELETE' });
      this.logger.log(`Deleted DNS record ${recordId}`);
    } catch (e) {
      this.logger.warn(`Could not delete DNS record ${recordId}: ${(e as Error).message}`);
    }
  }

  // ── Wildcard multi-tenant deployment ─────────────────────────────────────

  /**
   * One-time admin bootstrap for hosted/multi-tenant deployments.
   *
   * Creates (or reuses):
   *   • a single shared tunnel "kobeos-storefronts"
   *   • a wildcard CNAME "*.kobeapptz.com" → <tunnelId>.cfargotunnel.com
   *   • ingress: catch-all → http://localhost:<port>
   *
   * After this runs once, ANY new store slug works instantly — publishing
   * becomes a database flag flip with zero Cloudflare API calls. Returns
   * the run token so the operator can persist it (e.g. CLOUDFLARED_TOKEN
   * env var) and run `cloudflared tunnel run --token <...>` as a system
   * service.
   *
   * Idempotent — safe to re-run; reuses the existing tunnel + record.
   *
   * REQUIRED Cloudflare API token scopes:
   *   Account → Cloudflare Tunnel → Edit
   *   Zone    → DNS → Edit         (on the kobeapptz.com zone)
   */
  async bootstrapWildcardTunnel(localPort: number): Promise<{
    tunnelId: string;
    tunnelToken: string;
    wildcardRecordId: string;
    wildcardHostname: string;
  }> {
    const tunnelName = 'kobeos-storefronts';
    const wildcardName = `*.${this.domain}`;

    // 1. Reuse or create the shared tunnel.
    const existing = await this.cfFetch<CfTunnel[]>(
      `/accounts/${this.accountId}/cfd_tunnel?name=${encodeURIComponent(tunnelName)}&is_deleted=false`,
    );
    let tunnelId: string;
    if (existing.length > 0) {
      tunnelId = existing[0].id;
      this.logger.log(`Reusing shared wildcard tunnel ${tunnelId}`);
    } else {
      const secret = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64');
      const tunnel = await this.cfFetch<CfTunnel>(
        `/accounts/${this.accountId}/cfd_tunnel`,
        { method: 'POST', body: JSON.stringify({ name: tunnelName, tunnel_secret: secret }) },
      );
      tunnelId = tunnel.id;
      this.logger.log(`Created shared wildcard tunnel ${tunnelId}`);
    }

    // 2. Get the run token (needed by the operator).
    const tokenResult = await this.cfFetch<CfTunnelToken>(
      `/accounts/${this.accountId}/cfd_tunnel/${tunnelId}/token`,
    );

    // 3. Upsert the wildcard CNAME.
    const cnameContent = `${tunnelId}.cfargotunnel.com`;
    const existingDns = await this.cfFetch<{ id: string }[]>(
      `/zones/${this.zoneId}/dns_records?type=CNAME&name=${encodeURIComponent(wildcardName)}`,
    );
    let wildcardRecordId: string;
    if (existingDns.length > 0) {
      wildcardRecordId = existingDns[0].id;
      await this.cfFetch(`/zones/${this.zoneId}/dns_records/${wildcardRecordId}`, {
        method: 'PUT',
        body: JSON.stringify({ type: 'CNAME', name: wildcardName, content: cnameContent, proxied: true, ttl: 1 }),
      });
      this.logger.log(`Updated wildcard CNAME ${wildcardName} → ${cnameContent}`);
    } else {
      const record = await this.cfFetch<{ id: string }>(`/zones/${this.zoneId}/dns_records`, {
        method: 'POST',
        body: JSON.stringify({ type: 'CNAME', name: wildcardName, content: cnameContent, proxied: true, ttl: 1 }),
      });
      wildcardRecordId = record.id;
      this.logger.log(`Created wildcard CNAME ${wildcardName} → ${cnameContent}`);
    }

    // 4. Push a catch-all ingress rule (no per-store rules needed).
    await this.cfFetch(`/accounts/${this.accountId}/cfd_tunnel/${tunnelId}/configurations`, {
      method: 'PUT',
      body: JSON.stringify({
        config: {
          ingress: [
            { service: `http://localhost:${localPort}` },  // catch-all → backend
          ],
        },
      }),
    });
    this.logger.log(`Wildcard tunnel ${tunnelId} ingress → http://localhost:${localPort} (catch-all)`);

    return {
      tunnelId,
      tunnelToken: tokenResult.token,
      wildcardRecordId,
      wildcardHostname: wildcardName,
    };
  }

  // ── Legacy A-record API ──────────────────────────────────────────────────
  // StoreRegistryService still calls these — it's the older publish path that
  // PR #19 supersedes but didn't remove. Keep them as thin wrappers over the
  // raw DNS API so the registry module compiles until it's actually deleted.

  async createARecord(slug: string, ip: string): Promise<string> {
    const res = await this.cfFetch<{ id: string }>(`/zones/${this.zoneId}/dns_records`, {
      method: 'POST',
      body: JSON.stringify({ type: 'A', name: slug, content: ip, ttl: 1, proxied: true }),
    });
    return res.id;
  }

  async updateARecord(recordId: string, slug: string, ip: string): Promise<void> {
    await this.cfFetch(`/zones/${this.zoneId}/dns_records/${recordId}`, {
      method: 'PUT',
      body: JSON.stringify({ type: 'A', name: slug, content: ip, ttl: 1, proxied: true }),
    });
  }

  async deleteARecord(recordId: string): Promise<void> {
    return this.deleteDnsRecord(recordId);
  }
}
