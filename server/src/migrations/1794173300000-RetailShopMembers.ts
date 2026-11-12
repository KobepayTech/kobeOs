import { MigrationInterface, QueryRunner } from 'typeorm';

export class RetailShopMembers1794173300000 implements MigrationInterface {
  async up(query: QueryRunner): Promise<void> {
    await query.query(`CREATE TABLE "retail_shop_members" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "shopId" uuid NOT NULL REFERENCES "store_settings"("id") ON DELETE CASCADE,
      "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "role" varchar NOT NULL CHECK ("role" IN ('manager', 'staff')),
      CONSTRAINT "UQ_retail_shop_member" UNIQUE ("shopId", "userId")
    )`);
    await query.query('CREATE INDEX "IDX_retail_shop_member_user" ON "retail_shop_members" ("userId")');
  }

  async down(query: QueryRunner): Promise<void> {
    await query.query('DROP TABLE "retail_shop_members"');
  }
}
