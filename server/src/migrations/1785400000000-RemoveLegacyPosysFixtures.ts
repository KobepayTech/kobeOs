import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Remove only the exact legacy POSys fixture blob that older builds could
 * upload automatically. Real owner-created POSys state is untouched.
 */
export class RemoveLegacyPosysFixtures1785400000000 implements MigrationInterface {
  name = 'RemoveLegacyPosysFixtures1785400000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      DELETE FROM "app_state"
      WHERE "key" = 'posys'
        AND "value" #>> '{properties,0,name}' = 'Kariakoo Plaza'
        AND "value"::text LIKE '%Salehe Sigala%'
        AND "value"::text LIKE '%Fatuma Hassan%'
        AND "value"::text LIKE '%Hamisi Juma%'
    `);
  }

  public async down(_q: QueryRunner): Promise<void> {
    // Fabricated records are intentionally not recreated.
  }
}
