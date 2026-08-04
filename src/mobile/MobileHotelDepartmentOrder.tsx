import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { CheckCircle2, ClipboardList, Loader2, Minus, Plus, Send } from 'lucide-react';

export type HotelDepartment = 'bar' | 'kitchen' | 'cleaning' | 'room-amenities';
interface StockItem { id: string; name: string; category: string; quantity: number; unit: string; reorderLevel: number }
interface RequestLine { inventoryId?: string; name: string; quantity: number; unit: string }
interface Request { id: string; department: HotelDepartment; lines: Array<RequestLine & { approvedQuantity?: number }>; status: string; createdAt: string }

const labels: Record<HotelDepartment, string> = {
  bar: 'Bar stock', kitchen: 'Kitchen supplies', cleaning: 'Cleaning supplies', 'room-amenities': 'Room amenities',
};

export default function MobileHotelDepartmentOrder({ department }: { department: HotelDepartment }) {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [items, rows] = await Promise.all([
        api<StockItem[]>('/hotel/inventory'),
        api<Request[]>('/hotel/operations/requisitions'),
      ]);
      setStock((items ?? []).filter((item) => item.category === department || (department === 'bar' && item.category === 'Bar Stock') || (department === 'kitchen' && item.category === 'Food Ingredients') || (department === 'cleaning' && item.category === 'Cleaning Supplies') || (department === 'room-amenities' && item.category === 'Room Amenities')));
      setRequests((rows ?? []).filter((row) => row.department === department));
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [department]);

  const selected = useMemo(() => stock.filter((item) => (quantities[item.id] ?? 0) > 0), [stock, quantities]);
  const setQty = (id: string, next: number) => setQuantities((current) => ({ ...current, [id]: Math.max(0, Math.floor(next)) }));

  const submit = async () => {
    if (!selected.length) return;
    setSending(true); setError(null);
    try {
      const created = await api<Request>('/hotel/operations/requisitions', {
        method: 'POST',
        body: JSON.stringify({ department, lines: selected.map((item) => ({ inventoryId: item.id, name: item.name, quantity: quantities[item.id], unit: item.unit })) }),
      });
      setRequests((current) => [created, ...current]);
      setQuantities({});
      setMessage('Request sent to accounting.');
      window.setTimeout(() => setMessage(null), 3500);
    } catch (e) { setError((e as Error).message); }
    finally { setSending(false); }
  };

  return (
    <div className="min-h-full bg-slate-50 p-4 pb-28 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white grid place-items-center"><ClipboardList className="w-5 h-5" /></div>
        <div><h1 className="text-lg font-extrabold text-slate-900">{labels[department]}</h1><p className="text-[11px] text-slate-500">Request quantities from the shared hotel store</p></div>
      </div>
      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-700 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{message}</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3"><h2 className="text-sm font-extrabold text-slate-900">Available stock</h2><span className="text-[10px] text-slate-400">Prices hidden</span></div>
        {loading ? <div className="py-10 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-indigo-500" /></div> : stock.length === 0 ? <p className="text-xs text-slate-400 py-6 text-center">No stock is assigned to this department yet.</p> : <div className="space-y-2">
          {stock.map((item) => { const qty = quantities[item.id] ?? 0; return <div key={item.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
            <div className="flex-1 min-w-0"><div className="text-sm font-bold text-slate-900 truncate">{item.name}</div><div className="text-[10px] text-slate-500">Available: {item.quantity} {item.unit} · reorder at {item.reorderLevel}</div></div>
            <div className="flex items-center gap-2"><button aria-label={`Decrease ${item.name}`} onClick={() => setQty(item.id, qty - 1)} className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 grid place-items-center"><Minus className="w-3.5 h-3.5" /></button><span className="w-7 text-center text-sm font-extrabold text-slate-900">{qty}</span><button aria-label={`Increase ${item.name}`} onClick={() => setQty(item.id, qty + 1)} className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 grid place-items-center"><Plus className="w-3.5 h-3.5" /></button></div>
          </div>; })}
        </div>}
        <button disabled={sending || selected.length === 0} onClick={() => void submit()} className="mt-4 w-full h-11 rounded-xl bg-indigo-600 text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-40"><Send className="w-4 h-4" />{sending ? 'Sending…' : `Send request${selected.length ? ` · ${selected.length} items` : ''}`}</button>
      </div>
      <div className="space-y-2"><h2 className="text-sm font-extrabold text-slate-900">My requests</h2>{requests.length === 0 ? <p className="text-xs text-slate-400">No requests submitted yet.</p> : requests.slice(0, 8).map((request) => <div key={request.id} className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex items-center justify-between"><span className="text-xs font-bold text-slate-900">{new Date(request.createdAt).toLocaleDateString()}</span><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${request.status === 'PURCHASED' ? 'bg-emerald-50 text-emerald-700' : request.status === 'APPROVED' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'}`}>{request.status}</span></div><div className="mt-2 text-[11px] text-slate-500">{request.lines.map((line) => `${line.name} × ${line.approvedQuantity ?? line.quantity}`).join(' · ')}</div></div>)}</div>
    </div>
  );
}
