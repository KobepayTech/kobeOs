import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  NotebookPen, TrendingUp, TrendingDown, Plus, Trash2,
  Download, Calendar, Wallet, Receipt,
} from 'lucide-react';

/**
 * Sales & Expenses — quick-entry book.
 *
 * Two tabs:
 *   • Expenses → date, reason, amount
 *   • Sales    → date, amount
 *
 * Persists to localStorage so it works offline. The top KPI row totals
 * the current filter range (default: all-time). Export-to-CSV exists
 * for accountants who want to lift entries into a spreadsheet.
 *
 * Designed as a friendlier alternative to the full End-of-Day flow when
 * the operator just wants to jot a number down without till counting
 * or shop selection.
 */

const STORAGE_KEY = 'kobe.erp.summary.entries.v1';
const CURRENCY = 'TZS';

type Tab = 'expenses' | 'sales';

interface SummaryEntry {
  id: string;
  kind: Tab;
  date: string;        // YYYY-MM-DD
  amount: number;
  reason?: string;     // expenses only
  createdAt: string;   // ISO
}

function loadEntries(): SummaryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e): e is SummaryEntry =>
      e && typeof e === 'object' &&
      typeof e.id === 'string' &&
      (e.kind === 'expenses' || e.kind === 'sales') &&
      typeof e.date === 'string' &&
      typeof e.amount === 'number',
    );
  } catch {
    return [];
  }
}

function saveEntries(entries: SummaryEntry[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); }
  catch { /* quota / private mode — keep in memory only */ }
}

const todayStr = () => new Date().toISOString().slice(0, 10);

const fmt = (n: number) => `${CURRENCY} ${Math.round(n).toLocaleString()}`;

