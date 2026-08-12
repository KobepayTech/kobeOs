import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ── socket.io-client mock ─────────────────────────────────────────────────────

const socketHandlers: Record<string, (...args: unknown[]) => void> = {};
const mockSocket = {
  on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
    socketHandlers[event] = cb;
    return mockSocket;
  }),
  emit: vi.fn(),
  disconnect: vi.fn(),
};
vi.mock('socket.io-client', () => ({ io: vi.fn(() => mockSocket) }));

// ── REST feed mock ────────────────────────────────────────────────────────────

const getLive = vi.fn<[], Promise<unknown[]>>(async () => []);
vi.mock('../api', () => ({ matchesApi: { getLive: () => getLive() } }));

const fire = (event: string, ...args: unknown[]) => act(() => { socketHandlers[event]?.(...args); });

describe('useLiveMatches', () => {
  beforeEach(() => {
    for (const k of Object.keys(socketHandlers)) delete socketHandlers[k];
    mockSocket.on.mockClear();
    mockSocket.disconnect.mockClear();
    getLive.mockReset();
    getLive.mockResolvedValue([]);
  });

  it('starts disconnected and empty', async () => {
    const { useLiveMatches } = await import('../useLiveMatches');
    const { result } = renderHook(() => useLiveMatches());
    expect(result.current.connected).toBe(false);
    expect(result.current.liveMatches).toEqual([]);
  });

  it('registers a socket.io connection and lifecycle handlers', async () => {
    const { useLiveMatches } = await import('../useLiveMatches');
    renderHook(() => useLiveMatches());
    expect(socketHandlers.connect).toBeDefined();
    expect(socketHandlers.disconnect).toBeDefined();
    expect(socketHandlers['match:started']).toBeDefined();
  });

  it('sets connected=true on socket connect', async () => {
    const { useLiveMatches } = await import('../useLiveMatches');
    const { result } = renderHook(() => useLiveMatches());
    fire('connect');
    expect(result.current.connected).toBe(true);
  });

  it('loads live matches from the REST feed', async () => {
    getLive.mockResolvedValue([
      { id: 'm1', homeTeam: 'Kobe FC', awayTeam: 'City United', status: 'LIVE', homeScore: 1, awayScore: 0 },
    ]);
    const { useLiveMatches } = await import('../useLiveMatches');
    const { result } = renderHook(() => useLiveMatches());
    await waitFor(() => expect(result.current.liveMatches).toHaveLength(1));
    expect(result.current.liveMatches[0].homeTeam).toBe('Kobe FC');
  });

  it('refetches when a match lifecycle event arrives', async () => {
    const { useLiveMatches } = await import('../useLiveMatches');
    renderHook(() => useLiveMatches());
    await waitFor(() => expect(getLive).toHaveBeenCalled());
    const before = getLive.mock.calls.length;
    fire('match:started');
    expect(getLive.mock.calls.length).toBeGreaterThan(before);
  });

  it('sets connected=false on disconnect', async () => {
    const { useLiveMatches } = await import('../useLiveMatches');
    const { result } = renderHook(() => useLiveMatches());
    fire('connect');
    expect(result.current.connected).toBe(true);
    fire('disconnect');
    expect(result.current.connected).toBe(false);
  });

  it('disconnects the socket on unmount', async () => {
    const { useLiveMatches } = await import('../useLiveMatches');
    const { unmount } = renderHook(() => useLiveMatches());
    unmount();
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });
});
