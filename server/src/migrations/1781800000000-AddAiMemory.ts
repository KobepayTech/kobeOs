import { MigrationInterface, QueryRunner } from 'typeorm';

/** Durable per-owner Kobe AI memory (facts/preferences applied across chats). */
export class AddAiMemory1781800000000 implements MigrationInterface {
  name = 'AddAiMemory1781800000000';
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "ai_memory" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "facts" jsonb NOT NULL DEFAULT '[]'::jsonb,
      CONSTRAINT "PK_ai_memory" PRIMARY KEY ("id")
    )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ai_memory_owner" ON "ai_memory" ("ownerId")`);
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "ai_memory"`);
  }
}
