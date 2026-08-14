import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Kobepay Pro — Phase 2: bulk purchase groups with escrow.
 * Suppliers, purchase groups and per-participant group orders.
 */
export class AddKobepayGroups1782700000000 implements MigrationInterface {
  name = 'AddKobepayGroups1782700000000';

  public async up(q: QueryRunner): Promise<void> {
    const owned = `
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL`;

    await q.query(`CREATE TABLE IF NOT EXISTS "kp_suppliers" (${owned},
      "name" character varying NOT NULL,
      "code" character varying NOT NULL,
      "contactPhone" character varying NOT NULL DEFAULT '',
      "contactEmail" character varying NOT NULL DEFAULT '',
      "settlementAccount" character varying NOT NULL DEFAULT '',
      "settlementMethod" character varying NOT NULL DEFAULT 'mobile',
      "portalToken" character varying NOT NULL,
      "status" character varying NOT NULL DEFAULT 'ACTIVE',
      CONSTRAINT "PK_kp_suppliers" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_kp_supplier_portal" UNIQUE ("portalToken"))`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_kp_suppliers_owner" ON "kp_suppliers" ("ownerId")`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_kp_suppliers_owner_code" ON "kp_suppliers" ("ownerId","code")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_kp_suppliers_token" ON "kp_suppliers" ("portalToken")`);

    await q.query(`CREATE TABLE IF NOT EXISTS "kp_purchase_groups" (${owned},
      "schoolId" uuid NOT NULL,
      "reference" character varying(16) NOT NULL,
      "title" character varying NOT NULL,
      "productName" character varying NOT NULL DEFAULT '',
      "description" text NOT NULL DEFAULT '',
      "imageUrl" character varying NOT NULL DEFAULT '',
      "normalPrice" numeric(18,4) NOT NULL DEFAULT 0,
      "groupPrice" numeric(18,4) NOT NULL DEFAULT 0,
      "currency" character varying NOT NULL DEFAULT 'TZS',
      "minParticipants" integer NOT NULL DEFAULT 1,
      "deadline" timestamptz,
      "deliveryLocation" character varying NOT NULL DEFAULT '',
      "supplierId" uuid,
      "supplierUnitCost" numeric(18,4) NOT NULL DEFAULT 0,
      "status" character varying NOT NULL DEFAULT 'OPEN',
      "orderedAt" timestamptz,
      "deliveredAt" timestamptz,
      "verifiedAt" timestamptz,
      "completedAt" timestamptz,
      CONSTRAINT "PK_kp_purchase_groups" PRIMARY KEY ("id"))`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_kp_groups_owner" ON "kp_purchase_groups" ("ownerId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_kp_groups_owner_school_status" ON "kp_purchase_groups" ("ownerId","schoolId","status")`);

    await q.query(`CREATE TABLE IF NOT EXISTS "kp_group_orders" (${owned},
      "groupId" uuid NOT NULL,
      "schoolId" uuid NOT NULL,
      "studentId" uuid NOT NULL,
      "reference" character varying(16) NOT NULL,
      "qty" integer NOT NULL DEFAULT 1,
      "unitPrice" numeric(18,4) NOT NULL DEFAULT 0,
      "amount" numeric(18,4) NOT NULL DEFAULT 0,
      "holdId" uuid,
      "status" character varying NOT NULL DEFAULT 'RESERVED',
      "collectedAt" timestamptz,
      "collectedBy" character varying NOT NULL DEFAULT '',
      CONSTRAINT "PK_kp_group_orders" PRIMARY KEY ("id"))`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_kp_group_orders_owner" ON "kp_group_orders" ("ownerId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_kp_group_orders_owner_group" ON "kp_group_orders" ("ownerId","groupId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_kp_group_orders_owner_student" ON "kp_group_orders" ("ownerId","studentId")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "kp_group_orders"`);
    await q.query(`DROP TABLE IF EXISTS "kp_purchase_groups"`);
    await q.query(`DROP TABLE IF EXISTS "kp_suppliers"`);
  }
}
