import { MigrationInterface, QueryRunner } from 'typeorm';

/** Live Ads creative formats (banner/fullscreen/video) + auto-delivery rotation. */
export class LiveAdsFormatsAndRotation1784200000000 implements MigrationInterface {
  name = 'LiveAdsFormatsAndRotation1784200000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "live_ad_campaigns" ADD COLUMN IF NOT EXISTS "creativeFormat" varchar NOT NULL DEFAULT 'CARD'`);
    await q.query(`
      CREATE TABLE IF NOT EXISTS "live_ad_rotations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "ownerId" uuid NOT NULL,
        "liveCreatorId" uuid NOT NULL,
        "campaignIds" jsonb NOT NULL DEFAULT '[]',
        "everySeconds" integer NOT NULL DEFAULT 300,
        "playbackSeconds" integer NOT NULL DEFAULT 10,
        "ctaSeconds" integer NOT NULL DEFAULT 900,
        "active" boolean NOT NULL DEFAULT true,
        "cursor" integer NOT NULL DEFAULT 0,
        "lastStartedAt" timestamptz,
        CONSTRAINT "PK_live_ad_rotations" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_live_ad_rotations_creator" ON "live_ad_rotations" ("liveCreatorId")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "live_ad_rotations"`);
    await q.query(`ALTER TABLE "live_ad_campaigns" DROP COLUMN IF EXISTS "creativeFormat"`);
  }
}
