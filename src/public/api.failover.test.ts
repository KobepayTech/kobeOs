import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const PRIMARY = 'https://primary.example/api';
const BACKUP = 'https://backup.example/api';

describe('public API dual-origin failover', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_API_BASE', PRIMARY);
    vi.stubEnv('VITE_API_FALLBACK_BASE', BACKUP);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('retries a read on the backup origin for an outage-class response', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('cloudflare unavailable', { status: 530 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 'hotel-1' }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const { publicApi, publicApiBase } = await import('./api');
    const result = await publicApi<Array<{ id: string }>>('/lala-public/search');

    expect(result).toEqual([{ id: 'hotel-1' }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toBe(`${PRIMARY}/lala-public/search`);
    expect(String(fetchMock.mock.calls[1][0])).toBe(`${BACKUP}/lala-public/search`);
    expect(publicApiBase()).toBe(BACKUP);
  });

  it('does not fail over ordinary 4xx application responses', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('not found', { status: 404 }));

    const { publicApi } = await import('./api');

    await expect(publicApi('/lala-public/missing')).rejects.toThrow('API 404');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('health-selects one origin for a write and sends the transaction once', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('primary down', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ok' }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ booking: { id: 'booking-1' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const { publicApi } = await import('./api');
    const result = await publicApi<{ booking: { id: string } }>('/lala-public/bookings', {
      method: 'POST',
      body: JSON.stringify({ hotelId: 'hotel-1' }),
    });

    expect(result.booking.id).toBe('booking-1');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[0][0])).toBe(`${PRIMARY}/health`);
    expect(String(fetchMock.mock.calls[1][0])).toBe(`${BACKUP}/health`);
    expect(String(fetchMock.mock.calls[2][0])).toBe(`${BACKUP}/lala-public/bookings`);
    expect(fetchMock.mock.calls[2][1]?.method).toBe('POST');
  });

  it('never replays a write when the selected origin fails after the probe', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ok' }), { status: 200 }))
      .mockRejectedValueOnce(new TypeError('connection dropped'));

    const { publicApi } = await import('./api');

    await expect(
      publicApi('/lala-public/bookings', {
        method: 'POST',
        body: JSON.stringify({ hotelId: 'hotel-1' }),
      }),
    ).rejects.toThrow('was not automatically replayed');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toBe(`${PRIMARY}/health`);
    expect(String(fetchMock.mock.calls[1][0])).toBe(`${PRIMARY}/lala-public/bookings`);
  });
});
