import { MigrationInterface, QueryRunner } from 'typeorm';

export class GuidedBusinessSetup1794000000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE "user_onboarding" ADD COLUMN IF NOT EXISTS "guidedSetup" jsonb');
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE "user_onboarding" DROP COLUMN IF EXISTS "guidedSetup"');
  }
}
