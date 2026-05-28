import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { api, getToken } from '@/lib/api';
import { ensureSession } from '@/lib/auth';

const WS_URL =
  (import.meta.env.VITE_API_BASE as string | undefined)
    ?.replace('/api', '')
    ?? 'http://localhost:3000';

export interface HotelOrderItem {
  menuItemId?: string;
  name: string;
  qty: number;
  price: number;
  station?: 'kitchen' | 'bar' | 'other';
}

export interface HotelOrder {
  id: string;
  roomNumber: string;
  locationType: 'room' | 'table';
  guestName?: string | null;
  items: HotelOrderItem[];
  total: number | string;
  currency: string;
  status: 'PENDING' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';
  note?: string;
  createdAt?: string;
}

export interface HotelServiceRequest {
  id: string;
  roomNumber: string;
  kind: string;
  note?: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  createdAt?: string;
}

interface OrderEvent { kind: 'created' | 'status'; order: HotelOrder; previousStatus?: string; }
interface RequestEvent { kind: 'created' | 'status'; request: HotelServiceRequest; previousStatus?: string; }

function upsert<T extends { id: string }>(list: T[], next: T): T[] {
  const i = list.findIndex((x) => x.id === next.id);
  if (i === -1) return [next, ...list];
  const copy = list.slice();
  copy[i] = next;
  return copy;
}

/**
 * Staff-side hook: loads orders + service-requests from /hotel and keeps them
 * live over the /hotel socket. Exposes status-advance methods that hit the
 * backend; the gateway then broadcasts back so every connected screen syncs.
 */
export function useHotelLive() {
  const [orders, setOrders] = useState<HotelOrder[]>([]);
  const [requests, setRequests] = useState<HotelServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    let cancelled = false;
    let socket: Socket | null = null;
    (async () => {
      try { await ensureSession(); } catch { /* offline */ }
      if (cancelled) return;
      try {
        const [o, r] = await Promise.all([
          api<HotelOrder[]>('/hotel/orders'),
          api<HotelServiceRequest[]>('/hotel/service-requests'),
        ]);
        if (cancelled) return;
        setOrders(Array.isArray(o) ? o : []);
        setRequests(Array.isArray(r) ? r : []);
      } catch { /* keep empty */ }
      finally { if (!cancelled) setLoading(false); }

      if (cancelled) return;
      const token = getToken();
      socket = io(`${WS_URL}/hotel`, {
        transports: ['websocket'],
        auth: token ? { token } : undefined,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
      });
      socketRef.current = socket;
      socket.on('connect', () => { if (!cancelled) setConnected(true); });
      socket.on('disconnect', () => { if (!cancelled) setConnected(false); });
      socket.on('hotel:order', (evt: OrderEvent) => {
        if (!cancelled && evt?.order) setOrders((prev) => upsert(prev, evt.order));
      });
      socket.on('hotel:service-request', (evt: RequestEvent) => {
        if (!cancelled && evt?.request) setRequests((prev) => upsert(prev, evt.request));
      });
    })();
    return () => {
      cancelled = true;
      socket?.disconnect();
      socketRef.current = null;
    };
  }, []);

  const advanceOrder = useCallback(async (id: string, status: HotelOrder['status']) => {
    const updated = await api<HotelOrder>(`/hotel/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    if (updated && (updated as HotelOrder).id) {
      setOrders((prev) => upsert(prev, updated));
    }
  }, []);

  const advanceRequest = useCallback(async (id: string, status: HotelServiceRequest['status']) => {
    const updated = await api<HotelServiceRequest>(`/hotel/service-requests/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    if (updated && (updated as HotelServiceRequest).id) {
      setRequests((prev) => upsert(prev, updated));
    }
  }, []);

  return { orders, requests, loading, connected, advanceOrder, advanceRequest };
}
