import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, CreditCard, Loader2, Plus, RefreshCw,
  Search, ShieldCheck, UserRound, Wallet, X,
} from 'lucide-react';
import { api } from '@/lib/api';

type ReceivableStatus = 'OUTSTANDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'WRITTEN_OFF';
type RiskGrade = 'A+' | 'A' | 'B' | 'C' | 'D';

interface CreditProfile {
  id: string;
  customerPhone: string;
  customerName: string;
  creditLimit: number | string;
  outstanding: number | string;
  riskGrade: RiskGrade;
  currency: string;
  active: boolean;
}

interface CreditReceivable {
  id: string;
  profileId: string;
  orderId?: string | null;
  customerPhone: string;
  amount: number | string;
  paid: number | string;
  currency: string;
  installmentMonths: number;
  monthlyAmount: number | string;
  dueDate: string;
  status: ReceivableStatus;
  createdAt: string;
}

interface Instalment {
  id: string;
  receivableId: string;
  sequence: number;
  amountDue: number | string;
  amountPaid: number | string;
  currency: string;
  dueDate: string;
  status: 'DUE' | 'PARTIAL' | 'PAID' | 'OVERDUE';
  paidAt?: string | null;
}

type Tab = 'customers' | 'receivables' | 'aging';

const money = (value: number | string, currency = 'TZS') =>
  `${currency === 'TZS' ? 'TSh ' : `${currency} `}${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const day = (value: string) => new Date(value).toLocaleDateString();

export default function ERPCredit() {
  const [tab, setTab] = useState<Tab>('customers');
  const [profiles, setProfiles] = useState<CreditProfile[]>([]);
  const [receivables, setReceivables] = useState<CreditReceivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<CreditProfile | null | undefined>(undefined);
  const [selected, setSelected] = useState<CreditReceivable | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [p, r] = await Promise.all([
        api<CreditProfile[]>('/credit/profiles', { offlineFallback: false }),
        api<CreditReceivable[]>('/credit/receivables', { offlineFallback: false }),
      ]);
      setProfiles(Array.isArray(p) ? p : []);
      setReceivables(Array.isArray(r) ? r : []);
    } catch (e) {
      setProfiles([]);
      setReceivables([]);
      setError((e as Error).message || 'Could not load credit data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => {
    const creditLimit = profiles.reduce((sum, p) => sum + Number(p.creditLimit || 0), 0);
    const outstanding = profiles.reduce((sum, p) => sum + Number(p.outstanding || 0), 0);
    const overdue = receivables
      .filter((r) => r.status === 'OVERDUE')
      .reduce((sum, r) => sum + Math.max(0, Number(r.amount) - Number(r.paid)), 0);
    const currency = profiles[0]?.currency ?? receivables[0]?.currency ?? 'TZS';
    return { creditLimit, outstanding, overdue, currency };
  }, [profiles, receivables]);

  const q = search.trim().toLowerCase();
  const filteredProfiles = profiles.filter((p) => !q || `${p.customerName} ${p.customerPhone}`.toLowerCase().includes(q));
  const profileById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const filteredReceivables = receivables.filter((r) => {
    const p = profileById.get(r.profileId);
    return !q || `${p?.customerName ?? ''} ${r.customerPhone} ${r.orderId ?? ''}`.toLowerCase().includes(q);
  });

  return (
    <div className="h-full min-h-0 flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      <header className="shrink-0 border-b border-slate-800 bg-slate-900/80">
        <div className="h-16 px-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-rose-500/15 text-rose-300 grid place-items-center"><CreditCard className="h-5 w-5" /></div>
          <div>
            <h1 className="font-black">Credit & Collections</h1>
            <p className="text-[11px] text-slate-500">Live customer limits, receivables, instalments and payments</p>
          </div>
          <button onClick={() => void load()} disabled={loading} className="ml-auto h-9 w-9 rounded-lg border border-slate-700 grid place-items-center text-slate-400 disabled:opacity-50" title="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setEditing(null)} className="h-9 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-black inline-flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> Credit customer
          </button>
        </div>
        <nav className="px-4 flex items-center gap-1 overflow-x-auto">
          {([['customers', 'Customers'], ['receivables', 'Receivables'], ['aging', 'Aging']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`h-10 px-3 text-xs font-black border-b-2 ${tab === id ? 'text-rose-300 border-rose-300' : 'text-slate-500 border-transparent'}`}>{label}</button>
          ))}
        </nav>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div>}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Metric label="Credit customers" value={String(profiles.length)} icon={<UserRound />} />
          <Metric label="Total limits" value={money(totals.creditLimit, totals.currency)} icon={<ShieldCheck />} />
          <Metric label="Outstanding" value={money(totals.outstanding, totals.currency)} icon={<Wallet />} />
          <Metric label="Overdue" value={money(totals.overdue, totals.currency)} danger icon={<AlertTriangle />} />
        </div>

        <div className="relative max-w-lg">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer, phone or order…" className="w-full h-10 rounded-xl bg-slate-900 border border-slate-800 pl-9 pr-3 text-sm outline-none focus:border-rose-500/60" />
        </div>

        {loading && !profiles.length && !receivables.length ? (
          <div className="py-24 grid place-items-center text-slate-500"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : tab === 'customers' ? (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
            {!filteredProfiles.length ? <Empty title="No credit customers" body="Create a customer credit profile to set a limit and start tracking receivables." /> : (
              <div className="divide-y divide-slate-800">
                {filteredProfiles.map((p) => {
                  const used = Number(p.outstanding || 0);
                  const limit = Number(p.creditLimit || 0);
                  const percent = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
                  return <button key={p.id} onClick={() => setEditing(p)} className="w-full text-left px-4 py-3 hover:bg-slate-800/40">
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-xl bg-slate-800 grid place-items-center"><UserRound className="h-4 w-4 text-slate-400" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex gap-2 items-center"><b className="truncate">{p.customerName || p.customerPhone}</b><span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${p.active ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-700 text-slate-400'}`}>{p.active ? 'ACTIVE' : 'PAUSED'}</span><span className="text-[10px] text-slate-500">Risk {p.riskGrade}</span></div>
                        <div className="text-xs text-slate-500 mt-0.5">{p.customerPhone}</div>
                        <div className="mt-2 h-1.5 rounded-full bg-slate-800 overflow-hidden"><div className="h-full bg-rose-500" style={{ width: `${percent}%` }} /></div>
                      </div>
                      <div className="text-right text-xs"><b className="block text-sm">{money(used, p.currency)}</b><span className="text-slate-500">of {money(limit, p.currency)}</span></div>
                    </div>
                  </button>;
                })}
              </div>
            )}
          </section>
        ) : tab === 'receivables' ? (
          <Receivables rows={filteredReceivables} profileById={profileById} onOpen={setSelected} />
        ) : (
          <Aging rows={filteredReceivables} profileById={profileById} />
        )}
      </main>

      {editing !== undefined && <ProfileModal profile={editing} onClose={() => setEditing(undefined)} onSaved={async () => { setEditing(undefined); await load(); }} />}
      {selected && <ReceivableDrawer row={selected} profile={profileById.get(selected.profileId)} onClose={() => setSelected(null)} onChanged={load} />}
    </div>
  );
}

