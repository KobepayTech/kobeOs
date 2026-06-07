import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

export interface Shop {
  id: string;
  name: string;
  address: string;
  phone: string;
  region: string;
  openingFloat: number | string;
  currency: string;
  isDefault: boolean;
  active: boolean;
}

const STORAGE_KEY = 'kobeos:active-shop-id';

let cachedActiveShopId: string | null = null;
const listeners = new Set<(id: string | null) => void>();

/**
 * Source of truth for "which physical shop is the cashier currently
 * working at". Reads from localStorage so the choice survives reload,
 * exposes a setter that broadcasts to every hook consumer, and ships
 * a helper for non-React callers (lib/api retry logic, offline queue).
 */
export function getActiveShopId(): string | null {
  if (cachedActiveShopId !== null) return cachedActiveShopId;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setActiveShopId(id: string | null) {
  cachedActiveShopId = id;
  try {
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage disabled */
  }
  listeners.forEach((fn) => fn(id));
}

/**
 * Loads the merchant's shop list, picks an active one (localStorage > default
 * shop returned by backend > first row), and re-fires when changed.
 */
export function useActiveShop() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [activeId, setActive] = useState<string | null>(getActiveShopId());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await api<Shop[]>('/shops');
      setShops(rows ?? []);
      if (!getActiveShopId() && rows && rows.length > 0) {
        const def = rows.find((s) => s.isDefault) ?? rows[0];
        setActiveShopId(def.id);
        setActive(def.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load shops');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const onChange = (id: string | null) => setActive(id);
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  }, [load]);

  const setActiveAndBroadcast = useCallback((id: string | null) => {
    setActiveShopId(id);
  }, []);

  const activeShop = activeId ? shops.find((s) => s.id === activeId) ?? null : null;

  return { shops, activeShop, activeId, setActiveId: setActiveAndBroadcast, loading, error, reload: load };
}
