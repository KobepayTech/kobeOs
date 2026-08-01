import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAppMarketplaceAndDeveloperProjects1781200000000 implements MigrationInterface {
  name = 'AddAppMarketplaceAndDeveloperProjects1781200000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "app_entitlements" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "userId" uuid NOT NULL,
      "appId" character varying NOT NULL,
      "status" character varying NOT NULL DEFAULT 'trialing',
      "installedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
      "trialEndsAt" TIMESTAMP WITH TIME ZONE NOT NULL,
      "currentPeriodEndsAt" TIMESTAMP WITH TIME ZONE,
      "amountTzs" numeric(18,2) NOT NULL DEFAULT 0,
      "amountUsd" numeric(12,2) NOT NULL DEFAULT 0,
      "provider" character varying,
      "transactionId" character varying,
      "palmPesaOrderId" character varying,
      "palmPesaTransId" character varying,
      "paypalOrderId" character varying,
      "channel" character varying,
      "callbackPayload" jsonb,
      CONSTRAINT "PK_app_entitlements" PRIMARY KEY ("id")
    )`);
    await q.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_app_entitlements_user_app" ON "app_entitlements" ("userId", "appId")`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_app_entitlements_user" ON "app_entitlements" ("userId")`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_app_entitlements_transaction" ON "app_entitlements" ("transactionId")`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_app_entitlements_paypal" ON "app_entitlements" ("paypalOrderId")`,
    );

    await q.query(`CREATE TABLE IF NOT EXISTS "developer_projects" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "userId" uuid NOT NULL,
      "name" character varying NOT NULL,
      "slug" character varying NOT NULL,
      "apiKeyHash" character varying NOT NULL,
      "apiKeyPrefix" character varying NOT NULL,
      "allowedOrigins" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "status" character varying NOT NULL DEFAULT 'active',
      "usageCount" integer NOT NULL DEFAULT 0,
      "lastUsedAt" TIMESTAMP WITH TIME ZONE,
      CONSTRAINT "PK_developer_projects" PRIMARY KEY ("id")
    )`);
    await q.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_developer_projects_user_slug" ON "developer_projects" ("userId", "slug")`,
    );
    await q.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_developer_projects_key_hash" ON "developer_projects" ("apiKeyHash")`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_developer_projects_user" ON "developer_projects" ("userId")`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "developer_projects"`);
    await q.query(`DROP TABLE IF EXISTS "app_entitlements"`);
  }
}
