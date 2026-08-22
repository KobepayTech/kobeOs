import { useEffect, useState } from 'react';
import { Loader2, Wallet, Receipt, TrendingDown, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { api, ApiError, OfflineError } from '@/lib/api';

/**
 * Mobile Till / End-of-Day. Light-themed, phone-native — replaces the
 * old wrapper that embedded the dark (bg-[#0a0a1a]) desktop EOD app
 * inside the light mobile shell, which was a jarring theme flip when
 * you tapped the Till tab.
 *
 * Wired to GET /eod/day-summary (uses the active-shop header that
 * api.ts forwards) with POST /eod/close-day to submit. Falls back to a
 * clear empty state when no shop is selected or the backend is
 * unreachable — never fabricates numbers.
 */

interface DaySummary {
  shopId: string;
  shopName: string;
  tradingDate: string;
  openingFloat: number;
  cashSales: number;
  cashExpenses: number;
  expectedCash: number;
  currency: string;
  expenseCount: number;
  breakdownByCategory: Record<string, number>;
}

const money = (n: number, cur = 'TZS') => `${cur} ${Math.round(Number(n) || 0).toLocaleString()}`;

export default function MobileEod() {
  const [data, setData] = useState<DaySummary | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'no-shop' | 'offline' | 'error'>('loading');
  const [errMsg, setErrMsg] = useState('');
  const [closing, setClosing] = useState(false);
  const [closed, setClosed] = useState(false);

  const load = async () => {
    setState('loading'); setErrMsg('');
    try {
      const r = await api<DaySummary>('/eod/day-summary');
      setData(r);
      setState('ok');
    } catch (e) {
      if (e instanceof OfflineError || (e as Error)?.name === 'TypeError') {
        setState('offline');
      } else if (e instanceof ApiError && (e.status === 404 || /shop/i.test(e.message))) {
        // No active shop selected — day-summary can't scope without one.
        setState('no-shop');
      } else {
        setState('error');
        setErrMsg((e as Error).message || 'Failed to load');
      }
    }
  };

  useEffect(() => { void load(); }, []);

  const closeDay = async () => {
    if (!data) return;
    setClosing(true);
    try {
      await api('/eod/close-day', {
        method: 'POST',
        body: JSON.stringify({ shopId: data.shopId, tradingDate: data.tradingDate }),
      });
      setClosed(true);
    } catch (e) {
      setErrMsg((e as Error).message || 'Close failed');
      setState('error');
    } finally {
      setClosing(false);
    }
  };

  if (state === 'loading') {
    return <div className="grid place-items-center py-24"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  }

  if (state === 'no-shop') {
    return (
      <div className="p-5">
        <h2 className="text-lg font-extrabold text-slate-900 mb-3">End of Day</h2>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <div className="text-sm font-bold text-amber-900">No shop selected</div>
          <p className="text-xs text-amber-800/80 mt-1">Pick a shop in the POS tab first — the till is scoped per shop.</p>
        </div>
      </div>
    );
  }

  if (state === 'offline') {
    return (
      <div className="p-5">
        <h2 className="text-lg font-extrabold text-slate-900 mb-3">End of Day</h2>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
          <RefreshCw className="w-7 h-7 text-slate-400 mx-auto mb-2" />
          <div className="text-sm font-bold text-slate-700">Offline</div>
          <p className="text-xs text-slate-500 mt-1">Can't reach the till right now.</p>
          <button onClick={load} className="mt-3 h-10 px-5 rounded-xl bg-indigo-600 text-white text-xs font-extrabold">Retry</button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-5">
        <h2 className="text-lg font-extrabold text-slate-900 mb-3">End of Day</h2>
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{errMsg || 'Failed to load'}</div>
      </div>
    );
  }

  const cur = data.currency || 'TZS';
  const catEntries = Object.entries(data.breakdownByCategory || {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">End of Day</h2>
          <p className="text-[11px] text-slate-500">{data.shopName} · {data.tradingDate}</p>
        </div>
        <button onClick={load} className="w-9 h-9 rounded-lg bg-slate-100 grid place-items-center text-slate-500">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-500">
            Cash Sales <Wallet className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-lg font-extrabold text-slate-900 mt-1">{money(data.cashSales, cur)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-500">
            Expenses <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div className="text-lg font-extrabold text-slate-900 mt-1">{money(data.cashExpenses, cur)}</div>
          <div className="text-[10px] text-slate-500">{data.expenseCount} recorded</div>
        </div>
      </div>

      {/* Cash count */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
        <h3 className="text-xs font-extrabold uppercase text-slate-500 flex items-center gap-1.5">
          <Receipt className="w-3.5 h-3.5" /> Cash Count
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-600">Opening float</span><span className="font-bold">{money(data.openingFloat, cur)}</span></div>
          <div className="flex justify-between"><span className="text-slate-600">Cash sales</span><span className="font-bold text-emerald-700">+{money(data.cashSales, cur)}</span></div>
          <div className="flex justify-between"><span className="text-slate-600">Cash expenses</span><span className="font-bold text-rose-600">−{money(data.cashExpenses, cur)}</span></div>
          <div className="border-t border-slate-100 pt-2 flex justify-between font-extrabold text-slate-900">
            <span>Expected in drawer</span><span>{money(data.expectedCash, cur)}</span>
          </div>
        </div>
      </div>

      {/* Category breakdown */}
      {catEntries.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-xs font-extrabold uppercase text-slate-500 mb-2">Expenses by category</h3>
          <div className="space-y-1.5">
            {catEntries.map(([cat, amt]) => (
              <div key={cat} className="flex justify-between text-sm">
                <span className="text-slate-600 capitalize">{cat}</span>
                <span className="font-bold">{money(amt, cur)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {errMsg && state === 'error' && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{errMsg}</div>
      )}

      {closed ? (
        <div className="w-full h-12 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-extrabold flex items-center justify-center gap-2">
          <CheckCircle2 className="w-5 h-5" /> Till closed for {data.tradingDate}
        </div>
      ) : (
        <button
          onClick={closeDay}
          disabled={closing}
          className="w-full h-12 rounded-xl bg-emerald-600 text-white font-extrabold text-sm disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {closing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Close Till &amp; Submit
        </button>
      )}
    </div>
  );
}
