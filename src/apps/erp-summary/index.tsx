import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  NotebookPen, TrendingUp, TrendingDown, Plus, Trash2,
  Download, Calendar, Wallet, Receipt, CloudOff, RefreshCw,
} from 'lucide-react';
import { api, ApiError, OfflineError, OfflineWriteQueuedError } from '@/lib/api';

/**
 * Sales & Expenses — quick-entry book.
 *
 * Two tabs:
 *   • Expenses → date, reason, amount
 *   • Sales    → date, amount
 *
 * Persists to /api/erp/summary-entries (JWT-scoped per tenant) so the
 * books survive a browser cache clear and roam across till + manager
 * devices. Falls back to localStorage when the backend is unreachable;
 * legacy local entries are bulk-imported on first successful sync.
 */

const LEGACY_STORAGE_KEY = 'kobe.erp.summary.entries.v1';
const MIRROR_STORAGE_KEY = 'kobe.erp.summary.entries.mirror.v1';
const CURRENCY = 'TZS';

type Tab = 'expenses' | 'sales';

interface SummaryEntry {
  id: string;
  kind: Tab;
  date: string;        // YYYY-MM-DD
  amount: number;
  reason?: string;
  createdAt: string;   // ISO
}

interface ServerEntry {
  id: string;
  kind: Tab;
  date: string;
  amount: string | number;
  reason: string;
  createdAt: string;
}

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmt = (n: number) => `${CURRENCY} ${Math.round(n).toLocaleString()}`;

function fromServer(e: ServerEntry): SummaryEntry {
  return {
    id: e.id,
    kind: e.kind,
    date: e.date,
    amount: Number(e.amount),
    reason: e.reason || undefined,
    createdAt: e.createdAt,
  };
}

function readMirror(): SummaryEntry[] {
  try {
    const raw = localStorage.getItem(MIRROR_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function writeMirror(entries: SummaryEntry[]) {
  try { localStorage.setItem(MIRROR_STORAGE_KEY, JSON.stringify(entries)); }
  catch { /* quota / private mode — in-memory only */ }
}

function readLegacy(): SummaryEntry[] {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
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
  } catch { return []; }
}

export default function ErpSummary() {
  const [tab, setTab] = useState<Tab>('expenses');
  const [entries, setEntries] = useState<SummaryEntry[]>(() => readMirror());
  const [syncState, setSyncState] = useState<'idle' | 'loading' | 'offline' | 'error'>('loading');
  const [errMsg, setErrMsg] = useState('');

  const reload = async () => {
    setSyncState('loading'); setErrMsg('');
    try {
      const server = await api<ServerEntry[]>('/erp/summary-entries');
      let next = (server ?? []).map(fromServer);

      const legacy = readLegacy();
      if (next.length === 0 && legacy.length > 0) {
        try {
          await api('/erp/summary-entries/bulk-import', {
            method: 'POST',
            body: JSON.stringify({
              entries: legacy.map((e) => ({
                kind: e.kind, date: e.date, amount: e.amount, reason: e.reason ?? '',
              })),
            }),
          });
          const after = await api<ServerEntry[]>('/erp/summary-entries');
          next = (after ?? []).map(fromServer);
          try { localStorage.removeItem(LEGACY_STORAGE_KEY); } catch { /* ignore */ }
        } catch { /* leave legacy in place; next reload will retry */ }
      }

      setEntries(next);
      writeMirror(next);
      setSyncState('idle');
    } catch (err) {
      if (err instanceof OfflineError || (err as Error)?.name === 'TypeError') {
        setSyncState('offline');
        const mirror = readMirror();
        const legacy = readLegacy();
        if (mirror.length === 0 && legacy.length > 0) setEntries(legacy);
        else setEntries(mirror);
      } else if (err instanceof ApiError) {
        setSyncState('error');
        setErrMsg(err.message);
      } else {
        setSyncState('error');
        setErrMsg((err as Error).message || 'Failed to load');
      }
    }
  };

  useEffect(() => { void reload(); }, []);

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

  const addEntry = async (e: { date: string; amount: number; reason?: string }) => {
    const optimistic: SummaryEntry = {
      id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      kind: tab,
      createdAt: new Date().toISOString(),
      ...e,
    };
    setEntries((prev) => {
      const next = [optimistic, ...prev];
      writeMirror(next);
      return next;
    });

    try {
      const saved = await api<ServerEntry>('/erp/summary-entries', {
        method: 'POST',
        body: JSON.stringify({ kind: tab, date: e.date, amount: e.amount, reason: e.reason ?? '' }),
      });
      setEntries((prev) => {
        const next = prev.map((row) => row.id === optimistic.id ? fromServer(saved) : row);
        writeMirror(next);
        return next;
      });
      setSyncState((s) => (s === 'idle' ? s : 'idle'));
    } catch (err) {
      if (err instanceof OfflineWriteQueuedError) setSyncState('offline');
      // optimistic row stays — queued for sync by api()
    }
  };

  const removeEntry = async (id: string) => {
    if (!window.confirm('Remove this entry?')) return;
    // Capture the row from the live state at delete-time (not from the
    // render-closure) so two rapid deletes don't roll back to a stale
    // snapshot that still contains the previously-deleted row.
    let removed: SummaryEntry | undefined;
    setEntries((prev) => {
      removed = prev.find((row) => row.id === id);
      const next = prev.filter((row) => row.id !== id);
      writeMirror(next);
      return next;
    });

    if (id.startsWith('local_')) return;

    try {
      await api(`/erp/summary-entries/${id}`, { method: 'DELETE' });
    } catch (err) {
      if (err instanceof OfflineWriteQueuedError) { setSyncState('offline'); return; }
      if (removed) {
        setEntries((cur) => {
          const next = [removed!, ...cur].sort((a, b) =>
            a.date < b.date ? 1 : a.date > b.date ? -1 : (a.createdAt < b.createdAt ? 1 : -1));
          writeMirror(next);
          return next;
        });
      }
      setErrMsg((err as Error).message || 'Delete failed');
    }
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
              Quick log for daily sales totals and expenses. Synced to your account &mdash; same numbers on every device.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SyncBadge state={syncState} onRetry={reload} />
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
        </div>

        {errMsg && syncState === 'error' && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-200 text-xs px-3 py-2">
            {errMsg}
          </div>
        )}

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
                        {e.id.startsWith('local_') && (
                          <span className="ml-2 text-[9px] uppercase tracking-wide text-amber-300/70">pending sync</span>
                        )}
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

function SyncBadge({ state, onRetry }: { state: 'idle' | 'loading' | 'offline' | 'error'; onRetry: () => void }) {
  if (state === 'idle') return null;
  if (state === 'loading') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-white/40">
        <RefreshCw className="w-3 h-3 animate-spin" /> Syncing
      </span>
    );
  }
  if (state === 'offline') {
    return (
      <button onClick={onRetry} className="inline-flex items-center gap-1 text-[10px] text-amber-300/80 hover:text-amber-200">
        <CloudOff className="w-3 h-3" /> Offline · tap to retry
      </button>
    );
  }
  return (
    <button onClick={onRetry} className="inline-flex items-center gap-1 text-[10px] text-rose-300/80 hover:text-rose-200">
      <RefreshCw className="w-3 h-3" /> Sync failed · retry
    </button>
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
