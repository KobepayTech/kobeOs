import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the structured PO-to-inventory receiving fields. `items` deliberately
 * uses text because the original erp_purchase_orders table stores its legacy
 * JSON in text; the entity maps it through TypeORM's simple-json type.
 */
export class AddPurchaseOrderInventoryReceiving1783200000000 implements MigrationInterface {
  name = 'AddPurchaseOrderInventoryReceiving1783200000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "erp_purchase_orders" ADD COLUMN IF NOT EXISTS "items" text`);
    await q.query(`ALTER TABLE "erp_purchase_orders" ADD COLUMN IF NOT EXISTS "transportCost" decimal(18,4) NOT NULL DEFAULT 0`);
    await q.query(`ALTER TABLE "erp_purchase_orders" ADD COLUMN IF NOT EXISTS "inventoryStatus" varchar NOT NULL DEFAULT 'PENDING'`);
    await q.query(`ALTER TABLE "erp_purchase_orders" ADD COLUMN IF NOT EXISTS "receivedAt" timestamptz`);
    await q.query(`UPDATE "erp_purchase_orders" SET "items" = '[]' WHERE "items" IS NULL`);
    await q.query(`ALTER TABLE "erp_purchase_orders" ALTER COLUMN "items" SET DEFAULT '[]'`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "erp_purchase_orders" DROP COLUMN IF EXISTS "receivedAt"`);
    await q.query(`ALTER TABLE "erp_purchase_orders" DROP COLUMN IF EXISTS "inventoryStatus"`);
    await q.query(`ALTER TABLE "erp_purchase_orders" DROP COLUMN IF EXISTS "transportCost"`);
    // Keep the legacy `items` column: it existed before this migration.
  }
}
