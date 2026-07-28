import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddScheduledAiAgents1781500000000 implements MigrationInterface {
  name = 'AddScheduledAiAgents1781500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "ai_scheduled_agents" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "name" varchar(120) NOT NULL,
      "objective" text NOT NULL,
      "frequency" varchar NOT NULL DEFAULT 'DAILY',
      "timeOfDay" varchar NOT NULL DEFAULT '08:00',
      "intervalHours" integer NOT NULL DEFAULT 24,
      "daysOfWeek" text NOT NULL DEFAULT '[]',
      "timezone" varchar NOT NULL DEFAULT 'Africa/Dar_es_Salaam',
      "allowedModules" text NOT NULL DEFAULT '[]',
      "allowedTools" text NOT NULL DEFAULT '[]',
      "approvalMode" varchar NOT NULL DEFAULT 'APPROVAL_REQUIRED',
      "inputSources" text NOT NULL DEFAULT '[]',
      "outputDestination" varchar NOT NULL DEFAULT 'KOBEOS_INBOX',
      "status" varchar NOT NULL DEFAULT 'ACTIVE',
      "nextRunAt" timestamptz NOT NULL,
      "lastRunAt" timestamptz,
      "lastSuccessAt" timestamptz,
      "leaseUntil" timestamptz,
      "consecutiveFailures" integer NOT NULL DEFAULT 0,
      "lastError" varchar NOT NULL DEFAULT ''
    )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ai_agents_due" ON "ai_scheduled_agents" ("ownerId", "status", "nextRunAt")`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "ai_agent_runs" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "agentId" uuid NOT NULL,
      "status" varchar NOT NULL DEFAULT 'RUNNING',
      "startedAt" timestamptz NOT NULL,
      "finishedAt" timestamptz,
      "summary" text NOT NULL DEFAULT '',
      "result" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "pendingAction" jsonb,
      "error" varchar NOT NULL DEFAULT '',
      "wasAutomaticAction" boolean NOT NULL DEFAULT false,
      "approvedAt" timestamptz,
      "rejectedAt" timestamptz
    )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ai_agent_runs_agent" ON "ai_agent_runs" ("ownerId", "agentId", "startedAt")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ai_agent_runs_status" ON "ai_agent_runs" ("ownerId", "status")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "ai_agent_runs"');
    await queryRunner.query('DROP TABLE IF EXISTS "ai_scheduled_agents"');
  }
}
