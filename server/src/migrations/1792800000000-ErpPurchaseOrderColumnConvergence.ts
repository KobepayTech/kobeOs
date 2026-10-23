import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Converge erp_purchase_orders and erp_suppliers onto the shape the entities
 * declare, for databases that predate the supplier-capital workflow.
 *
 * Both tables are mapped by two @Entity() classes with different shapes — the
 * legacy ERP one (supplier, total) and the supplier-capital one (supplierId,
 * totalCny). Whichever migration ran first created the table, and because every
 * one of them uses CREATE TABLE IF NOT EXISTS, the other shape's columns were
 * never added. A database migrated from empty today gets the union and is fine,
 * which is why CI never saw this; a database created before that point is
 * missing whichever half lost the race.
 *
 * That is not only a runtime problem. RelaxErpPurchaseOrderSupplier
 * (1782000000000) does ALTER COLUMN "supplierId" DROP NOT NULL, so on a
 * database without that column the statement threw, and because TypeORM runs
 * the whole pending batch in one transaction it took every other pending
 * migration down with it — on every boot, permanently. That migration is now
 * guarded on the column; this one supplies the column it was guarding against.
 *
 * Additive and idempotent. Columns the entity declares NOT NULL are added with
 * their default, which Postgres backfills; the three that have no default
 * (ownerId, poNumber, name) are added nullable, because NOT NULL without a
 * default cannot be added to a table that already holds rows. The column
 * existing is what the code needs — the entity still requires a value on write.
 */
export class ErpPurchaseOrderColumnConvergence1792800000000 implements MigrationInterface {
  name = 'ErpPurchaseOrderColumnConvergence1792800000000';

  private static readonly COLUMNS: Array<[string, string, string]> = [
    // erp_purchase_orders — union of both entity shapes.
    ['erp_purchase_orders', 'poNumber', 'character varying'],
    ['erp_purchase_orders', 'supplier', `character varying NOT NULL DEFAULT ''`],
    ['erp_purchase_orders', 'supplierId', 'uuid'],
    ['erp_purchase_orders', 'total', `double precision NOT NULL DEFAULT 0`],
    ['erp_purchase_orders', 'totalCny', `numeric(18,4) NOT NULL DEFAULT 0`],
    ['erp_purchase_orders', 'paidCny', `numeric(18,4) NOT NULL DEFAULT 0`],
    ['erp_purchase_orders', 'remainingCny', `numeric(18,4) NOT NULL DEFAULT 0`],
    ['erp_purchase_orders', 'paidAmount', `numeric(18,4) NOT NULL DEFAULT 0`],
    ['erp_purchase_orders', 'transportCost', `numeric(18,4) NOT NULL DEFAULT 0`],
    ['erp_purchase_orders', 'status', `character varying NOT NULL DEFAULT 'Pending'`],
    ['erp_purchase_orders', 'inventoryStatus', `character varying NOT NULL DEFAULT 'PENDING'`],
    ['erp_purchase_orders', 'notes', `text NOT NULL DEFAULT ''`],
    ['erp_purchase_orders', 'items', `text DEFAULT '[]'`],
    ['erp_purchase_orders', 'date', 'character varying'],
    ['erp_purchase_orders', 'deliveryDate', 'character varying'],
    ['erp_purchase_orders', 'expectedDate', 'date'],
    ['erp_purchase_orders', 'receivedAt', 'TIMESTAMP WITH TIME ZONE'],
    // erp_suppliers — same duplicate-entity situation.
    ['erp_suppliers', 'name', 'character varying'],
    ['erp_suppliers', 'contact', `character varying NOT NULL DEFAULT ''`],
    ['erp_suppliers', 'phone', `character varying NOT NULL DEFAULT ''`],
    ['erp_suppliers', 'country', `character varying NOT NULL DEFAULT ''`],
    ['erp_suppliers', 'contactPerson', `character varying NOT NULL DEFAULT ''`],
    ['erp_suppliers', 'cnyAccount', `character varying NOT NULL DEFAULT ''`],
    ['erp_suppliers', 'currency', `character varying NOT NULL DEFAULT 'CNY'`],
    ['erp_suppliers', 'status', `character varying NOT NULL DEFAULT 'Active'`],
    ['erp_suppliers', 'rating', `double precision NOT NULL DEFAULT 0`],
    ['erp_suppliers', 'notes', `text NOT NULL DEFAULT ''`],
  ];

  public async up(q: QueryRunner): Promise<void> {
    for (const [table, column, spec] of ErpPurchaseOrderColumnConvergence1792800000000.COLUMNS) {
      const exists = await q.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name = $1`,
        [table],
      );
      if (!exists.length) continue;
      await q.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" ${spec}`);
    }
  }

  public async down(): Promise<void> {
    // Deliberately irreversible: these columns are what the running code reads,
    // and on the databases this migration targets they are already populated.
  }
}
