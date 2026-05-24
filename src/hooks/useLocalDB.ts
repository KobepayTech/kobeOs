/**
 * useLocalDB — React hook for offline-first SQLite storage via Electron IPC.
 *
 * Falls back to a no-op in non-Electron (browser dev) environments so
 * components don't need to guard every call.
 */

import { useCallback } from 'react';

type KobeDB = typeof window.kobeOS.db;

function getDB(): KobeDB | null {
  return (window as any).kobeOS?.db ?? null;
}

export function useLocalDB() {
  const db = getDB();

  const kvGet = useCallback((key: string): Promise<string | null> => {
    return db ? db.kvGet(key) : Promise.resolve(null);
  }, [db]);

  const kvSet = useCallback((key: string, value: string): Promise<void> => {
    return db ? db.kvSet(key, value) : Promise.resolve();
  }, [db]);

  const kvDel = useCallback((key: string): Promise<void> => {
    return db ? db.kvDel(key) : Promise.resolve();
  }, [db]);

  const query = useCallback(<T = unknown>(table: string, filters?: Record<string, unknown>): Promise<T[]> => {
    return db ? db.query(table, filters) : Promise.resolve([]);
  }, [db]);

  const insert = useCallback(<T = unknown>(table: string, record: Record<string, unknown>): Promise<T> => {
    return db ? db.insert(table, record) : Promise.resolve(record as T);
  }, [db]);

  const update = useCallback((table: string, id: string | number, changes: Record<string, unknown>): Promise<void> => {
    return db ? db.update(table, id, changes) : Promise.resolve();
  }, [db]);

  const remove = useCallback((table: string, id: string | number): Promise<void> => {
    return db ? db.delete(table, id) : Promise.resolve();
  }, [db]);

  const enqueue = useCallback((operation: { method: string; path: string; body?: unknown; headers?: Record<string, string> }): Promise<void> => {
    return db ? db.enqueue(operation) : Promise.resolve();
  }, [db]);

  const getStats = useCallback(() => {
    return db ? db.getStats() : Promise.resolve({ queueDepth: 0, unsyncedNotes: 0, unsyncedOrders: 0, unsyncedShipments: 0 });
  }, [db]);

  return { kvGet, kvSet, kvDel, query, insert, update, remove, enqueue, getStats, available: !!db };
}
