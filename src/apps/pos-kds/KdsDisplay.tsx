import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { api, getToken } from '@/lib/api';
import { ensureSession } from '@/lib/auth';
import { Wifi, WifiOff, Clock, Check, ChefHat, Package } from 'lucide-react';

/**
 * Full-screen TV display for the in-store / warehouse / kitchen.
 * Shows incoming POS orders in two columns:
 *
 *   PREPARING  (amber, newest at top, time-since-order in big text)
 *   READY      (green, auto-clears 10 min after the ready timestamp)
 *
 * Connects via socket.io to the /pos namespace; the room is scoped per
 * owner so two tenants on the same server never see each other's orders.
 *
 * Designed for 1080p TV viewed from ~3 m — 28px+ body text, 56px order
 * numbers, dark background, high-contrast color blocks. NO interaction
 * surface: the only way to change order state is from the mobile
 * "Prepare" screen.
 */

interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

interface Order {
  id: string;
  orderNumber: string;
  customerName?: string | null;
  customerPhone?: string | null;
  total: number;
  currency: string;
  createdAt: string;
  fulfillmentStatus: 'NEW' | 'PREPARING' | 'READY' | 'COLLECTED';
  preparingAt?: string | null;
  readyAt?: string | null;
  items: OrderItem[];
}

interface KdsEvent {
  kind: 'created' | 'status';
  order: Order;
  items: OrderItem[];
  previousFulfillmentStatus?: Order['fulfillmentStatus'];
}

const WS_URL = (import.meta.env.VITE_API_BASE as string | undefined)?.replace('/api', '') ?? 'http://localhost:3000';
const READY_AUTOCLEAR_MS = 10 * 60 * 1000;

