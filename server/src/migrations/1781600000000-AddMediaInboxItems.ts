import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMediaInboxItems1781600000000 implements MigrationInterface {
  name = 'AddMediaInboxItems1781600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "media_inbox_items" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "assetId" uuid NOT NULL,
      "sha256" varchar(64) NOT NULL,
      "originalName" varchar NOT NULL,
      "mimeType" varchar NOT NULL,
      "sizeBytes" bigint NOT NULL,
      "width" integer,
      "height" integer,
      "url" varchar NOT NULL,
      "status" varchar NOT NULL DEFAULT 'UNPROCESSED',
      "folder" varchar NOT NULL DEFAULT 'unprocessed',
      "moduleId" varchar NOT NULL DEFAULT '',
      "entityType" varchar NOT NULL DEFAULT '',
      "entityId" uuid,
      "category" varchar NOT NULL DEFAULT '',
      "subcategory" varchar NOT NULL DEFAULT '',
      "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "aiSuggestions" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "error" varchar NOT NULL DEFAULT '',
      "processedAt" timestamptz
    )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_media_inbox_owner_status" ON "media_inbox_items" ("ownerId", "status", "createdAt")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_media_inbox_owner_sha" ON "media_inbox_items" ("ownerId", "sha256")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_media_inbox_owner_module" ON "media_inbox_items" ("ownerId", "moduleId", "entityType")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "media_inbox_items"');
  }
}
