import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStoreSettingsTable1778900000005 implements MigrationInterface {
  name = 'AddStoreSettingsTable1778900000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "store_settings" (
        "id"               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        "createdAt"        timestamptz NOT NULL DEFAULT now(),
        "updatedAt"        timestamptz NOT NULL DEFAULT now(),
        "ownerId"          uuid        NOT NULL,
        "storeName"        varchar     NOT NULL DEFAULT 'My Store',
        "tagline"          varchar     NOT NULL DEFAULT '',
        "logoUrl"          varchar     NOT NULL DEFAULT '',
        "faviconUrl"       varchar     NOT NULL DEFAULT '',
        "customDomain"     varchar,
        "domainSlug"       varchar     NOT NULL DEFAULT '',
        "bannerHeadline"   varchar     NOT NULL DEFAULT 'Welcome to Our Store',
        "bannerSubtext"    varchar     NOT NULL DEFAULT 'Quality products, fast delivery',
        "bannerCta"        varchar     NOT NULL DEFAULT 'Shop Now',
        "bannerBg"         varchar     NOT NULL DEFAULT 'from-blue-600 to-purple-700',
        "bannerHeight"     varchar     NOT NULL DEFAULT 'medium',
        "bannerVisible"    boolean     NOT NULL DEFAULT true,
        "primaryColor"     varchar     NOT NULL DEFAULT '#6366f1',
        "accentColor"      varchar     NOT NULL DEFAULT '#8b5cf6',
        "bgStyle"          varchar     NOT NULL DEFAULT 'dark',
        "cardStyle"        varchar     NOT NULL DEFAULT 'glass',
        "gridColumns"      int         NOT NULL DEFAULT 3,
        "productCardStyle" varchar     NOT NULL DEFAULT 'standard',
        "showStock"        boolean     NOT NULL DEFAULT true,
        "showCategoryBadge" boolean    NOT NULL DEFAULT true,
        "showQuickAdd"     boolean     NOT NULL DEFAULT true,
        "productsPerPage"  int         NOT NULL DEFAULT 12,
        "headerStyle"      varchar     NOT NULL DEFAULT 'centered',
        "showSearch"       boolean     NOT NULL DEFAULT true,
        "showCategoryNav"  boolean     NOT NULL DEFAULT true,
        "showCartIcon"     boolean     NOT NULL DEFAULT true,
        "footerText"       varchar     NOT NULL DEFAULT '',
        "enableCategoryNav" boolean    NOT NULL DEFAULT true,
        "headingSize"      varchar     NOT NULL DEFAULT 'medium',
        "bodySize"         varchar     NOT NULL DEFAULT 'medium'
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_store_settings_ownerId"
      ON "store_settings" ("ownerId")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_store_settings_domainSlug"
      ON "store_settings" ("domainSlug")
      WHERE "domainSlug" != ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "store_settings"`);
  }
}
