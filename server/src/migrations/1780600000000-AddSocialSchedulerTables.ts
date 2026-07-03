import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSocialSchedulerTables1780600000000 implements MigrationInterface {
  name = 'AddSocialSchedulerTables1780600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── social_posts table ───
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "social_posts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "ownerId" uuid NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "content" text NOT NULL,
        "platforms" text NOT NULL DEFAULT '',
        "mediaUrls" text NOT NULL DEFAULT '',
        "scheduledAt" timestamptz,
        "status" varchar NOT NULL DEFAULT 'draft',
        "publishedAt" timestamptz,
        "engagementStats" jsonb NOT NULL DEFAULT '{}',
        "platformPostIds" jsonb NOT NULL DEFAULT '{}'
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_social_posts_ownerId_status_scheduledAt" ON "social_posts" ("ownerId", "status", "scheduledAt")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_social_posts_status" ON "social_posts" ("status")`);

    // ─── social_accounts table ───
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "social_accounts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "ownerId" uuid NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "platform" varchar NOT NULL,
        "accountName" varchar NOT NULL,
        "accountHandle" varchar NOT NULL,
        "accessToken" text NOT NULL,
        "refreshToken" text,
        "tokenExpiresAt" timestamptz,
        "status" varchar NOT NULL DEFAULT 'connected',
        "accountAvatar" text,
        "metadata" jsonb NOT NULL DEFAULT '{}'
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_social_accounts_ownerId_platform" ON "social_accounts" ("ownerId", "platform")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_social_accounts_ownerId_platform"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "social_accounts"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_social_posts_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_social_posts_ownerId_status_scheduledAt"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "social_posts"`);
  }
}
