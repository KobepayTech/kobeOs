import { MigrationInterface, QueryRunner } from 'typeorm';

/** Kobe AI Receptionist: per-business config, sessions, messages, leads. */
export class Reception1784400000000 implements MigrationInterface {
  name = 'Reception1784400000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "receptionists" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "ownerId" uuid NOT NULL,
        "slug" varchar NOT NULL,
        "businessName" varchar NOT NULL,
        "hotelId" uuid,
        "enabled" boolean NOT NULL DEFAULT true,
        "greeting" text NOT NULL DEFAULT '',
        "hoursText" text NOT NULL DEFAULT '',
        "faq" jsonb NOT NULL DEFAULT '[]',
        "capabilities" jsonb NOT NULL DEFAULT '{"faq":true,"order":true,"status":true,"booking":true}',
        "handoffPhone" varchar NOT NULL DEFAULT '',
        "currency" varchar NOT NULL DEFAULT 'TZS',
        "voiceEnabled" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_receptionists" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_receptionists_slug" ON "receptionists" ("slug")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_receptionists_hotel" ON "receptionists" ("hotelId")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "reception_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "receptionistId" uuid NOT NULL,
        "channel" varchar NOT NULL DEFAULT 'web',
        "customerName" varchar NOT NULL DEFAULT '',
        "customerPhone" varchar NOT NULL DEFAULT '',
        "status" varchar NOT NULL DEFAULT 'OPEN',
        "context" jsonb NOT NULL DEFAULT '{}',
        CONSTRAINT "PK_reception_sessions" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_reception_sessions_receptionist" ON "reception_sessions" ("receptionistId")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "reception_messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "sessionId" uuid NOT NULL,
        "role" varchar NOT NULL,
        "text" text NOT NULL,
        CONSTRAINT "PK_reception_messages" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_reception_messages_session" ON "reception_messages" ("sessionId")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "reception_leads" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "receptionistId" uuid NOT NULL,
        "sessionId" uuid,
        "name" varchar NOT NULL DEFAULT '',
        "phone" varchar NOT NULL DEFAULT '',
        "summary" text NOT NULL DEFAULT '',
        "status" varchar NOT NULL DEFAULT 'NEW',
        CONSTRAINT "PK_reception_leads" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_reception_leads_receptionist" ON "reception_leads" ("receptionistId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_reception_leads_status" ON "reception_leads" ("status")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const t of ['reception_leads', 'reception_messages', 'reception_sessions', 'receptionists']) {
      await q.query(`DROP TABLE IF EXISTS "${t}"`);
    }
  }
}
