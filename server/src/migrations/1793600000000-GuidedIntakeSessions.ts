import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Schema for guided catalogue intake: a batch of photos being turned into
 * catalogue entries one question at a time.
 *
 * The queue is stored rather than held in memory because a merchant
 * photographing eighty items answers over several sittings, on a phone, on a
 * connection that drops. Losing it would mean re-uploading and re-answering
 * what was already done — worse than the form this replaces.
 *
 * Additive and guarded, like the rest of the recent migrations: one unguarded
 * statement rolls back the whole pending batch and bricks every boot
 * afterwards.
 */
export class GuidedIntakeSessions1793600000000 implements MigrationInterface {
  name = 'GuidedIntakeSessions1793600000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "intake_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "ownerId" uuid NOT NULL,
        "kind" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'OPEN',
        "contextId" uuid,
        "note" character varying NOT NULL DEFAULT '',
        CONSTRAINT "PK_intake_sessions" PRIMARY KEY ("id")
      )
    `);
    await q.query('CREATE INDEX IF NOT EXISTS "IDX_intake_sessions_owner" ON "intake_sessions" ("ownerId")');
    await q.query('CREATE INDEX IF NOT EXISTS "IDX_intake_sessions_owner_status" ON "intake_sessions" ("ownerId", "status")');

    await q.query(`
      CREATE TABLE IF NOT EXISTS "intake_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "ownerId" uuid NOT NULL,
        "sessionId" uuid NOT NULL,
        "position" integer NOT NULL DEFAULT 0,
        "imageToken" character varying NOT NULL DEFAULT '',
        "status" character varying NOT NULL DEFAULT 'PENDING',
        "suggestion" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "suggestionAttempted" boolean NOT NULL DEFAULT false,
        "answers" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdId" uuid,
        "lastError" text NOT NULL DEFAULT '',
        CONSTRAINT "PK_intake_items" PRIMARY KEY ("id")
      )
    `);
    await q.query('CREATE INDEX IF NOT EXISTS "IDX_intake_items_owner" ON "intake_items" ("ownerId")');
    await q.query('CREATE INDEX IF NOT EXISTS "IDX_intake_items_session" ON "intake_items" ("sessionId")');
    // The queue is read as "next pending item in this session by position", so
    // this is the index that keeps the question after each answer instant.
    await q.query('CREATE INDEX IF NOT EXISTS "IDX_intake_items_session_position" ON "intake_items" ("sessionId", "position")');
    await q.query('CREATE INDEX IF NOT EXISTS "IDX_intake_items_owner_status" ON "intake_items" ("ownerId", "status")');
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE IF EXISTS "intake_items"');
    await q.query('DROP TABLE IF EXISTS "intake_sessions"');
  }
}
