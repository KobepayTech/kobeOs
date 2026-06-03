import { MigrationInterface, QueryRunner } from 'typeorm';

export class PropertyManagementComplete1780000000000 implements MigrationInterface {
  name = 'PropertyManagementComplete1780000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await q.query(`ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "city" varchar NOT NULL DEFAULT ''`);
    await q.query(`ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "plotNo" varchar NOT NULL DEFAULT ''`);
    await q.query(`ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "blockNo" varchar NOT NULL DEFAULT ''`);
    await q.query(`ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "notes" text NOT NULL DEFAULT ''`);

    await q.query(`ALTER TABLE "property_units" ADD COLUMN IF NOT EXISTS "type" varchar NOT NULL DEFAULT 'unit'`);
    await q.query(`ALTER TABLE "property_units" ADD COLUMN IF NOT EXISTS "bedrooms" decimal(8,2) NOT NULL DEFAULT 0`);
    await q.query(`ALTER TABLE "property_units" ADD COLUMN IF NOT EXISTS "bathrooms" decimal(8,2) NOT NULL DEFAULT 0`);
    await q.query(`ALTER TABLE "property_units" ADD COLUMN IF NOT EXISTS "sqft" integer NOT NULL DEFAULT 0`);
    await q.query(`ALTER TABLE "property_units" ADD COLUMN IF NOT EXISTS "floor" varchar NOT NULL DEFAULT ''`);
    await q.query(`ALTER TABLE "property_units" ADD COLUMN IF NOT EXISTS "notes" text NOT NULL DEFAULT ''`);

    await q.query(`ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "firstName" varchar NOT NULL DEFAULT ''`);
    await q.query(`ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "middleName" varchar NOT NULL DEFAULT ''`);
    await q.query(`ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "lastName" varchar NOT NULL DEFAULT ''`);
    await q.query(`ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "profilePicUrl" varchar NOT NULL DEFAULT ''`);
    await q.query(`ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "tin" varchar NOT NULL DEFAULT ''`);
    await q.query(`ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "businessLicense" varchar NOT NULL DEFAULT ''`);
    await q.query(`ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "employer" varchar NOT NULL DEFAULT ''`);
    await q.query(`ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "monthlyIncome" decimal(18,4) NOT NULL DEFAULT 0`);
    await q.query(`ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "emergencyContact" varchar NOT NULL DEFAULT ''`);
    await q.query(`ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "shortCode" varchar NOT NULL DEFAULT ''`);
    await q.query(`ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "paymentCode" varchar NOT NULL DEFAULT ''`);
    await q.query(`ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "notes" text NOT NULL DEFAULT ''`);

    await q.query(`ALTER TABLE "rent_payments" ADD COLUMN IF NOT EXISTS "chargeId" uuid`);
    await q.query(`ALTER TABLE "rent_payments" ADD COLUMN IF NOT EXISTS "notes" text NOT NULL DEFAULT ''`);

    await q.query(`CREATE TABLE IF NOT EXISTS "property_leases" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "unitId" uuid NOT NULL,
      "tenantId" uuid NOT NULL,
      "startDate" date NOT NULL,
      "endDate" date NOT NULL,
      "monthlyRent" decimal(18,4) NOT NULL DEFAULT 0,
      "deposit" decimal(18,4) NOT NULL DEFAULT 0,
      "rentDueDay" integer NOT NULL DEFAULT 1,
      "lateFee" decimal(18,4) NOT NULL DEFAULT 0,
      "status" varchar NOT NULL DEFAULT 'active',
      "notes" text NOT NULL DEFAULT ''
    )`);

    await q.query(`CREATE TABLE IF NOT EXISTS "rent_charges" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "leaseId" uuid NOT NULL,
      "tenantId" uuid NOT NULL,
      "unitId" uuid NOT NULL,
      "period" varchar NOT NULL,
      "dueDate" date NOT NULL,
      "amount" decimal(18,4) NOT NULL DEFAULT 0,
      "amountPaid" decimal(18,4) NOT NULL DEFAULT 0,
      "status" varchar NOT NULL DEFAULT 'open',
      "notes" text NOT NULL DEFAULT '',
      CONSTRAINT "UQ_rent_charges_owner_lease_period" UNIQUE ("ownerId", "leaseId", "period")
    )`);

