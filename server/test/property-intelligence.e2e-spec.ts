import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { bootTestApp, resetDb } from './setup';
import { InboundPayment } from '../src/mobile-money/mobile-money.entity';
import { PropertyUtilityBill } from '../src/property/property-intelligence.entity';
import { PropertyIntelligenceService } from '../src/property/property-intelligence.service';

describe('Property intelligence on migrated schema', () => {
  let app: INestApplication; let http: ReturnType<INestApplication['getHttpServer']>; let token:string; let other:string; let propertyId:string; let unitId:string; let tenantId:string; let leaseId:string; let ownerId:string;
  const auth=()=>({Authorization:`Bearer ${token}`});
  const post=(path:string,body:object)=>request(http).post(`/api/${path}`).set(auth()).send(body);
  const action=(kind:string,payload:object,key=randomUUID(),approved=true)=>post('property/intelligence/actions',{kind,payload,requestKey:key,approved});
  beforeAll(async()=>{app=await bootTestApp();http=app.getHttpServer();});
  afterAll(async()=>{await app.close();});
  beforeEach(async()=>{
    await resetDb(app);
    const account=await request(http).post('/api/auth/register').send({email:'property-intelligence@e2e.test',password:'secret123'}); token=account.body.accessToken;
    const second=await request(http).post('/api/auth/register').send({email:'other-property@e2e.test',password:'secret123'});other=second.body.accessToken;
    const p=await post('property/properties',{name:'Moscow Apartments',type:'residential',city:'Dar es Salaam'});expect(p.status).toBe(201);propertyId=p.body.id;ownerId=p.body.ownerId;
    const u=await post('property/units',{propertyId,unitNumber:'101',type:'apartment',rentAmount:100000,currency:'TZS',status:'vacant'});expect(u.status).toBe(201);unitId=u.body.id;
    const t=await post('property/tenants',{unitId,name:'Test Tenant',phone:'0712345678'});expect(t.status).toBe(201);tenantId=t.body.id;
    const l=await post('property/leases',{unitId,tenantId,startDate:'2026-01-01',endDate:'2027-01-01',monthlyRent:100000,billingMonths:12,deposit:200000});expect(l.status).toBe(201);leaseId=l.body.id;
  });
  it('requires approval, scopes owners and persists floor/corridor edits',async()=>{
    const payload={unitId,floor:'1',corridor:'East',corridorSide:'left',position:2};
    expect((await action('layout',payload,randomUUID(),false)).status).toBe(400);
    expect((await request(http).post('/api/property/intelligence/actions').set({Authorization:`Bearer ${other}`}).send({kind:'layout',payload,requestKey:randomUUID(),approved:true})).status).toBe(404);
    expect((await action('layout',payload)).status).toBe(201);
    const overview=await request(http).get(`/api/property/intelligence/overview?propertyId=${propertyId}&period=2026-01`).set(auth());
    expect(overview.body.layouts[0]).toMatchObject({floor:'1',corridor:'East',position:2});
  });
  it('generates annual invoices once and forecasts inside the term',async()=>{
    expect((await post('property/intelligence/invoices',{period:'2026-01'})).body.created).toBe(1);
    expect((await post('property/intelligence/invoices',{period:'2026-01'})).body.created).toBe(0);
    expect((await post('property/intelligence/invoices',{period:'2027-01'})).body.created).toBe(0);
    const r=await request(http).get('/api/property/intelligence/overview?period=2026-01').set(auth());expect(r.body.financials[0]).toMatchObject({billed:1200000,earnedRent:100000});
  });
  it('consumes a verified inbound receipt once and updates rent atomically',async()=>{
    const generated=await post('property/intelligence/invoices',{period:'2026-01'});const chargeId=generated.body.charges[0].id;
    const inbound=await app.get(DataSource).getRepository(InboundPayment).save({ownerId,deviceId:'verified-device',transactionId:'MM-TEST-1',direction:'RECEIVED',amount:100000,currency:'TZS',status:'RECEIVED'});
    const payload={inboundId:inbound.id,chargeId};const key=randomUUID();
    const [a,b]=await Promise.all([action('reconcile',payload,key),action('reconcile',payload,key)]);expect(a.status).toBe(201);expect(b.body.id).toBe(a.body.id);
    expect((await action('reconcile',payload)).status).toBe(400);
    const rows=await request(http).get('/api/property/payments').set(auth());expect(rows.body).toHaveLength(1);
    expect((await request(http).delete(`/api/property/payments/${a.body.id}`).set(auth())).status).toBe(400);
    const journal=await action('journal',{source:'payment',sourceId:a.body.id});expect(journal.status).toBe(201);expect(journal.body.entries).toHaveLength(2);
    expect((await action('journal',{source:'payment',sourceId:a.body.id})).status).toBe(400);
  });
  it('keeps posted expenses immutable in the legacy API',async()=>{
    const expense=await action('expense',{propertyId,title:'Repair',category:'maintenance',amount:5000,currency:'TZS',spentAt:'2026-10-01'});expect(expense.status).toBe(201);
    expect((await action('journal',{source:'expense',sourceId:expense.body.id})).status).toBe(201);
    expect((await request(http).patch(`/api/property/expenses/${expense.body.id}`).set(auth()).send({amount:1})).status).toBe(400);
    expect((await request(http).delete(`/api/property/expenses/${expense.body.id}`).set(auth())).status).toBe(400);
  });
  it('blocks deposit overdrafts and keeps retries idempotent',async()=>{
    const key=randomUUID();const payload={leaseId,kind:'receipt',amount:200000,reference:'R1',reason:'Received cash'};
    const a=await action('deposit',payload,key);expect(a.status).toBe(201);expect((await action('deposit',payload,key)).body.id).toBe(a.body.id);
    expect((await action('deposit',{...payload,kind:'refund',amount:200001})).status).toBe(400);
    expect((await action('deposit',{...payload,kind:'refund',amount:100000})).status).toBe(201);
  });
  it('rejects overlapping renewal and invalid utility readings',async()=>{
    expect((await action('renew',{leaseId,startDate:'2026-12-01',endDate:'2027-12-01',monthlyRent:110000,billingMonths:12})).status).toBe(400);
    expect((await action('renew',{leaseId,startDate:'2027-01-01',endDate:'2028-01-01',monthlyRent:110000,billingMonths:12})).status).toBe(201);
    const bill={unitId,tenantId,kind:'water',period:'2026-10',previousReading:20,currentReading:10,unitRate:100,dueDate:'2026-11-01'};
    expect((await action('utility',bill)).status).toBe(400);
    expect((await action('utility',{...bill,currentReading:25})).status).toBe(201);
    const stored=await app.get(DataSource).getRepository(PropertyUtilityBill).findOneByOrFail({ownerId,unitId});expect(Number(stored.amount)).toBe(500);
  });
  it('isolates tenant self-service, creates one ticket on retry and revokes access',async()=>{
    const invite=await post(`property/intelligence/tenants/${tenantId}/access`,{});expect(invite.status).toBe(201);
    const header={'x-property-access':invite.body.token};
    expect((await request(http).get('/api/property-self-service/portal')).status).toBe(401);
    const portal=await request(http).get('/api/property-self-service/portal').set(header);expect(portal.body.tenant.name).toBe('Test Tenant');expect(portal.body.tenant.ownerId).toBeUndefined();
    const body={title:'Leaking tap',description:'Kitchen tap leaking',requestKey:randomUUID()};
    const first=await request(http).post('/api/property-self-service/maintenance').set(header).send(body);expect(first.status).toBe(201);
    expect((await request(http).post('/api/property-self-service/maintenance').set(header).send(body)).body.id).toBe(first.body.id);
    await request(http).delete(`/api/property/intelligence/tenants/${tenantId}/access`).set(auth());
    expect((await request(http).get('/api/property-self-service/portal').set(header)).status).toBe(401);
  });
  it('publishes only opted-in vacant units without tenant data',async()=>{
    expect((await request(http).get('/api/property-self-service/vacancies')).body).toEqual([]);
    expect((await action('publish',{unitId,enabled:true})).status).toBe(201);
    const rows=(await request(http).get('/api/property-self-service/vacancies?q=Dar')).body;expect(rows).toHaveLength(1);expect(rows[0].tenantId).toBeUndefined();
    expect((await request(http).post(`/api/property-self-service/vacancies/${unitId}/enquire`).send({name:'Applicant',phone:'0712345678'})).status).toBe(201);
    await action('publish',{unitId,enabled:false});expect((await request(http).get('/api/property-self-service/vacancies')).body).toEqual([]);
  });
  it('creates due maintenance tickets only with standing approval',async()=>{
    await action('asset',{propertyId,unitId,name:'Water pump',category:'pump',lastServiced:'2020-01-01',intervalDays:90});
    const svc=app.get(PropertyIntelligenceService);await svc.daily();
    expect((await request(http).get('/api/property/work-orders').set(auth())).body).toHaveLength(0);
    await action('automation',{feature:'autoMaintenance',enabled:true});await svc.daily();await svc.daily();
    expect((await request(http).get('/api/property/work-orders').set(auth())).body).toHaveLength(1);
  });
});
