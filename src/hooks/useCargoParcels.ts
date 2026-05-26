import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { api, getToken } from '@/lib/api';
import { ensureSession } from '@/lib/auth';

const WS_URL =
  (import.meta.env.VITE_API_BASE as string | undefined)
    ?.replace('/api', '')
    ?? 'http://localhost:3000';

export interface ApiParcel {
  id: string;
  parcelId: string;
  senderName: string;
  senderPhone: string;
  ownerName: string;
  ownerPhone: string;
  destination: string;
  packageCount: number;
  weight: number;
  description: string;
  paymentMode: 'PAY_NOW' | 'PAY_ON_ARRIVAL';
  status: string;
  createdAt?: string;
}

export interface NewParcelInput {
  parcelId: string;
  senderName: string;
  senderPhone: string;
  ownerName: string;
  ownerPhone: string;
  destination: string;
  weight?: number;
  description?: string;
  packageCount?: number;
  paymentMode?: 'PAY_NOW' | 'PAY_ON_ARRIVAL';
}

export interface ParcelEvent {
  kind: 'created' | 'status' | 'assignment';
  parcel: ApiParcel;
  previousStatus?: string;
  at: number;
}

const MAX_EVENTS = 30;

function upsert(list: ApiParcel[], parcel: ApiParcel): ApiParcel[] {
  const idx = list.findIndex((p) => p.id === parcel.id);
  if (idx === -1) return [parcel, ...list];
  const next = list.slice();
  next[idx] = parcel;
  return next;
}

/**
 * Loads parcels from the backend and keeps them live over the /cargo socket.
 * Shared by the sender, owner and receiver apps. `events` is a capped, most-
 * recent-first buffer of parcel changes, suitable for live notification feeds.
 */
export function useCargoParcels() {
  const [parcels, setParcels] = useState<ApiParcel[]>([]);
  const [events, setEvents] = useState<ParcelEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const fetchList = useCallback(async () => {
    const list = await api<ApiParcel[]>('/cargo/parcels');
    return Array.isArray(list) ? list : [];
  }, []);

  useEffect(() => {
    let cancelled = false;
    let socket: Socket | null = null;

    (async () => {
      try {
        await ensureSession();
      } catch { /* offline / no session */ }
      if (cancelled) return;

      try {
        const list = await fetchList();
        if (!cancelled) setParcels(list);
      } catch { /* keep empty on failure */ }
      finally {
        if (!cancelled) setLoading(false);
      }

      if (cancelled) return;
      const token = getToken();
      socket = io(`${WS_URL}/cargo`, {
        transports: ['websocket'],
        auth: token ? { token } : undefined,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
      });
      socketRef.current = socket;
      socket.on('connect', () => { if (!cancelled) setConnected(true); });
      socket.on('disconnect', () => { if (!cancelled) setConnected(false); });
      socket.on('cargo:parcel', (evt: Omit<ParcelEvent, 'at'>) => {
        if (cancelled || !evt?.parcel) return;
        setParcels((prev) => upsert(prev, evt.parcel));
        setEvents((prev) => [{ ...evt, at: Date.now() }, ...prev].slice(0, MAX_EVENTS));
      });
    })();

    return () => {
      cancelled = true;
      socket?.disconnect();
      socketRef.current = null;
    };
  }, [fetchList]);

  const createParcel = useCallback(async (input: NewParcelInput) => {
    const created = await api<ApiParcel>('/cargo/parcels', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (created && (created as ApiParcel).id) {
      setParcels((prev) => upsert(prev, created));
    }
    return created;
  }, []);

  const updateParcelStatus = useCallback(async (id: string, status: string) => {
    const updated = await api<ApiParcel>(`/cargo/parcels/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    if (updated && (updated as ApiParcel).id) {
      setParcels((prev) => upsert(prev, updated));
    }
    return updated;
  }, []);

  return { parcels, events, loading, connected, createParcel, updateParcelStatus };
}
