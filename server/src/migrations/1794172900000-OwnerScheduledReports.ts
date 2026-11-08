import { MigrationInterface, QueryRunner } from 'typeorm';

export class OwnerScheduledReports1794172900000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "ai_scheduled_agents" ADD COLUMN IF NOT EXISTS "reportKey" varchar');
    await queryRunner.query('CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ai_scheduled_agents_owner_report" ON "ai_scheduled_agents" ("ownerId", "reportKey")');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_ai_scheduled_agents_owner_report"');
    await queryRunner.query('ALTER TABLE "ai_scheduled_agents" DROP COLUMN IF EXISTS "reportKey"');
  }
}
