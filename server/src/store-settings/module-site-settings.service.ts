import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { StoreSettings } from './store-settings.entity';
import {
  MODULE_SITE_IDS,
  ModuleSiteId,
  ModuleSiteSettings,
} from './module-site-settings.entity';
import { UpsertModuleSiteSettingsDto } from './dto/module-site-settings.dto';

const RESERVED_SLUGS = new Set([
  'www', 'api', 'admin', 'mail', 'smtp', 'imap', 'pop', 'pop3',
  'ftp', 'sftp', 'ssh', 'vpn', 'cdn', 'static', 'assets',
  'support', 'help', 'status', 'dev', 'staging', 'beta', 'app',
  'dashboard', 'panel', 'portal', 'auth', 'login', 'signup',
]);
const MAX_JSON_BYTES = 128 * 1024;

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

@Injectable()
export class ModuleSiteSettingsService {
  constructor(
    @InjectRepository(ModuleSiteSettings)
    private readonly repo: Repository<ModuleSiteSettings>,
    @InjectRepository(StoreSettings)
    private readonly legacyRepo: Repository<StoreSettings>,
  ) {}

  assertModule(moduleId: string): asserts moduleId is ModuleSiteId {
    if (!MODULE_SITE_IDS.includes(moduleId as ModuleSiteId)) {
      throw new BadRequestException(
        `Unsupported module site "${moduleId}". Expected one of: ${MODULE_SITE_IDS.join(', ')}`,
      );
    }
  }

  private ensureJsonSize(value: Record<string, unknown> | undefined, field: string) {
    if (!value) return;
    if (Buffer.byteLength(JSON.stringify(value), 'utf8') > MAX_JSON_BYTES) {
      throw new BadRequestException(`${field} is too large (maximum 128 KB)`);
    }
  }

  private publicUrl(moduleId: ModuleSiteId, slug: string): string {
    switch (moduleId) {
      case 'erp': return `https://${slug}.kobeapptz.com`;
      case 'hotel': return `https://${slug}.kobeapptz.com/book`;
      case 'cargo': return `https://kobeapptz.com/cg/${slug}`;
      case 'property': return `https://kobeapptz.com/property/${slug}`;
    }
  }

  private async createFromLegacy(ownerId: string, moduleId: ModuleSiteId) {
    const legacy = await this.legacyRepo.findOne({ where: { ownerId } });
    const slug = legacy?.domainSlug || null;
    const config = (legacy?.siteConfig ?? {}) as Record<string, unknown>;
    return this.repo.create({
      ownerId,
      moduleId,
      name: legacy?.storeName ?? '',
      tagline: legacy?.tagline ?? '',
      logoUrl: legacy?.logoUrl ?? '',
      faviconUrl: legacy?.faviconUrl ?? '',
      primaryColor: legacy?.primaryColor ?? '#4f46e5',
      accentColor: legacy?.accentColor ?? '#8b5cf6',
      domainSlug: slug,
      // A custom hostname cannot safely point to several modules at once. The
      // legacy ERP keeps its custom domain; other modules start on module URLs.
      customDomain: moduleId === 'erp' ? (legacy?.customDomain ?? null) : null,
      config,
      seo: {},
      isPublished: Boolean(legacy?.isPublished && slug),
      publishedUrl: legacy?.isPublished && slug ? this.publicUrl(moduleId, slug) : null,
      publishedAt: legacy?.publishedAt ?? null,
    });
  }

  async get(ownerId: string, moduleIdRaw: string): Promise<ModuleSiteSettings> {
    this.assertModule(moduleIdRaw);
    const moduleId = moduleIdRaw;
    const existing = await this.repo.findOne({ where: { ownerId, moduleId } });
    if (existing) return existing;
    return this.repo.save(await this.createFromLegacy(ownerId, moduleId));
  }

  async getPublic(moduleIdRaw: string, slugOrDomain: string): Promise<ModuleSiteSettings> {
    this.assertModule(moduleIdRaw);
    const moduleId = moduleIdRaw;
    const key = slugOrDomain.trim().toLowerCase();
    const site = await this.repo.findOne({
      where: [
        { moduleId, domainSlug: key, isPublished: true },
        { moduleId, customDomain: key, isPublished: true },
      ],
    });
    if (!site) throw new NotFoundException(`${moduleId} site not found or not published`);
    return site;
  }

