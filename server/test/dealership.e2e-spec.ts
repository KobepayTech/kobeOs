import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootTestApp, resetDb } from './setup';

describe('Dealership production flow (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => { app = await bootTestApp(); });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await resetDb(app); });

  async function owner() {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'dealer-owner@e2e.test', password: 'wonderland', displayName: 'Dealer Owner' });
    expect(response.status).toBe(201);
    return response.body.accessToken as string;
  }

  it('runs inventory, dealer site, appointments, reservations and ERP CRM from one car record', async () => {
    const token = await owner();
    const auth = { Authorization: `Bearer ${token}` };

    const businessResponse = await request(app.getHttpServer())
      .post('/api/commerce/businesses')
      .set(auth)
      .send({ name: 'Kijani Motors', phone: '0712345678', publicSlug: 'kijani-motors' });
    expect(businessResponse.status).toBe(201);
    const businessId = businessResponse.body.id as string;

    const profile = await request(app.getHttpServer())
      .patch(`/api/commerce/businesses/${businessId}/profile`)
      .set(auth)
      .send({
        businessType: 'DEALERSHIP',
        whatsapp: '0712345678',
        showroomAddress: 'Nyerere Road, Dar es Salaam',
        heroTitle: 'Find your next Toyota',
      });
    expect(profile.status).toBe(200);
    expect(profile.body.profile.businessType).toBe('DEALERSHIP');

    const carResponse = await request(app.getHttpServer())
      .post('/api/commerce/cars')
      .set(auth)
      .send({
        make: 'Toyota',
        model: 'Land Cruiser Prado',
        trim: 'TX-L',
        year: 2024,
        price: 185000000,
        mileage: 12000,
        transmission: 'Automatic',
        fuel: 'Diesel',
        engine: '2.8L',
        driveType: '4WD',
        bodyType: 'SUV',
        color: 'Pearl White',
        location: 'Dar es Salaam',
        financingAvailable: true,
        negotiable: true,
        features: ['7 seats', '360 camera'],
      });
    expect(carResponse.status).toBe(201);
    const vehicleId = carResponse.body.id as string;

    const resolve = await request(app.getHttpServer()).get('/api/commerce-public/resolve/kijani-motors');
    expect(resolve.status).toBe(200);
    expect(resolve.body.kind).toBe('dealership');

    const dealerSite = await request(app.getHttpServer()).get('/api/commerce-public/dealers/kijani-motors');
    expect(dealerSite.status).toBe(200);
    expect(dealerSite.body.dealer.name).toBe('Kijani Motors');
    expect(dealerSite.body.vehicles).toHaveLength(1);
    expect(dealerSite.body.vehicles[0]).toEqual(expect.objectContaining({
      id: vehicleId,
      modelGroupKey: 'toyota::land cruiser prado',
      canBuy: true,
      canSchedule: true,
    }));

    const search = await request(app.getHttpServer()).get('/api/commerce-public/cars?q=Prado');
    expect(search.status).toBe(200);
    expect(search.body).toHaveLength(1);
    expect(search.body[0].dealer.dealerSiteUrl).toBe('https://kijani-motors.kobeapptz.com');

    const visitAt = new Date(Date.now() + 2 * 60 * 60_000).toISOString();
    const appointment = await request(app.getHttpServer())
      .post(`/api/commerce-public/cars/${vehicleId}/appointments`)
      .send({
        customerName: 'Asha Buyer',
        customerPhone: '0755000001',
        appointmentType: 'TEST_DRIVE',
        scheduledFor: visitAt,
        message: 'I want to compare the ride quality.',
      });
    expect(appointment.status).toBe(201);
    expect(appointment.body.appointment.status).toBe('REQUESTED');
    expect(appointment.body.crmLeadId).toEqual(expect.any(String));

    const crmAfterVisit = await request(app.getHttpServer())
      .get('/api/erp/crm/leads?source=VEHICLE')
      .set(auth);
    expect(crmAfterVisit.status).toBe(200);
    expect(crmAfterVisit.body).toHaveLength(1);
    expect(crmAfterVisit.body[0].stage).toBe('APPOINTMENT');

    const confirmVisit = await request(app.getHttpServer())
      .patch(`/api/commerce/cars/appointments/${appointment.body.appointment.id}`)
      .set(auth)
      .send({ status: 'CONFIRMED', salesperson: 'Juma' });
    expect(confirmVisit.status).toBe(200);
    expect(confirmVisit.body.salesperson).toBe('Juma');

    const reservation = await request(app.getHttpServer())
      .post(`/api/commerce-public/cars/${vehicleId}/request`)
      .send({
        customerName: 'Asha Buyer',
        customerPhone: '0755000001',
        customerWhatsapp: '0755000001',
        customerEmail: 'asha@example.test',
        requestType: 'RESERVE',
        offerAmount: 180000000,
        preferredContact: 'WHATSAPP',
      });
    expect(reservation.status).toBe(201);
    expect(reservation.body.reservation.reservationCode).toEqual(expect.any(String));
    const code = reservation.body.reservation.reservationCode as string;

    const inventoryReserved = await request(app.getHttpServer()).get('/api/commerce/cars').set(auth);
    expect(inventoryReserved.body[0].status).toBe('RESERVED');

    const publicReserved = await request(app.getHttpServer()).get('/api/commerce-public/cars?q=Prado');
    expect(publicReserved.body[0].status).toBe('RESERVED');
    expect(publicReserved.body[0].canBuy).toBe(false);
    expect(publicReserved.body[0].canSchedule).toBe(true);

    const confirmReservation = await request(app.getHttpServer())
      .patch(`/api/commerce/cars/reservations/${code}`)
      .set(auth)
      .send({ status: 'CONFIRMED', holdMinutes: 120 });
    expect(confirmReservation.status).toBe(200);
    expect(confirmReservation.body.status).toBe('CONFIRMED');

    const reservationStatus = await request(app.getHttpServer()).get(`/api/commerce-public/reservations/${code}`);
    expect(reservationStatus.status).toBe(200);
    expect(reservationStatus.body.status).toBe('CONFIRMED');

    const sold = await request(app.getHttpServer())
      .patch(`/api/commerce/cars/reservations/${code}`)
      .set(auth)
      .send({ status: 'CONVERTED' });
    expect(sold.status).toBe(200);
    expect(sold.body.status).toBe('CONVERTED');

    const inventorySold = await request(app.getHttpServer()).get('/api/commerce/cars').set(auth);
    expect(inventorySold.body[0].status).toBe('SOLD');

    const crm = await request(app.getHttpServer())
      .get('/api/erp/crm/leads?source=VEHICLE')
      .set(auth);
    expect(crm.status).toBe(200);
    expect(crm.body).toHaveLength(1);
    expect(crm.body[0]).toEqual(expect.objectContaining({
      customerName: 'Asha Buyer',
      subject: '2024 Toyota Land Cruiser Prado',
      stage: 'WON',
    }));

    const engagement = await request(app.getHttpServer())
      .get('/api/commerce/cars/engagement')
      .set(auth);
    expect(engagement.status).toBe(200);
    expect(engagement.body.appointments).toHaveLength(1);
    expect(engagement.body.reservations).toHaveLength(1);
    expect(engagement.body.requests).toHaveLength(1);
  });

  it('cancels a hold and immediately returns the car to available stock', async () => {
    const token = await owner();
    const auth = { Authorization: `Bearer ${token}` };
    await request(app.getHttpServer()).post('/api/commerce/businesses').set(auth).send({ name: 'Mlimani Motors' });
    const vehicle = await request(app.getHttpServer()).post('/api/commerce/cars').set(auth).send({ make: 'Toyota', model: 'Prado', year: 2022, price: 120000000 });
    const held = await request(app.getHttpServer()).post(`/api/commerce-public/cars/${vehicle.body.id}/request`).send({ customerName: 'Buyer Two', customerPhone: '0766000002', requestType: 'RESERVE' });
    const code = held.body.reservation.reservationCode as string;

    const cancelled = await request(app.getHttpServer()).patch(`/api/commerce/cars/reservations/${code}`).set(auth).send({ status: 'CANCELLED' });
    expect(cancelled.status).toBe(200);

    const inventory = await request(app.getHttpServer()).get('/api/commerce/cars').set(auth);
    expect(inventory.body[0].status).toBe('AVAILABLE');
  });
});
