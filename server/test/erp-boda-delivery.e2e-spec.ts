import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { MerchantOrder } from '../src/commerce/commerce.entity';
import { RetailMember } from '../src/erp/retail-member.entity';
import { BodaRider } from '../src/pos/boda-rider.entity';
import { StoreSettings } from '../src/store-settings/store-settings.entity';
import { bootTestApp, resetDb } from './setup';

describe('ERP boda boda dispatch', () => {
  let app: INestApplication;
  let db: DataSource;
  const slug = 'kariakoo-dispatch';
  const base = `/api/erp-delivery/${slug}/riders`;
  const pickup = { latitude: -6.82, longitude: 39.27 };

  beforeAll(async () => {
    app = await bootTestApp();
    db = app.get(DataSource);
    await resetDb(app);
  });
  afterAll(async () => { await app?.close(); });

  const account = async (name: string) => {
    const email = `${name}@e2e.test`;
    const response = await request(app.getHttpServer()).post('/api/auth/register').send({ email, password: 'test-password' }).expect(201);
    return { email, headers: { Authorization: `Bearer ${response.body.accessToken}` }, id: response.body.user.id as string };
  };

  it('limits dispatch access and ranks available riders from this shop', async () => {
    const http = app.getHttpServer();
    const [owner, staff, near, far, stale, outsider] = await Promise.all(
      ['owner', 'staff', 'near', 'far', 'stale', 'outsider'].map(account),
    );
    const shops = db.getRepository(StoreSettings);
    const shop = await shops.save({ ownerId: owner.id, domainSlug: slug });
    const otherShop = await shops.save({ ownerId: outsider.id, domainSlug: 'other-shop' });
    await db.getRepository(RetailMember).save({ shopId: shop.id, userId: staff.id, role: 'staff' });
    await db.getRepository(BodaRider).save({
      shopId: otherShop.id, userId: outsider.id, name: 'Other shop', phone: '+255711111111', ...pickup, locationAt: new Date(),
    });
    const register = (rider: typeof near, name: string) => ({ email: rider.email, name, phone: '0711111111' });
    await request(http).post(base).set(staff.headers).send(register(near, 'Near')).expect(403);
    for (const [rider, name] of [[near, 'Near'], [far, 'Far'], [stale, 'Stale']] as const) {
      await request(http).post(base).set(owner.headers).send(register(rider, name)).expect(201);
    }
    await request(http).put(`${base}/me/location`).set(outsider.headers).send(pickup).expect(403);
    await request(http).put(`${base}/me/location`).set(near.headers).send({ ...pickup, latitude: 92 }).expect(400);
    await request(http).put(`${base}/me/location`).set(near.headers).send(pickup).expect(200);
    await request(http).put(`${base}/me/location`).set(far.headers).send({ ...pickup, latitude: -6.84 }).expect(200);
    await db.getRepository(BodaRider).update({ shopId: shop.id, userId: stale.id }, { ...pickup, locationAt: new Date(Date.now() - 360_000) });
    const search = () => request(http).post(`${base}/nearby`).set(staff.headers).send(pickup).expect(201);
    await request(http).post(`${base}/nearby`).set(outsider.headers).send(pickup).expect(403);
    const nearby = (await search()).body;
    expect(nearby.map((rider: { name: string }) => rider.name)).toEqual(['Near', 'Far']);
    expect(nearby[0]).toEqual({ id: expect.any(String), name: 'Near', phone: '+255711111111', distanceKm: 0 });
    await request(http).delete(`${base}/me/location`).set(near.headers).expect(200);
    expect((await search()).body.map((rider: { name: string }) => rider.name)).toEqual(['Far']);
  });

  it('keeps the Jumla drop-off pin private and shows it in dispatch once ready', async () => {
    const http = app.getHttpServer();
    const owner = await account('jumla-owner');
    const staff = await account('jumla-staff');
    const outsider = await account('jumla-outsider');
    const shop = await db.getRepository(StoreSettings).save({ ownerId: owner.id, domainSlug: 'jumla-dispatch' });
    await db.getRepository(RetailMember).save({ shopId: shop.id, userId: staff.id, role: 'staff' });
    await request(http).post('/api/commerce/businesses').set(owner.headers)
      .send({ name: 'Jumla Dispatch', publicSlug: 'jumla-dispatch' }).expect(201);
    const item = await request(http).post('/api/commerce/products/quick-add').set(owner.headers)
      .send({ imageUrl: 'https://example.com/jeans.jpg', name: 'Jeans', price: 35000, stock: 20 }).expect(201);
    await request(http).post('/api/commerce/nodes/register').set(owner.headers).send({}).expect(201);
    const delivery = {
      customer: { name: 'Amina', phone: '+255700000001' }, fulfillment: 'DELIVERY',
      lines: [{ productId: item.body.products[0].id, quantity: 1 }],
    };
    const submit = (fields = {}) => request(http).post('/api/commerce-public/jumla/orders').send({ ...delivery, ...fields });
    await submit().expect(400);
    await submit({ deliveryPoint: { latitude: -6.82 } }).expect(400);
    const placed = await submit({ deliveryPoint: pickup }).expect(201);
    expect(placed.body.orders[0]).not.toHaveProperty('deliveryPoint');
    const order = await db.getRepository(MerchantOrder).findOneByOrFail({ orderNumber: placed.body.orders[0].orderNumber });
    expect(order.deliveryPoint).toEqual(pickup);
    const queue = '/api/erp-delivery/jumla-dispatch/riders/jumla-orders';
    await request(http).get(queue).set(staff.headers).expect(200, []);
    await request(http).patch(`/api/commerce/orders/${order.id}/status`).set(owner.headers).send({ status: 'READY' }).expect(200);
    await request(http).get(queue).set(staff.headers).expect(200, [{
      id: order.id, orderNumber: order.orderNumber, deliveryAddress: '', deliveryPoint: pickup,
    }]);
    await request(http).get(queue).set(outsider.headers).expect(403);
  });
});
