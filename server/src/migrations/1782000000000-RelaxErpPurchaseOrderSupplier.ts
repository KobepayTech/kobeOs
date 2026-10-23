import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Legacy ERP purchase orders use a supplier name while the supplier-capital
 * workflow uses a supplier UUID. Both APIs intentionally share the reconciled
 * table, so supplierId must remain nullable for legacy rows.
 */
export class RelaxErpPurchaseOrderSupplier1782000000000 implements MigrationInterface {
  name = 'RelaxErpPurchaseOrderSupplier1782000000000';

  public async up(q: QueryRunner): Promise<void> {
    // ALTER TABLE IF EXISTS guards the table but not the column: on a database
    // where erp_purchase_orders exists without supplierId this still throws
    // `column ... does not exist`, which rolls back the entire pending batch.
    await q.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'erp_purchase_orders' AND column_name = 'supplierId'
        ) THEN
          ALTER TABLE "erp_purchase_orders" ALTER COLUMN "supplierId" DROP NOT NULL;
        END IF;
      END $$;
    `);
  }

  public async down(): Promise<void> {
    // Irreversible when legacy rows do not have a supplier UUID.
  }
}
