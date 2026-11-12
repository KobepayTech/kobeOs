import { lazy, Suspense, useEffect, useState } from 'react';
import { ArrowUpRight, BarChart3, Boxes, Camera, ClipboardCheck, Globe, LayoutDashboard, LogOut, Receipt, ShoppingCart, Sparkles, Truck, Users } from 'lucide-react';
import LoginScreen from '@/components/LoginScreen';
import { ApiError, getRefreshToken, getToken } from '@/lib/api';
import { logout } from '@/lib/auth';
import { action, field, retailApi, tile, RetailDiscounts, RetailOrders, RetailStock, RetailTeam } from './ShopPanels';

const Catalog = lazy(() => import('@/apps/erp-store'));
const PhotoIntake = lazy(() => import('@/apps/media-inbox'));
const Purchasing = lazy(() => import('@/apps/erp-sourcing'));
const Reports = lazy(() => import('@/apps/erp-dashboard'));
const Agents = lazy(() => import('@/apps/kobe-agents'));
const POS = lazy(() => import('@/mobile/MobilePOS'));
const StoreEditor = lazy(() => import('@/apps/erp-store-editor'));

interface Overview {
  name: string;
  slug: string;
  role: 'owner' | 'manager' | 'staff';
  published: boolean;
  canManageTeam: boolean;
  inventory: { skus: number; units: number; low: number };
  pendingOrders: number;
  pendingApprovals: number;
  localServer: { status: string; lastSeenAt: string | null } | null;
  linked: { domainSlug: string; storeName: string }[];
}

const NAV = [
  { id: 'overview', label: 'Overview', Icon: LayoutDashboard },
  { id: 'stock', label: 'Stock', Icon: Boxes },
  { id: 'orders', label: 'Orders', Icon: Receipt },
  { id: 'discounts', label: 'Discounts', Icon: ClipboardCheck },
  { id: 'upload', label: 'Guided photo upload', Icon: Camera, owner: true },
  { id: 'catalog', label: 'Catalog', Icon: Boxes, owner: true },
  { id: 'purchasing', label: 'China purchasing', Icon: Truck, owner: true },
  { id: 'pos', label: 'Point of sale', Icon: ShoppingCart, owner: true },
  { id: 'reports', label: 'Profit & reports', Icon: BarChart3, owner: true },
  { id: 'agents', label: 'AI agents', Icon: Sparkles, owner: true },
  { id: 'channels', label: 'Storefront & webapps', Icon: Globe, owner: true },
  { id: 'team', label: 'Team access', Icon: Users, owner: true },
];

