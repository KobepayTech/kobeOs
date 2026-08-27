import { MigrationInterface, QueryRunner } from 'typeorm';

/** Creator commission payouts (EARNED/PAYABLE → PAID batches). */
export class CreatorPayouts1784000000000 implements MigrationInterface {
  name = 'CreatorPayouts1784000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "creator_payouts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "creatorId" uuid NOT NULL,
        "ownerId" uuid NOT NULL,
        "amount" numeric(18,4) NOT NULL DEFAULT 0,
        "currency" varchar NOT NULL DEFAULT 'TZS',
        "commissionCount" integer NOT NULL DEFAULT 0,
        "commissionIds" jsonb NOT NULL DEFAULT '[]',
        "status" varchar NOT NULL DEFAULT 'PAID',
        "reference" varchar NOT NULL DEFAULT '',
        "financialTransactionId" varchar NOT NULL DEFAULT '',
        "paidAt" timestamptz,
        CONSTRAINT "PK_creator_payouts" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_creator_payouts_creator" ON "creator_payouts" ("creatorId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_creator_payouts_owner" ON "creator_payouts" ("ownerId")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "creator_payouts"`);
  }
}
