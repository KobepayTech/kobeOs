import { MigrationInterface, QueryRunner } from 'typeorm';

export class AirRouteOps1780200000100 implements MigrationInterface {
  name = 'AirRouteOps1780200000100';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await q.query(`CREATE TABLE IF NOT EXISTS "cargo_customs_flows" ("id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "shipmentId" uuid, "parcelId" uuid, "stage" varchar NOT NULL DEFAULT 'EXPORT', "status" varchar NOT NULL DEFAULT 'PENDING', "documents" jsonb NOT NULL DEFAULT '[]', "taxAmount" double precision NOT NULL DEFAULT 0, "taxCurrency" varchar NOT NULL DEFAULT 'TZS', "delayHours" double precision NOT NULL DEFAULT 0, "officerName" varchar NOT NULL DEFAULT '', "holdReason" text NOT NULL DEFAULT '', "clearedAt" timestamptz)`);
    await q.query(`CREATE TABLE IF NOT EXISTS "cargo_tracking_events" ("id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "shipmentId" uuid, "parcelId" uuid, "eventType" varchar NOT NULL, "location" varchar NOT NULL DEFAULT '', "flightNumber" varchar NOT NULL DEFAULT '', "eventAt" timestamptz NOT NULL, "metadata" jsonb NOT NULL DEFAULT '{}', "notes" text NOT NULL DEFAULT '')`);
    await q.query(`CREATE TABLE IF NOT EXISTS "cargo_operational_assessments" ("id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "shipmentId" uuid, "routePlanId" uuid, "riskLevel" varchar NOT NULL DEFAULT 'LOW', "riskScore" double precision NOT NULL DEFAULT 0, "findings" jsonb NOT NULL DEFAULT '[]', "recommendedActions" jsonb NOT NULL DEFAULT '[]', "rerouteRecommended" boolean NOT NULL DEFAULT false, "notes" text NOT NULL DEFAULT '')`);
    await q.query(`CREATE TABLE IF NOT EXISTS "cargo_last_mile_deliveries" ("id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "shipmentId" uuid, "parcelId" uuid, "driverId" uuid, "regionalHub" varchar NOT NULL DEFAULT '', "deliveryAddress" varchar NOT NULL DEFAULT '', "customerPhone" varchar NOT NULL DEFAULT '', "otpCode" varchar NOT NULL DEFAULT '', "otpVerified" boolean NOT NULL DEFAULT false, "proofPhotoUrl" varchar NOT NULL DEFAULT '', "signatureUrl" varchar NOT NULL DEFAULT '', "status" varchar NOT NULL DEFAULT 'PENDING', "deliveredAt" timestamptz, "failureReason" text NOT NULL DEFAULT '', "notes" text NOT NULL DEFAULT '')`);
    await q.query(`CREATE TABLE IF NOT EXISTS "cargo_analytics_snapshots" ("id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "period" varchar NOT NULL, "flightUtilization" double precision NOT NULL DEFAULT 0, "cargoVolumeKg" double precision NOT NULL DEFAULT 0, "averageTransitHours" double precision NOT NULL DEFAULT 0, "customsDelayHours" double precision NOT NULL DEFAULT 0, "routeProfitability" double precision NOT NULL DEFAULT 0, "airlinePerformance" jsonb NOT NULL DEFAULT '{}', "delayHeatmap" jsonb NOT NULL DEFAULT '{}', "airportEfficiency" jsonb NOT NULL DEFAULT '{}')`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "cargo_analytics_snapshots"`);
    await q.query(`DROP TABLE IF EXISTS "cargo_last_mile_deliveries"`);
    await q.query(`DROP TABLE IF EXISTS "cargo_operational_assessments"`);
    await q.query(`DROP TABLE IF EXISTS "cargo_tracking_events"`);
    await q.query(`DROP TABLE IF EXISTS "cargo_customs_flows"`);
  }
}
