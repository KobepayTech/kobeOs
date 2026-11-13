import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { CtzSmsOutbox } from '../src/cargotz/cargotz-trip.entity';
import { CargoTzSmsService } from '../src/cargotz/cargotz-sms.service';
import { BeemService } from '../src/notifications/beem.service';
import { bootTestApp, resetDb } from './setup';

describe('CargoTZ operational handoff', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;

  beforeAll(async () => {
    app = await bootTestApp();
    http = app.getHttpServer();
  });
  afterAll(async () => { jest.restoreAllMocks(); await app?.close(); });

  it('runs a multi-stop trip from collecting agent to a one-time customer pickup', async () => {
    await resetDb(app);
    const signup = async (name: string) => {
      const email = `${name}@cargotz.example`;
      const result = await request(http).post('/api/auth/register').send({ email, password: 'CargoFixture!234', displayName: name }).expect(201);
      return { email, id: result.body.user.id as string, token: result.body.accessToken as string };
    };
    const [owner, agent, intake, loading, mbeya, outsider] = await Promise.all(
      ['owner', 'collector', 'intake', 'loading', 'mbeya', 'outsider'].map(signup),
    );
    const as = (user: typeof owner, method: 'get' | 'post' | 'patch' | 'delete', path: string) =>
      request(http)[method](`/api/${path}`).set('Authorization', `Bearer ${user.token}`);
    const mine = 'cargotz/operations/mine';
    const shared = `cargotz/operations/${owner.id}`;
    const origin = 'Dar es Salaam';
    const legacyStaff = await as(owner, 'post', 'cargotz/staff').send({ name: 'Legacy intake', role: 'Agent', pin: '4118' }).expect(201);
    const staffUpdate = await as(owner, 'patch', `cargotz/staff/${legacyStaff.body.id}`).send({ active: false, ownerId: outsider.id }).expect(200);
    expect(staffUpdate.body.ownerId).toBe(owner.id);
    await as(owner, 'post', 'cargotz/parcels').set('x-ctz-pin', '4118').send({
      senderName: 'A', senderPhone: '0755555555', receiverName: 'B', receiverPhone: '0755555555', origin, destination: 'Mbeya',
    }).expect(403);
    for (const [user, role, branch] of [[intake, 'Intake', origin], [loading, 'Loading', origin], [mbeya, 'Destination', 'Mbeya']] as const) {
      await as(owner, 'post', 'cargotz/operations/staff').send({ email: user.email, role, branch }).expect(201);
    }
    const grants = await as(mbeya, 'get', 'cargotz/operations/workspaces').expect(200);
    expect(grants.body).toEqual([{ ownerId: owner.id, role: 'Destination', branch: 'Mbeya' }]);
    const invite = await as(owner, 'post', 'cargotz/collector-invites').send({
      companyName: 'Cargo fixture', agentName: 'Collector', agentPhone: '0711222333',
    }).expect(201);
    const accepted = await as(agent, 'post', 'cargotz/collector/accept').send({ token: invite.body.token }).expect(201);
    expect(accepted.body.approved).toBe(false);
    const approvals = await as(owner, 'get', 'cargotz/collector-invites').expect(200);
    expect(approvals.body).toEqual(expect.arrayContaining([expect.objectContaining({ id: invite.body.id, pendingApproval: true, accepted: false })]));
    expect((await as(agent, 'get', 'cargotz/collector/companies').expect(200)).body).toEqual([]);
    const approvalPath = `cargotz/collector-invites/${invite.body.id}/approve`;
    await as(outsider, 'post', approvalPath).expect(404);
    await as(owner, 'post', approvalPath).expect(201);
    expect((await as(agent, 'get', 'cargotz/collector/companies').expect(200)).body).toEqual(expect.arrayContaining([expect.objectContaining({ id: invite.body.id })]));

    const collection = await as(agent, 'post', 'cargotz/collector/collections').send({
      accessId: accepted.body.id, requestId: randomUUID(), ownerName: 'Goods owner', ownerPhone: '0755555555',
      receiverName: 'Other recipient', receiverPhone: '0766666666', origin, destination: 'Mbeya',
      description: 'Two shop orders', cartonCount: 2, handoff: 'DROPOFF', handoffLocation: origin,
    }).expect(201);
    const [first, second] = collection.body.map((row: { trackingNumber: string }) => row.trackingNumber);
    expect(first).toMatch(/^\d{11}$/);
    expect(second).toMatch(/^\d{11}$/);
    expect(first).not.toBe(second);

    const walkIn = await as(owner, 'post', 'cargotz/parcels').send({
      senderName: 'Second owner', senderPhone: '0755444333', receiverName: 'Second owner',
      receiverPhone: '0755444333', origin, destination: 'Iringa', description: 'One carton',
    }).expect(201);
    const third = walkIn.body.trackingNumber;
    const paymentPath = `cargotz/parcels/${first}/payment`;
    await as(owner, 'post', paymentPath).send({ paid: true, transportFee: 12500 }).expect(400);
    const volume = await as(owner, 'get', 'cargotz/freight-volume').expect(200);
    expect(volume.body.hours.reduce((count: number, point: { today: number }) => count + point.today, 0)).toBeGreaterThanOrEqual(3);
    expect(volume.body.agents).toEqual(expect.arrayContaining([expect.objectContaining({ today: 2, yesterday: 0 })]));
    const isolated = await as(outsider, 'get', 'cargotz/freight-volume').expect(200);
    expect(isolated.body.agents).toEqual([]);
    expect(isolated.body.hours.every((point: { today: number; yesterday: number }) => point.today === 0 && point.yesterday === 0)).toBe(true);
    const intakePath = `${shared}/intake/${first}`;
    const handoff = await as(intake, 'get', `${intakePath}?branch=${encodeURIComponent(origin)}`).expect(200);
    expect(handoff.body.parcel.senderPhone).toBe('0755555555');
    expect(handoff.body.cartons).toHaveLength(2);
    await as(outsider, 'get', `${intakePath}?branch=${encodeURIComponent(origin)}`).expect(403);
    await as(intake, 'post', `${intakePath}/confirm?branch=${encodeURIComponent(origin)}`).send({ weight: 4.5 }).expect(201);
    await as(intake, 'post', `${shared}/intake/${second}/confirm?branch=${encodeURIComponent(origin)}`).send({}).expect(201);

    const id = randomUUID();
    const payload = { id, origin, plate: 'T 472 DFR', vehicleType: 'Lorry', operator: 'Cargo fixture', trackingNumbers: [third, first, second] };
    const tripPath = `${mine}/trips/${id}`;
    const loadPath = `${shared}/trips/${id}`;
    const originQuery = `branch=${encodeURIComponent(origin)}`;
    await as(loading, 'post', `${shared}/trips`).send(payload).expect(403);
    await Promise.all([as(owner, 'post', `${mine}/trips`).send(payload).expect(201), as(owner, 'post', `${mine}/trips`).send(payload).expect(201)]);
    await as(owner, 'post', `cargotz/parcels/${first}/status`).send({ status: 'DELIVERED' }).expect(400);
    await as(outsider, 'post', paymentPath).send({ paid: true, transportFee: 12500 }).expect(404);
    await as(owner, 'post', paymentPath).send({ paid: 'false' }).expect(400);
    await as(owner, 'post', paymentPath).send({ paid: true }).expect(400);
    const receipts = await Promise.all([
      as(owner, 'post', paymentPath).send({ paid: true, transportFee: 12500 }).expect(201),
      as(owner, 'post', paymentPath).send({ paid: true, transportFee: 12500 }).expect(201),
    ]);
    for (const receipt of receipts) {
      expect(receipt.body.paymentStatus).toBe('PAID');
      expect(Number(receipt.body.transportFee)).toBe(12500);
    }
    const paymentDetails = await as(owner, 'get', `cargotz/parcels/${first}`).expect(200);
    expect(paymentDetails.body.timeline.filter((entry: { note: string }) => entry.note.includes('Freight payment recorded'))).toHaveLength(1);
    await as(loading, 'post', `${loadPath}/seal?${originQuery}`).send({}).expect(409);
    await as(loading, 'post', `${loadPath}/scan?${originQuery}`).send({ tracking: first }).expect(201);
    await as(loading, 'post', `${loadPath}/scan?${originQuery}`).send({ tracking: first }).expect(201);
    await as(owner, 'post', `${tripPath}/cancel`).send({}).expect(409);
    await as(loading, 'post', `${loadPath}/scan?${originQuery}`).send({ tracking: second }).expect(201);
    await as(loading, 'post', `${loadPath}/scan?${originQuery}`).send({ tracking: third }).expect(201);
    const loadingView = await as(loading, 'get', `${loadPath}?role=Loading&${originQuery}`).expect(200);
    expect(loadingView.body.cartons).toHaveLength(3);
    expect(loadingView.body.cartons[0].recipientPhone).toBeUndefined();
    await Promise.all([as(loading, 'post', `${loadPath}/seal?${originQuery}`).send({}).expect(201), as(loading, 'post', `${loadPath}/seal?${originQuery}`).send({}).expect(201)]);

    const mbeyaPath = `${shared}/trips/${id}`;
    const manifest = await as(mbeya, 'get', `${mbeyaPath}?role=Destination&branch=Mbeya`).expect(200);
    expect(manifest.body.stops.map((stop: { branch: string }) => stop.branch)).toEqual(['Mbeya']);
    expect(manifest.body.cartons).toHaveLength(2);
    await as(mbeya, 'get', `${mbeyaPath}?role=Destination&branch=Iringa`).expect(403);
    await as(mbeya, 'post', `${mbeyaPath}/arrive`).send({ branch: 'Mbeya', plate: 'T472DFR' }).expect(409);
    await as(owner, 'post', `${tripPath}/depart`).send({}).expect(201);
    await as(mbeya, 'post', `${mbeyaPath}/arrive`).send({ branch: 'Mbeya', plate: 'T 111 AAA' }).expect(400);
    await as(mbeya, 'post', `${mbeyaPath}/arrive`).send({ branch: 'Mbeya', plate: 'T472DFR' }).expect(201);
    const inTransit = await request(http).get(`/api/cargotz-track/${third}`).expect(200);
    expect(inTransit.body.status).toBe('IN_TRANSIT');
    const unload = (tracking: string, result: string) => as(mbeya, 'post', `${mbeyaPath}/unload`).send({ branch: 'Mbeya', tracking, result });
    await unload(third, 'RECEIVED').expect(400);
    await unload(third, 'EXTRA').expect(201);
    await unload(third, 'EXTRA').expect(201);
    await unload(first, 'RECEIVED').expect(201);
    await unload(second, 'MISSING').expect(201);
    const release = () => as(mbeya, 'post', `${mbeyaPath}/release`).send({ branch: 'Mbeya', tracking: first });
    await release().expect(409);
    await unload(second, 'DAMAGED').expect(201);
    await release().expect(409);
    await unload(second, 'RECEIVED').expect(201);
    const reconciled = await as(mbeya, 'get', `${mbeyaPath}?role=Destination&branch=Mbeya`).expect(200);
    expect(reconciled.body.stops[0].extraCartons).toEqual([third]);
    expect(reconciled.body.cartons.every((row: { shipmentVerified: number }) => row.shipmentVerified === 2)).toBe(true);
    await Promise.all([release().expect(201), release().expect(201)]);

    const outbox = app.get(DataSource).getRepository(CtzSmsOutbox);
    const messages = await outbox.findBy({ ownerId: owner.id, tripId: id });
    expect(messages).toHaveLength(4);
    const pickup = messages.find((row) => row.eventKey.startsWith('ready:'))!;
    expect(pickup.phone).toBe('255755555555');
    const code = pickup.body.match(/Pickup code: (\d{6})/)![1];
    const collect = (value: string) => as(mbeya, 'post', `${mbeyaPath}/collect`).send({ branch: 'Mbeya', tracking: first, code: value });
    await collect(code === '000000' ? '111111' : '000000').expect(400);
    await collect(code).expect(201);
    await collect(code).expect(201);
    const delivered = await request(http).get(`/api/cargotz-track/${second}`).expect(200);
    expect(delivered.body.status).toBe('DELIVERED');
    expect(JSON.stringify(delivered.body)).not.toMatch(/Goods owner|0755555555|Two shop orders/);

    const provider = app.get(BeemService);
    const configured = jest.spyOn(provider, 'isConfigured').mockReturnValue(true);
    const send = jest.spyOn(provider, 'sendSms').mockResolvedValue({ ok: true, externalId: 'sms-fixture' });
    const tracking = `/api/cargotz-track/${first}`;
    await request(http).post(`${tracking}/owner-code`).send({ phone: '0766666666' }).expect(201);
    expect(send).not.toHaveBeenCalled();
    await request(http).post(`${tracking}/owner-code`).send({ phone: '0755555555' }).expect(201);
    await request(http).post(`/api/cargotz-track/${second}/owner-code`).send({ phone: '0755555555' }).expect(201);
    expect(send).toHaveBeenCalledTimes(1);
    const verification = send.mock.calls[0][1].match(/code: (\d{6})/)![1];
    const privateDetails = await request(http).post(`${tracking}/owner-details`).send({ phone: '+255755555555', code: verification }).expect(201);
    expect(privateDetails.body).toMatchObject({ ownerName: 'Goods owner', description: 'Two shop orders' });
    expect(privateDetails.headers['cache-control']).toBe('no-store');
    await request(http).post(`${tracking}/owner-details`).send({ phone: '0755555555', code: verification }).expect(400);
    send.mockClear();
    const sms = app.get(CargoTzSmsService);
    for (let i = 0; i < 4; i++) expect(await sms.deliverOne()).toBe(true);
    expect(await sms.deliverOne()).toBe(false);
    expect(send).toHaveBeenCalledTimes(4);
    expect((await outbox.findOneByOrFail({ id: pickup.id })).body).toBe('');
    send.mockRestore();
    configured.mockRestore();
  });
});
