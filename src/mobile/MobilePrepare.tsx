import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useOrderQueue } from '@/apps/pos-kds/useOrderQueue';
import { ChefHat, Check, Package, Loader2, Wifi, WifiOff } from 'lucide-react';

/**
 * Phone-side companion to the in-store TV Kitchen Display System.
 * Lists active orders (NEW + PREPARING + READY) and gives staff three
 * big action buttons per order:
 *
 *   "Start preparing"   NEW       → PREPARING  (yellow card on TV)
 *   "Mark ready"        PREPARING → READY      (green card on TV)
 *   "Collected"         READY     → COLLECTED  (drops off the TV)
 *
 * Live socket subscription means a status change from one staff
 * member's phone updates everyone else's screen + the TV instantly.
 * Concurrent taps on the same order are idempotent (option (a) from
 * the design discussion): server returns the current state silently
 * if the order is already past the target status, no error toast.
 */

interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  unit?: string;
}

interface Order {
  id: string;
  orderNumber: string;
  customerName?: string | null;
  customerPhone?: string | null;
  fulfillmentMethod?: 'PICKUP' | 'DELIVERY' | null;
  fulfillmentLocation?: string | null;
  total: number;
  currency: string;
  createdAt: string;
  fulfillmentStatus: 'NEW' | 'PREPARING' | 'READY' | 'COLLECTED';
  preparingAt?: string | null;
  readyAt?: string | null;
  items: OrderItem[];
}

export default function MobilePrepare() {
  const load = useCallback((signal: AbortSignal) => api<Order[]>('/pos/orders/kds', {
    signal, offlineFallback: false, cache: 'no-store',
  }), []);
  const onCreated = useCallback(() => { navigator.vibrate?.(50); }, []);
  const { rows, error, lastSynced, refresh } = useOrderQueue(load, { live: true, onCreated });
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [actionError, setActionError] = useState('');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  const active = useMemo(
    () => (rows ?? []).filter((o) => o.fulfillmentStatus !== 'COLLECTED'),
    [rows],
  );

  const transition = async (order: Order, target: 'start' | 'ready' | 'collected') => {
    setPending((p) => ({ ...p, [order.id]: true }));
    setActionError('');
    try {
      await api<Order>(`/pos/orders/${order.id}/${target}`, { method: 'POST', offlineFallback: false });
    } catch (reason) {
      setActionError(reason instanceof ApiError ? reason.message : 'Order update could not be confirmed. Check the queue and try again.');
    } finally {
      setPending((p) => ({ ...p, [order.id]: false }));
      refresh();
    }
  };

  return (
    <div className="p-4 space-y-3 pb-24">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 grid place-items-center">
          <ChefHat className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-extrabold text-slate-900 leading-tight">Orders to prepare</h2>
          <p className="text-[11px] text-slate-500">
            {active.length} active · {!error && lastSynced ? (
              <span className="text-emerald-600 inline-flex items-center gap-1"><Wifi className="w-3 h-3" /> up to date</span>
            ) : (
              <span className="text-rose-600 inline-flex items-center gap-1"><WifiOff className="w-3 h-3" /> syncing</span>
            )}
          </p>
        </div>
      </div>

      {error && <p role="status" className="text-sm text-amber-700">{error}</p>}
      {actionError && <p role="alert" className="text-sm text-rose-700">{actionError}</p>}
      {!rows && !error ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
          Loading active orders…
        </div>
      ) : !rows ? null : active.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-60" />
          <div className="text-sm font-bold">No active orders</div>
          <div className="text-xs opacity-70 mt-1">New orders from the POS will appear here automatically.</div>
        </div>
      ) : (
        active.map((o) => (
          <OrderRow key={o.id} order={o} now={now} pending={!!pending[o.id] || !!error} onAction={transition} />
        ))
      )}
    </div>
  );
}

function formatQty(q: number, unit?: string): string {
  const n = Number(q);
  const num = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
  if (!unit || unit === 'piece' || unit === 'pcs') return `${num}×`;
  return `${num} ${unit}`;
}

function OrderRow({
  order, now, pending, onAction,
}: {
  order: Order;
  now: number;
  pending: boolean;
  onAction: (order: Order, target: 'start' | 'ready' | 'collected') => void;
}) {
  const placed = new Date(order.createdAt).getTime();
  const elapsedMin = Math.floor((now - placed) / 60000);
  const isStale = order.fulfillmentStatus !== 'READY' && elapsedMin >= 10;
  const toneCard =
    order.fulfillmentStatus === 'READY'    ? 'border-emerald-300 bg-emerald-50' :
    order.fulfillmentStatus === 'PREPARING' ? 'border-amber-300 bg-amber-50'    :
                                              'border-slate-300 bg-white';
  const toneBadge =
    order.fulfillmentStatus === 'READY'     ? 'bg-emerald-600 text-white' :
    order.fulfillmentStatus === 'PREPARING' ? 'bg-amber-500 text-white'   :
                                              'bg-slate-200 text-slate-700';
  return (
    <div className={`rounded-xl border p-3 ${toneCard} ${isStale ? 'ring-2 ring-rose-400' : ''}`}>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-base font-extrabold text-slate-900">#{order.orderNumber}</span>
        <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 ${toneBadge}`}>
          {order.fulfillmentStatus}
        </span>
      </div>
      <div className="text-[11px] text-slate-500 mb-2">
        {elapsedMin === 0 ? 'just now' : `${elapsedMin}m ago`}
        {(order.customerName || order.customerPhone) && (
          <> · {[order.customerName, order.customerPhone].filter(Boolean).join(' · ')}</>
        )}
      </div>
      {order.fulfillmentMethod && <div className="text-xs text-slate-700 mb-2">
        {order.fulfillmentMethod === 'PICKUP' ? 'Pickup' : 'Delivery'} · {order.fulfillmentLocation}
      </div>}
      <ul className="space-y-0.5 mb-3">
        {order.items.map((it) => (
          <li key={it.id} className="flex items-baseline gap-2 text-sm text-slate-800">
            <span className="font-bold tabular-nums w-14 text-right">{formatQty(it.quantity, it.unit)}</span>
            <span className="flex-1 truncate">{it.productName}</span>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        {order.fulfillmentStatus === 'NEW' && (
          <button
            onClick={() => onAction(order, 'start')}
            disabled={pending}
            className="flex-1 h-11 rounded-lg bg-amber-500 active:bg-amber-600 text-white font-extrabold text-sm disabled:opacity-50 inline-flex items-center justify-center gap-1"
          >
            {pending && <Loader2 className="w-4 h-4 animate-spin" />}
            Start preparing
          </button>
        )}
        {order.fulfillmentStatus === 'PREPARING' && (
          <button
            onClick={() => onAction(order, 'ready')}
            disabled={pending}
            className="flex-1 h-11 rounded-lg bg-emerald-600 active:bg-emerald-700 text-white font-extrabold text-sm disabled:opacity-50 inline-flex items-center justify-center gap-1"
          >
            {pending && <Loader2 className="w-4 h-4 animate-spin" />}
            <Check className="w-4 h-4" /> Mark ready
          </button>
        )}
        {order.fulfillmentStatus === 'READY' && (
          <button
            onClick={() => onAction(order, 'collected')}
            disabled={pending}
            className="flex-1 h-11 rounded-lg bg-slate-700 active:bg-slate-800 text-white font-extrabold text-sm disabled:opacity-50 inline-flex items-center justify-center gap-1"
          >
            {pending && <Loader2 className="w-4 h-4 animate-spin" />}
            <Package className="w-4 h-4" /> Mark collected
          </button>
        )}
      </div>
    </div>
  );
}
