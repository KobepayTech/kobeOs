import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootTestApp, resetDb } from './setup';

describe('Property marketplace auto-provisioning (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => { app = await bootTestApp(); });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await resetDb(app); });

  async function owner() {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'mall-owner@e2e.test', password: 'wonderland', displayName: 'Mall Owner' });
    expect(response.status).toBe(201);
    return response.body.accessToken as string;
  }

  it('reports database-backed commerce web surfaces ready', async () => {
    const response = await request(app.getHttpServer()).get('/api/commerce-public/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      status: 'ok',
      database: 'connected',
    }));
    expect(response.body.surfaces).toEqual(expect.arrayContaining([
      'property-marketplace',
      'shop-storefront',
      'merchant-claim',
      'multi-shop-checkout',
    ]));
  });

  it('turns a commercial property into a public multi-shop marketplace end to end', async () => {
    const token = await owner();
    const auth = { Authorization: `Bearer ${token}` };

    const propertyResponse = await request(app.getHttpServer())
      .post('/api/property/properties')
      .set(auth)
      .send({
        name: 'Kariakoo Mall',
        address: 'Congo Street',
        city: 'Dar es Salaam',
        type: 'commercial',
        marketplaceTagline: 'Everything in Kariakoo, one checkout.',
      });

    expect(propertyResponse.status).toBe(201);
    expect(propertyResponse.body.marketplaceEnabled).toBe(true);
    expect(propertyResponse.body.publicSlug).toBe('kariakoo-mall');
    const propertyId = propertyResponse.body.id as string;

    const firstUnit = await request(app.getHttpServer())
      .post('/api/property/units')
      .set(auth)
      .send({
        propertyId,
        unitNumber: 'G12',
        type: 'Fashion shop',
        floor: 'Ground',
        rentAmount: 1500000,
        currency: 'TZS',
        status: 'vacant',
      });
    expect(firstUnit.status).toBe(201);

    const secondUnit = await request(app.getHttpServer())
      .post('/api/property/units')
      .set(auth)
      .send({
        propertyId,
        unitNumber: 'F22',
        type: 'Electronics shop',
        floor: 'Floor 1',
        rentAmount: 2200000,
        currency: 'TZS',
        status: 'vacant',
      });
    expect(secondUnit.status).toBe(201);

    const propertyMap = await request(app.getHttpServer())
      .get(`/api/commerce/properties/${propertyId}/map`)
      .set(auth);
    expect(propertyMap.status).toBe(200);
    expect(propertyMap.body.property.publicSlug).toBe('kariakoo-mall');
    expect(propertyMap.body.shops).toHaveLength(2);
    expect(propertyMap.body.shops.every((shop: { publicCode?: string }) => Boolean(shop.publicCode))).toBe(true);

    const shop1 = propertyMap.body.shops.find((shop: { unitNumber: string }) => shop.unitNumber === 'G12');
    const shop2 = propertyMap.body.shops.find((shop: { unitNumber: string }) => shop.unitNumber === 'F22');
    expect(shop1.status).toBe('AVAILABLE');
    expect(shop2.status).toBe('AVAILABLE');

    // Shop identity is permanent: ordinary unit edits never rotate its Shop ID.
    const originalCode = shop1.publicCode as string;
    const editUnit = await request(app.getHttpServer())
      .patch(`/api/property/units/${firstUnit.body.id}`)
      .set(auth)
      .send({ rentAmount: 1750000 });
    expect(editUnit.status).toBe(200);
    const mapAfterEdit = await request(app.getHttpServer())
      .get(`/api/commerce/properties/${propertyId}/map`)
      .set(auth);
    expect(mapAfterEdit.body.shops.find((shop: { unitNumber: string }) => shop.unitNumber === 'G12').publicCode).toBe(originalCode);

    const resolve = await request(app.getHttpServer())
      .get('/api/commerce-public/resolve/kariakoo-mall');
    expect(resolve.status).toBe(200);
    expect(resolve.body.kind).toBe('property');

    const initialMarketplace = await request(app.getHttpServer())
      .get('/api/commerce-public/marketplaces/kariakoo-mall');
    expect(initialMarketplace.status).toBe(200);
    expect(initialMarketplace.body.site.name).toBe('Kariakoo Mall');
    expect(initialMarketplace.body.stats.availableSpaces).toBe(2);
    expect(initialMarketplace.body.shops.find((shop: { publicCode: string }) => shop.publicCode === originalCode).vacancy.rentAmount).toBe(1750000);

    const claim1 = await request(app.getHttpServer())
      .post('/api/commerce-public/claims')
      .send({
        shopCode: originalCode,
        businessName: 'Asha Fashion',
        merchantName: 'Asha M',
        phone: '0712345678',
        categoryId: 'Fashion',
      });
    expect(claim1.status).toBe(201);
    expect(claim1.body.managementToken).toEqual(expect.any(String));

    const claim2 = await request(app.getHttpServer())
      .post('/api/commerce-public/claims')
      .send({
        shopCode: shop2.publicCode,
        businessName: 'Smart Tech',
        merchantName: 'Juma K',
        phone: '0755123456',
        categoryId: 'Electronics',
      });
    expect(claim2.status).toBe(201);

    const product1 = await request(app.getHttpServer())
      .post(`/api/commerce-public/lite/${claim1.body.business.id}/products`)
      .set('x-kobe-lite-token', claim1.body.managementToken)
      .send({
        name: 'Blue Dress',
        caption: 'Blue dress sizes 30-38',
        imageUrl: 'https://example.com/dress.jpg',
        category: 'Fashion',
        price: 45000,
        stock: 8,
      });
    expect(product1.status).toBe(201);
    expect(product1.body.products).toHaveLength(1);

    const product2 = await request(app.getHttpServer())
      .post(`/api/commerce-public/lite/${claim2.body.business.id}/products`)
      .set('x-kobe-lite-token', claim2.body.managementToken)
      .send({
        name: 'USB-C Cable',
        caption: 'Fast charging cable',
        imageUrl: 'https://example.com/cable.jpg',
        category: 'Electronics',
        price: 15000,
        stock: 12,
      });
    expect(product2.status).toBe(201);

    const marketplace = await request(app.getHttpServer())
      .get('/api/commerce-public/marketplaces/kariakoo-mall');
    expect(marketplace.status).toBe(200);
    expect(marketplace.body.stats.openBusinesses).toBe(2);
    expect(marketplace.body.stats.availableSpaces).toBe(0);
    expect(marketplace.body.products.map((product: { name: string }) => product.name)).toEqual(
      expect.arrayContaining(['Blue Dress', 'USB-C Cable']),
    );

    const fashionSearch = await request(app.getHttpServer())
      .get('/api/commerce-public/marketplaces/kariakoo-mall?q=blue');
    expect(fashionSearch.status).toBe(200);
    expect(fashionSearch.body.products).toHaveLength(1);
    expect(fashionSearch.body.products[0].shop.publicCode).toBe(originalCode);

    // One property cart is split by the existing Jumla engine into merchant orders.
    const order = await request(app.getHttpServer())
      .post('/api/commerce-public/jumla/orders')
      .send({
        customer: { name: 'Grace Buyer', phone: '0766123456' },
        fulfillment: 'PICKUP',
        note: 'Kariakoo Mall checkout',
        lines: [
          { productId: product1.body.products[0].id, quantity: 1, selectedOptions: { size: '30' } },
          { productId: product2.body.products[0].id, quantity: 2, selectedOptions: {} },
        ],
      });
    expect(order.status).toBe(201);
    expect(order.body.success).toBe(true);
    expect(order.body.orders).toHaveLength(2);
  });

  it('does not publish residential properties as commerce marketplaces', async () => {
    const token = await owner();
    const response = await request(app.getHttpServer())
      .post('/api/property/properties')
      .set({ Authorization: `Bearer ${token}` })
      .send({ name: 'Mikocheni Residence', type: 'residential' });

    expect(response.status).toBe(201);
    expect(response.body.marketplaceEnabled).toBe(false);
    expect(response.body.publicSlug ?? null).toBeNull();
  });
});
