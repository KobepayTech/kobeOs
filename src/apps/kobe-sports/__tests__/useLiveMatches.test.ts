import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ── WebSocket mock ────────────────────────────────────────────────────────────

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) { this.sentMessages.push(data); }
  close() { this.onclose?.(); }

  // Test helpers
  simulateOpen() { act(() => { this.onopen?.(); }); }
  simulateMessage(data: string) { act(() => { this.onmessage?.({ data }); }); }
  simulateError() { act(() => { this.onerror?.(); }); }
}

vi.stubGlobal('WebSocket', MockWebSocket);

describe('useLiveMatches', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: { protocol: 'http:', host: 'localhost:5173' },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('starts disconnected', async () => {
    const { useLiveMatches } = await import('../useLiveMatches');
    const { result } = renderHook(() => useLiveMatches());

    expect(result.current.connected).toBe(false);
    expect(result.current.liveMatches).toEqual([]);
  });

  it('sets connected=true on WebSocket open', async () => {
    const { useLiveMatches } = await import('../useLiveMatches');
    const { result } = renderHook(() => useLiveMatches());

    const ws = MockWebSocket.instances[0];
    expect(ws).toBeDefined();

    ws.simulateOpen();
    expect(result.current.connected).toBe(true);
  });

  it('sends connect and get-live-matches packets on open', async () => {
    const { useLiveMatches } = await import('../useLiveMatches');
    renderHook(() => useLiveMatches());

    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();

    expect(ws.sentMessages).toContain('40/sports,');
    expect(ws.sentMessages).toContain('42/sports,["get-live-matches"]');
  });

  it('parses live-matches event and updates state', async () => {
    const { useLiveMatches } = await import('../useLiveMatches');
    const { result } = renderHook(() => useLiveMatches());

    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();

    const matches = [
      { id: 'm1', homeTeam: 'Kobe FC', awayTeam: 'City United', status: 'LIVE', homeScore: 1, awayScore: 0 },
    ];
    ws.simulateMessage(`42/sports,["live-matches",${JSON.stringify(matches)}]`);

    expect(result.current.liveMatches).toHaveLength(1);
    expect(result.current.liveMatches[0].homeTeam).toBe('Kobe FC');
  });

  it('ignores non-sports namespace messages', async () => {
    const { useLiveMatches } = await import('../useLiveMatches');
    const { result } = renderHook(() => useLiveMatches());

    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();
    ws.simulateMessage('42["some-other-event",{}]');

    expect(result.current.liveMatches).toEqual([]);
  });

  it('sets connected=false on close', async () => {
    const { useLiveMatches } = await import('../useLiveMatches');
    const { result } = renderHook(() => useLiveMatches());

    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();
    expect(result.current.connected).toBe(true);

    act(() => { ws.onclose?.(); });
    expect(result.current.connected).toBe(false);
  });

  it('closes WebSocket on unmount', async () => {
    const { useLiveMatches } = await import('../useLiveMatches');
    const { unmount } = renderHook(() => useLiveMatches());

    const ws = MockWebSocket.instances[0];
    const closeSpy = vi.spyOn(ws, 'close');

    unmount();
    expect(closeSpy).toHaveBeenCalled();
  });
});
