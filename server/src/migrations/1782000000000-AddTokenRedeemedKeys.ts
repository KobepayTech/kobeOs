import { MigrationInterface, QueryRunner } from 'typeorm';

/** Idempotency keys applied to a rent-payment token (prevents double-redeem). */
export class AddTokenRedeemedKeys1782000000000 implements MigrationInterface {
  name = 'AddTokenRedeemedKeys1782000000000';
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "property_payment_tokens" ADD COLUMN IF NOT EXISTS "redeemedKeys" jsonb NOT NULL DEFAULT '[]'::jsonb`);
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "property_payment_tokens" DROP COLUMN IF EXISTS "redeemedKeys"`);
  }
}
