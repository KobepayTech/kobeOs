import { MigrationInterface, QueryRunner } from 'typeorm';

export class AirRouteCore1780200000000 implements MigrationInterface {
  name = 'AirRouteCore1780200000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await q.query(`CREATE TABLE IF NOT EXISTS "cargo_air_hubs" ("id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "code" varchar NOT NULL, "name" varchar NOT NULL, "country" varchar NOT NULL, "city" varchar NOT NULL DEFAULT '', "type" varchar NOT NULL DEFAULT 'PRIMARY', "delayHours" double precision NOT NULL DEFAULT 0, "reliabilityScore" double precision NOT NULL DEFAULT 100, "active" boolean NOT NULL DEFAULT true, "notes" text NOT NULL DEFAULT '')`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_cargo_air_hubs_owner_code" ON "cargo_air_hubs" ("ownerId", "code")`);
    await q.query(`CREATE TABLE IF NOT EXISTS "cargo_airlines" ("id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "code" varchar NOT NULL, "name" varchar NOT NULL, "contractRef" varchar NOT NULL DEFAULT '', "pricePerKg" double precision NOT NULL DEFAULT 0, "currency" varchar NOT NULL DEFAULT 'USD', "reliabilityScore" double precision NOT NULL DEFAULT 100, "averageDelayHours" double precision NOT NULL DEFAULT 0, "cargoCapacityKg" double precision NOT NULL DEFAULT 0, "active" boolean NOT NULL DEFAULT true, "notes" text NOT NULL DEFAULT '')`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_cargo_airlines_owner_code" ON "cargo_airlines" ("ownerId", "code")`);
    await q.query(`CREATE TABLE IF NOT EXISTS "cargo_air_route_plans" ("id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "routeCode" varchar NOT NULL, "shipmentId" uuid, "priority" varchar NOT NULL DEFAULT 'STANDARD', "origin" varchar NOT NULL, "destination" varchar NOT NULL, "cargoType" varchar NOT NULL DEFAULT '', "weightKg" double precision NOT NULL DEFAULT 0, "hubs" jsonb NOT NULL DEFAULT '[]', "routeSteps" jsonb NOT NULL DEFAULT '[]', "selectedAirline" varchar NOT NULL DEFAULT '', "selectedFlightNumber" varchar NOT NULL DEFAULT '', "estimatedFlightHours" double precision NOT NULL DEFAULT 0, "customsDelayHours" double precision NOT NULL DEFAULT 0, "transitDelayHours" double precision NOT NULL DEFAULT 0, "deliveryHours" double precision NOT NULL DEFAULT 0, "etaHours" double precision NOT NULL DEFAULT 0, "estimatedArrivalAt" timestamptz, "riskLevel" varchar NOT NULL DEFAULT 'LOW', "riskReasons" jsonb NOT NULL DEFAULT '[]', "status" varchar NOT NULL DEFAULT 'PLANNED', "decisionReason" text NOT NULL DEFAULT '', "notes" text NOT NULL DEFAULT '')`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_cargo_air_routes_owner_code" ON "cargo_air_route_plans" ("ownerId", "routeCode")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "cargo_air_route_plans"`);
    await q.query(`DROP TABLE IF EXISTS "cargo_airlines"`);
    await q.query(`DROP TABLE IF EXISTS "cargo_air_hubs"`);
  }
}
