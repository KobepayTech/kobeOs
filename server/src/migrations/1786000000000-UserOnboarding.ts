import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserOnboarding1786000000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "user_onboarding" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "ownerId" uuid NOT NULL,
        "skippedSteps" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "dismissedAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_user_onboarding" PRIMARY KEY ("id")
      )
    `);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_user_onboarding_owner" ON "user_onboarding" ("ownerId")`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "IDX_user_onboarding_owner"`);
    await q.query(`DROP TABLE IF EXISTS "user_onboarding"`);
  }
}
