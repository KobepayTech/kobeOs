import { MigrationInterface, QueryRunner } from 'typeorm';

export class CargoTzCollectorApproval1794172800003 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE ctz_collector_access ADD COLUMN "approvedAt" timestamptz');
    await queryRunner.query('UPDATE ctz_collector_access SET "approvedAt" = "updatedAt" WHERE "collectorId" IS NOT NULL');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE ctz_collector_access DROP COLUMN "approvedAt"');
  }
}