  async checkSlugAvailability(
    moduleIdRaw: string,
    slug: string,
    ownerId?: string,
  ): Promise<{ available: boolean; slug: string; reason?: string }> {
    this.assertModule(moduleIdRaw);
    const moduleId = moduleIdRaw;
    const normalised = toSlug(slug);
    if (!normalised) return { available: false, slug: normalised, reason: 'invalid' };
    if (RESERVED_SLUGS.has(normalised)) {
      return { available: false, slug: normalised, reason: 'reserved' };
    }
    const conflict = await this.repo.findOne({ where: { moduleId, domainSlug: normalised } });
    if (conflict && (!ownerId || conflict.ownerId !== ownerId)) {
      return { available: false, slug: normalised, reason: 'taken' };
    }
    return { available: true, slug: normalised };
  }

  async upsert(
    ownerId: string,
    moduleIdRaw: string,
    dto: UpsertModuleSiteSettingsDto,
  ): Promise<ModuleSiteSettings> {
    this.assertModule(moduleIdRaw);
    const moduleId = moduleIdRaw;
    this.ensureJsonSize(dto.config, 'config');
    this.ensureJsonSize(dto.seo, 'seo');

    const site = await this.get(ownerId, moduleId);
    const nextSlugInput = dto.domainSlug !== undefined
      ? dto.domainSlug
      : (!site.domainSlug && dto.name ? dto.name : undefined);

    if (nextSlugInput !== undefined) {
      const slug = toSlug(nextSlugInput);
      if (!slug) throw new BadRequestException('A valid site slug is required');
      if (RESERVED_SLUGS.has(slug)) {
        throw new BadRequestException(`"${slug}" is a reserved site slug`);
      }
      const conflict = await this.repo.findOne({
        where: { moduleId, domainSlug: slug, ownerId: Not(ownerId) },
      });
      if (conflict) throw new ConflictException(`The ${moduleId} site slug "${slug}" is already taken`);
      site.domainSlug = slug;
    }

    if (dto.customDomain !== undefined) {
      const customDomain = dto.customDomain
        ? dto.customDomain.replace(/^https?:\/\//i, '').replace(/\/$/, '').trim().toLowerCase()
        : null;
      if (customDomain) {
        const conflict = await this.repo.findOne({
          where: { moduleId, customDomain, ownerId: Not(ownerId) },
        });
        if (conflict) throw new ConflictException(`The domain "${customDomain}" is already used by another ${moduleId} site`);
      }
      site.customDomain = customDomain;
    }

    if (dto.name !== undefined) site.name = dto.name.trim();
    if (dto.tagline !== undefined) site.tagline = dto.tagline;
    if (dto.logoUrl !== undefined) site.logoUrl = dto.logoUrl;
    if (dto.faviconUrl !== undefined) site.faviconUrl = dto.faviconUrl;
    if (dto.primaryColor !== undefined) site.primaryColor = dto.primaryColor;
    if (dto.accentColor !== undefined) site.accentColor = dto.accentColor;
    if (dto.config !== undefined) site.config = dto.config;
    if (dto.seo !== undefined) site.seo = dto.seo;

    if (site.isPublished && site.domainSlug) {
      site.publishedUrl = site.customDomain
        ? `https://${site.customDomain}`
        : this.publicUrl(moduleId, site.domainSlug);
    }
    return this.repo.save(site);
  }

  async publish(ownerId: string, moduleIdRaw: string): Promise<ModuleSiteSettings> {
    const site = await this.get(ownerId, moduleIdRaw);
    if (!site.domainSlug) throw new BadRequestException('Set a site name or slug before publishing');
    site.isPublished = true;
    site.publishedAt = new Date();
    site.publishedUrl = site.customDomain
      ? `https://${site.customDomain}`
      : this.publicUrl(site.moduleId, site.domainSlug);
    return this.repo.save(site);
  }

  async unpublish(ownerId: string, moduleIdRaw: string): Promise<ModuleSiteSettings> {
    const site = await this.get(ownerId, moduleIdRaw);
    site.isPublished = false;
    site.publishedUrl = null;
    site.publishedAt = null;
    return this.repo.save(site);
  }
}
