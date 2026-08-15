import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds the audit field used to distinguish PO receiving from Quick Add. */
export class AddProductSourceType1783100000000 implements MigrationInterface {
  name = 'AddProductSourceType1783100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pos_products"
      ADD COLUMN IF NOT EXISTS "source_type" character varying(32)
      NOT NULL DEFAULT 'QUICK_ADD_IMPORT'
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pos_products_source_type"
      ON "pos_products" ("source_type")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_pos_products_source_type"`);
    await queryRunner.query(`ALTER TABLE "pos_products" DROP COLUMN IF EXISTS "source_type"`);
  }
}
