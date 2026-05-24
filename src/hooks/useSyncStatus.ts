/**
 * useSyncStatus — subscribes to sync engine events and exposes current status.
 *
 * Works only in Electron; returns a safe default in browser dev mode.
 */

import { useState, useEffect } from 'react';

export interface SyncStatus {
  online: boolean;
  syncing: boolean;
  queueDepth: number;
  lastEvent: string | null;
}

const DEFAULT: SyncStatus = { online: true, syncing: false, queueDepth: 0, lastEvent: null };

export function useSyncStatus(): SyncStatus & { forceSync: () => Promise<void> } {
  const [status, setStatus] = useState<SyncStatus>(DEFAULT);

  useEffect(() => {
    const sync = (window as any).kobeOS?.sync;
    if (!sync) return;

    // Fetch initial status
    sync.status().then((s: SyncStatus) => setStatus(s)).catch(() => {});

    // Subscribe to live events from the sync engine
    const unsub = sync.onEvent((data: { type: string; [k: string]: unknown }) => {
      sync.status().then((s: SyncStatus) => {
        setStatus({ ...s, lastEvent: data.type ?? null });
      }).catch(() => {});
    });

    return unsub;
  }, []);

  const forceSync = async () => {
    const sync = (window as any).kobeOS?.sync;
    if (sync) await sync.forceSync();
  };

  return { ...status, forceSync };
}
