import { MigrationInterface, QueryRunner } from 'typeorm';

export class AirOpsTables1780200000200 implements MigrationInterface {
  name = 'AirOpsTables1780200000200';
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await q.query(`CREATE TABLE IF NOT EXISTS "cargo_customs_flows" ("id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "shipmentId" uuid, "parcelId" uuid, "stage" varchar NOT NULL DEFAULT 'EXPORT', "status" varchar NOT NULL DEFAULT 'PENDING', "documents" jsonb NOT NULL DEFAULT '[]', "taxAmount" double precision NOT NULL DEFAULT 0, "taxCurrency" varchar NOT NULL DEFAULT 'TZS', "delayHours" double precision NOT NULL DEFAULT 0, "officerName" varchar NOT NULL DEFAULT '', "holdReason" text NOT NULL DEFAULT '', "clearedAt" timestamptz)`);
    await q.query(`CREATE TABLE IF NOT EXISTS "cargo_tracking_events" ("id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "shipmentId" uuid, "parcelId" uuid, "eventType" varchar NOT NULL, "location" varchar NOT NULL DEFAULT '', "flightNumber" varchar NOT NULL DEFAULT '', "eventAt" timestamptz NOT NULL, "metadata" jsonb NOT NULL DEFAULT '{}', "notes" text NOT NULL DEFAULT '')`);
    await q.query(`CREATE TABLE IF NOT EXISTS "cargo_operational_assessments" ("id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "shipmentId" uuid, "routePlanId" uuid, "riskLevel" varchar NOT NULL DEFAULT 'LOW', "riskScore" double precision NOT NULL DEFAULT 0, "findings" jsonb NOT NULL DEFAULT '[]', "recommendedActions" jsonb NOT NULL DEFAULT '[]', "rerouteRecommended" boolean NOT NULL DEFAULT false, "notes" text NOT NULL DEFAULT '')`);
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "cargo_operational_assessments"`);
    await q.query(`DROP TABLE IF EXISTS "cargo_tracking_events"`);
    await q.query(`DROP TABLE IF EXISTS "cargo_customs_flows"`);
  }
}
