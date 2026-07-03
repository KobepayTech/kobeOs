import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StoreRegistration } from './store-registry.entity';
import { ClaimSubdomainDto, HeartbeatDto } from './dto/store-registry.dto';
import { CloudflareService } from './cloudflare.service';

/** Subdomains that can never be claimed by a store. */
const RESERVED = new Set([
  'www', 'api', 'admin', 'mail', 'smtp', 'imap', 'pop', 'pop3',
  'ftp', 'sftp', 'ssh', 'vpn', 'cdn', 'static', 'assets',
  'support', 'help', 'status', 'dev', 'staging', 'beta', 'app',
  'dashboard', 'panel', 'portal', 'auth', 'login', 'signup',
  'registry', 'store', 'stores', 'kobeos', 'kobe',
]);

/** Mark a registration inactive if no heartbeat for this many minutes. */
const STALE_MINUTES = 10;

@Injectable()
export class StoreRegistryService {
  private readonly logger = new Logger(StoreRegistryService.name);
  private readonly deploymentMode: 'hosted' | 'self-hosted';

  constructor(
    @InjectRepository(StoreRegistration)
    private readonly repo: Repository<StoreRegistration>,
    private readonly cf: CloudflareService,
    private readonly config: ConfigService,
  ) {
    const raw = (this.config.get<string>('KOBEOS_DEPLOYMENT') ?? 'hosted').toLowerCase();
    this.deploymentMode = raw === 'self-hosted' ? 'self-hosted' : 'hosted';
  }

  private assertLegacyRegistryWritable(): void {
    if (this.deploymentMode === 'hosted') {
      throw new BadRequestException(
        'Legacy /store-registry writes are disabled in hosted mode. Use /store-settings/publish (wildcard tunnel flow).',
      );
    }
  }

  /** Check whether a slug is available (not taken, not reserved). */
  async checkAvailability(slug: string): Promise<{ available: boolean; reason?: string }> {
    if (RESERVED.has(slug)) {
      return { available: false, reason: 'reserved' };
    }
    const existing = await this.repo.findOne({ where: { slug } });
    if (existing) {
      return { available: false, reason: 'taken' };
    }
    return { available: true };
  }

  /**
   * Claim a subdomain for a KobeOS instance.
   *
   * - Validates the slug is not reserved or taken
   * - Creates (or updates) the Cloudflare A record
   * - Persists the registration
   */
  async claim(ownerId: string, dto: ClaimSubdomainDto): Promise<StoreRegistration> {
    this.assertLegacyRegistryWritable();
    const slug = dto.slug.toLowerCase();

    if (RESERVED.has(slug)) {
      throw new BadRequestException(`"${slug}" is a reserved subdomain`);
    }

    const existing = await this.repo.findOne({ where: { slug } });

    if (existing) {
      // Allow the same owner to re-claim (e.g. IP changed)
      if (existing.ownerId !== ownerId) {
        throw new ConflictException(`The subdomain "${slug}" is already taken`);
      }

      // Update IP if changed
      if (existing.serverIp !== dto.serverIp) {
        if (existing.cfRecordId) {
          await this.cf.updateARecord(existing.cfRecordId, slug, dto.serverIp);
        } else {
          const cfRecordId = await this.cf.createARecord(slug, dto.serverIp);
          existing.cfRecordId = cfRecordId;
        }
        existing.serverIp = dto.serverIp;
      }

      existing.serverPort = dto.serverPort ?? existing.serverPort;
      existing.storeName = dto.storeName ?? existing.storeName;
      existing.status = 'active';
      existing.lastSeenAt = new Date();
      return this.repo.save(existing);
    }

    // New claim — create DNS record first
    const cfRecordId = await this.cf.createARecord(slug, dto.serverIp);

    const registration = this.repo.create({
      slug,
      serverIp: dto.serverIp,
      serverPort: dto.serverPort ?? 3000,
      cfRecordId,
      status: 'active',
      ownerId,
      storeName: dto.storeName ?? slug,
      lastSeenAt: new Date(),
    });

    return this.repo.save(registration);
  }

