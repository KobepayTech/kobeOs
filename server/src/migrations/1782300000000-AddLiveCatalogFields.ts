import { MigrationInterface, QueryRunner } from 'typeorm';

/** Live catalog: featured pin ("NOW SHOWING") + short reservation code. */
export class AddLiveCatalogFields1782300000000 implements MigrationInterface {
  name = 'AddLiveCatalogFields1782300000000';
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "live_pins" ADD COLUMN IF NOT EXISTS "isFeatured" boolean NOT NULL DEFAULT false`);
    await q.query(`ALTER TABLE "live_comments" ADD COLUMN IF NOT EXISTS "reservationCode" character varying NOT NULL DEFAULT ''`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_live_comments_reservation_code" ON "live_comments" ("reservationCode")`);
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "IDX_live_comments_reservation_code"`);
    await q.query(`ALTER TABLE "live_comments" DROP COLUMN IF EXISTS "reservationCode"`);
    await q.query(`ALTER TABLE "live_pins" DROP COLUMN IF EXISTS "isFeatured"`);
  }
}
