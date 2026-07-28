import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

export const MODULE_SITE_IDS = ['erp', 'hotel', 'cargo', 'property'] as const;
export type ModuleSiteId = (typeof MODULE_SITE_IDS)[number];

@Entity('module_site_settings')
@Index('UQ_module_site_owner_module', ['ownerId', 'moduleId'], { unique: true })
@Index('UQ_module_site_module_slug', ['moduleId', 'domainSlug'], {
  unique: true,
  where: '"domainSlug" IS NOT NULL',
})
@Index('UQ_module_site_module_custom_domain', ['moduleId', 'customDomain'], {
  unique: true,
  where: '"customDomain" IS NOT NULL',
})
export class ModuleSiteSettings extends BaseEntity {
  @Column('uuid')
  ownerId!: string;

  @Column({ type: 'varchar', length: 32 })
  moduleId!: ModuleSiteId;

  @Column({ default: '' })
  name!: string;

  @Column({ default: '' })
  tagline!: string;

  @Column({ default: '' })
  logoUrl!: string;

  @Column({ default: '' })
  faviconUrl!: string;

  @Column({ default: '#4f46e5' })
  primaryColor!: string;

  @Column({ default: '#8b5cf6' })
  accentColor!: string;

  @Column({ nullable: true, type: 'varchar' })
  domainSlug!: string | null;

  @Column({ nullable: true, type: 'varchar' })
  customDomain!: string | null;

  @Column({ type: 'jsonb', default: {} })
  config!: Record<string, unknown>;

  @Column({ type: 'jsonb', default: {} })
  seo!: Record<string, unknown>;

  @Column({ default: false })
  isPublished!: boolean;

  @Column({ nullable: true, type: 'varchar' })
  publishedUrl!: string | null;

  @Column({ nullable: true, type: 'timestamptz' })
  publishedAt!: Date | null;
}
