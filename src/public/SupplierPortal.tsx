import { useCallback, useEffect, useState } from 'react';
import { publicApi } from './api';

interface Order {
  groupId: string; reference: string; title: string; productName: string; status: string;
  quantity: number; unitCost: number; total: number; deliveryLocation: string;
  deadline: string | null; orderedAt: string | null;
}
interface Portal { supplier: { name: string; code: string }; orders: Order[] }

const money = (n: number) => `TSh ${Number(n || 0).toLocaleString()}`;
const FLOW = ['ORDERED', 'PRODUCTION', 'IN_TRANSIT', 'DELIVERED'];
const NEXT: Record<string, string | null> = { ORDERED: 'PRODUCTION', PRODUCTION: 'IN_TRANSIT', IN_TRANSIT: 'DELIVERED', DELIVERED: null };
const STAGES = ['ORDERED', 'PRODUCTION', 'IN_TRANSIT', 'DELIVERED', 'VERIFIED', 'COMPLETED'];

/**
 * Public supplier portal (no login). A supplier opens the tokenised link the
 * school shared, sees each consolidated order, and advances fulfilment:
 * ORDERED → PRODUCTION → IN_TRANSIT → DELIVERED. Verification & payment are the
 * school's side.
 */
export default function SupplierPortal({ token }: { token: string }) {
  const [data, setData] = useState<Portal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setData(await publicApi<Portal>(`/kobepay-pro/supplier/portal/${token}`)); setError(null); }
    catch (e) { setError((e as Error).message); }
  }, [token]);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  const advance = async (o: Order) => {
    const next = NEXT[o.status];
    if (!next) return;
    setBusy(o.groupId); setError(null);
    try {
      await publicApi(`/kobepay-pro/supplier/portal/${token}/orders/${o.groupId}/status`, { method: 'POST', body: JSON.stringify({ status: next }) });
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  };

  if (error && !data) return <Center><div className="text-red-300">{error}</div></Center>;
  if (!data) return <Center><div className="text-white/60">Loading orders…</div></Center>;

  return (
    <div className="min-h-screen bg-[#0b0b16] text-white/90 px-4 py-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-indigo-300">Kobepay Supplier Portal</div>
          <h1 className="text-xl font-extrabold">{data.supplier.name}</h1>
          <div className="text-xs text-white/40">{data.supplier.code} · {data.orders.length} order(s)</div>
        </div>
        {error && <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>}
        {data.orders.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center text-white/50">No consolidated orders yet.</div>
        ) : data.orders.map((o) => {
          const idx = STAGES.indexOf(o.status);
          return (
            <div key={o.groupId} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-bold">{o.title}</div>
                  <div className="text-xs text-white/50">{o.reference} · deliver to {o.deliveryLocation || '—'}</div>
                </div>
                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-indigo-500/20 text-indigo-200">{o.status}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-lg bg-white/[0.05] p-2"><div className="text-[10px] text-white/40">Quantity</div><div className="font-bold">{o.quantity}</div></div>
                <div className="rounded-lg bg-white/[0.05] p-2"><div className="text-[10px] text-white/40">Unit</div><div className="font-bold">{money(o.unitCost)}</div></div>
                <div className="rounded-lg bg-white/[0.05] p-2"><div className="text-[10px] text-white/40">Total</div><div className="font-bold">{money(o.total)}</div></div>
              </div>
              <div className="flex items-center gap-1">
                {STAGES.map((s, i) => <div key={s} className={`flex-1 h-1.5 rounded-full ${i <= idx ? 'bg-emerald-500' : 'bg-white/10'}`} title={s} />)}
              </div>
              {NEXT[o.status] && FLOW.includes(o.status) ? (
                <button disabled={busy === o.groupId} onClick={() => advance(o)} className="w-full h-11 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 font-bold">
                  {busy === o.groupId ? 'Updating…' : `Mark ${NEXT[o.status]!.replace('_', ' ')}`}
                </button>
              ) : (
                <div className="text-center text-xs text-white/40">{o.status === 'DELIVERED' ? 'Awaiting school verification' : o.status === 'VERIFIED' ? 'Verified — payment pending' : o.status === 'COMPLETED' ? 'Paid ✓' : ''}</div>
              )}
            </div>
          );
        })}
        <p className="text-[10px] text-white/30 text-center">Kobepay School Connect · fulfil orders without an account.</p>
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#0b0b16] grid place-items-center px-6 text-center">{children}</div>;
}
