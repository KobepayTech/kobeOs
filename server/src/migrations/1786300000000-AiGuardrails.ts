import { MigrationInterface, QueryRunner } from 'typeorm';

export class AiGuardrails1786300000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "ai_guardrails" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "ownerId" uuid NOT NULL,
        "enabled" boolean NOT NULL DEFAULT false,
        "rules" jsonb NOT NULL DEFAULT '[]'::jsonb,
        CONSTRAINT "PK_ai_guardrails" PRIMARY KEY ("id")
      )
    `);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ai_guardrails_owner" ON "ai_guardrails" ("ownerId")`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "IDX_ai_guardrails_owner"`);
    await q.query(`DROP TABLE IF EXISTS "ai_guardrails"`);
  }
}
