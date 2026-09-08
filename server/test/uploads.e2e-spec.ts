import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import sharp from 'sharp';
import { bootTestApp, resetDb } from './setup';

const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVR4nGNgYPj/HwADAgH/5ncLrgAAAABJRU5ErkJggg==',
  'base64',
);

describe('Multipart uploads (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => { app = await bootTestApp(); });
  afterAll(async () => { await app.close(); });

  beforeEach(async () => {
    await resetDb(app);
    const reg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'upload@e2e.test', password: 'uploadpw' });
    token = reg.body.accessToken;
  });

  it('POST /api/media/upload stores a file and serves it back via /blob/:id', async () => {
    const up = await request(app.getHttpServer())
      .post('/api/media/upload?kind=photo')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', PNG_BYTES, { filename: 'pixel.png', contentType: 'image/png' });
    expect(up.status).toBe(201);
    expect(up.body.id).toEqual(expect.any(String));
    expect(up.body.size).toBeGreaterThan(0);
    expect(up.body.size).toBeLessThanOrEqual(1024 * 1024);

    // src is a token URL, not the JWT-guarded blob route: an <img> tag cannot
    // send an Authorization header, so anything rendering an uploaded asset
    // needs a URL that works without one.
    expect(up.body.publicToken).toEqual(expect.any(String));
    expect(up.body.src).toBe(`/api/media-public/${up.body.publicToken}`);

    const blob = await request(app.getHttpServer())
      .get(`/api/media/blob/${up.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(blob.status).toBe(200);
    expect(blob.headers['content-type']).toMatch(/image\/webp/);
    expect((await sharp(blob.body).metadata()).width).toBe(1);
  });

  it('serves an uploaded asset at its src with no Authorization header', async () => {
    const up = await request(app.getHttpServer())
      .post('/api/media/upload?kind=photo')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', PNG_BYTES, { filename: 'pixel.png', contentType: 'image/png' });
    expect(up.status).toBe(201);

    const anon = await request(app.getHttpServer()).get(up.body.src);
    expect(anon.status).toBe(200);
    expect(anon.headers['content-type']).toMatch(/image\/webp/);
    expect((await sharp(anon.body).metadata()).width).toBe(1);
  });

  it('POST /api/files/upload writes to the VFS and serves /api/files/blob', async () => {
    const up = await request(app.getHttpServer())
      .post('/api/files/upload?path=/Pictures/pixel.png')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', PNG_BYTES, { filename: 'pixel.png', contentType: 'image/png' });
    expect(up.status).toBe(201);
    expect(up.body.path).toBe('/Pictures/pixel.png');

    const blob = await request(app.getHttpServer())
      .get('/api/files/blob?path=/Pictures/pixel.png')
      .set('Authorization', `Bearer ${token}`);
    expect(blob.status).toBe(200);
    expect(Buffer.compare(blob.body, PNG_BYTES)).toBe(0);
  });
});
