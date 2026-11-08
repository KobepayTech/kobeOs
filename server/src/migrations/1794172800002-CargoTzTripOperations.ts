import { MigrationInterface, QueryRunner } from 'typeorm';

export class CargoTzTripOperations1794172800002 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    const owned = '"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "ownerId" uuid NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now()';
    await q.query(`CREATE TABLE "ctz_operators" (${owned}, "accountId" uuid NOT NULL, "role" varchar NOT NULL, "branch" varchar NOT NULL, "branchKey" varchar NOT NULL, "name" varchar NOT NULL)`);
    await q.query('CREATE UNIQUE INDEX "UQ_ctz_operator_role" ON "ctz_operators" ("ownerId","accountId","role","branchKey")');
    await q.query('CREATE INDEX "IDX_ctz_operator_account" ON "ctz_operators" ("accountId")');
    await q.query(`CREATE TABLE "ctz_trips" (${owned}, "origin" varchar NOT NULL, "plate" varchar NOT NULL, "plateKey" varchar NOT NULL, "vehicleType" varchar NOT NULL, "operator" varchar NOT NULL, "status" varchar NOT NULL, "stops" jsonb NOT NULL, "sealedAt" timestamptz, "departedAt" timestamptz)`);
    await q.query('CREATE INDEX "IDX_ctz_trip_owner_status" ON "ctz_trips" ("ownerId","status")');
    await q.query(`CREATE UNIQUE INDEX "UQ_ctz_trip_active_plate" ON "ctz_trips" ("ownerId","plateKey") WHERE "status" IN ('LOADING','LOADED','IN_TRANSIT')`);
    await q.query(`CREATE TABLE "ctz_pickups" (${owned}, "shipmentKey" varchar NOT NULL, "codeHash" varchar NOT NULL, "attempts" integer NOT NULL DEFAULT 0, "lockedUntil" timestamptz, "collectedAt" timestamptz)`);
    await q.query('CREATE UNIQUE INDEX "UQ_ctz_pickup_shipment" ON "ctz_pickups" ("ownerId","shipmentKey")');
    await q.query(`CREATE TABLE "ctz_sms_outbox" (${owned}, "tripId" uuid NOT NULL, "branchKey" varchar NOT NULL, "eventKey" varchar NOT NULL, "phone" varchar NOT NULL, "body" text NOT NULL, "attempts" integer NOT NULL DEFAULT 0, "nextAttemptAt" timestamptz NOT NULL, "sentAt" timestamptz)`);
    await q.query('CREATE UNIQUE INDEX "UQ_ctz_sms_event" ON "ctz_sms_outbox" ("ownerId","eventKey")');
    await q.query('CREATE INDEX "IDX_ctz_sms_due" ON "ctz_sms_outbox" ("nextAttemptAt") WHERE "sentAt" IS NULL');
    await q.query(`CREATE TABLE "ctz_tracking_challenges" (${owned}, "shipmentKey" varchar NOT NULL, "codeHash" varchar, "sentAt" timestamptz, "expiresAt" timestamptz, "windowStart" timestamptz, "attempts" integer NOT NULL DEFAULT 0, "sends" integer NOT NULL DEFAULT 0)`);
    await q.query('CREATE UNIQUE INDEX "UQ_ctz_tracking_challenge" ON "ctz_tracking_challenges" ("ownerId","shipmentKey")');
    await q.query(`ALTER TABLE "ctz_parcels" ADD "tripId" uuid REFERENCES "ctz_trips" ("id"), ADD "loadedAt" timestamptz,
      ADD "unloadedAt" timestamptz, ADD "arrivalIssue" varchar NOT NULL DEFAULT ''`);
    await q.query('CREATE INDEX "IDX_ctz_parcel_trip" ON "ctz_parcels" ("tripId")');
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE "ctz_parcels" DROP "tripId", DROP "loadedAt", DROP "unloadedAt", DROP "arrivalIssue"');
    for (const table of ['ctz_tracking_challenges', 'ctz_sms_outbox', 'ctz_pickups', 'ctz_trips', 'ctz_operators']) await q.query(`DROP TABLE "${table}"`);
  }
}
