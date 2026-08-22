import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the `mobile_subscriptions` table that gates the /m/:slug mobile
 * workspace (48h free trial → TZS 100,000/month via PalmPesa), keyed per shop
 * slug. Production runs migrations only (synchronize=false), so the entity
 * needs this to exist there. Idempotent — safe on a DB where dev synchronize
 * already created it.
 */
export class AddMobileSubscriptions1781000000000 implements MigrationInterface {
  name = 'AddMobileSubscriptions1781000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "mobile_subscriptions" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "slug" character varying NOT NULL,
      "status" character varying NOT NULL DEFAULT 'trialing',
      "trialEndsAt" TIMESTAMP WITH TIME ZONE,
      "currentPeriodEndsAt" TIMESTAMP WITH TIME ZONE,
      "amountTzs" numeric(18,2) NOT NULL DEFAULT 0,
      "transactionId" character varying,
      "palmPesaOrderId" character varying,
      "palmPesaTransId" character varying,
      "channel" character varying,
      "lastPaidByUserId" uuid,
      "callbackPayload" jsonb,
      CONSTRAINT "PK_mobile_subscriptions" PRIMARY KEY ("id")
    )`);

    // One subscription row per shop slug (matches @Index({ unique: true })).
    await q.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_mobile_subscriptions_slug" ON "mobile_subscriptions" ("slug")`,
    );
    // Fast lookups: by transactionId on PalmPesa callback, by status for admin.
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mobile_subscriptions_transactionId" ON "mobile_subscriptions" ("transactionId")`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mobile_subscriptions_status" ON "mobile_subscriptions" ("status")`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "mobile_subscriptions"`);
  }
}
