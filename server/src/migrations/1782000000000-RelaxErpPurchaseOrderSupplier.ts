import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Legacy ERP purchase orders use a supplier name while the supplier-capital
 * workflow uses a supplier UUID. Both APIs intentionally share the reconciled
 * table, so supplierId must remain nullable for legacy rows.
 */
export class RelaxErpPurchaseOrderSupplier1782000000000 implements MigrationInterface {
  name = 'RelaxErpPurchaseOrderSupplier1782000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE IF EXISTS "erp_purchase_orders" ALTER COLUMN "supplierId" DROP NOT NULL`,
    );
  }

  public async down(): Promise<void> {
    // Irreversible when legacy rows do not have a supplier UUID.
  }
}
