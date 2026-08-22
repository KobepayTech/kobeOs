import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  GraduationCap, Plus, Users, Store, Inbox, Wallet, ShieldCheck, Scale,
  RefreshCw, X, PiggyBank, Lock, ArrowRightLeft, Loader2, CheckCircle2, AlertTriangle,
  Boxes, Truck, Copy,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────
interface School { id: string; name: string; code: string; bankModel: string; currency: string }
interface Student { id: string; schoolId: string; name: string; studentCode: string; className: string; status: string; parentName: string; parentPhone: string; qrToken: string; controls: Record<string, unknown> }
interface Merchant { id: string; name: string; merchantCode: string; category: string; commissionPct: number; status: string; online: boolean; allowed?: boolean }
interface Deposit { id: string; bankTransactionId: string; amount: number; senderName: string; senderPhone: string; reference: string; status: string; source: string }
interface Reconcile { bank: number; students: number; merchants: number; suppliers: number; escrow: number; fees: number; balanced: boolean; drift: number }
interface Dashboard { school: { id: string; name: string; code: string; bankModel: string }; students: number; walletTotal: number; studentSpendToday: number; depositsToday: number; reconcile: Reconcile }
interface WalletView { studentId: string; currency: string; available: number; savings: number; buckets: Array<{ category: string; balance: number }>; reserved: Array<{ id: string; purpose: string; amount: number }>; reservedTotal: number; total: number; spentToday: number }

const CATS = ['AVAILABLE', 'FOOD', 'TRANSPORT', 'BOOKS', 'SUPPLIES', 'ONLINE', 'GROUP', 'SAVINGS'];
const money = (n: number, c = 'TZS') => `${c === 'TZS' ? 'TSh ' : c + ' '}${Number(n || 0).toLocaleString()}`;

