import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { StoreSettings } from './store-settings.entity';
import { UpsertStoreSettingsDto } from './dto/store-settings.dto';

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

/** Subdomains that cannot be claimed by a store. */
const RESERVED_SLUGS = new Set([
  'www', 'api', 'admin', 'mail', 'smtp', 'imap', 'pop', 'pop3',
  'ftp', 'sftp', 'ssh', 'vpn', 'cdn', 'static', 'assets',
  'support', 'help', 'status', 'dev', 'staging', 'beta', 'app',
  'dashboard', 'panel', 'portal', 'auth', 'login', 'signup',
]);

@Injectable()
export class StoreSettingsService {
  constructor(
    @InjectRepository(StoreSettings) private readonly repo: Repository<StoreSettings>,
  ) {}

  async get(ownerId: string): Promise<StoreSettings> {
    const existing = await this.repo.findOne({ where: { ownerId } });
    if (existing) return existing;
    // Auto-create defaults on first access
    const defaults = this.repo.create({ ownerId, domainSlug: '' });
    return this.repo.save(defaults);
  }

  /**
   * Check whether a slug is available (not reserved, not taken).
   * If an ownerId is provided, the slug is considered available if it
   * belongs to that same owner — this lets operators re-publish or
   * check their own slug without getting a false "taken" response.
   */
  async checkSlugAvailability(
    slug: string,
    ownerId?: string,
  ): Promise<{ available: boolean; reason?: string }> {
    const normalised = toSlug(slug);
    if (!normalised) return { available: false, reason: 'invalid' };
    if (RESERVED_SLUGS.has(normalised)) return { available: false, reason: 'reserved' };
    const conflict = await this.repo.findOne({ where: { domainSlug: normalised } });
    if (conflict) {
      // Same owner → effectively available (they already own it)
      if (ownerId && conflict.ownerId === ownerId) return { available: true };
      return { available: false, reason: 'taken' };
    }
    return { available: true };
  }

  async upsert(ownerId: string, dto: UpsertStoreSettingsDto): Promise<StoreSettings> {
    const settings = await this.get(ownerId);
    Object.assign(settings, dto);

    // Keep domainSlug in sync with storeName
    if (dto.storeName) {
      const slug = toSlug(dto.storeName);

      if (RESERVED_SLUGS.has(slug)) {
        throw new BadRequestException(`"${slug}" is a reserved subdomain and cannot be used as a store name`);
      }

      // Ensure no other owner already holds this slug
      const conflict = await this.repo.findOne({
        where: { domainSlug: slug, ownerId: Not(ownerId) },
      });
      if (conflict) {
        throw new ConflictException(`The subdomain "${slug}" is already taken`);
      }

      settings.domainSlug = slug;
    }

    // Normalise customDomain: strip protocol, lowercase, trim
    if (dto.customDomain !== undefined) {
      settings.customDomain = dto.customDomain
        ? dto.customDomain.replace(/^https?:\/\//i, '').toLowerCase().trim() || null
        : null;
    }

    return this.repo.save(settings);
  }
}
