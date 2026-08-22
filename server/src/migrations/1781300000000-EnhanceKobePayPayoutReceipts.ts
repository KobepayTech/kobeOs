import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnhanceKobePayPayoutReceipts1781300000000 implements MigrationInterface {
  name = 'EnhanceKobePayPayoutReceipts1781300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "kobepay_payout_receipts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "receiptNumber" varchar NOT NULL, "publicToken" varchar NOT NULL, "customerName" varchar NOT NULL DEFAULT '', "customerPhone" varchar NOT NULL DEFAULT '', "supplierId" uuid, "supplierName" varchar NOT NULL DEFAULT '', "supplierPhone" varchar NOT NULL DEFAULT '', "items" text, "itemCount" integer NOT NULL DEFAULT 0, "amountDue" decimal(18,2) NOT NULL DEFAULT 0, "shipping" decimal(18,2) NOT NULL DEFAULT 0, "serviceFee" decimal(18,2) NOT NULL DEFAULT 0, "total" decimal(18,2) NOT NULL DEFAULT 0, "currency" varchar NOT NULL DEFAULT 'CNY', "status" varchar NOT NULL DEFAULT 'Pending', "createdByName" varchar NOT NULL DEFAULT '', "paymentMethod" varchar NOT NULL DEFAULT '', "transactionId" varchar NOT NULL DEFAULT '', "paidByUserId" uuid, "paidByName" varchar NOT NULL DEFAULT '', "paidAt" timestamptz, "payoutNotes" text NOT NULL DEFAULT '', CONSTRAINT "PK_kobepay_payout_receipts" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_kobepay_receipt_number" ON "kobepay_payout_receipts" ("ownerId", "receiptNumber")`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_kobepay_receipt_public_token" ON "kobepay_payout_receipts" ("publicToken")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IX_kobepay_receipt_status" ON "kobepay_payout_receipts" ("ownerId", "status")`);
    await queryRunner.query(`ALTER TABLE "kobepay_payout_receipts" ADD COLUMN IF NOT EXISTS "verificationHash" varchar NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "kobepay_payout_receipts" ADD COLUMN IF NOT EXISTS "customerReference" varchar NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "kobepay_payout_receipts" ADD COLUMN IF NOT EXISTS "supplierNumber" varchar NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "kobepay_payout_receipts" ADD COLUMN IF NOT EXISTS "sourceAmount" decimal(18,2) NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "kobepay_payout_receipts" ADD COLUMN IF NOT EXISTS "sourceCurrency" varchar NOT NULL DEFAULT 'TZS'`);
    await queryRunner.query(`ALTER TABLE "kobepay_payout_receipts" ADD COLUMN IF NOT EXISTS "exchangeRate" decimal(18,6) NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "kobepay_payout_receipts" ADD COLUMN IF NOT EXISTS "payoutIdempotencyKey" varchar`);
    await queryRunner.query(`ALTER TABLE "kobepay_payout_receipts" ADD COLUMN IF NOT EXISTS "cancelledAt" timestamptz`);
    await queryRunner.query(`ALTER TABLE "kobepay_payout_receipts" ADD COLUMN IF NOT EXISTS "cancellationReason" varchar NOT NULL DEFAULT ''`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_kobepay_receipt_customer_phone" ON "kobepay_payout_receipts" ("ownerId", "customerPhone")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_kobepay_receipt_supplier_number" ON "kobepay_payout_receipts" ("ownerId", "supplierNumber")`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_kobepay_receipt_payout_idempotency" ON "kobepay_payout_receipts" ("ownerId", "payoutIdempotencyKey") WHERE "payoutIdempotencyKey" IS NOT NULL`);

    await queryRunner.query(`
      UPDATE "kobepay_payout_receipts"
      SET
        "supplierNumber" = CASE WHEN COALESCE("supplierNumber", '') = '' THEN 'SUP-' || UPPER(SUBSTRING(REPLACE("id"::text, '-', '') FROM 1 FOR 8)) ELSE "supplierNumber" END,
        "customerReference" = CASE WHEN COALESCE("customerReference", '') = '' THEN 'CUS-' || UPPER(SUBSTRING(REPLACE("ownerId"::text, '-', '') FROM 1 FOR 6)) ELSE "customerReference" END,
        "sourceAmount" = CASE WHEN "sourceAmount" = 0 THEN "total" ELSE "sourceAmount" END
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_kobepay_receipt_payout_idempotency"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_kobepay_receipt_supplier_number"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_kobepay_receipt_customer_phone"`);
    await queryRunner.query(`ALTER TABLE "kobepay_payout_receipts" DROP COLUMN IF EXISTS "cancellationReason"`);
    await queryRunner.query(`ALTER TABLE "kobepay_payout_receipts" DROP COLUMN IF EXISTS "cancelledAt"`);
    await queryRunner.query(`ALTER TABLE "kobepay_payout_receipts" DROP COLUMN IF EXISTS "payoutIdempotencyKey"`);
    await queryRunner.query(`ALTER TABLE "kobepay_payout_receipts" DROP COLUMN IF EXISTS "exchangeRate"`);
    await queryRunner.query(`ALTER TABLE "kobepay_payout_receipts" DROP COLUMN IF EXISTS "sourceCurrency"`);
    await queryRunner.query(`ALTER TABLE "kobepay_payout_receipts" DROP COLUMN IF EXISTS "sourceAmount"`);
    await queryRunner.query(`ALTER TABLE "kobepay_payout_receipts" DROP COLUMN IF EXISTS "supplierNumber"`);
    await queryRunner.query(`ALTER TABLE "kobepay_payout_receipts" DROP COLUMN IF EXISTS "customerReference"`);
    await queryRunner.query(`ALTER TABLE "kobepay_payout_receipts" DROP COLUMN IF EXISTS "verificationHash"`);
  }
}
