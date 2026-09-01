import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, CalendarDays, CheckCircle2, FileSignature, Home, Loader2,
  Plus, RefreshCw, ShieldCheck, Wallet, X,
} from 'lucide-react';
import { api } from '@/lib/api';

type LeaseStatus = 'upcoming' | 'active' | 'ended' | 'cancelled';
type ChargeStatus = 'open' | 'partial' | 'paid' | 'overdue' | 'waived';

interface PropertyRow { id: string; name: string }
interface UnitRow {
  id: string;
  propertyId: string;
  unitNumber: string;
  rentAmount?: number | string;
  currency?: string;
  status?: string;
}
interface TenantRow {
  id: string;
  unitId?: string | null;
  name: string;
  phone?: string;
}
interface LeaseRow {
  id: string;
  unitId: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  monthlyRent: number | string;
  deposit: number | string;
  rentDueDay: number;
  lateFee: number | string;
  status: LeaseStatus;
  notes?: string;
}
interface ChargeRow {
  id: string;
  leaseId: string;
  tenantId: string;
  unitId: string;
  period: string;
  dueDate: string;
  amount: number | string;
  amountPaid: number | string;
  status: ChargeStatus;
  notes?: string;
}
interface GenerateResult { period: string; created: number; charges: ChargeRow[] }

interface Props { selectedPropertyId: string }

