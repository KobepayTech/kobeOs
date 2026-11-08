import { MigrationInterface, QueryRunner } from 'typeorm';

export class CargoTzCollectorHandoff1794172800001 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "ctz_collector_access" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "ownerId" uuid NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "companyName" varchar NOT NULL,
      "agentName" varchar NOT NULL,
      "agentPhone" varchar NOT NULL,
      "tokenHash" varchar NOT NULL,
      "collectorId" uuid,
      "expiresAt" timestamptz NOT NULL,
      "revokedAt" timestamptz
    )`);
    await q.query('CREATE INDEX "IDX_ctz_collector_owner" ON "ctz_collector_access" ("ownerId")');
    await q.query('CREATE UNIQUE INDEX "IDX_ctz_collector_token" ON "ctz_collector_access" ("tokenHash")');
    await q.query('CREATE INDEX "IDX_ctz_collector_account" ON "ctz_collector_access" ("collectorId")');
    await q.query(`ALTER TABLE "ctz_parcels"
      ADD "collectionId" uuid,
      ADD "collectorAccessId" uuid,
      ADD "cartonNumber" integer NOT NULL DEFAULT 1,
      ADD "cartonCount" integer NOT NULL DEFAULT 1,
      ADD "lengthCm" double precision,
      ADD "widthCm" double precision,
      ADD "heightCm" double precision`);
    await q.query('CREATE INDEX "IDX_ctz_parcel_collection" ON "ctz_parcels" ("collectionId")');
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP INDEX "IDX_ctz_parcel_collection"');
    await q.query(`ALTER TABLE "ctz_parcels"
      DROP "collectionId", DROP "collectorAccessId", DROP "cartonNumber", DROP "cartonCount",
      DROP "lengthCm", DROP "widthCm", DROP "heightCm"`);
    await q.query('DROP TABLE "ctz_collector_access"');
  }
}
