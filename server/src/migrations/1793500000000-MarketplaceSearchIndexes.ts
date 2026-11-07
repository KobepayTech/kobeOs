import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Indexes for marketplace product search.
 *
 * The catalogue was matched with a leading-wildcard LIKE, which no index can
 * serve, so every shopper's search scanned the whole snippet table. These give
 * full-text search something to use, and trigram matching something to fall
 * back on for misspellings.
 *
 * Every statement is individually guarded. TypeORM runs the whole pending set
 * in one transaction, so a single statement that throws rolls back the batch
 * and the instance never boots again — a search index is not worth that risk.
 * In particular pg_trgm may not be installable by the connecting role, so the
 * extension is attempted separately and the index that needs it is created
 * only if it arrived.
 */
export class MarketplaceSearchIndexes1793500000000 implements MigrationInterface {
  name = 'MarketplaceSearchIndexes1793500000000';

  public async up(q: QueryRunner): Promise<void> {
    const [{ present }] = await q.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'commerce_product_snippets'
      ) AS present
    `);
    if (!present) return;

    // Weighted full-text vector: name matters more than category, which
    // matters more than the description. Must stay identical to
    // SEARCH_VECTOR_INDEX_SQL in marketplace-search.ts or the planner will
    // ignore this index.
    await q.query(`
      CREATE INDEX IF NOT EXISTS "commerce_snippet_fts"
        ON "commerce_product_snippets" USING GIN ((
          setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(category, '')), 'B') ||
          setweight(to_tsvector('english', coalesce(description, '')), 'C')
        ))
    `);

    // Narrow partial index for browsing without a query, which is the common
    // first page of a marketplace.
    await q.query(`
      CREATE INDEX IF NOT EXISTS "commerce_snippet_browse"
        ON "commerce_product_snippets" ("indexedAt" DESC)
        WHERE active = true AND stock > 0
    `);

    // pg_trgm is optional. A managed database may refuse it, and typo
    // tolerance is a nicety — losing it must not cost the deployment its
    // schema.
    let trigrams = false;
    try {
      await q.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
      trigrams = true;
    } catch {
      trigrams = false;
    }
    if (!trigrams) {
      const [{ installed }] = await q.query(`
        SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') AS installed
      `);
      trigrams = Boolean(installed);
    }
    if (trigrams) {
      await q.query(`
        CREATE INDEX IF NOT EXISTS "commerce_snippet_name_trgm"
          ON "commerce_product_snippets" USING GIN (name gin_trgm_ops)
      `);
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query('DROP INDEX IF EXISTS "commerce_snippet_name_trgm"');
    await q.query('DROP INDEX IF EXISTS "commerce_snippet_browse"');
    await q.query('DROP INDEX IF EXISTS "commerce_snippet_fts"');
    // pg_trgm is left installed: other things may have come to depend on it,
    // and dropping an extension is not this migration's business to undo.
  }
}
