import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Dealer-uploaded car photos are stored inline (like product media) and served
 * through /commerce-public/media/:token, so a dealership can publish a vehicle
 * to Jumla Cars without needing a separate image host.
 */
export class VehicleMediaInline1784500000000 implements MigrationInterface {
  name = 'VehicleMediaInline1784500000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "commerce_vehicle_media" ADD COLUMN IF NOT EXISTS "publicToken" varchar`);
    await q.query(`ALTER TABLE "commerce_vehicle_media" ADD COLUMN IF NOT EXISTS "mimeType" varchar`);
    await q.query(`ALTER TABLE "commerce_vehicle_media" ADD COLUMN IF NOT EXISTS "contentBinary" bytea`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_commerce_vehicle_media_publicToken" ON "commerce_vehicle_media" ("publicToken")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "UQ_commerce_vehicle_media_publicToken"`);
    await q.query(`ALTER TABLE "commerce_vehicle_media" DROP COLUMN IF EXISTS "contentBinary"`);
    await q.query(`ALTER TABLE "commerce_vehicle_media" DROP COLUMN IF EXISTS "mimeType"`);
    await q.query(`ALTER TABLE "commerce_vehicle_media" DROP COLUMN IF EXISTS "publicToken"`);
  }
}
