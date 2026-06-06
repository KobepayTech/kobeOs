import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('store_settings')
export class StoreSettings extends BaseEntity {
  /** One settings record per user/company — enforced by unique index */
  @Index({ unique: true })
  @Column('uuid')
  ownerId!: string;

  // Store Identity
  @Column({ default: 'My Store' })
  storeName!: string;

  @Column({ default: '' })
  tagline!: string;

  @Column({ default: '' })
  logoUrl!: string;

  @Column({ default: '' })
  faviconUrl!: string;

  // Domain
  /**
   * Custom domain entered by the user (e.g. shop.mycompany.com).
   * When null the frontend shows the default subdomain pattern.
   */
  @Column({ nullable: true, type: 'varchar' })
  customDomain!: string | null;

  /**
   * Default subdomain slug derived from storeName (e.g. "my-store").
   * Full default URL: {slug}.kobestore.app
   */
  @Column({ default: '' })
  domainSlug!: string;

  // Hero Banner
  @Column({ default: 'Welcome to Our Store' })
  bannerHeadline!: string;

  @Column({ default: 'Quality products, fast delivery' })
  bannerSubtext!: string;

  @Column({ default: 'Shop Now' })
  bannerCta!: string;

  @Column({ default: 'from-blue-600 to-purple-700' })
  bannerBg!: string;

  @Column({ default: 'medium' })
  bannerHeight!: string;

  @Column({ default: true })
  bannerVisible!: boolean;

  // Theme
  @Column({ default: '#6366f1' })
  primaryColor!: string;

  @Column({ default: '#8b5cf6' })
  accentColor!: string;

  @Column({ default: 'dark' })
  bgStyle!: string;

  @Column({ default: 'glass' })
  cardStyle!: string;

  // Product Grid
  @Column({ default: 3 })
  gridColumns!: number;

  @Column({ default: 'standard' })
  productCardStyle!: string;

  @Column({ default: true })
  showStock!: boolean;

  @Column({ default: true })
  showCategoryBadge!: boolean;

  @Column({ default: true })
  showQuickAdd!: boolean;

  @Column({ default: 12 })
  productsPerPage!: number;

  // Layout
  @Column({ default: 'centered' })
  headerStyle!: string;

  @Column({ default: true })
  showSearch!: boolean;

  @Column({ default: true })
  showCategoryNav!: boolean;

  @Column({ default: true })
  showCartIcon!: boolean;

  @Column({ default: '' })
  footerText!: string;

  @Column({ default: true })
  enableCategoryNav!: boolean;

  // Typography
  @Column({ default: 'medium' })
  headingSize!: string;

  @Column({ default: 'medium' })
  bodySize!: string;

  /**
   * Jersey-shop layout config — top promo bar, hero, trust strip, footer
   * columns. Stored as JSON so the editor can iterate without a migration
   * per new field. Defaults applied client-side in JerseyShopChrome when
   * the column is empty.
   */
  @Column({ type: 'jsonb', default: {} })
  jerseyConfig!: {
    topPromo?: { text?: string; ctaText?: string; bgColor?: string };
    hero?: { headline?: string; subtext?: string; cta?: string; imageUrl?: string; gradientFrom?: string; gradientTo?: string };
    trustStrip?: Array<{ icon: 'truck' | 'shield' | 'rotate' | 'star'; title: string; desc: string }>;
    footerColumns?: Array<{ title: string; items: Array<{ label: string; href?: string }> }>;
    newsletterPitch?: string;
  };

  // Publish state (managed by publish/unpublish endpoints)
  @Column({ default: false })
  isPublished!: boolean;

  /** Public URL once published, e.g. https://kelvinfashion.kobeapptz.com */
  @Column({ nullable: true, type: 'varchar' })
  publishedUrl!: string | null;

  /** Last time this store was successfully published */
  @Column({ nullable: true, type: 'timestamptz' })
  publishedAt!: Date | null;

  // Cloudflare Tunnel metadata (set by PublishService)
  /** Cloudflare Tunnel ID — used to delete/update the tunnel on unpublish */
  @Column({ nullable: true, type: 'varchar' })
  cfTunnelId!: string | null;

  /** Cloudflare DNS record ID for the CNAME — used to delete on unpublish */
  @Column({ nullable: true, type: 'varchar' })
  cfRecordId!: string | null;

  /**
   * Cloudflare Tunnel run token — passed to `cloudflared tunnel run --token`.
   * Stored so the tunnel can be restarted after a server reboot without
   * calling the Cloudflare API again.
   */
  @Column({ nullable: true, type: 'text' })
  cfToken!: string | null;
}
