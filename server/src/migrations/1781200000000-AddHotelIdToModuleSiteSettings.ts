import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHotelIdToModuleSiteSettings1781200000000 implements MigrationInterface {
  name = 'AddHotelIdToModuleSiteSettings1781200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "module_site_settings"
      ADD COLUMN IF NOT EXISTS "hotelId" uuid
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_module_site_owner_module"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_module_site_owner_module_hotel"
      ON "module_site_settings" ("ownerId", "moduleId", "hotelId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_module_site_settings_hotelId"
      ON "module_site_settings" ("hotelId")
    `);
    await queryRunner.query(`
      UPDATE "module_site_settings" s
      SET "hotelId" = t."id"
      FROM "hotel_tenants" t
      WHERE s."moduleId" = 'hotel'
        AND s."hotelId" IS NULL
        AND s."ownerId" = t."ownerId"
        AND s."domainSlug" = t."slug"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_module_site_settings_hotelId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_module_site_owner_module_hotel"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_module_site_owner_module"
      ON "module_site_settings" ("ownerId", "moduleId")
    `);
    await queryRunner.query(`ALTER TABLE "module_site_settings" DROP COLUMN IF EXISTS "hotelId"`);
  }
}
