import { MigrationInterface, QueryRunner } from 'typeorm';

export class StorefrontCustomerLoyalty1782600000000 implements MigrationInterface {
  name = 'StorefrontCustomerLoyalty1782600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "erp_loyalty_customers" ADD COLUMN IF NOT EXISTS "phoneNormalized" varchar NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "erp_loyalty_customers" ADD COLUMN IF NOT EXISTS "loyaltyCode" varchar NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "erp_loyalty_customers" ADD COLUMN IF NOT EXISTS "signupCouponCode" varchar NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "erp_loyalty_customers" ADD COLUMN IF NOT EXISTS "address" text NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "erp_loyalty_customers" ADD COLUMN IF NOT EXISTS "purchaseCount" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "erp_loyalty_customers" ADD COLUMN IF NOT EXISTS "freeJerseyCredits" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "erp_loyalty_customers" ADD COLUMN IF NOT EXISTS "freeJerseyAwarded" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "erp_loyalty_customers" ADD COLUMN IF NOT EXISTS "lastOrderId" uuid`);

    // Backfill stable member numbers for existing ERP loyalty customers. The
    // UUID-derived portion is collision-resistant and keeps old records usable.
    await queryRunner.query(`
      UPDATE "erp_loyalty_customers"
      SET "loyaltyCode" = 'KJ-' || upper(substr(replace("id"::text, '-', ''), 1, 8))
      WHERE "loyaltyCode" = ''
    `);
    await queryRunner.query(`
      UPDATE "erp_loyalty_customers"
      SET "phoneNormalized" = regexp_replace("phone", '[^0-9]', '', 'g')
      WHERE "phoneNormalized" = '' AND "phone" <> ''
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_owner_phone_normalized" ON "erp_loyalty_customers" ("ownerId", "phoneNormalized")`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_loyalty_code_unique" ON "erp_loyalty_customers" ("loyaltyCode") WHERE "loyaltyCode" <> ''`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_last_order" ON "erp_loyalty_customers" ("lastOrderId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_loyalty_last_order"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_loyalty_code_unique"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_loyalty_owner_phone_normalized"`);
    await queryRunner.query(`ALTER TABLE "erp_loyalty_customers" DROP COLUMN IF EXISTS "lastOrderId"`);
    await queryRunner.query(`ALTER TABLE "erp_loyalty_customers" DROP COLUMN IF EXISTS "freeJerseyAwarded"`);
    await queryRunner.query(`ALTER TABLE "erp_loyalty_customers" DROP COLUMN IF EXISTS "freeJerseyCredits"`);
    await queryRunner.query(`ALTER TABLE "erp_loyalty_customers" DROP COLUMN IF EXISTS "purchaseCount"`);
    await queryRunner.query(`ALTER TABLE "erp_loyalty_customers" DROP COLUMN IF EXISTS "address"`);
    await queryRunner.query(`ALTER TABLE "erp_loyalty_customers" DROP COLUMN IF EXISTS "signupCouponCode"`);
    await queryRunner.query(`ALTER TABLE "erp_loyalty_customers" DROP COLUMN IF EXISTS "loyaltyCode"`);
    await queryRunner.query(`ALTER TABLE "erp_loyalty_customers" DROP COLUMN IF EXISTS "phoneNormalized"`);
  }
}
