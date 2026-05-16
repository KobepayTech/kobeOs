import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoUpdater } from '../useAutoUpdater';

describe('useAutoUpdater', () => {
  beforeEach(() => {
    // Reset window.kobeOS between tests
    Object.defineProperty(window, 'kobeOS', { value: undefined, writable: true, configurable: true });
  });

  it('returns idle state when updater is unavailable (browser/PWA)', () => {
    const { result } = renderHook(() => useAutoUpdater());
    expect(result.current.state.status).toBe('idle');
  });

  it('subscribes to updater events when available', () => {
    let capturedCb: ((data: unknown) => void) | null = null;
    const cleanup = vi.fn();

    Object.defineProperty(window, 'kobeOS', {
      value: {
        updater: {
          check: vi.fn(),
          download: vi.fn(),
          install: vi.fn(),
          onEvent: (cb: (data: unknown) => void) => {
            capturedCb = cb;
            return cleanup;
          },
        },
      },
      writable: true,
      configurable: true,
    });

    const { result, unmount } = renderHook(() => useAutoUpdater());

    expect(capturedCb).not.toBeNull();
    expect(result.current.state.status).toBe('idle');

    // Simulate update-available event
    act(() => {
      capturedCb!({ event: 'available', version: '2.0.0' });
    });

    expect(result.current.state.status).toBe('available');
    if (result.current.state.status === 'available') {
      expect(result.current.state.version).toBe('2.0.0');
    }

    // Simulate download progress
    act(() => {
      capturedCb!({ event: 'progress', percent: 55, transferred: 100, total: 200, bytesPerSecond: 1000 });
    });

    expect(result.current.state.status).toBe('downloading');
    if (result.current.state.status === 'downloading') {
      expect(result.current.state.percent).toBe(55);
    }

    // Simulate downloaded
    act(() => {
      capturedCb!({ event: 'downloaded', version: '2.0.0' });
    });

    expect(result.current.state.status).toBe('ready');

    // Cleanup called on unmount
    unmount();
    expect(cleanup).toHaveBeenCalled();
  });

  it('transitions to error state on updater error', () => {
    let capturedCb: ((data: unknown) => void) | null = null;

    Object.defineProperty(window, 'kobeOS', {
      value: {
        updater: {
          check: vi.fn(),
          download: vi.fn(),
          install: vi.fn(),
          onEvent: (cb: (data: unknown) => void) => { capturedCb = cb; return vi.fn(); },
        },
      },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useAutoUpdater());

    act(() => {
      capturedCb!({ event: 'error', message: 'Network error' });
    });

    expect(result.current.state.status).toBe('error');
    if (result.current.state.status === 'error') {
      expect(result.current.state.message).toBe('Network error');
    }
  });

  it('resets to idle on not-available event', () => {
    let capturedCb: ((data: unknown) => void) | null = null;

    Object.defineProperty(window, 'kobeOS', {
      value: {
        updater: {
          check: vi.fn(), download: vi.fn(), install: vi.fn(),
          onEvent: (cb: (data: unknown) => void) => { capturedCb = cb; return vi.fn(); },
        },
      },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useAutoUpdater());

    act(() => { capturedCb!({ event: 'checking' }); });
    expect(result.current.state.status).toBe('checking');

    act(() => { capturedCb!({ event: 'not-available' }); });
    expect(result.current.state.status).toBe('idle');
  });

  it('exposes download, install, check actions', () => {
    const download = vi.fn();
    const install = vi.fn();
    const check = vi.fn();

    Object.defineProperty(window, 'kobeOS', {
      value: { updater: { download, install, check, onEvent: () => vi.fn() } },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useAutoUpdater());

    result.current.download();
    result.current.install();
    result.current.check();

    expect(download).toHaveBeenCalled();
    expect(install).toHaveBeenCalled();
    expect(check).toHaveBeenCalled();
  });
});
