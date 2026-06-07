import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useActiveShop } from '@/hooks/useActiveShop';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Loader2, Wallet, Receipt, Plus, Trash2, CheckCircle2, AlertTriangle,
  Calendar, Smartphone, Banknote, CreditCard, ArrowRight, Sun, Moon,
} from 'lucide-react';
import { PhotoUpload } from '@/components/PhotoUpload';

/**
 * End-of-day cashier console — PWA-friendly. Three jobs in one screen:
 *   1. Show "money in" so far today (cash sales from POS)
 *   2. Let the cashier record any expense (money OUT) with category
 *   3. Count physical cash at close, see variance, and persist it
 *
 * Designed mobile-first since this is what a counter cashier does on
 * their phone at the end of every trading day.
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

interface ExpenseRow {
  id: string;
  amount: number | string;
  currency: string;
  category: string;
  description: string;
  receiptUrl?: string | null;
  paidVia: 'cash' | 'mobile_money' | 'bank' | 'card' | 'kobepay';
  createdAt: string;
}

interface CategoryOption {
  value: string;
  label: string;
}

const PAID_VIA_ICONS = {
  cash:         <Banknote className="w-3.5 h-3.5" />,
  mobile_money: <Smartphone className="w-3.5 h-3.5" />,
  bank:         <CreditCard className="w-3.5 h-3.5" />,
  card:         <CreditCard className="w-3.5 h-3.5" />,
  kobepay:      <Wallet className="w-3.5 h-3.5" />,
} as const;

const fmt = (n: number | string, currency = 'TZS') =>
  `${currency} ${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function EodApp() {
  const { activeShop, loading: shopLoading } = useActiveShop();
  const [tradingDate, setTradingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState<DaySummary | null>(null);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countedCash, setCountedCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [closing, setClosing] = useState(false);
  const [closed, setClosed] = useState<{ variance: number; counted: number } | null>(null);

  const load = useCallback(async () => {
    if (!activeShop) return;
    setLoading(true);
    setError(null);
    try {
      const [s, e, c] = await Promise.all([
        api<DaySummary>(`/eod/day-summary?date=${tradingDate}`),
        api<ExpenseRow[]>(`/eod/expenses?from=${tradingDate}&to=${tradingDate}`),
        api<CategoryOption[]>('/eod/expenses/categories'),
      ]);
      setSummary(s);
      setExpenses(e ?? []);
      setCategories(c ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [activeShop, tradingDate]);

  useEffect(() => {
    load();
  }, [load]);

  const variance = useMemo(() => {
    if (!summary || !countedCash) return null;
    return parseFloat(countedCash) - summary.expectedCash;
  }, [summary, countedCash]);

  const closeDay = async () => {
    if (!countedCash || !summary) return;
    setClosing(true);
    setError(null);
    try {
      const result = await api<{ variance: number; countedCash: number }>('/eod/close-day', {
        method: 'POST',
        body: JSON.stringify({ tradingDate, countedCash: Number(countedCash), notes: closeNotes }),
      });
      setClosed({ variance: Number(result.variance), counted: Number(result.countedCash) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Close failed');
    } finally {
      setClosing(false);
    }
  };

  if (shopLoading) {
    return <div className="p-8 text-center text-white/50"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>;
  }
  if (!activeShop) {
    return (
      <div className="p-8 text-center text-white/60">
        <Wallet className="w-8 h-8 mx-auto mb-2 text-white/30" />
        <p>Pick a shop from the switcher in the top-right corner before recording end-of-day.</p>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#0a0a1a] text-white overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-300" />
              End-of-day · {activeShop.name}
            </h1>
            <p className="text-[11px] text-white/40">
              Record expenses through the day, then count the till at close.
            </p>
          </div>
          <Input
            type="date"
            value={tradingDate}
            onChange={(e) => setTradingDate(e.target.value)}
            className="bg-white/5 border-white/10 w-40 h-8 text-xs"
          />
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs px-3 py-2 rounded">{error}</div>
        )}

        {/* Headline KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Opening float" value={fmt(summary?.openingFloat ?? 0, summary?.currency)} icon={<Sun className="w-4 h-4 text-amber-300" />} />
          <Kpi label="Cash sales (green)" value={fmt(summary?.cashSales ?? 0, summary?.currency)} icon={<Wallet className="w-4 h-4 text-emerald-300" />} accent="emerald" />
          <Kpi label="Cash expenses (red)" value={fmt(summary?.cashExpenses ?? 0, summary?.currency)} icon={<Receipt className="w-4 h-4 text-rose-300" />} accent="rose" />
          <Kpi label="Expected in till" value={fmt(summary?.expectedCash ?? 0, summary?.currency)} icon={<Moon className="w-4 h-4 text-blue-300" />} accent="blue" />
        </div>

        {/* Add expense */}
        <Card className="bg-[#13131f] border-white/10">
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-medium flex items-center gap-2"><Plus className="w-4 h-4 text-rose-300" /> Add money taken out</h3>
            <ExpenseForm
              categories={categories}
              currency={summary?.currency ?? 'TZS'}
              onSaved={async () => { await load(); }}
              onError={(m) => setError(m)}
            />
          </CardContent>
        </Card>

        {/* Expense list */}
        <Card className="bg-[#13131f] border-white/10">
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-medium flex items-center gap-2"><Receipt className="w-4 h-4 text-amber-300" /> Today's expenses</h3>
            {loading ? (
              <div className="text-xs text-white/40 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Loading…</div>
            ) : expenses.length === 0 ? (
              <p className="text-xs text-white/40">Nothing recorded yet today.</p>
            ) : (
              <div className="space-y-1.5">
                {expenses.map((e) => (
                  <div key={e.id} className="flex items-start gap-2 p-2 bg-white/[0.02] rounded">
                    <div className="text-white/40">{PAID_VIA_ICONS[e.paidVia] ?? null}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs font-medium text-white truncate">{e.description || '(no description)'}</span>
                        <span className="text-sm font-bold text-rose-200 whitespace-nowrap">−{fmt(e.amount, e.currency)}</span>
                      </div>
                      <div className="text-[10px] text-white/40">
                        {(categories.find((c) => c.value === e.category)?.label ?? e.category)} · {new Date(e.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        if (!window.confirm('Remove this expense?')) return;
                        try {
                          await api(`/eod/expenses/${e.id}`, { method: 'DELETE' });
                          await load();
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Delete failed');
                        }
                      }}
                      className="text-rose-300 hover:text-rose-200"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Close day */}
        <Card className={closed ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-[#13131f] border-white/10'}>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-300" /> Count the till
            </h3>
            {closed ? (
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2 text-emerald-300 font-medium">
                  <CheckCircle2 className="w-4 h-4" /> Day closed.
                </div>
                <p className="text-white/70 text-xs">
                  Counted {fmt(closed.counted, summary?.currency)} · variance{' '}
                  <span className={closed.variance === 0 ? 'text-emerald-300' : closed.variance < 0 ? 'text-rose-300' : 'text-amber-300'}>
                    {closed.variance >= 0 ? '+' : ''}{fmt(closed.variance, summary?.currency)}
                  </span>
                </p>
                <Button size="sm" variant="ghost" onClick={() => { setClosed(null); setCountedCash(''); setCloseNotes(''); }}>
                  Re-count
                </Button>
              </div>
            ) : (
              <>
                <p className="text-[11px] text-white/50">
                  Count the cash in the till physically, then enter what you found.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-white/40 uppercase">Counted cash</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={countedCash}
                      onChange={(e) => setCountedCash(e.target.value)}
                      className="bg-white/5 border-white/10 text-lg font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/40 uppercase">Expected</label>
                    <div className="h-9 px-3 flex items-center bg-white/[0.02] border border-white/5 rounded text-base font-bold">
                      {fmt(summary?.expectedCash ?? 0, summary?.currency)}
                    </div>
                  </div>
                </div>
                {variance !== null && (
                  <div
                    className={`text-xs rounded p-2 border ${
                      variance === 0
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                        : variance < 0
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                    }`}
                  >
                    {variance === 0
                      ? 'Till balances exactly.'
                      : variance < 0
                      ? <><AlertTriangle className="w-3 h-3 inline mr-1" /> Short by {fmt(Math.abs(variance), summary?.currency)}. Recount or note why.</>
                      : <><AlertTriangle className="w-3 h-3 inline mr-1" /> Over by {fmt(variance, summary?.currency)}. Possibly missed expense.</>}
                  </div>
                )}
                <Textarea
                  placeholder="Notes about variance (optional)"
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  rows={2}
                  className="bg-white/5 border-white/10 text-xs"
                />
                <Button
                  onClick={closeDay}
                  disabled={closing || !countedCash}
                  className="w-full bg-emerald-600 hover:bg-emerald-500"
                >
                  {closing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                  Close trading day
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ExpenseForm({
  categories,
  currency,
  onSaved,
  onError,
}: {
  categories: CategoryOption[];
  currency: string;
  onSaved: () => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('other');
  const [description, setDescription] = useState('');
  const [paidVia, setPaidVia] = useState<'cash' | 'mobile_money' | 'bank' | 'card' | 'kobepay'>('cash');
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!amount || Number(amount) <= 0) return;
    setSaving(true);
    try {
      await api('/eod/expenses', {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(amount),
          currency,
          category,
          description,
          paidVia,
          receiptUrl,
        }),
      });
      setAmount('');
      setDescription('');
      setReceiptUrl(null);
      await onSaved();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="bg-white/5 border-white/10 text-base font-bold"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-9 px-2 rounded-md bg-white/5 border border-white/10 text-xs text-white"
        >
          {categories.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>
      <Input
        placeholder="What was it for? (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="bg-white/5 border-white/10 text-xs"
      />
      <div>
        <label className="text-[10px] text-white/40 uppercase mb-1 block">Paid via</label>
        <div className="grid grid-cols-5 gap-1">
          {(['cash', 'mobile_money', 'bank', 'card', 'kobepay'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setPaidVia(v)}
              className={`flex flex-col items-center gap-0.5 py-1.5 rounded border text-[10px] ${
                paidVia === v
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                  : 'border-white/10 text-white/50 hover:bg-white/[0.04]'
              }`}
            >
              {PAID_VIA_ICONS[v]}
              {v.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>
      <PhotoUpload value={receiptUrl} onChange={setReceiptUrl} label="Receipt photo (optional)" />
      <Button
        onClick={submit}
        disabled={saving || !amount}
        className="w-full bg-rose-600 hover:bg-rose-500"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
        Record expense
      </Button>
    </div>
  );
}

function Kpi({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent?: 'emerald' | 'rose' | 'blue' }) {
  const accentCls =
    accent === 'emerald' ? 'text-emerald-300'
    : accent === 'rose'  ? 'text-rose-300'
    : accent === 'blue'  ? 'text-blue-300'
    : 'text-white';
  return (
    <Card className="bg-[#13131f] border-white/10">
      <CardContent className="p-3 space-y-0.5">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-white/40">
          {label}
          {icon}
        </div>
        <div className={`text-base font-bold ${accentCls}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
