import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Replace the global unique index on parcels.parcelId with a composite
 * unique index on (ownerId, parcelId) so different companies can use the
 * same parcel ID string without conflict.
 */
export class ScopeParcelIdIndexToOwner1778900000003 implements MigrationInterface {
  name = 'ScopeParcelIdIndexToOwner1778900000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the old global unique index (name may vary by TypeORM version).
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_parcels_parcelId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_parcels_parcelId"`);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_parcels_ownerId_parcelId"
      ON "parcels" ("ownerId", "parcelId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_parcels_ownerId_parcelId"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_parcels_parcelId" ON "parcels" ("parcelId")
    `);
  }
}
