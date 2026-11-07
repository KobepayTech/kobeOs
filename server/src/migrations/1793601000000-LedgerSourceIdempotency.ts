import { MigrationInterface, QueryRunner } from 'typeorm';

export class LedgerSourceIdempotency1793601000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE "kp_transactions" ADD COLUMN IF NOT EXISTS "idempotencyKey" varchar(160)');
    await q.query('CREATE UNIQUE INDEX IF NOT EXISTS "UQ_kp_posting_source" ON "kp_transactions" ("ownerId", "idempotencyKey") WHERE "idempotencyKey" IS NOT NULL');
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP INDEX IF EXISTS "UQ_kp_posting_source"');
    await q.query('ALTER TABLE "kp_transactions" DROP COLUMN IF EXISTS "idempotencyKey"');
  }
}