function Receivables({ rows, profileById, onOpen }: { rows: CreditReceivable[]; profileById: Map<string, CreditProfile>; onOpen: (r: CreditReceivable) => void }) {
  if (!rows.length) return <section className="rounded-2xl border border-slate-800 bg-slate-900/50"><Empty title="No receivables" body="Credit receivables are created by real credit sales and will appear here." /></section>;
  return <section className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden"><div className="divide-y divide-slate-800">{rows.map((r) => {
    const p = profileById.get(r.profileId);
    const balance = Math.max(0, Number(r.amount) - Number(r.paid));
    return <button key={r.id} onClick={() => onOpen(r)} className="w-full px-4 py-3 text-left hover:bg-slate-800/40 flex items-center gap-3">
      <Status status={r.status} />
      <div className="min-w-0 flex-1"><b className="block truncate">{p?.customerName || r.customerPhone}</b><span className="text-xs text-slate-500">{r.orderId ? `Order ${r.orderId.slice(0, 8)} · ` : ''}Due {day(r.dueDate)} · {r.installmentMonths} instalment{r.installmentMonths === 1 ? '' : 's'}</span></div>
      <div className="text-right"><b>{money(balance, r.currency)}</b><span className="block text-[10px] text-slate-500">of {money(r.amount, r.currency)}</span></div>
    </button>;
  })}</div></section>;
}

