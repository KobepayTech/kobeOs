import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from './src/index.mjs';

const unreachable = () => { throw new Error('Local server is offline'); };

test('Lala, Jumla, apex and a first-time shop visitor load with the local server and API down', async () => {
  for (const host of ['lala', 'jumla', 'new-shop', 'www', '']) {
    for (const path of ['/', '/book/example', '/assets/main.js']) {
      let assetCalls = 0;
      const response = await handleRequest(new Request(`https://${host ? host + '.' : ''}kobeapptz.com${path}`), {
        API: { fetch: unreachable }, RELEASE_REVISION: 'tested-release',
        ASSETS: { fetch: async request => { assetCalls++; assert.equal(new URL(request.url).pathname, path); return new Response('cloud asset', { headers: { 'Content-Type': 'text/html' } }); } },
      }, unreachable);
      assert.equal(response.status, 200);
      assert.equal(await response.text(), 'cloud asset');
      assert.equal(assetCalls, 1);
      assert.equal(response.headers.get('X-Kobe-Public-Hosting'), 'cloudflare-assets');
      assert.equal(response.headers.get('X-Kobe-Public-Revision'), 'tested-release');
    }
  }
});

test('API requests use the cloud binding once, preserving method, body and authentication', async () => {
  let calls = 0;
  const request = new Request('https://lala.kobeapptz.com/api/lala-public/bookings', { method: 'POST', body: '{"roomId":"one"}', headers: { Authorization: 'Bearer example' } });
  const response = await handleRequest(request, {
    ASSETS: { fetch: unreachable },
    API: { fetch: async incoming => { calls++; assert.equal(incoming.method, 'POST'); assert.equal(await incoming.text(), '{"roomId":"one"}'); assert.equal(incoming.headers.get('Authorization'), 'Bearer example'); return Response.json({ pending: true }, { status: 201 }); } },
  }, unreachable);
  assert.equal(response.status, 201);
  assert.equal(calls, 1);
});

test('an unavailable API returns 503, never HTML or a successful booking', async () => {
  let calls = 0;
  const response = await handleRequest(new Request('https://jumla.kobeapptz.com/api/orders', { method: 'POST', body: '{}' }), {
    ASSETS: { fetch: unreachable }, API: { fetch: () => { calls++; return unreachable(); } },
  }, unreachable);
  assert.equal(response.status, 503);
  assert.match(response.headers.get('Content-Type'), /json/);
  assert.equal(calls, 1);
});

test('shop media stays on the shop origin and is never cached or uploaded', async () => {
  let calls = 0;
  const response = await handleRequest(new Request('https://myshop.kobeapptz.com/api/media/item.jpg'), {
    ASSETS: { fetch: unreachable }, API: { fetch: unreachable },
  }, async (request, options) => { calls++; assert.equal(request.url, 'https://myshop.kobeapptz.com/api/media/item.jpg'); assert.equal(options.cache, 'no-store'); assert.equal(options.cf.cacheTtl, 0); return new Response('shop image', { headers: { 'Cache-Control': 'public, max-age=3600' } }); });
  assert.equal(await response.text(), 'shop image');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(calls, 1);
});

test('hotel media uses cloud API and API host never receives a frontend', async () => {
  for (const url of ['https://lala.kobeapptz.com/api/media/hotel.jpg', 'https://api.kobeapptz.com/api/health']) {
    const response = await handleRequest(new Request(url), { ASSETS: { fetch: unreachable }, API: { fetch: async () => new Response('cloud API') } }, unreachable);
    assert.equal(await response.text(), 'cloud API');
  }
});

test('non-API writes cannot be mistaken for a successful SPA response', async () => {
  const response = await handleRequest(new Request('https://lala.kobeapptz.com/book', { method: 'POST' }), { ASSETS: { fetch: unreachable } }, unreachable);
  assert.equal(response.status, 405);
});
