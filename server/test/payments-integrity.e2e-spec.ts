import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { bootTestApp, resetDb } from './setup';
import { InboundPayment } from '../src/mobile-money/mobile-money.entity';

/**
 * Money paths. Two defects are pinned here:
 *
 *  - POST /payments/transactions with type CREDIT used to add arbitrary
 *    balance to the caller's own wallet, guarded only by JwtAuthGuard. Any
 *    registered user could mint money.
 *  - A transfer saved both legs under one idempotency key, which the
 *    production migration's global unique index rejected — so transfers
 *    failed on migrated databases and nowhere else.
 */
describe('Payments integrity (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let ds: DataSource;

  beforeAll(async () => { app = await bootTestApp(); http = app.getHttpServer(); ds = app.get(DataSource); });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await resetDb(app); });

  const register = async (email: string) => {
    const r = await request(http).post('/api/auth/register').send({ email, password: 'secret123' });
    expect(r.status).toBe(201);
    return { token: r.body.accessToken as string, id: r.body.user.id as string };
  };
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  const wallet = async (token: string, currency = 'TZS') => {
    const r = await request(http).post('/api/payments/wallets').set(auth(token)).send({ currency });
    expect(r.status).toBe(201);
    return r.body.id as string;
  };

  const balanceOf = async (token: string, id: string) => {
    const r = await request(http).get(`/api/payments/wallets/${id}`).set(auth(token));
    return Number(r.body.balance);
  };

  /** A verified inbound mobile-money payment, as the SMS gateway would record it. */
  const recordInbound = (ownerId: string, transactionId: string, amount: number, currency = 'TZS') =>
    ds.getRepository(InboundPayment).save(
      ds.getRepository(InboundPayment).create({
        ownerId, transactionId, amount, currency, status: 'RECEIVED', deviceId: 'test-device',
      }),
    );

  describe('credits must be backed by real money', () => {
    it('refuses a credit with no payment reference', async () => {
      const me = await register('pay-nofund@e2e.test');
      const w = await wallet(me.token);

      const res = await request(http).post('/api/payments/transactions').set(auth(me.token))
        .send({ walletId: w, type: 'CREDIT', amount: 1_000_000 });

      expect(res.status).toBe(403);
      expect(await balanceOf(me.token, w)).toBe(0);
    });

    it('refuses a reference that names no verified payment', async () => {
      const me = await register('pay-badref@e2e.test');
      const w = await wallet(me.token);

      const res = await request(http).post('/api/payments/transactions').set(auth(me.token))
        .send({ walletId: w, type: 'CREDIT', amount: 5000, reference: 'MADE-UP-REF' });

      expect(res.status).toBe(403);
      expect(await balanceOf(me.token, w)).toBe(0);
    });

    it('credits a wallet against a verified payment', async () => {
      const me = await register('pay-good@e2e.test');
      const w = await wallet(me.token);
      await recordInbound(me.id, 'MPESA-1', 5000);

      const res = await request(http).post('/api/payments/transactions').set(auth(me.token))
        .send({ walletId: w, type: 'CREDIT', amount: 5000, reference: 'MPESA-1' });

      expect(res.status).toBe(201);
      expect(await balanceOf(me.token, w)).toBe(5000);
    });

    it('refuses to credit more than the payment was worth', async () => {
      const me = await register('pay-inflate@e2e.test');
      const w = await wallet(me.token);
      await recordInbound(me.id, 'MPESA-2', 5000);

      const res = await request(http).post('/api/payments/transactions').set(auth(me.token))
        .send({ walletId: w, type: 'CREDIT', amount: 500000, reference: 'MPESA-2' });

      expect(res.status).toBe(400);
      expect(await balanceOf(me.token, w)).toBe(0);
    });

    it('spends one payment once', async () => {
      const me = await register('pay-reuse@e2e.test');
      const w = await wallet(me.token);
      await recordInbound(me.id, 'MPESA-3', 5000);
      const body = { walletId: w, type: 'CREDIT', amount: 5000, reference: 'MPESA-3' };

      expect((await request(http).post('/api/payments/transactions').set(auth(me.token)).send(body)).status).toBe(201);
      const second = await request(http).post('/api/payments/transactions').set(auth(me.token)).send(body);

      expect(second.status).toBe(403);
      expect(await balanceOf(me.token, w)).toBe(5000);
    });

    it('will not let one shop spend another shop\'s payment', async () => {
      const mine = await register('pay-owner@e2e.test');
      const other = await register('pay-thief@e2e.test');
      const theirWallet = await wallet(other.token);
      await recordInbound(mine.id, 'MPESA-4', 9000);

      const res = await request(http).post('/api/payments/transactions').set(auth(other.token))
        .send({ walletId: theirWallet, type: 'CREDIT', amount: 9000, reference: 'MPESA-4' });

      expect(res.status).toBe(403);
      expect(await balanceOf(other.token, theirWallet)).toBe(0);
    });

    it('refuses a payment in a different currency to the wallet', async () => {
      const me = await register('pay-fx@e2e.test');
      const w = await wallet(me.token, 'TZS');
      await recordInbound(me.id, 'MPESA-5', 5000, 'USD');

      const res = await request(http).post('/api/payments/transactions').set(auth(me.token))
        .send({ walletId: w, type: 'CREDIT', amount: 5000, reference: 'MPESA-5' });

      expect(res.status).toBe(400);
      expect(await balanceOf(me.token, w)).toBe(0);
    });

    it('still refuses a zero or negative amount', async () => {
      const me = await register('pay-zero@e2e.test');
      const w = await wallet(me.token);
      for (const amount of [0, -100]) {
        const res = await request(http).post('/api/payments/transactions').set(auth(me.token))
          .send({ walletId: w, type: 'CREDIT', amount, reference: 'X' });
        expect(res.status).toBeGreaterThanOrEqual(400);
      }
      expect(await balanceOf(me.token, w)).toBe(0);
    });

    it('leaves debits working as before', async () => {
      const me = await register('pay-debit@e2e.test');
      const w = await wallet(me.token);
      await recordInbound(me.id, 'MPESA-6', 5000);
      await request(http).post('/api/payments/transactions').set(auth(me.token))
        .send({ walletId: w, type: 'CREDIT', amount: 5000, reference: 'MPESA-6' });

      const ok = await request(http).post('/api/payments/transactions').set(auth(me.token))
        .send({ walletId: w, type: 'DEBIT', amount: 2000 });
      expect(ok.status).toBe(201);
      expect(await balanceOf(me.token, w)).toBe(3000);

      // And an overdraw is still refused.
      const over = await request(http).post('/api/payments/transactions').set(auth(me.token))
        .send({ walletId: w, type: 'DEBIT', amount: 999999 });
      expect(over.status).toBeGreaterThanOrEqual(400);
      expect(await balanceOf(me.token, w)).toBe(3000);
    });
  });

  describe('transfers', () => {
    const fundedPair = async (email: string) => {
      const me = await register(email);
      const from = await wallet(me.token);
      const to = await wallet(me.token);
      await recordInbound(me.id, `FUND-${email}`, 10_000);
      await request(http).post('/api/payments/transactions').set(auth(me.token))
        .send({ walletId: from, type: 'CREDIT', amount: 10_000, reference: `FUND-${email}` });
      return { me, from, to };
    };

    it('transfers with an idempotency key, writing both legs', async () => {
      // This is the case that failed on production schema: one key, two rows.
      const { me, from, to } = await fundedPair('tx-key@e2e.test');

      const res = await request(http).post('/api/payments/transfer').set(auth(me.token))
        .send({ fromWalletId: from, toWalletId: to, amount: 2500, idempotencyKey: 'transfer-1' });

      expect(res.status).toBe(201);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
      expect(await balanceOf(me.token, from)).toBe(7500);
      expect(await balanceOf(me.token, to)).toBe(2500);
    });

    it('replaying the same key moves the money once and returns both legs', async () => {
      const { me, from, to } = await fundedPair('tx-replay@e2e.test');
      const body = { fromWalletId: from, toWalletId: to, amount: 2500, idempotencyKey: 'transfer-2' };

      await request(http).post('/api/payments/transfer').set(auth(me.token)).send(body);
      const replay = await request(http).post('/api/payments/transfer').set(auth(me.token)).send(body);

      expect(replay.status).toBe(201);
      // Shape must match a fresh transfer; it used to return a single object.
      expect(Array.isArray(replay.body)).toBe(true);
      expect(replay.body).toHaveLength(2);
      expect(await balanceOf(me.token, from)).toBe(7500);
      expect(await balanceOf(me.token, to)).toBe(2500);
    });

    it('allows two different transfers in the same account', async () => {
      const { me, from, to } = await fundedPair('tx-two@e2e.test');

      const a = await request(http).post('/api/payments/transfer').set(auth(me.token))
        .send({ fromWalletId: from, toWalletId: to, amount: 1000, idempotencyKey: 'k-a' });
      const b = await request(http).post('/api/payments/transfer').set(auth(me.token))
        .send({ fromWalletId: from, toWalletId: to, amount: 1500, idempotencyKey: 'k-b' });

      expect([a.status, b.status]).toEqual([201, 201]);
      expect(await balanceOf(me.token, from)).toBe(7500);
      expect(await balanceOf(me.token, to)).toBe(2500);
    });

    it('does not let one account\'s key block another\'s', async () => {
      // The old global unique index made keys collide across tenants.
      const first = await fundedPair('tx-tenant-a@e2e.test');
      const second = await fundedPair('tx-tenant-b@e2e.test');

      const a = await request(http).post('/api/payments/transfer').set(auth(first.me.token))
        .send({ fromWalletId: first.from, toWalletId: first.to, amount: 1000, idempotencyKey: 'shared-key' });
      const b = await request(http).post('/api/payments/transfer').set(auth(second.me.token))
        .send({ fromWalletId: second.from, toWalletId: second.to, amount: 1000, idempotencyKey: 'shared-key' });

      expect([a.status, b.status]).toEqual([201, 201]);
      expect(await balanceOf(second.me.token, second.to)).toBe(1000);
    });

    it('refuses a transfer with insufficient funds', async () => {
      const { me, from, to } = await fundedPair('tx-broke@e2e.test');
      const res = await request(http).post('/api/payments/transfer').set(auth(me.token))
        .send({ fromWalletId: from, toWalletId: to, amount: 99_999, idempotencyKey: 'tx-broke' });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(await balanceOf(me.token, from)).toBe(10_000);
    });

    it('refuses to transfer out of a wallet the caller does not own', async () => {
      const mine = await fundedPair('tx-mine@e2e.test');
      const other = await register('tx-other@e2e.test');
      const theirs = await wallet(other.token);

      const res = await request(http).post('/api/payments/transfer').set(auth(other.token))
        .send({ fromWalletId: mine.from, toWalletId: theirs, amount: 1000 });

      expect(res.status).toBe(403);
      expect(await balanceOf(mine.me.token, mine.from)).toBe(10_000);
    });
  });
});
