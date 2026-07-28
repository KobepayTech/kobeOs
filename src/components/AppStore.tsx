import { useEffect, useMemo, useState } from 'react';
import {
  AppWindow,
  ArrowRight,
  BadgeCheck,
  Box,
  Boxes,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Code2,
  Copy,
  Download,
  Gamepad2,
  KeyRound,
  Loader2,
  PackageCheck,
  RefreshCw,
  RotateCw,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  Terminal,
  Users,
  WandSparkles,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { appRegistry } from '@/os/registry';
import { useOSStore } from '@/os/store';
import type { AppCategory, AppManifest } from '@/os/types';
import {
  CORE_APP_IDS,
  createDeveloperProject,
  installMarketplaceApp,
  listAppEntitlements,
  listDeveloperProjects,
  rotateDeveloperProjectKey,
  type AppEntitlementSnapshot,
  type DeveloperProject,
} from '@/lib/appMarketplace';
import { API_BASE } from '@/lib/api';

type StoreTab = 'discover' | 'installed' | 'develop';

const HIDDEN_APP_IDS = new Set([
  'cargo-welcome',
]);

const CATEGORY_META: Record<AppCategory, { label: string; icon: LucideIcon; color: string }> = {
  system: { label: 'System', icon: Box, color: 'bg-slate-100 text-slate-700' },
  productivity: { label: 'Productivity', icon: AppWindow, color: 'bg-blue-50 text-blue-700' },
  media: { label: 'Media', icon: WandSparkles, color: 'bg-pink-50 text-pink-700' },
  development: { label: 'Development', icon: Code2, color: 'bg-violet-50 text-violet-700' },
  erp: { label: 'Business', icon: Boxes, color: 'bg-orange-50 text-orange-700' },
  games: { label: 'Games', icon: Gamepad2, color: 'bg-emerald-50 text-emerald-700' },
  communication: { label: 'Communication', icon: Users, color: 'bg-cyan-50 text-cyan-700' },
  sports: { label: 'Sports', icon: Zap, color: 'bg-lime-50 text-lime-700' },
  ai: { label: 'AI', icon: BrainCircuit, color: 'bg-indigo-50 text-indigo-700' },
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function AppIcon({ app, size = 'md' }: { app: AppManifest; size?: 'sm' | 'md' | 'lg' }) {
  const meta = CATEGORY_META[app.category];
  const Icon = meta.icon;
  const sizes = {
    sm: 'h-9 w-9 rounded-xl',
    md: 'h-12 w-12 rounded-2xl',
    lg: 'h-16 w-16 rounded-[20px]',
  };
  return (
    <span className={cn('flex shrink-0 items-center justify-center', sizes[size], meta.color)}>
      <Icon className={size === 'lg' ? 'h-7 w-7' : size === 'md' ? 'h-5 w-5' : 'h-4 w-4'} />
    </span>
  );
}

function StatusPill({ record }: { record?: AppEntitlementSnapshot }) {
  if (!record) return <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black text-slate-500">Not installed</span>;
  if (record.access === 'active') {
    return <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700">Paid · {record.daysRemaining}d</span>;
  }
  if (record.access === 'trial') {
    return <span className="rounded-full bg-orange-50 px-2 py-1 text-[9px] font-black text-orange-700">Trial · {record.daysRemaining}d</span>;
  }
  if (record.access === 'pending') {
    return <span className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-black text-blue-700">Payment pending</span>;
  }
  return <span className="rounded-full bg-red-50 px-2 py-1 text-[9px] font-black text-red-700">Trial expired</span>;
}

function StoreButton({
  children,
  variant = 'primary',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'dark' | 'ghost';
}) {
  const variants = {
    primary: 'bg-[#ff7616] text-white hover:bg-[#e96509]',
    secondary: 'border border-slate-200 bg-white text-[#0a1728] hover:bg-slate-50',
    dark: 'bg-[#0a1728] text-white hover:bg-[#14253b]',
    ghost: 'text-slate-600 hover:bg-slate-100',
  };
  return (
    <button
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-45',
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function DeveloperWorkspace() {
  const [projects, setProjects] = useState<DeveloperProject[]>([]);
  const [name, setName] = useState('');
  const [origin, setOrigin] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [secretKey, setSecretKey] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const refresh = async () => {
    setLoading(true);
    try {
      setProjects(await listDeveloperProjects());
      setError('');
    } catch {
      setError('Developer projects could not be loaded. Confirm Kobe Cloud is online.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const createProject = async () => {
    if (!name.trim()) {
      setError('Enter a project name.');
      return;
    }
    setCreating(true);
    try {
      const result = await createDeveloperProject(
        name.trim(),
        origin.trim() ? [origin.trim()] : [],
      );
      setProjects((current) => [result.project, ...current]);
      setSecretKey(result.apiKey);
      setName('');
      setOrigin('');
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Project creation failed.');
    } finally {
      setCreating(false);
    }
  };

  const rotate = async (projectId: string) => {
    if (!window.confirm('Rotate this API key? The current key will stop working immediately.')) return;
    try {
      const result = await rotateDeveloperProjectKey(projectId);
      setProjects((current) => current.map((project) =>
        project.id === projectId ? result.project : project
      ));
      setSecretKey(result.apiKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Key rotation failed.');
    }
  };

  const copy = async (value: string, label: string) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(''), 1600);
    } catch {
      // Electron file:// builds and non-secure HTTP previews may not expose
      // navigator.clipboard. Keep API-key copying usable in those environments.
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const copiedSuccessfully = document.execCommand('copy');
      textarea.remove();
      if (copiedSuccessfully) {
        setCopied(label);
        window.setTimeout(() => setCopied(''), 1600);
      } else {
        setError('Clipboard access is unavailable. Select and copy the value manually.');
      }
    }
  };

  const developerApiBase =
    (import.meta.env.VITE_DEVELOPER_API_BASE as string | undefined) ??
    (API_BASE.startsWith('/') ? `${window.location.origin}${API_BASE}` : API_BASE);
  const codeExample = `const response = await fetch("${developerApiBase}/developer/v1/chat", {
  method: "POST",
  headers: {
    "Authorization": "Bearer kobe_sk_...",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    prompt: "Summarize today's sales",
    system: "You are a concise business assistant."
  })
});

const { content } = await response.json();`;

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[26px] bg-[#071321] p-6 text-white">
        <div className="absolute -right-20 -top-32 h-72 w-72 rounded-full bg-indigo-500/25 blur-3xl" />
        <div className="relative grid gap-6 xl:grid-cols-[1.2fr_.8fr] xl:items-end">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1 text-[10px] font-black text-indigo-200">
              <Sparkles className="h-3.5 w-3.5" /> KOBE AI PLATFORM
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-[-0.04em]">Build web apps on Kobe intelligence.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Create a project, receive a scoped API key, and call chat, embeddings and code-generation endpoints from your web app.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              [BrainCircuit, 'Chat'],
              [Boxes, 'Embeddings'],
              [Code2, 'Code'],
            ].map(([Icon, label]) => {
              const CapabilityIcon = Icon as LucideIcon;
              return (
                <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-center">
                  <CapabilityIcon className="mx-auto h-5 w-5 text-[#ff8a3a]" />
                  <p className="mt-2 text-[10px] font-black">{String(label)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {secretKey && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black text-amber-900">Copy your new key now</p>
              <p className="mt-1 text-[10px] leading-4 text-amber-700">For security, KobeOS will not show this full key again.</p>
            </div>
            <button onClick={() => setSecretKey('')} className="rounded-lg p-1 text-amber-600 hover:bg-amber-100"><X className="h-4 w-4" /></button>
          </div>
          <div className="mt-4 flex gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-xl bg-[#0a1728] px-4 py-3 text-xs font-bold text-emerald-300">{secretKey}</code>
            <StoreButton variant="dark" onClick={() => copy(secretKey, 'secret')}>
              {copied === 'secret' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copy
            </StoreButton>
          </div>
        </section>
      )}

      <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ff7616]">New project</p>
          <h3 className="mt-2 text-lg font-black">Create developer credentials</h3>
          <div className="mt-5 space-y-3">
            <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
              Project name
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="My commerce assistant" className="mt-2 h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#ff7616]" />
            </label>
            <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
              Allowed web origin
              <input value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder="https://myapp.com" className="mt-2 h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#ff7616]" />
            </label>
          </div>
          {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[10px] font-bold text-red-700">{error}</p>}
          <StoreButton className="mt-4 w-full" onClick={createProject} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Generate API key
          </StoreButton>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ff7616]">Quick start</p>
              <h3 className="mt-2 text-lg font-black">Call Kobe AI from JavaScript</h3>
            </div>
            <StoreButton variant="secondary" onClick={() => copy(codeExample, 'code')}>
              {copied === 'code' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copy
            </StoreButton>
          </div>
          <pre className="max-h-[340px] overflow-auto bg-[#071321] p-5 text-[11px] leading-5 text-slate-300"><code>{codeExample}</code></pre>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ff7616]">Your projects</p>
            <h3 className="mt-2 text-lg font-black">API access and usage</h3>
          </div>
          <StoreButton variant="secondary" onClick={refresh}><RefreshCw className="h-4 w-4" /> Refresh</StoreButton>
        </div>
        {loading ? (
          <div className="flex items-center justify-center p-12 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : projects.length === 0 ? (
          <div className="p-10 text-center"><Terminal className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-black">No developer projects yet</p><p className="mt-1 text-xs text-slate-400">Create one to receive your first API key.</p></div>
        ) : (
          <div className="divide-y divide-slate-100">
            {projects.map((project) => (
              <div key={project.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                <div className="flex items-center gap-3">
                  <span className="rounded-xl bg-indigo-50 p-2.5 text-indigo-700"><Code2 className="h-4 w-4" /></span>
                  <div>
                    <p className="text-xs font-black">{project.name}</p>
                    <p className="mt-1 font-mono text-[9px] text-slate-400">{project.keyPrefix} · {project.slug}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black">{project.usageCount.toLocaleString()}</p>
                  <p className="text-[9px] text-slate-400">API calls</p>
                </div>
                <StoreButton variant="secondary" onClick={() => rotate(project.id)}><RotateCw className="h-3.5 w-3.5" /> Rotate key</StoreButton>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
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
  const [tab, setTab] = useState<StoreTab>(onboarding ? 'discover' : 'discover');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<AppCategory | 'all'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [installing, setInstalling] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const catalog = useMemo(() =>
    appRegistry.filter((app) => !HIDDEN_APP_IDS.has(app.id) && !CORE_APP_IDS.includes(app.id as typeof CORE_APP_IDS[number])),
  []);

  useEffect(() => {
    let active = true;
    listAppEntitlements()
      .then((records) => {
        if (active) setAppEntitlements(records);
      })
      .catch(() => {
        if (active) setError('Kobe Cloud could not load your app library. Check the internet connection and retry.');
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [setAppEntitlements]);

  const filtered = useMemo(() => {
    const lower = query.trim().toLowerCase();
    return catalog.filter((app) => {
      const matchesTab = tab !== 'installed' || installedAppIds.includes(app.id);
      const matchesCategory = category === 'all' || app.category === category;
      const matchesQuery = !lower ||
        app.name.toLowerCase().includes(lower) ||
        app.description.toLowerCase().includes(lower);
      return matchesTab && matchesCategory && matchesQuery;
    });
  }, [catalog, category, installedAppIds, query, tab]);

  const toggleSelected = (appId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(appId)) next.delete(appId);
      else next.add(appId);
      return next;
    });
  };

  const installOne = async (appId: string) => {
    setInstalling((current) => new Set(current).add(appId));
    setError('');
    try {
      const record = await installMarketplaceApp(appId);
      recordInstalledApp(record);
      setSelected((current) => {
        const next = new Set(current);
        next.delete(appId);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not install ${appId}.`);
    } finally {
      setInstalling((current) => {
        const next = new Set(current);
        next.delete(appId);
        return next;
      });
    }
  };

  const installSelected = async () => {
    const targets = Array.from(selected).filter((appId) => !installedAppIds.includes(appId));
    if (!targets.length) return;
    setInstalling(new Set(targets));
    setError('');
    const results = await Promise.allSettled(targets.map((appId) => installMarketplaceApp(appId)));
    results.forEach((result) => {
      if (result.status === 'fulfilled') recordInstalledApp(result.value);
    });
    const failed = results.filter((result) => result.status === 'rejected').length;
    if (failed) setError(`${failed} app${failed === 1 ? '' : 's'} could not be installed. Confirm the internet connection and retry.`);
    setSelected(new Set());
    setInstalling(new Set());
  };

  const selectAll = () => {
    const uninstalled = catalog
      .filter((app) => !installedAppIds.includes(app.id))
      .map((app) => app.id);
    setSelected(new Set(uninstalled));
  };

  const finish = () => {
    onComplete?.();
  };

  return (
    <div
      className="h-full min-h-0 overflow-y-auto bg-[#eef1f6] text-[#0a1728]"
      data-module="app-store"
      style={{
        '--bg-input': '#ffffff',
        '--border-secondary': '#cbd5e1',
        '--border-focus': '#ff7616',
        '--text-primary': '#0a1728',
        '--text-placeholder': '#94a3b8',
      } as React.CSSProperties}
    >
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0a1728] text-white"><Store className="h-5 w-5" /></span>
            <div>
              <p className="text-sm font-black tracking-tight">KobeOS App Store</p>
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">Install · Trial · Build</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onboarding && (
              <span className="hidden items-center gap-2 rounded-full bg-orange-50 px-3 py-2 text-[10px] font-black text-orange-700 sm:flex">
                <Clock3 className="h-3.5 w-3.5" /> Trials start when installed
              </span>
            )}
            {onboarding && (
              <StoreButton variant="dark" onClick={finish}>
                Continue to desktop <ArrowRight className="h-4 w-4" />
              </StoreButton>
            )}
          </div>
        </div>
        <div className="mx-auto flex max-w-[1500px] gap-1 px-4 md:px-6">
          {([
            ['discover', 'Discover apps', ShoppingBag],
            ['installed', `Installed (${Math.max(0, installedAppIds.length - CORE_APP_IDS.length)})`, PackageCheck],
            ['develop', 'Build with Kobe AI', Code2],
          ] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} className={cn('relative flex items-center gap-2 px-4 py-3 text-xs font-black', tab === id ? 'text-[#0a1728]' : 'text-slate-400 hover:text-slate-600')}>
              <Icon className="h-4 w-4" /> {label}
              {tab === id && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#ff7616]" />}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] p-4 md:p-6">
        {tab === 'develop' ? (
          <DeveloperWorkspace />
        ) : (
          <>
            {onboarding && tab === 'discover' && (
              <section className="mb-5 overflow-hidden rounded-[26px] bg-[#071321] p-6 text-white">
                <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
                  <div>
                    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-black text-emerald-300">
                      <BadgeCheck className="h-3.5 w-3.5" /> ACCOUNT CONNECTED
                    </span>
                    <h1 className="mt-4 text-3xl font-black tracking-[-0.04em]">Choose the apps you want to install.</h1>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                      Every app receives its own 14-day trial. Installing another app later starts a new trial only for that app.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">After trial</p>
                    <p className="mt-2 text-sm font-black">TZS 25,000 or USD 10 / app</p>
                    <p className="mt-1 text-[10px] text-slate-500">30 days · PayPal or PalmPesa</p>
                  </div>
                </div>
              </section>
            )}

            <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search all KobeOS apps" className="h-10 rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold outline-none focus:border-[#ff7616]" />
                </div>
                <div className="flex gap-1 overflow-x-auto">
                  <button onClick={() => setCategory('all')} className={cn('shrink-0 rounded-lg px-3 py-2 text-[10px] font-black', category === 'all' ? 'bg-[#0a1728] text-white' : 'bg-slate-100 text-slate-500')}>All</button>
                  {(Object.keys(CATEGORY_META) as AppCategory[]).map((id) => (
                    <button key={id} onClick={() => setCategory(id)} className={cn('shrink-0 rounded-lg px-3 py-2 text-[10px] font-black', category === id ? 'bg-[#0a1728] text-white' : 'bg-slate-100 text-slate-500')}>{CATEGORY_META[id].label}</button>
                  ))}
                </div>
                {tab === 'discover' && (
                  <StoreButton variant="secondary" onClick={selectAll}><CheckCircle2 className="h-4 w-4" /> Select all apps</StoreButton>
                )}
              </div>
            </section>

            {error && (
              <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-xs font-bold text-red-700">
                <span>{error}</span>
                <button onClick={() => window.location.reload()} className="rounded-lg p-2 hover:bg-red-100"><RefreshCw className="h-4 w-4" /></button>
              </div>
            )}

            {loading ? (
              <div className="flex min-h-72 items-center justify-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-14 text-center"><Search className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-black">No apps found</p><p className="mt-1 text-xs text-slate-400">Try another search or category.</p></div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filtered.map((app) => {
                  const installed = installedAppIds.includes(app.id);
                  const record = appEntitlements[app.id];
                  const isInstalling = installing.has(app.id);
                  const isSelected = selected.has(app.id);
                  return (
                    <article key={app.id} className={cn('group rounded-2xl border bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-lg', isSelected ? 'border-[#ff7616] ring-2 ring-orange-100' : 'border-slate-200')}>
                      <div className="flex items-start gap-3">
                        <AppIcon app={app} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="truncate text-sm font-black">{app.name}</h3>
                              <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-slate-400">{CATEGORY_META[app.category].label} · v{app.version}</p>
                            </div>
                            <StatusPill record={record} />
                          </div>
                          <p className="mt-3 line-clamp-2 min-h-8 text-[10px] leading-4 text-slate-500">{app.description}</p>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                        <div>
                          <p className="text-[9px] font-black text-[#ff7616]">14-day trial</p>
                          <p className="mt-0.5 text-[9px] text-slate-400">then TZS 25,000 / month</p>
                        </div>
                        {installed ? (
                          <span className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-50 px-3 text-[10px] font-black text-emerald-700"><Check className="h-3.5 w-3.5" /> Installed</span>
                        ) : onboarding ? (
                          <button onClick={() => toggleSelected(app.id)} className={cn('flex h-9 w-9 items-center justify-center rounded-xl border transition', isSelected ? 'border-[#ff7616] bg-[#ff7616] text-white' : 'border-slate-200 text-slate-400 hover:border-slate-300')}>
                            {isSelected ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                          </button>
                        ) : (
                          <StoreButton onClick={() => installOne(app.id)} disabled={isInstalling}>
                            {isInstalling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Install
                          </StoreButton>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      {onboarding && tab !== 'develop' && (
        <footer className="sticky bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-1 md:px-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-[#ff7616]"><Download className="h-4 w-4" /></span>
              <div><p className="text-xs font-black">{selected.size} app{selected.size === 1 ? '' : 's'} selected</p><p className="mt-0.5 text-[9px] text-slate-400">Each trial starts when installation completes.</p></div>
            </div>
            <div className="flex gap-2">
              <StoreButton variant="secondary" onClick={finish}>Skip for now</StoreButton>
              <StoreButton onClick={installSelected} disabled={!selected.size || installing.size > 0}>
                {installing.size > 0 ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Install selected
                <ChevronRight className="h-4 w-4" />
              </StoreButton>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
