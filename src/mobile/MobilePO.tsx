import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Plus, Trash2, Loader2, CheckCircle2, X, ClipboardList, TrendingUp } from 'lucide-react';

/**
 * Phone-first Purchase Order creation. Admin scans the QR code with
 * their phone when goods arrive at the warehouse, picks the supplier,
 * lists the items + qty + cost + intended sell price, types the
 * transport / freight cost once, and the screen shows live cost,
 * revenue, profit, and margin. POSTs to /erp/supplier-capital/
 * purchase-orders; sell price + transport are packed into the notes
 * field as a structured JSON line until the backend gets a column for
 * them (so a future migration can backfill).
 */

interface Supplier { id: string; name: string }
interface POLine { name: string; qty: number; price: number; sellPrice: number }

const fmt = (n: number) => `TZS ${Math.round(n).toLocaleString()}`;
const fmtPct = (n: number) =>
  Number.isFinite(n) ? `${n.toFixed(1)}%` : '—';

export default function MobilePO() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [lines, setLines] = useState<POLine[]>([{ name: '', qty: 1, price: 0, sellPrice: 0 }]);
  const [transportCost, setTransportCost] = useState<number>(0);
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

  // Per-line + roll-up calculations. Transport is treated as a single
  // PO-level cost (not allocated per line) so the totals stay honest
  // and the operator can see it as its own bucket. Per-line profit
  // therefore excludes transport; the bottom summary reports the net
  // profit AFTER transport.
  const calc = useMemo(() => {
    const enriched = lines.map((l) => {
      const qty = Number(l.qty) || 0;
      const price = Number(l.price) || 0;
      const sellPrice = Number(l.sellPrice) || 0;
      const cost = qty * price;
      const revenue = qty * sellPrice;
      const profit = revenue - cost;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      return { ...l, cost, revenue, profit, margin };
    });
    const costTotal    = enriched.reduce((s, l) => s + l.cost, 0);
    const revenueTotal = enriched.reduce((s, l) => s + l.revenue, 0);
    const transport    = Number(transportCost) || 0;
    const netProfit    = revenueTotal - costTotal - transport;
    const netMargin    = revenueTotal > 0 ? (netProfit / revenueTotal) * 100 : 0;
    return { enriched, costTotal, revenueTotal, transport, netProfit, netMargin };
  }, [lines, transportCost]);

  const supplier = suppliers.find((s) => s.id === supplierId);
  const canSubmit =
    !!supplier &&
    lines.every((l) => l.name.trim() && l.qty > 0 && l.price > 0) &&
    calc.costTotal > 0;

  const updateLine = (i: number, patch: Partial<POLine>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const removeLine = (i: number) =>
    setLines((prev) => prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i));
  const addLine = () =>
    setLines((prev) => [...prev, { name: '', qty: 1, price: 0, sellPrice: 0 }]);

  const submit = async () => {
    if (!canSubmit || !supplier) return;
    setErr(null);
    setSubmitting(true);
    try {
      const poNumber = `PO-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      // Pack the extended fields into notes so they survive the
      // round-trip even though the backend DTO doesn't have columns
      // for them yet. Format is "kobeos-po-meta:<json>\n<freeform notes>"
      // so a future migration can grep + backfill.
      const meta = {
        transportCost: calc.transport,
        revenueTotal: calc.revenueTotal,
        netProfit: calc.netProfit,
        lines: lines.map((l) => ({ name: l.name, qty: l.qty, price: l.price, sellPrice: l.sellPrice })),
      };
      const notesPayload = [
        `kobeos-po-meta:${JSON.stringify(meta)}`,
        notes.trim(),
      ].filter(Boolean).join('\n').slice(0, 2000);

      await api('/erp/supplier-capital/purchase-orders', {
        method: 'POST',
        body: JSON.stringify({
          poNumber,
          supplierId: supplier.id,
          // totalCny = supplier-side cost (goods + transport). Keeps
          // landed-cost accounting consistent even though the backend
          // column is still called totalCny.
          totalCny: calc.costTotal + calc.transport,
          notes: notesPayload,
        }),
      });
      setDone(poNumber);
      setLines([{ name: '', qty: 1, price: 0, sellPrice: 0 }]);
      setTransportCost(0);
      setNotes('');
      setSupplierId('');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 space-y-4 pb-48">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 grid place-items-center">
          <ClipboardList className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 leading-tight">New Purchase Order</h2>
          <p className="text-[11px] text-slate-500">Record stock you're buying and see profit live</p>
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
          {calc.enriched.map((l, i) => (
            <div key={i} className="space-y-2 border-b border-slate-100 last:border-0 pb-3 last:pb-0">
              <input
                value={l.name}
                onChange={(e) => updateLine(i, { name: e.target.value })}
                placeholder="Item name (e.g. Samsung A14)"
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm"
              />
              <div className="grid grid-cols-12 gap-2">
                <NumberCell
                  label="Qty"
                  value={l.qty || ''}
                  onChange={(v) => updateLine(i, { qty: Number(v) || 0 })}
                  className="col-span-3"
                />
                <NumberCell
                  label="Unit cost"
                  value={l.price || ''}
                  onChange={(v) => updateLine(i, { price: Number(v) || 0 })}
                  className="col-span-4"
                />
                <NumberCell
                  label="Sell @"
                  value={l.sellPrice || ''}
                  onChange={(v) => updateLine(i, { sellPrice: Number(v) || 0 })}
                  className="col-span-3"
                  highlight={l.sellPrice > 0 && l.sellPrice >= l.price ? 'emerald' : l.sellPrice > 0 && l.sellPrice < l.price ? 'rose' : undefined}
                />
                <button
                  onClick={() => removeLine(i)}
                  disabled={lines.length === 1}
                  className="col-span-2 self-end h-10 rounded-lg bg-rose-50 text-rose-600 grid place-items-center disabled:opacity-30"
                  aria-label="Remove line"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-500">
                  Cost <span className="font-extrabold text-slate-800">{fmt(l.cost)}</span>
                  <span className="mx-1.5 text-slate-300">·</span>
                  Sale <span className="font-extrabold text-slate-800">{fmt(l.revenue)}</span>
                </span>
                <span
                  className={`px-2 py-0.5 rounded-md font-extrabold ${
                    l.profit > 0 ? 'bg-emerald-50 text-emerald-700' :
                    l.profit < 0 ? 'bg-rose-50 text-rose-700' :
                                   'bg-slate-100 text-slate-500'
                  }`}
                >
                  {l.profit >= 0 ? '+' : ''}{fmt(l.profit)} ({fmtPct(l.margin)})
                </span>
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

      {/* Transport / freight — applied across the whole PO. */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <label className="block">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wide">
            Transport / freight (TZS)
          </span>
          <input
            inputMode="decimal"
            type="number"
            min="0"
            value={transportCost || ''}
            onChange={(e) => setTransportCost(Number(e.target.value) || 0)}
            placeholder="0"
            className="mt-1 w-full h-11 px-3 rounded-lg border border-slate-200 bg-white text-base font-bold text-right"
          />
          <p className="text-[10px] text-slate-400 mt-1">
            Single freight cost for the whole shipment. Subtracted from total profit.
          </p>
        </label>
      </div>

      {/* Notes */}
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

      {/* Sticky profit summary + create button */}
      <div className="fixed bottom-16 left-2 right-2 z-20 bg-white border border-slate-200 rounded-2xl p-3 shadow-xl space-y-2">
        <div className="grid grid-cols-3 gap-2 text-center">
          <SummaryCell label="Cost" value={fmt(calc.costTotal + calc.transport)} sub={`+ ${fmt(calc.transport)} freight`} />
          <SummaryCell label="Revenue" value={fmt(calc.revenueTotal)} sub="if all sold" tone="indigo" />
          <SummaryCell
            label="Profit"
            value={fmt(calc.netProfit)}
            sub={fmtPct(calc.netMargin)}
            tone={calc.netProfit > 0 ? 'emerald' : calc.netProfit < 0 ? 'rose' : 'slate'}
            icon={<TrendingUp className="w-3 h-3" />}
          />
        </div>
        <button
          onClick={submit}
          disabled={!canSubmit || submitting}
          className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-extrabold text-sm inline-flex items-center justify-center gap-2"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {submitting ? 'Saving…' : `Create PO · ${fmt(calc.costTotal + calc.transport)}`}
        </button>
      </div>
    </div>
  );
}

function NumberCell({
  label, value, onChange, className = '', highlight,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  className?: string;
  highlight?: 'emerald' | 'rose';
}) {
  const border =
    highlight === 'emerald' ? 'border-emerald-300 focus:border-emerald-400'
    : highlight === 'rose'  ? 'border-rose-300 focus:border-rose-400'
    :                          'border-slate-200 focus:border-indigo-400';
  return (
    <label className={`block ${className}`}>
      <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wide block leading-none mb-0.5">{label}</span>
      <input
        inputMode="decimal"
        type="number"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className={`w-full h-10 px-2 rounded-lg border bg-white text-sm font-bold text-right focus:outline-none ${border}`}
      />
    </label>
  );
}

function SummaryCell({
  label, value, sub, tone = 'slate', icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'slate' | 'indigo' | 'emerald' | 'rose';
  icon?: React.ReactNode;
}) {
  const palette = {
    slate:   { label: 'text-slate-500',   value: 'text-slate-900',   sub: 'text-slate-400' },
    indigo:  { label: 'text-indigo-500',  value: 'text-indigo-700',  sub: 'text-indigo-400' },
    emerald: { label: 'text-emerald-600', value: 'text-emerald-700', sub: 'text-emerald-500' },
    rose:    { label: 'text-rose-500',    value: 'text-rose-700',    sub: 'text-rose-500' },
  }[tone];
  return (
    <div>
      <div className={`text-[9px] uppercase font-bold tracking-wide ${palette.label} inline-flex items-center gap-1`}>
        {icon}
        {label}
      </div>
      <div className={`text-sm font-extrabold leading-tight ${palette.value}`}>{value}</div>
      {sub && <div className={`text-[10px] ${palette.sub}`}>{sub}</div>}
    </div>
  );
}
