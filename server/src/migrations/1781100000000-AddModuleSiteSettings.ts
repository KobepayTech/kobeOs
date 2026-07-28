import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddModuleSiteSettings1781100000000 implements MigrationInterface {
  name = 'AddModuleSiteSettings1781100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "module_site_settings" (
        "id"             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        "createdAt"      timestamptz NOT NULL DEFAULT now(),
        "updatedAt"      timestamptz NOT NULL DEFAULT now(),
        "ownerId"        uuid        NOT NULL,
        "moduleId"       varchar(32) NOT NULL,
        "name"           varchar     NOT NULL DEFAULT '',
        "tagline"        varchar     NOT NULL DEFAULT '',
        "logoUrl"        varchar     NOT NULL DEFAULT '',
        "faviconUrl"     varchar     NOT NULL DEFAULT '',
        "primaryColor"   varchar     NOT NULL DEFAULT '#4f46e5',
        "accentColor"    varchar     NOT NULL DEFAULT '#8b5cf6',
        "domainSlug"     varchar,
        "customDomain"   varchar,
        "config"         jsonb       NOT NULL DEFAULT '{}'::jsonb,
        "seo"            jsonb       NOT NULL DEFAULT '{}'::jsonb,
        "isPublished"    boolean     NOT NULL DEFAULT false,
        "publishedUrl"   varchar,
        "publishedAt"    timestamptz,
        CONSTRAINT "CHK_module_site_moduleId"
          CHECK ("moduleId" IN ('erp', 'hotel', 'cargo', 'property'))
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_module_site_owner_module"
      ON "module_site_settings" ("ownerId", "moduleId")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_module_site_module_slug"
      ON "module_site_settings" ("moduleId", "domainSlug")
      WHERE "domainSlug" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_module_site_module_custom_domain"
      ON "module_site_settings" ("moduleId", "customDomain")
      WHERE "customDomain" IS NOT NULL
    `);

    // Preserve existing hotel/cargo/property builder content while separating
    // future writes. Each module gets its own copy and may diverge safely.
    await queryRunner.query(`
      INSERT INTO "module_site_settings" (
        "ownerId", "moduleId", "name", "tagline", "logoUrl", "faviconUrl",
        "primaryColor", "accentColor", "domainSlug", "customDomain", "config",
        "seo", "isPublished", "publishedUrl", "publishedAt"
      )
      SELECT
        s."ownerId",
        m."moduleId",
        s."storeName",
        s."tagline",
        s."logoUrl",
        s."faviconUrl",
        s."primaryColor",
        s."accentColor",
        NULLIF(s."domainSlug", ''),
        NULL,
        COALESCE(s."siteConfig", '{}'::jsonb),
        '{}'::jsonb,
        s."isPublished" AND s."domainSlug" <> '',
        CASE m."moduleId"
          WHEN 'hotel' THEN 'https://' || s."domainSlug" || '.kobeapptz.com/book'
          WHEN 'cargo' THEN 'https://kobeapptz.com/cg/' || s."domainSlug"
          WHEN 'property' THEN 'https://kobeapptz.com/property/' || s."domainSlug"
        END,
        s."publishedAt"
      FROM "store_settings" s
      CROSS JOIN (VALUES ('hotel'), ('cargo'), ('property')) AS m("moduleId")
      ON CONFLICT ("ownerId", "moduleId") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "module_site_settings"');
  }
}
