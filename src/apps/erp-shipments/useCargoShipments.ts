import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { api, getToken } from '@/lib/api';
import { ensureSession } from '@/lib/auth';

const WS_URL = (import.meta.env.VITE_API_BASE as string | undefined)?.replace('/api', '') ?? 'http://localhost:3000';

export interface ApiShipment {
  id: string;
  shipmentId: string;
  origin: string;
  destination: string;
  weight: number;
  status: string;
  etd?: string | null;
  eta?: string | null;
  carrier?: string | null;
  flightNumber?: string | null;
  driverId?: string | null;
}

export interface NewShipmentInput {
  shipmentId: string;
  origin: string;
  destination: string;
  weight?: number;
  carrier?: string;
}

interface ShipmentEvent {
  kind: 'created' | 'status' | 'assignment';
  shipment: ApiShipment;
  previousStatus?: string;
}

function upsert(list: ApiShipment[], shipment: ApiShipment): ApiShipment[] {
  const idx = list.findIndex((s) => s.id === shipment.id);
  if (idx === -1) return [shipment, ...list];
  const next = list.slice();
  next[idx] = shipment;
  return next;
}

export function useCargoShipments() {
  const [shipments, setShipments] = useState<ApiShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const socketRef = useRef<Socket | null>(null);

  const fetchList = useCallback(async () => {
    const list = await api<ApiShipment[]>('/cargo/shipments', { offlineFallback: false });
    return Array.isArray(list) ? list : [];
  }, []);

  const reload = useCallback(async () => {
    setLoading(true); setError('');
    try { setShipments(await fetchList()); }
    catch (e) { setShipments([]); setError((e as Error).message || 'Could not load shipments.'); }
    finally { setLoading(false); }
  }, [fetchList]);

  useEffect(() => {
    let cancelled = false;
    let socket: Socket | null = null;

    (async () => {
      try { await ensureSession(); }
      catch { if (!cancelled) { setLoading(false); setError('Sign in to load shipments.'); } return; }
      if (cancelled) return;
      await reload();
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
      socket.on('cargo:shipment', (evt: ShipmentEvent) => {
        if (!cancelled && evt?.shipment) setShipments((prev) => upsert(prev, evt.shipment));
      });
    })();

    return () => { cancelled = true; socket?.disconnect(); socketRef.current = null; };
  }, [reload]);

  const createShipment = useCallback(async (input: NewShipmentInput) => {
    const created = await api<ApiShipment>('/cargo/shipments', { method: 'POST', offlineFallback: false, body: JSON.stringify(input) });
    if (created?.id) setShipments((prev) => upsert(prev, created));
    return created;
  }, []);

  const advanceStatus = useCallback(async (id: string, status: string) => {
    const updated = await api<ApiShipment>(`/cargo/shipments/${id}/status`, { method: 'PATCH', offlineFallback: false, body: JSON.stringify({ status }) });
    if (updated?.id) setShipments((prev) => upsert(prev, updated));
    return updated;
  }, []);

  return { shipments, loading, connected, error, reload, createShipment, advanceStatus };
}
