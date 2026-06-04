import { MigrationInterface, QueryRunner } from 'typeorm';

export class ErpSupplierCapitalKobepay1780100000000 implements MigrationInterface {
  name = 'ErpSupplierCapitalKobepay1780100000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await q.query(`CREATE TABLE IF NOT EXISTS "erp_kobepay_links" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "kobepayBusinessId" varchar NOT NULL,
      "kobepayUserId" varchar NOT NULL DEFAULT '',
      "customerPhone" varchar NOT NULL,
      "status" varchar NOT NULL DEFAULT 'active',
      "notes" text NOT NULL DEFAULT ''
    )`);

    await q.query(`CREATE TABLE IF NOT EXISTS "erp_suppliers" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "name" varchar NOT NULL,
      "phone" varchar NOT NULL DEFAULT '',
      "country" varchar NOT NULL DEFAULT 'CN',
      "currency" varchar NOT NULL DEFAULT 'CNY',
      "cnyAccount" varchar NOT NULL DEFAULT '',
      "contactPerson" varchar NOT NULL DEFAULT '',
      "notes" text NOT NULL DEFAULT ''
    )`);

    await q.query(`CREATE TABLE IF NOT EXISTS "erp_purchase_orders" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "poNumber" varchar NOT NULL,
      "supplierId" uuid NOT NULL,
      "totalCny" decimal(18,4) NOT NULL DEFAULT 0,
      "paidCny" decimal(18,4) NOT NULL DEFAULT 0,
      "remainingCny" decimal(18,4) NOT NULL DEFAULT 0,
      "status" varchar NOT NULL DEFAULT 'open',
      "expectedDate" date,
      "notes" text NOT NULL DEFAULT ''
    )`);

    await q.query(`CREATE TABLE IF NOT EXISTS "erp_kobepay_supplier_receipts" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "kobepayReceiptId" varchar NOT NULL,
      "kobepayBusinessId" varchar NOT NULL,
      "kobepayUserId" varchar NOT NULL DEFAULT '',
      "customerPhone" varchar NOT NULL,
      "supplierName" varchar NOT NULL DEFAULT '',
      "supplierPhone" varchar NOT NULL,
      "supplierId" uuid,
      "poId" uuid,
      "sentAmount" decimal(18,4) NOT NULL,
      "sentCurrency" varchar NOT NULL,
      "exchangeRate" decimal(18,8) NOT NULL DEFAULT 0,
      "supplierReceivedAmount" decimal(18,4) NOT NULL,
      "supplierCurrency" varchar NOT NULL DEFAULT 'CNY',
      "feeAmount" decimal(18,4) NOT NULL DEFAULT 0,
      "feeCurrency" varchar NOT NULL DEFAULT '',
      "purpose" varchar NOT NULL DEFAULT 'supplier_payment',
      "allocationStatus" varchar NOT NULL DEFAULT 'unallocated',
      "actionRequired" varchar NOT NULL DEFAULT 'needs_po',
      "paidAt" timestamptz NOT NULL,
      "notes" text NOT NULL DEFAULT ''
    )`);

    await q.query(`CREATE TABLE IF NOT EXISTS "erp_supplier_capital_ledger" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "supplierId" uuid,
      "receiptId" uuid,
      "poId" uuid,
      "source" varchar NOT NULL DEFAULT 'kobepay_receipt',
      "entryType" varchar NOT NULL DEFAULT 'supplier_advance',
      "sentAmount" decimal(18,4) NOT NULL DEFAULT 0,
      "sentCurrency" varchar NOT NULL DEFAULT '',
      "cnyAmount" decimal(18,4) NOT NULL DEFAULT 0,
      "cnyCurrency" varchar NOT NULL DEFAULT 'CNY',
      "description" text NOT NULL DEFAULT ''
    )`);

    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_erp_kobepay_links_owner" ON "erp_kobepay_links" ("ownerId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_erp_kobepay_links_business_phone" ON "erp_kobepay_links" ("kobepayBusinessId", "customerPhone")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_erp_suppliers_owner_phone" ON "erp_suppliers" ("ownerId", "phone")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_erp_pos_owner_supplier_status" ON "erp_purchase_orders" ("ownerId", "supplierId", "status")`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_erp_kobepay_supplier_receipt_id" ON "erp_kobepay_supplier_receipts" ("kobepayReceiptId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_erp_receipts_owner_status" ON "erp_kobepay_supplier_receipts" ("ownerId", "allocationStatus")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_erp_ledger_owner_supplier" ON "erp_supplier_capital_ledger" ("ownerId", "supplierId")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "erp_supplier_capital_ledger"`);
    await q.query(`DROP TABLE IF EXISTS "erp_kobepay_supplier_receipts"`);
    await q.query(`DROP TABLE IF EXISTS "erp_purchase_orders"`);
    await q.query(`DROP TABLE IF EXISTS "erp_suppliers"`);
    await q.query(`DROP TABLE IF EXISTS "erp_kobepay_links"`);
  }
}
