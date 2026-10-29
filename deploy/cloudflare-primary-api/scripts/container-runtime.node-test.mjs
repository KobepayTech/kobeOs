import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (await readFile(new URL('../src/index.js', import.meta.url), 'utf8'))
  .replace("import { DurableObject } from 'cloudflare:workers';", 'class DurableObject { constructor(ctx) { this.ctx = ctx; } }');
const { KobeApiContainer, default: worker } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const env = { DB_HOST: 'db.example.com', DB_USERNAME: 'test', DB_PASSWORD: 'test-only', JWT_SECRET: 'test-only', PROVIDER_ENCRYPTION_KEY: 'test-only', APP_FRONTEND_URL: 'https://kobeos-app.pages.dev' };
function fixture({ running = false, oldImage = false, failPost = false } = {}) {
  const calls = { starts: [], requests: [], destroys: 0, probes: 0 };
  const container = {
    running, images: { api: 'registry.example/api@sha256:new' },
    async inspect() { return { image: oldImage ? 'old' : this.images.api }; },
    async destroy() { calls.destroys++; this.running = false; },
    start(options) { calls.starts.push(options); this.running = true; },
    async setInactivityTimeout(ms) { calls.timeout = ms; },
    getTcpPort(port) {
      assert.equal(port, 3000);
      return { async fetch(request) {
        if (typeof request === 'string') { calls.probes++; return Response.json({ status: 'ok', db: 'connected' }); }
        assert.equal(new URL(request.url).protocol, 'http:');
        calls.requests.push(request);
        if (failPost) throw new Error('connection lost');
        return Response.json({ method: request.method });
      } };
    },
  };
  return { calls, container, api: new KobeApiContainer({ container }, env) };
}
test('concurrent cold requests start one image with Neon credentials and forward each request once', async () => {
  const { api, calls } = fixture();
  await Promise.all([api.fetch(new Request('https://example/orders', { method: 'POST', body: 'one' })), api.fetch(new Request('https://example/orders', { method: 'POST', body: 'two' }))]);
  assert.equal(calls.starts.length, 1);
  assert.equal(calls.starts[0].image, 'registry.example/api@sha256:new');
  assert.equal(calls.starts[0].enableInternet, true);
  assert.equal(calls.starts[0].env.DB_PASSWORD, env.DB_PASSWORD);
  assert.equal(calls.starts[0].env.DB_SYNCHRONIZE, 'false');
  assert.equal(calls.starts[0].env.APP_FRONTEND_URL, env.APP_FRONTEND_URL);
  assert.equal(calls.timeout, 600000);
  assert.equal(calls.probes, 1);
  assert.equal(calls.requests.length, 2);
  assert.equal(new URL(calls.requests[0].url).pathname, '/orders');
  assert.deepEqual(await Promise.all(calls.requests.map(r => r.text())), ['one', 'two']);
});
test('replaces an old image before serving, and restarts after inactivity shutdown', async () => {
  const { api, calls, container } = fixture({ running: true, oldImage: true });
  await api.fetch(new Request('https://example/api/health'));
  assert.equal(calls.destroys, 1);
  assert.equal(calls.starts.length, 1);
  container.running = false;
  await api.fetch(new Request('https://example/api/health'));
  assert.equal(calls.starts.length, 2);
  assert.equal(calls.destroys, 1);
});
test('reuses a running current image', async () => {
  const { api, calls } = fixture({ running: true });
  await api.fetch(new Request('https://example/api/health'));
  assert.equal(calls.starts.length, 0);
  assert.equal(calls.destroys, 0);
});
test('a failed mutating request is never retried against the legacy server', async (t) => {
  t.mock.method(console, 'error', () => {});
  t.mock.method(console, 'warn', () => {});
  const { api, calls } = fixture({ failPost: true });
  const response = await worker.fetch(new Request('https://example/orders', { method: 'POST', body: 'one' }), {
    ...env, LEGACY_ORIGIN_URL: 'https://legacy.example', KOBE_API: { getByName() { return api; } },
  });
  assert.equal(response.status, 503);
  assert.equal(calls.requests.length, 1);
});

test('the public Worker normalizes HTTPS before calling the Durable Object stub', async () => {
  let forwarded;
  const response = await worker.fetch(new Request('https://public.example/orders?q=1', { method: 'POST', body: 'order', headers: { 'content-type': 'text/plain' } }), {
    KOBE_API: { getByName() { return { async fetch(request) { forwarded = request; return new Response('ok'); } }; } },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-kobe-production-path'), 'cloudflare-container');
  assert.equal(forwarded.url, 'http://public.example/orders?q=1');
  assert.equal(forwarded.method, 'POST');
  assert.equal(forwarded.headers.get('content-type'), 'text/plain');
  assert.equal(await forwarded.text(), 'order');
});
