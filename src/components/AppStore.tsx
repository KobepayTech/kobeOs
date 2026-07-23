import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Box,
  Check,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  PackageCheck,
  PackageOpen,
  PauseCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { AppManifest } from '@/os/types';
import { appCatalogue, getInstalledAppRegistry } from '@/os/registry';
import { useOSStore } from '@/os/store';
import {
  getModuleRecord,
  installBundledModule,
  isCoreApp,
  ModuleProgress,
  setModuleEnabled,
  subscribeToModuleChanges,
  uninstallModule,
} from '@/os/module-installer';

type Filter = 'all' | 'installed' | 'available' | 'disabled' | 'updates';

const categoryLabel: Record<string, string> = {
  system: 'System', productivity: 'Productivity', media: 'Media', communication: 'Communication',
  development: 'Development', games: 'Games', erp: 'Business', other: 'Other',
};

function moduleSize(app: AppManifest) {
  const base = 1.4;
  const permissionWeight = app.permissions.length * 0.08;
  const businessWeight = app.category === 'erp' ? 1.8 : app.category === 'media' ? 2.7 : 0.7;
  return Math.round((base + permissionWeight + businessWeight) * 10) / 10;
}

export default function AppStore() {
  const setApps = useOSStore((state) => state.setApps);
  const launchApp = useOSStore((state) => state.launchApp);
  const closeWindow = useOSStore((state) => state.closeWindow);
  const windows = useOSStore((state) => state.windows);
  const [revision, setRevision] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<AppManifest | null>(null);
  const [progress, setProgress] = useState<Record<string, ModuleProgress>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeToModuleChanges(() => {
    setRevision((value) => value + 1);
    setApps(getInstalledAppRegistry());
  }), [setApps]);

  const modules = useMemo(() => appCatalogue.map((app) => ({
    app,
    record: getModuleRecord(app),
    sizeMb: moduleSize(app),
    core: isCoreApp(app.id),
  })), [revision]);

  const categories = useMemo(() => ['all', ...new Set(modules.map((item) => item.app.category))], [modules]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return modules.filter((item) => {
      if (category !== 'all' && item.app.category !== category) return false;
      if (filter === 'installed' && item.record.state !== 'installed') return false;
      if (filter === 'available' && item.record.state !== 'available') return false;
      if (filter === 'disabled' && item.record.state !== 'disabled') return false;
      if (filter === 'updates' && !(item.record.state === 'installed' && item.record.version !== item.app.version)) return false;
      if (q && ![item.app.name, item.app.description, item.app.id, item.app.category].some((value) => value.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [category, filter, modules, query]);

  const summary = useMemo(() => ({
    installed: modules.filter((item) => item.record.state === 'installed').length,
    available: modules.filter((item) => item.record.state === 'available').length,
    disabled: modules.filter((item) => item.record.state === 'disabled').length,
    updates: modules.filter((item) => item.record.state === 'installed' && item.record.version !== item.app.version).length,
  }), [modules]);

  const install = async (app: AppManifest) => {
    setError(null);
    try {
      await installBundledModule(app, (value) => setProgress((current) => ({ ...current, [app.id]: value })));
      setApps(getInstalledAppRegistry());
      setRevision((value) => value + 1);
      setTimeout(() => setProgress((current) => { const next = { ...current }; delete next[app.id]; return next; }), 900);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Module installation failed.'); }
  };

  const disable = (app: AppManifest) => {
    setError(null);
    try {
      setModuleEnabled(app, false);
      windows.filter((win) => win.appId === app.id).forEach((win) => closeWindow(win.id));
      setApps(getInstalledAppRegistry());
      setRevision((value) => value + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not disable module.'); }
  };

  const enable = (app: AppManifest) => {
    setError(null);
    try { setModuleEnabled(app, true); setApps(getInstalledAppRegistry()); setRevision((value) => value + 1); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not enable module.'); }
  };

  const remove = (app: AppManifest) => {
    if (!window.confirm(`Remove ${app.name} from this KobeOS installation? Its business data is not deleted.`)) return;
    setError(null);
    try {
      uninstallModule(app);
      windows.filter((win) => win.appId === app.id).forEach((win) => closeWindow(win.id));
      setApps(getInstalledAppRegistry());
      setRevision((value) => value + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not remove module.'); }
  };

  return (
    <div className="min-h-screen bg-[#080a12] text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#080a12]/95 px-5 py-4 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-900/30"><PackageOpen className="h-6 w-6" /></div>
            <div className="min-w-0 flex-1"><h1 className="text-xl font-extrabold">KobeOS App Store</h1><p className="text-xs text-slate-400">Verified modules from the same manifest registry used by the launcher</p></div>
            <div className="flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-extrabold text-emerald-300"><ShieldCheck className="h-3.5 w-3.5" />Core bundle integrity enabled</div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2"><FilterButton active={filter === 'all'} onClick={() => setFilter('all')} text={`All ${modules.length}`} /><FilterButton active={filter === 'installed'} onClick={() => setFilter('installed')} text={`Installed ${summary.installed}`} /><FilterButton active={filter === 'available'} onClick={() => setFilter('available')} text={`Available ${summary.available}`} /><FilterButton active={filter === 'disabled'} onClick={() => setFilter('disabled')} text={`Disabled ${summary.disabled}`} /><FilterButton active={filter === 'updates'} onClick={() => setFilter('updates')} text={`Updates ${summary.updates}`} /></div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-5">
        {error && <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"><AlertCircle className="h-4 w-4" />{error}</div>}
        <section className="mb-5 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-blue-600/20 via-violet-600/10 to-transparent p-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_420px] lg:items-center">
            <div><div className="mb-2 inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2.5 py-1 text-[10px] font-bold text-violet-300"><Sparkles className="h-3 w-3" />Manifest-driven modules</div><h2 className="max-w-xl text-2xl font-extrabold">Install, verify, disable, update, and open every KobeOS module.</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">Bundled modules require no internet download. KobeOS verifies their canonical manifest, registers the module, and refreshes the launcher immediately. Optional remote packages can use the same staged installer with streamed byte progress.</p></div>
            <div className="grid grid-cols-4 gap-2"><Summary label="Installed" value={summary.installed} /><Summary label="Available" value={summary.available} /><Summary label="Disabled" value={summary.disabled} /><Summary label="Updates" value={summary.updates} /></div>
          </div>
        </section>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[260px] flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search modules, categories, or capabilities" className="h-11 w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 text-sm outline-none focus:border-blue-500" /></div>
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-11 rounded-xl border border-white/10 bg-[#111420] px-3 text-sm text-slate-300 outline-none"><option value="all">All categories</option>{categories.filter((value) => value !== 'all').map((value) => <option key={value} value={value}>{categoryLabel[value] || value}</option>)}</select>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visible.map(({ app, record, sizeMb, core }) => {
          const task = progress[app.id];
          const installed = record.state === 'installed';
          const disabled = record.state === 'disabled';
          return <article key={app.id} className="group overflow-hidden rounded-2xl border border-white/10 bg-[#111420] transition hover:-translate-y-0.5 hover:border-blue-500/40 hover:shadow-xl hover:shadow-blue-950/20"><button onClick={() => setSelected(app)} className="w-full p-4 text-left"><div className="flex items-start gap-3"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 text-blue-300"><Box className="h-6 w-6" /></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="truncate font-extrabold">{app.name}</h3>{core && <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[8px] font-bold text-violet-300">CORE</span>}</div><div className="mt-0.5 text-[10px] text-slate-500">v{app.version} · {sizeMb} MB · {categoryLabel[app.category] || app.category}</div></div><ChevronRight className="h-4 w-4 text-slate-600 transition group-hover:translate-x-0.5" /></div><p className="mt-3 line-clamp-2 min-h-10 text-xs leading-relaxed text-slate-400">{app.description}</p><div className="mt-3 flex flex-wrap gap-1">{app.permissions.slice(0, 3).map((permission) => <span key={permission} className="rounded-full bg-white/5 px-2 py-0.5 text-[8px] text-slate-500">{permission}</span>)}{app.permissions.length > 3 && <span className="rounded-full bg-white/5 px-2 py-0.5 text-[8px] text-slate-500">+{app.permissions.length - 3}</span>}</div></button><div className="border-t border-white/10 p-3">{task ? <InstallProgress task={task} /> : <div className="flex items-center justify-between gap-2"><StateBadge state={record.state} integrity={record.integrity} />{installed ? <div className="flex gap-1"><button onClick={() => launchApp(app.id)} className="h-8 rounded-lg bg-blue-600 px-3 text-[10px] font-bold hover:bg-blue-500">Open</button>{!core && <button onClick={() => disable(app)} className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-slate-400" title="Disable"><PauseCircle className="h-3.5 w-3.5" /></button>}{!core && <button onClick={() => remove(app)} className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-rose-400" title="Remove"><Trash2 className="h-3.5 w-3.5" /></button>}</div> : disabled ? <div className="flex gap-1"><button onClick={() => enable(app)} className="h-8 rounded-lg bg-emerald-600 px-3 text-[10px] font-bold">Enable</button><button onClick={() => remove(app)} className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-rose-400"><Trash2 className="h-3.5 w-3.5" /></button></div> : <button onClick={() => void install(app)} className="inline-flex h-8 items-center gap-1 rounded-lg bg-blue-600 px-3 text-[10px] font-bold hover:bg-blue-500"><Download className="h-3 w-3" />Install</button>}</div>}</div></article>;
        })}</div>
        {!visible.length && <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-sm text-slate-500">No modules match this filter.</div>}
      </main>

      {selected && <ModuleDetails app={selected} record={getModuleRecord(selected)} onClose={() => setSelected(null)} onInstall={install} onOpen={() => launchApp(selected.id)} />}
    </div>
  );
}

function ModuleDetails({ app, record, onClose, onInstall, onOpen }: { app: AppManifest; record: ReturnType<typeof getModuleRecord>; onClose: () => void; onInstall: (app: AppManifest) => Promise<void>; onOpen: () => void }) { return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4"><div className="mx-auto my-8 max-w-2xl rounded-3xl border border-white/10 bg-[#111420] shadow-2xl"><div className="flex items-start gap-3 border-b border-white/10 p-5"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 text-blue-300"><Box className="h-7 w-7" /></div><div className="min-w-0 flex-1"><h2 className="text-xl font-extrabold">{app.name}</h2><div className="text-xs text-slate-500">{app.id} · v{app.version} · {categoryLabel[app.category] || app.category}</div></div><button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl bg-white/5"><X className="h-4 w-4" /></button></div><div className="space-y-5 p-5"><p className="text-sm leading-relaxed text-slate-300">{app.description}</p><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Detail label="State" value={record.state} /><Detail label="Version" value={app.version} /><Detail label="Size" value={`${moduleSize(app)} MB`} /><Detail label="Tier" value={app.subscriptionTier || 'free'} /></div><div><div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Permissions</div><div className="mt-2 flex flex-wrap gap-2">{app.permissions.length ? app.permissions.map((permission) => <span key={permission} className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] text-slate-300">{permission}</span>) : <span className="text-xs text-slate-500">No special permissions declared</span>}</div></div><div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4"><div className="flex items-center gap-2 text-sm font-extrabold text-emerald-300"><PackageCheck className="h-4 w-4" />Verified bundled module</div><p className="mt-1 text-xs text-emerald-200/70">The module is compiled into the KobeOS core package. Installation verifies its canonical manifest and persists launcher registration; business data remains separate from module installation state.</p>{record.integrity && <div className="mt-2 break-all font-mono text-[9px] text-emerald-400/60">SHA-256 {record.integrity}</div>}</div>{record.state === 'installed' ? <button onClick={onOpen} className="h-11 w-full rounded-xl bg-blue-600 font-extrabold hover:bg-blue-500">Open module</button> : <button onClick={() => void onInstall(app)} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 font-extrabold hover:bg-blue-500"><Download className="h-4 w-4" />Install module</button>}</div></div></div>; }
function InstallProgress({ task }: { task: ModuleProgress }) { return <div><div className="mb-2 flex items-center justify-between text-[10px]"><span className="inline-flex items-center gap-1 font-bold text-blue-300">{task.stage === 'ready' ? <Check className="h-3 w-3" /> : task.stage === 'failed' ? <AlertCircle className="h-3 w-3" /> : <Loader2 className="h-3 w-3 animate-spin" />}{task.message}</span><span className="font-mono text-slate-500">{task.progress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-white/5"><div className={`h-full rounded-full transition-all duration-300 ${task.stage === 'failed' ? 'bg-rose-500' : task.stage === 'ready' ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-500 to-violet-500'}`} style={{ width: `${task.progress}%` }} /></div><div className="mt-1 text-right text-[8px] text-slate-600">{task.bytesDone}/{task.bytesTotal} manifest bytes</div></div>; }
function StateBadge({ state, integrity }: { state: string; integrity: string }) { const cls = state === 'installed' ? 'bg-emerald-500/10 text-emerald-300' : state === 'disabled' ? 'bg-amber-500/10 text-amber-300' : 'bg-slate-500/10 text-slate-400'; return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-bold ${cls}`}>{state === 'installed' ? <Check className="h-3 w-3" /> : state === 'disabled' ? <PauseCircle className="h-3 w-3" /> : <Download className="h-3 w-3" />}{state}{integrity && state === 'installed' ? ' · verified' : ''}</span>; }
function FilterButton({ active, onClick, text }: { active: boolean; onClick: () => void; text: string }) { return <button onClick={onClick} className={`rounded-full px-3 py-1.5 text-[10px] font-bold transition ${active ? 'bg-white text-slate-900' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>{text}</button>; }
function Summary({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-center"><div className="text-xl font-extrabold">{value}</div><div className="text-[9px] font-bold uppercase text-slate-500">{label}</div></div>; }
function Detail({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-white/5 p-3"><div className="text-[9px] font-bold uppercase text-slate-500">{label}</div><div className="mt-1 truncate text-xs font-extrabold capitalize text-slate-200">{value}</div></div>; }
