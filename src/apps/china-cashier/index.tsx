import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useQRScanner } from '@/hooks/useQRScanner';
import { QRCodeSVG } from 'qrcode.react';
import {
  Landmark, LayoutDashboard, ScanLine, History, BarChart3, Search, Loader2, CheckCircle2,
  Clock, Wallet, Package, X, Camera, Banknote, Building2, Smartphone, CreditCard, MoreHorizontal,
  Download, Printer, Plus, Receipt as ReceiptIcon, ArrowRight, AlertCircle,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';

/* ── Types mirroring the backend ── */
type Method = 'Cash' | 'Bank' | 'WeChat' | 'Alipay' | 'Other';
interface ReceiptItem { name: string; qty: number; unitPrice?: number }
interface PayoutReceipt {
  id: string; receiptNumber: string; publicToken: string;
  customerName: string; customerPhone: string;
  supplierName: string; supplierPhone: string;
  items?: ReceiptItem[] | null; itemCount: number;
  amountDue: number | string; shipping: number | string; serviceFee: number | string; total: number | string;
  currency: string; status: 'Pending' | 'Paid';
  paymentMethod: Method | ''; transactionId: string; paidByName: string; paidAt?: string | null;
  createdByName: string; createdAt: string;
}
interface Dashboard {
  currency: string;
  cards: { pendingAmount: number; pendingCount: number; paidToday: number; paidTodayCount: number; totalPaid: number; totalPaidCount: number };
  byMethod: { method: string; amount: number; count: number }[];
  pendingVsPaid: { name: string; value: number; count: number }[];
  dailyTrend: { date: string; amount: number }[];
  monthlyTrend: { month: string; amount: number }[];
}

const METHODS: { key: Method; label: string; Icon: typeof Banknote }[] = [
  { key: 'Cash', label: 'Cash', Icon: Banknote },
  { key: 'Bank', label: 'Bank', Icon: Building2 },
  { key: 'WeChat', label: 'WeChat', Icon: Smartphone },
  { key: 'Alipay', label: 'Alipay', Icon: CreditCard },
  { key: 'Other', label: 'Other', Icon: MoreHorizontal },
];
const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const symbolFor = (c: string) => (c === 'CNY' ? '¥' : c === 'USD' ? '$' : c === 'TZS' ? 'TSh ' : `${c} `);
const money = (n: number | string, c = 'CNY') => `${symbolFor(c)}${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default function ChinaCashier() {
  const [tab, setTab] = useState<'dashboard' | 'payout' | 'history' | 'analytics'>('dashboard');
  // Optional cashier PIN — when set it's sent as X-KobePay-Pin so the
  // backend enforces this cashier's role (China cashiers can pay; TZ
  // cashiers are blocked). Empty = act as the account owner.
  const [pin, setPin] = useState('');

  const apiPin = useCallback(<T,>(path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (pin.trim()) headers.set('x-kobepay-pin', pin.trim());
    return api<T>(path, { ...init, headers });
  }, [pin]);

  const tabs = [
    { key: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
    { key: 'payout', label: 'Initiate Payout', Icon: ScanLine },
    { key: 'history', label: 'History', Icon: History },
    { key: 'analytics', label: 'Analytics', Icon: BarChart3 },
  ] as const;

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-red-600 grid place-items-center">
            <Landmark className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold leading-tight">China Cashier</h1>
            <p className="text-[10px] text-slate-500 leading-tight">KobePay · supplier payouts</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="Cashier PIN"
            inputMode="numeric"
            className="w-24 h-8 px-2 rounded-md bg-slate-900 border border-slate-700 text-xs text-center tracking-widest placeholder:tracking-normal"
            title="Optional — enter a China Cashier's 4-digit PIN to act as them"
          />
        </div>
      </div>

      <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-800 shrink-0 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold whitespace-nowrap transition ${tab === t.key ? 'bg-rose-600 text-white' : 'text-slate-400 hover:bg-slate-900'}`}>
            <t.Icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {tab === 'dashboard' && <DashboardTab apiPin={apiPin} onGoPayout={() => setTab('payout')} />}
        {tab === 'payout' && <PayoutTab apiPin={apiPin} />}
        {tab === 'history' && <HistoryTab apiPin={apiPin} />}
        {tab === 'analytics' && <AnalyticsTab apiPin={apiPin} />}
      </div>
    </div>
  );
}

