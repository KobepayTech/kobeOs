import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { FileText, Loader2, Plus, Receipt, ShieldCheck, Wand2, X } from 'lucide-react';
import { api } from '@/lib/api';

/**
 * Property-management UIs over the already-built backend endpoints: leases
 * (/property/leases), rent charges + arrears (/property/rent-charges [+ /generate,
 * /:id/waive]), tenant applications (/property/applications [+ /:id/approve]) and
 * tenant screening (/property/tenants/:id/screening [+ /decide]). These were
 * backend-only before — this wires them into the product.
 */

export interface TenantLite { id: string; name: string; unitId?: string | null }
export interface UnitLite { id: string; unitNumber: string; propertyId: string; currency?: string }

interface Lease { id: string; unitId: string; tenantId: string; startDate: string; endDate: string; monthlyRent: number | string; deposit: number | string; rentDueDay: number; lateFee: number | string; status: 'upcoming' | 'active' | 'ended' | 'cancelled'; notes: string }
interface Charge { id: string; leaseId: string; tenantId: string; unitId: string; period: string; dueDate: string; amount: number | string; amountPaid: number | string; status: 'open' | 'partial' | 'paid' | 'overdue' | 'waived'; notes: string }
interface Application { id: string; unitId?: string | null; firstName: string; lastName: string; phone: string; email: string; monthlyIncome: number | string; employer: string; desiredMoveIn?: string | null; status: 'new' | 'screening' | 'approved' | 'declined' | 'withdrawn'; notes: string }
interface Screening { id: string; tenantId: string; rentalHistoryPct: number; evictionHistoryPct: number; criminalHistoryPct: number; creditHistoryPct: number; overallScore: number; verdict: 'pending' | 'accepted' | 'rejected'; provider: string }

const num = (v: unknown) => Number(v ?? 0);
const money = (n: number, cur = 'TZS') => `${cur} ${Math.round(n).toLocaleString()}`;
const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString() : '—';
const thisPeriod = () => new Date().toISOString().slice(0, 7);

