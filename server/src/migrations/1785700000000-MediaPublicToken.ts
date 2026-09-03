import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Uploaded media was served from `/api/media/blob/:id`, which sits behind
 * JwtAuthGuard. An <img>/<video> tag cannot send an Authorization header, so
 * every inline-stored upload rendered broken — in the media box, on products
 * bound to it, and on the public storefront.
 *
 * Give each asset a permanent unguessable token served publicly at
 * /api/media-public/:token, and rewrite existing rows so media that was already
 * uploaded starts displaying instead of staying invisible.
 */
export class MediaPublicToken1785700000000 implements MigrationInterface {
  name = 'MediaPublicToken1785700000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "publicToken" varchar`);

    // Backfill a token for every asset whose bytes live in the database.
    await q.query(`
      UPDATE "media_assets"
         SET "publicToken" = md5(random()::text || clock_timestamp()::text || "id"::text)
                           || md5("id"::text || random()::text)
       WHERE "publicToken" IS NULL
         AND "contentBinary" IS NOT NULL
    `);

    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_media_assets_publicToken" ON "media_assets" ("publicToken")`);

    // Repoint already-stored authenticated URLs at the public token route.
    await q.query(`
      UPDATE "media_assets"
         SET "src" = '/api/media-public/' || "publicToken"
       WHERE "publicToken" IS NOT NULL
         AND "src" LIKE '/api/media/blob/%'
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`
      UPDATE "media_assets"
         SET "src" = '/api/media/blob/' || "id"::text
       WHERE "src" LIKE '/api/media-public/%'
    `);
    await q.query(`DROP INDEX IF EXISTS "UQ_media_assets_publicToken"`);
    await q.query(`ALTER TABLE "media_assets" DROP COLUMN IF EXISTS "publicToken"`);
  }
}
