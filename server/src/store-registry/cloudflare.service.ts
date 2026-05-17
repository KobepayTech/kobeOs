import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface CfDnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
}

interface CfApiResponse<T> {
  success: boolean;
  errors: { message: string }[];
  result: T;
}

/**
 * Thin wrapper around the Cloudflare DNS API.
 *
 * Required env vars:
 *   CF_API_TOKEN   — Cloudflare API token with Zone:DNS:Edit permission
 *   CF_ZONE_ID     — Zone ID for kobeapptz.com (found in Cloudflare dashboard)
 *   CF_DOMAIN      — Base domain, e.g. "kobeapptz.com"
 */
@Injectable()
export class CloudflareService {
  private readonly logger = new Logger(CloudflareService.name);
  private readonly baseUrl = 'https://api.cloudflare.com/client/v4';

  constructor(private readonly config: ConfigService) {}

  private get token(): string {
    return this.config.getOrThrow<string>('CF_API_TOKEN');
  }

  private get zoneId(): string {
    return this.config.getOrThrow<string>('CF_ZONE_ID');
  }

  private get domain(): string {
    return this.config.get<string>('CF_DOMAIN', 'kobeapptz.com');
  }

  private async cfFetch<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
    });

    const body = (await res.json()) as CfApiResponse<T>;
    if (!body.success) {
      const msg = body.errors.map((e) => e.message).join(', ');
      this.logger.error(`Cloudflare API error: ${msg}`);
      throw new InternalServerErrorException(`DNS operation failed: ${msg}`);
    }
    return body.result;
  }

  /**
   * Create an A record: {slug}.kobeapptz.com → ip
   * Returns the Cloudflare record ID for future updates/deletes.
   */
  async createARecord(slug: string, ip: string): Promise<string> {
    const record = await this.cfFetch<CfDnsRecord>(
      `/zones/${this.zoneId}/dns_records`,
      {
        method: 'POST',
        body: JSON.stringify({
          type: 'A',
          name: `${slug}.${this.domain}`,
          content: ip,
          ttl: 120,
          proxied: false, // direct — user's server handles SSL
        }),
      },
    );
    this.logger.log(`Created DNS A record: ${slug}.${this.domain} → ${ip} (id: ${record.id})`);
    return record.id;
  }

  /**
   * Update an existing A record to point to a new IP.
   */
  async updateARecord(recordId: string, slug: string, ip: string): Promise<void> {
    await this.cfFetch<CfDnsRecord>(
      `/zones/${this.zoneId}/dns_records/${recordId}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          type: 'A',
          name: `${slug}.${this.domain}`,
          content: ip,
          ttl: 120,
          proxied: false,
        }),
      },
    );
    this.logger.log(`Updated DNS A record ${recordId}: ${slug}.${this.domain} → ${ip}`);
  }

  /**
   * Delete an A record (called when a store is unpublished).
   */
  async deleteARecord(recordId: string): Promise<void> {
    await this.cfFetch<{ id: string }>(
      `/zones/${this.zoneId}/dns_records/${recordId}`,
      { method: 'DELETE' },
    );
    this.logger.log(`Deleted DNS record ${recordId}`);
  }
}
