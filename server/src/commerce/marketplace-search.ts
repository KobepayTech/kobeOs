/**
 * Marketplace product search.
 *
 * The catalogue was previously matched with `LOWER(name) LIKE '%q%'` ordered by
 * `indexedAt DESC`. That has three problems a shopper feels immediately: a
 * leading-wildcard LIKE cannot use an index, so every search scanned the whole
 * snippet table; there is no stemming, so "shoes" misses "shoe"; and the result
 * order was newest-first, which is not relevance — the best match for "fridge"
 * could sit below an unrelated item added yesterday.
 *
 * PostgreSQL full-text search fixes matching and ranking, and pg_trgm covers
 * the case full-text cannot: a misspelling. No extra service to run, and it
 * behaves the same on Neon and on a shop's own machine, which matters because
 * the same code serves both.
 */

/** Columns that make up a product's searchable text, weighted by importance. */
export const SEARCH_VECTOR_SQL = `(
  setweight(to_tsvector('english', coalesce(s.name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(s.category, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(s.description, '')), 'C')
)`;

/**
 * The same expression without table aliases, for the index definition. An
 * expression index is only used when the query's expression matches it
 * exactly, so these two must stay in step — which is why both live here
 * rather than being written out at each call site.
 */
export const SEARCH_VECTOR_INDEX_SQL = `(
  setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(category, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'C')
)`;

export const DEFAULT_LIMIT = 60;
export const MAX_LIMIT = 200;
export const MAX_OFFSET = 2000;
/**
 * Below this word-similarity a "match" is noise rather than a typo.
 *
 * Measured against the real catalogue: "samsng" scores 0.57 against "Samsung
 * Refrigerator" and an unrelated word scores 0.00, so anything in this range
 * separates a misspelling from a coincidence with room to spare.
 *
 * Note this is word_similarity, not similarity. The latter compares whole
 * strings, so a short query against a longer product name scores low however
 * well it matches one word of it — "samsng" against "Samsung Refrigerator"
 * manages only 0.22 and would be rejected.
 */
export const TRIGRAM_THRESHOLD = 0.4;

/**
 * Trim a shopper's query and reject the ones worth no round trip.
 *
 * Returns null when there is nothing to search, so the caller can list the
 * catalogue instead of running a query that matches everything.
 */
export function normalizeQuery(raw: string | undefined | null): string | null {
  const text = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (text.length < 2) return null;
  // Long queries are almost always pasted junk, and tsquery parsing is not free.
  return text.slice(0, 120);
}

export function clampLimit(raw: unknown, fallback = DEFAULT_LIMIT): number {
  const value = Math.floor(Number(raw));
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.min(MAX_LIMIT, value);
}

/**
 * Offset paging, capped. Deep offsets make PostgreSQL walk everything it
 * skips, and nobody reaches page 40 of a shop search — they refine instead.
 */
export function clampOffset(raw: unknown): number {
  const value = Math.floor(Number(raw));
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(MAX_OFFSET, value);
}

export interface PriceRange {
  min: number | null;
  max: number | null;
}

/**
 * Read a price filter, discarding nonsense rather than returning an empty
 * result for it. A reversed range is a mistake, not a request for nothing.
 */
export function parsePriceRange(minRaw: unknown, maxRaw: unknown): PriceRange {
  const num = (value: unknown): number | null => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  };
  let min = num(minRaw);
  let max = num(maxRaw);
  if (min !== null && max !== null && min > max) [min, max] = [max, min];
  return { min, max };
}

export type SortOption = 'relevance' | 'newest' | 'price_asc' | 'price_desc';

export function parseSort(raw: unknown, hasQuery: boolean): SortOption {
  const value = String(raw ?? '').trim().toLowerCase();
  if (value === 'newest' || value === 'price_asc' || value === 'price_desc') return value;
  if (value === 'relevance' && !hasQuery) return 'newest';
  // Relevance is meaningless without a query, so browsing defaults to newest.
  return hasQuery ? 'relevance' : 'newest';
}

export type OrderTerm = [expression: string, direction: 'ASC' | 'DESC'];

/**
 * Ordering terms for a sort option, applied one at a time.
 *
 * Returned as pairs rather than a single clause because TypeORM's `orderBy`
 * appends a direction to whatever string it is given — a combined clause comes
 * out as `... s.id ASC ASC`, which PostgreSQL rejects.
 *
 * Every option ends with the primary key so paging is deterministic: two rows
 * of equal rank or equal price must not swap places between page one and page
 * two, or one is shown twice while another is never shown at all.
 */
export function orderTerms(sort: SortOption): OrderTerm[] {
  switch (sort) {
    case 'newest': return [['s."indexedAt"', 'DESC'], ['s.id', 'ASC']];
    case 'price_asc': return [['s.price', 'ASC'], ['s.id', 'ASC']];
    case 'price_desc': return [['s.price', 'DESC'], ['s.id', 'ASC']];
    case 'relevance':
    default: return [['rank', 'DESC'], ['s."indexedAt"', 'DESC'], ['s.id', 'ASC']];
  }
}

/**
 * Whether to try a fuzzy pass.
 *
 * Two conditions, both necessary.
 *
 * The exact search must have found nothing — trigram matching is looser and
 * would otherwise dilute good full-text results with near-misses.
 *
 * And the query must be a single word. A one-word query that matches nothing
 * is usually a misspelling, so "samsng" should still find the Samsung. A
 * multi-word query that matches nothing is usually a real absence, and
 * matching it loosely is actively misleading: for "red shirt" the fuzzy pass
 * happily returns a blue one, because "shirt" alone scores well. An empty
 * result is the honest answer there, and the shopper can drop a word
 * themselves.
 */
export function shouldTryFuzzy(query: string | null, exactCount: number): boolean {
  if (!query || exactCount !== 0) return false;
  return !query.includes(' ');
}
