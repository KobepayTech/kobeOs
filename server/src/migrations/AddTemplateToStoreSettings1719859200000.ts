import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add `template` column to store_settings so the storefront preview
 * template choice ('generic' | 'jerseys') is persisted across reloads.
 *
 * Before this migration the frontend sent `template` in the PUT body,
 * but ValidationPipe with `whitelist: true` silently stripped it — so
 * the setting was lost on every save and the preview always reverted to
 * 'generic'.
 */
export class AddTemplateToStoreSettings1719859200000 implements MigrationInterface {
  name = 'AddTemplateToStoreSettings1719859200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "template" character varying NOT NULL DEFAULT 'generic'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "store_settings" DROP COLUMN IF EXISTS "template"`
    );
  }
}
