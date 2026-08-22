import { MigrationInterface, QueryRunner } from 'typeorm';

/** Live-sale reservations: checkout token + hold expiry on live comments. */
export class AddLiveReservations1782200000000 implements MigrationInterface {
  name = 'AddLiveReservations1782200000000';
  public async up(q: QueryRunner): Promise<void> {
    // Older deployments created these tables through synchronize. Keep the
    // migration chain self-contained so a brand-new production database does
    // not depend on that development-only setting.
    await q.query(`CREATE TABLE IF NOT EXISTS "live_sessions" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "title" character varying NOT NULL DEFAULT 'Live Sale',
      "platform" character varying NOT NULL DEFAULT 'other',
      "status" character varying NOT NULL DEFAULT 'LIVE',
      "ingestToken" character varying NOT NULL,
      "currency" character varying NOT NULL DEFAULT 'TZS',
      "totalSales" numeric(18,2) NOT NULL DEFAULT 0,
      "orderCount" integer NOT NULL DEFAULT 0,
      "showOnStorefront" boolean NOT NULL DEFAULT true,
      "endedAt" TIMESTAMP WITH TIME ZONE,
      CONSTRAINT "PK_live_sessions" PRIMARY KEY ("id")
    )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_live_sessions_ingest_token" ON "live_sessions" ("ingestToken")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_live_sessions_owner_status" ON "live_sessions" ("ownerId", "status")`);

    await q.query(`CREATE TABLE IF NOT EXISTS "live_pins" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "sessionId" uuid NOT NULL,
      "productId" uuid NOT NULL,
      "code" character varying NOT NULL,
      "name" character varying NOT NULL DEFAULT '',
      "livePrice" numeric(18,2) NOT NULL DEFAULT 0,
      "soldQty" integer NOT NULL DEFAULT 0,
      CONSTRAINT "PK_live_pins" PRIMARY KEY ("id")
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_live_pins_owner_session" ON "live_pins" ("ownerId", "sessionId")`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_live_pins_session_code" ON "live_pins" ("sessionId", "code")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_live_pins_session" ON "live_pins" ("sessionId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_live_pins_product" ON "live_pins" ("productId")`);

    await q.query(`CREATE TABLE IF NOT EXISTS "live_comments" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "sessionId" uuid NOT NULL,
      "source" character varying NOT NULL DEFAULT 'manual',
      "buyerHandle" character varying NOT NULL DEFAULT '',
      "buyerContact" character varying NOT NULL DEFAULT '',
      "text" text NOT NULL DEFAULT '',
      "matchedCode" character varying NOT NULL DEFAULT '',
      "matchedProductId" uuid,
      "qty" integer NOT NULL DEFAULT 1,
      "status" character varying NOT NULL DEFAULT 'NEW',
      "orderId" uuid,
      "note" text NOT NULL DEFAULT '',
      CONSTRAINT "PK_live_comments" PRIMARY KEY ("id")
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_live_comments_owner_session_status" ON "live_comments" ("ownerId", "sessionId", "status")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_live_comments_session" ON "live_comments" ("sessionId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_live_comments_product" ON "live_comments" ("matchedProductId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_live_comments_order" ON "live_comments" ("orderId")`);
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
