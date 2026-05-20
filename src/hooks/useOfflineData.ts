/**
 * useOfflineData — load data from SQLite cache first, then sync from backend.
 *
 * Usage:
 *   const { data, loading } = useOfflineData<Room>('hotel_rooms', ROOMS, '/hotel/rooms');
 *
 * Behaviour:
 *   1. Immediately returns SQLite rows if any exist (instant, no flicker)
 *   2. Falls back to `seed` array if SQLite is empty (first run)
 *   3. Fetches from backend in background and updates state + cache
 *   4. Offline: stays on SQLite / seed data, no error thrown
 */

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';

interface Options<T> {
  /** SQLite table name */
  table: string;
  /** API path to fetch from backend */
  apiPath: string;
  /** Fallback seed data shown on first run before any cache exists */
  seed: T[];
  /** Map backend response rows to local shape (optional) */
  transform?: (row: unknown) => T;
}

interface Result<T> {
  data: T[];
  loading: boolean;
  setData: React.Dispatch<React.SetStateAction<T[]>>;
}

export function useOfflineData<T extends { id?: string | number }>(
  opts: Options<T>,
): Result<T> {
  const { table, apiPath, seed, transform } = opts;
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;

    async function load() {
      const localDb = (window as any).kobeOS?.db;

      // Step 1: load from SQLite immediately
      if (localDb) {
        try {
          const rows = await localDb.query(table) as T[];
          const live = rows.filter((r: any) => !r.deleted);
          if (!cancelled && live.length > 0) {
            setData(live);
            setLoading(false);
          }
        } catch { /* SQLite not ready yet */ }
      }

      // Step 2: fetch from backend (api() handles offline fallback internally)
      try {
        const remote = await api<unknown[]>(apiPath);
        if (cancelled) return;
        if (Array.isArray(remote) && remote.length > 0) {
          const mapped = transform ? remote.map(transform) : remote as T[];
          setData(mapped);
          // Persist to SQLite
          if (localDb) {
            for (const row of mapped) {
              if (row && (row as any).id) {
                localDb.insert(table, { ...(row as object), synced: 1 }).catch(() => {});
              }
            }
          }
        } else if (data.length === 0) {
          // Backend empty + no cache → use seed
          setData(seed);
          // Seed SQLite so next offline launch has data
          if (localDb) {
            for (const row of seed) {
              if (row && (row as any).id) {
                localDb.insert(table, { ...(row as object), synced: 0 }).catch(() => {});
              }
            }
          }
        }
      } catch {
        // Offline and no cache → use seed
        if (!cancelled && data.length === 0) setData(seed);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; mounted.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiPath, table]);

  return { data, loading, setData };
}
