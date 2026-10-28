import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Schema for the online continuity layer: capacity the cloud owns while KobeOS
 * is unreachable, and the record of what it did with it.
 *
 * See docs/ONLINE_CONTINUITY.md. The design point this schema exists to
 * enforce is that two databases which cannot talk never sell the same room or
 * the same last unit, by giving the cloud a slice it owns outright rather than
 * asking the two to agree.
 *
 * Additive and guarded, like the rest of the recent migrations: every
 * statement is skipped rather than failed when its table is absent, because
 * one unguarded statement rolls back the whole pending batch and bricks every
 * boot afterwards.
 */
export class OnlineContinuityAllotments1793400000000 implements MigrationInterface {
  name = 'OnlineContinuityAllotments1793400000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "cloud_room_allotments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "ownerId" uuid NOT NULL,
        "hotelId" uuid NOT NULL,
        "roomId" uuid NOT NULL,
        "fromDate" date NOT NULL,
        "toDate" date NOT NULL,
        "status" character varying NOT NULL DEFAULT 'ACTIVE',
        "reclaimRequestedAt" TIMESTAMP WITH TIME ZONE,
        "acknowledgedAt" TIMESTAMP WITH TIME ZONE,
        "note" character varying NOT NULL DEFAULT '',
        CONSTRAINT "PK_cloud_room_allotments" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_cloud_room_allotments_owner" ON "cloud_room_allotments" ("ownerId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_cloud_room_allotments_room" ON "cloud_room_allotments" ("roomId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_cloud_room_allotments_hotel" ON "cloud_room_allotments" ("hotelId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_cloud_room_allotments_lookup" ON "cloud_room_allotments" ("ownerId", "roomId", "status")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "cloud_outbox" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "ownerId" uuid NOT NULL,
        "kind" character varying NOT NULL,
        "originId" character varying NOT NULL,
        "payload" text NOT NULL DEFAULT '{}',
        "syncedAt" TIMESTAMP WITH TIME ZONE,
        "attempts" integer NOT NULL DEFAULT 0,
        "lastError" text NOT NULL DEFAULT '',
        CONSTRAINT "PK_cloud_outbox" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_cloud_outbox_owner" ON "cloud_outbox" ("ownerId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_cloud_outbox_pending" ON "cloud_outbox" ("ownerId", "syncedAt")`);
    // Replay safety: the same originId can never produce two bookings.
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "cloud_outbox_origin_uk" ON "cloud_outbox" ("ownerId", "kind", "originId")`);

    // Online allowance, kept separate from reported stock. A heartbeat owns
    // "stock" and must never write these, or units the cloud already sold
    // would become sellable online a second time.
    await q.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'commerce_product_snippets') THEN
          ALTER TABLE "commerce_product_snippets"
            ADD COLUMN IF NOT EXISTS "allocatedQty" integer NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS "remainingQty" integer NOT NULL DEFAULT 0;
        END IF;
      END $$;
    `);

    // The cloud's id for a booking it originated, so absorbing it twice is a
    // no-op rather than a duplicate reservation.
    await q.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hotel_bookings') THEN
          ALTER TABLE "hotel_bookings" ADD COLUMN IF NOT EXISTS "cloudOriginId" character varying;
          CREATE UNIQUE INDEX IF NOT EXISTS "hotel_bookings_cloud_origin_uk"
            ON "hotel_bookings" ("ownerId", "cloudOriginId")
            WHERE "cloudOriginId" IS NOT NULL;
        END IF;
      END $$;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    // The allotment tables can go; the columns stay. Dropping cloudOriginId
    // would discard the only link between a synced booking and the outbox row
    // that produced it, which is what makes a replay safe.
    await q.query(`DROP TABLE IF EXISTS "cloud_outbox"`);
    await q.query(`DROP TABLE IF EXISTS "cloud_room_allotments"`);
  }
}
