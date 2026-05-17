import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StoreSettings } from './store-settings.entity';

interface RegistryClaimResponse {
  slug: string;
  serverIp: string;
  status: string;
}

/**
 * Handles publishing a KobeOS store to the central registry.
 *
 * Flow:
 *  1. Detect this instance's public IP via ipify
 *  2. POST /api/store-registry/claim to the central registry API
 *     (identified by REGISTRY_API_URL env var)
 *  3. Persist publish state + public URL on StoreSettings
 *
 * Also sends a heartbeat every 5 minutes so the registry knows this
 * instance is still online.
 */
@Injectable()
export class PublishService {
  private readonly logger = new Logger(PublishService.name);

  constructor(
    @InjectRepository(StoreSettings)
    private readonly repo: Repository<StoreSettings>,
    private readonly config: ConfigService,
  ) {}

  /** Central KobePay registry — hardcoded so users never need to configure it. */
  private get registryUrl(): string {
    return this.config.get<string>('REGISTRY_API_URL', 'https://api.kobeapptz.com');
  }

  private get domain(): string {
    return this.config.get<string>('CF_DOMAIN', 'kobeapptz.com');
  }

  /** Detect this server's public IP via ipify (lightweight, no auth needed). */
  private async detectPublicIp(): Promise<string> {
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      const body = (await res.json()) as { ip: string };
      return body.ip;
    } catch {
      throw new ServiceUnavailableException(
        'Could not detect public IP. Check your internet connection.',
      );
    }
  }

  /**
   * Publish this KobeOS instance's store.
   * Requires REGISTRY_API_URL to be set and a valid JWT for the registry.
   */
  async publish(
    ownerId: string,
    registryJwt: string,
  ): Promise<StoreSettings> {
    const settings = await this.repo.findOne({ where: { ownerId } });
    if (!settings) throw new BadRequestException('Store settings not found. Save your store first.');
    if (!settings.domainSlug) throw new BadRequestException('Store name is required before publishing.');

    if (!this.registryUrl) {
      throw new ServiceUnavailableException(
        'REGISTRY_API_URL is not configured on this KobeOS instance.',
      );
    }

    const serverIp = await this.detectPublicIp();

    const res = await fetch(`${this.registryUrl}/api/store-registry/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${registryJwt}`,
      },
      body: JSON.stringify({
        slug: settings.domainSlug,
        serverIp,
        serverPort: Number(this.config.get('PORT', 3000)),
        storeName: settings.storeName,
      }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      throw new BadRequestException(body.message ?? `Registry returned ${res.status}`);
    }

    const claim = (await res.json()) as RegistryClaimResponse;

    settings.isPublished = true;
    settings.publishedUrl = `https://${claim.slug}.${this.domain}`;
    settings.publishedAt = new Date();
    const saved = await this.repo.save(settings);

    this.logger.log(`Store published: ${settings.publishedUrl} (IP: ${serverIp})`);
    return saved;
  }

  /**
   * Unpublish — removes the DNS record via the registry and clears publish state.
   */
  async unpublish(ownerId: string, registryJwt: string): Promise<StoreSettings> {
    const settings = await this.repo.findOne({ where: { ownerId } });
    if (!settings || !settings.domainSlug) throw new BadRequestException('No published store found.');

    if (this.registryUrl) {
      const res = await fetch(
        `${this.registryUrl}/api/store-registry/${encodeURIComponent(settings.domainSlug)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${registryJwt}` },
        },
      );
      if (!res.ok && res.status !== 404) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new BadRequestException(body.message ?? `Registry returned ${res.status}`);
      }
    }

    settings.isPublished = false;
    settings.publishedUrl = null;
    return this.repo.save(settings);
  }

  /**
   * Check availability of a slug against the central registry.
   * Returns { available, reason } without requiring auth.
   */
  async checkSlug(slug: string): Promise<{ available: boolean; reason?: string }> {
    if (!this.registryUrl) return { available: true };
    try {
      const res = await fetch(
        `${this.registryUrl}/api/store-registry/check/${encodeURIComponent(slug)}`,
      );
      return (await res.json()) as { available: boolean; reason?: string };
    } catch {
      // Registry unreachable — optimistically allow
      return { available: true };
    }
  }

  /**
   * Heartbeat cron — runs every 5 minutes on each KobeOS instance.
   * Keeps the registry record alive so the store stays marked as active.
   *
   * Requires REGISTRY_HEARTBEAT_TOKEN env var (a long-lived token for this instance).
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async sendHeartbeats(): Promise<void> {
    if (!this.registryUrl) return;

    const token = this.config.get<string>('REGISTRY_HEARTBEAT_TOKEN', '');
    if (!token) return;

    // Find all published stores on this instance
    const published = await this.repo.find({ where: { isPublished: true } });
    if (published.length === 0) return;

    let ip: string;
    try {
      ip = await this.detectPublicIp();
    } catch {
      this.logger.warn('Heartbeat skipped — could not detect public IP');
      return;
    }

    for (const store of published) {
      if (!store.domainSlug) continue;
      try {
        await fetch(`${this.registryUrl}/api/store-registry/heartbeat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ slug: store.domainSlug, serverIp: ip }),
        });
      } catch (e) {
        this.logger.warn(`Heartbeat failed for ${store.domainSlug}: ${(e as Error).message}`);
      }
    }
  }
}