const currentPeriod = () => new Date().toISOString().slice(0, 7);
const dateOnly = () => new Date().toISOString().slice(0, 10);
const shortDate = (value?: string) => value ? new Date(value).toLocaleDateString() : '—';
const money = (value: number | string, currency = 'TZS') =>
  `${currency === 'TZS' ? 'TSh ' : `${currency} `}${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default function PropertyPmSuite({ selectedPropertyId }: Props) {
  const [view, setView] = useState<'leases' | 'schedule' | 'arrears'>('leases');
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [leases, setLeases] = useState<LeaseRow[]>([]);
  const [charges, setCharges] = useState<ChargeRow[]>([]);
  const [period, setPeriod] = useState(currentPeriod());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [leaseModal, setLeaseModal] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [p, u, t, l, c] = await Promise.all([
        api<PropertyRow[]>('/property/properties', { offlineFallback: false }),
        api<UnitRow[]>('/property/units', { offlineFallback: false }),
        api<TenantRow[]>('/property/tenants', { offlineFallback: false }),
        api<LeaseRow[]>('/property/leases', { offlineFallback: false }),
        api<ChargeRow[]>('/property/rent-charges', { offlineFallback: false }),
      ]);
      setProperties(Array.isArray(p) ? p : []);
      setUnits(Array.isArray(u) ? u : []);
      setTenants(Array.isArray(t) ? t : []);
      setLeases(Array.isArray(l) ? l : []);
      setCharges(Array.isArray(c) ? c : []);
    } catch (reason) {
      setError((reason as Error).message || 'Could not load leases and rent.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const propertyById = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);
  const unitById = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);
  const tenantById = useMemo(() => new Map(tenants.map((t) => [t.id, t])), [tenants]);

  const visibleUnits = useMemo(
    () => selectedPropertyId ? units.filter((u) => u.propertyId === selectedPropertyId) : units,
    [selectedPropertyId, units],
  );
  const visibleUnitIds = useMemo(() => new Set(visibleUnits.map((u) => u.id)), [visibleUnits]);
  const visibleLeases = useMemo(
    () => leases.filter((lease) => !selectedPropertyId || visibleUnitIds.has(lease.unitId)),
    [leases, selectedPropertyId, visibleUnitIds],
  );
  const visibleCharges = useMemo(
    () => charges.filter((charge) => !selectedPropertyId || visibleUnitIds.has(charge.unitId)),
    [charges, selectedPropertyId, visibleUnitIds],
  );
  const visibleTenants = useMemo(
    () => tenants.filter((tenant) => !selectedPropertyId || !tenant.unitId || visibleUnitIds.has(tenant.unitId)),
    [tenants, selectedPropertyId, visibleUnitIds],
  );

  const scheduleRows = useMemo(
    () => visibleCharges.filter((charge) => charge.period === period).sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [period, visibleCharges],
  );
  const arrears = useMemo(() => {
    const now = Date.now();
    return visibleCharges
      .filter((charge) => {
        const balance = Math.max(0, Number(charge.amount || 0) - Number(charge.amountPaid || 0));
        return balance > 0 && charge.status !== 'waived' && new Date(charge.dueDate).getTime() < now;
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [visibleCharges]);

  const activeLeases = visibleLeases.filter((lease) => lease.status === 'active').length;
  const scheduled = scheduleRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const collected = scheduleRows.reduce((sum, row) => sum + Number(row.amountPaid || 0), 0);
  const arrearsTotal = arrears.reduce((sum, row) => sum + Math.max(0, Number(row.amount || 0) - Number(row.amountPaid || 0)), 0);
  const currency = visibleUnits.find((u) => u.currency)?.currency ?? 'TZS';

  const generate = async () => {
    setGenerating(true);
    setError('');
    setNotice('');
    try {
      const result = await api<GenerateResult>('/property/rent-charges/generate', {
        method: 'POST',
        offlineFallback: false,
        body: JSON.stringify({ period }),
      });
      setNotice(result.created > 0
        ? `${result.created} rent charge${result.created === 1 ? '' : 's'} generated for ${period}.`
        : `Rent schedule for ${period} was already complete.`);
      await load();
      setView(new Date(`${period}-01T00:00:00Z`).getTime() < new Date(`${currentPeriod()}-01T00:00:00Z`).getTime() ? 'arrears' : 'schedule');
    } catch (reason) {
      setError((reason as Error).message || 'Could not generate rent schedule.');
    } finally {
      setGenerating(false);
    }
  };

  const waive = async (chargeId: string) => {
    if (!window.confirm('Waive the remaining balance on this rent charge?')) return;
    setError('');
    try {
      await api(`/property/rent-charges/${chargeId}/waive`, { method: 'POST', offlineFallback: false });
      setNotice('Charge waived.');
      await load();
    } catch (reason) {
      setError((reason as Error).message || 'Could not waive charge.');
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-[#10223f] p-5 text-white shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-300">Property management</span>
            <h2 className="mt-1 text-2xl font-black">Leases, rent schedule & arrears</h2>
            <p className="mt-1 text-xs text-white/55">
              {selectedPropertyId ? propertyById.get(selectedPropertyId)?.name ?? 'Selected property' : 'All properties'} · persisted operational records
            </p>
          </div>
          <div className="xl:ml-auto flex flex-wrap gap-2">
            <button onClick={() => void load()} disabled={loading} className="h-10 px-3 rounded-xl border border-white/15 text-xs font-black inline-flex items-center gap-2 disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button onClick={() => setLeaseModal(true)} className="h-10 px-4 rounded-xl bg-white text-[#10223f] text-xs font-black inline-flex items-center gap-2">
              <Plus className="h-4 w-4" /> New lease
            </button>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <DarkMetric label="Active leases" value={String(activeLeases)} />
          <DarkMetric label={`${period} scheduled`} value={money(scheduled, currency)} />
          <DarkMetric label={`${period} collected`} value={money(collected, currency)} />
          <DarkMetric label="Total arrears" value={money(arrearsTotal, currency)} danger={arrearsTotal > 0} />
        </div>
      </section>

      {(error || notice) && (
        <div className={`rounded-xl border px-3 py-2 text-sm ${error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {error || notice}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-3 lg:flex-row lg:items-center">
          <div className="flex gap-1 overflow-x-auto">
            <ViewButton active={view === 'leases'} onClick={() => setView('leases')} icon={<FileSignature className="h-4 w-4" />}>Leases</ViewButton>
            <ViewButton active={view === 'schedule'} onClick={() => setView('schedule')} icon={<CalendarDays className="h-4 w-4" />}>Rent schedule</ViewButton>
            <ViewButton active={view === 'arrears'} onClick={() => setView('arrears')} icon={<AlertCircle className="h-4 w-4" />}>Arrears {arrears.length ? `(${arrears.length})` : ''}</ViewButton>
          </div>
          <div className="lg:ml-auto flex items-center gap-2">
            <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="h-10 rounded-xl border border-slate-200 px-3 text-xs font-bold outline-none focus:border-blue-400" />
            <button onClick={() => void generate()} disabled={generating || !period} className="h-10 rounded-xl bg-blue-600 px-4 text-xs font-black text-white disabled:opacity-50">
              {generating ? 'Generating…' : 'Generate rent / arrears'}
            </button>
          </div>
        </div>

        <div className="p-4">
          {loading && leases.length === 0 && charges.length === 0 ? (
            <div className="py-20 grid place-items-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : view === 'leases' ? (
            <LeasesList rows={visibleLeases} unitById={unitById} tenantById={tenantById} propertyById={propertyById} />
          ) : view === 'schedule' ? (
            <ScheduleList rows={scheduleRows} unitById={unitById} tenantById={tenantById} period={period} currency={currency} onWaive={waive} />
          ) : (
            <ArrearsList rows={arrears} unitById={unitById} tenantById={tenantById} currency={currency} onWaive={waive} />
          )}
        </div>
      </section>

      {leaseModal && (
        <LeaseModal
          units={visibleUnits}
          tenants={visibleTenants}
          unitById={unitById}
          onClose={() => setLeaseModal(false)}
          onSaved={async () => { setLeaseModal(false); setNotice('Lease created. Generate the rent schedule when ready.'); await load(); }}
        />
      )}
    </div>
  );
}

