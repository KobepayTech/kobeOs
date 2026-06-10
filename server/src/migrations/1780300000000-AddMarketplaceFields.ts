import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMarketplaceFields1780300000000 implements MigrationInterface {
  name = 'AddMarketplaceFields1780300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE creators
        ADD COLUMN IF NOT EXISTS "packages" jsonb NOT NULL DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS "reviews" jsonb NOT NULL DEFAULT '[]'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE creators
        DROP COLUMN IF EXISTS "packages",
        DROP COLUMN IF EXISTS "reviews"`,
    );
  }
}
