import { afterEach, expect, it, vi } from 'vitest';
import { probeBase } from './lan';
afterEach(() => vi.unstubAllGlobals());
it.each([{ status: 'ok' }, { status: 'ok', db: 'disconnected' }])('rejects an unverified database: %j', async (body) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body)));
  expect(await probeBase('/api')).toBe(false);
});
it('accepts a verified healthy database', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ status: 'ok', db: 'connected' })));
  expect(await probeBase('/api')).toBe(true);
});
