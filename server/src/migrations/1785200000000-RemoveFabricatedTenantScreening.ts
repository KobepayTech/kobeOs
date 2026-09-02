import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Historical MVP builds created deterministic "demo" tenant screening scores
 * from tenant UUIDs. Those rows are not evidence and must never survive into a
 * production screening decision.
 */
export class RemoveFabricatedTenantScreening1785200000000 implements MigrationInterface {
  name = 'RemoveFabricatedTenantScreening1785200000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`DELETE FROM "tenant_screening_reports" WHERE "provider" = 'demo'`);
    await q.query(`ALTER TABLE "tenant_screening_reports" ALTER COLUMN "provider" SET DEFAULT 'external'`);
  }

  public async down(q: QueryRunner): Promise<void> {
    // Deleted fabricated reports are intentionally not recreated.
    await q.query(`ALTER TABLE "tenant_screening_reports" ALTER COLUMN "provider" SET DEFAULT 'demo'`);
  }
}
