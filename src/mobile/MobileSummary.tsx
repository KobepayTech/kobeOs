import { useEffect, useMemo, useState } from 'react';
import { Loader2, TrendingUp, TrendingDown, Wallet, RefreshCw } from 'lucide-react';
import { api, OfflineError } from '@/lib/api';

/**
 * Mobile Daily Summary. Light-themed, phone-native — replaces the old
 * wrapper that embedded the dark desktop Sales & Expenses app inside
 * the light mobile shell.
 *
 * Reads the same /erp/summary-entries backend the desktop app uses, so
 * numbers match across surfaces. Shows a revenue hero, a sales/expenses/
 * net KPI row, and a by-category-ish split (sales vs expenses bars).
 */

interface Entry {
  id: string;
  kind: 'sales' | 'expenses';
  date: string;
  amount: string | number;
  reason: string;
}

const money = (n: number) => `TZS ${Math.round(Number(n) || 0).toLocaleString()}`;
const todayKey = () => new Date().toISOString().slice(0, 10);

export default function MobileSummary() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [state, setState] = useState<'loading' | 'ok' | 'offline' | 'error'>('loading');
  const [errMsg, setErrMsg] = useState('');

  const load = async () => {
    setState('loading'); setErrMsg('');
    try {
      const rows = await api<Entry[]>('/erp/summary-entries');
      setEntries(Array.isArray(rows) ? rows : []);
      setState('ok');
    } catch (e) {
      if (e instanceof OfflineError || (e as Error)?.name === 'TypeError') setState('offline');
      else { setState('error'); setErrMsg((e as Error).message || 'Failed to load'); }
    }
  };
  useEffect(() => { void load(); }, []);

  const totals = useMemo(() => {
    let sales = 0, expenses = 0, salesToday = 0, ordersToday = 0;
    const t = todayKey();
    for (const e of entries) {
      const amt = Number(e.amount) || 0;
      if (e.kind === 'sales') {
        sales += amt;
        if (e.date === t) { salesToday += amt; ordersToday += 1; }
      } else {
        expenses += amt;
      }
    }
    const net = sales - expenses;
    const denom = sales + expenses;
    return {
      sales, expenses, net, salesToday, ordersToday,
      avg: ordersToday > 0 ? salesToday / ordersToday : 0,
      salesPct: denom > 0 ? Math.round((sales / denom) * 100) : 0,
      expensePct: denom > 0 ? Math.round((expenses / denom) * 100) : 0,
    };
  }, [entries]);

  if (state === 'loading') {
    return <div className="grid place-items-center py-24"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-slate-900">Daily Summary</h2>
        <button onClick={load} className="w-9 h-9 rounded-lg bg-slate-100 grid place-items-center text-slate-500">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {state === 'offline' && (
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 inline-flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5" /> Offline — showing last-known totals.
        </div>
      )}
      {state === 'error' && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{errMsg}</div>
      )}

      {/* Revenue hero */}
      <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl p-5 text-white">
        <div className="text-[10px] uppercase font-bold opacity-80">Total sales (all time)</div>
        <div className="text-3xl font-extrabold mt-1">{money(totals.sales)}</div>
        <div className="flex gap-6 mt-4">
          <div>
            <div className="text-lg font-extrabold">{totals.ordersToday}</div>
            <div className="text-[10px] opacity-80">Sales today</div>
          </div>
          <div>
            <div className="text-lg font-extrabold">{money(totals.avg)}</div>
            <div className="text-[10px] opacity-80">Avg today</div>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <div className="flex items-center justify-between text-[9px] uppercase font-bold text-slate-500">Sales <TrendingUp className="w-3 h-3 text-emerald-500" /></div>
          <div className="text-sm font-extrabold text-emerald-700 mt-1">{money(totals.sales)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <div className="flex items-center justify-between text-[9px] uppercase font-bold text-slate-500">Expenses <TrendingDown className="w-3 h-3 text-rose-500" /></div>
          <div className="text-sm font-extrabold text-rose-700 mt-1">{money(totals.expenses)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <div className="flex items-center justify-between text-[9px] uppercase font-bold text-slate-500">Net <Wallet className="w-3 h-3 text-indigo-500" /></div>
          <div className={`text-sm font-extrabold mt-1 ${totals.net >= 0 ? 'text-slate-900' : 'text-rose-700'}`}>{money(totals.net)}</div>
        </div>
      </div>

      {/* Sales vs expenses split */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <h3 className="text-xs font-extrabold uppercase text-slate-500 mb-3">Sales vs expenses</h3>
        {entries.length === 0 ? (
          <p className="text-xs text-slate-400 py-2 text-center">No entries yet. Record sales and expenses to see the split.</p>
        ) : (
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm"><span className="text-slate-600">Sales</span><span className="font-bold">{money(totals.sales)}</span></div>
              <div className="h-2 bg-slate-100 rounded-full mt-1"><div className="h-2 bg-emerald-500 rounded-full" style={{ width: `${totals.salesPct}%` }} /></div>
            </div>
            <div>
              <div className="flex justify-between text-sm"><span className="text-slate-600">Expenses</span><span className="font-bold">{money(totals.expenses)}</span></div>
              <div className="h-2 bg-slate-100 rounded-full mt-1"><div className="h-2 bg-rose-500 rounded-full" style={{ width: `${totals.expensePct}%` }} /></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
