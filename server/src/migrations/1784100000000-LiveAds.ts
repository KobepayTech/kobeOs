import { MigrationInterface, QueryRunner } from 'typeorm';

/** Kobe Live Ads: permanent creator links, sessions, approved destinations,
 * campaigns, slots (dual-window), and the attribution/proof-of-play event log. */
export class LiveAds1784100000000 implements MigrationInterface {
  name = 'LiveAds1784100000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "live_creators" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "ownerId" uuid NOT NULL,
        "creatorId" uuid NOT NULL,
        "handle" varchar NOT NULL,
        "displayName" varchar NOT NULL DEFAULT '',
        "avatarUrl" varchar,
        "overlayToken" varchar NOT NULL,
        "adsEnabled" boolean NOT NULL DEFAULT true,
        "defaultRoutingMode" varchar NOT NULL DEFAULT 'SPONSOR_PAGE',
        CONSTRAINT "PK_live_creators" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_live_creators_creator" ON "live_creators" ("creatorId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_live_creators_handle" ON "live_creators" ("handle")`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_live_creators_overlay" ON "live_creators" ("overlayToken")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "live_handle_aliases" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "handle" varchar NOT NULL,
        "liveCreatorId" uuid NOT NULL,
        CONSTRAINT "PK_live_handle_aliases" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_live_handle_aliases_handle" ON "live_handle_aliases" ("handle")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_live_handle_aliases_creator" ON "live_handle_aliases" ("liveCreatorId")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "live_ad_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "liveCreatorId" uuid NOT NULL,
        "status" varchar NOT NULL DEFAULT 'LIVE',
        "source" varchar NOT NULL DEFAULT 'OVERLAY',
        "startedAt" timestamptz NOT NULL,
        "endedAt" timestamptz,
        "lastSeenAt" timestamptz NOT NULL,
        CONSTRAINT "PK_live_ad_sessions" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_live_ad_sessions_creator" ON "live_ad_sessions" ("liveCreatorId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_live_ad_sessions_status" ON "live_ad_sessions" ("status")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_live_ad_sessions_lastseen" ON "live_ad_sessions" ("lastSeenAt")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "live_ad_destinations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "ownerId" uuid NOT NULL,
        "url" text NOT NULL,
        "domain" varchar NOT NULL,
        "status" varchar NOT NULL DEFAULT 'ACTIVE',
        CONSTRAINT "PK_live_ad_destinations" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_live_ad_destinations_status" ON "live_ad_destinations" ("status")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "live_ad_campaigns" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "ownerId" uuid NOT NULL,
        "title" varchar NOT NULL,
        "sponsorName" varchar NOT NULL,
        "destinationId" uuid NOT NULL,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        "routingMode" varchar NOT NULL DEFAULT 'SPONSOR_PAGE',
        "offerText" text NOT NULL DEFAULT '',
        "couponCode" varchar NOT NULL DEFAULT '',
        "creativeVideoUrl" varchar,
        "pricePerSlot" numeric(18,4) NOT NULL DEFAULT 0,
        "costPerClick" numeric(18,4) NOT NULL DEFAULT 0,
        "creatorSharePercent" double precision NOT NULL DEFAULT 70,
        "currency" varchar NOT NULL DEFAULT 'TZS',
        "reviewNote" varchar,
        CONSTRAINT "PK_live_ad_campaigns" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_live_ad_campaigns_status" ON "live_ad_campaigns" ("status")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_live_ad_campaigns_dest" ON "live_ad_campaigns" ("destinationId")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "live_ad_slots" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "sessionId" uuid NOT NULL,
        "liveCreatorId" uuid NOT NULL,
        "campaignId" uuid NOT NULL,
        "code" varchar NOT NULL,
        "status" varchar NOT NULL DEFAULT 'CTA_ACTIVE',
        "playbackStart" timestamptz NOT NULL,
        "playbackEnd" timestamptz NOT NULL,
        "ctaStart" timestamptz NOT NULL,
        "ctaEnd" timestamptz NOT NULL,
        CONSTRAINT "PK_live_ad_slots" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_live_ad_slots_code" ON "live_ad_slots" ("code")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_live_ad_slots_session" ON "live_ad_slots" ("sessionId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_live_ad_slots_cta_end" ON "live_ad_slots" ("ctaEnd")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "live_ad_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "slotId" uuid,
        "liveCreatorId" uuid NOT NULL,
        "campaignId" uuid,
        "type" varchar NOT NULL,
        "source" varchar NOT NULL DEFAULT 'BIO',
        "clickVisitId" varchar NOT NULL DEFAULT '',
        "revenue" numeric(18,4) NOT NULL DEFAULT 0,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        CONSTRAINT "PK_live_ad_events" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_live_ad_events_creator" ON "live_ad_events" ("liveCreatorId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_live_ad_events_campaign" ON "live_ad_events" ("campaignId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_live_ad_events_click" ON "live_ad_events" ("clickVisitId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_live_ad_events_type" ON "live_ad_events" ("type")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const t of ['live_ad_events', 'live_ad_slots', 'live_ad_campaigns', 'live_ad_destinations', 'live_ad_sessions', 'live_handle_aliases', 'live_creators']) {
      await q.query(`DROP TABLE IF EXISTS "${t}"`);
    }
  }
}
