import { MigrationInterface, QueryRunner } from 'typeorm';

export class PropertyMarketplaceProvisioning1784700000000 implements MigrationInterface {
  name = 'PropertyMarketplaceProvisioning1784700000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "publicSlug" character varying`);
    await q.query(`ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "marketplaceEnabled" boolean NOT NULL DEFAULT false`);
    await q.query(`ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "marketplaceTagline" character varying NOT NULL DEFAULT ''`);
    await q.query(`ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "marketplaceBrandColor" character varying NOT NULL DEFAULT '#0f766e'`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_properties_public_slug" ON "properties" ("publicSlug") WHERE "publicSlug" IS NOT NULL`);
    await q.query(`UPDATE "properties" SET "marketplaceEnabled" = true WHERE "type" IN ('commercial','mixed')`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "IDX_properties_public_slug"`);
    await q.query(`ALTER TABLE "properties" DROP COLUMN IF EXISTS "marketplaceBrandColor"`);
    await q.query(`ALTER TABLE "properties" DROP COLUMN IF EXISTS "marketplaceTagline"`);
    await q.query(`ALTER TABLE "properties" DROP COLUMN IF EXISTS "marketplaceEnabled"`);
    await q.query(`ALTER TABLE "properties" DROP COLUMN IF EXISTS "publicSlug"`);
  }
}
