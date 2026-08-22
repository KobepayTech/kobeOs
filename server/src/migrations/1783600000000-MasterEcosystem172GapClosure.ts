import { MigrationInterface, QueryRunner } from 'typeorm';

/** Additive, idempotent closure for installations that ran the first master migration early. */
export class MasterEcosystem172GapClosure1783600000000 implements MigrationInterface {
  name = 'MasterEcosystem172GapClosure1783600000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "hotel_tenants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "slug" varchar NOT NULL, "name" varchar NOT NULL, "brandColor" varchar, "logoUrl" varchar, "currency" varchar NOT NULL DEFAULT 'TZS', "location" varchar NOT NULL DEFAULT '', "phone" varchar NOT NULL DEFAULT '', "email" varchar NOT NULL DEFAULT '', CONSTRAINT "PK_hotel_tenants" PRIMARY KEY ("id"))`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_hotel_tenants_slug" ON "hotel_tenants" ("slug")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_hotel_tenants_owner" ON "hotel_tenants" ("ownerId")`);
    await q.query(`CREATE TABLE IF NOT EXISTS "transit_bus_operator_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "busId" uuid NOT NULL, "operatorId" uuid NOT NULL, "effectiveFrom" timestamptz NOT NULL, "effectiveTo" timestamptz, "reason" varchar NOT NULL DEFAULT '', "changedBy" varchar NOT NULL DEFAULT '', CONSTRAINT "PK_transit_bus_operator_history" PRIMARY KEY ("id"))`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_transit_bus_operator_history" ON "transit_bus_operator_history" ("ownerId","busId","effectiveFrom")`);
    const statements = [
      `ALTER TABLE IF EXISTS "commerce_nodes" ADD COLUMN IF NOT EXISTS "endpoint" varchar NOT NULL DEFAULT ''`,
      `ALTER TABLE IF EXISTS "commerce_nodes" ADD COLUMN IF NOT EXISTS "catalogueVersion" varchar NOT NULL DEFAULT ''`,
      `ALTER TABLE IF EXISTS "commerce_product_snippets" ADD COLUMN IF NOT EXISTS "nodeId" uuid`,
      `ALTER TABLE IF EXISTS "commerce_product_snippets" ADD COLUMN IF NOT EXISTS "merchantWebsite" varchar NOT NULL DEFAULT ''`,
      `ALTER TABLE IF EXISTS "commerce_product_snippets" ADD COLUMN IF NOT EXISTS "locationLabel" varchar NOT NULL DEFAULT ''`,
      `ALTER TABLE IF EXISTS "commerce_product_snippets" ADD COLUMN IF NOT EXISTS "lastOnlineAt" timestamptz`,
      `ALTER TABLE IF EXISTS "commerce_product_snippets" ADD COLUMN IF NOT EXISTS "availabilityHint" varchar NOT NULL DEFAULT ''`,
      `ALTER TABLE IF EXISTS "commerce_vehicles" ADD COLUMN IF NOT EXISTS "interiorColor" varchar NOT NULL DEFAULT ''`,
      `ALTER TABLE IF EXISTS "commerce_vehicles" ADD COLUMN IF NOT EXISTS "engine" varchar NOT NULL DEFAULT ''`,
      `ALTER TABLE IF EXISTS "commerce_vehicles" ADD COLUMN IF NOT EXISTS "driveType" varchar NOT NULL DEFAULT ''`,
      `ALTER TABLE IF EXISTS "commerce_vehicles" ADD COLUMN IF NOT EXISTS "bodyType" varchar NOT NULL DEFAULT ''`,
      `ALTER TABLE IF EXISTS "commerce_vehicles" ADD COLUMN IF NOT EXISTS "vin" varchar NOT NULL DEFAULT ''`,
      `ALTER TABLE IF EXISTS "commerce_vehicles" ADD COLUMN IF NOT EXISTS "registration" varchar NOT NULL DEFAULT ''`,
      `ALTER TABLE IF EXISTS "commerce_vehicles" ADD COLUMN IF NOT EXISTS "dutyStatus" varchar NOT NULL DEFAULT ''`,
      `ALTER TABLE IF EXISTS "commerce_vehicles" ADD COLUMN IF NOT EXISTS "source" varchar NOT NULL DEFAULT 'LOCAL'`,
      `ALTER TABLE IF EXISTS "commerce_vehicles" ADD COLUMN IF NOT EXISTS "financingAvailable" boolean NOT NULL DEFAULT false`,
      `ALTER TABLE IF EXISTS "commerce_vehicles" ADD COLUMN IF NOT EXISTS "negotiable" boolean NOT NULL DEFAULT false`,
      `ALTER TABLE IF EXISTS "commerce_vehicles" ADD COLUMN IF NOT EXISTS "features" jsonb NOT NULL DEFAULT '[]'::jsonb`,
      `ALTER TABLE IF EXISTS "commerce_vehicle_listing_metadata" ADD COLUMN IF NOT EXISTS "purchaseCost" decimal(18,2) NOT NULL DEFAULT 0`,
      `ALTER TABLE IF EXISTS "commerce_vehicle_listing_metadata" ADD COLUMN IF NOT EXISTS "dutyCost" decimal(18,2) NOT NULL DEFAULT 0`,
      `ALTER TABLE IF EXISTS "commerce_vehicle_listing_metadata" ADD COLUMN IF NOT EXISTS "clearingCost" decimal(18,2) NOT NULL DEFAULT 0`,
      `ALTER TABLE IF EXISTS "commerce_vehicle_listing_metadata" ADD COLUMN IF NOT EXISTS "transportCost" decimal(18,2) NOT NULL DEFAULT 0`,
      `ALTER TABLE IF EXISTS "commerce_vehicle_listing_metadata" ADD COLUMN IF NOT EXISTS "repairCost" decimal(18,2) NOT NULL DEFAULT 0`,
      `ALTER TABLE IF EXISTS "commerce_vehicle_listing_metadata" ADD COLUMN IF NOT EXISTS "advertisingCost" decimal(18,2) NOT NULL DEFAULT 0`,
      `ALTER TABLE IF EXISTS "commerce_vehicle_buyer_requests" ADD COLUMN IF NOT EXISTS "customerWhatsapp" varchar NOT NULL DEFAULT ''`,
      `ALTER TABLE IF EXISTS "commerce_vehicle_buyer_requests" ADD COLUMN IF NOT EXISTS "requestType" varchar NOT NULL DEFAULT 'OUTRIGHT'`,
      `ALTER TABLE IF EXISTS "commerce_vehicle_buyer_requests" ADD COLUMN IF NOT EXISTS "offerAmount" decimal(18,2)`,
      `ALTER TABLE IF EXISTS "commerce_vehicle_buyer_requests" ADD COLUMN IF NOT EXISTS "preferredContact" varchar NOT NULL DEFAULT 'PHONE'`,
      `ALTER TABLE IF EXISTS "commerce_vehicle_buyer_requests" ADD COLUMN IF NOT EXISTS "tradeInDetails" text NOT NULL DEFAULT ''`,
      `ALTER TABLE IF EXISTS "lala_hotel_loyalty_programs" ADD COLUMN IF NOT EXISTS "programType" varchar NOT NULL DEFAULT 'POINTS'`,
      `ALTER TABLE IF EXISTS "lala_hotel_loyalty_programs" ADD COLUMN IF NOT EXISTS "expiryDays" integer NOT NULL DEFAULT 365`,
      `ALTER TABLE IF EXISTS "lala_hotel_loyalty_programs" ADD COLUMN IF NOT EXISTS "eligibility" jsonb NOT NULL DEFAULT '{}'::jsonb`,
    ];
    for (const statement of statements) await q.query(statement);
  }

  public async down(): Promise<void> {
    // Deliberately non-destructive: these fields contain catalogue, buyer and cost audit data.
  }
}