function LeasesList({ rows, unitById, tenantById, propertyById }: {
  rows: LeaseRow[];
  unitById: Map<string, UnitRow>;
  tenantById: Map<string, TenantRow>;
  propertyById: Map<string, PropertyRow>;
}) {
  if (!rows.length) return <Empty icon={<FileSignature className="h-9 w-9" />} title="No leases yet" body="Create the first lease to connect a tenant, unit, rent amount and due date." />;
  return <div className="divide-y divide-slate-100">
    {rows.slice().sort((a, b) => b.startDate.localeCompare(a.startDate)).map((lease) => {
      const unit = unitById.get(lease.unitId);
      const property = unit ? propertyById.get(unit.propertyId) : undefined;
      return <div key={lease.id} className="py-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="h-11 w-11 shrink-0 rounded-xl bg-blue-50 text-blue-700 grid place-items-center"><FileSignature className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><b>{tenantById.get(lease.tenantId)?.name ?? 'Tenant'}</b><LeasePill status={lease.status} /></div>
          <span className="block text-xs text-slate-500">{property?.name ?? 'Property'} · Unit {unit?.unitNumber ?? '—'}</span>
          <span className="block text-[10px] text-slate-400">{shortDate(lease.startDate)} → {shortDate(lease.endDate)} · rent due day {lease.rentDueDay}</span>
        </div>
        <div className="lg:text-right">
          <b className="text-sm">{money(lease.monthlyRent, unit?.currency ?? 'TZS')} / month</b>
          <span className="block text-[10px] text-slate-500">Deposit {money(lease.deposit, unit?.currency ?? 'TZS')} · late fee {money(lease.lateFee, unit?.currency ?? 'TZS')}</span>
        </div>
      </div>;
    })}
  </div>;
}

function ScheduleList({ rows, unitById, tenantById, period, currency, onWaive }: {
  rows: ChargeRow[];
  unitById: Map<string, UnitRow>;
  tenantById: Map<string, TenantRow>;
  period: string;
  currency: string;
  onWaive: (id: string) => Promise<void>;
}) {
  if (!rows.length) return <Empty icon={<CalendarDays className="h-9 w-9" />} title={`No schedule for ${period}`} body="Choose the month above and generate the rent schedule from active leases." />;
  const expected = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const paid = rows.reduce((s, r) => s + Number(r.amountPaid || 0), 0);
  return <div>
    <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
      <LightMetric label="Expected" value={money(expected, currency)} icon={<Wallet className="h-4 w-4" />} />
      <LightMetric label="Paid" value={money(paid, currency)} icon={<CheckCircle2 className="h-4 w-4" />} />
      <LightMetric label="Outstanding" value={money(Math.max(0, expected - paid), currency)} icon={<AlertCircle className="h-4 w-4" />} />
    </div>
    <ChargeRows rows={rows} unitById={unitById} tenantById={tenantById} onWaive={onWaive} />
  </div>;
}

function ArrearsList({ rows, unitById, tenantById, currency, onWaive }: {
  rows: ChargeRow[];
  unitById: Map<string, UnitRow>;
  tenantById: Map<string, TenantRow>;
  currency: string;
  onWaive: (id: string) => Promise<void>;
}) {
  if (!rows.length) return <Empty icon={<ShieldCheck className="h-9 w-9" />} title="No arrears" body="There are no unpaid rent charges past their due date." />;
  const total = rows.reduce((s, row) => s + Math.max(0, Number(row.amount || 0) - Number(row.amountPaid || 0)), 0);
  return <div>
    <div className="mb-4 rounded-2xl border border-rose-100 bg-rose-50 p-4">
      <span className="text-[10px] font-black uppercase tracking-wide text-rose-600">Collections queue</span>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
        <b className="text-2xl text-rose-800">{money(total, currency)}</b>
        <span className="text-xs text-rose-600">{rows.length} overdue charge{rows.length === 1 ? '' : 's'}</span>
      </div>
    </div>
    <ChargeRows rows={rows} unitById={unitById} tenantById={tenantById} onWaive={onWaive} showAge />
  </div>;
}

