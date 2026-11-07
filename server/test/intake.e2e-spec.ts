import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import sharp from 'sharp';
import { bootTestApp, resetDb } from './setup';
import { IntakeItem } from '../src/intake/intake.entity';
import { PosProduct } from '../src/pos/pos.entity';
import { HotelMenuItem, HotelRoom } from '../src/hotel/hotel.entity';

/**
 * Guided catalogue intake, end to end.
 *
 * The point of the feature is that a merchant uploads once and then answers a
 * few questions per photo, so these tests follow that path rather than poking
 * at pieces: upload, read the question, answer it, and check a real catalogue
 * entry exists afterwards.
 *
 * No AI model is installed in the test environment, which is the common case
 * on a shop machine too — so this also covers the degraded path, where the
 * questions arrive with nothing prefilled and still work.
 */
describe('Guided catalogue intake (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let ds: DataSource;

  beforeAll(async () => {
    app = await bootTestApp();
    http = app.getHttpServer();
    ds = app.get(DataSource);
  }, 180_000);
  afterAll(async () => { await app?.close(); });
  beforeEach(async () => { await resetDb(app); });

  const signUp = async (email: string) => {
    const res = await request(http).post('/api/auth/register').send({ email, password: 'secret123' });
    expect(res.status).toBe(201);
    return { token: res.body.accessToken as string, id: res.body.user.id as string };
  };
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  /** A real PNG, so sharp has something genuine to convert. */
  const photo = (seed: number) => sharp({
    create: {
      width: 40, height: 40, channels: 3,
      background: { r: (seed * 40) % 255, g: 90, b: 160 },
    },
  }).png().toBuffer();

  /** A shop to stock. The real flow creates this during onboarding. */
  const giveShop = async (token: string, slug: string) => {
    const res = await request(http).post('/api/commerce/businesses').set(auth(token))
      .send({ name: `Intake Shop ${slug}`, publicSlug: `intake-${slug}` });
    expect(res.status).toBe(201);
    return res.body;
  };

  let shopSeq = 0;
  const startSession = async (token: string, kind: string, count = 2) => {
    if (kind === 'SHOP_PRODUCT') {
      shopSeq += 1;
      await giveShop(token, `s${shopSeq}`);
    }
    let req = request(http).post('/api/intake/sessions').set(auth(token)).field('kind', kind);
    for (let i = 0; i < count; i += 1) {
      req = req.attach('images', await photo(i + 1), `item-${i + 1}.png`);
    }
    const res = await req;
    expect(res.status).toBe(201);
    return res.body;
  };

  describe('uploading a batch', () => {
    it('queues every photo and returns the first question', async () => {
      const me = await signUp('intake-start@e2e.test');
      const step = await startSession(me.token, 'SHOP_PRODUCT', 3);

      expect(step.kind).toBe('SHOP_PRODUCT');
      expect(step.progress).toMatchObject({ total: 3, done: 0, remaining: 3, complete: false });
      expect(step.item.position).toBe(0);
      expect(step.item.imageUrl).toMatch(/^\/api\/commerce-public\/media\//);
      expect(step.questions.map((q: { field: string }) => q.field))
        .toEqual(['name', 'size', 'price', 'stock', 'category']);
    });

    it('serves the photo straight away, before anything is described', async () => {
      // The photo is the prompt, so it has to be visible while the questions
      // are being answered — not only once a product exists.
      const me = await signUp('intake-photo@e2e.test');
      const step = await startSession(me.token, 'SHOP_PRODUCT', 1);

      const res = await request(http).get(step.item.imageUrl);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('image/webp');
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('asks a restaurant about portions and not about stock', async () => {
      const me = await signUp('intake-menu@e2e.test');
      const step = await startSession(me.token, 'RESTAURANT_MENU_ITEM', 1);

      const fields = step.questions.map((q: { field: string }) => q.field);
      expect(fields).toContain('portion');
      expect(fields).not.toContain('stock');
    });

    it('refuses an unknown kind', async () => {
      const me = await signUp('intake-kind@e2e.test');
      const res = await request(http).post('/api/intake/sessions').set(auth(me.token))
        .field('kind', 'SPACESHIP').attach('images', await photo(1), 'a.png');
      expect(res.status).toBe(400);
    });

    it('refuses a file that is not an image', async () => {
      const me = await signUp('intake-nonimage@e2e.test');
      const res = await request(http).post('/api/intake/sessions').set(auth(me.token))
        .field('kind', 'SHOP_PRODUCT')
        .attach('images', Buffer.from('not a photo'), 'notes.txt');
      expect(res.status).toBe(400);
    });

    it('refuses an empty upload rather than opening a pointless session', async () => {
      const me = await signUp('intake-empty@e2e.test');
      const res = await request(http).post('/api/intake/sessions').set(auth(me.token))
        .field('kind', 'SHOP_PRODUCT');
      expect(res.status).toBe(400);
    });

    it('refuses a shop batch before there is a shop, and says what to do', async () => {
      // Discovering this after eighty photos were uploaded and one described
      // is the wrong place to find out.
      const me = await signUp('intake-noshop@e2e.test');
      const res = await request(http).post('/api/intake/sessions').set(auth(me.token))
        .field('kind', 'SHOP_PRODUCT').attach('images', await photo(1), 'a.png');

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/set up your shop first/i);
      expect(await ds.getRepository(IntakeItem).count()).toBe(0);
    });

    it('needs authentication', async () => {
      const res = await request(http).post('/api/intake/sessions').field('kind', 'SHOP_PRODUCT');
      expect(res.status).toBe(401);
    });
  });

  describe('answering one photo at a time', () => {
    it('creates a product and moves to the next photo', async () => {
      const me = await signUp('intake-answer@e2e.test');
      const first = await startSession(me.token, 'SHOP_PRODUCT', 2);

      const res = await request(http).post(`/api/intake/items/${first.item.id}/answer`)
        .set(auth(me.token))
        .send({ answers: { name: 'Soda', size: '500ml', price: 1500, stock: 24, category: 'Drinks' } });

      expect(res.status).toBe(201);
      expect(res.body.problems).toEqual([]);
      // The size is folded in, so two sodas are distinguishable in the list.
      expect(res.body.created).toMatchObject({ name: 'Soda 500ml' });
      expect(res.body.progress).toMatchObject({ total: 2, done: 1, remaining: 1 });
      // And the next question comes back with the answer, so the person keeps
      // going without another request.
      expect(res.body.item.id).not.toBe(first.item.id);
      expect(res.body.item.position).toBe(1);

      const products = await ds.getRepository(PosProduct).find({ where: { ownerId: me.id } });
      expect(products).toHaveLength(1);
      expect(products[0]).toMatchObject({ name: 'Soda 500ml', stock: 24 });
      expect(Number(products[0].price)).toBe(1500);
    });

    it('keeps the photo on the product it became', async () => {
      const me = await signUp('intake-keeps-photo@e2e.test');
      const step = await startSession(me.token, 'SHOP_PRODUCT', 1);

      await request(http).post(`/api/intake/items/${step.item.id}/answer`).set(auth(me.token))
        .send({ answers: { name: 'Bucket', price: 5000, stock: 3 } });

      const [product] = await ds.getRepository(PosProduct).find({ where: { ownerId: me.id } });
      expect(product.imageUrl).toBe(step.item.imageUrl);
      // Still servable, which is what the storefront and the sync both need.
      expect((await request(http).get(String(product.imageUrl))).status).toBe(200);
    });

    it('reports every problem and creates nothing', async () => {
      const me = await signUp('intake-invalid@e2e.test');
      const step = await startSession(me.token, 'SHOP_PRODUCT', 1);

      const res = await request(http).post(`/api/intake/items/${step.item.id}/answer`)
        .set(auth(me.token)).send({ answers: { name: '', price: 'abc', stock: -1 } });

      expect(res.status).toBe(201);
      expect(res.body.created).toBeNull();
      expect(res.body.problems.map((p: { field: string }) => p.field)).toEqual(['name', 'price', 'stock']);
      expect(await ds.getRepository(PosProduct).count({ where: { ownerId: me.id } })).toBe(0);
      // The photo stays at the front of the queue rather than being consumed.
      expect(res.body.item.id).toBe(step.item.id);
    });

    it('remembers what was typed, so a correction does not start over', async () => {
      const me = await signUp('intake-remembers@e2e.test');
      const step = await startSession(me.token, 'SHOP_PRODUCT', 1);

      await request(http).post(`/api/intake/items/${step.item.id}/answer`).set(auth(me.token))
        .send({ answers: { name: 'Kettle', size: '2L', price: 'oops', stock: 4 } });

      const again = await request(http).get(`/api/intake/sessions/${step.sessionId}`).set(auth(me.token));
      expect(again.body.item.prefill).toMatchObject({ name: 'Kettle', size: '2L', stock: 4 });
    });

    it('finishes the batch and says so', async () => {
      const me = await signUp('intake-finish@e2e.test');
      const first = await startSession(me.token, 'SHOP_PRODUCT', 2);

      const second = await request(http).post(`/api/intake/items/${first.item.id}/answer`)
        .set(auth(me.token)).send({ answers: { name: 'One', price: 100, stock: 1 } });
      const done = await request(http).post(`/api/intake/items/${second.body.item.id}/answer`)
        .set(auth(me.token)).send({ answers: { name: 'Two', price: 200, stock: 2 } });

      expect(done.body.item).toBeNull();
      expect(done.body.progress).toMatchObject({ total: 2, done: 2, remaining: 0, complete: true });
      expect(await ds.getRepository(PosProduct).count({ where: { ownerId: me.id } })).toBe(2);
    });

    it('skips a photo and comes back to it on request', async () => {
      const me = await signUp('intake-skip@e2e.test');
      const first = await startSession(me.token, 'SHOP_PRODUCT', 2);

      const after = await request(http).post(`/api/intake/items/${first.item.id}/skip`).set(auth(me.token));
      expect(after.body.item.position).toBe(1);
      expect(after.body.progress).toMatchObject({ skipped: 1, remaining: 1 });

      const back = await request(http).post(`/api/intake/items/${first.item.id}/retry`).set(auth(me.token));
      expect(back.body.progress).toMatchObject({ skipped: 0, remaining: 2 });
    });

    it('will not re-queue a photo that already became an entry', async () => {
      const me = await signUp('intake-noretry@e2e.test');
      const step = await startSession(me.token, 'SHOP_PRODUCT', 1);
      await request(http).post(`/api/intake/items/${step.item.id}/answer`).set(auth(me.token))
        .send({ answers: { name: 'Lamp', price: 9000, stock: 2 } });

      const res = await request(http).post(`/api/intake/items/${step.item.id}/retry`).set(auth(me.token));
      expect(res.status).toBe(400);
      expect(await ds.getRepository(PosProduct).count({ where: { ownerId: me.id } })).toBe(1);
    });
  });

  describe('the other two kinds', () => {
    it('creates a hotel room from a photo', async () => {
      const me = await signUp('intake-room@e2e.test');
      const step = await startSession(me.token, 'HOTEL_ROOM', 1);

      const res = await request(http).post(`/api/intake/items/${step.item.id}/answer`)
        .set(auth(me.token))
        .send({ answers: { name: '204', roomType: 'Twin', price: 55000, capacity: 2 } });

      expect(res.body.created).toMatchObject({ name: '204' });
      const [room] = await ds.getRepository(HotelRoom).find({ where: { ownerId: me.id } });
      expect(room).toMatchObject({ roomNumber: '204', type: 'Twin', capacity: 2, status: 'available' });
      expect(Number(room.rate)).toBe(55000);
    });

    it('requires a room type, which is how a room is priced', async () => {
      const me = await signUp('intake-room-type@e2e.test');
      const step = await startSession(me.token, 'HOTEL_ROOM', 1);

      const res = await request(http).post(`/api/intake/items/${step.item.id}/answer`)
        .set(auth(me.token)).send({ answers: { name: '204', price: 55000 } });

      expect(res.body.problems.map((p: { field: string }) => p.field)).toEqual(['roomType']);
      expect(await ds.getRepository(HotelRoom).count({ where: { ownerId: me.id } })).toBe(0);
    });

    it('creates a menu item from a photo', async () => {
      const me = await signUp('intake-dish@e2e.test');
      const step = await startSession(me.token, 'RESTAURANT_MENU_ITEM', 1);

      const res = await request(http).post(`/api/intake/items/${step.item.id}/answer`)
        .set(auth(me.token))
        .send({ answers: { name: 'Pilau', portion: 'Full', price: 8000, category: 'Mains' } });

      expect(res.body.created).toMatchObject({ name: 'Pilau Full' });
      const [dish] = await ds.getRepository(HotelMenuItem).find({ where: { ownerId: me.id } });
      expect(dish).toMatchObject({ name: 'Pilau Full', category: 'Mains', available: true });
      expect(Number(dish.price)).toBe(8000);
    });
  });

  describe('surviving an interruption', () => {
    it('lists a part-finished batch so it can be picked up again', async () => {
      // A merchant photographing eighty items answers over several sittings,
      // on a phone, on a connection that drops.
      const me = await signUp('intake-resume@e2e.test');
      const first = await startSession(me.token, 'SHOP_PRODUCT', 3);
      await request(http).post(`/api/intake/items/${first.item.id}/answer`).set(auth(me.token))
        .send({ answers: { name: 'One', price: 100, stock: 1 } });

      const open = await request(http).get('/api/intake/sessions').set(auth(me.token));
      expect(open.status).toBe(200);
      expect(open.body).toHaveLength(1);
      expect(open.body[0]).toMatchObject({ kind: 'SHOP_PRODUCT' });
      expect(open.body[0].progress).toMatchObject({ total: 3, done: 1, remaining: 2 });
    });

    it('does not list a batch that is finished', async () => {
      const me = await signUp('intake-resume-done@e2e.test');
      const step = await startSession(me.token, 'SHOP_PRODUCT', 1);
      await request(http).post(`/api/intake/items/${step.item.id}/answer`).set(auth(me.token))
        .send({ answers: { name: 'Only', price: 100, stock: 1 } });

      const open = await request(http).get('/api/intake/sessions').set(auth(me.token));
      expect(open.body).toEqual([]);
    });

    it('asks the model once per photo and not on every poll', async () => {
      // Vision is slow and no model is installed here. Retrying on each poll
      // would stall the queue for a feature that is optional.
      const me = await signUp('intake-once@e2e.test');
      const step = await startSession(me.token, 'SHOP_PRODUCT', 1);

      await request(http).get(`/api/intake/sessions/${step.sessionId}`).set(auth(me.token));
      await request(http).get(`/api/intake/sessions/${step.sessionId}`).set(auth(me.token));

      const [item] = await ds.getRepository(IntakeItem).find({ where: { ownerId: me.id } });
      expect(item.suggestionAttempted).toBe(true);
    });

    it('still works with no model installed, just without prefilled answers', async () => {
      const me = await signUp('intake-nomodel@e2e.test');
      const step = await startSession(me.token, 'SHOP_PRODUCT', 1);

      expect(step.item.prefill).toEqual({});
      const res = await request(http).post(`/api/intake/items/${step.item.id}/answer`)
        .set(auth(me.token)).send({ answers: { name: 'Typed by hand', price: 2000, stock: 5 } });
      expect(res.body.created).toMatchObject({ name: 'Typed by hand' });
    });
  });

  describe('the richer shop answer', () => {
    it('creates one product with a sellable variant per size and colour', async () => {
      // A shelf holds "Shirt blue M" and "Shirt red L" as separate things to
      // sell; one price and one stock figure per photo cannot say that.
      const me = await signUp('intake-variants@e2e.test');
      const step = await startSession(me.token, 'SHOP_PRODUCT', 1);

      const res = await request(http).post(`/api/intake/items/${step.item.id}/answer`)
        .set(auth(me.token)).send({
          answers: {
            name: 'Shirt', price: 25000, stock: 0, category: 'Clothing',
            variants: [
              { size: 'M', color: 'Blue', price: 25000, stock: 4 },
              { size: 'L', color: 'Red', price: 27000, stock: 2 },
            ],
          },
        });

      expect(res.body.problems).toEqual([]);
      const [product] = await ds.getRepository(PosProduct).find({ where: { ownerId: me.id } });
      expect(product.variants).toHaveLength(2);
      expect(product.variants.map((v) => v.name)).toEqual(['Blue / M', 'Red / L']);
      // Stock becomes the sum, because the shelf holds six, not the zero typed
      // against the photo.
      expect(product.stock).toBe(6);
      // Each combination gets its own SKU, so the till knows what was bought.
      expect(new Set(product.variants.map((v) => v.sku)).size).toBe(2);
    });

    it('requires size and colour choices when every variant has both', async () => {
      const me = await signUp('intake-required@e2e.test');
      const step = await startSession(me.token, 'SHOP_PRODUCT', 1);

      await request(http).post(`/api/intake/items/${step.item.id}/answer`).set(auth(me.token))
        .send({
          answers: {
            name: 'Shirt', price: 25000, stock: 0,
            variants: [
              { size: 'M', color: 'Blue', price: 25000, stock: 4 },
              { size: 'L', color: 'Red', price: 27000, stock: 2 },
            ],
          },
        });

      const [product] = await ds.getRepository(PosProduct).find({ where: { ownerId: me.id } });
      expect(product.customData.requiredOptions).toEqual(['size', 'color']);
    });

    it('refuses the same size and colour twice, and creates nothing', async () => {
      const me = await signUp('intake-dupvariant@e2e.test');
      const step = await startSession(me.token, 'SHOP_PRODUCT', 1);

      const res = await request(http).post(`/api/intake/items/${step.item.id}/answer`)
        .set(auth(me.token)).send({
          answers: {
            name: 'Shirt', price: 25000, stock: 1,
            variants: [
              { size: 'M', color: 'Blue', price: 1, stock: 1 },
              { size: 'm', color: 'blue', price: 1, stock: 1 },
            ],
          },
        });

      expect(res.body.created).toBeNull();
      expect(res.body.problems.map((p: { field: string }) => p.field)).toEqual(['variants[1]']);
      expect(await ds.getRepository(PosProduct).count({ where: { ownerId: me.id } })).toBe(0);
    });

    it('stores a discount reference without exposing it in catalogue reads', async () => {
      const me = await signUp('intake-discount@e2e.test');
      const first = await startSession(me.token, 'SHOP_PRODUCT', 2);

      const good = await request(http).post(`/api/intake/items/${first.item.id}/answer`)
        .set(auth(me.token))
        .send({ answers: { name: 'Shoes', price: 60000, stock: 3, discountPrice: 48000 } });
      expect(good.body.problems).toEqual([]);
      // Read explicitly: the column is select:false so a negotiated-price
      // reference cannot leak into a catalogue response by accident.
      const stored = await ds.getRepository(PosProduct).createQueryBuilder('p')
        .addSelect('p.discountReferencePrice')
        .where('p."ownerId" = :owner', { owner: me.id }).getOne();
      expect(Number(stored?.discountReferencePrice)).toBe(48000);

      // And an ordinary read does not carry it.
      const [plain] = await ds.getRepository(PosProduct).find({ where: { ownerId: me.id } });
      expect(plain.discountReferencePrice).toBeUndefined();

      const bad = await request(http).post(`/api/intake/items/${good.body.item.id}/answer`)
        .set(auth(me.token))
        .send({ answers: { name: 'Hat', price: 10000, stock: 1, discountPrice: 12000 } });
      expect(bad.body.problems.map((p: { field: string }) => p.field)).toEqual(['discountPrice']);
    });
  });

  describe('a photo of a room type', () => {
    it('creates one room per number behind a single photo', async () => {
      // A hotel has several identical rooms and one photo of them.
      const me = await signUp('intake-roombatch@e2e.test');
      const step = await startSession(me.token, 'HOTEL_ROOM', 1);

      const res = await request(http).post(`/api/intake/items/${step.item.id}/answer`)
        .set(auth(me.token)).send({
          answers: {
            name: 'Standard twin', roomType: 'Twin', price: 45000, capacity: 2,
            roomNumbers: ['201', '202', '203'],
          },
        });

      expect(res.body.problems).toEqual([]);
      expect(res.body.created.name).toMatch(/3 rooms/);
      const rooms = await ds.getRepository(HotelRoom).find({ where: { ownerId: me.id } });
      expect(rooms.map((r) => r.roomNumber).sort()).toEqual(['201', '202', '203']);
      for (const room of rooms) {
        expect(room).toMatchObject({ type: 'Twin', capacity: 2, status: 'available' });
        expect(room.imageUrl).toBe(step.item.imageUrl);
      }
    });

    it('refuses a number that already exists rather than making a twin of it', async () => {
      // Two rooms called 201 cannot both be booked.
      const me = await signUp('intake-roomclash@e2e.test');
      const first = await startSession(me.token, 'HOTEL_ROOM', 2);
      await request(http).post(`/api/intake/items/${first.item.id}/answer`).set(auth(me.token))
        .send({ answers: { name: 'Twin', roomType: 'Twin', price: 45000, roomNumbers: ['201'] } });

      const step = await request(http).get(`/api/intake/sessions/${first.sessionId}`).set(auth(me.token));
      const res = await request(http).post(`/api/intake/items/${step.body.item.id}/answer`)
        .set(auth(me.token))
        .send({ answers: { name: 'Twin', roomType: 'Twin', price: 45000, roomNumbers: ['201', '202'] } });

      expect(res.body.created).toBeNull();
      // The photo is marked failed with the reason, and stays recoverable.
      const items = await ds.getRepository(IntakeItem).find({ where: { ownerId: me.id } });
      const failed = items.find((item) => item.status === 'FAILED');
      expect(failed?.lastError).toMatch(/Room 201 already exists/i);
      expect(await ds.getRepository(HotelRoom).count({ where: { ownerId: me.id } })).toBe(1);
    });

    it('still makes a single room when no numbers are given', async () => {
      const me = await signUp('intake-oneroom@e2e.test');
      const step = await startSession(me.token, 'HOTEL_ROOM', 1);

      await request(http).post(`/api/intake/items/${step.item.id}/answer`).set(auth(me.token))
        .send({ answers: { name: '301', roomType: 'Double', price: 50000 } });

      const rooms = await ds.getRepository(HotelRoom).find({ where: { ownerId: me.id } });
      expect(rooms.map((r) => r.roomNumber)).toEqual(['301']);
    });

    it('refuses two rooms sharing a number inside one batch', async () => {
      const me = await signUp('intake-roomdup@e2e.test');
      const step = await startSession(me.token, 'HOTEL_ROOM', 1);

      const res = await request(http).post(`/api/intake/items/${step.item.id}/answer`)
        .set(auth(me.token)).send({
          answers: { name: 'Twin', roomType: 'Twin', price: 45000, roomNumbers: ['201', '201'] },
        });

      expect(res.body.problems.map((p: { field: string }) => p.field)).toEqual(['roomNumbers']);
      expect(await ds.getRepository(HotelRoom).count({ where: { ownerId: me.id } })).toBe(0);
    });
  });

  describe('ownership', () => {
    it('keeps one merchant out of another batch', async () => {
      const mine = await signUp('intake-mine@e2e.test');
      const theirs = await signUp('intake-theirs@e2e.test');
      const step = await startSession(theirs.token, 'SHOP_PRODUCT', 1);

      expect((await request(http).get(`/api/intake/sessions/${step.sessionId}`).set(auth(mine.token))).status).toBe(404);
      expect((await request(http).post(`/api/intake/items/${step.item.id}/answer`)
        .set(auth(mine.token)).send({ answers: { name: 'Theft', price: 1, stock: 1 } })).status).toBe(404);
      expect((await request(http).post(`/api/intake/items/${step.item.id}/skip`).set(auth(mine.token))).status).toBe(404);
    });
  });
});
