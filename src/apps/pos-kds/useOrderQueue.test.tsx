import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useOrderQueue } from './useOrderQueue';

const handlers = vi.hoisted(() => new Map<string, () => void>());
vi.mock('socket.io-client', () => ({
  io: () => ({
    on: (event: string, listener: () => void) => handlers.set(event, listener),
    disconnect: () => handlers.clear(),
  }),
}));
vi.mock('@/lib/api', () => ({
  apiBase: () => 'https://api.example.com/api',
  getToken: () => 'test-token',
  ApiError: class extends Error {},
}));

afterEach(() => handlers.clear());

describe('KDS order queue', () => {
  it('keeps confirmed orders while disconnected and replaces the queue on reconnect', async () => {
    const load = vi.fn()
      .mockResolvedValueOnce([{ id: 'before' }])
      .mockRejectedValueOnce(new Error('disconnected'))
      .mockResolvedValueOnce([{ id: 'missed' }]);
    const { result } = renderHook(() => useOrderQueue<{ id: string }>(load, { live: true }));

    await waitFor(() => expect(result.current.rows).toEqual([{ id: 'before' }]));
    act(() => handlers.get('disconnect')?.());
    await waitFor(() => expect(result.current.error).toContain('Connection interrupted'));
    expect(result.current.rows).toEqual([{ id: 'before' }]);

    act(() => handlers.get('connect')?.());
    await waitFor(() => expect(result.current.rows).toEqual([{ id: 'missed' }]));
    expect(result.current.error).toBe('');
    expect(load).toHaveBeenCalledTimes(3);
  });
});
