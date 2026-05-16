import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddShipmentDriverId1778900000001 implements MigrationInterface {
  name = 'AddShipmentDriverId1778900000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "shipments"
      ADD COLUMN IF NOT EXISTS "driverId" uuid
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_shipments_driverId"
      ON "shipments" ("driverId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_shipments_driverId"`);
    await queryRunner.query(`ALTER TABLE "shipments" DROP COLUMN IF EXISTS "driverId"`);
  }
}
