import { MigrationInterface, QueryRunner } from 'typeorm';
export class LeaseBillingIntervals1792540800000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS lala_phone_challenges (phone varchar PRIMARY KEY, "codeHash" varchar NOT NULL, "expiresAt" timestamptz NOT NULL, "sentAt" timestamptz NOT NULL, attempts integer NOT NULL DEFAULT 0, "proofHash" varchar)`);
    // Previous public phone lookup could disclose bearer tokens. Require re-verification.
    await q.query(`UPDATE lala_passports SET "qrToken" = replace(uuid_generate_v4()::text, '-', '') || replace(uuid_generate_v4()::text, '-', '')`);
    await q.query(`ALTER TABLE commerce_shop_units ADD COLUMN IF NOT EXISTS "claimTokenHash" varchar, ADD COLUMN IF NOT EXISTS "claimTokenExpiresAt" timestamptz`);
    await q.query(`ALTER TABLE rent_payments ADD COLUMN IF NOT EXISTS "idempotencyKey" uuid`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS rent_payment_request_key ON rent_payments ("ownerId", "idempotencyKey") WHERE "idempotencyKey" IS NOT NULL`);
    await q.query(`ALTER TABLE property_leases ADD COLUMN IF NOT EXISTS "billingMonths" integer NOT NULL DEFAULT 1`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS lala_phone_challenges`);
    await q.query(`ALTER TABLE commerce_shop_units DROP COLUMN IF EXISTS "claimTokenHash", DROP COLUMN IF EXISTS "claimTokenExpiresAt"`);
    await q.query(`DROP INDEX IF EXISTS rent_payment_request_key`);
    await q.query(`ALTER TABLE rent_payments DROP COLUMN IF EXISTS "idempotencyKey"`);
    await q.query(`ALTER TABLE property_leases DROP COLUMN IF EXISTS "billingMonths"`);
  }
}
