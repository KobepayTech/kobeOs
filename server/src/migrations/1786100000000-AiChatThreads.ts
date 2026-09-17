import { MigrationInterface, QueryRunner } from 'typeorm';

export class AiChatThreads1786100000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "ai_chat_threads" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "ownerId" uuid NOT NULL,
        "title" character varying NOT NULL DEFAULT '',
        "appId" character varying NOT NULL DEFAULT '',
        "lastMessageAt" TIMESTAMP WITH TIME ZONE,
        "messageCount" integer NOT NULL DEFAULT 0,
        "archivedAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_ai_chat_threads" PRIMARY KEY ("id")
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_ai_chat_threads_owner" ON "ai_chat_threads" ("ownerId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_ai_chat_threads_last_message" ON "ai_chat_threads" ("lastMessageAt")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "ai_chat_messages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "ownerId" uuid NOT NULL,
        "threadId" uuid NOT NULL,
        "role" character varying(16) NOT NULL,
        "content" text NOT NULL,
        "model" character varying NOT NULL DEFAULT '',
        "provider" character varying NOT NULL DEFAULT '',
        "promptTokens" integer NOT NULL DEFAULT 0,
        "completionTokens" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_ai_chat_messages" PRIMARY KEY ("id")
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_ai_chat_messages_owner" ON "ai_chat_messages" ("ownerId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_ai_chat_messages_thread" ON "ai_chat_messages" ("threadId")`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "ai_chat_messages"`);
    await q.query(`DROP TABLE IF EXISTS "ai_chat_threads"`);
  }
}
