import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  CheckCircle2,
  Clock3,
  Loader2,
  PackageCheck,
  RefreshCw,
  Search,
  Store,
  type LucideIcon,
  BriefcaseBusiness,
  Sparkles,
  ShoppingBag,
} from 'lucide-react';
import { getInstalledAppRegistry } from '@/os/registry';
import { useOSStore } from '@/os/store';
import type { AppCategory } from '@/os/types';
import { installBundledModule } from '@/os/module-installer';
import { CORE_APP_IDS, installMarketplaceApp, listAppEntitlements } from '@/lib/appMarketplace';
import {
  getModuleApps,
  getModulePrimaryApp,
  storeModules,
  type StoreModule,
} from '@/os/store-modules';

type StoreTab = 'discover' | 'installed';

const HIDDEN_MODULE_IDS = new Set([
  'app-store',
  'cargo-welcome',
  'package-manager',
  'system-settings',
]);

const CATEGORY_META: Record<AppCategory, { label: string; icon: LucideIcon; classes: string }> = {
  system: { label: 'System', icon: Boxes, classes: 'bg-slate-100 text-slate-700' },
  productivity: { label: 'Productivity', icon: BriefcaseBusiness, classes: 'bg-blue-50 text-blue-700' },
  media: { label: 'Media', icon: Sparkles, classes: 'bg-pink-50 text-pink-700' },
  development: { label: 'Development', icon: BriefcaseBusiness, classes: 'bg-violet-50 text-violet-700' },
  erp: { label: 'Business', icon: ShoppingBag, classes: 'bg-orange-50 text-orange-700' },
  games: { label: 'Games', icon: BriefcaseBusiness, classes: 'bg-emerald-50 text-emerald-700' },
  communication: { label: 'Communication', icon: BriefcaseBusiness, classes: 'bg-cyan-50 text-cyan-700' },
  sports: { label: 'Sports', icon: BriefcaseBusiness, classes: 'bg-lime-50 text-lime-700' },
  ai: { label: 'AI', icon: Sparkles, classes: 'bg-indigo-50 text-indigo-700' },
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function ModuleIcon({ module }: { module: StoreModule }) {
  const primary = getModulePrimaryApp(module.id);
  const meta = CATEGORY_META[module.category];
  const Icon = meta.icon;
  return (
    <div className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-2xl', meta.classes)} title={primary?.name ?? module.name}>
      <Icon className="h-5 w-5" />
    </div>
  );
}

function moduleIsInstalled(module: StoreModule, installedIds: string[]) {
  if (installedIds.includes(module.id)) return true;
  return module.appIds.some((id) => installedIds.includes(id));
}

export default function AppStore({
  onboarding = false,
  onComplete,
}: {
  onboarding?: boolean;
  onComplete?: () => void;
}) {
  const installedAppIds = useOSStore((state) => state.installedAppIds);
  const appEntitlements = useOSStore((state) => state.appEntitlements);
  const setAppEntitlements = useOSStore((state) => state.setAppEntitlements);
  const recordInstalledApp = useOSStore((state) => state.recordInstalledApp);
  const setApps = useOSStore((state) => state.setApps);

  const [tab, setTab] = useState<StoreTab>('discover');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<AppCategory | 'all'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [installing, setInstalling] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const catalogue = useMemo(
    () => storeModules.filter((module) =>
      !HIDDEN_MODULE_IDS.has(module.id) &&
      !CORE_APP_IDS.includes(module.id as typeof CORE_APP_IDS[number]),
    ),
    [],
  );

  useEffect(() => {
    let active = true;
    listAppEntitlements()
      .then((records) => { if (active) setAppEntitlements(records); })
      .catch(() => { if (active) setError('Kobe Cloud could not load your module library. Check the connection and retry.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [setAppEntitlements]);

  const filtered = useMemo(() => {
    const lower = query.trim().toLowerCase();
    return catalogue.filter((module) => {
      const installed = moduleIsInstalled(module, installedAppIds);
      const matchesTab = tab !== 'installed' || installed;
      const matchesCategory = category === 'all' || module.category === category;
      const haystack = `${module.name} ${module.description} ${module.features.join(' ')}`.toLowerCase();
      const matchesQuery = !lower || haystack.includes(lower);
      return matchesTab && matchesCategory && matchesQuery;
    });
  }, [catalogue, category, installedAppIds, query, tab]);

  const installModule = async (moduleId: string) => {
    const module = catalogue.find((candidate) => candidate.id === moduleId);
    if (!module) throw new Error(`Module ${moduleId} is not available in this KobeOS build.`);

    const apps = getModuleApps(module.id);
    if (!apps.length) throw new Error(`${module.name} has no bundled apps in this build.`);

    for (const app of apps) {
      await installBundledModule(app, () => undefined);
    }
    setApps(getInstalledAppRegistry());
    return installMarketplaceApp(module.id);
  };

  const installOne = async (moduleId: string) => {
    setInstalling((current) => new Set(current).add(moduleId));
    setError('');
    try {
      const record = await installModule(moduleId);
      recordInstalledApp(record);
      setSelected((current) => {
        const next = new Set(current);
        next.delete(moduleId);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not install ${moduleId}.`);
    } finally {
      setInstalling((current) => {
        const next = new Set(current);
        next.delete(moduleId);
        return next;
      });
    }
  };

  const installSelected = async () => {
    const targets = Array.from(selected).filter((moduleId) => {
      const module = catalogue.find((item) => item.id === moduleId);
      return module && !moduleIsInstalled(module, installedAppIds);
    });
    if (!targets.length) return;
    setInstalling(new Set(targets));
    setError('');
    const results = await Promise.allSettled(targets.map((id) => installModule(id)));
    results.forEach((result) => { if (result.status === 'fulfilled') recordInstalledApp(result.value); });
    const failed = results.filter((result) => result.status === 'rejected').length;
    if (failed) setError(`${failed} module${failed === 1 ? '' : 's'} could not be installed.`);
    setSelected(new Set());
    setInstalling(new Set());
  };

  const toggleSelected = (moduleId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(catalogue.filter((module) => !moduleIsInstalled(module, installedAppIds)).map((module) => module.id)));
  };

  const installedCount = catalogue.filter((module) => moduleIsInstalled(module, installedAppIds)).length;

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-[#eef1f6] text-[#0a1728]" data-module="app-store">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#0a1728] text-white"><Store className="h-5 w-5" /></span>
            <div>
              <p className="text-sm font-black tracking-tight">KobeOS App Store</p>
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">Business modules · one install · one subscription</p>
            </div>
          </div>
          {onboarding && (
            <button onClick={onComplete} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0a1728] px-4 text-xs font-black text-white">
              Continue to desktop <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="mx-auto flex max-w-[1500px] gap-1 px-4 md:px-6">
          <button onClick={() => setTab('discover')} className={cn('relative flex items-center gap-2 px-4 py-3 text-xs font-black', tab === 'discover' ? 'text-[#0a1728]' : 'text-slate-400')}>
            <ShoppingBag className="h-4 w-4" /> Modules
            {tab === 'discover' && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#ff7616]" />}
          </button>
          <button onClick={() => setTab('installed')} className={cn('relative flex items-center gap-2 px-4 py-3 text-xs font-black', tab === 'installed' ? 'text-[#0a1728]' : 'text-slate-400')}>
            <PackageCheck className="h-4 w-4" /> Installed ({installedCount})
            {tab === 'installed' && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#ff7616]" />}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] p-4 md:p-6">
        {onboarding && tab === 'discover' && (
          <section className="mb-5 overflow-hidden rounded-[26px] bg-[#071321] p-6 text-white">
            <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-black text-emerald-300">
                  <BadgeCheck className="h-3.5 w-3.5" /> ACCOUNT CONNECTED
                </span>
                <h1 className="mt-4 text-3xl font-black tracking-[-0.04em]">Choose the business modules you need.</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                  A module contains all of its screens and tools. You no longer install POS, warehouse, reports or other parts separately when they belong to the same module.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-4">
                <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.16em] text-slate-500"><Clock3 className="h-3.5 w-3.5" /> Trial</p>
                <p className="mt-2 text-sm font-black">14 days per module</p>
                <p className="mt-1 text-[10px] text-slate-500">Billing follows the module, not its internal features.</p>
              </div>
            </div>
          </section>
        )}

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search KobeOS modules" className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold outline-none focus:border-[#ff7616]" />
            </div>
            <div className="flex gap-1 overflow-x-auto">
              <button onClick={() => setCategory('all')} className={cn('shrink-0 rounded-lg px-3 py-2 text-[10px] font-black', category === 'all' ? 'bg-[#0a1728] text-white' : 'bg-slate-100 text-slate-500')}>All</button>
              {(Object.keys(CATEGORY_META) as AppCategory[]).map((id) => (
                <button key={id} onClick={() => setCategory(id)} className={cn('shrink-0 rounded-lg px-3 py-2 text-[10px] font-black', category === id ? 'bg-[#0a1728] text-white' : 'bg-slate-100 text-slate-500')}>{CATEGORY_META[id].label}</button>
              ))}
            </div>
            {tab === 'discover' && <button onClick={selectAll} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black"><CheckCircle2 className="h-4 w-4" /> Select all</button>}
          </div>
        </section>

        {error && (
          <div className="mb-5 flex items-center justify-between rounded-2xl border border-red-100 bg-red-50 p-4 text-xs font-bold text-red-700">
            <span>{error}</span>
            <button onClick={() => window.location.reload()} className="rounded-lg p-2 hover:bg-red-100"><RefreshCw className="h-4 w-4" /></button>
          </div>
        )}

        {loading ? (
          <div className="grid min-h-72 place-items-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-14 text-center"><Search className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-black">No modules found</p></div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((module) => {
              const installed = moduleIsInstalled(module, installedAppIds);
              const record = appEntitlements[module.id] ?? module.appIds.map((id) => appEntitlements[id]).find(Boolean);
              const isInstalling = installing.has(module.id);
              const isSelected = selected.has(module.id);
              return (
                <article key={module.id} className={cn('rounded-2xl border bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-lg', isSelected ? 'border-[#ff7616] ring-2 ring-orange-100' : 'border-slate-200')}>
                  <div className="flex items-start gap-3">
                    <ModuleIcon module={module} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-black">{module.name}</h3>
                          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{CATEGORY_META[module.category].label} · v{module.version}</p>
                        </div>
                        {record ? (
                          <span className={cn('rounded-full px-2 py-1 text-[9px] font-black', record.access === 'active' ? 'bg-emerald-50 text-emerald-700' : record.access === 'trial' ? 'bg-orange-50 text-orange-700' : 'bg-slate-100 text-slate-600')}>
                            {record.access === 'trial' ? `Trial · ${record.daysRemaining}d` : record.access}
                          </span>
                        ) : installed ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700">Installed</span> : null}
                      </div>
                      <p className="mt-3 min-h-10 text-xs leading-5 text-slate-500">{module.description}</p>
                      {module.features.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {module.features.slice(0, 6).map((feature) => <span key={feature} className="rounded-lg bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-600">{feature}</span>)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4">
                    {installed ? (
                      <div className="flex flex-1 items-center gap-2 text-xs font-black text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Module installed</div>
                    ) : (
                      <>
                        <button onClick={() => toggleSelected(module.id)} className={cn('h-10 flex-1 rounded-xl border text-xs font-black', isSelected ? 'border-[#ff7616] bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-600')}>{isSelected ? 'Selected' : 'Select'}</button>
                        <button onClick={() => void installOne(module.id)} disabled={isInstalling} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#0a1728] px-4 text-xs font-black text-white disabled:opacity-50">
                          {isInstalling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Store className="h-4 w-4" />} Install
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {selected.size > 0 && (
        <div className="sticky bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3">
            <p className="text-xs font-black">{selected.size} module{selected.size === 1 ? '' : 's'} selected</p>
            <button onClick={() => void installSelected()} disabled={installing.size > 0} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#ff7616] px-5 text-xs font-black text-white disabled:opacity-50">
              {installing.size > 0 ? <Loader2 className="h-4 w-4 animate-spin" /> : <Store className="h-4 w-4" />} Install selected modules
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ModuleDetails({ app, record, onClose, onInstall, onOpen }: { app: AppManifest; record: ReturnType<typeof getModuleRecord>; onClose: () => void; onInstall: (app: AppManifest) => Promise<void>; onOpen: () => void }) { return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4"><div className="mx-auto my-8 max-w-2xl rounded-3xl border border-white/10 bg-[#111420] shadow-2xl"><div className="flex items-start gap-3 border-b border-white/10 p-5"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 text-blue-300"><Box className="h-7 w-7" /></div><div className="min-w-0 flex-1"><h2 className="text-xl font-extrabold">{app.name}</h2><div className="text-xs text-slate-500">{app.id} · v{app.version} · {categoryLabel[app.category] || app.category}</div></div><button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl bg-white/5"><X className="h-4 w-4" /></button></div><div className="space-y-5 p-5"><p className="text-sm leading-relaxed text-slate-300">{app.description}</p><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Detail label="State" value={record.state} /><Detail label="Version" value={app.version} /><Detail label="Size" value={`${moduleSize(app)} MB`} /><Detail label="Tier" value={app.subscriptionTier || 'free'} /></div><div><div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Permissions</div><div className="mt-2 flex flex-wrap gap-2">{app.permissions.length ? app.permissions.map((permission) => <span key={permission} className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] text-slate-300">{permission}</span>) : <span className="text-xs text-slate-500">No special permissions declared</span>}</div></div><div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4"><div className="flex items-center gap-2 text-sm font-extrabold text-emerald-300"><PackageCheck className="h-4 w-4" />Verified bundled module</div><p className="mt-1 text-xs text-emerald-200/70">The module is compiled into the KobeOS core package. Installation verifies its canonical manifest and persists launcher registration; business data remains separate from module installation state.</p>{record.integrity && <div className="mt-2 break-all font-mono text-[9px] text-emerald-400/60">SHA-256 {record.integrity}</div>}</div>{record.state === 'installed' ? <button onClick={onOpen} className="h-11 w-full rounded-xl bg-blue-600 font-extrabold hover:bg-blue-500">Open module</button> : <button onClick={() => void onInstall(app)} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 font-extrabold hover:bg-blue-500"><Download className="h-4 w-4" />Install module</button>}</div></div></div>; }
function InstallProgress({ task }: { task: ModuleProgress }) { return <div><div className="mb-2 flex items-center justify-between text-[10px]"><span className="inline-flex items-center gap-1 font-bold text-blue-300">{task.stage === 'ready' ? <Check className="h-3 w-3" /> : task.stage === 'failed' ? <AlertCircle className="h-3 w-3" /> : <Loader2 className="h-3 w-3 animate-spin" />}{task.message}</span><span className="font-mono text-slate-500">{task.progress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-white/5"><div className={`h-full rounded-full transition-all duration-300 ${task.stage === 'failed' ? 'bg-rose-500' : task.stage === 'ready' ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-500 to-violet-500'}`} style={{ width: `${task.progress}%` }} /></div><div className="mt-1 text-right text-[8px] text-slate-600">{task.bytesDone}/{task.bytesTotal} manifest bytes</div></div>; }
function StateBadge({ state, integrity }: { state: string; integrity: string }) { const cls = state === 'installed' ? 'bg-emerald-500/10 text-emerald-300' : state === 'disabled' ? 'bg-amber-500/10 text-amber-300' : 'bg-slate-500/10 text-slate-400'; return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-bold ${cls}`}>{state === 'installed' ? <Check className="h-3 w-3" /> : state === 'disabled' ? <PauseCircle className="h-3 w-3" /> : <Download className="h-3 w-3" />}{state}{integrity && state === 'installed' ? ' · verified' : ''}</span>; }
function FilterButton({ active, onClick, text }: { active: boolean; onClick: () => void; text: string }) { return <button onClick={onClick} className={`rounded-full px-3 py-1.5 text-[10px] font-bold transition ${active ? 'bg-white text-slate-900' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>{text}</button>; }
function Summary({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-center"><div className="text-xl font-extrabold">{value}</div><div className="text-[9px] font-bold uppercase text-slate-500">{label}</div></div>; }
function Detail({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-white/5 p-3"><div className="text-[9px] font-bold uppercase text-slate-500">{label}</div><div className="mt-1 truncate text-xs font-extrabold capitalize text-slate-200">{value}</div></div>; }
