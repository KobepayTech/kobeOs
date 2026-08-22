import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Layers, Loader2, Package, Plus, Printer, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';

type JobStatus = 'Pending' | 'Printing' | 'Finishing' | 'Completed' | 'Cancelled';
type Priority = 'High' | 'Medium' | 'Low';
type Tab = 'jobs' | 'materials' | 'templates';

interface PrintJob { id: string; jobNumber: string; product: string; customer: string; customerPhone?: string | null; dueDate?: string | null; priority: Priority; status: JobStatus; qty: number; method: string; notes?: string | null; price: number | string; currency: string; templateId?: string | null; createdAt: string; }
interface PrintMaterial { id: string; name: string; type: string; stock: number | string; unit: string; minThreshold: number | string; color: string; supplier?: string | null; costPerUnit: number | string; currency: string; status?: 'Out' | 'Low' | 'In Stock'; }
interface PrintTemplate { id: string; name: string; category: string; method: string; canvasData: string; thumbnailUrl?: string | null; active: boolean; }

const money = (value: number | string, currency = 'TZS') => `${currency === 'TZS' ? 'TSh' : currency} ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default function KobePrint() {
  const [tab, setTab] = useState<Tab>('jobs');
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [materials, setMaterials] = useState<PrintMaterial[]>([]);
  const [templates, setTemplates] = useState<PrintTemplate[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [jobRows, materialRows, templateRows] = await Promise.all([
        api<PrintJob[]>('/print/jobs', { offlineFallback: false }),
        api<PrintMaterial[]>('/print/materials', { offlineFallback: false }),
        api<PrintTemplate[]>('/print/templates', { offlineFallback: false }),
      ]);
      setJobs(Array.isArray(jobRows) ? jobRows : []);
      setMaterials(Array.isArray(materialRows) ? materialRows : []);
      setTemplates(Array.isArray(templateRows) ? templateRows : []);
    } catch (cause) {
      setError((cause as Error).message || 'Print workspace could not load live records.');
      setJobs([]); setMaterials([]); setTemplates([]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const query = search.trim().toLowerCase();
  const filteredJobs = jobs.filter((row) => !query || `${row.jobNumber} ${row.product} ${row.customer} ${row.status}`.toLowerCase().includes(query));
  const filteredMaterials = materials.filter((row) => !query || `${row.name} ${row.type} ${row.supplier ?? ''}`.toLowerCase().includes(query));
  const filteredTemplates = templates.filter((row) => !query || `${row.name} ${row.category} ${row.method}`.toLowerCase().includes(query));
  const activeJobs = jobs.filter((row) => ['Pending', 'Printing', 'Finishing'].includes(row.status)).length;
  const completedRevenue = jobs.filter((row) => row.status === 'Completed').reduce((sum, row) => sum + Number(row.price || 0) * Number(row.qty || 0), 0);
  const lowStock = materials.filter((row) => Number(row.stock) <= Number(row.minThreshold)).length;

  const updateJob = async (job: PrintJob, status: JobStatus) => {
    try {
      await api(`/print/jobs/${job.id}`, { method: 'PATCH', offlineFallback: false, body: JSON.stringify({ status }) });
      await load();
    } catch (cause) { setError((cause as Error).message); }
  };

  const adjustStock = async (material: PrintMaterial, delta: number) => {
    try {
      await api(`/print/materials/${material.id}/adjust-stock`, { method: 'POST', offlineFallback: false, body: JSON.stringify({ delta, reason: 'Kobe Print inventory adjustment' }) });
      await load();
    } catch (cause) { setError((cause as Error).message); }
  };

  const removeTemplate = async (row: PrintTemplate) => {
    if (!window.confirm(`Delete template ${row.name}?`)) return;
    try {
      await api(`/print/templates/${row.id}`, { method: 'DELETE', offlineFallback: false });
      await load();
    } catch (cause) { setError((cause as Error).message); }
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-950 text-slate-100">
      <header className="shrink-0 border-b border-slate-800 bg-slate-900/80">
        <div className="flex h-16 items-center gap-3 px-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/15 text-violet-300"><Printer className="h-5 w-5" /></div>
          <div><h1 className="font-black">Kobe Print</h1><p className="text-[11px] text-slate-500">Production jobs, materials and reusable templates</p></div>
          <button onClick={() => void load()} disabled={loading} className="ml-auto grid h-9 w-9 place-items-center rounded-lg border border-slate-700 text-slate-400"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
        <nav className="flex px-3">{(['jobs', 'materials', 'templates'] as Tab[]).map((id) => <button key={id} onClick={() => setTab(id)} className={`h-11 border-b-2 px-3 text-xs font-black capitalize ${tab === id ? 'border-violet-300 text-violet-300' : 'border-transparent text-slate-500'}`}>{id}</button>)}</nav>
      </header>

      <main className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {error && <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"><AlertTriangle className="h-4 w-4" />{error}</div>}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Metric label="Jobs" value={String(jobs.length)} /><Metric label="Active production" value={String(activeJobs)} /><Metric label="Completed revenue" value={money(completedRevenue, jobs[0]?.currency || 'TZS')} /><Metric label="Low stock" value={String(lowStock)} /></div>
        <div className="flex gap-2"><div className="relative max-w-lg flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search live print records" className="h-10 w-full rounded-xl border border-slate-800 bg-slate-900 pl-9 pr-3 text-sm" /></div><button onClick={() => setCreateOpen(true)} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-violet-600 px-3 text-xs font-black"><Plus className="h-4 w-4" />Add</button></div>

        {loading ? <div className="grid place-items-center py-24 text-slate-500"><Loader2 className="h-6 w-6 animate-spin" /></div> : tab === 'jobs' ? (
          <section className="rounded-2xl border border-slate-800 bg-slate-900 px-4">{filteredJobs.map((row) => <div key={row.id} className="flex flex-wrap items-center gap-3 border-b border-slate-800 py-3"><Package className="h-4 w-4 text-violet-300" /><div className="min-w-0 flex-1"><b className="block truncate">{row.jobNumber} · {row.product}</b><span className="text-xs text-slate-500">{row.customer || 'No customer'} · {row.qty} pcs · {row.method || 'Method not set'} · {row.status}</span></div><b>{money(Number(row.price) * Number(row.qty), row.currency)}</b><select value={row.status} onChange={(event) => void updateJob(row, event.target.value as JobStatus)} className="h-8 rounded-lg border border-slate-700 bg-black/20 px-2 text-xs"><option>Pending</option><option>Printing</option><option>Finishing</option><option>Completed</option><option>Cancelled</option></select></div>)}{!filteredJobs.length && <Empty body="No print jobs found. Create the first real production job." />}</section>
        ) : tab === 'materials' ? (
          <section className="rounded-2xl border border-slate-800 bg-slate-900 px-4">{filteredMaterials.map((row) => <div key={row.id} className="flex items-center gap-3 border-b border-slate-800 py-3"><Layers className="h-4 w-4 text-cyan-300" /><div className="min-w-0 flex-1"><b className="block truncate">{row.name}</b><span className="text-xs text-slate-500">{row.type || 'Material'} · {row.stock} {row.unit} · minimum {row.minThreshold}</span></div><span className={`text-xs font-black ${Number(row.stock) <= Number(row.minThreshold) ? 'text-amber-300' : 'text-emerald-300'}`}>{row.status || (Number(row.stock) <= Number(row.minThreshold) ? 'Low' : 'In Stock')}</span><button onClick={() => void adjustStock(row, -1)} className="h-8 rounded-lg border border-slate-700 px-2 text-xs">−1</button><button onClick={() => void adjustStock(row, 1)} className="h-8 rounded-lg border border-slate-700 px-2 text-xs">+1</button></div>)}{!filteredMaterials.length && <Empty body="No print materials found. Add stock before production." />}</section>
        ) : (
          <section className="rounded-2xl border border-slate-800 bg-slate-900 px-4">{filteredTemplates.map((row) => <div key={row.id} className="flex items-center gap-3 border-b border-slate-800 py-3"><CheckCircle2 className="h-4 w-4 text-emerald-300" /><div className="min-w-0 flex-1"><b className="block truncate">{row.name}</b><span className="text-xs text-slate-500">{row.category || 'Uncategorised'} · {row.method || 'Any method'} · {row.active ? 'Active' : 'Inactive'}</span></div><button onClick={() => void removeTemplate(row)} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-700 text-rose-300"><Trash2 className="h-4 w-4" /></button></div>)}{!filteredTemplates.length && <Empty body="No templates found. Save a reusable design template." />}</section>
        )}
      </main>

      {createOpen && <CreateDialog mode={tab} onClose={() => setCreateOpen(false)} onSaved={async () => { setCreateOpen(false); await load(); }} />}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><div className="text-lg font-black">{value}</div><div className="mt-1 text-[11px] text-slate-500">{label}</div></div>; }
function Empty({ body }: { body: string }) { return <div className="py-12 text-center text-sm text-slate-500">{body}</div>; }

function CreateDialog({ mode, onClose, onSaved }: { mode: Tab; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<Record<string, string>>({ priority: 'Medium', qty: '1', currency: 'TZS', stock: '0', minThreshold: '0', active: 'true' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setBusy(true); setError('');
    try {
      if (mode === 'jobs') await api('/print/jobs', { method: 'POST', offlineFallback: false, body: JSON.stringify({ product: form.product, customer: form.customer || undefined, customerPhone: form.customerPhone || undefined, dueDate: form.dueDate || undefined, priority: form.priority || 'Medium', qty: Number(form.qty || 1), method: form.method || undefined, notes: form.notes || undefined, price: Number(form.price || 0), currency: form.currency || 'TZS' }) });
      if (mode === 'materials') await api('/print/materials', { method: 'POST', offlineFallback: false, body: JSON.stringify({ name: form.name, type: form.type || undefined, stock: Number(form.stock || 0), unit: form.unit || 'units', minThreshold: Number(form.minThreshold || 0), color: form.color || undefined, supplier: form.supplier || undefined, costPerUnit: Number(form.costPerUnit || 0), currency: form.currency || 'TZS' }) });
      if (mode === 'templates') await api('/print/templates', { method: 'POST', offlineFallback: false, body: JSON.stringify({ name: form.name, category: form.category || undefined, method: form.method || undefined, canvasData: form.canvasData || '[]', active: form.active !== 'false' }) });
      await onSaved();
    } catch (cause) { setError((cause as Error).message || 'Could not save print record.'); }
    finally { setBusy(false); }
  };

  return <div className="fixed inset-0 z-[10000] grid place-items-center bg-black/70 p-4"><div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-4"><div className="flex items-center"><h2 className="text-lg font-black">Add {mode.slice(0, -1)}</h2><button onClick={onClose} className="ml-auto grid h-8 w-8 place-items-center rounded-lg border border-slate-700"><X className="h-4 w-4" /></button></div><div className="mt-4 space-y-3">{mode === 'jobs' && <><Field label="Product" value={form.product} onChange={(value) => set('product', value)} /><Field label="Customer" value={form.customer} onChange={(value) => set('customer', value)} /><Field label="Customer phone" value={form.customerPhone} onChange={(value) => set('customerPhone', value)} /><Field label="Quantity" type="number" value={form.qty} onChange={(value) => set('qty', value)} /><Field label="Method" value={form.method} onChange={(value) => set('method', value)} /><Field label="Price per item" type="number" value={form.price} onChange={(value) => set('price', value)} /></>}{mode === 'materials' && <><Field label="Name" value={form.name} onChange={(value) => set('name', value)} /><Field label="Type" value={form.type} onChange={(value) => set('type', value)} /><Field label="Stock" type="number" value={form.stock} onChange={(value) => set('stock', value)} /><Field label="Unit" value={form.unit} onChange={(value) => set('unit', value)} /><Field label="Minimum threshold" type="number" value={form.minThreshold} onChange={(value) => set('minThreshold', value)} /><Field label="Supplier" value={form.supplier} onChange={(value) => set('supplier', value)} /></>}{mode === 'templates' && <><Field label="Name" value={form.name} onChange={(value) => set('name', value)} /><Field label="Category" value={form.category} onChange={(value) => set('category', value)} /><Field label="Method" value={form.method} onChange={(value) => set('method', value)} /></>}{error && <p className="text-sm text-rose-300">{error}</p>}<button onClick={() => void save()} disabled={busy} className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-violet-600 font-black disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save live record'}</button></div></div></div>;
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value?: string; onChange: (value: string) => void; type?: string }) { return <label className="grid gap-1 text-xs text-slate-400">{label}<input type={type} value={value || ''} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-xl border border-slate-700 bg-black/20 px-3 text-sm text-white" /></label>; }