function ChargeRows({ rows, unitById, tenantById, onWaive, showAge = false }: {
  rows: ChargeRow[];
  unitById: Map<string, UnitRow>;
  tenantById: Map<string, TenantRow>;
  onWaive: (id: string) => Promise<void>;
  showAge?: boolean;
}) {
  return <div className="divide-y divide-slate-100">{rows.map((row) => {
    const unit = unitById.get(row.unitId);
    const balance = Math.max(0, Number(row.amount || 0) - Number(row.amountPaid || 0));
    return <div key={row.id} className="py-4 flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-100 text-slate-500 grid place-items-center"><Home className="h-5 w-5" /></div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><b>{tenantById.get(row.tenantId)?.name ?? 'Tenant'}</b><ChargePill status={row.status} /></div>
        <span className="block text-xs text-slate-500">Unit {unit?.unitNumber ?? '—'} · {row.period} · due {shortDate(row.dueDate)}{showAge ? ' · overdue' : ''}</span>
      </div>
      <div className="lg:text-right">
        <b className={balance > 0 ? 'text-rose-700' : 'text-emerald-700'}>{money(balance, unit?.currency ?? 'TZS')} due</b>
        <span className="block text-[10px] text-slate-500">{money(row.amountPaid, unit?.currency ?? 'TZS')} paid of {money(row.amount, unit?.currency ?? 'TZS')}</span>
      </div>
      {balance > 0 && row.status !== 'waived' && <button onClick={() => void onWaive(row.id)} className="h-9 rounded-xl border border-slate-200 px-3 text-[10px] font-black text-slate-600 hover:border-rose-200 hover:text-rose-700">Waive</button>}
    </div>;
  })}</div>;
}

