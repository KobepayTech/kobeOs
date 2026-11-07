import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { bootTestApp, resetDb } from './setup';
import { verifiedLalaPhone } from './lala-identity-helper';
import { LeaseBillingIntervals1792540800000 } from '../src/migrations/1792540800000-LeaseBillingIntervals';

describe('Hotel and property readiness regressions', () => {
  let app: INestApplication;
  beforeAll(async () => { app = await bootTestApp(); });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await resetDb(app); });
  const post = (path: string, token?: string) => request(app.getHttpServer()).post(`/api/${path}`).set(token ? { Authorization: `Bearer ${token}` } : {});
  async function owner() {
    const r = await post('auth/register').send({ email: 'readiness@test.io', password: 'secret123' }).expect(201);
    return r.body.accessToken as string;
  }
  it('persists reception check-in and checkout, and rejects competing reservations', async () => {
    const token = await owner();
    const hotel = await post('hotel/properties', token).send({ name: 'Test Hotel', slug: 'readiness-hotel', currency: 'TZS' }).expect(201);
    const room = await post('hotel/rooms', token).send({ hotelId: hotel.body.id, roomNumber: '101', type: 'Standard', rate: 50000, capacity: 2 }).expect(201);
    const input = { roomId: room.body.id, guestName: 'Guest', guestPhone: '0712345678', checkIn: '2030-01-01', checkOut: '2030-01-03' };
    const attempts = await Promise.all([post('hotel/front-desk/reservations', token).send(input), post('hotel/front-desk/reservations', token).send(input)]);
    expect(attempts.filter((r) => r.status === 201)).toHaveLength(1);
    const booking = attempts.find((r) => r.status === 201)!.body.booking;
    await post(`hotel/front-desk/bookings/${booking.id}/check-in`, token).send({}).expect(201);
    let rooms = await request(app.getHttpServer()).get(`/api/hotel/rooms?hotelId=${hotel.body.id}`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(rooms.body.find((r: { id: string }) => r.id === room.body.id).status).toBe('occupied');
    await post(`hotel/front-desk/bookings/${booking.id}/check-out`, token).send({}).expect(201);
    rooms = await request(app.getHttpServer()).get(`/api/hotel/rooms?hotelId=${hotel.body.id}`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(rooms.body.find((r: { id: string }) => r.id === room.body.id).status).toBe('cleaning');
  });
  it('allocates annual rent once and reverses it without leaving stale arrears', async () => {
    const token = await owner();
    const property = await post('property/properties', token).send({ name: 'Building', type: 'residential' }).expect(201);
    const unit = await post('property/units', token).send({ propertyId: property.body.id, unitNumber: '1', currency: 'TZS' }).expect(201);
    const tenant = await post('property/tenants', token).send({ unitId: unit.body.id, name: 'Tenant', phone: '0712345678' }).expect(201);
    await post('property/leases', token).send({ unitId: unit.body.id, tenantId: tenant.body.id, startDate: '2030-01-01', endDate: '2031-01-01', monthlyRent: 100000, billingMonths: 12, rentDueDay: 10 }).expect(201);
    const generated = await post('property/rent-charges/generate', token).send({ period: '2030-01' }).expect(201);
    const charge = generated.body.charges[0];
    expect(Number(charge.amount)).toBe(1200000);
    const none = await post('property/rent-charges/generate', token).send({ period: '2030-02' }).expect(201);
    expect(none.body.created).toBe(0);
    const payment = { chargeId: charge.id, tenantId: tenant.body.id, unitId: unit.body.id, amount: 1200000, currency: 'TZS', forMonth: '2030-01-01', paidAt: '2030-01-05', idempotencyKey: 'de5b77ab-4630-44aa-bf97-14a9d59da167' };
    const results = await Promise.all([post('property/payments', token).send(payment), post('property/payments', token).send(payment)]);
    expect(results.map((r) => r.status)).toEqual([201, 201]);
    expect(results[0].body.id).toBe(results[1].body.id);
    const charges = () => request(app.getHttpServer()).get('/api/property/rent-charges').set('Authorization', `Bearer ${token}`).expect(200);
    expect((await charges()).body[0].status).toBe('paid');
    await request(app.getHttpServer()).delete(`/api/property/payments/${results[0].body.id}`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(Number((await charges()).body[0].amountPaid)).toBe(0);
  });
  it('prevents passport recovery by phone alone and runs the upgrade migration', async () => {
    const phone = '+255700555666';
    const phoneToken = await verifiedLalaPhone(app, phone);
    const first = await post('lala-public/passports').send({ phone, name: 'Real guest', phoneToken }).expect(201);
    await post('lala-public/passports').send({ phone, name: 'Intruder' }).expect(401);
    const ds = app.get(DataSource);
    const runner = ds.createQueryRunner();
    await runner.connect();
    try { await new LeaseBillingIntervals1792540800000().up(runner); }
    finally { await runner.release(); }
    await request(app.getHttpServer()).get(`/api/lala-public/passports/${first.body.passport.qrToken}`).expect(404);
    const recovered = await post('lala-public/passports').send({ phone, name: 'Real guest', phoneToken }).expect(201);
    expect(recovered.body.passport.qrToken).not.toBe(first.body.passport.qrToken);
  });
});