    await q.query(`CREATE TABLE IF NOT EXISTS "property_vendors" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "name" varchar NOT NULL,
      "category" varchar NOT NULL DEFAULT 'general',
      "phone" varchar NOT NULL DEFAULT '',
      "email" varchar NOT NULL DEFAULT '',
      "color" varchar NOT NULL DEFAULT 'blue',
      "notes" text NOT NULL DEFAULT ''
    )`);

    await q.query(`CREATE TABLE IF NOT EXISTS "property_work_orders" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "propertyId" uuid,
      "unitId" uuid,
      "tenantId" uuid,
      "vendorId" uuid,
      "title" varchar NOT NULL,
      "description" text NOT NULL DEFAULT '',
      "priority" varchar NOT NULL DEFAULT 'normal',
      "status" varchar NOT NULL DEFAULT 'open',
      "scheduledAt" timestamptz,
      "completedAt" timestamptz,
      "cost" decimal(18,4) NOT NULL DEFAULT 0,
      "notes" text NOT NULL DEFAULT ''
    )`);

    await q.query(`CREATE TABLE IF NOT EXISTS "property_applications" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "unitId" uuid,
      "firstName" varchar NOT NULL,
      "lastName" varchar NOT NULL DEFAULT '',
      "phone" varchar NOT NULL DEFAULT '',
      "email" varchar NOT NULL DEFAULT '',
      "monthlyIncome" decimal(18,4) NOT NULL DEFAULT 0,
      "employer" varchar NOT NULL DEFAULT '',
      "desiredMoveIn" date,
      "status" varchar NOT NULL DEFAULT 'new',
      "notes" text NOT NULL DEFAULT ''
    )`);

    await q.query(`CREATE TABLE IF NOT EXISTS "property_settings" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "key" varchar NOT NULL,
      "value" text NOT NULL,
      CONSTRAINT "UQ_property_settings_owner_key" UNIQUE ("ownerId", "key")
    )`);

    await q.query(`CREATE TABLE IF NOT EXISTS "property_expenses" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "propertyId" uuid,
      "unitId" uuid,
      "title" varchar NOT NULL,
      "category" varchar NOT NULL DEFAULT 'general',
      "amount" decimal(18,4) NOT NULL DEFAULT 0,
      "currency" varchar NOT NULL DEFAULT 'TZS',
      "spentAt" date NOT NULL,
      "notes" text NOT NULL DEFAULT ''
    )`);

    await q.query(`CREATE TABLE IF NOT EXISTS "rent_increase_simulations" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "propertyId" uuid,
      "increasePercent" decimal(10,4) NOT NULL DEFAULT 0,
      "currentMonthlyRent" decimal(18,4) NOT NULL DEFAULT 0,
      "projectedMonthlyRent" decimal(18,4) NOT NULL DEFAULT 0,
      "monthlyDifference" decimal(18,4) NOT NULL DEFAULT 0,
      "annualDifference" decimal(18,4) NOT NULL DEFAULT 0,
      "notes" text NOT NULL DEFAULT ''
    )`);

    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_property_leases_owner" ON "property_leases" ("ownerId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_rent_charges_owner_period" ON "rent_charges" ("ownerId", "period")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_property_work_orders_owner_status" ON "property_work_orders" ("ownerId", "status")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_property_expenses_owner_property" ON "property_expenses" ("ownerId", "propertyId")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "rent_increase_simulations"`);
    await q.query(`DROP TABLE IF EXISTS "property_expenses"`);
    await q.query(`DROP TABLE IF EXISTS "property_settings"`);
    await q.query(`DROP TABLE IF EXISTS "property_applications"`);
    await q.query(`DROP TABLE IF EXISTS "property_work_orders"`);
    await q.query(`DROP TABLE IF EXISTS "property_vendors"`);
    await q.query(`DROP TABLE IF EXISTS "rent_charges"`);
    await q.query(`DROP TABLE IF EXISTS "property_leases"`);
  }
}
