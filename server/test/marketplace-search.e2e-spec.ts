import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { bootTestApp, resetDb } from './setup';
import { CommerceBusiness, ProductSnippet } from '../src/commerce/commerce.entity';

/**
 * Marketplace product search over real PostgreSQL.
 *
 * Ranking, stemming and typo tolerance are database behaviour, so none of this
 * can be tested against a mock — a stub would simply agree with whatever the
 * query happened to say.
 */
describe('Marketplace product search (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let ds: DataSource;

  beforeAll(async () => {
    app = await bootTestApp();
    http = app.getHttpServer();
    ds = app.get(DataSource);
  });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await resetDb(app); });

  /** A LITE shop stays visible without a live node, which keeps these tests about search. */
  const shop = async (name = 'Test Shop', slug = 'test-shop') => {
    const repo = ds.getRepository(CommerceBusiness);
    return repo.save(repo.create({
      businessId: `BUS-${slug.toUpperCase().slice(0, 8)}`, publicSlug: slug,
      catalogOwnerId: '11111111-1111-1111-1111-111111111111', name,
      merchantName: name, tier: 'LITE', status: 'ACTIVE', websiteEnabled: true,
    } as Partial<CommerceBusiness>));
  };

  let productSeq = 0;
  const product = async (
    businessId: string,
    fields: { name: string; description?: string; category?: string; price?: number; stock?: number; active?: boolean; indexedAt?: Date },
  ) => {
    const repo = ds.getRepository(ProductSnippet);
    productSeq += 1;
    return repo.save(repo.create({
      businessId,
      productId: `00000000-0000-4000-8000-${String(productSeq).padStart(12, '0')}`,
      catalogOwnerId: '11111111-1111-1111-1111-111111111111',
      name: fields.name,
      description: fields.description ?? '',
      category: fields.category ?? 'General',
      price: fields.price ?? 1000,
      currency: 'TZS',
      stock: fields.stock ?? 5,
      active: fields.active ?? true,
      indexedAt: fields.indexedAt ?? new Date(),
    } as Partial<ProductSnippet>));
  };

  const search = async (params: Record<string, string | number>) => {
    const qs = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)]),
    ).toString();
    const res = await request(http).get(`/api/commerce-public/jumla/items?${qs}`);
    expect(res.status).toBe(200);
    return res.body as Array<Record<string, unknown>>;
  };
  const names = (rows: Array<Record<string, unknown>>) => rows.map((r) => r.name);

  describe('matching', () => {
    it('finds a product by a word in its name', async () => {
      const business = await shop();
      await product(business.id, { name: 'Samsung Refrigerator' });
      await product(business.id, { name: 'Office Chair' });

      expect(names(await search({ q: 'refrigerator' }))).toEqual(['Samsung Refrigerator']);
    });

    it('matches a different form of the same word', async () => {
      // Stemming is the point of full-text search: a substring LIKE would
      // miss this, and shoppers do not type the exact inflection.
      const business = await shop();
      await product(business.id, { name: 'Running Shoe' });

      expect(names(await search({ q: 'shoes' }))).toEqual(['Running Shoe']);
      expect(names(await search({ q: 'run' }))).toEqual(['Running Shoe']);
    });

    it('searches the description and the category too', async () => {
      const business = await shop();
      await product(business.id, { name: 'Mystery Box', description: 'Contains a kettle' });
      await product(business.id, { name: 'Plain Item', category: 'Kitchenware' });

      expect(names(await search({ q: 'kettle' }))).toEqual(['Mystery Box']);
      expect(names(await search({ q: 'kitchenware' }))).toEqual(['Plain Item']);
    });

    it('requires all the words a shopper typed', async () => {
      const business = await shop();
      await product(business.id, { name: 'Red Running Shoe' });
      await product(business.id, { name: 'Blue Cotton Shirt' });

      expect(names(await search({ q: 'red shoe' }))).toEqual(['Red Running Shoe']);
      expect(await search({ q: 'red shirt' })).toEqual([]);
    });

    it('returns everything sellable when no query is given', async () => {
      const business = await shop();
      await product(business.id, { name: 'First' });
      await product(business.id, { name: 'Second' });

      expect(await search({})).toHaveLength(2);
    });
  });

  describe('ranking', () => {
    it('puts a name match above a description match', async () => {
      const business = await shop();
      await product(business.id, {
        name: 'Generic Stand', description: 'works well with any laptop',
        indexedAt: new Date(),
      });
      await product(business.id, {
        name: 'Laptop', description: 'a computer',
        // Older, so an indexedAt ordering would rank it last — relevance must win.
        indexedAt: new Date(Date.now() - 86_400_000),
      });

      expect(names(await search({ q: 'laptop' }))).toEqual(['Laptop', 'Generic Stand']);
    });

    it('honours an explicit sort over relevance', async () => {
      const business = await shop();
      await product(business.id, { name: 'Cheap Lamp', price: 5000 });
      await product(business.id, { name: 'Lamp Deluxe', price: 50000 });

      expect(names(await search({ q: 'lamp', sort: 'price_asc' })))
        .toEqual(['Cheap Lamp', 'Lamp Deluxe']);
      expect(names(await search({ q: 'lamp', sort: 'price_desc' })))
        .toEqual(['Lamp Deluxe', 'Cheap Lamp']);
    });
  });

  describe('typo tolerance', () => {
    it('still finds a misspelled product name', async () => {
      // Full-text finds nothing here; the trigram pass is what rescues it.
      const business = await shop();
      await product(business.id, { name: 'Samsung Refrigerator' });

      expect(names(await search({ q: 'samsng' }))).toEqual(['Samsung Refrigerator']);
    });

    it('does not invent matches for an unrelated query', async () => {
      const business = await shop();
      await product(business.id, { name: 'Samsung Refrigerator' });

      // Fuzzy matching must not become "return something regardless".
      expect(await search({ q: 'bicycle' })).toEqual([]);
    });
  });

  describe('filters', () => {
    it('filters by price range', async () => {
      const business = await shop();
      await product(business.id, { name: 'Budget Fan', price: 15000 });
      await product(business.id, { name: 'Premium Fan', price: 150000 });

      expect(names(await search({ q: 'fan', minPrice: 100000 }))).toEqual(['Premium Fan']);
      expect(names(await search({ q: 'fan', maxPrice: 20000 }))).toEqual(['Budget Fan']);
      expect(await search({ q: 'fan', minPrice: 10000, maxPrice: 200000 })).toHaveLength(2);
    });

    it('corrects a reversed price range rather than returning nothing', async () => {
      const business = await shop();
      await product(business.id, { name: 'Mid Fan', price: 50000 });

      expect(names(await search({ q: 'fan', minPrice: 100000, maxPrice: 10000 })))
        .toEqual(['Mid Fan']);
    });

    it('filters by category and by shop', async () => {
      const a = await shop('Shop A', 'shop-a');
      const b = await shop('Shop B', 'shop-b');
      await product(a.id, { name: 'A Kettle', category: 'Kitchen' });
      await product(b.id, { name: 'B Kettle', category: 'Kitchen' });
      await product(a.id, { name: 'A Hammer', category: 'Tools' });

      expect(names(await search({ category: 'Tools' }))).toEqual(['A Hammer']);
      expect(names(await search({ businessId: b.id }))).toEqual(['B Kettle']);
    });

    it('hides inactive and out-of-stock products', async () => {
      const business = await shop();
      await product(business.id, { name: 'Hidden Kettle', active: false });
      await product(business.id, { name: 'Sold Out Kettle', stock: 0 });
      await product(business.id, { name: 'Available Kettle' });

      expect(names(await search({ q: 'kettle' }))).toEqual(['Available Kettle']);
    });
  });

  describe('paging', () => {
    it('does not repeat or skip a row across pages of equal-ranked results', async () => {
      // Equally relevant rows need a tie-break, or the same product can appear
      // on two pages while another is never shown at all.
      const business = await shop();
      const stamp = new Date();
      for (let i = 0; i < 6; i += 1) {
        await product(business.id, { name: `Kettle ${i}`, indexedAt: stamp });
      }

      const first = names(await search({ q: 'kettle', limit: 3, offset: 0 }));
      const second = names(await search({ q: 'kettle', limit: 3, offset: 3 }));

      expect(first).toHaveLength(3);
      expect(second).toHaveLength(3);
      expect(new Set([...first, ...second]).size).toBe(6);
    });

    it('is stable when the same page is requested twice', async () => {
      const business = await shop();
      const stamp = new Date();
      for (let i = 0; i < 4; i += 1) {
        await product(business.id, { name: `Fan ${i}`, indexedAt: stamp });
      }

      expect(names(await search({ q: 'fan', limit: 2 })))
        .toEqual(names(await search({ q: 'fan', limit: 2 })));
    });

    it('caps an outlandish page size', async () => {
      const business = await shop();
      await product(business.id, { name: 'Only Item' });

      expect(await search({ limit: 100000 })).toHaveLength(1);
    });
  });

  describe('what it exposes', () => {
    it('names the shop, so a result can be attributed', async () => {
      const business = await shop('Kariakoo Electronics', 'kariakoo-electronics');
      await product(business.id, { name: 'Radio' });

      const [row] = await search({ q: 'radio' });
      expect(row.business).toMatchObject({
        name: 'Kariakoo Electronics', publicSlug: 'kariakoo-electronics', tier: 'LITE',
      });
    });

    it('carries no merchant contact details a shopper should not have', async () => {
      const business = await shop();
      await product(business.id, { name: 'Radio' });

      const payload = JSON.stringify(await search({ q: 'radio' }));
      expect(payload).not.toMatch(/managementTokenHash|passwordHash|catalogOwnerId/);
    });

    it('needs no authentication, since shoppers are not signed in', async () => {
      const business = await shop();
      await product(business.id, { name: 'Radio' });

      const res = await request(http).get('/api/commerce-public/jumla/items?q=radio');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });
});