function Aging({ rows, profileById }: { rows: CreditReceivable[]; profileById: Map<string, CreditProfile> }) {
  const now = Date.now();
  const buckets = [
    { label: 'Current', min: -Infinity, max: 0 },
    { label: '1–30 days', min: 1, max: 30 },
    { label: '31–60 days', min: 31, max: 60 },
    { label: '61–90 days', min: 61, max: 90 },
    { label: '90+ days', min: 91, max: Infinity },
  ].map((bucket) => {
    const matching = rows.filter((r) => {
      if (r.status === 'PAID' || r.status === 'WRITTEN_OFF') return false;
      const daysLate = Math.floor((now - new Date(r.dueDate).getTime()) / 86_400_000);
      return daysLate >= bucket.min && daysLate <= bucket.max;
    });
    return { ...bucket, rows: matching, amount: matching.reduce((sum, r) => sum + Math.max(0, Number(r.amount) - Number(r.paid)), 0) };
  });
  const currency = rows[0]?.currency ?? 'TZS';
  return <div className="space-y-4"><div className="grid grid-cols-2 lg:grid-cols-5 gap-3">{buckets.map((b) => <div key={b.label} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4"><span className="text-xs text-slate-500">{b.label}</span><b className="block text-lg mt-1">{money(b.amount, currency)}</b><span className="text-[10px] text-slate-600">{b.rows.length} receivable{b.rows.length === 1 ? '' : 's'}</span></div>)}</div><section className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">{rows.filter((r) => r.status !== 'PAID' && r.status !== 'WRITTEN_OFF').length ? <div className="divide-y divide-slate-800">{rows.filter((r) => r.status !== 'PAID' && r.status !== 'WRITTEN_OFF').sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).map((r) => <div key={r.id} className="px-4 py-3 flex gap-3"><div className="flex-1"><b>{profileById.get(r.profileId)?.customerName || r.customerPhone}</b><span className="block text-xs text-slate-500">Due {day(r.dueDate)}</span></div><b>{money(Math.max(0, Number(r.amount) - Number(r.paid)), r.currency)}</b></div>)}</div> : <Empty title="Nothing outstanding" body="There are no open receivables." />}</section></div>;
}

function ProfileModal({ profile, onClose, onSaved }: { profile: CreditProfile | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({
    customerName: profile?.customerName ?? '', customerPhone: profile?.customerPhone ?? '', creditLimit: String(profile?.creditLimit ?? ''),
    riskGrade: profile?.riskGrade ?? 'C' as RiskGrade, currency: profile?.currency ?? 'TZS', active: profile?.active ?? true,
  });
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const save = async () => {
    if (!form.customerPhone.trim() || Number(form.creditLimit) < 0) return;
    setBusy(true); setError('');
    try {
      await api('/credit/profiles', { method: 'POST', offlineFallback: false, body: JSON.stringify({ ...form, customerPhone: form.customerPhone.trim(), customerName: form.customerName.trim(), creditLimit: Number(form.creditLimit) }) });
      await onSaved();
    } catch (e) { setError((e as Error).message || 'Could not save credit profile.'); } finally { setBusy(false); }
  };
  return <Modal onClose={onClose}><div className="flex items-center justify-between"><h2 className="font-black">{profile ? 'Edit credit customer' : 'New credit customer'}</h2><button onClick={onClose}><X className="h-4 w-4" /></button></div><div className="mt-4 grid gap-3"><Field label="Name"><input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} className="control" /></Field><Field label="Phone"><input value={form.customerPhone} disabled={!!profile} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} className="control disabled:opacity-50" /></Field><Field label="Credit limit"><input type="number" min="0" value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: e.target.value })} className="control" /></Field><div className="grid grid-cols-2 gap-3"><Field label="Risk"><select value={form.riskGrade} onChange={(e) => setForm({ ...form, riskGrade: e.target.value as RiskGrade })} className="control">{(['A+', 'A', 'B', 'C', 'D'] as const).map((v) => <option key={v}>{v}</option>)}</select></Field><Field label="Currency"><input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} className="control" /></Field></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Allow new credit</label>{error && <p className="text-xs text-rose-300">{error}</p>}<button onClick={() => void save()} disabled={busy} className="h-10 rounded-xl bg-rose-600 text-white font-black disabled:opacity-50">{busy ? 'Saving…' : 'Save profile'}</button></div></Modal>;
}

