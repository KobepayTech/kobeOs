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
   * Live availability check for a candidate slug. Returns the same
   * verdict logic upsert() would, without persisting anything, so the
   * editor can show as-you-type validation. `currentOwnerId` is the
   * caller (if signed in) so we don't tell them their OWN slug is
   * "taken".
   */
  async checkSlug(rawName: string, currentOwnerId?: string): Promise<{
    available: boolean;
    slug: string;
    reason?: 'invalid' | 'reserved' | 'taken';
  }> {
    const slug = toSlug(rawName ?? '');
    if (!slug) return { available: false, slug, reason: 'invalid' };
    if (RESERVED_SLUGS.has(slug)) return { available: false, slug, reason: 'reserved' };
    const where = currentOwnerId
      ? { domainSlug: slug, ownerId: Not(currentOwnerId) }
      : { domainSlug: slug };
    const conflict = await this.repo.findOne({ where });
    if (conflict) return { available: false, slug, reason: 'taken' };
    return { available: true, slug };
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
