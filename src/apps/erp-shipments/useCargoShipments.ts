import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { api, getToken } from '@/lib/api';
import { ensureSession } from '@/lib/auth';

const WS_URL =
  (import.meta.env.VITE_API_BASE as string | undefined)
    ?.replace('/api', '')
    ?? 'http://localhost:3000';

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

// Seeded once when a fresh backend returns no shipments, so the board is not
// empty on first run. Persisted server-side — they survive reloads.
const DEMO_SEED: NewShipmentInput[] = [
  { shipmentId: 'SH-1001', origin: 'Dar es Salaam', destination: 'Arusha', weight: 45, carrier: 'FastFreight TZ' },
  { shipmentId: 'SH-1002', origin: 'Dar es Salaam', destination: 'Mwanza', weight: 32, carrier: 'Lake Express' },
  { shipmentId: 'SH-1003', origin: 'Guangzhou', destination: 'Dar es Salaam', weight: 120, carrier: 'East African Cargo' },
  { shipmentId: 'SH-1004', origin: 'Dubai', destination: 'Dar es Salaam', weight: 210, carrier: 'DHL Express' },
  { shipmentId: 'SH-1005', origin: 'Dar es Salaam', destination: 'Dodoma', weight: 22, carrier: 'FastFreight TZ' },
];

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
  const socketRef = useRef<Socket | null>(null);

  const fetchList = useCallback(async () => {
    const list = await api<ApiShipment[]>('/cargo/shipments');
    return Array.isArray(list) ? list : [];
  }, []);

  useEffect(() => {
    let cancelled = false;
    let socket: Socket | null = null;

    (async () => {
      try {
        await ensureSession();
      } catch { /* offline / no session — board stays empty */ }
      if (cancelled) return;

      try {
        let list = await fetchList();
        if (!cancelled && list.length === 0) {
          await Promise.allSettled(
            DEMO_SEED.map((s) => api('/cargo/shipments', { method: 'POST', body: JSON.stringify(s) })),
          );
          list = await fetchList();
        }
        if (!cancelled) setShipments(list);
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
      socket.on('cargo:shipment', (evt: ShipmentEvent) => {
        if (!cancelled && evt?.shipment) setShipments((prev) => upsert(prev, evt.shipment));
      });
    })();

    return () => {
      cancelled = true;
      socket?.disconnect();
      socketRef.current = null;
    };
  }, [fetchList]);

  const createShipment = useCallback(async (input: NewShipmentInput) => {
    const created = await api<ApiShipment>('/cargo/shipments', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (created && (created as ApiShipment).id) {
      setShipments((prev) => upsert(prev, created));
    }
    return created;
  }, []);

  const advanceStatus = useCallback(async (id: string, status: string) => {
    const updated = await api<ApiShipment>(`/cargo/shipments/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    if (updated && (updated as ApiShipment).id) {
      setShipments((prev) => upsert(prev, updated));
    }
    return updated;
  }, []);

  return { shipments, loading, connected, createShipment, advanceStatus };
}
