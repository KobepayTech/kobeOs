import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoreSettings } from './store-settings.entity';
import { UpsertStoreSettingsDto } from './dto/store-settings.dto';

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

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

  async upsert(ownerId: string, dto: UpsertStoreSettingsDto): Promise<StoreSettings> {
    const settings = await this.get(ownerId);
    Object.assign(settings, dto);
    // Keep domainSlug in sync with storeName
    if (dto.storeName) {
      settings.domainSlug = toSlug(dto.storeName);
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
