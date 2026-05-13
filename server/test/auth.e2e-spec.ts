import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootTestApp, resetDb } from './setup';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => { app = await bootTestApp(); });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await resetDb(app); });

  const register = async (email = 'alice@e2e.test', password = 'wonderland') =>
    request(app.getHttpServer()).post('/api/auth/register').send({ email, password, displayName: 'Alice' });

  it('registers and returns access + refresh tokens', async () => {
    const res = await register();
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
    expect(res.body.user.email).toBe('alice@e2e.test');
  });

  it('rejects duplicate email with 409', async () => {
    await register();
    const dup = await register();
    expect(dup.status).toBe(409);
  });

  it('login + refresh rotates the refresh token (old one is single-use)', async () => {
    await register();
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'alice@e2e.test', password: 'wonderland' });
    expect(login.status).toBe(201);
    const r1 = login.body.refreshToken;

    const refresh1 = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: r1 });
    expect(refresh1.status).toBe(201);
    expect(refresh1.body.refreshToken).not.toBe(r1);

    // Reuse of the rotated-out token is rejected
    const reuse = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: r1 });
    expect(reuse.status).toBe(401);
  });

  it('logout revokes the refresh token', async () => {
    const reg = await register();
    const rt = reg.body.refreshToken;
    const logout = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .send({ refreshToken: rt });
    expect(logout.status).toBe(201);
    const refresh = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: rt });
    expect(refresh.status).toBe(401);
  });

  it('forgot-password issues a token; reset-password updates the credential', async () => {
    await register();
    const forgot = await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email: 'alice@e2e.test' });
    expect(forgot.status).toBe(201);
    expect(forgot.body.resetToken).toEqual(expect.any(String));

    const reset = await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({ token: forgot.body.resetToken, newPassword: 'curiouser2' });
    expect(reset.status).toBe(201);

    const oldPw = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'alice@e2e.test', password: 'wonderland' });
    expect(oldPw.status).toBe(401);

    const newPw = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'alice@e2e.test', password: 'curiouser2' });
    expect(newPw.status).toBe(201);
  });

  it('JWT guard rejects unauthenticated /users/me with 401', async () => {
    const me = await request(app.getHttpServer()).get('/api/users/me');
    expect(me.status).toBe(401);
  });
});
