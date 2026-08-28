import { MigrationInterface, QueryRunner } from 'typeorm';

/** Live Ads: Android pair codes + conversion attribution (orderId on events). */
export class LiveAdsPairAndConversion1784300000000 implements MigrationInterface {
  name = 'LiveAdsPairAndConversion1784300000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "live_ad_events" ADD COLUMN IF NOT EXISTS "orderId" uuid`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_live_ad_events_order" ON "live_ad_events" ("orderId")`);
    await q.query(`
      CREATE TABLE IF NOT EXISTS "live_pair_codes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "code" varchar NOT NULL,
        "liveCreatorId" uuid NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "used" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_live_pair_codes" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_live_pair_codes_code" ON "live_pair_codes" ("code")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_live_pair_codes_creator" ON "live_pair_codes" ("liveCreatorId")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "live_pair_codes"`);
    await q.query(`ALTER TABLE "live_ad_events" DROP COLUMN IF EXISTS "orderId"`);
  }
}
