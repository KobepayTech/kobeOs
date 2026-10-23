import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Historical MVP builds created deterministic "demo" tenant screening scores
 * from tenant UUIDs. Those rows are not evidence and must never survive into a
 * production screening decision.
 */
export class RemoveFabricatedTenantScreening1785200000000 implements MigrationInterface {
  name = 'RemoveFabricatedTenantScreening1785200000000';

  public async up(q: QueryRunner): Promise<void> {
    // Guarded on the column, not just the table. TypeORM runs the whole
    // pending batch in one transaction, so an unguarded statement here does
    // not fail alone — it rolls back every other pending migration and the
    // schema never advances, on every boot, forever.
    await q.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'tenant_screening_reports' AND column_name = 'provider'
        ) THEN
          DELETE FROM "tenant_screening_reports" WHERE "provider" = 'demo';
          ALTER TABLE "tenant_screening_reports" ALTER COLUMN "provider" SET DEFAULT 'external';
        END IF;
      END $$;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    // Deleted fabricated reports are intentionally not recreated.
    await q.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'tenant_screening_reports' AND column_name = 'provider'
        ) THEN
          ALTER TABLE "tenant_screening_reports" ALTER COLUMN "provider" SET DEFAULT 'demo';
        END IF;
      END $$;
    `);
  }
}
