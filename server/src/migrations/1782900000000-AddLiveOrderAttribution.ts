import { MigrationInterface, QueryRunner } from 'typeorm';

/** Persist the social-live/post campaign that led to a complete storefront
 * basket. The reservation token is validated before these values are written. */
export class AddLiveOrderAttribution1782900000000 implements MigrationInterface {
  name = 'AddLiveOrderAttribution1782900000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "pos_orders" ADD COLUMN IF NOT EXISTS "salesChannel" character varying NOT NULL DEFAULT 'pos'`);
    await q.query(`ALTER TABLE "pos_orders" ADD COLUMN IF NOT EXISTS "liveSessionId" uuid`);
    await q.query(`ALTER TABLE "pos_orders" ADD COLUMN IF NOT EXISTS "liveCommentId" uuid`);
    await q.query(`ALTER TABLE "pos_orders" ADD COLUMN IF NOT EXISTS "attributionCode" character varying NOT NULL DEFAULT ''`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_pos_orders_sales_channel" ON "pos_orders" ("salesChannel")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_pos_orders_live_session" ON "pos_orders" ("liveSessionId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_pos_orders_live_comment" ON "pos_orders" ("liveCommentId")`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "IDX_pos_orders_live_comment"`);
    await q.query(`DROP INDEX IF EXISTS "IDX_pos_orders_live_session"`);
    await q.query(`DROP INDEX IF EXISTS "IDX_pos_orders_sales_channel"`);
    await q.query(`ALTER TABLE "pos_orders" DROP COLUMN IF EXISTS "attributionCode"`);
    await q.query(`ALTER TABLE "pos_orders" DROP COLUMN IF EXISTS "liveCommentId"`);
    await q.query(`ALTER TABLE "pos_orders" DROP COLUMN IF EXISTS "liveSessionId"`);
    await q.query(`ALTER TABLE "pos_orders" DROP COLUMN IF EXISTS "salesChannel"`);
  }
}
