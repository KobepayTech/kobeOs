import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddJerseyDetailsColumn implements MigrationInterface {
  name = 'AddJerseyDetailsColumn1717580000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE pos_products
      ADD COLUMN IF NOT EXISTS "jerseyDetails" jsonb NOT NULL DEFAULT '{}';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE pos_products
      DROP COLUMN IF EXISTS "jerseyDetails";
    `);
  }
}
