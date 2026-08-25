import { MigrationInterface, QueryRunner } from 'typeorm';

/** Stores encrypted social-provider settings and one-time QR setup sessions. */
export class AddProviderSetup1783700000000 implements MigrationInterface {
  name = 'AddProviderSetup1783700000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "provider_configs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "provider" varchar(64) NOT NULL,
        "appId" varchar(255) NOT NULL,
        "encryptedAppSecret" text NOT NULL,
        "redirectUri" varchar(500) NOT NULL,
        "loginConfigId" varchar(128) NOT NULL DEFAULT '',
        "graphVersion" varchar(32) NOT NULL DEFAULT 'v26.0',
        "configuredBy" uuid,
        CONSTRAINT "PK_provider_configs" PRIMARY KEY ("id")
      )
    `);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_provider_configs_provider" ON "provider_configs" ("provider")`);
    await q.query(`
      CREATE TABLE IF NOT EXISTS "provider_setup_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "tokenHash" varchar(64) NOT NULL,
        "provider" varchar(64) NOT NULL DEFAULT 'meta',
        "expiresAt" timestamptz NOT NULL,
        "usedAt" timestamptz,
        "createdBy" uuid,
        CONSTRAINT "PK_provider_setup_sessions" PRIMARY KEY ("id")
      )
    `);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_provider_setup_sessions_tokenHash" ON "provider_setup_sessions" ("tokenHash")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_provider_setup_sessions_expiresAt" ON "provider_setup_sessions" ("expiresAt")`);
  }

  public async down(): Promise<void> {
    // Provider credentials are intentionally not removed automatically.
  }
}