/* ────────────────────────── Dashboard ────────────────────────── */
function DashboardTab({ apiPin, onGoPayout }: { apiPin: <T,>(p: string, i?: RequestInit) => Promise<T>; onGoPayout: () => void }) {
  const [d, setD] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setD(await apiPin<Dashboard>('/kobepay/receipts/dashboard')); }
    catch { /* offline */ }
    finally { setLoading(false); }
  }, [apiPin]);
  useEffect(() => { load(); }, [load]);

  const seed = async () => {
    setSeeding(true);
    try { await apiPin('/kobepay/receipts/seed-demo', { method: 'POST', body: '{}' }); await load(); }
    catch { /* ignore */ } finally { setSeeding(false); }
  };

  if (loading) return <Center><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></Center>;
  const c = d?.cards;
  const cur = d?.currency ?? 'CNY';
  const empty = !c || (c.pendingCount === 0 && c.totalPaidCount === 0);

  return (
    <div className="p-4 space-y-4">
      {empty && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 flex items-center justify-between gap-3">
          <div className="text-sm text-slate-300">No receipts yet. Add some mockup data to explore the workflow.</div>
          <button onClick={seed} disabled={seeding} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold disabled:opacity-50">
            {seeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Add demo receipts
          </button>
        </div>
      )}

      {/* Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Pending Payouts" value={money(c?.pendingAmount ?? 0, cur)} sub={`${c?.pendingCount ?? 0} receipts`} tone="amber" Icon={Clock} onClick={onGoPayout} />
        <StatCard label="Paid Today" value={money(c?.paidToday ?? 0, cur)} sub={`${c?.paidTodayCount ?? 0} payouts`} tone="emerald" Icon={CheckCircle2} />
        <StatCard label="Total Paid" value={money(c?.totalPaid ?? 0, cur)} sub={`${c?.totalPaidCount ?? 0} all-time`} tone="indigo" Icon={Wallet} />
        <StatCard label="Pending Receipts" value={String(c?.pendingCount ?? 0)} sub="awaiting payout" tone="rose" Icon={ReceiptIcon} onClick={onGoPayout} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ChartCard title="Pending vs Paid">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={d?.pendingVsPaid ?? []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={(e: any) => e.name}>
                {(d?.pendingVsPaid ?? []).map((_, i) => <Cell key={i} fill={i === 0 ? '#f59e0b' : '#10b981'} />)}
              </Pie>
              <Tooltip formatter={(v: any) => money(v, cur)} contentStyle={TOOLTIP} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Payouts by Method">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={d?.byMethod ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="method" tick={AXIS} />
              <YAxis tick={AXIS} width={40} />
              <Tooltip formatter={(v: any) => money(v, cur)} contentStyle={TOOLTIP} />
              <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                {(d?.byMethod ?? []).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Daily Payout Trend (14d)">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={d?.dailyTrend ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={AXIS} />
              <YAxis tick={AXIS} width={40} />
              <Tooltip formatter={(v: any) => money(v, cur)} contentStyle={TOOLTIP} />
              <Line type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Monthly Payout Trend (12m)">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={d?.monthlyTrend ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" tick={AXIS} tickFormatter={(m: string) => m.slice(5)} />
              <YAxis tick={AXIS} width={40} />
              <Tooltip formatter={(v: any) => money(v, cur)} contentStyle={TOOLTIP} />
              <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

/* ────────────────────────── Initiate Payout ────────────────────────── */
function PayoutTab({ apiPin }: { apiPin: <T,>(p: string, i?: RequestInit) => Promise<T> }) {
  const [number, setNumber] = useState('');
  const [receipt, setReceipt] = useState<PayoutReceipt | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [method, setMethod] = useState<Method | null>(null);
  const [txnId, setTxnId] = useState('');
  const [notes, setNotes] = useState('');
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState(false);

  const lookup = useCallback(async (kind: 'number' | 'token', value: string) => {
    setError(null); setReceipt(null); setDone(false); setMethod(null); setTxnId(''); setNotes('');
    setLoading(true);
    try {
      const path = kind === 'number'
        ? `/kobepay/receipts/by-number/${encodeURIComponent(value.trim().toUpperCase())}`
        : `/kobepay/receipts/by-token/${encodeURIComponent(value)}`;
      const r = await apiPin<PayoutReceipt>(path);
      setReceipt(r);
    } catch (e) { setError((e as Error).message || 'Receipt not found.'); }
    finally { setLoading(false); }
  }, [apiPin]);

  const onScan = (raw: string) => {
    setScanning(false);
    const s = raw.trim();
    const m = s.match(/\/r\/([a-f0-9]{8,})/i);
    if (m) { setNumber(''); lookup('token', m[1]); }
    else if (/^KP-/i.test(s)) { setNumber(s.toUpperCase()); lookup('number', s); }
    else if (/^[a-f0-9]{16,}$/i.test(s)) { lookup('token', s); }
    else { setNumber(s.toUpperCase()); lookup('number', s); }
  };

  const pay = async () => {
    if (!receipt || !method) return;
    setPaying(true); setError(null);
    try {
      const updated = await apiPin<PayoutReceipt>(`/kobepay/receipts/${receipt.id}/pay`, {
        method: 'POST',
        body: JSON.stringify({ method, transactionId: txnId || undefined, notes: notes || undefined }),
      });
      setReceipt(updated); setDone(true);
    } catch (e) { setError((e as Error).message || 'Payout failed.'); }
    finally { setPaying(false); }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      {/* Search / scan */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">Find receipt</div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={number}
              onChange={(e) => setNumber(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === 'Enter' && number.trim()) lookup('number', number); }}
              placeholder="Receipt number  e.g. KP-2026-000254"
              className="w-full h-10 pl-8 pr-3 rounded-lg bg-slate-950 border border-slate-700 text-sm font-mono"
            />
          </div>
          <button onClick={() => number.trim() && lookup('number', number)} disabled={!number.trim() || loading}
            className="h-10 px-4 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold disabled:opacity-40">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Load'}
          </button>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-500"><span className="h-px flex-1 bg-slate-800" />OR<span className="h-px flex-1 bg-slate-800" /></div>
        <button onClick={() => setScanning(true)} className="w-full h-11 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold inline-flex items-center justify-center gap-2">
          <Camera className="w-4 h-4" /> Scan QR Code
        </button>
      </div>

      {error && <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm px-3 py-2 inline-flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}

      {/* Receipt detail + pay */}
      {receipt && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
          <div className={`px-4 py-3 flex items-center justify-between ${receipt.status === 'Paid' ? 'bg-emerald-600/20' : 'bg-slate-800/60'}`}>
            <div>
              <div className="text-[11px] text-slate-400 uppercase tracking-wide">Receipt</div>
              <div className="text-lg font-extrabold font-mono">{receipt.receiptNumber}</div>
            </div>
            <StatusPill status={receipt.status} />
          </div>

          <div className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="grid grid-cols-2 gap-3 text-sm flex-1">
                <KV label="Supplier" value={receipt.supplierName} />
                <KV label="Customer" value={receipt.customerName || '—'} />
                <KV label="Items" value={String(receipt.itemCount)} />
                <KV label="Created by" value={receipt.createdByName || '—'} />
              </div>
              {/* Every receipt carries a QR — scanning it opens the public
                  receipt page (/r/{token}) showing Pending / Paid status. */}
              <div className="bg-white rounded-lg p-1.5 shrink-0" title="Receipt QR — scan to open details">
                <QRCodeSVG value={`${window.location.origin}/r/${receipt.publicToken}`} size={72} />
              </div>
            </div>

            {(receipt.items?.length ?? 0) > 0 && (
              <div className="rounded-lg border border-slate-800 divide-y divide-slate-800/70">
                {receipt.items!.map((it, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="text-slate-300"><Package className="w-3.5 h-3.5 inline mr-1 text-slate-500" />{it.name} <span className="text-slate-500">×{it.qty}</span></span>
                    {it.unitPrice != null && <span className="text-slate-400">{money(it.unitPrice * it.qty, receipt.currency)}</span>}
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-lg bg-slate-950 border border-slate-800 p-3 space-y-1.5 text-sm">
              <Line2 label="Amount Due" value={money(receipt.amountDue, receipt.currency)} />
              <Line2 label="Shipping" value={money(receipt.shipping, receipt.currency)} />
              <Line2 label="Service Fee" value={money(receipt.serviceFee, receipt.currency)} />
              <div className="border-t border-slate-800 pt-1.5 flex items-center justify-between">
                <span className="font-bold">Total</span>
                <span className="text-xl font-extrabold text-emerald-400">{money(receipt.total, receipt.currency)}</span>
              </div>
            </div>

            {receipt.status === 'Paid' ? (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-sm text-emerald-300">
                <CheckCircle2 className="w-4 h-4 inline mr-1" /> Paid via <b>{receipt.paymentMethod}</b>
                {receipt.paidByName && <> by {receipt.paidByName}</>}
                {receipt.paidAt && <> on {new Date(receipt.paidAt).toLocaleString()}</>}
                {receipt.transactionId && <div className="text-emerald-400/70 text-xs mt-1">Txn: {receipt.transactionId}</div>}
                {done && (
                  <a href={`${window.location.origin}/r/${receipt.publicToken}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs underline text-emerald-200">
                    View / print receipt <ArrowRight className="w-3 h-3" />
                  </a>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">Payment Method</div>
                <div className="grid grid-cols-5 gap-2">
                  {METHODS.map((m) => (
                    <button key={m.key} onClick={() => setMethod(m.key)}
                      className={`flex flex-col items-center gap-1 py-2.5 rounded-lg border text-xs font-semibold transition ${method === m.key ? 'border-rose-500 bg-rose-500/15 text-white' : 'border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                      <m.Icon className="w-4 h-4" /> {m.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input value={txnId} onChange={(e) => setTxnId(e.target.value)} placeholder="Transaction ID (optional)" className="h-9 px-3 rounded-lg bg-slate-950 border border-slate-700 text-sm" />
                  <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" className="h-9 px-3 rounded-lg bg-slate-950 border border-slate-700 text-sm" />
                </div>
                <button onClick={pay} disabled={!method || paying}
                  className="w-full h-12 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-base inline-flex items-center justify-center gap-2 disabled:opacity-40">
                  {paying ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wallet className="w-5 h-5" />}
                  Pay Now · {money(receipt.total, receipt.currency)}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {scanning && <ScannerModal onClose={() => setScanning(false)} onResult={onScan} />}
    </div>
  );
}

/* ────────────────────────── History ────────────────────────── */
function HistoryTab({ apiPin }: { apiPin: <T,>(p: string, i?: RequestInit) => Promise<T> }) {
  const [rows, setRows] = useState<PayoutReceipt[]>([]);
  const [status, setStatus] = useState<'Paid' | 'Pending' | ''>('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let off = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (q.trim()) params.set('q', q.trim());
    apiPin<PayoutReceipt[]>(`/kobepay/receipts${params.toString() ? `?${params}` : ''}`)
      .then((r) => { if (!off) setRows(Array.isArray(r) ? r : []); })
      .catch(() => { if (!off) setRows([]); })
      .finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
  }, [apiPin, status, q]);

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search receipt, supplier, customer…" className="w-full h-9 pl-8 pr-3 rounded-lg bg-slate-900 border border-slate-700 text-sm" />
        </div>
        {(['', 'Pending', 'Paid'] as const).map((s) => (
          <button key={s || 'all'} onClick={() => setStatus(s)} className={`h-9 px-3 rounded-lg text-xs font-semibold ${status === s ? 'bg-rose-600 text-white' : 'bg-slate-900 text-slate-400'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {loading ? <Center><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></Center> : rows.length === 0 ? (
        <div className="text-center text-slate-500 text-sm py-12">No receipts.</div>
      ) : (
        <div className="rounded-xl border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-400 text-xs">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Receipt</th>
                <th className="text-left px-3 py-2 font-semibold">Supplier</th>
                <th className="text-right px-3 py-2 font-semibold">Total</th>
                <th className="text-left px-3 py-2 font-semibold">Method</th>
                <th className="text-left px-3 py-2 font-semibold">Paid by</th>
                <th className="text-center px-3 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-900/40">
                  <td className="px-3 py-2 font-mono text-xs text-slate-300">{r.receiptNumber}</td>
                  <td className="px-3 py-2 text-slate-300">{r.supplierName}</td>
                  <td className="px-3 py-2 text-right font-semibold">{money(r.total, r.currency)}</td>
                  <td className="px-3 py-2 text-slate-400 text-xs">{r.paymentMethod || '—'}</td>
                  <td className="px-3 py-2 text-slate-400 text-xs">{r.paidByName || '—'}</td>
                  <td className="px-3 py-2 text-center"><StatusPill status={r.status} small /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────── Analytics (admin) ────────────────────────── */
interface Analytics {
  currency: string;
  totals: { pendingAmount: number; pendingCount: number; paidAmount: number; paidCount: number; avgPayoutHours: number };
  byCashier: { key: string; amount: number; count: number }[];
  byMethod: { key: string; amount: number; count: number }[];
  byDay: { key: string; amount: number; count: number }[];
  byMonth: { key: string; amount: number; count: number }[];
  rows: PayoutReceipt[];
}
function AnalyticsTab({ apiPin }: { apiPin: <T,>(p: string, i?: RequestInit) => Promise<T> }) {
  const [a, setA] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [method, setMethod] = useState('');
  const [supplier, setSupplier] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    if (method) p.set('method', method);
    if (supplier.trim()) p.set('supplier', supplier.trim());
    try { setA(await apiPin<Analytics>(`/kobepay/receipts/analytics${p.toString() ? `?${p}` : ''}`)); }
    catch { /* offline */ } finally { setLoading(false); }
  }, [apiPin, from, to, method, supplier]);
  useEffect(() => { load(); }, [load]);

  const exportCsv = () => {
    if (!a) return;
    const header = ['Receipt', 'Supplier', 'Customer', 'Total', 'Currency', 'Status', 'Method', 'Paid By', 'Paid At', 'Created At'];
    const lines = a.rows.map((r) => [
      r.receiptNumber, r.supplierName, r.customerName, Number(r.total), r.currency, r.status,
      r.paymentMethod, r.paidByName, r.paidAt ? new Date(r.paidAt).toISOString() : '', new Date(r.createdAt).toISOString(),
    ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `china-payouts-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click(); URL.revokeObjectURL(url);
  };

  const cur = a?.currency ?? 'CNY';
  return (
    <div className="p-4 space-y-4">
      {/* Filters */}
      <div className="flex items-end gap-2 flex-wrap rounded-xl border border-slate-800 bg-slate-900/40 p-3">
        <Labeled label="From"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 px-2 rounded-lg bg-slate-950 border border-slate-700 text-sm" /></Labeled>
        <Labeled label="To"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 px-2 rounded-lg bg-slate-950 border border-slate-700 text-sm" /></Labeled>
        <Labeled label="Method">
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="h-9 px-2 rounded-lg bg-slate-950 border border-slate-700 text-sm">
            <option value="">All</option>{METHODS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </Labeled>
        <Labeled label="Supplier"><input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="name…" className="h-9 px-2 rounded-lg bg-slate-950 border border-slate-700 text-sm" /></Labeled>
        <div className="flex-1" />
        <button onClick={exportCsv} className="h-9 px-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold inline-flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> Export CSV</button>
        <button onClick={() => window.print()} className="h-9 px-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold inline-flex items-center gap-1.5"><Printer className="w-3.5 h-3.5" /> Print / PDF</button>
      </div>

      {loading ? <Center><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></Center> : !a ? null : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <StatCard label="Pending" value={money(a.totals.pendingAmount, cur)} sub={`${a.totals.pendingCount}`} tone="amber" Icon={Clock} />
            <StatCard label="Paid" value={money(a.totals.paidAmount, cur)} sub={`${a.totals.paidCount}`} tone="emerald" Icon={CheckCircle2} />
            <StatCard label="Paid Receipts" value={String(a.totals.paidCount)} sub="count" tone="indigo" Icon={ReceiptIcon} />
            <StatCard label="Pending Receipts" value={String(a.totals.pendingCount)} sub="count" tone="rose" Icon={Package} />
            <StatCard label="Avg Payout Time" value={`${a.totals.avgPayoutHours}h`} sub="create → paid" tone="cyan" Icon={Clock} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <ChartCard title="Payouts by Cashier">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={a.byCashier} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis type="number" tick={AXIS} />
                  <YAxis type="category" dataKey="key" tick={AXIS} width={90} />
                  <Tooltip formatter={(v: any) => money(v, cur)} contentStyle={TOOLTIP} />
                  <Bar dataKey="amount" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Payouts by Method">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={a.byMethod} dataKey="amount" nameKey="key" cx="50%" cy="50%" outerRadius={80} label={(e: any) => e.key}>
                    {a.byMethod.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => money(v, cur)} contentStyle={TOOLTIP} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Daily Totals">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={a.byDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="key" tick={AXIS} tickFormatter={(k: string) => k.slice(5)} />
                  <YAxis tick={AXIS} width={44} />
                  <Tooltip formatter={(v: any) => money(v, cur)} contentStyle={TOOLTIP} />
                  <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Monthly Totals">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={a.byMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="key" tick={AXIS} tickFormatter={(k: string) => k.slice(5)} />
                  <YAxis tick={AXIS} width={44} />
                  <Tooltip formatter={(v: any) => money(v, cur)} contentStyle={TOOLTIP} />
                  <Bar dataKey="amount" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}

/* ────────────────────────── Scanner modal ────────────────────────── */
function ScannerModal({ onClose, onResult }: { onClose: () => void; onResult: (raw: string) => void }) {
  const { videoRef, result, error, start, stop } = useQRScanner();
  const fired = useRef(false);
  useEffect(() => { start(); return () => stop(); }, [start, stop]);
  useEffect(() => { if (result && !fired.current) { fired.current = true; onResult(result.rawValue); } }, [result, onResult]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 grid place-items-center p-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-slate-900 rounded-2xl overflow-hidden border border-slate-700" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <span className="text-sm font-bold">Scan receipt QR</span>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="relative aspect-square bg-black">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          <div className="absolute inset-8 border-2 border-rose-400/70 rounded-xl pointer-events-none" />
        </div>
        {error && <div className="p-3 text-xs text-rose-300">{error} — you can type the receipt number instead.</div>}
      </div>
    </div>
  );
}

/* ────────────────────────── Shared bits ────────────────────────── */
const AXIS = { fontSize: 10, fill: '#64748b' } as const;
const TOOLTIP = { background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 } as const;

function Center({ children }: { children: React.ReactNode }) {
  return <div className="grid place-items-center py-16">{children}</div>;
}
function StatCard({ label, value, sub, tone, Icon, onClick }: { label: string; value: string; sub: string; tone: string; Icon: typeof Clock; onClick?: () => void }) {
  const tones: Record<string, string> = {
    amber: 'from-amber-500/20 text-amber-300', emerald: 'from-emerald-500/20 text-emerald-300',
    indigo: 'from-indigo-500/20 text-indigo-300', rose: 'from-rose-500/20 text-rose-300', cyan: 'from-cyan-500/20 text-cyan-300',
  };
  return (
    <div onClick={onClick} className={`rounded-xl border border-slate-800 bg-gradient-to-br to-slate-900/40 p-3.5 ${tones[tone] ?? ''} ${onClick ? 'cursor-pointer hover:border-slate-700' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
        <Icon className="w-4 h-4 opacity-80" />
      </div>
      <div className="text-xl font-extrabold text-slate-100 mt-1">{value}</div>
      <div className="text-[11px] text-slate-500">{sub}</div>
    </div>
  );
}
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
      <div className="text-xs font-bold text-slate-400 mb-2">{title}</div>
      {children}
    </div>
  );
}
function StatusPill({ status, small }: { status: 'Pending' | 'Paid'; small?: boolean }) {
  const paid = status === 'Paid';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-bold ${small ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'} ${paid ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
      {paid ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}{status}
    </span>
  );
}
function KV({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[11px] text-slate-500 uppercase tracking-wide">{label}</div><div className="font-semibold text-slate-200">{value}</div></div>;
}
function Line2({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between"><span className="text-slate-500">{label}</span><span className="text-slate-300">{value}</span></div>;
}
function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-500">{label}{children}</label>;
}
