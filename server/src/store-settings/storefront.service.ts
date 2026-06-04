import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import {
  CollectionType,
  HomepageSectionType,
  IndustryTemplate,
  StoreCollection,
  StoreHomepageSection,
} from './storefront.entity';
import { StoreSettings } from './store-settings.entity';
import { PosProduct } from '../pos/pos.entity';
import { INDUSTRY_TEMPLATES } from './storefront.seed';

@Injectable()
export class StorefrontService implements OnModuleInit {
  private readonly logger = new Logger(StorefrontService.name);

  constructor(
    @InjectRepository(IndustryTemplate) private readonly templates: Repository<IndustryTemplate>,
    @InjectRepository(StoreCollection) private readonly collections: Repository<StoreCollection>,
    @InjectRepository(StoreHomepageSection) private readonly sections: Repository<StoreHomepageSection>,
    @InjectRepository(PosProduct) private readonly products: Repository<PosProduct>,
    @InjectRepository(StoreSettings) private readonly settings: Repository<StoreSettings>,
  ) {}

  /** Resolve a public-facing slug or custom domain to the owner uid behind it. */
  async resolveOwnerBySlug(slug: string): Promise<string> {
    const found =
      (await this.settings.findOne({ where: { domainSlug: slug } })) ??
      (await this.settings.findOne({ where: { customDomain: slug } }));
    if (!found) throw new NotFoundException('Store not found');
    return found.ownerId;
  }

  /** Seed built-in industry templates once at boot. Idempotent — only inserts missing codes. */
  async onModuleInit() {
    for (const tpl of INDUSTRY_TEMPLATES) {
      const existing = await this.templates.findOne({ where: { code: tpl.code } });
      if (existing) continue;
      await this.templates.save(this.templates.create(tpl));
    }
    this.logger.log(`Industry templates ready (${INDUSTRY_TEMPLATES.length} built-in).`);
  }

  // ── industry templates ─────────────────────────────────────────────────────

  listTemplates() {
    return this.templates.find({ where: { active: true }, order: { name: 'ASC' } });
  }

  async getTemplate(code: string) {
    const tpl = await this.templates.findOne({ where: { code } });
    if (!tpl) throw new NotFoundException(`Industry template ${code} not found`);
    return tpl;
  }

  /**
   * Apply a template to an owner: lay down default homepage sections and the
   * built-in collections (Featured / New Arrivals / Best Sellers /
   * Promotions / Clearance / Seasonal). Idempotent — re-running on the same
   * owner is a no-op for already-existing rows.
   */
  async applyTemplate(ownerId: string, code: string) {
    const tpl = await this.getTemplate(code);

    // Replace homepage sections with template defaults.
    await this.sections.delete({ ownerId });
    const seeded = tpl.defaultSections.map((s, idx) =>
      this.sections.create({ ownerId, sectionType: s.type, order: idx, visible: true, config: s.config ?? {} }),
    );
    await this.sections.save(seeded);

    // Ensure built-in collections exist for this owner.
    await this.ensureBuiltinCollections(ownerId);

    return { template: tpl.code, sections: seeded.length };
  }

  // ── homepage sections (drag-and-drop builder) ──────────────────────────────

  listSections(ownerId: string) {
    return this.sections.find({ where: { ownerId }, order: { order: 'ASC' } });
  }

  async addSection(ownerId: string, sectionType: HomepageSectionType, config: Record<string, unknown> = {}) {
    const max = await this.sections
      .createQueryBuilder('s')
      .select('COALESCE(MAX(s.order), -1) + 1', 'next')
      .where('s."ownerId" = :ownerId', { ownerId })
      .getRawOne<{ next: number }>();
    const order = Number(max?.next ?? 0);
    return this.sections.save(this.sections.create({ ownerId, sectionType, order, visible: true, config }));
  }

  async updateSection(ownerId: string, id: string, patch: Partial<StoreHomepageSection>) {
    const row = await this.sections.findOne({ where: { ownerId, id } });
    if (!row) throw new NotFoundException('Section not found');
    Object.assign(row, patch);
    return this.sections.save(row);
  }

  async removeSection(ownerId: string, id: string) {
    const row = await this.sections.findOne({ where: { ownerId, id } });
    if (!row) throw new NotFoundException('Section not found');
    await this.sections.remove(row);
    return { removed: true };
  }

  /** Reorder by passing an ordered array of section ids — the index becomes the new `order`. */
  async reorderSections(ownerId: string, orderedIds: string[]) {
    const rows = await this.sections.find({ where: { ownerId, id: In(orderedIds) } });
    const map = new Map(rows.map((r) => [r.id, r]));
    const out: StoreHomepageSection[] = [];
    orderedIds.forEach((id, idx) => {
      const r = map.get(id);
      if (r) {
        r.order = idx;
        out.push(r);
      }
    });
    await this.sections.save(out);
    return out;
  }

  // ── collections ────────────────────────────────────────────────────────────

  listCollections(ownerId: string) {
    return this.collections.find({ where: { ownerId, visible: true }, order: { order: 'ASC', name: 'ASC' } });
  }

  async getCollectionBySlug(ownerId: string, slug: string) {
    const col = await this.collections.findOne({ where: { ownerId, slug } });
    if (!col) throw new NotFoundException('Collection not found');
    return col;
  }