export default function RetailWorkspace({ slug, basePath }: { slug: string; basePath: string }) {
  const [signedIn, setSignedIn] = useState(() => !!(getToken() || getRefreshToken()));
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const requested = new URLSearchParams(window.location.search).get('panel') || 'overview';
  const panelHref = (panel: string) => `${basePath}?panel=${panel}`;

  useEffect(() => {
    if (!signedIn) return;
    const abort = new AbortController();
    retailApi<Overview>('', slug, { signal: abort.signal }).then(setOverview).catch(reason => {
      if (abort.signal.aborted) return;
      if (reason instanceof ApiError && reason.status === 401) setSignedIn(false);
      else setError(reason instanceof Error ? reason.message : 'Unable to reach KobeOS Cloud.');
    });
    return () => abort.abort();
  }, [signedIn, slug, attempt]);

  if (!signedIn) return <LoginScreen initialMode="signin" onLogin={() => {
    setError(''); setOverview(null); setSignedIn(true);
  }} />;

  const signOut = async () => {
    await logout();
    setOverview(null);
    setError('');
    setSignedIn(false);
  };

  if (!overview) return (
    <main className="grid min-h-dvh place-items-center bg-slate-100 p-5 text-slate-900">
      <div className={tile}>
        <h1 className="text-xl font-bold">KobeOS Retail Workspace</h1>
        <p className="my-3 text-sm text-slate-600" role={error ? 'alert' : 'status'}>{error || 'Verifying your account and shop access…'}</p>
        {error && <div className="flex flex-wrap gap-3">
          <button className={action} onClick={() => { setError(''); setAttempt(value => value + 1); }}>Retry</button>
          <a className="self-center text-sm font-semibold text-indigo-700" href="/erp">My workspaces</a>
          <button className="text-sm font-semibold text-slate-700" onClick={() => void signOut()}>Sign out</button>
        </div>}
      </div>
    </main>
  );

  const isOwner = overview.role === 'owner';
  const localSeen = overview.localServer?.lastSeenAt;
  const localStatus = !localSeen ? 'Local heartbeat unavailable'
    : overview.localServer?.status === 'active' && Date.now() - Date.parse(localSeen) < 600_000
      ? 'Local server online' : 'Local server offline';
  const visible = NAV.filter(item => !item.owner || isOwner);
  const panel = visible.find(item => item.id === requested);
  const storeUrl = overview.slug && overview.published ? `/shop/${encodeURIComponent(overview.slug)}` : '';
  const body = (() => {
    switch (panel?.id) {
      case 'overview':
        return <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              ['Stock on hand', overview.inventory.units, 'stock'],
              ['Low stock SKUs', overview.inventory.low, 'stock'],
              ['Pending orders', overview.pendingOrders, 'orders'],
              [isOwner ? 'Pending approvals' : 'My pending requests', overview.pendingApprovals, 'discounts'],
            ].map(([label, value, route]) => <a key={label} href={panelHref(String(route))} className={tile}>
              <p className="text-sm font-semibold text-slate-600">{label}</p>
              <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight">{Number(value).toLocaleString('en-TZ')}</p>
            </a>)}
          </div>
          {isOwner && <section className="rounded-xl bg-indigo-950 p-5 text-white sm:p-7">
            <h2 className="text-xl font-bold">From photo to sale</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {[['Upload & answer questions', 'upload'], ['Review products & prices', 'catalog'], ['Manage storefront', 'channels'], ['Track orders', 'orders']].map(([label, route]) =>
                <a className="flex items-center justify-between gap-2 rounded-lg border border-white/20 bg-white/10 p-3 text-sm font-semibold" key={route} href={panelHref(route)}>{label}<ArrowUpRight className="h-4 w-4 shrink-0" /></a>)}
            </div>
          </section>}
          <RetailOrders slug={slug} />
        </div>;
      case 'stock': return <RetailStock slug={slug} />;
      case 'orders': return <RetailOrders slug={slug} canPrepare={overview.role !== 'staff'} />;
      case 'discounts': return <RetailDiscounts slug={slug} owner={isOwner} />;
      case 'team': return overview.canManageTeam ? <RetailTeam slug={slug} /> : <div className={tile}>Set your store address in <a className="font-semibold text-indigo-700 underline" href={panelHref('channels')}>Storefront & webapps</a> to add your team.</div>;
      case 'upload': return window.kobeOS ? <div className="h-[75dvh]"><PhotoIntake productMode /></div> : <div className={tile}>
        <h2 className="font-bold">Upload on your shop server</h2>
        <p className="mt-2 text-sm text-slate-600">In KobeOS on the shop computer, open ERP Store and choose Add from photos. Review AI suggestions, then add your prices, colors and SKUs before publishing. Shop image files stay on that server.</p>
        <a href={panelHref('catalog')} className="mt-3 inline-block text-sm font-semibold text-indigo-700">Manage the cloud catalog</a>
      </div>;
      case 'catalog': return <Catalog referenceOnly={!window.kobeOS} />;
      case 'purchasing': return <Purchasing />;
      case 'pos': return <POS />;
      case 'reports': return <Reports />;
      case 'agents': return <Agents />;
      case 'channels': return <div className="space-y-4">
        <div className={`${tile} flex flex-wrap gap-3`}>
          {storeUrl && <a className={action} href={`https://${overview.slug}.kobeapptz.com/?view=feed`}>Open Discover <ArrowUpRight size={16} /></a>}
          {storeUrl && <a className="inline-flex items-center gap-1 px-2 text-sm font-semibold text-indigo-700" href={storeUrl}>Open product grid <ArrowUpRight size={16} /></a>}
          {overview.slug && <a className="inline-flex items-center gap-1 px-2 text-sm font-semibold text-indigo-700" href={`/m/${encodeURIComponent(overview.slug)}`}>Open mobile modules <ArrowUpRight size={16} /></a>}
        </div>
        <StoreEditor referenceOnly={!window.kobeOS} />
      </div>;
      default: return <div className={tile} role="alert">This panel is unavailable for your shop role.</div>;
    }
  })();

  return (
    <div className="min-h-dvh bg-[#f4f6fb] text-slate-950 lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="bg-[#14192b] text-slate-200 lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto">
        <div className="flex items-center gap-3 px-4 py-4 lg:px-5 lg:py-6">
          <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-600 font-bold text-white">K</span>
          <div><div className="text-lg font-bold leading-tight text-white">KobeOS</div><div className="text-xs text-slate-400">Retail workspace</div></div>
        </div>
        <nav aria-label="Retail workspace" className="flex gap-1 overflow-x-auto px-2 pb-3 lg:flex-col lg:px-3">
          {visible.map(({ id, label, Icon }) =>
            <a key={id} href={panelHref(id)} aria-current={panel?.id === id ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${panel?.id === id ? 'bg-indigo-400/25 text-white' : 'hover:bg-white/10'}`}>
              <Icon size={17} />{label}
            </a>)}
        </nav>
      </aside>
      <div className="min-w-0">
        <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-7">
          <span className="mr-auto font-semibold">{overview.name} <span className="ml-1 text-xs font-medium capitalize text-slate-500">{overview.role}</span></span>
          {overview.linked.length > 0 && <label className="text-xs font-semibold">
            <span className="sr-only">Switch shop</span>
            <select className={field} value={slug} onChange={event => window.location.assign(event.target.value ? `/erp/${encodeURIComponent(event.target.value)}` : '/erp')}>
              <option value="">My workspace</option>
              {slug && !overview.linked.some(link => link.domainSlug === slug) && <option value={slug}>{overview.name}</option>}
              {overview.linked.map(link => <option key={link.domainSlug} value={link.domainSlug}>{link.storeName}</option>)}
            </select>
          </label>}
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">Cloud connected</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{localStatus}</span>
          <button onClick={() => void signOut()} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700"><LogOut size={15} /> Sign out</button>
        </header>
        <main className="mx-auto max-w-[1440px] space-y-4 px-3 py-5 sm:px-7">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{panel?.id === 'overview' ? 'Shop overview' : panel?.label ?? 'Panel unavailable'}</h1>
          <Suspense fallback={<p role="status">Loading panel…</p>}>{body}</Suspense>
        </main>
      </div>
    </div>
  );
}
