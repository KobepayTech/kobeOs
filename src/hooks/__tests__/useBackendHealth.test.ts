import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useBackendHealth } from '../useBackendHealth';

const mocks = vi.hoisted(() => ({ notify: vi.fn(), discover: vi.fn(), setBase: vi.fn() }));
vi.mock('@/os/store', () => ({ useOSStore: () => mocks.notify }));
vi.mock('@/lib/api', () => ({ API_BASE: '/api', apiBase: () => '/api', markBackendReachable: vi.fn(), setRuntimeApiBase: mocks.setBase }));
vi.mock('@/lib/lan', () => ({ discoverLanBase: mocks.discover, probeBase: vi.fn() }));
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); mocks.discover.mockResolvedValue(null); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const response = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
it('reports database failure as degraded and recovers on the next poll', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(response(503, { status: 'error', db: 'disconnected' }))
    .mockResolvedValue(response(200, { status: 'ok', db: 'connected' }));
  vi.stubGlobal('fetch', fetcher);
  const { result } = renderHook(useBackendHealth);
  await act(async () => {});
  expect(result.current.status).toBe('degraded');
  expect(mocks.discover).not.toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
  expect(result.current.status).toBe('online');
  expect(fetcher.mock.calls[0][1].cache).toBe('no-store');
});
it('keeps a single poll when focus and online events arrive during a request', async () => {
  let resolve!: (value: Response) => void;
  const fetcher = vi.fn().mockImplementation(() => new Promise<Response>((done) => { resolve = done; }));
  vi.stubGlobal('fetch', fetcher);
  renderHook(useBackendHealth);
  act(() => { window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('online')); });
  expect(fetcher).toHaveBeenCalledTimes(1);
  await act(async () => { resolve(response(200, { status: 'ok', db: 'connected' })); });
  await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it('does not switch API endpoints after unmount during LAN discovery', async () => {
  let resolve!: (value: string) => void;
  mocks.discover.mockImplementation(() => new Promise<string>((done) => { resolve = done; }));
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  const { unmount } = renderHook(useBackendHealth);
  await act(async () => {});
  unmount();
  await act(async () => { resolve('http://192.168.1.2/api'); });
  expect(mocks.setBase).not.toHaveBeenCalled();
});
