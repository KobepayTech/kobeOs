import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductPhotoRepair1789000000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS "photoRepair" jsonb');
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE pos_products DROP COLUMN IF EXISTS "photoRepair"');
  }
}
