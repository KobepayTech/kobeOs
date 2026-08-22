import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInstagramLiveConnections1783000000000 implements MigrationInterface {
  name = 'AddInstagramLiveConnections1783000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "live_sessions" ADD COLUMN IF NOT EXISTS "socialAccountId" uuid');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_live_sessions_social_account" ON "live_sessions" ("socialAccountId", "status")');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_live_sessions_social_account"');
    await queryRunner.query('ALTER TABLE "live_sessions" DROP COLUMN IF EXISTS "socialAccountId"');
  }
}
