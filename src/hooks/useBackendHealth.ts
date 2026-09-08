import { useEffect, useRef, useState } from 'react';
import { API_BASE, apiBase, markBackendReachable, setRuntimeApiBase } from '@/lib/api';
import { discoverLanBase, probeBase } from '@/lib/lan';
import { useOSStore } from '@/os/store';

/**
 * Live backend/database reachability for the OS shell.
 *
 * Polls GET {API_BASE}/health (which runs `SELECT 1` server-side and returns
 * { status, db }) and exposes a coarse connection state the taskbar renders as
 * a status dot. On a *transition* it fires a toast so KobeOS users see when the
 * platform connects or drops — but it stays quiet while steady so it never
 * spams the notification tray.
 */
export type BackendStatus = 'connecting' | 'online' | 'degraded' | 'offline';

export interface BackendHealth {
  status: BackendStatus;
  /** DB reachable per the server's SELECT 1 probe. */
  dbConnected: boolean;
  /** Epoch ms of the last completed probe, or 0 before the first. */
  lastChecked: number;
}

const POLL_MS = 20_000;
const TIMEOUT_MS = 8_000;

export function useBackendHealth(): BackendHealth {
  const addNotification = useOSStore((s) => s.addNotification);
  const [health, setHealth] = useState<BackendHealth>({
    status: 'connecting',
    dbConnected: false,
    lastChecked: 0,
  });

  // Previous status, so we only notify on genuine transitions (not every poll).
  const prev = useRef<BackendStatus>('connecting');

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    let activeController: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const notifyTransition = (next: BackendStatus) => {
      const was = prev.current;
      if (next === was) return;
      prev.current = next;

      // Don't celebrate the very first "connecting → online"? We DO — the user
      // asked to see that it's connected. But skip noise for connecting→*.
      if (next === 'online') {
        addNotification({
          type: 'success',
          title: 'Connected to KobeOS',
          message: 'Platform and database are online.',
        });
      } else if (next === 'degraded') {
        addNotification({
          type: 'warning',
          title: 'Database unavailable',
          message: 'KobeOS reached the server but the database is down. Some data may not load.',
        });
      } else if (next === 'offline' && was !== 'connecting') {
        addNotification({
          type: 'error',
          title: 'Connection lost',
          message: 'Cannot reach KobeOS. Reconnecting automatically; server data is temporarily unavailable.',
        });
      }
    };

    // When the current base can't be reached, try to find the same server on
    // the local WiFi and switch to it. Returns true if it switched (so the
    // caller re-probes against the new base next tick).
    const tryLanFailover = async (): Promise<boolean> => {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const found = await discoverLanBase(origin);
      if (cancelled || !found || found === apiBase()) return false;
      setRuntimeApiBase(found);
      markBackendReachable();
      if (!cancelled) {
        prev.current = 'online';
        setHealth({ status: 'online', dbConnected: true, lastChecked: Date.now() });
        addNotification({ type: 'success', title: 'Connected over WiFi', message: 'No internet — KobeOS is talking to the server directly on your local network.' });
      }
      return true;
    };

    const probe = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      const controller = new AbortController();
      activeController = controller;
      const to = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(`${apiBase()}/health`, {
          cache: 'no-store',
          signal: controller.signal,
          headers: { accept: 'application/json' },
        });
        // A non-JSON 200 (e.g. a parked-domain HTML page) is NOT our backend.
        const ct = res.headers.get('content-type') ?? '';
        const body = ct.includes('application/json') ? await res.json().catch(() => null) : null;
        const db = res.ok && body?.db === 'connected' && body?.status === 'ok';
        if (cancelled) return;
        // The API deliberately returns 503 when its database is unavailable.
        const next: BackendStatus = db ? 'online'
          : body?.status === 'error' && body?.db === 'disconnected' ? 'degraded'
          : 'offline';
        if (next === 'offline' && (await tryLanFailover())) return;
        if (cancelled) return;
        if (next === 'online') {
          markBackendReachable();
          // If we're on a LAN override but the internet base is reachable again,
          // return to it so the app isn't stuck on WiFi after the network's back.
          if (apiBase() !== API_BASE) {
            probeBase(API_BASE).then((ok) => { if (ok && !cancelled) setRuntimeApiBase(null); });
          }
        }
        setHealth({ status: next, dbConnected: db, lastChecked: Date.now() });
        notifyTransition(next);
      } catch {
        if (cancelled) return;
        if (await tryLanFailover()) return;
        if (cancelled) return;
        setHealth((h) => ({ ...h, status: 'offline', dbConnected: false, lastChecked: Date.now() }));
        notifyTransition('offline');
      } finally {
        clearTimeout(to);
        inFlight = false;
        activeController = undefined;
        if (!cancelled) timer = setTimeout(probe, POLL_MS);
      }
    };

    probe();
    // Re-probe immediately when the tab regains focus / network comes back.
    // Clear the pending scheduled probe before a manual one, so tab focus /
    // network-online events can't compound into multiple parallel poll loops.
    const onWake = () => { if (!cancelled) { if (timer) clearTimeout(timer); probe(); } };
    window.addEventListener('online', onWake);
    window.addEventListener('focus', onWake);

    return () => {
      cancelled = true;
      activeController?.abort();
      if (timer) clearTimeout(timer);
      window.removeEventListener('online', onWake);
      window.removeEventListener('focus', onWake);
    };
  }, [addNotification]);

  return health;
}
