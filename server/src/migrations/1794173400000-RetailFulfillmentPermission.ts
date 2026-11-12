import { MigrationInterface, QueryRunner } from 'typeorm';

export class RetailFulfillmentPermission1794173400000 implements MigrationInterface {
  async up(query: QueryRunner): Promise<void> {
    await query.query('ALTER TABLE "retail_shop_members" ADD COLUMN "canFulfill" boolean NOT NULL DEFAULT false');
  }

  async down(query: QueryRunner): Promise<void> {
    await query.query('ALTER TABLE "retail_shop_members" DROP COLUMN "canFulfill"');
  }
}