export default function KdsDisplay() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [connected, setConnected] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const socketRef = useRef<Socket | null>(null);

  // Tick once per second so the elapsed-time labels update without a re-fetch.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Ensure JWT session (the display TV reuses the operator's login).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensureSession();
        if (!cancelled) setAuthed(true);
      } catch { /* shown as "Not authenticated" — operator needs to log in first */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Initial fetch of active orders.
  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await api<Array<Order & { items: OrderItem[] }>>('/pos/orders/kds');
        if (!cancelled && Array.isArray(list)) setOrders(list);
      } catch { /* socket will catch us up */ }
    })();
    return () => { cancelled = true; };
  }, [authed]);

  // Live socket subscription.
  useEffect(() => {
    if (!authed) return;
    const token = getToken();
    const sock = io(`${WS_URL}/pos`, { auth: { token }, transports: ['websocket'] });
    socketRef.current = sock;
    sock.on('connect', () => setConnected(true));
    sock.on('disconnect', () => setConnected(false));
    sock.on('kds:order', (evt: KdsEvent) => {
      setOrders((prev) => {
        const incoming = { ...evt.order, items: evt.items };
        const idx = prev.findIndex((o) => o.id === incoming.id);
        if (idx === -1) return [incoming, ...prev].slice(0, 100);
        const next = prev.slice();
        next[idx] = incoming;
        return next;
      });
      // Audio chirp on new order so back-of-house hears it across the warehouse.
      if (evt.kind === 'created') {
        try { playChirp(); } catch { /* autoplay blocked etc — silently skip */ }
      }
    });
    return () => {
      sock.disconnect();
      socketRef.current = null;
    };
  }, [authed]);

  const { preparing, ready } = useMemo(() => splitOrders(orders, now), [orders, now]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <header className="h-14 px-6 flex items-center justify-between border-b border-white/10 bg-slate-900">
        <div className="flex items-center gap-3">
          <ChefHat className="w-6 h-6 text-amber-400" />
          <span className="text-xl font-extrabold tracking-tight">Order Display</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Clock className="w-4 h-4 text-white/50" />
          <span className="font-mono text-white/70 tabular-nums">{formatClock(now)}</span>
          {connected ? (
            <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
              <Wifi className="w-4 h-4" /> live
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-rose-400 font-bold">
              <WifiOff className="w-4 h-4" /> reconnecting…
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 grid grid-cols-2 divide-x divide-white/10 overflow-hidden">
        <Column
          title="Preparing"
          subtitle={`${preparing.length} active`}
          accent="amber"
          icon={<ChefHat className="w-6 h-6" />}
          orders={preparing}
          now={now}
        />
        <Column
          title="Ready for collection"
          subtitle={`${ready.length} waiting`}
          accent="emerald"
          icon={<Check className="w-6 h-6" />}
          orders={ready}
          now={now}
        />
      </div>

      {!authed && (
        <div className="absolute inset-0 grid place-items-center bg-slate-950/95 text-center">
          <div>
            <Package className="w-12 h-12 text-amber-400 mx-auto mb-3" />
            <div className="text-xl font-extrabold">Not authenticated</div>
            <div className="text-white/60 mt-2">Sign in to KobeOS first, then reopen this URL on the TV.</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Column({
  title, subtitle, accent, icon, orders, now,
}: {
  title: string;
  subtitle: string;
  accent: 'amber' | 'emerald';
  icon: React.ReactNode;
  orders: Order[];
  now: number;
}) {
  const headerTone = accent === 'amber'
    ? 'bg-amber-500/20 text-amber-200 border-amber-500/30'
    : 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30';
  return (
    <div className="flex flex-col">
      <div className={`px-6 py-3 flex items-center gap-3 border-b ${headerTone}`}>
        {icon}
        <div className="flex-1">
          <div className="text-2xl font-extrabold">{title}</div>
          <div className="text-sm opacity-70">{subtitle}</div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {orders.length === 0 ? (
          <div className="text-white/30 text-center mt-12 text-lg italic">No orders</div>
        ) : (
          orders.map((o) => <OrderCard key={o.id} order={o} accent={accent} now={now} />)
        )}
      </div>
    </div>
  );
}

function OrderCard({ order, accent, now }: { order: Order; accent: 'amber' | 'emerald'; now: number }) {
  const elapsedMs = now - new Date(accent === 'amber' ? order.preparingAt ?? order.createdAt : order.readyAt ?? order.createdAt).getTime();
  const elapsedLabel = formatElapsed(elapsedMs);
  const cardTone = accent === 'amber'
    ? 'bg-amber-500/10 border-amber-500/40'
    : 'bg-emerald-500/15 border-emerald-500/50';
  const numTone = accent === 'amber' ? 'text-amber-300' : 'text-emerald-300';
  const elapsedTone = accent === 'amber'
    ? (elapsedMs > 10 * 60 * 1000 ? 'text-rose-300' : 'text-amber-200')
    : 'text-emerald-200';
  return (
    <div className={`rounded-2xl border p-4 ${cardTone}`}>
      <div className="flex items-baseline justify-between mb-2">
        <span className={`text-3xl font-black tracking-tight ${numTone}`}>#{order.orderNumber}</span>
        <span className={`text-xl font-extrabold tabular-nums ${elapsedTone}`}>{elapsedLabel}</span>
      </div>
      {(order.customerName || order.customerPhone) && (
        <div className="text-base text-white/60 mb-2 truncate">
          {[order.customerName, order.customerPhone].filter(Boolean).join(' · ')}
        </div>
      )}
      <ul className="space-y-1">
        {order.items.map((it) => (
          <li key={it.id} className="flex items-baseline gap-3 text-lg">
            <span className="font-extrabold text-white tabular-nums w-10 text-right">{it.quantity}×</span>
            <span className="flex-1 truncate">{it.productName}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function splitOrders(all: Order[], now: number): { preparing: Order[]; ready: Order[] } {
  const preparing: Order[] = [];
  const ready: Order[] = [];
  for (const o of all) {
    if (o.fulfillmentStatus === 'NEW' || o.fulfillmentStatus === 'PREPARING') {
      preparing.push(o);
    } else if (o.fulfillmentStatus === 'READY') {
      const readyMs = o.readyAt ? new Date(o.readyAt).getTime() : 0;
      // Auto-clear after 10 min so the column doesn't fill up with stale orders.
      if (readyMs === 0 || now - readyMs < READY_AUTOCLEAR_MS) ready.push(o);
    }
    // COLLECTED orders fall off the display.
  }
  // Newest preparing at top (more time-sensitive = more visible).
  preparing.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  // Oldest-ready at top so staff hand them out FIFO.
  ready.sort((a, b) => new Date(a.readyAt ?? a.createdAt).getTime() - new Date(b.readyAt ?? b.createdAt).getTime());
  return { preparing, ready };
}

function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  if (m < 1) return `${s}s`;
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function formatClock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

// 880 Hz tone for ~120 ms. Audible across the warehouse, short enough
// not to be annoying when several orders arrive at once.
function playChirp() {
  const ctx = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = 880;
  osc.type = 'sine';
  gain.gain.value = 0.001;
  gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.01);
  gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.12);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.13);
  setTimeout(() => ctx.close(), 300);
}