export default function ErpSummary() {
  const [tab, setTab] = useState<Tab>('expenses');
  const [entries, setEntries] = useState<SummaryEntry[]>(() => loadEntries());

  useEffect(() => { saveEntries(entries); }, [entries]);

  const totals = useMemo(() => {
    let expenses = 0, sales = 0;
    for (const e of entries) {
      if (e.kind === 'expenses') expenses += e.amount;
      else sales += e.amount;
    }
    return { expenses, sales, net: sales - expenses };
  }, [entries]);

  const tabEntries = useMemo(() =>
    entries
      .filter((e) => e.kind === tab)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (a.createdAt < b.createdAt ? 1 : -1))),
  [entries, tab]);

  const addEntry = (e: Omit<SummaryEntry, 'id' | 'createdAt' | 'kind'>) => {
    const entry: SummaryEntry = {
      id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      kind: tab,
      createdAt: new Date().toISOString(),
      ...e,
    };
    setEntries((prev) => [entry, ...prev]);
  };

  const removeEntry = (id: string) => {
    if (!window.confirm('Remove this entry?')) return;
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const exportCsv = () => {
    const rows = [
      ['date', 'kind', 'amount', 'reason'],
      ...entries
        .slice()
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .map((e) => [e.date, e.kind, String(e.amount), e.reason ?? '']),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `summary-${todayStr()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full bg-[#0a0a1a] text-white overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 space-y-4">

        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <NotebookPen className="w-4 h-4 text-amber-300" />
              Sales &amp; Expenses
            </h1>
            <p className="text-[11px] text-white/40">
              Quick log for daily sales totals and expenses. Offline-first &mdash; entries stay on this device.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={exportCsv}
            disabled={entries.length === 0}
            className="border-white/15 text-white/80 hover:bg-white/5"
          >
            <Download className="w-3.5 h-3.5 mr-1" />Export CSV
          </Button>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-3 gap-3">
          <KpiCard
            label="Sales"
            value={fmt(totals.sales)}
            icon={<TrendingUp className="w-4 h-4 text-emerald-300" />}
            accent="emerald"
          />
          <KpiCard
            label="Expenses"
            value={fmt(totals.expenses)}
            icon={<TrendingDown className="w-4 h-4 text-rose-300" />}
            accent="rose"
          />
          <KpiCard
            label="Net"
            value={fmt(totals.net)}
            icon={<Wallet className="w-4 h-4 text-blue-300" />}
            accent={totals.net >= 0 ? 'emerald' : 'rose'}
          />
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2">
          <TabButton active={tab === 'expenses'} onClick={() => setTab('expenses')}>
            <Receipt className="w-3.5 h-3.5" />
            Expenses
            <CountBadge>{entries.filter((e) => e.kind === 'expenses').length}</CountBadge>
          </TabButton>
          <TabButton active={tab === 'sales'} onClick={() => setTab('sales')}>
            <TrendingUp className="w-3.5 h-3.5" />
            Sales
            <CountBadge>{entries.filter((e) => e.kind === 'sales').length}</CountBadge>
          </TabButton>
        </div>

        {/* Entry form */}
        <Card className="bg-[#13131f] border-white/10">
          <CardContent className="p-4">
            {tab === 'expenses' ? (
              <ExpenseForm onAdd={addEntry} />
            ) : (
              <SalesForm onAdd={addEntry} />
            )}
          </CardContent>
        </Card>

        {/* Entry list */}
        <Card className="bg-[#13131f] border-white/10">
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-medium text-white/80">
              {tab === 'expenses' ? 'Recorded expenses' : 'Recorded sales'}
            </h3>
            {tabEntries.length === 0 ? (
              <p className="text-xs text-white/40 py-4 text-center">
                Nothing yet. Add the first {tab === 'expenses' ? 'expense' : 'sale'} above.
              </p>
            ) : (
              <ul className="divide-y divide-white/[0.04]">
                {tabEntries.map((e) => (
                  <li key={e.id} className="flex items-start gap-3 py-2">
                    <div className="text-[10px] text-white/40 w-20 flex items-center gap-1 pt-0.5 flex-shrink-0">
                      <Calendar className="w-3 h-3" />
                      {e.date}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-bold ${tab === 'expenses' ? 'text-rose-200' : 'text-emerald-200'}`}>
                        {tab === 'expenses' ? '−' : '+'}{fmt(e.amount)}
                      </div>
                      {e.reason && (
                        <div className="text-xs text-white/60 mt-0.5 break-words">{e.reason}</div>
                      )}
                    </div>
                    <button
                      onClick={() => removeEntry(e.id)}
                      className="text-rose-300/60 hover:text-rose-300 mt-1"
                      aria-label="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ExpenseForm({ onAdd }: { onAdd: (e: { date: string; amount: number; reason?: string }) => void }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(todayStr());

  const submit = () => {
    const value = Number(amount);
    if (!value || value <= 0) return;
    onAdd({ date, amount: value, reason: reason.trim() || undefined });
    setAmount('');
    setReason('');
    setDate(todayStr());
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-white/40 uppercase mb-1 block">Amount ({CURRENCY})</label>
          <Input
            type="number"
            inputMode="decimal"
            min="0"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            className="bg-white/5 border-white/10 text-base font-bold"
          />
        </div>
        <div>
          <label className="text-[10px] text-white/40 uppercase mb-1 block">Date</label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-white/5 border-white/10 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="text-[10px] text-white/40 uppercase mb-1 block">Reason</label>
        <Input
          placeholder="Stock purchase, electricity, transport…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          className="bg-white/5 border-white/10 text-sm"
        />
      </div>
      <Button
        onClick={submit}
        disabled={!amount || Number(amount) <= 0}
        className="w-full bg-rose-600 hover:bg-rose-500 disabled:opacity-40"
      >
        <Plus className="w-4 h-4 mr-2" />
        Record expense
      </Button>
    </div>
  );
}

function SalesForm({ onAdd }: { onAdd: (e: { date: string; amount: number; reason?: string }) => void }) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayStr());

  const submit = () => {
    const value = Number(amount);
    if (!value || value <= 0) return;
    onAdd({ date, amount: value });
    setAmount('');
    setDate(todayStr());
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-white/40 uppercase mb-1 block">Sales figure ({CURRENCY})</label>
          <Input
            type="number"
            inputMode="decimal"
            min="0"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            className="bg-white/5 border-white/10 text-base font-bold"
          />
        </div>
        <div>
          <label className="text-[10px] text-white/40 uppercase mb-1 block">Date</label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-white/5 border-white/10 text-sm"
          />
        </div>
      </div>
      <Button
        onClick={submit}
        disabled={!amount || Number(amount) <= 0}
        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40"
      >
        <Plus className="w-4 h-4 mr-2" />
        Record sale
      </Button>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
        active
          ? 'bg-amber-500/15 text-amber-200 border border-amber-500/40'
          : 'bg-white/[0.03] text-white/60 border border-white/10 hover:bg-white/[0.06]'
      }`}
    >
      {children}
    </button>
  );
}

function CountBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-1.5 py-0.5 rounded bg-white/[0.08] text-[10px] font-extrabold text-white/70">
      {children}
    </span>
  );
}

function KpiCard({ label, value, icon, accent }: {
  label: string; value: string; icon: React.ReactNode; accent: 'emerald' | 'rose' | 'blue';
}) {
  const valueTone =
    accent === 'emerald' ? 'text-emerald-300' :
    accent === 'rose'    ? 'text-rose-300' :
                            'text-blue-300';
  return (
    <Card className="bg-[#13131f] border-white/10">
      <CardContent className="p-3">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-white/40">
          {label}
          {icon}
        </div>
        <div className={`text-base font-bold mt-0.5 ${valueTone}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
