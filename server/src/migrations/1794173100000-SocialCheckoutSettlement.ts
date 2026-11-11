import { MigrationInterface, QueryRunner } from 'typeorm';

export class SocialCheckoutSettlement1794173100000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pos_orders"
      ADD COLUMN "checkoutPaymentState" varchar,
      ADD COLUMN "checkoutPaymentDetails" jsonb,
      ADD COLUMN "checkoutPaymentCheckedAt" timestamptz,
      ADD COLUMN "checkoutPaidAt" timestamptz`);
    await queryRunner.query(`CREATE INDEX "IDX_pos_orders_checkout_reconcile"
      ON "pos_orders" ("checkoutPaymentCheckedAt", "createdAt")
      WHERE "checkoutPaymentState" IN ('PENDING', 'EXPIRED')`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "IDX_pos_orders_checkout_reconcile"');
    await queryRunner.query(`ALTER TABLE "pos_orders"
      DROP COLUMN "checkoutPaymentState",
      DROP COLUMN "checkoutPaymentDetails",
      DROP COLUMN "checkoutPaymentCheckedAt",
      DROP COLUMN "checkoutPaidAt"`);
  }
}