function LeaseModal({ units, tenants, unitById, onClose, onSaved }: {
  units: UnitRow[];
  tenants: TenantRow[];
  unitById: Map<string, UnitRow>;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const firstUnit = units[0];
  const [form, setForm] = useState({
    unitId: firstUnit?.id ?? '',
    tenantId: '',
    startDate: dateOnly(),
    endDate: '',
    monthlyRent: firstUnit ? String(firstUnit.rentAmount ?? '') : '',
    deposit: firstUnit ? String(firstUnit.rentAmount ?? '') : '',
    rentDueDay: '1',
    lateFee: '0',
    status: 'active' as LeaseStatus,
    notes: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    if (!form.unitId || !form.tenantId || !form.startDate || !form.endDate || !Number(form.monthlyRent)) {
      setError('Select a unit and tenant, then enter the lease dates and monthly rent.');
      return;
    }
    if (new Date(form.endDate).getTime() <= new Date(form.startDate).getTime()) {
      setError('Lease end date must be after the start date.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api('/property/leases', {
        method: 'POST',
        offlineFallback: false,
        body: JSON.stringify({
          unitId: form.unitId,
          tenantId: form.tenantId,
          startDate: form.startDate,
          endDate: form.endDate,
          monthlyRent: Number(form.monthlyRent),
          deposit: Number(form.deposit || 0),
          rentDueDay: Math.max(1, Math.min(31, Number(form.rentDueDay || 1))),
          lateFee: Number(form.lateFee || 0),
          status: form.status,
          notes: form.notes || undefined,
        }),
      });
      await api(`/property/tenants/${form.tenantId}`, {
        method: 'PATCH',
        offlineFallback: false,
        body: JSON.stringify({
          unitId: form.unitId,
          leaseStart: form.startDate,
          leaseEnd: form.endDate,
          status: form.status === 'active' ? 'active' : 'pending',
        }),
      });
      if (form.status === 'active') {
        await api(`/property/units/${form.unitId}`, {
          method: 'PATCH',
          offlineFallback: false,
          body: JSON.stringify({ status: 'occupied' }),
        });
      }
      await onSaved();
    } catch (reason) {
      setError((reason as Error).message || 'Could not create lease.');
    } finally {
      setBusy(false);
    }
  };

  return <div className="fixed inset-0 z-50 bg-black/45 grid place-items-center p-4" onMouseDown={onClose}>
    <div onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-xl rounded-2xl bg-white border border-slate-200 p-5 shadow-xl">
      <div className="flex items-center"><div><span className="text-[10px] uppercase font-black text-blue-600">Property management</span><h2 className="font-black">Create lease</h2></div><button onClick={onClose} className="ml-auto"><X className="h-5 w-5" /></button></div>
      <div className="mt-4 grid gap-3">
        <Field label="Unit">
          <select className="control-light" value={form.unitId} onChange={(e) => {
            const id = e.target.value;
            const unit = unitById.get(id);
            setForm((current) => ({ ...current, unitId: id, monthlyRent: String(unit?.rentAmount ?? ''), deposit: String(unit?.rentAmount ?? '') }));
          }}>
            <option value="">Select unit</option>
            {units.map((unit) => <option key={unit.id} value={unit.id}>Unit {unit.unitNumber} · {money(unit.rentAmount ?? 0, unit.currency ?? 'TZS')}</option>)}
          </select>
        </Field>
        <Field label="Tenant">
          <select className="control-light" value={form.tenantId} onChange={(e) => set('tenantId', e.target.value)}>
            <option value="">Select tenant</option>
            {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}{tenant.phone ? ` · ${tenant.phone}` : ''}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Start date"><input type="date" className="control-light" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} /></Field><Field label="End date"><input type="date" className="control-light" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} /></Field></div>
        <div className="grid grid-cols-2 gap-3"><Field label="Monthly rent"><input type="number" min="0" className="control-light" value={form.monthlyRent} onChange={(e) => set('monthlyRent', e.target.value)} /></Field><Field label="Deposit"><input type="number" min="0" className="control-light" value={form.deposit} onChange={(e) => set('deposit', e.target.value)} /></Field></div>
        <div className="grid grid-cols-3 gap-3"><Field label="Rent due day"><input type="number" min="1" max="31" className="control-light" value={form.rentDueDay} onChange={(e) => set('rentDueDay', e.target.value)} /></Field><Field label="Late fee"><input type="number" min="0" className="control-light" value={form.lateFee} onChange={(e) => set('lateFee', e.target.value)} /></Field><Field label="Status"><select className="control-light" value={form.status} onChange={(e) => setForm((current) => ({ ...current, status: e.target.value as LeaseStatus }))}><option value="active">Active</option><option value="upcoming">Upcoming</option></select></Field></div>
        <Field label="Notes"><textarea className="control-light min-h-20" value={form.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <button onClick={() => void save()} disabled={busy} className="h-11 rounded-xl bg-blue-600 text-white text-sm font-black disabled:opacity-50">{busy ? 'Creating lease…' : 'Create lease'}</button>
      </div>
    </div>
  </div>;
}

function ViewButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return <button onClick={onClick} className={`h-10 whitespace-nowrap rounded-xl px-3 text-xs font-black inline-flex items-center gap-2 ${active ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>{icon}{children}</button>;
}
function DarkMetric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <div className="rounded-xl border border-white/10 bg-white/5 p-3"><span className="text-[9px] uppercase text-white/45">{label}</span><b className={`mt-1 block truncate text-sm ${danger ? 'text-rose-300' : 'text-white'}`}>{value}</b></div>;
}
function LightMetric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <div className="rounded-xl bg-slate-50 p-3"><div className="flex items-center gap-2 text-slate-400">{icon}<span className="text-[9px] uppercase font-bold">{label}</span></div><b className="mt-1 block text-sm">{value}</b></div>;
}
function Empty({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return <div className="py-16 text-center text-slate-400"><div className="grid place-items-center">{icon}</div><b className="mt-3 block text-slate-700">{title}</b><p className="mt-1 text-sm">{body}</p></div>;
}
function LeasePill({ status }: { status: LeaseStatus }) {
  const cls = status === 'active' ? 'bg-emerald-50 text-emerald-700' : status === 'upcoming' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600';
  return <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${cls}`}>{status}</span>;
}
function ChargePill({ status }: { status: ChargeStatus }) {
  const cls = status === 'paid' ? 'bg-emerald-50 text-emerald-700' : status === 'overdue' ? 'bg-rose-50 text-rose-700' : status === 'partial' ? 'bg-amber-50 text-amber-700' : status === 'waived' ? 'bg-slate-100 text-slate-500' : 'bg-blue-50 text-blue-700';
  return <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${cls}`}>{status}</span>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1 text-xs text-slate-500">{label}{children}</label>;
}
