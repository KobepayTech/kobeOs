import { MigrationInterface, QueryRunner } from 'typeorm';

export class KobeAiOperatingLayer1785100000000 implements MigrationInterface {
  name = 'KobeAiOperatingLayer1785100000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "ai_skill_installs" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "skillId" varchar(80) NOT NULL,
      "enabled" boolean NOT NULL DEFAULT true,
      "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "installedAt" timestamptz
    )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ai_skill_installs_owner_skill" ON "ai_skill_installs" ("ownerId","skillId")`);

    await q.query(`CREATE TABLE IF NOT EXISTS "ai_memory_nodes" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "nodeType" varchar(60) NOT NULL,
      "externalKey" varchar(160) NOT NULL,
      "label" varchar(220) NOT NULL,
      "attributes" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "confidence" double precision NOT NULL DEFAULT 1,
      "source" varchar NOT NULL DEFAULT 'user',
      "lastVerifiedAt" timestamptz
    )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ai_memory_nodes_owner_key" ON "ai_memory_nodes" ("ownerId","nodeType","externalKey")`);

    await q.query(`CREATE TABLE IF NOT EXISTS "ai_memory_edges" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "fromNodeId" uuid NOT NULL,
      "relation" varchar(80) NOT NULL,
      "toNodeId" uuid NOT NULL,
      "attributes" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "confidence" double precision NOT NULL DEFAULT 1
    )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ai_memory_edges_unique" ON "ai_memory_edges" ("ownerId","fromNodeId","relation","toNodeId")`);

    await q.query(`CREATE TABLE IF NOT EXISTS "ai_workflow_plans" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "title" varchar(160) NOT NULL,
      "objective" text NOT NULL,
      "status" varchar NOT NULL DEFAULT 'DRAFT',
      "steps" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "context" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "riskLevel" varchar NOT NULL DEFAULT 'medium',
      "confidence" double precision NOT NULL DEFAULT 0.5,
      "currentStep" integer NOT NULL DEFAULT 0,
      "summary" text NOT NULL DEFAULT '',
      "approvedAt" timestamptz,
      "completedAt" timestamptz
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_ai_workflow_owner_status" ON "ai_workflow_plans" ("ownerId","status","createdAt")`);

    await q.query(`CREATE TABLE IF NOT EXISTS "ai_approval_requests" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "workflowId" uuid,
      "actionType" varchar(120) NOT NULL,
      "summary" text NOT NULL,
      "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "chain" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "currentStep" integer NOT NULL DEFAULT 0,
      "status" varchar NOT NULL DEFAULT 'PENDING',
      "amount" numeric(18,2),
      "currency" varchar NOT NULL DEFAULT 'TZS',
      "decidedAt" timestamptz
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_ai_approval_owner_status" ON "ai_approval_requests" ("ownerId","status","createdAt")`);

    await q.query(`CREATE TABLE IF NOT EXISTS "ai_operating_audit" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "actorId" uuid,
      "actorRole" varchar NOT NULL DEFAULT '',
      "eventType" varchar(80) NOT NULL,
      "module" varchar NOT NULL DEFAULT '',
      "action" varchar NOT NULL DEFAULT '',
      "model" varchar NOT NULL DEFAULT '',
      "tool" varchar NOT NULL DEFAULT '',
      "confidence" double precision NOT NULL DEFAULT 0,
      "citations" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_ai_operating_audit_owner_created" ON "ai_operating_audit" ("ownerId","createdAt")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_ai_operating_audit_owner_event" ON "ai_operating_audit" ("ownerId","eventType")`);

    await q.query(`CREATE TABLE IF NOT EXISTS "ai_dashboards" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "name" varchar(160) NOT NULL,
      "description" text NOT NULL DEFAULT '',
      "widgets" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "filters" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "createdByAi" boolean NOT NULL DEFAULT true
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_ai_dashboards_owner_name" ON "ai_dashboards" ("ownerId","name")`);

    await q.query(`CREATE TABLE IF NOT EXISTS "ai_insights" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "dedupeKey" varchar(120) NOT NULL,
      "insightType" varchar(80) NOT NULL,
      "severity" varchar NOT NULL DEFAULT 'info',
      "title" varchar(180) NOT NULL,
      "summary" text NOT NULL,
      "evidence" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "status" varchar NOT NULL DEFAULT 'OPEN',
      "resolvedAt" timestamptz
    )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ai_insights_owner_dedupe" ON "ai_insights" ("ownerId","dedupeKey")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_ai_insights_owner_status" ON "ai_insights" ("ownerId","status","severity")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE IF EXISTS "ai_insights"');
    await q.query('DROP TABLE IF EXISTS "ai_dashboards"');
    await q.query('DROP TABLE IF EXISTS "ai_operating_audit"');
    await q.query('DROP TABLE IF EXISTS "ai_approval_requests"');
    await q.query('DROP TABLE IF EXISTS "ai_workflow_plans"');
    await q.query('DROP TABLE IF EXISTS "ai_memory_edges"');
    await q.query('DROP TABLE IF EXISTS "ai_memory_nodes"');
    await q.query('DROP TABLE IF EXISTS "ai_skill_installs"');
  }
}