function ReceivableDrawer({ row, profile, onClose, onChanged }: { row: CreditReceivable; profile?: CreditProfile; onClose: () => void; onChanged: () => Promise<void> }) {
  const [instalments, setInstalments] = useState<Instalment[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { api<Instalment[]>(`/credit/receivables/${row.id}/instalments`, { offlineFallback: false }).then((v) => setInstalments(Array.isArray(v) ? v : [])).catch((e) => setError((e as Error).message)).finally(() => setLoading(false)); }, [row.id]);
  const pay = async () => {
    const amount = Number(window.prompt('Payment amount', String(Math.max(0, Number(row.amount) - Number(row.paid))))); if (!(amount > 0)) return;
    const reference = window.prompt('Payment reference (optional)', '') ?? '';
    setBusy(true); setError(''); try { await api(`/credit/receivables/${row.id}/pay`, { method: 'PATCH', offlineFallback: false, body: JSON.stringify({ amount, reference: reference.trim() || undefined }) }); await onChanged(); onClose(); } catch (e) { setError((e as Error).message || 'Payment failed.'); } finally { setBusy(false); }
  };
  return <div className="fixed inset-0 z-50 bg-black/50 flex justify-end" onClick={onClose}><aside onClick={(e) => e.stopPropagation()} className="w-full max-w-md h-full bg-slate-950 border-l border-slate-800 p-5 overflow-y-auto"><div className="flex items-center"><div><h2 className="font-black">{profile?.customerName || row.customerPhone}</h2><p className="text-xs text-slate-500">{row.customerPhone}</p></div><button onClick={onClose} className="ml-auto"><X className="h-5 w-5" /></button></div><div className="mt-5 grid grid-cols-2 gap-3"><Mini label="Original" value={money(row.amount, row.currency)} /><Mini label="Paid" value={money(row.paid, row.currency)} /><Mini label="Balance" value={money(Math.max(0, Number(row.amount) - Number(row.paid)), row.currency)} /><Mini label="Due" value={day(row.dueDate)} /></div><div className="mt-5"><h3 className="text-xs uppercase tracking-widest text-slate-500 font-black">Instalments</h3>{loading ? <Loader2 className="h-5 w-5 animate-spin mt-4 text-slate-500" /> : instalments.length ? <div className="mt-2 space-y-2">{instalments.map((i) => <div key={i.id} className="rounded-xl border border-slate-800 p-3 flex items-center"><div><b className="text-sm">#{i.sequence} · {day(i.dueDate)}</b><span className="block text-xs text-slate-500">{money(i.amountPaid, i.currency)} / {money(i.amountDue, i.currency)}</span></div><span className="ml-auto text-[10px] font-black text-slate-400">{i.status}</span></div>)}</div> : <p className="mt-3 text-sm text-slate-500">No instalment rows.</p>}</div>{error && <p className="mt-4 text-xs text-rose-300">{error}</p>}{row.status !== 'PAID' && row.status !== 'WRITTEN_OFF' && <button onClick={() => void pay()} disabled={busy} className="mt-5 w-full h-11 rounded-xl bg-emerald-600 text-white font-black disabled:opacity-50">{busy ? 'Recording…' : 'Record payment'}</button>}</aside></div>;
}

function Status({ status }: { status: ReceivableStatus }) { const cls = status === 'PAID' ? 'bg-emerald-500/10 text-emerald-300' : status === 'OVERDUE' ? 'bg-rose-500/10 text-rose-300' : status === 'PARTIAL' ? 'bg-amber-500/10 text-amber-300' : 'bg-blue-500/10 text-blue-300'; return <span className={`shrink-0 text-[9px] font-black px-2 py-1 rounded-full ${cls}`}>{status}</span>; }
function Metric({ label, value, icon, danger }: { label: string; value: string; icon: React.ReactNode; danger?: boolean }) { return <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"><div className={`h-8 w-8 rounded-lg grid place-items-center ${danger ? 'bg-rose-500/10 text-rose-300' : 'bg-slate-800 text-slate-400'}`}>{icon}</div><span className="block mt-3 text-xs text-slate-500">{label}</span><b className="block mt-1 truncate">{value}</b></div>; }
function Empty({ title, body }: { title: string; body: string }) { return <div className="py-16 text-center px-6"><CheckCircle2 className="h-9 w-9 mx-auto text-slate-700" /><b className="block mt-3 text-slate-300">{title}</b><p className="text-sm text-slate-500 mt-1">{body}</p></div>; }
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) { return <div className="fixed inset-0 z-50 bg-black/55 grid place-items-center p-4" onMouseDown={onClose}><div onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl">{children}</div></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1 text-xs text-slate-400">{label}{children}</label>; }
function Mini({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-800 p-3"><span className="text-[10px] text-slate-500">{label}</span><b className="block text-sm mt-1">{value}</b></div>; }
