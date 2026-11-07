import { MigrationInterface, QueryRunner } from 'typeorm';
export class PropertyIntelligenceFoundation1792756800000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    const base = `id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "ownerId" uuid NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now()`;
    const tables: Record<string, string> = {
      property_assets: `"propertyId" uuid NOT NULL, "unitId" uuid, name varchar NOT NULL, category varchar NOT NULL DEFAULT 'general', "lastServiced" date NOT NULL, "intervalDays" integer NOT NULL DEFAULT 90 CHECK ("intervalDays" > 0)`,
      property_utility_bills: `"unitId" uuid NOT NULL, "tenantId" uuid NOT NULL, kind varchar NOT NULL, period varchar NOT NULL, "previousReading" numeric(18,4) NOT NULL, "currentReading" numeric(18,4) NOT NULL, "unitRate" numeric(18,4) NOT NULL, amount numeric(18,4) NOT NULL, currency varchar NOT NULL DEFAULT 'TZS', "dueDate" date NOT NULL, status varchar NOT NULL DEFAULT 'open', "paymentReference" varchar NOT NULL DEFAULT '', UNIQUE ("ownerId", "unitId", kind, period), CHECK ("currentReading" >= "previousReading" AND "unitRate" >= 0 AND amount >= 0)`,
      property_inspections: `"unitId" uuid NOT NULL, kind varchar NOT NULL, "inspectedAt" date NOT NULL, items jsonb NOT NULL DEFAULT '[]', notes varchar NOT NULL DEFAULT ''`,
      property_deposit_entries: `"leaseId" uuid NOT NULL, "requestKey" uuid NOT NULL, kind varchar NOT NULL, amount numeric(18,4) NOT NULL CHECK (amount > 0), currency varchar NOT NULL, reference varchar NOT NULL, reason text NOT NULL DEFAULT '', UNIQUE ("ownerId", "requestKey")`,
      property_portal_access: `"tenantId" uuid NOT NULL, "tokenHash" varchar NOT NULL UNIQUE, "expiresAt" timestamptz NOT NULL, revoked boolean NOT NULL DEFAULT false`,
      property_operations: `key varchar NOT NULL, kind varchar NOT NULL, status varchar NOT NULL DEFAULT 'pending', payload jsonb NOT NULL DEFAULT '{}', result jsonb NOT NULL DEFAULT '{}', UNIQUE ("ownerId", key)`,
    };
    for (const [table, columns] of Object.entries(tables)) {
      await q.query(`CREATE TABLE IF NOT EXISTS "${table}" (${base}, ${columns})`);
      await q.query(`CREATE INDEX IF NOT EXISTS "${table}_owner" ON "${table}" ("ownerId")`);
    }
    await q.query(`ALTER TABLE property_units ADD COLUMN IF NOT EXISTS "vacancyPublished" boolean NOT NULL DEFAULT false`);
    await q.query(`CREATE INDEX IF NOT EXISTS property_vacancy_discovery ON property_units (status) WHERE "vacancyPublished" = true`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS property_vacancy_discovery`);
    await q.query(`ALTER TABLE property_units DROP COLUMN IF EXISTS "vacancyPublished"`);
    for (const table of ['property_operations', 'property_portal_access', 'property_deposit_entries', 'property_inspections', 'property_utility_bills', 'property_assets']) await q.query(`DROP TABLE IF EXISTS "${table}"`);
  }
}
