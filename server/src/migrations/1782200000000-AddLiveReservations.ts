import { MigrationInterface, QueryRunner } from 'typeorm';

/** Live-sale reservations: checkout token + hold expiry on live comments. */
export class AddLiveReservations1782200000000 implements MigrationInterface {
  name = 'AddLiveReservations1782200000000';
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "live_comments" ADD COLUMN IF NOT EXISTS "checkoutToken" character varying NOT NULL DEFAULT ''`);
    await q.query(`ALTER TABLE "live_comments" ADD COLUMN IF NOT EXISTS "reservedUntil" TIMESTAMP WITH TIME ZONE`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_live_comments_checkout_token" ON "live_comments" ("checkoutToken")`);
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "IDX_live_comments_checkout_token"`);
    await q.query(`ALTER TABLE "live_comments" DROP COLUMN IF EXISTS "reservedUntil"`);
    await q.query(`ALTER TABLE "live_comments" DROP COLUMN IF EXISTS "checkoutToken"`);
  }
}
