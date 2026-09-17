import { MigrationInterface, QueryRunner } from 'typeorm';

export class AiAgentExecutions1786200000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "ai_agent_executions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "ownerId" uuid NOT NULL,
        "tool" character varying NOT NULL,
        "status" character varying(16) NOT NULL DEFAULT 'ok',
        "startedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "durationMs" integer NOT NULL DEFAULT 0,
        "cached" boolean NOT NULL DEFAULT false,
        "write" boolean NOT NULL DEFAULT false,
        "error" text NOT NULL DEFAULT '',
        CONSTRAINT "PK_ai_agent_executions" PRIMARY KEY ("id")
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_ai_agent_exec_owner" ON "ai_agent_executions" ("ownerId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_ai_agent_exec_started" ON "ai_agent_executions" ("startedAt")`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "ai_agent_executions"`);
  }
}