  /**
   * CENTRAL tunnel provisioning — the token-minting service.
   *
   * Runs on your always-on central host (which alone holds CF_API_TOKEN). A
   * shop installer calls this over the provisioning secret, gets back its
   * subdomain + a cloudflared run token, and starts the tunnel locally. The
   * Cloudflare API token therefore NEVER ships inside the installer.
   *
   * Creates the shop's OWN tunnel (isolated per shop) + CNAME → tunnel +
   * catch-all ingress → the shop's local port, records the allocation, and
   * returns the run token (not persisted — the shop keeps it locally).
   */
  async provisionTunnel(input: {
    ownerId: string;
    storeName?: string;
    slug?: string;
    localPort?: number;
  }): Promise<{ subdomain: string; tunnelToken: string; ingressPort: number; publishedUrl: string }> {
    if (!this.cf.isCloudflareConfigured()) {
      throw new BadRequestException(
        'Central provisioning is not configured: set CF_API_TOKEN (+ CF_ACCOUNT_ID / CF_ZONE_ID) on the provisioning host.',
      );
    }
    const domain = this.config.get<string>('CF_DOMAIN') ?? 'kobeapptz.com';
    const localPort = input.localPort ?? 3000;
    const slug = this.slugify(input.slug || input.storeName || '');
    if (!slug) throw new BadRequestException('A slug or storeName is required.');
    if (RESERVED.has(slug)) throw new BadRequestException(`"${slug}" is a reserved subdomain`);

    // Enforce global uniqueness — another owner can't take a claimed slug.
    const existing = await this.repo.findOne({ where: { slug } });
    if (existing && existing.ownerId !== input.ownerId) {
      throw new ConflictException(`The subdomain "${slug}" is already taken`);
    }

    // Mint the shop's own tunnel + DNS + ingress via the Cloudflare API.
    const { tunnelId, tunnelToken } = await this.cf.createTunnel(slug);
    const cfRecordId = await this.cf.upsertTunnelCname(slug, tunnelId);
    await this.cf.configureTunnelIngress(tunnelId, slug, localPort);

    // Record the allocation (the run token is NOT stored — the shop holds it).
    const reg = existing ?? this.repo.create({ slug, ownerId: input.ownerId });
    reg.serverIp = 'tunnel';
    reg.serverPort = localPort;
    reg.cfRecordId = cfRecordId;
    reg.status = 'active';
    reg.storeName = input.storeName ?? reg.storeName ?? slug;
    reg.lastSeenAt = new Date();
    await this.repo.save(reg);

    this.logger.log(`Provisioned tunnel for ${slug}.${domain} (owner ${input.ownerId})`);
    return {
      subdomain: slug,
      publishedUrl: `https://${slug}.${domain}`,
      tunnelToken,
      ingressPort: localPort,
    };
  }

  /** Normalise a store name / slug into a valid DNS label. */
  private slugify(raw: string): string {
    return raw
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 63);
  }

  /**
   * Unpublish a store — deletes the DNS record and marks the registration inactive.
   */
  async unpublish(ownerId: string, slug: string): Promise<void> {
    this.assertLegacyRegistryWritable();
    const reg = await this.repo.findOne({ where: { slug, ownerId } });
    if (!reg) throw new NotFoundException('Registration not found');

    if (reg.cfRecordId) {
      await this.cf.deleteARecord(reg.cfRecordId);
    }

    reg.status = 'inactive';
    reg.cfRecordId = null;
    await this.repo.save(reg);
  }

  /**
   * Heartbeat — called periodically by each KobeOS instance to signal it is online.
   * Updates lastSeenAt and re-activates if previously marked inactive.
   */
  async heartbeat(ownerId: string, dto: HeartbeatDto): Promise<{ ok: boolean }> {
    this.assertLegacyRegistryWritable();
    const reg = await this.repo.findOne({ where: { slug: dto.slug, ownerId } });
    if (!reg) return { ok: false };

    // If IP changed (e.g. dynamic IP), update the DNS record
    if (reg.serverIp !== dto.serverIp && reg.cfRecordId) {
      await this.cf.updateARecord(reg.cfRecordId, dto.slug, dto.serverIp);
      reg.serverIp = dto.serverIp;
    }

    reg.lastSeenAt = new Date();
    reg.status = 'active';
    await this.repo.save(reg);
    return { ok: true };
  }

  /** Get all registrations for an owner. */
  listByOwner(ownerId: string): Promise<StoreRegistration[]> {
    this.assertLegacyRegistryWritable();
    return this.repo.find({ where: { ownerId }, order: { createdAt: 'DESC' } });
  }

  /**
   * Cron: mark registrations as inactive if no heartbeat in STALE_MINUTES.
   * Runs every 5 minutes.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async markStaleRegistrations(): Promise<void> {
    const cutoff = new Date(Date.now() - STALE_MINUTES * 60 * 1000);
    const stale = await this.repo
      .createQueryBuilder('r')
      .where('r.status = :status', { status: 'active' })
      .andWhere('r.lastSeenAt < :cutoff', { cutoff })
      .getMany();

    if (stale.length === 0) return;

    for (const reg of stale) {
      reg.status = 'inactive';
    }
    await this.repo.save(stale);
    this.logger.log(`Marked ${stale.length} stale registration(s) as inactive`);
  }
}
