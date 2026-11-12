import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { apiBase, ApiError, getToken } from '@/lib/api';

export function useOrderQueue<T>(load: (signal: AbortSignal) => Promise<T[]>, { enabled = true, live = false, onCreated }: { enabled?: boolean; live?: boolean; onCreated?: () => void } = {}) {
  const [queue, setQueue] = useState<{ rows: T[] | null; error: string; lastSynced: number | null }>({
    rows: null, error: '', lastSynced: null,
  });
  const refresh = useRef<() => void>(() => {});

  useEffect(() => {
    setQueue({ rows: null, error: '', lastSynced: null });
    if (!enabled) return;

    let stopped = false;
    let request: AbortController | undefined;
    let refreshAgain = false;
    const sync = async () => {
      if (request) {
        refreshAgain = true;
        return;
      }
      request = new AbortController();
      const timeout = window.setTimeout(() => request?.abort(), 8000);
      try {
        const rows = await load(request.signal);
        if (!stopped) setQueue({ rows, error: '', lastSynced: Date.now() });
      } catch (error) {
        if (stopped) return;
        const denied = error instanceof ApiError && [401, 403].includes(error.status);
        const message = denied ? error.message : 'Connection interrupted. Retrying…';
        setQueue(previous => ({ ...previous, rows: denied ? null : previous.rows, error: message }));
      } finally {
        window.clearTimeout(timeout);
        request = undefined;
        if (refreshAgain && !stopped) {
          refreshAgain = false;
          void sync();
        }
      }
    };

    refresh.current = () => { void sync(); };
    const onOnline = () => { void sync(); };
    const onOffline = () => setQueue(previous => ({ ...previous, error: 'Connection interrupted. Retrying…' }));
    const interval = window.setInterval(onOnline, 5000);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const socket = live ? io(`${apiBase().replace(/\/api\/?$/, '')}/pos`, {
      auth: callback => callback({ token: getToken() }),
      transports: ['websocket'],
    }) : undefined;
    socket?.on('connect', onOnline);
    socket?.on('kds:order', (event: { kind?: string }) => {
      onOnline();
      if (event?.kind === 'created') onCreated?.();
    });
    socket?.on('disconnect', onOnline);
    void sync();

    return () => {
      stopped = true;
      request?.abort();
      socket?.disconnect();
      window.clearInterval(interval);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      refresh.current = () => {};
    };
  }, [enabled, live, load, onCreated]);

  return { ...queue, refresh: () => refresh.current() };
}
