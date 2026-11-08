import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { StoreSettings } from '../src/store-settings/store-settings.entity';
import { StoreCollection } from '../src/store-settings/storefront.entity';
import { bootTestApp, resetDb } from './setup';

describe('Incoming ERP stock', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  beforeAll(async () => { app = await bootTestApp(); http = app.getHttpServer(); });
  afterAll(async () => { await app?.close(); });
  beforeEach(async () => { await resetDb(app); });

  async function auth(email: string) {
    const response = await request(http).post('/api/auth/register').send({ email, password: 'secret123' }).expect(201);
    return { Authorization: `Bearer ${response.body.accessToken}` };
  }

  it('stores the import estimate, keeps incoming units out of stock and rejects repeated partial receipts', async () => {
    const owner = await auth('buyer@erp.test');
    const stranger = await auth('another@erp.test');
    const supplier = (await request(http).post('/api/erp/supplier-capital/suppliers').set(owner)
      .send({ name: 'China supplier', country: 'CN', currency: 'CNY' }).expect(201)).body;
    const orders = '/api/erp/supplier-capital/purchase-orders';
    const order = {
      poNumber: 'INCOMING-1', supplierId: supplier.id, totalCny: 999,
      transportCost: 20000, expectedDate: '2026-12-01',
      items: [{ name: 'Jeans', qty: 10, currency: 'TZS', price: 1, buyingPriceCny: 25, tzsPerCny: 360, sellPrice: 25000 }],
    };
    await request(http).post(orders).set(stranger).send(order).expect(404);
    const create = () => request(http).post(orders).set(owner).send(order).expect(201);
    const [first, retry] = await Promise.all([create(), create()]);
    expect(first.body.id).toBe(retry.body.id);
    expect(Number(first.body.totalCny)).toBe(250);
    expect(first.body.items[0]).toMatchObject({ price: 9000, buyingPriceCny: 25, tzsPerCny: 360 });
    const list = await request(http).get(orders).set(owner).expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ supplierName: 'China supplier', inventoryStatus: 'PENDING' });
    expect((await request(http).get('/api/pos/products').set(owner).expect(200)).body).toEqual([]);

    const receive = (quantityReceived: number, damagedQuantity: number, expectedProcessed: number) =>
      request(http).post(`${orders}/${first.body.id}/receive`).set(owner)
        .send({ lines: [{ lineIndex: 0, quantityReceived, damagedQuantity, expectedProcessed }] });
    const partial = await Promise.all([receive(4, 1, 0), receive(4, 1, 0)]);
    expect(partial.map(response => response.status).sort()).toEqual([201, 409]);
    const products = await request(http).get('/api/pos/products').set(owner).expect(200);
    expect(products.body).toHaveLength(1);
    expect(products.body[0]).toMatchObject({ name: 'Jeans', stock: 4, imageUrls: [] });
    expect(Number(products.body[0].cost)).toBe(11000);
    expect(Number(products.body[0].price)).toBe(25000);
    const completed = await receive(5, 0, 5).expect(201);
    expect(completed.body.po.inventoryStatus).toBe('RECEIVED');
    expect((await receive(5, 0, 5).expect(201)).body.alreadyReceived).toBe(true);
    const product = (await request(http).get('/api/pos/products').set(owner).expect(200)).body[0];
    expect(product.stock).toBe(9);

    const db = app.get(DataSource);
    await db.getRepository(StoreSettings).save({ ownerId: product.ownerId, domainSlug: 'erp-cost-test', isPublished: true });
    await db.getRepository(StoreCollection).save({
      ownerId: product.ownerId, name: 'Collection', slug: 'collection', type: 'manual', productIds: [product.id],
    });
    for (const path of ['/api/store/erp-cost-test', '/api/store/erp-cost-test/collections/collection']) {
      const publicStore = await request(http).get(path).expect(200);
      expect(publicStore.body.products[0].name).toBe('Jeans');
      expect(publicStore.body.products[0]).not.toHaveProperty('cost');
      expect(publicStore.body.products[0]).not.toHaveProperty('supplier');
    }
  });
});