// ── shared bits ───────────────────────────────────────────────────────────────
function Panel({ children }: { children: ReactNode }) { return <section className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5">{children}</section>; }
function Empty({ title, body }: { title: string; body: string }) { return <div className="py-14 text-center"><p className="font-black text-slate-700">{title}</p><p className="text-xs text-slate-500 mt-1">{body}</p></div>; }
function Btn({ children, onClick, busy, tone = 'primary', disabled }: { children: ReactNode; onClick: () => void; busy?: boolean; tone?: 'primary' | 'ghost'; disabled?: boolean }) {
  const cls = tone === 'primary' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700';
  return <button disabled={busy || disabled} onClick={onClick} className={`h-9 px-3 rounded-xl text-xs font-black inline-flex items-center gap-1.5 disabled:opacity-40 ${cls}`}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}{children}</button>;
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="text-[11px] font-bold text-slate-600 block">{label}<div className="mt-1">{children}</div></label>; }
const inputCls = 'h-10 w-full rounded-xl border border-slate-200 px-3 text-sm';
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onMouseDown={onClose}><div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl bg-white p-5" onMouseDown={(e) => e.stopPropagation()}><div className="flex items-center mb-3"><h3 className="font-black text-lg">{title}</h3><button className="ml-auto h-8 w-8 grid place-items-center rounded-lg bg-slate-100" onClick={onClose}><X className="h-4 w-4" /></button></div>{children}</div></div>;
}
function StatusPill({ status }: { status: string }) {
  const tone = /paid|active|accepted|approved/.test(status) ? 'bg-emerald-50 text-emerald-700'
    : /overdue|declined|rejected|cancelled/.test(status) ? 'bg-rose-50 text-rose-700'
    : /partial|screening|upcoming/.test(status) ? 'bg-amber-50 text-amber-700'
    : /waived|ended|withdrawn/.test(status) ? 'bg-slate-100 text-slate-500'
    : 'bg-blue-50 text-blue-700';
  return <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${tone}`}>{status}</span>;
}

// ── Leases ──────────────────────────────────────────────────────────────────
export function LeasesTab({ tenants, units, currency }: { tenants: TenantLite[]; units: UnitLite[]; currency: string }) {
  const [rows, setRows] = useState<Lease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const blank = { unitId: '', tenantId: '', startDate: '', endDate: '', monthlyRent: '', deposit: '', rentDueDay: '1' };
  const [form, setForm] = useState(blank);
  const tenantById = useMemo(() => new Map(tenants.map((t) => [t.id, t])), [tenants]);
  const unitById = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);
  const load = useCallback(async () => { setLoading(true); try { setRows(await api<Lease[]>('/property/leases', { offlineFallback: false })); } catch (e) { setError((e as Error).message); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const create = async () => {
    if (!form.tenantId || !form.unitId || !form.startDate || !form.endDate || !form.monthlyRent) { setError('Tenant, unit, both dates and monthly rent are required.'); return; }
    setBusy(true); setError('');
    try {
      await api('/property/leases', { method: 'POST', offlineFallback: false, body: JSON.stringify({ tenantId: form.tenantId, unitId: form.unitId, startDate: form.startDate, endDate: form.endDate, monthlyRent: Number(form.monthlyRent), deposit: Number(form.deposit) || 0, rentDueDay: Number(form.rentDueDay) || 1, status: 'active' }) });
      setOpen(false); setForm(blank); await load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const setStatus = async (id: string, status: Lease['status']) => { try { await api(`/property/leases/${id}`, { method: 'PATCH', offlineFallback: false, body: JSON.stringify({ status }) }); await load(); } catch (e) { setError((e as Error).message); } };
  return <div className="space-y-3">
    {error && <div className="rounded-xl bg-rose-50 text-rose-700 p-3 text-sm">{error}</div>}
    <div className="flex items-center justify-between"><h2 className="font-black text-slate-700 inline-flex items-center gap-2"><FileText className="h-4 w-4" /> Leases</h2><Btn onClick={() => { setForm(blank); setOpen(true); }}><Plus className="h-4 w-4" /> New lease</Btn></div>
    <Panel>
      {loading ? <div className="py-10 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div> : rows.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-[11px] uppercase text-slate-400"><th className="py-2 pr-3">Tenant</th><th className="pr-3">Unit</th><th className="pr-3">Term</th><th className="pr-3">Rent</th><th className="pr-3">Due day</th><th className="pr-3">Status</th></tr></thead><tbody>{rows.map((l) => <tr key={l.id} className="border-t border-slate-100"><td className="py-2 pr-3 font-bold">{tenantById.get(l.tenantId)?.name ?? '—'}</td><td className="pr-3">{unitById.get(l.unitId)?.unitNumber ?? '—'}</td><td className="pr-3 text-slate-500">{fmtDate(l.startDate)} → {fmtDate(l.endDate)}</td><td className="pr-3 font-bold">{money(num(l.monthlyRent), currency)}</td><td className="pr-3">{l.rentDueDay}</td><td className="pr-3"><select value={l.status} onChange={(e) => void setStatus(l.id, e.target.value as Lease['status'])} className="h-7 rounded-lg border border-slate-200 px-1.5 text-[11px] font-bold"><option value="upcoming">upcoming</option><option value="active">active</option><option value="ended">ended</option><option value="cancelled">cancelled</option></select></td></tr>)}</tbody></table></div> : <Empty title="No leases yet" body="Create a lease to set a tenant's rent schedule — rent charges are generated from it." />}
    </Panel>
    {open && <Modal title="New lease" onClose={() => setOpen(false)}>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Tenant"><select value={form.tenantId} onChange={(e) => setForm({ ...form, tenantId: e.target.value })} className={inputCls}><option value="">Select tenant</option>{tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
        <Field label="Unit"><select value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })} className={inputCls}><option value="">Select unit</option>{units.map((u) => <option key={u.id} value={u.id}>{u.unitNumber}</option>)}</select></Field>
        <Field label="Start date"><input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={inputCls} /></Field>
        <Field label="End date"><input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={inputCls} /></Field>
        <Field label={`Monthly rent (${currency})`}><input type="number" value={form.monthlyRent} onChange={(e) => setForm({ ...form, monthlyRent: e.target.value })} className={inputCls} /></Field>
        <Field label={`Deposit (${currency})`}><input type="number" value={form.deposit} onChange={(e) => setForm({ ...form, deposit: e.target.value })} className={inputCls} /></Field>
        <Field label="Rent due day (1-28)"><input type="number" min={1} max={28} value={form.rentDueDay} onChange={(e) => setForm({ ...form, rentDueDay: e.target.value })} className={inputCls} /></Field>
      </div>
      <div className="mt-4"><Btn busy={busy} onClick={() => void create()}><Plus className="h-4 w-4" /> Create lease</Btn></div>
    </Modal>}
  </div>;
}

// ── Arrears / rent charges ─────────────────────────────────────────────────────
export function ArrearsTab({ tenants, units, currency }: { tenants: TenantLite[]; units: UnitLite[]; currency: string }) {
  const [rows, setRows] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [period, setPeriod] = useState(thisPeriod());
  const tenantById = useMemo(() => new Map(tenants.map((t) => [t.id, t])), [tenants]);
  const unitById = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);
  const load = useCallback(async () => { setLoading(true); try { setRows(await api<Charge[]>('/property/rent-charges', { offlineFallback: false })); } catch (e) { setError((e as Error).message); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const generate = async () => {
    if (!/^\d{4}-\d{2}$/.test(period)) { setError('Period must be YYYY-MM.'); return; }
    setBusy(true); setError(''); setMsg('');
    try { const r = await api<Charge[] | { created?: number }>('/property/rent-charges/generate', { method: 'POST', offlineFallback: false, body: JSON.stringify({ period }) }); const n = Array.isArray(r) ? r.length : (r.created ?? 0); setMsg(`Generated ${n} charge${n === 1 ? '' : 's'} for ${period}.`); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const waive = async (id: string) => { try { await api(`/property/rent-charges/${id}/waive`, { method: 'POST', offlineFallback: false, body: '{}' }); await load(); } catch (e) { setError((e as Error).message); } };
  const outstanding = rows.filter((c) => c.status !== 'paid' && c.status !== 'waived').reduce((s, c) => s + Math.max(0, num(c.amount) - num(c.amountPaid)), 0);
  return <div className="space-y-3">
    {error && <div className="rounded-xl bg-rose-50 text-rose-700 p-3 text-sm">{error}</div>}
    {msg && <div className="rounded-xl bg-emerald-50 text-emerald-700 p-3 text-sm">{msg}</div>}
    <div className="flex flex-wrap items-center gap-2 justify-between">
      <h2 className="font-black text-slate-700 inline-flex items-center gap-2"><Receipt className="h-4 w-4" /> Rent charges & arrears</h2>
      <div className="flex items-center gap-2"><input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="YYYY-MM" className="h-9 w-28 rounded-xl border border-slate-200 px-3 text-sm" /><Btn busy={busy} onClick={() => void generate()}><Wand2 className="h-4 w-4" /> Generate charges</Btn></div>
    </div>
    <div className="rounded-2xl bg-rose-50 border border-rose-100 px-4 py-3"><span className="text-[11px] font-black uppercase text-rose-700">Total outstanding</span><b className="block text-xl text-rose-900">{money(outstanding, currency)}</b></div>
    <Panel>
      {loading ? <div className="py-10 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div> : rows.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-[11px] uppercase text-slate-400"><th className="py-2 pr-3">Tenant</th><th className="pr-3">Unit</th><th className="pr-3">Period</th><th className="pr-3">Due</th><th className="pr-3">Amount</th><th className="pr-3">Paid</th><th className="pr-3">Balance</th><th className="pr-3">Status</th><th></th></tr></thead><tbody>{rows.map((c) => { const bal = Math.max(0, num(c.amount) - num(c.amountPaid)); return <tr key={c.id} className="border-t border-slate-100"><td className="py-2 pr-3 font-bold">{tenantById.get(c.tenantId)?.name ?? '—'}</td><td className="pr-3">{unitById.get(c.unitId)?.unitNumber ?? '—'}</td><td className="pr-3">{c.period}</td><td className="pr-3 text-slate-500">{fmtDate(c.dueDate)}</td><td className="pr-3">{money(num(c.amount), currency)}</td><td className="pr-3 text-emerald-700">{money(num(c.amountPaid), currency)}</td><td className="pr-3 font-black">{money(bal, currency)}</td><td className="pr-3"><StatusPill status={c.status} /></td><td className="pr-3">{c.status !== 'paid' && c.status !== 'waived' && <button onClick={() => void waive(c.id)} className="text-[11px] font-black text-slate-500 hover:text-rose-600">Waive</button>}</td></tr>; })}</tbody></table></div> : <Empty title="No rent charges yet" body="Enter a period (YYYY-MM) and Generate charges from active leases, or record payments on the Payments tab." />}
    </Panel>
  </div>;
}

// ── Applications & screening ───────────────────────────────────────────────────
export function ScreeningTab({ tenants, units }: { tenants: TenantLite[]; units: UnitLite[] }) {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const blank = { firstName: '', lastName: '', phone: '', email: '', monthlyIncome: '', employer: '', unitId: '' };
  const [form, setForm] = useState(blank);
  const [reports, setReports] = useState<Record<string, Screening>>({});
  const [loadingReport, setLoadingReport] = useState('');
  // 'No verified report yet' is a normal state, not a failure — keep it inline
  // per tenant instead of raising the page-level error banner.
  const [noReport, setNoReport] = useState<Record<string, string>>({});
  const load = useCallback(async () => { setLoading(true); try { setApps(await api<Application[]>('/property/applications', { offlineFallback: false })); } catch (e) { setError((e as Error).message); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const create = async () => {
    if (!form.firstName) { setError('First name is required.'); return; }
    setBusy(true); setError('');
    try { await api('/property/applications', { method: 'POST', offlineFallback: false, body: JSON.stringify({ ...form, unitId: form.unitId || undefined, monthlyIncome: Number(form.monthlyIncome) || 0 }) }); setOpen(false); setForm(blank); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const approve = async (id: string) => { try { await api(`/property/applications/${id}/approve`, { method: 'POST', offlineFallback: false, body: '{}' }); await load(); } catch (e) { setError((e as Error).message); } };
  const setAppStatus = async (id: string, status: Application['status']) => { try { await api(`/property/applications/${id}`, { method: 'PATCH', offlineFallback: false, body: JSON.stringify({ status }) }); await load(); } catch (e) { setError((e as Error).message); } };
  const screen = async (tenantId: string) => {
    setLoadingReport(tenantId);
    setNoReport((prev) => { const next = { ...prev }; delete next[tenantId]; return next; });
    try {
      const r = await api<Screening>(`/property/tenants/${tenantId}/screening`, { offlineFallback: false });
      setReports((prev) => ({ ...prev, [tenantId]: r }));
    } catch (e) {
      const raw = (e as Error).message || '';
      // Screening intentionally refuses to invent scores, and the reports table
      // may not exist yet on an origin that has not run migrations. Neither is
      // a crash the operator should see as a red server error.
      const friendly = /tenant_screening_reports|relation .* does not exist/i.test(raw)
        ? 'Screening storage is not set up on this server yet.'
        : 'No verified screening report yet — connect a provider or import one.';
      setNoReport((prev) => ({ ...prev, [tenantId]: friendly }));
    } finally { setLoadingReport(''); }
  };
  const decide = async (tenantId: string, verdict: 'accepted' | 'rejected') => { try { const r = await api<Screening>(`/property/tenants/${tenantId}/screening/decide`, { method: 'POST', offlineFallback: false, body: JSON.stringify({ verdict }) }); setReports((prev) => ({ ...prev, [tenantId]: r })); } catch (e) { setError((e as Error).message); } };
  return <div className="space-y-4">
    {error && <div className="rounded-xl bg-rose-50 text-rose-700 p-3 text-sm">{error}</div>}

    <div className="flex items-center justify-between"><h2 className="font-black text-slate-700 inline-flex items-center gap-2"><FileText className="h-4 w-4" /> Applications</h2><Btn onClick={() => { setForm(blank); setOpen(true); }}><Plus className="h-4 w-4" /> New application</Btn></div>
    <Panel>
      {loading ? <div className="py-10 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div> : apps.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-[11px] uppercase text-slate-400"><th className="py-2 pr-3">Applicant</th><th className="pr-3">Contact</th><th className="pr-3">Income</th><th className="pr-3">Status</th><th></th></tr></thead><tbody>{apps.map((a) => <tr key={a.id} className="border-t border-slate-100"><td className="py-2 pr-3 font-bold">{a.firstName} {a.lastName}</td><td className="pr-3 text-slate-500">{a.phone || a.email || '—'}</td><td className="pr-3">{num(a.monthlyIncome) ? money(num(a.monthlyIncome)) : '—'}</td><td className="pr-3"><StatusPill status={a.status} /></td><td className="pr-3 whitespace-nowrap">{a.status !== 'approved' && a.status !== 'declined' && <><button onClick={() => void approve(a.id)} className="text-[11px] font-black text-emerald-700 mr-3">Approve</button><button onClick={() => void setAppStatus(a.id, 'declined')} className="text-[11px] font-black text-rose-600">Decline</button></>}</td></tr>)}</tbody></table></div> : <Empty title="No applications yet" body="Add a rental application; approving one creates the tenant's lease automatically." />}
    </Panel>

    <div className="flex items-center justify-between gap-3"><h2 className="font-black text-slate-700 inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Tenant screening</h2><span className="text-[10px] font-bold text-blue-700 bg-blue-50 rounded-lg px-2 py-1">Verified reports only</span></div>
    <Panel>
      <div className="mb-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
        KobeOS does not invent credit, criminal, eviction or rental-history scores. Connect a verified screening provider or import a verified report before making a screening decision.
      </div>
      {tenants.length ? <div className="space-y-2">{tenants.map((t) => { const r = reports[t.id]; return <div key={t.id} className="rounded-xl border border-slate-100 p-3"><div className="flex items-center gap-3"><b className="text-sm">{t.name}</b>{r && <StatusPill status={r.verdict} />}<div className="ml-auto flex items-center gap-2">{r ? <><button onClick={() => void decide(t.id, 'accepted')} className="text-[11px] font-black text-emerald-700">Accept</button><button onClick={() => void decide(t.id, 'rejected')} className="text-[11px] font-black text-rose-600">Reject</button></> : <Btn tone="ghost" busy={loadingReport === t.id} onClick={() => void screen(t.id)}><ShieldCheck className="h-3.5 w-3.5" /> Check verified report</Btn>}</div></div>{noReport[t.id] && <p className="mt-2 text-[11px] text-slate-500">{noReport[t.id]}</p>}{r && <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">{([['Overall', r.overallScore, '/850'], ['Rental', r.rentalHistoryPct, '%'], ['Eviction', r.evictionHistoryPct, '%'], ['Criminal', r.criminalHistoryPct, '%'], ['Credit', r.creditHistoryPct, '%']] as const).map(([k, v, suffix]) => <div key={k} className="rounded-lg bg-slate-50 py-2"><div className="text-[10px] uppercase text-slate-400 font-bold">{k}</div><b className="text-sm">{v}{suffix}</b></div>)}</div>}</div>; })}</div> : <Empty title="No tenants to screen" body="Add tenants first; verified provider reports will appear here when available." />}
    </Panel>

    {open && <Modal title="New application" onClose={() => setOpen(false)}>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="First name"><input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={inputCls} /></Field>
        <Field label="Last name"><input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={inputCls} /></Field>
        <Field label="Phone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} /></Field>
        <Field label="Email"><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} /></Field>
        <Field label="Monthly income"><input type="number" value={form.monthlyIncome} onChange={(e) => setForm({ ...form, monthlyIncome: e.target.value })} className={inputCls} /></Field>
        <Field label="Employer"><input value={form.employer} onChange={(e) => setForm({ ...form, employer: e.target.value })} className={inputCls} /></Field>
        <Field label="Desired unit (optional)"><select value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })} className={inputCls}><option value="">Any / undecided</option>{units.map((u) => <option key={u.id} value={u.id}>{u.unitNumber}</option>)}</select></Field>
      </div>
      <div className="mt-4"><Btn busy={busy} onClick={() => void create()}><Plus className="h-4 w-4" /> Add application</Btn></div>
    </Modal>}
  </div>;
}
