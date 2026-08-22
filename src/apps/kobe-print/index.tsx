import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Layers, Loader2, Package, Plus, Printer,
  RefreshCw, Scissors, Search, Trash2, X,
} from 'lucide-react';
import { api } from '@/lib/api';

type JobStatus = 'Pending' | 'Printing' | 'Finishing' | 'Completed' | 'Cancelled';
type Priority = 'High' | 'Medium' | 'Low';
interface PrintJob { id: string; jobNumber: string; product: string; customer: string; customerPhone?: string | null; customerEmail?: string | null; dueDate?: string | null; priority: Priority; status: JobStatus; qty: number; method: string; notes?: string | null; price: number | string; currency: string; templateId?: string | null; createdAt: string }
interface PrintMaterial { id: string; name: string; type: string; stock: number | string; unit: string; minThreshold: number | string; color: string; supplier?: string | null; costPerUnit: number | string; currency: string; status?: 'Out' | 'Low' | 'In Stock' }
interface PrintTemplate { id: string; name: string; category: string; method: string; canvasData: string; thumbnailUrl?: string | null; active: boolean }
interface Stats { total: number; pending: number; printing: number; finishing: number; completed: number; revenue: number }
type Tab = 'jobs' | 'materials' | 'templates';
const money = (n: number | string, c = 'TZS') => `${c === 'TZS' ? 'TSh ' : `${c} `}${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default function KobePrint() {
  const [tab, setTab] = useState<Tab>('jobs');
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [materials, setMaterials] = useState<PrintMaterial[]>([]);
  const [templates, setTemplates] = useState<PrintTemplate[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<Tab | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [j, m, t, s] = await Promise.all([
        api<PrintJob[]>('/print/jobs', { offlineFallback: false }),
        api<PrintMaterial[]>('/print/materials', { offlineFallback: false }),
        api<PrintTemplate[]>('/print/templates', { offlineFallback: false }),
        api<Stats>('/print/jobs/stats', { offlineFallback: false }),
      ]);
      setJobs(Array.isArray(j) ? j : []); setMaterials(Array.isArray(m) ? m : []); setTemplates(Array.isArray(t) ? t : []); setStats(s ?? null);
    } catch (e) {
      setJobs([]); setMaterials([]); setTemplates([]); setStats(null); setError((e as Error).message || 'Could not load Kobe Print.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const q = search.trim().toLowerCase();
  const filteredJobs = jobs.filter((j) => !q || `${j.jobNumber} ${j.product} ${j.customer} ${j.method}`.toLowerCase().includes(q));
  const filteredMaterials = materials.filter((m) => !q || `${m.name} ${m.type} ${m.supplier ?? ''}`.toLowerCase().includes(q));
  const filteredTemplates = templates.filter((t) => !q || `${t.name} ${t.category} ${t.method}`.toLowerCase().includes(q));
  const lowStock = materials.filter((m) => Number(m.stock) <= Number(m.minThreshold)).length;

  const updateStatus = async (job: PrintJob, status: JobStatus) => {
    try { await api(`/print/jobs/${job.id}`, { method: 'PATCH', offlineFallback: false, body: JSON.stringify({ status }) }); await load(); }
    catch (e) { setError((e as Error).message || 'Could not update job.'); }
  };
  const adjust = async (material: PrintMaterial, delta: number) => {
    try { await api(`/print/materials/${material.id}/adjust-stock`, { method: 'POST', offlineFallback: false, body: JSON.stringify({ delta, reason: 'Manual Kobe Print adjustment' }) }); await load(); }
    catch (e) { setError((e as Error).message || 'Could not adjust stock.'); }
  };
  const remove = async (kind: Tab, id: string) => {
    const path = kind === 'jobs' ? `/print/jobs/${id}` : kind === 'materials' ? `/print/materials/${id}` : `/print/templates/${id}`;
    if (!window.confirm('Delete this record?')) return;
    try { await api(path, { method: 'DELETE', offlineFallback: false }); await load(); }
    catch (e) { setError((e as Error).message || 'Could not delete record.'); }
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      <header className="shrink-0 bg-slate-900/80 border-b border-slate-800">
        <div className="h-16 px-4 flex items-center gap-3"><div className="h-10 w-10 rounded-xl bg-violet-500/15 text-violet-300 grid place-items-center"><Printer className="h-5 w-5" /></div><div><h1 className="font-black">Kobe Print</h1><p className="text-[11px] text-slate-500">Real print jobs, templates and material stock</p></div><button onClick={() => void load()} disabled={loading} className="ml-auto h-9 w-9 rounded-lg border border-slate-700 grid place-items-center text-slate-400"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button></div>
        <nav className="px-4 flex gap-1">{([['jobs', 'Jobs', Printer], ['materials', 'Materials', Package], ['templates', 'Templates', Layers]] as const).map(([id, label, Icon]) => <button key={id} onClick={() => setTab(id)} className={`h-10 px-3 inline-flex items-center gap-2 text-xs font-black border-b-2 ${tab === id ? 'text-violet-300 border-violet-300' : 'text-slate-500 border-transparent'}`}><Icon className="h-4 w-4" />{label}</button>)}</nav>
      </header>
      <main className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div>}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3"><Stat label="Jobs" value={stats?.total ?? jobs.length} /><Stat label="Pending" value={stats?.pending ?? jobs.filter((j) => j.status === 'Pending').length} /><Stat label="Printing" value={stats?.printing ?? jobs.filter((j) => j.status === 'Printing').length} /><Stat label="Low materials" value={lowStock} warn={lowStock > 0} /><Stat label="Completed revenue" value={money(stats?.revenue ?? 0, jobs[0]?.currency ?? 'TZS')} /></div>
        <div className="flex gap-2"><div className="relative flex-1 max-w-lg"><Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="w-full h-10 rounded-xl bg-slate-900 border border-slate-800 pl-9 pr-3 text-sm outline-none" /></div><button onClick={() => setModal(tab)} className="h-10 px-3 rounded-xl bg-violet-600 text-white text-xs font-black inline-flex items-center gap-1.5"><Plus className="h-4 w-4" /> Add {tab === 'jobs' ? 'job' : tab === 'materials' ? 'material' : 'template'}</button></div>
        {loading && !jobs.length && !materials.length && !templates.length ? <div className="py-24 grid place-items-center text-slate-500"><Loader2 className="h-6 w-6 animate-spin" /></div> : tab === 'jobs' ? <Jobs rows={filteredJobs} onStatus={updateStatus} onDelete={(id) => void remove('jobs', id)} /> : tab === 'materials' ? <Materials rows={filteredMaterials} onAdjust={adjust} onDelete={(id) => void remove('materials', id)} /> : <Templates rows={filteredTemplates} onDelete={(id) => void remove('templates', id)} />}
      </main>
      {modal && <CreateModal mode={modal} onClose={() => setModal(null)} onSaved={async () => { setModal(null); await load(); }} />}
    </div>
  );
}

function Jobs({ rows, onStatus, onDelete }: { rows: PrintJob[]; onStatus: (j: PrintJob, status: JobStatus) => Promise<void>; onDelete: (id: string) => void }) {
  if (!rows.length) return <Panel><Empty title="No print jobs" body="Create a real customer job to start the production queue." /></Panel>;
  return <Panel><div className="divide-y divide-slate-800">{rows.map((j) => <div key={j.id} className="py-3 flex items-center gap-3"><div className="h-10 w-10 rounded-xl bg-violet-500/10 text-violet-300 grid place-items-center"><Printer className="h-5 w-5" /></div><div className="min-w-0 flex-1"><b className="block truncate">{j.jobNumber} · {j.product}</b><span className="text-xs text-slate-500">{j.customer || 'No customer'} · {j.qty} × {j.method || 'unspecified'}{j.dueDate ? ` · due ${new Date(j.dueDate).toLocaleDateString()}` : ''}</span></div><div className="text-right mr-2"><b className="text-sm">{money(Number(j.price || 0) * j.qty, j.currency)}</b><span className="block text-[10px] text-slate-500">{j.priority}</span></div><select value={j.status} onChange={(e) => void onStatus(j, e.target.value as JobStatus)} className="h-8 rounded-lg bg-slate-900 border border-slate-700 px-2 text-xs">{['Pending','Printing','Finishing','Completed','Cancelled'].map((s) => <option key={s}>{s}</option>)}</select><button onClick={() => onDelete(j.id)} className="h-8 w-8 rounded-lg border border-slate-700 grid place-items-center text-slate-500 hover:text-rose-300"><Trash2 className="h-4 w-4" /></button></div>)}</div></Panel>;
}
function Materials({ rows, onAdjust, onDelete }: { rows: PrintMaterial[]; onAdjust: (m: PrintMaterial, delta: number) => Promise<void>; onDelete: (id: string) => void }) {
  if (!rows.length) return <Panel><Empty title="No materials" body="Add ink, fabric, vinyl, paper, thread or other production stock." /></Panel>;
  return <Panel><div className="divide-y divide-slate-800">{rows.map((m) => { const low = Number(m.stock) <= Number(m.minThreshold); return <div key={m.id} className="py-3 flex items-center gap-3"><div className={`h-10 w-10 rounded-xl grid place-items-center ${low ? 'bg-amber-500/10 text-amber-300' : 'bg-emerald-500/10 text-emerald-300'}`}>{low ? <AlertTriangle className="h-5 w-5" /> : <Package className="h-5 w-5" />}</div><div className="flex-1"><b>{m.name}</b><span className="block text-xs text-slate-500">{m.type || 'Material'} · threshold {Number(m.minThreshold)} {m.unit}</span></div><div className="text-right"><b>{Number(m.stock).toLocaleString()} {m.unit}</b><span className={`block text-[10px] font-black ${low ? 'text-amber-300' : 'text-emerald-300'}`}>{m.status ?? (low ? 'LOW' : 'IN STOCK')}</span></div><button onClick={() => void onAdjust(m, Number(window.prompt('Stock change: positive adds, negative consumes', '1') || 0))} className="h-8 px-2 rounded-lg border border-slate-700 text-xs">Adjust</button><button onClick={() => onDelete(m.id)} className="h-8 w-8 rounded-lg border border-slate-700 grid place-items-center text-slate-500 hover:text-rose-300"><Trash2 className="h-4 w-4" /></button></div>; })}</div></Panel>;
}
function Templates({ rows, onDelete }: { rows: PrintTemplate[]; onDelete: (id: string) => void }) {
  if (!rows.length) return <Panel><Empty title="No templates" body="Create reusable production templates tied to real jobs." /></Panel>;
  return <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{rows.map((t) => <div key={t.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"><div className="flex items-start"><div className="h-10 w-10 rounded-xl bg-cyan-500/10 text-cyan-300 grid place-items-center"><Scissors className="h-5 w-5" /></div><button onClick={() => onDelete(t.id)} className="ml-auto text-slate-600 hover:text-rose-300"><Trash2 className="h-4 w-4" /></button></div><b className="block mt-3">{t.name}</b><span className="text-xs text-slate-500">{t.category || 'Custom'} · {t.method || 'Any method'}</span></div>)}</div>;
}
function CreateModal({ mode, onClose, onSaved }: { mode: Tab; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<Record<string,string>>({ priority: 'Medium', qty: '1', currency: 'TZS', stock: '0', minThreshold: '0', unit: 'units', active: 'true' }); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const set = (k:string,v:string) => setForm((f) => ({ ...f, [k]: v }));
  const save = async () => { setBusy(true); setError(''); try { if (mode === 'jobs') await api('/print/jobs', { method: 'POST', offlineFallback: false, body: JSON.stringify({ product: form.product, customer: form.customer || undefined, customerPhone: form.customerPhone || undefined, dueDate: form.dueDate || undefined, priority: form.priority as Priority, qty: Number(form.qty || 1), method: form.method || undefined, price: Number(form.price || 0), currency: form.currency || 'TZS', notes: form.notes || undefined }) }); if (mode === 'materials') await api('/print/materials', { method: 'POST', offlineFallback: false, body: JSON.stringify({ name: form.name, type: form.type || undefined, stock: Number(form.stock || 0), unit: form.unit || 'units', minThreshold: Number(form.minThreshold || 0), supplier: form.supplier || undefined, costPerUnit: Number(form.costPerUnit || 0), currency: form.currency || 'TZS' }) }); if (mode === 'templates') await api('/print/templates', { method: 'POST', offlineFallback: false, body: JSON.stringify({ name: form.name, category: form.category || undefined, method: form.method || undefined, canvasData: '[]', active: true }) }); await onSaved(); } catch (e) { setError((e as Error).message || 'Could not save record.'); } finally { setBusy(false); } };
  return <div className="fixed inset-0 z-50 bg-black/55 grid place-items-center p-4" onMouseDown={onClose}><div onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-5"><div className="flex items-center"><h2 className="font-black">Add {mode === 'jobs' ? 'print job' : mode === 'materials' ? 'material' : 'template'}</h2><button onClick={onClose} className="ml-auto"><X className="h-5 w-5" /></button></div><div className="mt-4 grid gap-3">{mode === 'jobs' && <><Input label="Product" value={form.product} onChange={(v) => set('product',v)} /><Input label="Customer" value={form.customer} onChange={(v) => set('customer',v)} /><div className="grid grid-cols-2 gap-3"><Input label="Quantity" type="number" value={form.qty} onChange={(v) => set('qty',v)} /><Input label="Unit price" type="number" value={form.price} onChange={(v) => set('price',v)} /></div><div className="grid grid-cols-2 gap-3"><Input label="Method" value={form.method} onChange={(v) => set('method',v)} /><Input label="Due date" type="date" value={form.dueDate} onChange={(v) => set('dueDate',v)} /></div></>}{mode === 'materials' && <><Input label="Material name" value={form.name} onChange={(v) => set('name',v)} /><Input label="Type" value={form.type} onChange={(v) => set('type',v)} /><div className="grid grid-cols-2 gap-3"><Input label="Stock" type="number" value={form.stock} onChange={(v) => set('stock',v)} /><Input label="Minimum" type="number" value={form.minThreshold} onChange={(v) => set('minThreshold',v)} /></div><div className="grid grid-cols-2 gap-3"><Input label="Unit" value={form.unit} onChange={(v) => set('unit',v)} /><Input label="Supplier" value={form.supplier} onChange={(v) => set('supplier',v)} /></div></>}{mode === 'templates' && <><Input label="Template name" value={form.name} onChange={(v) => set('name',v)} /><Input label="Category" value={form.category} onChange={(v) => set('category',v)} /><Input label="Method" value={form.method} onChange={(v) => set('method',v)} /></>}{error && <p className="text-xs text-rose-300">{error}</p>}<button onClick={() => void save()} disabled={busy} className="h-10 rounded-xl bg-violet-600 text-white font-black disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button></div></div></div>;
}
function Input({ label, value, onChange, type='text' }: { label:string; value?:string; onChange:(v:string)=>void; type?:string }) { return <label className="grid gap-1 text-xs text-slate-400">{label}<input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} className="h-10 rounded-xl bg-slate-900 border border-slate-700 px-3 text-sm" /></label>; }
function Panel({ children }: { children: React.ReactNode }) { return <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">{children}</section>; }
function Stat({ label, value, warn }: { label:string; value:string|number; warn?:boolean }) { return <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"><span className="text-xs text-slate-500">{label}</span><b className={`block mt-1 text-lg ${warn ? 'text-amber-300' : ''}`}>{value}</b></div>; }
function Empty({ title, body }: { title:string; body:string }) { return <div className="py-14 text-center text-slate-500"><CheckCircle2 className="h-9 w-9 mx-auto mb-2 text-slate-700" /><b className="block text-slate-300">{title}</b><p className="text-sm mt-1">{body}</p></div>; }
