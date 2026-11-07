import { randomUUID } from 'crypto';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CargoKobePayService, ledgerUnits } from './cargo-kobepay.service';
import { CargoPayment, Shipment } from './cargo.entity';
import { PaymentCustomer, PaymentDeposit } from '../payments/kobepay.entity';
import { KobePayAuditEvent } from '../payments/kobepay-rbac.entity';

describe('Cargo freight ledger amounts', () => {
  it('preserves four-decimal precision without floating point rounding', () => {
    expect(ledgerUnits('99999999999999.9999')).toBe(999999999999999999n);
    expect(ledgerUnits('0.0001')).toBe(1n);
  });
  it.each(['-1', 'NaN', '1e6', '1.00001'])('rejects invalid ledger amount %s', value => {
    expect(() => ledgerUnits(value)).toThrow(BadRequestException);
  });
});

// Opt-in integration suite: uses a disposable PostgreSQL schema, never production tables.
const database = process.env.CARGO_QA_DATABASE_URL;
(database ? describe : describe.skip)('Cargo to KobePay PostgreSQL integration', () => {
  let ds: DataSource;
  let service: CargoKobePayService;
  let uid: string;
  let customer: PaymentCustomer;
  let shipment: Shipment;
  beforeAll(async () => {
    ds = new DataSource({ type: 'postgres', url: database, schema: `cargo_qa_${Date.now()}`, entities: [CargoPayment, Shipment, PaymentCustomer, PaymentDeposit, KobePayAuditEvent], synchronize: false });
    await ds.initialize();
    await ds.query(`CREATE SCHEMA "${ds.options.schema}"`);
    await ds.synchronize();
    service = new CargoKobePayService(ds, { resolveActor: async () => null, ensure: () => {} } as any, { emitPayment: () => {} } as any);
  });
  afterAll(async () => {
    if (ds?.isInitialized) { await ds.query(`DROP SCHEMA "${ds.options.schema}" CASCADE`); await ds.destroy(); }
  });
  beforeEach(async () => {
    uid = randomUUID();
    customer = await ds.getRepository(PaymentCustomer).save({ ownerId: uid, name: 'Cargo QA', phone: randomUUID(), balance: 100 });
    shipment = await ds.getRepository(Shipment).save({ ownerId: uid, shipmentId: randomUUID(), origin: 'CAN', destination: 'DAR', weight: 10, status: 'LOADING' });
    await ds.getRepository(PaymentDeposit).save({ ownerId: uid, customerId: customer.id, customerName: customer.name, phone: customer.phone, amount: 100, currency: 'TZS', method: 'QA', status: 'Confirmed' });
  });
  const payment = (customerId: string, shipmentId: string, requestId = randomUUID(), amount = 30) => ({ customerId, shipmentId, requestId, amount, currency: 'TZS', purpose: 'SHIPPING' as const });
  const balance = async () => Number((await ds.getRepository(PaymentCustomer).findOneByOrFail({ id: customer.id })).balance);
  it('posts a balance debit, cargo receipt and audit atomically', async () => {
    const receipt = await service.pay(uid, payment(customer.id, shipment.id));
    expect(receipt.status).toBe('COMPLETED'); expect(receipt.currency).toBe('TZS'); expect(await balance()).toBe(70);
    expect(await ds.getRepository(KobePayAuditEvent).countBy({ ownerId: uid, resourceId: receipt.id })).toBe(1);
  });
  it('concurrent retries debit exactly once', async () => {
    const input = payment(customer.id, shipment.id);
    const [a, b] = await Promise.all([service.pay(uid, input), service.pay(uid, input)]);
    expect(a.id).toBe(b.id); expect(await balance()).toBe(70);
    expect(await ds.getRepository(CargoPayment).countBy({ ownerId: uid })).toBe(1);
  });
  it('two concurrent charges cannot overdraw the funded account', async () => {
    const results = await Promise.allSettled([service.pay(uid, payment(customer.id, shipment.id, randomUUID(), 80)), service.pay(uid, payment(customer.id, shipment.id, randomUUID(), 80))]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1); expect(await balance()).toBe(20);
  });
  it('rejects reusing a request ID with changed payment details', async () => {
    const input = payment(customer.id, shipment.id);
    await service.pay(uid, input);
    await expect(service.pay(uid, { ...input, amount: 50 })).rejects.toThrow(ConflictException);
    expect(await balance()).toBe(70);
  });
  it('rejects cross-tenant subjects and mixed funding currencies', async () => {
    await expect(service.pay(randomUUID(), payment(customer.id, shipment.id))).rejects.toThrow(NotFoundException);
    await ds.getRepository(PaymentDeposit).save({ ownerId: uid, customerId: customer.id, customerName: customer.name, phone: customer.phone, amount: 20, currency: 'USD', method: 'QA', status: 'Confirmed' });
    await expect(service.pay(uid, payment(customer.id, shipment.id))).rejects.toThrow('mixed-currency');
    expect(await balance()).toBe(100);
  });
  it('rolls back a debit and receipt if the audit cannot be written', async () => {
    // Previous cases deliberately retain receipts. Only reject new audit writes;
    // do not validate those earlier rows while installing this fault injection.
    await ds.query(`ALTER TABLE "${ds.options.schema}"."kobepay_audit_events" ADD CONSTRAINT cargo_qa_audit_reject CHECK (action <> 'cargo.freightPayment') NOT VALID`);
    try {
      await expect(service.pay(uid, payment(customer.id, shipment.id))).rejects.toThrow();
      expect(await balance()).toBe(100); expect(await ds.getRepository(CargoPayment).countBy({ ownerId: uid })).toBe(0);
    } finally { await ds.query(`ALTER TABLE "${ds.options.schema}"."kobepay_audit_events" DROP CONSTRAINT cargo_qa_audit_reject`); }
  });
});
