import { MigrationInterface, QueryRunner } from 'typeorm';

export class ScopeParcelIdIndexToOwner1778900000003 implements MigrationInterface {
  name = 'ScopeParcelIdIndexToOwner1778900000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'parcels') THEN
          DROP INDEX IF EXISTS "UQ_parcels_parcelId";
          DROP INDEX IF EXISTS "IDX_parcels_parcelId";
          CREATE UNIQUE INDEX IF NOT EXISTS "UQ_parcels_ownerId_parcelId" ON "parcels" ("ownerId", "parcelId");
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_parcels_ownerId_parcelId"`);
  }
}
