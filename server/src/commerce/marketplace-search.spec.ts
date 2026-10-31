import {
  DEFAULT_LIMIT, MAX_LIMIT, MAX_OFFSET, SEARCH_VECTOR_INDEX_SQL, SEARCH_VECTOR_SQL,
  clampLimit, clampOffset, normalizeQuery, orderTerms, parsePriceRange, parseSort,
  shouldTryFuzzy,
} from './marketplace-search';

describe('normalizeQuery', () => {
  it('collapses whitespace and trims', () => {
    expect(normalizeQuery('  red   running  shoe ')).toBe('red running shoe');
  });

  it('treats a single character as nothing to search', () => {
    // Matching on one letter returns most of the catalogue, which is a slow
    // way of showing the shopper nothing useful.
    expect(normalizeQuery('a')).toBeNull();
    expect(normalizeQuery(' ')).toBeNull();
    expect(normalizeQuery('')).toBeNull();
    expect(normalizeQuery(undefined)).toBeNull();
    expect(normalizeQuery(null)).toBeNull();
  });

  it('keeps two characters, which is a real query', () => {
    expect(normalizeQuery('tv')).toBe('tv');
  });

  it('caps a pasted wall of text', () => {
    expect(normalizeQuery('x'.repeat(500))).toHaveLength(120);
  });
});

describe('clampLimit', () => {
  it('falls back for junk', () => {
    for (const bad of [undefined, null, 'abc', 0, -5, NaN]) {
      expect(clampLimit(bad)).toBe(DEFAULT_LIMIT);
    }
  });

  it('accepts a sensible page size', () => {
    expect(clampLimit('24')).toBe(24);
    expect(clampLimit(1)).toBe(1);
  });

  it('caps the page size so one request cannot ask for the catalogue', () => {
    expect(clampLimit(100000)).toBe(MAX_LIMIT);
  });
});

describe('clampOffset', () => {
  it('treats junk and negatives as the first page', () => {
    for (const bad of [undefined, 'abc', -1, NaN]) expect(clampOffset(bad)).toBe(0);
  });

  it('caps deep paging', () => {
    // A deep offset makes PostgreSQL walk everything it skips, and nobody
    // reaches page 40 of a shop search — they refine the query instead.
    expect(clampOffset(999999)).toBe(MAX_OFFSET);
  });
});

describe('parsePriceRange', () => {
  it('reads both bounds', () => {
    expect(parsePriceRange('1000', '5000')).toEqual({ min: 1000, max: 5000 });
  });

  it('ignores unusable bounds rather than returning nothing', () => {
    expect(parsePriceRange('abc', undefined)).toEqual({ min: null, max: null });
    expect(parsePriceRange('-10', '5000')).toEqual({ min: null, max: 5000 });
  });

  it('corrects a reversed range instead of matching nothing', () => {
    // min above max is a mistake, not a request for an empty page.
    expect(parsePriceRange('5000', '1000')).toEqual({ min: 1000, max: 5000 });
  });

  it('allows a zero lower bound', () => {
    expect(parsePriceRange('0', '100')).toEqual({ min: 0, max: 100 });
  });
});

describe('parseSort', () => {
  it('honours an explicit choice', () => {
    expect(parseSort('price_asc', true)).toBe('price_asc');
    expect(parseSort('PRICE_DESC', true)).toBe('price_desc');
    expect(parseSort('newest', false)).toBe('newest');
  });

  it('defaults to relevance when there is a query', () => {
    expect(parseSort(undefined, true)).toBe('relevance');
  });

  it('defaults to newest when browsing, since relevance means nothing', () => {
    expect(parseSort(undefined, false)).toBe('newest');
    expect(parseSort('relevance', false)).toBe('newest');
  });

  it('falls back rather than failing on an unknown value', () => {
    expect(parseSort('cheapest-ish', true)).toBe('relevance');
  });
});

describe('orderTerms', () => {
  it('always ends with the primary key so paging cannot repeat or skip a row', () => {
    // Two rows of equal rank or equal price must not swap places between
    // page one and page two.
    for (const sort of ['relevance', 'newest', 'price_asc', 'price_desc'] as const) {
      expect(orderTerms(sort).at(-1)).toEqual(['s.id', 'ASC']);
    }
  });

  it('ranks first when sorting by relevance', () => {
    expect(orderTerms('relevance')[0]).toEqual(['rank', 'DESC']);
  });

  it('does not mention rank when relevance was not asked for', () => {
    for (const sort of ['newest', 'price_asc', 'price_desc'] as const) {
      expect(orderTerms(sort).map(([e]) => e)).not.toContain('rank');
    }
  });

  it('carries a direction per term, because a combined clause breaks the query', () => {
    // TypeORM appends a direction to whatever string orderBy is given, so a
    // single "a DESC, b ASC" clause becomes "... b ASC ASC" and PostgreSQL
    // rejects it. That is how the first version of this failed.
    for (const [expression, direction] of orderTerms('relevance')) {
      expect(expression).not.toMatch(/\b(ASC|DESC)\b/);
      expect(['ASC', 'DESC']).toContain(direction);
    }
  });
});

describe('shouldTryFuzzy', () => {
  it('only runs a second query when the first found nothing', () => {
    expect(shouldTryFuzzy('samsng', 0)).toBe(true);
    expect(shouldTryFuzzy('samsung', 5)).toBe(false);
  });

  it('never runs while browsing', () => {
    expect(shouldTryFuzzy(null, 0)).toBe(false);
  });

  it('rescues a single mistyped word', () => {
    expect(shouldTryFuzzy('refridgerator', 0)).toBe(true);
  });

  it('leaves a multi-word miss alone, because loose matching misleads there', () => {
    // For "red shirt" the fuzzy pass happily returns a blue one, since
    // "shirt" alone scores well. An empty result is the honest answer and the
    // shopper can drop a word themselves.
    expect(shouldTryFuzzy('red shirt', 0)).toBe(false);
  });
});

describe('the search expression and its index', () => {
  it('weights name above category above description', () => {
    // Relevance depends on this ordering: a word in the product name should
    // beat the same word buried in a description.
    const weights = [...SEARCH_VECTOR_SQL.matchAll(/'([ABC])'/g)].map((m) => m[1]);
    expect(weights).toEqual(['A', 'B', 'C']);
    expect(SEARCH_VECTOR_SQL.indexOf('s.name')).toBeLessThan(SEARCH_VECTOR_SQL.indexOf('s.category'));
    expect(SEARCH_VECTOR_SQL.indexOf('s.category')).toBeLessThan(SEARCH_VECTOR_SQL.indexOf('s.description'));
  });

  it('matches the index definition once aliases are removed', () => {
    // PostgreSQL only uses an expression index when the query's expression is
    // identical. If these drift the planner silently stops using the index and
    // every search goes back to a full scan — slow, but still correct, so
    // nothing else would notice.
    const strip = (sql: string) => sql.replace(/\bs\./g, '').replace(/\s+/g, ' ').trim();
    expect(strip(SEARCH_VECTOR_SQL)).toBe(strip(SEARCH_VECTOR_INDEX_SQL));
  });

  it('coalesces every column, so one null cannot void the whole vector', () => {
    expect(SEARCH_VECTOR_SQL.match(/coalesce/g)).toHaveLength(3);
  });
});