export default function KobepayPro() {
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState<string>('');
  const [tab, setTab] = useState<'overview' | 'students' | 'groups' | 'merchants' | 'deposits'>('overview');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const loadSchools = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const rows = await api<School[]>('/kobepay-pro/schools');
      setSchools(Array.isArray(rows) ? rows : []);
      if (rows?.length && !schoolId) setSchoolId(rows[0].id);
    } catch (e) { setErr((e as Error).message); }
    finally { setLoading(false); }
  }, [schoolId]);
  useEffect(() => { void loadSchools(); }, [loadSchools]);

  const newSchool = async () => {
    const name = prompt('School name')?.trim();
    if (!name) return;
    const s = await api<School>('/kobepay-pro/schools', { method: 'POST', body: JSON.stringify({ name }) });
    await loadSchools(); setSchoolId(s.id);
  };

  const school = schools.find((s) => s.id === schoolId) || null;

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 grid place-items-center"><GraduationCap className="w-5 h-5 text-white" /></div>
        <div className="min-w-0">
          <h1 className="text-sm font-black">Kobepay Pro</h1>
          <p className="text-[10px] text-slate-500">Programmable school money · wallets · rules · settlement</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {schools.length > 0 && (
            <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className="h-9 rounded-lg bg-slate-900 border border-slate-700 px-3 text-xs">
              {schools.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.code}</option>)}
            </select>
          )}
          <button onClick={() => void loadSchools()} className="h-9 w-9 grid place-items-center rounded-lg border border-slate-700 text-slate-400"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={newSchool} className="h-9 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 text-xs font-bold"><Plus className="w-4 h-4" />School</button>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 grid place-items-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : !school ? (
        <div className="flex-1 grid place-items-center text-center px-6">
          <div className="space-y-2">
            <GraduationCap className="w-10 h-10 mx-auto text-slate-600" />
            <p className="text-slate-400">No schools yet.</p>
            <button onClick={newSchool} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 h-9 text-sm font-bold"><Plus className="w-4 h-4" />Create your first school</button>
          </div>
        </div>
      ) : (
        <>
          <nav className="flex items-center gap-1 px-4 py-2 border-b border-slate-800">
            {([['overview', 'Overview', Scale], ['students', 'Students', Users], ['groups', 'Groups', Boxes], ['merchants', 'Merchants', Store], ['deposits', 'Deposits', Inbox]] as const).map(([id, label, Icon]) => (
              <button key={id} onClick={() => setTab(id)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${tab === id ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </nav>
          {err && <div className="mx-4 mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{err}</div>}
          <div className="flex-1 overflow-auto">
            {tab === 'overview' && <Overview schoolId={school.id} currency={school.currency} />}
            {tab === 'students' && <Students schoolId={school.id} currency={school.currency} />}
            {tab === 'groups' && <Groups schoolId={school.id} currency={school.currency} />}
            {tab === 'merchants' && <Merchants schoolId={school.id} />}
            {tab === 'deposits' && <Deposits schoolId={school.id} onChange={() => setTab('deposits')} />}
          </div>
        </>
      )}
    </div>
  );
}

// ── Overview ────────────────────────────────────────────────────────────────
function Overview({ schoolId, currency }: { schoolId: string; currency: string }) {
  const [d, setD] = useState<Dashboard | null>(null);
  const load = useCallback(() => { api<Dashboard>(`/kobepay-pro/schools/${schoolId}/dashboard`).then(setD).catch(() => setD(null)); }, [schoolId]);
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);
  if (!d) return <div className="p-6 text-slate-500 text-sm">Loading dashboard…</div>;
  const r = d.reconcile;
  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Students" value={String(d.students)} Icon={Users} tone="text-blue-400" />
        <Stat label="Student wallets" value={money(d.walletTotal, currency)} Icon={Wallet} tone="text-emerald-400" />
        <Stat label="Spent today" value={money(d.studentSpendToday, currency)} Icon={ArrowRightLeft} tone="text-amber-400" />
        <Stat label="Deposits today" value={money(d.depositsToday, currency)} Icon={PiggyBank} tone="text-teal-400" />
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Scale className="w-4 h-4 text-slate-400" />
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Ledger reconciliation</h2>
          <span className={`ml-auto inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${r.balanced ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
            {r.balanced ? <><CheckCircle2 className="w-3.5 h-3.5" />Balanced</> : <><AlertTriangle className="w-3.5 h-3.5" />Drift {money(r.drift, currency)}</>}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center">
          {[['Bank', r.bank], ['Students', r.students], ['Merchants', r.merchants], ['Escrow', r.escrow], ['Fees', r.fees]].map(([k, v]) => (
            <div key={k as string} className="rounded-xl bg-slate-800/60 p-3">
              <div className="text-[10px] uppercase text-slate-500">{k}</div>
              <div className="font-bold text-sm mt-0.5">{money(v as number, currency)}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-slate-500">Bank {money(r.bank, currency)} = Students {money(r.students, currency)} + Merchants {money(r.merchants, currency)} + Escrow {money(r.escrow, currency)} + Fees {money(r.fees, currency)}</p>
      </div>
    </div>
  );
}

// ── Students ──────────────────────────────────────────────────────────────
function Students({ schoolId, currency }: { schoolId: string; currency: string }) {
  const [rows, setRows] = useState<Student[]>([]);
  const [sel, setSel] = useState<Student | null>(null);
  const load = useCallback(() => { api<Student[]>(`/kobepay-pro/students?schoolId=${schoolId}`).then((r) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([])); }, [schoolId]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    const name = prompt('Student name')?.trim(); if (!name) return;
    const parentPhone = prompt('Parent phone (optional)')?.trim() || '';
    await api('/kobepay-pro/students', { method: 'POST', body: JSON.stringify({ schoolId, name, parentPhone }) });
    load();
  };
  return (
    <div className="p-4">
      <div className="flex items-center mb-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Students · {rows.length}</h2>
        <button onClick={add} className="ml-auto h-8 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold"><Plus className="w-4 h-4" />Add student</button>
      </div>
      <div className="rounded-xl border border-slate-800 overflow-hidden">
        {rows.length === 0 ? <div className="p-8 text-center text-slate-500 text-sm">No students yet.</div> : rows.map((s) => (
          <button key={s.id} onClick={() => setSel(s)} className="w-full flex items-center gap-3 px-4 py-2.5 border-b border-slate-800/70 hover:bg-slate-800/40 text-left">
            <div className="w-8 h-8 rounded-lg bg-slate-800 grid place-items-center text-xs font-bold">{s.name.slice(0, 2).toUpperCase()}</div>
            <div className="min-w-0 flex-1"><div className="text-sm font-semibold truncate">{s.name}</div><div className="text-[11px] text-slate-500">{s.studentCode}{s.className ? ` · ${s.className}` : ''}</div></div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.status === 'ACTIVE' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>{s.status}</span>
          </button>
        ))}
      </div>
      {sel && <StudentDrawer student={sel} currency={currency} onClose={() => { setSel(null); load(); }} />}
    </div>
  );
}

function StudentDrawer({ student, currency, onClose }: { student: Student; currency: string; onClose: () => void }) {
  const [w, setW] = useState<WalletView | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { api<WalletView>(`/kobepay-pro/students/${student.id}/wallet`).then(setW).catch(() => setW(null)); }, [student.id]);
  useEffect(() => { load(); }, [load]);

  const controls = (student.controls ?? {}) as Record<string, unknown>;
  const act = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); load(); } finally { setBusy(false); } };
  const deposit = () => { const a = Number(prompt('Deposit amount')); if (a > 0) act(() => api(`/kobepay-pro/students/${student.id}/deposit`, { method: 'POST', body: JSON.stringify({ amount: a }) })); };
  const allocate = () => { const from = prompt('From pool', 'AVAILABLE')?.toUpperCase(); const to = prompt('To pool', 'FOOD')?.toUpperCase(); const a = Number(prompt('Amount')); if (from && to && a > 0) act(() => api(`/kobepay-pro/students/${student.id}/allocate`, { method: 'POST', body: JSON.stringify({ from, to, amount: a }) })); };
  const reserve = () => { const a = Number(prompt('Reserve amount')); const purpose = prompt('Purpose', 'Group order') || 'Reserved'; if (a > 0) act(() => api(`/kobepay-pro/students/${student.id}/reserve`, { method: 'POST', body: JSON.stringify({ amount: a, purpose }) })); };
  const setLimit = () => { const v = prompt('Daily limit (blank = none)', String(controls.dailyLimit ?? '')); const dailyLimit = v === '' ? null : Number(v); act(() => api(`/kobepay-pro/students/${student.id}/controls`, { method: 'PATCH', body: JSON.stringify({ controls: { dailyLimit } }) })); };
  const toggleOnline = () => act(() => api(`/kobepay-pro/students/${student.id}/controls`, { method: 'PATCH', body: JSON.stringify({ controls: { onlineAllowed: !(controls.onlineAllowed !== false) } }) }));

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md h-full bg-slate-900 border-l border-slate-800 overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 p-4 border-b border-slate-800 sticky top-0 bg-slate-900">
          <div><div className="font-bold">{student.name}</div><div className="text-[11px] text-slate-500">{student.studentCode}</div></div>
          <button onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/kobepay/me/${student.qrToken}`); }} className="ml-auto inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:underline"><Copy className="w-3 h-3" />Parent link</button>
          <button onClick={onClose} className="text-slate-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <div className="text-[10px] uppercase text-slate-500">Total balance</div>
            <div className="text-2xl font-black">{money(w?.total ?? 0, currency)}</div>
            <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
              <Pool label="Available" value={w?.available ?? 0} c={currency} Icon={Wallet} />
              <Pool label="Savings" value={w?.savings ?? 0} c={currency} Icon={PiggyBank} />
              <Pool label="Reserved" value={w?.reservedTotal ?? 0} c={currency} Icon={Lock} />
              <Pool label="Restricted" value={(w?.buckets ?? []).reduce((s, b) => s + b.balance, 0)} c={currency} Icon={ShieldCheck} />
            </div>
            {(w?.buckets ?? []).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {w!.buckets.map((b) => <span key={b.category} className="text-[10px] px-2 py-1 rounded-full bg-slate-800 text-slate-300">{b.category} {money(b.balance, currency)}</span>)}
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <ActBtn label="Deposit" onClick={deposit} busy={busy} />
            <ActBtn label="Allocate" onClick={allocate} busy={busy} />
            <ActBtn label="Reserve" onClick={reserve} busy={busy} />
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-2">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">Parent controls</div>
            <Row label="Daily limit" value={controls.dailyLimit != null ? money(Number(controls.dailyLimit), currency) : 'None'} onEdit={setLimit} />
            <Row label="Online purchases" value={controls.onlineAllowed === false ? 'OFF' : 'ON'} onEdit={toggleOnline} />
            <Row label="Approval above" value={controls.approvalThreshold != null ? money(Number(controls.approvalThreshold), currency) : 'None'} onEdit={() => { const v = prompt('Require approval at/above (blank = none)', String(controls.approvalThreshold ?? '')); const approvalThreshold = v === '' ? null : Number(v); act(() => api(`/kobepay-pro/students/${student.id}/controls`, { method: 'PATCH', body: JSON.stringify({ controls: { approvalThreshold } }) })); }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Merchants ────────────────────────────────────────────────────────────
function Merchants({ schoolId }: { schoolId: string }) {
  const [rows, setRows] = useState<Merchant[]>([]);
  const load = useCallback(() => { api<Merchant[]>(`/kobepay-pro/schools/${schoolId}/merchants`).then((r) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([])); }, [schoolId]);
  useEffect(() => { load(); }, [load]);
  const add = async () => {
    const name = prompt('Merchant name')?.trim(); if (!name) return;
    const category = (prompt('Category (FOOD/BOOKS/SUPPLIES/ONLINE/AVAILABLE)', 'FOOD') || 'AVAILABLE').toUpperCase();
    await api('/kobepay-pro/merchants', { method: 'POST', body: JSON.stringify({ name, category, status: 'ACTIVE' }) });
    load();
  };
  const approve = (m: Merchant, allowed: boolean) => api(`/kobepay-pro/schools/${schoolId}/merchants/${m.id}/approve`, { method: 'POST', body: JSON.stringify({ allowed }) }).then(load);
  const settle = async (m: Merchant) => { const r = await api<{ settled: number }>(`/kobepay-pro/merchants/${m.id}/settle`, { method: 'POST', body: '{}' }); alert(`Settled ${money(r.settled)}`); };
  const apiKey = async (m: Merchant) => {
    if (!confirm(`Issue a new Kobepay Connect API key for ${m.name}? Any existing key stops working.`)) return;
    const r = await api<{ apiKey: string }>(`/kobepay-pro/merchants/${m.id}/api-key`, { method: 'POST', body: '{}' });
    alert(`Connect API key for ${m.name} (shown once):\n\n${r.apiKey}\n\nUse it as header X-Api-Key when calling:\nPOST ${window.location.origin}/api/kobepay-pro/connect/charge\n{ "studentCode": "...", "amount": 5000 }`);
  };
  return (
    <div className="p-4">
      <div className="flex items-center mb-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Merchants · {rows.length}</h2>
        <button onClick={add} className="ml-auto h-8 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold"><Plus className="w-4 h-4" />Add merchant</button>
      </div>
      <div className="rounded-xl border border-slate-800 overflow-hidden">
        {rows.length === 0 ? <div className="p-8 text-center text-slate-500 text-sm">No merchants yet.</div> : rows.map((m) => (
          <div key={m.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-800/70">
            <div className="w-8 h-8 rounded-lg bg-slate-800 grid place-items-center"><Store className="w-4 h-4 text-slate-400" /></div>
            <div className="min-w-0 flex-1"><div className="text-sm font-semibold truncate">{m.name}</div><div className="text-[11px] text-slate-500">{m.category} · {m.commissionPct}% fee · {m.merchantCode}</div></div>
            <button onClick={() => apiKey(m)} className="text-[11px] px-2 py-1 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800">Connect key</button>
            <button onClick={() => settle(m)} className="text-[11px] px-2 py-1 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800">Settle</button>
            <button onClick={() => approve(m, !m.allowed)} className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${m.allowed ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700 text-slate-300'}`}>{m.allowed ? 'Approved' : 'Approve'}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Deposits ─────────────────────────────────────────────────────────────
interface SmsDevice { id: string; deviceId: string; label: string; purpose: string; active: boolean; lastSeenAt: string | null }
function Deposits({ schoolId }: { schoolId: string; onChange: () => void }) {
  const [rows, setRows] = useState<Deposit[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [devices, setDevices] = useState<SmsDevice[]>([]);
  const load = useCallback(() => {
    api<Deposit[]>('/kobepay-pro/deposits/unmatched').then((r) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([]));
    api<Student[]>(`/kobepay-pro/students?schoolId=${schoolId}`).then((r) => setStudents(Array.isArray(r) ? r : [])).catch(() => setStudents([]));
    api<SmsDevice[]>('/mobile-money/devices').then((r) => setDevices(Array.isArray(r) ? r : [])).catch(() => setDevices([]));
  }, [schoolId]);
  useEffect(() => { load(); }, [load]);
  const match = async (d: Deposit) => {
    const code = prompt(`Match ${money(d.amount)} from ${d.senderName || d.senderPhone} to which student code?`)?.trim().toUpperCase();
    if (!code) return;
    const student = students.find((s) => s.studentCode === code);
    if (!student) { alert('No student with that code'); return; }
    await api(`/kobepay-pro/deposits/${d.id}/match`, { method: 'POST', body: JSON.stringify({ studentId: student.id }) });
    load();
  };
  const addDevice = async () => {
    const label = prompt('Name this phone (e.g. "Front office iPhone")')?.trim();
    if (label === undefined) return;
    const deviceId = `KOBE-MPESA-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const r = await api<{ device: SmsDevice; gatewayKey: string }>('/mobile-money/devices', { method: 'POST', body: JSON.stringify({ deviceId, label: label || deviceId, purpose: 'kobepay-pro' }) });
    alert(`Forwarder registered.\n\nPOST the SMS to:\n${window.location.origin}/api/mpesa/sms\n\nJSON body:\n{\n  "device_id": "${r.device.deviceId}",\n  "message": "<the raw SMS>",\n  "gateway_key": "${r.gatewayKey}"\n}\n\nSave this gateway key now — it is shown only once.`);
    load();
  };
  return (
    <div className="p-4 space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="flex items-center mb-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">SMS forwarders</h2>
          <button onClick={addDevice} className="ml-auto h-8 inline-flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 px-3 text-xs font-bold"><Plus className="w-4 h-4" />Set up iPhone</button>
        </div>
        {devices.length === 0 ? (
          <p className="text-[11px] text-slate-500">Register the phone that holds the M-Pesa/bank SIM. An Apple Shortcuts automation POSTs each incoming SMS to <span className="text-slate-300">/api/mpesa/sms</span>; Kobepay parses and posts deposits automatically.</p>
        ) : devices.map((d) => (
          <div key={d.id} className="flex items-center gap-3 py-1.5 text-sm">
            <span className={`w-1.5 h-1.5 rounded-full ${d.active ? 'bg-emerald-400' : 'bg-slate-600'}`} />
            <span className="font-semibold">{d.label || d.deviceId}</span>
            <span className="text-[11px] text-slate-500">{d.deviceId} · {d.purpose}</span>
            <span className="ml-auto text-[11px] text-slate-500">{d.lastSeenAt ? `seen ${new Date(d.lastSeenAt).toLocaleString()}` : 'never seen'}</span>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">Unmatched deposits · {rows.length}</h2>
        <div className="rounded-xl border border-slate-800 overflow-hidden">
          {rows.length === 0 ? <div className="p-8 text-center text-slate-500 text-sm">No deposits waiting to be matched. Deposits carrying a valid student reference auto-post.</div> : rows.map((d) => (
            <div key={d.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-800/70">
              <div className="min-w-0 flex-1"><div className="text-sm font-semibold">{money(d.amount)}</div><div className="text-[11px] text-slate-500">{d.senderName || d.senderPhone || '—'} · ref {d.reference || '—'} · {d.source}</div></div>
              <button onClick={() => match(d)} className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-600">Match student</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Groups (bulk purchasing + escrow) ────────────────────────────────────
interface Group { id: string; reference: string; title: string; productName: string; groupPrice: number; normalPrice: number; status: string; minParticipants: number; deliveryLocation: string; supplierId: string | null; supplierUnitCost: number }
interface Supplier { id: string; name: string; code: string; portalToken: string; status: string }
interface GroupDetail {
  group: Group; supplier: { id: string; name: string; code: string } | null;
  participants: number; totalQty: number; escrowTotal: number; supplierTotal: number; collected: number; minReached: boolean;
  orders: Array<{ id: string; reference: string; studentName: string; qty: number; amount: number; status: string; collected: boolean }>;
}
const GROUP_STAGES = ['OPEN', 'ORDERED', 'PRODUCTION', 'IN_TRANSIT', 'DELIVERED', 'VERIFIED', 'COMPLETED'];

interface PackRow { id: string; name: string; className: string; items: Array<{ groupId: string; qty: number }> }
function Groups({ schoolId, currency }: { schoolId: string; currency: string }) {
  const [rows, setRows] = useState<Group[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [packs, setPacks] = useState<PackRow[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const load = useCallback(() => {
    api<Group[]>(`/kobepay-pro/groups?schoolId=${schoolId}`).then((r) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([]));
    api<Supplier[]>('/kobepay-pro/suppliers').then((r) => setSuppliers(Array.isArray(r) ? r : [])).catch(() => setSuppliers([]));
    api<PackRow[]>(`/kobepay-pro/packs?schoolId=${schoolId}`).then((r) => setPacks(Array.isArray(r) ? r : [])).catch(() => setPacks([]));
  }, [schoolId]);
  useEffect(() => { load(); }, [load]);

  const addPack = async () => {
    const openGroups = rows.filter((g) => g.status === 'OPEN');
    if (!openGroups.length) { alert('Create some open groups first, then bundle them into a pack.'); return; }
    const name = prompt('Pack name (e.g. "Form 1 Starter Pack")')?.trim(); if (!name) return;
    const refs = prompt(`Group references to include, comma-separated:\n${openGroups.map((g) => `${g.reference} = ${g.title}`).join('\n')}`)?.trim();
    if (!refs) return;
    const wanted = refs.split(',').map((s) => s.trim().toUpperCase());
    const items = openGroups.filter((g) => wanted.includes(g.reference.toUpperCase())).map((g) => ({ groupId: g.id, qty: 1 }));
    if (!items.length) { alert('No matching groups'); return; }
    await api('/kobepay-pro/packs', { method: 'POST', body: JSON.stringify({ schoolId, name, items }) });
    load();
  };
  const buyPack = async (p: PackRow) => {
    const code = prompt(`Buy "${p.name}" for which student code?`)?.trim().toUpperCase(); if (!code) return;
    const students = await api<Student[]>(`/kobepay-pro/students?schoolId=${schoolId}`);
    const student = (Array.isArray(students) ? students : []).find((s) => s.studentCode === code);
    if (!student) { alert('No student with that code'); return; }
    try { const r = await api<{ bought: number; total: number }>(`/kobepay-pro/packs/${p.id}/buy`, { method: 'POST', body: JSON.stringify({ studentId: student.id }) }); alert(`Reserved ${r.bought} item(s), ${money(r.total, currency)} held.`); }
    catch (e) { alert((e as Error).message); }
  };

  const addGroup = async () => {
    const title = prompt('Product / group title (e.g. "Casio FX-991 Calculator")')?.trim();
    if (!title) return;
    const groupPrice = Number(prompt('Group price per unit (what each parent pays)')); if (!(groupPrice > 0)) return;
    const normalPrice = Number(prompt('Normal retail price (optional)', '0')) || 0;
    const minParticipants = Number(prompt('Minimum participants', '1')) || 1;
    const deliveryLocation = prompt('Delivery location', 'School office') || '';
    await api('/kobepay-pro/groups', { method: 'POST', body: JSON.stringify({ schoolId, title, groupPrice, normalPrice, minParticipants, deliveryLocation }) });
    load();
  };
  const addSupplier = async () => {
    const name = prompt('Supplier name')?.trim(); if (!name) return;
    const r = await api<Supplier>('/kobepay-pro/suppliers', { method: 'POST', body: JSON.stringify({ name }) });
    const url = `${window.location.origin}/kobepay/supplier/${r.portalToken}`;
    alert(`Supplier "${r.name}" created (${r.code}).\n\nPortal link (no login) — share with the supplier:\n${url}`);
    load();
  };

  return (
    <div className="p-4 space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="flex items-center mb-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Suppliers · {suppliers.length}</h2>
          <button onClick={addSupplier} className="ml-auto h-8 inline-flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 px-3 text-xs font-bold"><Plus className="w-4 h-4" />Add supplier</button>
        </div>
        {suppliers.length === 0 ? <p className="text-[11px] text-slate-500">Add a supplier, then share their portal link so they fulfil orders without an account.</p> : suppliers.map((s) => (
          <div key={s.id} className="flex items-center gap-2 py-1.5 text-sm">
            <Truck className="w-4 h-4 text-slate-500" />
            <span className="font-semibold">{s.name}</span>
            <span className="text-[11px] text-slate-500">{s.code}</span>
            <button onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/kobepay/supplier/${s.portalToken}`); }} className="ml-auto inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:underline"><Copy className="w-3 h-3" />Copy portal link</button>
            <button onClick={() => api(`/kobepay-pro/suppliers/${s.id}/settle`, { method: 'POST', body: '{}' }).then((r) => alert(`Settled ${money((r as { settled: number }).settled, currency)}`))} className="text-[11px] px-2 py-0.5 rounded border border-slate-700 text-slate-300">Settle</button>
          </div>
        ))}
      </div>

      <div className="flex items-center">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Purchase groups · {rows.length}</h2>
        <button onClick={addGroup} className="ml-auto h-8 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold"><Plus className="w-4 h-4" />New group</button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {rows.length === 0 ? <div className="col-span-full p-8 text-center text-slate-500 text-sm">No purchase groups yet.</div> : rows.map((g) => (
          <button key={g.id} onClick={() => setSel(g.id)} className="text-left rounded-xl border border-slate-800 bg-slate-900/50 p-3 hover:border-slate-700">
            <div className="flex items-center gap-2">
              <span className="font-bold truncate">{g.title}</span>
              <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">{g.status}</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">{money(g.groupPrice, currency)}{g.normalPrice > 0 && <span className="line-through ml-1 text-slate-600">{money(g.normalPrice, currency)}</span>} · min {g.minParticipants} · {g.reference}</div>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="flex items-center mb-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Starter packs · {packs.length}</h2>
          <button onClick={addPack} className="ml-auto h-8 inline-flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 px-3 text-xs font-bold"><Plus className="w-4 h-4" />New pack</button>
        </div>
        {packs.length === 0 ? <p className="text-[11px] text-slate-500">Bundle several open groups (books + uniform + calculator…) so a parent buys them in one tap.</p> : packs.map((p) => (
          <div key={p.id} className="flex items-center gap-2 py-1.5 text-sm">
            <Boxes className="w-4 h-4 text-slate-500" />
            <span className="font-semibold">{p.name}</span>
            <span className="text-[11px] text-slate-500">{p.items.length} item(s){p.className ? ` · ${p.className}` : ''}</span>
            <button onClick={() => buyPack(p)} className="ml-auto text-[11px] px-2 py-0.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800">Buy for student</button>
          </div>
        ))}
      </div>

      {sel && <GroupDrawer groupId={sel} currency={currency} schoolId={schoolId} suppliers={suppliers} onClose={() => { setSel(null); load(); }} />}
    </div>
  );
}

function GroupDrawer({ groupId, currency, schoolId, suppliers, onClose }: { groupId: string; currency: string; schoolId: string; suppliers: Supplier[]; onClose: () => void }) {
  const [d, setD] = useState<GroupDetail | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    api<GroupDetail>(`/kobepay-pro/groups/${groupId}`).then(setD).catch(() => setD(null));
    api<Student[]>(`/kobepay-pro/students?schoolId=${schoolId}`).then((r) => setStudents(Array.isArray(r) ? r : [])).catch(() => setStudents([]));
  }, [groupId, schoolId]);
  useEffect(() => { load(); }, [load]);
  const act = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); load(); } catch (e) { alert((e as Error).message); } finally { setBusy(false); } };

  if (!d) return null;
  const g = d.group;
  const stageIdx = GROUP_STAGES.indexOf(g.status);

  const join = () => {
    const code = prompt('Student code to add to this group')?.trim().toUpperCase(); if (!code) return;
    const student = students.find((s) => s.studentCode === code);
    if (!student) { alert('No student with that code'); return; }
    const qty = Number(prompt('Quantity', '1')) || 1;
    act(() => api(`/kobepay-pro/groups/${groupId}/join`, { method: 'POST', body: JSON.stringify({ studentId: student.id, qty }) }));
  };
  const assign = () => {
    if (!suppliers.length) { alert('Add a supplier first'); return; }
    const code = prompt(`Supplier code (${suppliers.map((s) => s.code).join(', ')})`)?.trim().toUpperCase();
    const supplier = suppliers.find((s) => s.code === code); if (!supplier) { alert('Unknown supplier'); return; }
    const cost = Number(prompt('Supplier unit cost (what the supplier charges per unit)')); if (!(cost >= 0)) return;
    act(() => api(`/kobepay-pro/groups/${groupId}/supplier`, { method: 'POST', body: JSON.stringify({ supplierId: supplier.id, supplierUnitCost: cost }) }));
  };
  const consolidate = () => act(() => api(`/kobepay-pro/groups/${groupId}/consolidate`, { method: 'POST', body: JSON.stringify({ force: !d.minReached && confirm('Minimum not reached. Order anyway?') }) }));
  const collect = () => { const code = prompt('Scan/enter the collecting student code')?.trim().toUpperCase(); if (!code) return; act(() => api(`/kobepay-pro/groups/${groupId}/collect`, { method: 'POST', body: JSON.stringify({ studentCode: code }) }).then((r) => alert(`Collected: ${(r as { student: { name: string } }).student.name}`))); };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md h-full bg-slate-900 border-l border-slate-800 overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 p-4 border-b border-slate-800 sticky top-0 bg-slate-900">
          <div className="min-w-0"><div className="font-bold truncate">{g.title}</div><div className="text-[11px] text-slate-500">{g.reference} · {g.status}</div></div>
          <button onClick={onClose} className="ml-auto text-slate-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-4">
          {/* progress */}
          <div className="flex items-center gap-1">
            {GROUP_STAGES.map((s, i) => (
              <div key={s} className={`flex-1 h-1.5 rounded-full ${g.status === 'CANCELLED' ? 'bg-rose-800' : i <= stageIdx ? 'bg-emerald-500' : 'bg-slate-800'}`} title={s} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Pool label="Participants" value={d.participants} c="" Icon={Users} />
            <Pool label="Units" value={d.totalQty} c="" Icon={Boxes} />
            <Pool label="In escrow" value={d.escrowTotal} c={currency} Icon={Lock} />
            <Pool label="To supplier" value={d.supplierTotal} c={currency} Icon={Truck} />
          </div>
          <div className="text-[11px] text-slate-500">
            {money(g.groupPrice, currency)}/unit · supplier {g.supplierUnitCost > 0 ? money(g.supplierUnitCost, currency) : '—'}/unit · margin becomes fees · deliver to {g.deliveryLocation || '—'}
            {d.supplier && <> · supplier: <b className="text-slate-300">{d.supplier.name}</b></>}
          </div>

          {/* stage actions */}
          <div className="grid grid-cols-2 gap-2">
            {g.status === 'OPEN' && <><ActBtn label="Add participant" onClick={join} busy={busy} /><ActBtn label="Assign supplier" onClick={assign} busy={busy} /><ActBtn label="Consolidate order" onClick={consolidate} busy={busy} /><ActBtn label="Cancel group" onClick={() => act(() => api(`/kobepay-pro/groups/${groupId}/cancel`, { method: 'POST', body: '{}' }))} busy={busy} /></>}
            {['ORDERED', 'PRODUCTION', 'IN_TRANSIT'].includes(g.status) && <div className="col-span-2 text-[11px] text-slate-500">Waiting on the supplier to update fulfilment via their portal link.</div>}
            {g.status === 'DELIVERED' && <ActBtn label="Verify delivery" onClick={() => act(() => api(`/kobepay-pro/groups/${groupId}/verify`, { method: 'POST', body: '{}' }))} busy={busy} />}
            {g.status === 'VERIFIED' && <><ActBtn label="Collect (scan student)" onClick={collect} busy={busy} /><ActBtn label="Complete & pay supplier" onClick={() => act(() => api(`/kobepay-pro/groups/${groupId}/complete`, { method: 'POST', body: '{}' }))} busy={busy} /></>}
            {g.status === 'COMPLETED' && <div className="col-span-2 text-[11px] text-emerald-400">Completed — {d.collected}/{d.orders.length} collected. Settle the supplier from the Suppliers panel.</div>}
          </div>

          {/* participants */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Participants</div>
            {d.orders.length === 0 ? <p className="text-[11px] text-slate-500">No participants yet.</p> : d.orders.map((o) => (
              <div key={o.id} className="flex items-center gap-2 py-1 text-sm">
                <span className="truncate">{o.studentName}</span>
                <span className="text-[11px] text-slate-500">×{o.qty} · {money(o.amount, currency)}</span>
                {o.collected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{o.status}</span>
                {g.status === 'OPEN' && o.status === 'RESERVED' && <button onClick={() => act(() => api(`/kobepay-pro/group-orders/${o.id}/cancel`, { method: 'POST', body: '{}' }))} className="text-[11px] text-rose-400">remove</button>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Small pieces ─────────────────────────────────────────────────────────
function Stat({ label, value, Icon, tone }: { label: string; value: string; Icon: typeof Wallet; tone: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex items-center gap-2 text-slate-500 text-[11px]"><Icon className={`w-4 h-4 ${tone}`} />{label}</div>
      <div className="text-lg font-black mt-1">{value}</div>
    </div>
  );
}
function Pool({ label, value, c, Icon }: { label: string; value: number; c: string; Icon: typeof Wallet }) {
  return (
    <div className="rounded-xl bg-slate-800/60 p-2.5">
      <div className="flex items-center gap-1 text-[10px] uppercase text-slate-500"><Icon className="w-3 h-3" />{label}</div>
      <div className="font-bold mt-0.5">{c ? money(value, c) : value.toLocaleString()}</div>
    </div>
  );
}
function ActBtn({ label, onClick, busy }: { label: string; onClick: () => void; busy: boolean }) {
  return <button disabled={busy} onClick={onClick} className="h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold disabled:opacity-40">{label}</button>;
}
function Row({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="ml-auto font-semibold">{value}</span>
      <button onClick={onEdit} className="text-[11px] text-emerald-400 hover:underline">Edit</button>
    </div>
  );
}
