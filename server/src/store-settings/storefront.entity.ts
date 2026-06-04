import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { OwnedEntity } from '../common/owned.entity';

/**
 * Built-in industry template — seeded once at boot for every install. Picked
 * by the shop wizard so a new merchant gets categories, POS layout hints and
 * starter homepage sections that match their industry instead of an empty
 * store.
 */
@Entity('industry_templates')
export class IndustryTemplate extends BaseEntity {
  @Index({ unique: true })
  @Column()
  code!: string;

  @Column()
  name!: string;

  @Column({ default: '' })
  description!: string;

  @Column({ default: '' })
  iconKey!: string;

  /** Default product categories the wizard will create when this template is picked. */
  @Column({ type: 'jsonb', default: [] })
  defaultCategories!: string[];

  /** Homepage sections (in order) the wizard will lay down. */
  @Column({ type: 'jsonb', default: [] })
  defaultSections!: HomepageSectionSpec[];

  /** POS-layout hints (e.g. category buttons, quick keys) — consumed by the POS UI. */
  @Column({ type: 'jsonb', default: {} })
  posLayout!: Record<string, unknown>;

  /** Optional starter product list shown as a tickable checklist in the wizard. */
  @Column({ type: 'jsonb', default: [] })
  starterProducts!: Array<{ name: string; category: string; price?: number }>;

  @Column({ default: true })
  active!: boolean;
}

export type HomepageSectionType =
  | 'hero'
  | 'categories'
  | 'best_sellers'
  | 'new_arrivals'
  | 'featured'
  | 'promotions'
  | 'clearance'
  | 'seasonal'
  | 'testimonials'
  | 'video'
  | 'blog'
  | 'contact'
  | 'map'
  | 'newsletter'
  | 'brands';

export interface HomepageSectionSpec {
  type: HomepageSectionType;
  config?: Record<string, unknown>;
}

/**
 * One configurable section on the storefront homepage. Order is explicit so
 * the editor's drag-and-drop just rewrites this field.
 */
@Entity('store_homepage_sections')
@Index(['ownerId', 'order'])
export class StoreHomepageSection extends OwnedEntity {
  @Column()
  sectionType!: HomepageSectionType;

  @Column({ default: 0 })
  order!: number;

  @Column({ default: true })
  visible!: boolean;

  @Column({ type: 'jsonb', default: {} })
  config!: Record<string, unknown>;
}

export type CollectionType =
  | 'manual'
  | 'featured'
  | 'new_arrivals'
  | 'best_sellers'
  | 'promotions'
  | 'clearance'
  | 'seasonal';

/**
 * A named grouping of products surfaced as its own storefront page. Built-in
 * types (featured / new_arrivals / best_sellers / promotions / clearance /
 * seasonal) auto-resolve their product list from rules; `manual` collections
 * just store an explicit productIds array.
 */
@Entity('store_collections')
@Index(['ownerId', 'slug'], { unique: true })
export class StoreCollection extends OwnedEntity {
  @Column()
  slug!: string;

  @Column()
  name!: string;

  @Column({ default: '' })
  description!: string;

  @Column({ default: 'manual' })
  type!: CollectionType;

  /** Used when type === 'manual'. */
  @Column({ type: 'jsonb', default: [] })
  productIds!: string[];

  /**
   * Used by rule-driven types. Examples:
   *   featured        — { }
   *   new_arrivals    — { days: 30 }
   *   best_sellers    — { topN: 50 }
   *   promotions      — { minDiscountPct: 10 }
   *   clearance       — { stockLessThan: 5 }
   *   seasonal        — { tag: 'holiday' }
   */
  @Column({ type: 'jsonb', default: {} })
  rules!: Record<string, unknown>;

  @Column({ default: true })
  visible!: boolean;

  @Column({ nullable: true, type: 'varchar' })
  imageUrl?: string | null;

  @Column({ default: 0 })
  order!: number;
}
