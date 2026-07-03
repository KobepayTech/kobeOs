import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddJerseyDetailsColumn1780700000000 implements MigrationInterface {
  name = 'AddJerseyDetailsColumn1780700000000';

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
