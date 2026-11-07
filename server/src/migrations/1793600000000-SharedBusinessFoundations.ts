import { MigrationInterface, QueryRunner } from 'typeorm';

export class SharedBusinessFoundations1793600000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "platform_domain_events"
      ADD COLUMN IF NOT EXISTS "schemaVersion" integer NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS "correlationId" uuid,
      ADD COLUMN IF NOT EXISTS "idempotencyKey" varchar(160),
      ADD COLUMN IF NOT EXISTS "fingerprint" varchar(64),
      ADD COLUMN IF NOT EXISTS "nextAttemptAt" timestamptz,
      ADD COLUMN IF NOT EXISTS "lastError" varchar(200)`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_platform_event_key"
      ON "platform_domain_events" ("ownerId", "eventName", "idempotencyKey") WHERE "idempotencyKey" IS NOT NULL`);
    await q.query(`CREATE TABLE IF NOT EXISTS "platform_business_signals" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL, "sourceEventId" uuid NOT NULL UNIQUE,
      "eventName" varchar NOT NULL, "category" varchar NOT NULL, "severity" varchar NOT NULL,
      "summary" varchar(240) NOT NULL, "data" jsonb NOT NULL DEFAULT '{}'
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_business_signal_owner_created" ON "platform_business_signals" ("ownerId", "createdAt")`);
    await q.query(`ALTER TABLE "ai_approval_requests"
      ADD COLUMN IF NOT EXISTS "executionStatus" varchar NOT NULL DEFAULT 'NOT_STARTED',
      ADD COLUMN IF NOT EXISTS "executionResult" jsonb,
      ADD COLUMN IF NOT EXISTS "executionError" text`);
    await q.query('ALTER TABLE "ai_workflow_plans" ADD COLUMN IF NOT EXISTS "executionClaim" uuid');
    // Existing approved actions may already have run. Do not classify them as safe to replay.
    await q.query(`UPDATE "ai_approval_requests" SET "executionStatus" = 'FAILED',
      "executionError" = 'Legacy approval: execution outcome requires manual review; do not replay.'
      WHERE "status" = 'APPROVED' AND "payload" ? 'tool' AND "executionStatus" = 'NOT_STARTED'`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE "ai_workflow_plans" DROP COLUMN IF EXISTS "executionClaim"');
    await q.query(`ALTER TABLE "ai_approval_requests" DROP COLUMN IF EXISTS "executionError",
      DROP COLUMN IF EXISTS "executionResult", DROP COLUMN IF EXISTS "executionStatus"`);
    await q.query('DROP TABLE IF EXISTS "platform_business_signals"');
    await q.query('DROP INDEX IF EXISTS "UQ_platform_event_key"');
    await q.query(`ALTER TABLE "platform_domain_events" DROP COLUMN IF EXISTS "schemaVersion",
      DROP COLUMN IF EXISTS "correlationId", DROP COLUMN IF EXISTS "idempotencyKey",
      DROP COLUMN IF EXISTS "fingerprint", DROP COLUMN IF EXISTS "nextAttemptAt", DROP COLUMN IF EXISTS "lastError"`);
  }
}
