import { MigrationInterface, QueryRunner } from 'typeorm';

/** KobePay cross-border remittance: claims + supplier child-QRs + payout ledger. */
export class AddRemittance1782100000000 implements MigrationInterface {
  name = 'AddRemittance1782100000000';
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "remittance_claims" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "masterCode" character varying(8) NOT NULL,
      "portalToken" character varying NOT NULL,
      "senderName" character varying NOT NULL DEFAULT '',
      "senderPhone" character varying NOT NULL DEFAULT '',
      "recipientCountry" character varying NOT NULL DEFAULT '',
      "currency" character varying NOT NULL DEFAULT 'USD',
      "amount" numeric(18,4) NOT NULL DEFAULT 0,
      "balance" numeric(18,4) NOT NULL DEFAULT 0,
      "status" character varying NOT NULL DEFAULT 'OPEN',
      CONSTRAINT "PK_remittance_claims" PRIMARY KEY ("id")
    )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_remittance_master_code" ON "remittance_claims" ("masterCode")`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_remittance_portal_token" ON "remittance_claims" ("portalToken")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_remittance_owner_status" ON "remittance_claims" ("ownerId", "status")`);

    await q.query(`CREATE TABLE IF NOT EXISTS "remittance_supplier_qrs" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "claimId" uuid NOT NULL,
      "code" character varying(8) NOT NULL,
      "supplierName" character varying NOT NULL DEFAULT '',
      "supplierPhone" character varying NOT NULL DEFAULT '',
      "authorizedAmount" numeric(18,4) NOT NULL DEFAULT 0,
      "redeemedAmount" numeric(18,4) NOT NULL DEFAULT 0,
      "status" character varying NOT NULL DEFAULT 'ACTIVE',
      "redeemedKeys" jsonb NOT NULL DEFAULT '[]'::jsonb,
      CONSTRAINT "PK_remittance_supplier_qrs" PRIMARY KEY ("id")
    )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_remittance_supplier_code" ON "remittance_supplier_qrs" ("code")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_remittance_supplier_owner_claim" ON "remittance_supplier_qrs" ("ownerId", "claimId")`);

    await q.query(`CREATE TABLE IF NOT EXISTS "remittance_payouts" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "claimId" uuid NOT NULL,
      "supplierQrId" uuid,
      "amount" numeric(18,4) NOT NULL DEFAULT 0,
      "cashierId" character varying NOT NULL DEFAULT '',
      "idempotencyKey" character varying NOT NULL DEFAULT '',
      CONSTRAINT "PK_remittance_payouts" PRIMARY KEY ("id")
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_remittance_payout_owner_claim" ON "remittance_payouts" ("ownerId", "claimId")`);
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "remittance_payouts"`);
    await q.query(`DROP TABLE IF EXISTS "remittance_supplier_qrs"`);
    await q.query(`DROP TABLE IF EXISTS "remittance_claims"`);
  }
}
