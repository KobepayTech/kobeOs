import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds a nullable `negotiatedPrice` column to pos_order_items so the
 * service can persist per-line manager-negotiated discounts. Lets
 * commission / loyalty / per-product margin reports attribute the
 * discount to the correct line instead of estimating from the aggregate
 * order discount.
 */
export class AddPosOrderItemNegotiatedPrice1780500000000 implements MigrationInterface {
  name = 'AddPosOrderItemNegotiatedPrice1780500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pos_order_items" ADD COLUMN IF NOT EXISTS "negotiatedPrice" decimal(18,4)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pos_order_items" DROP COLUMN IF EXISTS "negotiatedPrice"`,
    );
  }
}
