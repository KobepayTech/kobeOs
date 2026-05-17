import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStoreRegistryAndPublishColumns1778900000006 implements MigrationInterface {
  name = 'AddStoreRegistryAndPublishColumns1778900000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // store_registrations — central registry table (runs on the KobePay cloud instance)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "store_registrations" (
        "id"          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        "createdAt"   timestamptz NOT NULL DEFAULT now(),
        "updatedAt"   timestamptz NOT NULL DEFAULT now(),
        "slug"        varchar     NOT NULL,
        "serverIp"    varchar     NOT NULL,
        "serverPort"  int         NOT NULL DEFAULT 3000,
        "cfRecordId"  varchar,
        "status"      varchar     NOT NULL DEFAULT 'active',
        "lastSeenAt"  timestamptz,
        "ownerId"     varchar     NOT NULL,
        "storeName"   varchar     NOT NULL DEFAULT ''
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_store_registrations_slug"
      ON "store_registrations" ("slug")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_store_registrations_ownerId"
      ON "store_registrations" ("ownerId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_store_registrations_status"
      ON "store_registrations" ("status")
    `);

    // Publish state columns on store_settings (runs on every KobeOS instance)
    await queryRunner.query(`
      ALTER TABLE "store_settings"
        ADD COLUMN IF NOT EXISTS "isPublished"  boolean     NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "publishedUrl" varchar,
        ADD COLUMN IF NOT EXISTS "publishedAt"  timestamptz
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "store_settings" DROP COLUMN IF EXISTS "publishedAt"`);
    await queryRunner.query(`ALTER TABLE "store_settings" DROP COLUMN IF EXISTS "publishedUrl"`);
    await queryRunner.query(`ALTER TABLE "store_settings" DROP COLUMN IF EXISTS "isPublished"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "store_registrations"`);
  }
}
