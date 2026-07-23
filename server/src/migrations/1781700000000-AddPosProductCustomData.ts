import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds pos_products.customData (jsonb) for free-form product metadata used by
 *  the bulk media→product workflow (supplier, cost, sizes, colours, etc.). */
export class AddPosProductCustomData1781700000000 implements MigrationInterface {
  name = 'AddPosProductCustomData1781700000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "pos_products" ADD COLUMN IF NOT EXISTS "customData" jsonb NOT NULL DEFAULT '{}'::jsonb`);
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "pos_products" DROP COLUMN IF EXISTS "customData"`);
  }
}
