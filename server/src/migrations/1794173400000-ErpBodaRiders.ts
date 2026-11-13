import { MigrationInterface, QueryRunner } from 'typeorm';

export class ErpBodaRiders1794173400000 implements MigrationInterface {
  async up(query: QueryRunner): Promise<void> {
    await query.query(`CREATE TABLE "erp_boda_riders" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "shopId" uuid NOT NULL REFERENCES "store_settings"("id") ON DELETE CASCADE,
      "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "name" varchar NOT NULL,
      "phone" varchar NOT NULL,
      "latitude" double precision,
      "longitude" double precision,
      "locationAt" timestamptz,
      CONSTRAINT "UQ_erp_boda_shop_user" UNIQUE ("shopId", "userId")
    )`);
    await query.query('CREATE INDEX "IDX_erp_boda_shop_location" ON "erp_boda_riders" ("shopId", "locationAt")');
    await query.query('ALTER TABLE "commerce_merchant_orders" ADD COLUMN "deliveryPoint" jsonb');
  }

  async down(query: QueryRunner): Promise<void> {
    await query.query('ALTER TABLE "commerce_merchant_orders" DROP COLUMN "deliveryPoint"');
    await query.query('DROP TABLE "erp_boda_riders"');
  }
}
