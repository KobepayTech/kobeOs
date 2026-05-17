import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface CfRecord { id: string; type: string; name: string; content: string; }
interface CfResponse<T> { success: boolean; errors: { message: string }[]; result: T; }

@Injectable()
export class CloudflareService {
  private readonly logger = new Logger(CloudflareService.name);
  private readonly base = 'https://api.cloudflare.com/client/v4';

  constructor(private readonly cfg: ConfigService) {}

  private get token() { return this.cfg.getOrThrow<string>('CF_API_TOKEN'); }
  private get zoneId() { return this.cfg.getOrThrow<string>('CF_ZONE_ID'); }
  private get domain() { return this.cfg.get<string>('CF_DOMAIN', 'kobeapptz.com'); }

  private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
    const body = (await res.json()) as CfResponse<T>;
    if (!body.success) {
      const msg = body.errors.map(e => e.message).join(', ');
      this.logger.error(`Cloudflare error: ${msg}`);
      throw new InternalServerErrorException(`DNS error: ${msg}`);
    }
    return body.result;
  }

  async createARecord(slug: string, ip: string): Promise<string> {
    const r = await this.call<CfRecord>(`/zones/${this.zoneId}/dns_records`, {
      method: 'POST',
      body: JSON.stringify({ type: 'A', name: `${slug}.${this.domain}`, content: ip, ttl: 120, proxied: false }),
    });
    this.logger.log(`DNS created: ${slug}.${this.domain} → ${ip}`);
    return r.id;
  }

  async updateARecord(recordId: string, slug: string, ip: string): Promise<void> {
    await this.call<CfRecord>(`/zones/${this.zoneId}/dns_records/${recordId}`, {
      method: 'PUT',
      body: JSON.stringify({ type: 'A', name: `${slug}.${this.domain}`, content: ip, ttl: 120, proxied: false }),
    });
    this.logger.log(`DNS updated: ${slug}.${this.domain} → ${ip}`);
  }

  async deleteARecord(recordId: string): Promise<void> {
    await this.call<{ id: string }>(`/zones/${this.zoneId}/dns_records/${recordId}`, { method: 'DELETE' });
    this.logger.log(`DNS deleted: ${recordId}`);
  }
}
