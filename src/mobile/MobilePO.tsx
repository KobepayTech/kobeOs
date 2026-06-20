import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Plus, Trash2, Loader2, CheckCircle2, X, ClipboardList } from 'lucide-react';

/**
 * Phone-first Purchase Order creation. Admin scans the QR code with
 * their phone when goods arrive at the warehouse, picks the supplier,
 * lists the items + qty + price, and submits. POSTs to the same
 * /erp/supplier-capital/purchase-orders endpoint the desktop sourcing
 * module uses.
 */

interface Supplier { id: string; name: string }
interface POLine { name: string; qty: number; price: number }

const fmt = (n: number) => `TZS ${Math.round(n).toLocaleString()}`;

export default function MobilePO() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [lines, setLines] = useState<POLine[]>([{ name: '', qty: 1, price: 0 }]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api<Supplier[]>('/erp/sourcing/suppliers');
        if (!cancelled) setSuppliers(Array.isArray(list) ? list : []);
      } catch (e) {
        if (!cancelled) setErr((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const total = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
  const supplier = suppliers.find((s) => s.id === supplierId);

  const canSubmit = supplier && lines.every((l) => l.name.trim() && l.qty > 0 && l.price > 0) && total > 0;

  const updateLine = (i: number, patch: Partial<POLine>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const removeLine = (i: number) =>
    setLines((prev) => prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i));
  const addLine = () => setLines((prev) => [...prev, { name: '', qty: 1, price: 0 }]);

  const submit = async () => {
    if (!canSubmit || !supplier) return;
    setErr(null);
    setSubmitting(true);
    try {
      const poNumber = `PO-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      await api('/erp/supplier-capital/purchase-orders', {
        method: 'POST',
        body: JSON.stringify({
          poNumber,
          supplierId: supplier.id,
          totalCny: total,
          notes: notes.trim() || `${lines.length} line${lines.length === 1 ? '' : 's'}: ${lines.map((l) => `${l.name} ×${l.qty}`).join(', ')}`.slice(0, 500),
        }),
      });
      setDone(poNumber);
      setLines([{ name: '', qty: 1, price: 0 }]);
      setNotes('');
      setSupplierId('');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 space-y-4 pb-28">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 grid place-items-center">
          <ClipboardList className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 leading-tight">New Purchase Order</h2>
          <p className="text-[11px] text-slate-500">Record stock you're buying from a supplier</p>
        </div>
      </div>

      {done && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 p-3 flex items-start gap-2">
          <CheckCircle2 className="w-5 h-5 mt-0.5" />
          <div className="flex-1">
            <div className="text-sm font-extrabold">PO recorded</div>
            <div className="text-[11px] opacity-80">{done}</div>
          </div>
          <button onClick={() => setDone(null)}><X className="w-4 h-4" /></button>
        </div>
      )}
      {err && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 text-rose-800 p-3 text-xs flex items-start gap-2">
          <span className="flex-1">{err}</span>
          <button onClick={() => setErr(null)}><X className="w-3 h-3" /></button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <label className="block">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wide">Supplier</span>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="mt-1 w-full h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-900 focus:outline-none focus:border-indigo-400"
          >
            <option value="">Pick a supplier…</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {suppliers.length === 0 && (
            <p className="text-[10px] text-amber-600 mt-1">No suppliers yet — create one on the desktop ERP first.</p>
          )}
        </label>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wide">Line items</span>
          <span className="text-[10px] font-bold text-slate-500">{lines.length}</span>
        </div>
        <div className="space-y-3">
          {lines.map((l, i) => (
            <div key={i} className="space-y-2 border-b border-slate-100 last:border-0 pb-3 last:pb-0">
              <input
                value={l.name}
                onChange={(e) => updateLine(i, { name: e.target.value })}
                placeholder="Item name (e.g. Samsung A14)"
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm"
              />
              <div className="grid grid-cols-12 gap-2">
                <input
                  inputMode="decimal"
                  type="number"
                  min="0"
                  value={l.qty || ''}
                  onChange={(e) => updateLine(i, { qty: Number(e.target.value) || 0 })}
                  placeholder="Qty"
                  className="col-span-3 h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm font-bold text-right"
                />
                <input
                  inputMode="decimal"
                  type="number"
                  min="0"
                  value={l.price || ''}
                  onChange={(e) => updateLine(i, { price: Number(e.target.value) || 0 })}
                  placeholder="Unit price"
                  className="col-span-7 h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm font-bold text-right"
                />
                <button
                  onClick={() => removeLine(i)}
                  disabled={lines.length === 1}
                  className="col-span-2 h-10 rounded-lg bg-rose-50 text-rose-600 grid place-items-center disabled:opacity-30"
                  aria-label="Remove line"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="text-right text-[11px] text-slate-500">
                Line total <span className="font-extrabold text-slate-800">{fmt((l.qty || 0) * (l.price || 0))}</span>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={addLine}
          className="w-full h-10 rounded-lg border-2 border-dashed border-slate-200 text-slate-500 text-xs font-bold inline-flex items-center justify-center gap-1 active:bg-slate-50"
        >
          <Plus className="w-3.5 h-3.5" />Add another item
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <label className="block">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wide">Notes (optional)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Invoice ref, delivery instructions…"
            className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm"
          />
        </label>
      </div>

      <div className="fixed bottom-20 left-4 right-4 z-20 bg-white border border-slate-200 rounded-2xl p-3 shadow-xl flex items-center gap-3">
        <div className="flex-1">
          <div className="text-[10px] uppercase font-bold text-slate-500">Order total</div>
          <div className="text-lg font-extrabold text-slate-900">{fmt(total)}</div>
        </div>
        <button
          onClick={submit}
          disabled={!canSubmit || submitting}
          className="h-12 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-extrabold text-sm inline-flex items-center gap-2"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {submitting ? 'Saving…' : 'Create PO'}
        </button>
      </div>
    </div>
  );
}
