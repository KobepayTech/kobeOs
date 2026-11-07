import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductDiscountReference1794086400000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE "pos_products" ADD COLUMN IF NOT EXISTS "discountReferencePrice" numeric(18,4)');
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE "pos_products" DROP COLUMN IF EXISTS "discountReferencePrice"');
  }
}
