import { MigrationInterface, QueryRunner } from 'typeorm';

/** Non-live "post/ad" campaigns: session kind + post URL, and an external
 *  comment id on comments so polled (Apify) comments are de-duplicated. */
export class AddPostCampaigns1782400000000 implements MigrationInterface {
  name = 'AddPostCampaigns1782400000000';
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "live_sessions" ADD COLUMN IF NOT EXISTS "kind" character varying NOT NULL DEFAULT 'live'`);
    await q.query(`ALTER TABLE "live_sessions" ADD COLUMN IF NOT EXISTS "postUrl" character varying NOT NULL DEFAULT ''`);
    await q.query(`ALTER TABLE "live_comments" ADD COLUMN IF NOT EXISTS "externalId" character varying NOT NULL DEFAULT ''`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_live_comments_external_id" ON "live_comments" ("externalId")`);
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "IDX_live_comments_external_id"`);
    await q.query(`ALTER TABLE "live_comments" DROP COLUMN IF EXISTS "externalId"`);
    await q.query(`ALTER TABLE "live_sessions" DROP COLUMN IF EXISTS "postUrl"`);
    await q.query(`ALTER TABLE "live_sessions" DROP COLUMN IF EXISTS "kind"`);
  }
}
