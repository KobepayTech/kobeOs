import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { ensureSession } from './auth';

export interface ApiResourceState<T> {
  items: T[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  create: (data: Partial<T>) => Promise<T>;
  update: (id: string, patch: Partial<T>) => Promise<T>;
  remove: (id: string) => Promise<void>;
  ready: boolean;
}

/**
 * Generic owned-resource hook. Bootstraps a session, fetches `path`,
 * exposes CRUD that keeps local state in sync with the server.
 */
export function useApiResource<T extends { id: string }>(path: string): ApiResourceState<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    try {
      const list = await api<T[]>(path);
      setItems(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [path]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensureSession();
        if (cancelled) return;
        await reload();
        if (!cancelled) setReady(true);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reload]);

  const create = useCallback(async (data: Partial<T>) => {
    const created = await api<T>(path, { method: 'POST', body: JSON.stringify(data) });
    setItems((prev) => [created, ...prev]);
    return created;
  }, [path]);

  const update = useCallback(async (id: string, patch: Partial<T>) => {
    const updated = await api<T>(`${path}/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
    setItems((prev) => prev.map((it) => (it.id === id ? updated : it)));
    return updated;
  }, [path]);

  const remove = useCallback(async (id: string) => {
    await api(`${path}/${id}`, { method: 'DELETE' });
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, [path]);

  return { items, loading, error, reload, create, update, remove, ready };
}
