import { MigrationInterface, QueryRunner } from 'typeorm';

/** Idempotency keys applied to a rent-payment token (prevents double-redeem). */
export class AddTokenRedeemedKeys1782000000000 implements MigrationInterface {
  name = 'AddTokenRedeemedKeys1782000000000';
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "property_payment_tokens" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "code" character varying(8) NOT NULL,
      "tenantId" uuid NOT NULL,
      "unitId" uuid,
      "leaseId" uuid,
      "amount" numeric(18,4) NOT NULL DEFAULT 0,
      "currency" character varying NOT NULL DEFAULT 'TZS',
      "status" character varying NOT NULL DEFAULT 'ACTIVE',
      "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
      "usedAt" TIMESTAMP WITH TIME ZONE,
      "usedAmount" numeric(18,4) NOT NULL DEFAULT 0,
      "agentId" uuid,
      "redeemedKeys" jsonb NOT NULL DEFAULT '[]'::jsonb,
      CONSTRAINT "PK_property_payment_tokens" PRIMARY KEY ("id")
    )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_property_payment_tokens_code" ON "property_payment_tokens" ("code")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_property_payment_tokens_owner_status" ON "property_payment_tokens" ("ownerId", "status")`);
    await q.query(`ALTER TABLE "property_payment_tokens" ADD COLUMN IF NOT EXISTS "redeemedKeys" jsonb NOT NULL DEFAULT '[]'::jsonb`);
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "property_payment_tokens" DROP COLUMN IF EXISTS "redeemedKeys"`);
  }
}
