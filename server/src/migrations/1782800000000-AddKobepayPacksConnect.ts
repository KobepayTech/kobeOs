import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Kobepay Pro — Phase 3: starter packs (bundled purchase groups) and the
 * Connect API key on merchants.
 */
export class AddKobepayPacksConnect1782800000000 implements MigrationInterface {
  name = 'AddKobepayPacksConnect1782800000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "kp_merchants" ADD COLUMN IF NOT EXISTS "apiKeyHash" character varying NOT NULL DEFAULT ''`);
    await q.query(`ALTER TABLE "kp_merchants" ADD COLUMN IF NOT EXISTS "apiKeyLast4" character varying NOT NULL DEFAULT ''`);

    await q.query(`CREATE TABLE IF NOT EXISTS "kp_starter_packs" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "schoolId" uuid NOT NULL,
      "name" character varying NOT NULL,
      "className" character varying NOT NULL DEFAULT '',
      "description" text NOT NULL DEFAULT '',
      "items" jsonb NOT NULL DEFAULT '[]',
      "active" boolean NOT NULL DEFAULT true,
      CONSTRAINT "PK_kp_starter_packs" PRIMARY KEY ("id"))`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_kp_packs_owner" ON "kp_starter_packs" ("ownerId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_kp_packs_owner_school" ON "kp_starter_packs" ("ownerId","schoolId")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "kp_starter_packs"`);
    await q.query(`ALTER TABLE "kp_merchants" DROP COLUMN IF EXISTS "apiKeyLast4"`);
    await q.query(`ALTER TABLE "kp_merchants" DROP COLUMN IF EXISTS "apiKeyHash"`);
  }
}
