import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Receipt, Loader2, ChevronRight } from 'lucide-react';

interface Order {
  id: string;
  orderNumber: string;
  total: number | string;
  paymentMethod?: string;
  status?: string;
  createdAt?: string;
  customerName?: string | null;
}

const fmt = (n: number) => `TZS ${Math.round(n).toLocaleString()}`;

/** Phone-friendly recent-orders feed. Pulled from /pos/orders. Useful
 *  for a cashier or owner who wants to glance at the day's takings. */
export default function MobileOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api<Order[]>('/pos/orders');
        if (!cancelled) setOrders(Array.isArray(list) ? list : []);
      } catch (e) {
        if (!cancelled) setErr((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Today total
  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = orders.filter((o) => (o.createdAt ?? '').slice(0, 10) === today);
  const todayTotal = todayOrders.reduce((s, o) => s + parseFloat(String(o.total)), 0);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-2 sticky top-0 bg-slate-50 z-10">
        <h2 className="text-lg font-extrabold text-slate-900 mb-2">Recent orders</h2>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white border border-slate-200 p-3">
            <div className="text-[10px] uppercase font-bold text-slate-500">Today</div>
            <div className="text-base font-extrabold text-slate-900 mt-0.5">{fmt(todayTotal)}</div>
            <div className="text-[10px] text-slate-500">{todayOrders.length} order{todayOrders.length === 1 ? '' : 's'}</div>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 p-3">
            <div className="text-[10px] uppercase font-bold text-slate-500">All time</div>
            <div className="text-base font-extrabold text-slate-900 mt-0.5">
              {fmt(orders.reduce((s, o) => s + parseFloat(String(o.total)), 0))}
            </div>
            <div className="text-[10px] text-slate-500">{orders.length} order{orders.length === 1 ? '' : 's'}</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {loading ? (
          <div className="grid place-items-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
        ) : err ? (
          <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{err}</div>
        ) : orders.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-12">No orders yet.</p>
        ) : (
          <ul className="space-y-2">
            {orders.map((o) => (
              <li key={o.id} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 grid place-items-center">
                  <Receipt className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-900 truncate">{o.orderNumber}</div>
                  <div className="text-[10px] text-slate-500">
                    {o.customerName || 'Walk-in'} · {o.paymentMethod ?? 'CASH'}
                    {o.createdAt && ` · ${o.createdAt.slice(0, 16).replace('T', ' ')}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-extrabold text-slate-900">{fmt(parseFloat(String(o.total)))}</div>
                  {o.status && <div className="text-[10px] text-emerald-600 font-bold">{o.status}</div>}
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
