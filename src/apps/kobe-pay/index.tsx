import { useCallback, useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Loader2, Plus, RefreshCw, Search, Send, Store, Users, Wallet, X } from 'lucide-react';
import { api } from '@/lib/api';

type DepositStatus = 'Pending' | 'Confirmed';
type PayoutStatus = 'INITIATED' | 'SENT' | 'CONFIRMED' | 'PAID' | 'REJECTED';
type Tab = 'overview' | 'customers' | 'suppliers' | 'deposits' | 'payouts' | 'allocations';

interface Customer { id: string; name: string; phone: string; email?: string; company?: string; balance: number | string; }
interface Supplier { id: string; name: string; country?: string; contact?: string; phone?: string; balance: number | string; status: 'Active' | 'Inactive'; }
interface Deposit { id: string; customerId: string; customerName: string; amount: number | string; currency: string; method: string; reference?: string; status: DepositStatus; createdAt: string; }
interface Payout { id: string; supplierId: string; supplierName: string; amount: number | string; currency: string; method: string; status: PayoutStatus; createdAt: string; }
interface Allocation { id: string; customerId: string; customerName: string; supplierId: string; supplierName: string; amount: number | string; orderRef: string; type: 'Deposit' | 'Full'; createdAt: string; }

const money = (value: number | string, currency = 'TZS') => `${currency === 'TZS' ? 'TSh' : currency} ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const text = (value: unknown) => String(value ?? '').toLowerCase();

export default function KobePay() {
  const [tab, setTab] = useState<Tab>('overview');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createMode, setCreateMode] = useState<Exclude<Tab, 'overview'> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [customerRows, supplierRows, depositRows, payoutRows, allocationRows] = await Promise.all([
        api<Customer[]>('/kobepay/customers', { offlineFallback: false }),
        api<Supplier[]>('/kobepay/suppliers', { offlineFallback: false }),
        api<Deposit[]>('/kobepay/deposits', { offlineFallback: false }),
        api<Payout[]>('/kobepay/payouts', { offlineFallback: false }),
        api<Allocation[]>('/kobepay/allocations', { offlineFallback: false }),
      ]);
      setCustomers(Array.isArray(customerRows) ? customerRows : []);
      setSuppliers(Array.isArray(supplierRows) ? supplierRows : []);
      setDeposits(Array.isArray(depositRows) ? depositRows : []);
      setPayouts(Array.isArray(payoutRows) ? payoutRows : []);
      setAllocations(Array.isArray(allocationRows) ? allocationRows : []);
    } catch (cause) {
      setError((cause as Error).message || 'KobePay could not load live records.');
      setCustomers([]); setSuppliers([]); setDeposits([]); setPayouts([]); setAllocations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const confirmedTotal = deposits.filter((row) => row.status === 'Confirmed').reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const paidTotal = payouts.filter((row) => row.status === 'PAID').reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const query = search.trim().toLowerCase();

  const confirmDeposit = async (row: Deposit) => {
    try {
      await api(`/kobepay/deposits/${row.id}/status`, { method: 'PATCH', offlineFallback: false, body: JSON.stringify({ status: 'Confirmed' }) });
      await load();
    } catch (cause) { setError((cause as Error).message); }
  };

  const advancePayout = async (row: Payout) => {
    const next: PayoutStatus = row.status === 'INITIATED' ? 'SENT' : row.status === 'SENT' ? 'CONFIRMED' : row.status === 'CONFIRMED' ? 'PAID' : row.status;
    if (next === row.status) return;
    try {
      await api(`/kobepay/payouts/${row.id}/status`, { method: 'PATCH', offlineFallback: false, body: JSON.stringify({ status: next }) });
      await load();
    } catch (cause) { setError((cause as Error).message); }
  };

  const filteredCustomers = customers.filter((row) => !query || text(`${row.name} ${row.phone} ${row.company ?? ''}`).includes(query));
  const filteredSuppliers = suppliers.filter((row) => !query || text(`${row.name} ${row.country ?? ''} ${row.phone ?? ''}`).includes(query));
  const filteredDeposits = deposits.filter((row) => !query || text(`${row.customerName} ${row.method} ${row.reference ?? ''}`).includes(query));
  const filteredPayouts = payouts.filter((row) => !query || text(`${row.supplierName} ${row.method} ${row.status}`).includes(query));
  const filteredAllocations = allocations.filter((row) => !query || text(`${row.customerName} ${row.supplierName} ${row.orderRef}`).includes(query));

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-950 text-slate-100">
      <header className="shrink-0 border-b border-slate-800 bg-slate-900/80">
        <div className="flex h-16 items-center gap-3 px-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300"><Wallet className="h-5 w-5" /></div>
          <div><h1 className="font-black">KobePay</h1><p className="text-[11px] text-slate-500">Live customer funds and supplier settlement</p></div>
          <button onClick={() => void load()} disabled={loading} className="ml-auto grid h-9 w-9 place-items-center rounded-lg border border-slate-700 text-slate-400"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
        <nav className="flex overflow-x-auto px-3">
          {(['overview', 'customers', 'suppliers', 'deposits', 'payouts', 'allocations'] as Tab[]).map((id) => <button key={id} onClick={() => setTab(id)} className={`h-11 border-b-2 px-3 text-xs font-black capitalize ${tab === id ? 'border-emerald-300 text-emerald-300' : 'border-transparent text-slate-500'}`}>{id}</button>)}
        </nav>
      </header>

      <main className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div>}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Customers" value={String(customers.length)} />
          <Metric label="Suppliers" value={String(suppliers.length)} />
          <Metric label="Confirmed deposits" value={money(confirmedTotal, deposits[0]?.currency || 'TZS')} />
          <Metric label="Paid out" value={money(paidTotal, payouts[0]?.currency || 'TZS')} />
        </div>

        {tab !== 'overview' && <div className="flex gap-2"><div className="relative max-w-lg flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search live records" className="h-10 w-full rounded-xl border border-slate-800 bg-slate-900 pl-9 pr-3 text-sm" /></div><button onClick={() => setCreateMode(tab)} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-black"><Plus className="h-4 w-4" />Add</button></div>}

        {loading ? <div className="grid place-items-center py-24 text-slate-500"><Loader2 className="h-6 w-6 animate-spin" /></div> : tab === 'overview' ? (
          <div className="grid gap-4 lg:grid-cols-2"><Panel title="Recent deposits">{deposits.slice(0, 8).map((row) => <Row key={row.id} icon={<ArrowDownLeft className="h-4 w-4 text-emerald-300" />} title={row.customerName} subtitle={`${row.method} · ${row.status}`} value={money(row.amount, row.currency)} />)}{!deposits.length && <Empty body="No customer deposits have been recorded." />}</Panel><Panel title="Recent payouts">{payouts.slice(0, 8).map((row) => <Row key={row.id} icon={<ArrowUpRight className="h-4 w-4 text-amber-300" />} title={row.supplierName} subtitle={`${row.method} · ${row.status}`} value={money(row.amount, row.currency)} />)}{!payouts.length && <Empty body="No supplier payouts have been initiated." />}</Panel></div>
        ) : tab === 'customers' ? <List>{filteredCustomers.map((row) => <Row key={row.id} icon={<Users className="h-4 w-4" />} title={row.name} subtitle={`${row.phone}${row.company ? ` · ${row.company}` : ''}`} value={money(row.balance)} />)}{!filteredCustomers.length && <Empty body="No customers found." />}</List>
          : tab === 'suppliers' ? <List>{filteredSuppliers.map((row) => <Row key={row.id} icon={<Store className="h-4 w-4" />} title={row.name} subtitle={`${row.country || '—'} · ${row.status}`} value={money(row.balance)} />)}{!filteredSuppliers.length && <Empty body="No suppliers found." />}</List>
          : tab === 'deposits' ? <List>{filteredDeposits.map((row) => <div key={row.id} className="flex items-center gap-3 border-b border-slate-800 py-3"><ArrowDownLeft className="h-4 w-4 text-emerald-300" /><div className="min-w-0 flex-1"><b className="block truncate">{row.customerName}</b><span className="text-xs text-slate-500">{new Date(row.createdAt).toLocaleString()} · {row.method} · {row.status}</span></div><b>{money(row.amount, row.currency)}</b>{row.status === 'Pending' && <button onClick={() => void confirmDeposit(row)} className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-black">Confirm</button>}</div>)}{!filteredDeposits.length && <Empty body="No deposits found." />}</List>
          : tab === 'payouts' ? <List>{filteredPayouts.map((row) => <div key={row.id} className="flex items-center gap-3 border-b border-slate-800 py-3"><ArrowUpRight className="h-4 w-4 text-amber-300" /><div className="min-w-0 flex-1"><b className="block truncate">{row.supplierName}</b><span className="text-xs text-slate-500">{new Date(row.createdAt).toLocaleString()} · {row.method} · {row.status}</span></div><b>{money(row.amount, row.currency)}</b>{['INITIATED', 'SENT', 'CONFIRMED'].includes(row.status) && <button onClick={() => void advancePayout(row)} className="rounded-lg border border-slate-700 px-2 py-1 text-xs font-black">Advance</button>}</div>)}{!filteredPayouts.length && <Empty body="No payouts found." />}</List>
          : <List>{filteredAllocations.map((row) => <Row key={row.id} icon={<Send className="h-4 w-4 text-blue-300" />} title={`${row.customerName} → ${row.supplierName}`} subtitle={`${row.orderRef} · ${row.type}`} value={money(row.amount)} />)}{!filteredAllocations.length && <Empty body="No allocations found." />}</List>}
      </main>

      {createMode && <CreateDialog mode={createMode} customers={customers} suppliers={suppliers} onClose={() => setCreateMode(null)} onSaved={async () => { setCreateMode(null); await load(); }} />}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><div className="text-lg font-black">{value}</div><div className="mt-1 text-[11px] text-slate-500">{label}</div></div>; }
function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><h2 className="font-black">{title}</h2><div className="mt-3 divide-y divide-slate-800">{children}</div></section>; }
function List({ children }: { children: React.ReactNode }) { return <section className="rounded-2xl border border-slate-800 bg-slate-900 px-4">{children}</section>; }
function Row({ icon, title, subtitle, value }: { icon: React.ReactNode; title: string; subtitle: string; value: string }) { return <div className="flex items-center gap-3 py-3">{icon}<div className="min-w-0 flex-1"><b className="block truncate text-sm">{title}</b><span className="block truncate text-xs text-slate-500">{subtitle}</span></div><b className="text-sm">{value}</b></div>; }
function Empty({ body }: { body: string }) { return <div className="py-10 text-center text-sm text-slate-500">{body}</div>; }

function CreateDialog({ mode, customers, suppliers, onClose, onSaved }: { mode: Exclude<Tab, 'overview'>; customers: Customer[]; suppliers: Supplier[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<Record<string, string>>({ currency: 'TZS', method: 'Cash', status: 'Active', type: 'Deposit' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setBusy(true); setError('');
    try {
      if (mode === 'customers') await api('/kobepay/customers', { method: 'POST', offlineFallback: false, body: JSON.stringify({ name: form.name, phone: form.phone, email: form.email || undefined, company: form.company || undefined }) });
      if (mode === 'suppliers') await api('/kobepay/suppliers', { method: 'POST', offlineFallback: false, body: JSON.stringify({ name: form.name, country: form.country || undefined, contact: form.contact || undefined, phone: form.phone || undefined, status: form.status || 'Active' }) });
      if (mode === 'deposits') await api('/kobepay/deposits', { method: 'POST', offlineFallback: false, body: JSON.stringify({ customerId: form.customerId, amount: Number(form.amount), currency: form.currency || 'TZS', method: form.method || 'Cash', reference: form.reference || undefined, txnType: 'Deposit' }) });
      if (mode === 'payouts') await api('/kobepay/payouts', { method: 'POST', offlineFallback: false, body: JSON.stringify({ supplierId: form.supplierId, amount: Number(form.amount), currency: form.currency || 'TZS', method: form.method || 'Bank', notes: form.notes || undefined }) });
      if (mode === 'allocations') await api('/kobepay/allocations', { method: 'POST', offlineFallback: false, body: JSON.stringify({ customerId: form.customerId, supplierId: form.supplierId, amount: Number(form.amount), orderRef: form.orderRef, type: form.type || 'Deposit' }) });
      await onSaved();
    } catch (cause) { setError((cause as Error).message || 'Could not save record.'); }
    finally { setBusy(false); }
  };

  return <div className="fixed inset-0 z-[10000] grid place-items-center bg-black/70 p-4"><div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-4"><div className="flex items-center"><h2 className="text-lg font-black capitalize">Add {mode.slice(0, -1)}</h2><button onClick={onClose} className="ml-auto grid h-8 w-8 place-items-center rounded-lg border border-slate-700"><X className="h-4 w-4" /></button></div><div className="mt-4 space-y-3">{mode === 'customers' && <><Field label="Name" value={form.name} onChange={(value) => set('name', value)} /><Field label="Phone" value={form.phone} onChange={(value) => set('phone', value)} /><Field label="Email" value={form.email} onChange={(value) => set('email', value)} /><Field label="Company" value={form.company} onChange={(value) => set('company', value)} /></>}{mode === 'suppliers' && <><Field label="Name" value={form.name} onChange={(value) => set('name', value)} /><Field label="Country" value={form.country} onChange={(value) => set('country', value)} /><Field label="Phone" value={form.phone} onChange={(value) => set('phone', value)} /><Field label="Contact" value={form.contact} onChange={(value) => set('contact', value)} /></>}{mode === 'deposits' && <><Select label="Customer" value={form.customerId} onChange={(value) => set('customerId', value)} options={customers.map((row) => [row.id, row.name])} /><Field label="Amount" type="number" value={form.amount} onChange={(value) => set('amount', value)} /><Field label="Currency" value={form.currency} onChange={(value) => set('currency', value)} /><Field label="Method" value={form.method} onChange={(value) => set('method', value)} /><Field label="Reference" value={form.reference} onChange={(value) => set('reference', value)} /></>}{mode === 'payouts' && <><Select label="Supplier" value={form.supplierId} onChange={(value) => set('supplierId', value)} options={suppliers.map((row) => [row.id, row.name])} /><Field label="Amount" type="number" value={form.amount} onChange={(value) => set('amount', value)} /><Field label="Currency" value={form.currency} onChange={(value) => set('currency', value)} /><Field label="Method" value={form.method} onChange={(value) => set('method', value)} /></>}{mode === 'allocations' && <><Select label="Customer" value={form.customerId} onChange={(value) => set('customerId', value)} options={customers.map((row) => [row.id, row.name])} /><Select label="Supplier" value={form.supplierId} onChange={(value) => set('supplierId', value)} options={suppliers.map((row) => [row.id, row.name])} /><Field label="Amount" type="number" value={form.amount} onChange={(value) => set('amount', value)} /><Field label="Order reference" value={form.orderRef} onChange={(value) => set('orderRef', value)} /></>}{error && <p className="text-sm text-rose-300">{error}</p>}<button onClick={() => void save()} disabled={busy} className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-emerald-600 font-black disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save live record'}</button></div></div></div>;
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value?: string; onChange: (value: string) => void; type?: string }) { return <label className="grid gap-1 text-xs text-slate-400">{label}<input type={type} value={value || ''} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-xl border border-slate-700 bg-black/20 px-3 text-sm text-white" /></label>; }
function Select({ label, value, onChange, options }: { label: string; value?: string; onChange: (value: string) => void; options: Array<[string, string]> }) { return <label className="grid gap-1 text-xs text-slate-400">{label}<select value={value || ''} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-xl border border-slate-700 bg-black/20 px-3 text-sm text-white"><option value="">Select</option>{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>; }
