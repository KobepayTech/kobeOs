import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIndexesAndAuditTables1747160000000 implements MigrationInterface {
  name = 'AddIndexesAndAuditTables1747160000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_users_email" ON "users" ("email")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_users_role" ON "users" ("role")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_refresh_tokens_user" ON "refresh_tokens" ("userId", "revoked")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_password_resets_user" ON "password_resets" ("userId", "used")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "action" character varying NOT NULL,
        "entityType" character varying NOT NULL,
        "entityId" character varying,
        "userId" character varying,
        "userEmail" character varying,
        "oldValue" jsonb,
        "newValue" jsonb,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_audit_entity" ON "audit_logs" ("entityType", "entityId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_audit_user" ON "audit_logs" ("userId", "createdAt")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "webhooks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "provider" character varying NOT NULL,
        "eventType" character varying NOT NULL,
        "payload" jsonb NOT NULL,
        "processed" boolean NOT NULL DEFAULT false,
        "processedAt" TIMESTAMP WITH TIME ZONE,
        "errorMessage" character varying,
        "receivedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_webhooks" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_webhooks_provider_event" ON "webhooks" ("provider", "eventType")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_webhooks_processed" ON "webhooks" ("processed", "receivedAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "webhooks"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_email"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_role"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_refresh_tokens_user"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_password_resets_user"`);
  }
}
