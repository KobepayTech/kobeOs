import { ConfigService } from '@nestjs/config';
import { ContinuitySyncWorker, HttpSyncTransport } from './continuity-sync.worker';
import type { ContinuitySyncService } from './continuity-sync.service';

const configOf = (values: Record<string, string | undefined>) =>
  ({ get: (key: string) => values[key] } as unknown as ConfigService);

const TOKEN = 'a-token-that-is-at-least-32-characters';

describe('ContinuitySyncWorker', () => {
  const syncOf = (runOnce: jest.Mock) =>
    ({ runOnce } as unknown as ContinuitySyncService);

  it('does nothing when no peer is configured', async () => {
    const runOnce = jest.fn();
    const worker = new ContinuitySyncWorker(
      syncOf(runOnce), configOf({ CONTINUITY_SYNC_TOKEN: TOKEN }),
    );

    await worker.tick();

    // Desktop and single-shop installs have no cloud peer and must carry no
    // extra load for a feature they do not use.
    expect(runOnce).not.toHaveBeenCalled();
  });

  it('does nothing when the token is missing or too short to be a secret', async () => {
    const runOnce = jest.fn();
    for (const token of [undefined, '', 'short']) {
      const worker = new ContinuitySyncWorker(syncOf(runOnce), configOf({
        CONTINUITY_PEER_URL: 'https://cloud.example', CONTINUITY_SYNC_TOKEN: token,
      }));
      await worker.tick();
    }
    expect(runOnce).not.toHaveBeenCalled();
  });

  it('runs a pass once both are configured', async () => {
    const runOnce = jest.fn().mockResolvedValue({
      cataloguePushed: true, pulled: 0, absorbed: 0, failed: 0,
    });
    const worker = new ContinuitySyncWorker(syncOf(runOnce), configOf({
      CONTINUITY_PEER_URL: 'https://cloud.example/', CONTINUITY_SYNC_TOKEN: TOKEN,
    }));

    await worker.tick();

    expect(runOnce).toHaveBeenCalledTimes(1);
  });

  it('does not start a second pass while one is still running', async () => {
    let release: () => void = () => {};
    const runOnce = jest.fn().mockImplementation(
      () => new Promise((resolve) => {
        release = () => resolve({ cataloguePushed: true, pulled: 0, absorbed: 0, failed: 0 });
      }),
    );
    const worker = new ContinuitySyncWorker(syncOf(runOnce), configOf({
      CONTINUITY_PEER_URL: 'https://cloud.example', CONTINUITY_SYNC_TOKEN: TOKEN,
    }));

    const first = worker.tick();
    await worker.tick();
    expect(runOnce).toHaveBeenCalledTimes(1);

    release();
    await first;

    // And the next tick after it finishes does run.
    const second = worker.tick();
    expect(runOnce).toHaveBeenCalledTimes(2);
    release();
    await second;
  });

  it('survives a pass that throws, and keeps ticking', async () => {
    const runOnce = jest.fn()
      .mockRejectedValueOnce(new Error('peer unreachable'))
      .mockResolvedValueOnce({ cataloguePushed: true, pulled: 0, absorbed: 0, failed: 0 });
    const worker = new ContinuitySyncWorker(syncOf(runOnce), configOf({
      CONTINUITY_PEER_URL: 'https://cloud.example', CONTINUITY_SYNC_TOKEN: TOKEN,
    }));

    // An unreachable peer is the normal state during an outage, not a crash.
    await expect(worker.tick()).resolves.toBeUndefined();
    await expect(worker.tick()).resolves.toBeUndefined();
    expect(runOnce).toHaveBeenCalledTimes(2);
  });
});

describe('HttpSyncTransport', () => {
  const original = global.fetch;
  afterEach(() => { global.fetch = original; });

  const stub = (body: unknown, ok = true, status = 200) => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok, status, json: async () => body,
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  };

  it('presents the machine token on every call', async () => {
    const fetchMock = stub({ items: [] });
    await new HttpSyncTransport('https://cloud.example', TOKEN).pullOutbox(50);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://cloud.example/api/continuity/outbox?limit=50');
    expect((init.headers as Record<string, string>)['x-continuity-token']).toBe(TOKEN);
  });

  it('treats a rejected response as a failure rather than an empty result', async () => {
    stub({}, false, 401);
    // Reading a 401 as "nothing to sync" would let a token mismatch look like
    // a healthy, permanently empty backlog.
    await expect(
      new HttpSyncTransport('https://cloud.example', TOKEN).pullOutbox(10),
    ).rejects.toThrow('401');
  });

  it('returns an empty list when the peer sends no items field', async () => {
    stub({});
    await expect(
      new HttpSyncTransport('https://cloud.example', TOKEN).pullOutbox(10),
    ).resolves.toEqual([]);
  });

  it('posts the catalogue as JSON', async () => {
    const fetchMock = stub({ rooms: 0 });
    const snapshot = { hotels: [], rooms: [], allotments: [], products: [], takenAt: 'now' };
    await new HttpSyncTransport('https://cloud.example', TOKEN).pushCatalogue(snapshot);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://cloud.example/api/continuity/catalogue');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toMatchObject({ takenAt: 'now' });
  });
});