  async createCollection(ownerId: string, dto: Partial<StoreCollection>) {
    const slug = (dto.slug ?? dto.name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!slug) throw new NotFoundException('Collection slug required');
    return this.collections.save(
      this.collections.create({
        ownerId,
        slug,
        name: dto.name ?? slug,
        description: dto.description ?? '',
        type: (dto.type ?? 'manual') as CollectionType,
        productIds: dto.productIds ?? [],
        rules: dto.rules ?? {},
        visible: dto.visible ?? true,
        imageUrl: dto.imageUrl ?? null,
        order: dto.order ?? 0,
      }),
    );
  }

  async updateCollection(ownerId: string, id: string, patch: Partial<StoreCollection>) {
    const row = await this.collections.findOne({ where: { ownerId, id } });
    if (!row) throw new NotFoundException('Collection not found');
    Object.assign(row, patch);
    return this.collections.save(row);
  }

  async removeCollection(ownerId: string, id: string) {
    const row = await this.collections.findOne({ where: { ownerId, id } });
    if (!row) throw new NotFoundException('Collection not found');
    await this.collections.remove(row);
    return { removed: true };
  }

  /**
   * Resolve a collection to its actual product list. Manual collections use
   * `productIds` directly; rule-driven collections evaluate against the
   * owner's PosProduct catalogue at query time.
   */
  async resolveProducts(ownerId: string, slug: string, page = 1, limit = 24) {
    const col = await this.getCollectionBySlug(ownerId, slug);
    const skip = Math.max(0, (page - 1) * limit);
    const take = Math.min(Math.max(1, limit), 100);

    if (col.type === 'manual') {
      if (!col.productIds.length) return { collection: col, products: [], total: 0 };
      const [rows, total] = await this.products.findAndCount({
        where: { ownerId, id: In(col.productIds), active: true },
        skip,
        take,
      });
      return { collection: col, products: rows, total };
    }

    const qb = this.products.createQueryBuilder('p').where('p."ownerId" = :ownerId AND p.active = true', { ownerId });

    if (col.type === 'featured') {
      qb.andWhere('p.featured = true');
    } else if (col.type === 'new_arrivals') {
      const days = Number((col.rules as { days?: number }).days ?? 30);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      qb.andWhere('p."publishedAt" >= :since', { since: since.toISOString() });
      qb.orderBy('p."publishedAt"', 'DESC');
    } else if (col.type === 'best_sellers') {
      qb.orderBy('p."unitsSold"', 'DESC');
    } else if (col.type === 'promotions') {
      const minPct = Number((col.rules as { minDiscountPct?: number }).minDiscountPct ?? 10);
      qb.andWhere('p."compareAtPrice" IS NOT NULL AND p."compareAtPrice" > p.price');
      qb.andWhere('(p."compareAtPrice" - p.price) / p."compareAtPrice" * 100 >= :minPct', { minPct });
    } else if (col.type === 'clearance') {
      const stockLessThan = Number((col.rules as { stockLessThan?: number }).stockLessThan ?? 5);
      qb.andWhere('p.stock > 0 AND p.stock < :stockLessThan', { stockLessThan });
    } else if (col.type === 'seasonal') {
      const tag = String((col.rules as { tag?: string }).tag ?? 'seasonal');
      qb.andWhere(`p.tags ? :tag`, { tag });
    }

    const [products, total] = await qb.skip(skip).take(take).getManyAndCount();
    return { collection: col, products, total };
  }

  /** Idempotent: seed the six rule-driven collections if not already present. */
  async ensureBuiltinCollections(ownerId: string) {
    const builtins: Array<Partial<StoreCollection>> = [
      { slug: 'featured', name: 'Featured', type: 'featured', order: 1 },
      { slug: 'new-arrivals', name: 'New Arrivals', type: 'new_arrivals', rules: { days: 30 }, order: 2 },
      { slug: 'best-sellers', name: 'Best Sellers', type: 'best_sellers', rules: { topN: 50 }, order: 3 },
      { slug: 'promotions', name: 'Offers', type: 'promotions', rules: { minDiscountPct: 10 }, order: 4 },
      { slug: 'clearance', name: 'Clearance', type: 'clearance', rules: { stockLessThan: 5 }, order: 5 },
      { slug: 'seasonal', name: 'Seasonal', type: 'seasonal', rules: { tag: 'seasonal' }, order: 6 },
    ];
    for (const spec of builtins) {
      const existing = await this.collections.findOne({ where: { ownerId, slug: spec.slug! } });
      if (existing) continue;
      await this.collections.save(this.collections.create({ ownerId, ...spec }));
    }
  }

  // ── brands listing — derived from products, used by the Brands page ────────

  async listBrands(ownerId: string) {
    const rows = await this.products
      .createQueryBuilder('p')
      .select('p.brand', 'brand')
      .addSelect('COUNT(*)', 'productCount')
      .where('p."ownerId" = :ownerId AND p.active = true AND p.brand IS NOT NULL AND p.brand <> \'\'', { ownerId })
      .groupBy('p.brand')
      .orderBy('p.brand', 'ASC')
      .getRawMany<{ brand: string; productCount: string }>();
    return rows.map((r) => ({ brand: r.brand, productCount: Number(r.productCount) }));
  }

  /** Auto-tag products published in the last N days as new arrivals. */
  async refreshNewArrivalsCutoff(ownerId: string, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.products.find({
      where: { ownerId, active: true, publishedAt: MoreThanOrEqual(since) },
      order: { publishedAt: 'DESC' },
      take: 50,
    });
  }
}
