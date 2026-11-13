import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, getRefreshToken, getToken } from '@/lib/api';
import LoginScreen from '@/components/LoginScreen';
import { useQRScanner } from '@/hooks/useQRScanner';
import { usePwaManifest } from '@/hooks/usePwaManifest';
import { InstallPwaButton } from '@/mobile/InstallPwaButton';
import { QRCodeSVG } from 'qrcode.react';
import { cargoTzLink, LabelPrintStyles, ParcelLabel, trackingFromScan } from './parcel-label';
import { CollectorInvites, PendingHandoffs } from './handoffs';
import { CargoStaff, TripOperations, type StaffRole, type Workspace } from './trips';
import {
  PackagePlus, Warehouse, LayoutDashboard, Camera, Loader2, CheckCircle2, Printer, Plus,
  Truck, MapPin, Clock, Wallet, PackageCheck, X, Search, AlertCircle, ClipboardList, ScanLine,
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell } from 'recharts';

/* ── Types ── */
interface Parcel {
  id: string; trackingNumber: string; senderName: string; senderPhone: string;
  receiverName: string; receiverPhone: string; description: string; quantity: number;
  origin: string; destination: string; transportFee: number | string; paymentStatus: 'PAID' | 'UNPAID';
  status: string; currentLocation: string; fragile: boolean; cashOnDelivery: boolean; tripId?: string | null;
  collectorAccessId?: string | null; receivedByName?: string; updatedAt?: string;
}
interface Warehouse2 { warehouseLocation: string; shelfNumber: string; bagNumber: string; busNumber: string; driverName: string; packedBy: string }
interface Timeline { status: string; location: string; note: string; at: string }
interface Full { parcel: Parcel; warehouse: Warehouse2 | null; timeline: Timeline[] }
interface Dash { cards: { receivedToday: number; inWarehouse: number; dispatched: number; delivered: number; cashCollected: number; outstanding: number; totalParcels: number }; byStatus: { status: string; count: number }[]; trend: { date: string; parcels: number; revenue: number }[] }

const ADVANCE = ['AT_WAREHOUSE', 'PACKED', 'LOADED', 'IN_TRANSIT', 'ARRIVED', 'READY_FOR_PICKUP', 'DELIVERED'];
const LABEL: Record<string, string> = { AWAITING_HANDOFF: 'Awaiting handoff', RECEIVED_AT_SHOP: 'Received', AT_WAREHOUSE: 'At warehouse', PACKED: 'Packed', LOADED: 'Loaded', IN_TRANSIT: 'In transit', ARRIVED: 'Arrived', READY_FOR_PICKUP: 'Ready for pickup', DELIVERED: 'Delivered', CANCELLED: 'Cancelled' };
const tsh = (n: number | string) => `TSh ${Number(n || 0).toLocaleString()}`;
const CHART = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

export type CargoOpsTab = 'intake' | 'dispatch' | 'loading' | 'destination' | 'warehouse' | 'dashboard' | 'board';
const ROLE_BY_TAB: Partial<Record<CargoOpsTab, StaffRole>> = { intake: 'Intake', dispatch: 'Dispatch', loading: 'Loading', destination: 'Destination' };
const workspaceKey = (workspace: Workspace) => `${workspace.ownerId}:${workspace.branch.toLowerCase()}`;
const ROLE_META: Record<CargoOpsTab, { slug: string; name: string; short: string; icon: string; theme: string }> = {
  intake: { slug: 'receive', name: 'Cargo TZ · Receiving Agent', short: 'CTZ Receive', icon: '/ctz-receive', theme: '#059669' },
  dispatch: { slug: 'dispatch', name: 'CargoTZ · Dispatch Office', short: 'CTZ Dispatch', icon: '/ctz-owner', theme: '#059669' },
  loading: { slug: 'load', name: 'CargoTZ · Loading Crew', short: 'CTZ Load', icon: '/ctz-warehouse', theme: '#059669' },
  destination: { slug: 'destination', name: 'CargoTZ · Destination Office', short: 'CTZ Destination', icon: '/ctz-receive', theme: '#059669' },
  warehouse: { slug: 'warehouse', name: 'Cargo TZ · Warehouse', short: 'CTZ Warehouse', icon: '/ctz-warehouse', theme: '#4f46e5' },
  dashboard: { slug: 'owner', name: 'Cargo TZ · Owner', short: 'CTZ Owner', icon: '/ctz-owner', theme: '#d97706' },
  board: { slug: 'board', name: 'CargoTZ · Freight Board', short: 'CTZ Board', icon: '/ctz-owner', theme: '#0f172a' },
};

export default function CargoTzOps({ role, standaloneBase, handoffReference }: {
  role?: CargoOpsTab;
  standaloneBase?: string;
  handoffReference?: string;
} = {}) {
  const [signedIn, setSignedIn] = useState(() => Boolean(getToken() || getRefreshToken()));
  const [selectedTab, setTab] = useState<CargoOpsTab>(role ?? 'intake');
  const [links, setLinks] = useState(false);
  const [tracking, setTracking] = useState('');
  const [pin, setPin] = useState('');
  const [grants, setGrants] = useState<Workspace[]>([]);
  const [workspaceChoice, setWorkspaceChoice] = useState('');
  const [workspaceError, setWorkspaceError] = useState('');
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const preferred = grants.find((item) => item.role === ROLE_BY_TAB[role ?? 'intake']) ?? grants[0];
  const workspaceId = workspaceChoice || (preferred ? workspaceKey(preferred) : 'mine');
  const workspaceGrants = grants.filter((item) => workspaceKey(item) === workspaceId);
  const firstTab = (Object.keys(ROLE_BY_TAB) as CargoOpsTab[]).find((key) => ROLE_BY_TAB[key] === workspaceGrants[0]?.role);
  const tab = workspaceId === 'mine' || workspaceGrants.some((item) => item.role === ROLE_BY_TAB[selectedTab])
    ? selectedTab : firstTab ?? selectedTab;
  const workspace = workspaceGrants.find((item) => item.role === ROLE_BY_TAB[tab]);
  const availableWorkspaces = [...new Map(grants.map((item) => [workspaceKey(item), item])).values()];

  // Route-scoped installable PWA: installing while on a tab adds a home-screen
  // app for THAT role (e.g. "Cargo TZ · Warehouse" opening at /cargotz/warehouse),
  // so each staffer gets their own app. Only meaningful on the standalone URL.
  const standalone = Boolean(standaloneBase);
  const meta = ROLE_META[tab];
  usePwaManifest({ name: meta.name, shortName: meta.short, startUrl: `${standaloneBase ?? '/cargotz'}/${meta.slug}`, iconBase: meta.icon, themeColor: meta.theme, enabled: standalone });
  useEffect(() => {
    const route = `${standaloneBase}/${meta.slug}`;
    if (standaloneBase && window.location.pathname !== route) {
      window.history.replaceState(null, '', route + window.location.search);
    }
  }, [standaloneBase, meta.slug]);
  const apiPin = useCallback(<T,>(path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (pin.trim()) headers.set('x-ctz-pin', pin.trim());
    return api<T>(path, { ...init, headers, offlineFallback: false }).catch((cause: unknown) => {
      if (standalone && cause instanceof ApiError && cause.status === 401) setSignedIn(false);
      throw cause;
    });
  }, [pin, standalone]);

  const operationsApi = useCallback(<T,>(path: string, init?: RequestInit) =>
    api<T>(path, { ...init, offlineFallback: false }).catch((cause: unknown) => {
      if (standalone && cause instanceof ApiError && cause.status === 401) setSignedIn(false);
      throw cause;
    }), [standalone]);

  useEffect(() => {
    if (standalone && !signedIn) return;
    const controller = new AbortController();
    operationsApi<Workspace[]>('/cargotz/operations/workspaces', { signal: controller.signal })
      .then((rows) => { if (!controller.signal.aborted) { setGrants(rows); setWorkspaceError(''); } })
      .catch((cause: Error) => { if (!controller.signal.aborted) setWorkspaceError(cause.message); })
      .finally(() => { if (!controller.signal.aborted) setWorkspaceLoading(false); });
    return () => controller.abort();
  }, [operationsApi, signedIn, standalone]);

  if (standalone && !signedIn) return <LoginScreen onLogin={() => { setWorkspaceLoading(true); setSignedIn(true); }} />;

  const tabs = [
    { key: 'board', label: 'Freight Board', Icon: LayoutDashboard },
    { key: 'intake', label: 'Receive', Icon: PackagePlus },
    { key: 'dispatch', label: 'Dispatch', Icon: ClipboardList },
    { key: 'loading', label: 'Loading', Icon: ScanLine },
    { key: 'destination', label: 'Destination', Icon: MapPin },
    { key: 'warehouse', label: 'Warehouse', Icon: Warehouse },
    { key: 'dashboard', label: 'Owner', Icon: LayoutDashboard },
  ] as const;
  const visibleTabs = tabs.filter((item) => workspaceId === 'mine' || workspaceGrants.some((grant) => grant.role === ROLE_BY_TAB[item.key]));

  return (
    <div className="h-full flex flex-col bg-[#f6f8fc] text-slate-900 overflow-hidden" data-surface="light" data-module="cargo-tz-ops">
      <div className="flex items-center justify-between px-4 py-3 bg-white text-slate-900 border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center"><PackageCheck className="w-4 h-4 text-white" /></div><div><span className="font-extrabold">CargoTZ</span><span className="block text-[10px] text-slate-500">Domestic operations</span></div></div>
        <div className="flex items-center gap-2">
          {standalone && <InstallPwaButton />}
          {workspaceId === 'mine' && <button type="button" aria-expanded={links} className="rounded-lg border px-3 py-1.5 text-xs font-bold" onClick={() => setLinks(value => !value)}>Mobile links</button>}
          {workspaceId === 'mine' && ['intake', 'warehouse', 'dashboard'].includes(tab) && <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="Staff PIN" inputMode="numeric"
            className="w-24 h-8 px-2 rounded-md text-slate-900 text-xs text-center tracking-widest" title="Optional — your 4-digit staff PIN attributes the action" />}
        </div>
      </div>
      {availableWorkspaces.length > 0 && <label className="flex items-center gap-2 border-b bg-white px-4 py-2 text-sm">
        Cargo workspace<select className="min-w-0 rounded-lg border p-1.5" value={workspaceId} onChange={(event) => setWorkspaceChoice(event.target.value)}>
          <option value="mine">My company</option>
          {availableWorkspaces.map((item) => <option key={workspaceKey(item)} value={workspaceKey(item)}>{item.branch} · Company {item.ownerId.slice(0, 8)}</option>)}
        </select>
      </label>}
      {workspaceError && <p role="alert" className="bg-amber-50 px-4 py-2 text-sm text-amber-900">Could not load assigned workspaces. {workspaceError}</p>}
      <div className="flex shrink-0 overflow-x-auto border-b border-slate-200 bg-white px-2">
        {visibleTabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex-1 shrink-0 px-2 py-2.5 inline-flex items-center justify-center gap-1.5 text-xs font-bold ${tab === t.key ? 'text-emerald-700 border-b-2 border-emerald-600' : 'text-slate-500'}`}>
            <t.Icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto">
        {links && workspaceId === 'mine' && <MobileLinks />}
        {workspaceLoading ? <p className="p-4 text-sm" role="status">Loading CargoTZ workspace…</p> : (workspaceId === 'mine' || workspace) && <>
        {tab === 'intake' && (
          <>
            <div className="mx-auto max-w-3xl px-4 pt-4"><PendingHandoffs
              key={workspaceId}
              api={workspace ? operationsApi : apiPin}
              basePath={workspace ? `/cargotz/operations/${workspace.ownerId}/intake` : undefined}
              branch={workspace?.branch}
              Scanner={Scanner}
              initialReference={handoffReference}
            /></div>
            {!workspace && <details className="mx-auto max-w-3xl p-4">
              <summary className="cursor-pointer rounded-xl border bg-white p-3 text-sm font-semibold">Manual intake for walk-in parcels</summary>
              <IntakeTab apiPin={apiPin} />
            </details>}
          </>
        )}
        {(tab === 'dispatch' || tab === 'loading' || tab === 'destination') &&
          <TripOperations key={`${tab}:${workspaceId}`} api={operationsApi} role={ROLE_BY_TAB[tab] as 'Dispatch' | 'Loading' | 'Destination'} workspace={workspace} Scanner={Scanner} />}
        {tab === 'warehouse' && <WarehouseTab apiPin={apiPin} tracking={tracking} />}
        {tab === 'board' && <FreightBoard openParcel={number => { setTracking(number); setTab('warehouse'); }} />}
        {tab === 'dashboard' && (
          <>
            {!pin && <div className="mx-auto max-w-5xl px-4 pt-4"><CollectorInvites api={apiPin} /></div>}
            {!pin && <div className="mx-auto max-w-5xl px-4 pt-4"><CargoStaff api={operationsApi} /></div>}
            <DashboardTab apiPin={apiPin} />
          </>
        )}
        </>}
      </div>
    </div>
  );
}

const freightLanes = [
  { label: 'Awaiting custody', statuses: ['AWAITING_HANDOFF'], tone: 'border-amber-400' },
  { label: 'At origin', statuses: ['RECEIVED_AT_SHOP', 'AT_WAREHOUSE'], tone: 'border-blue-400' },
  { label: 'To dispatch', statuses: ['PACKED', 'LOADED'], tone: 'border-violet-400' },
  { label: 'In transit', statuses: ['IN_TRANSIT'], tone: 'border-cyan-400' },
  { label: 'At destination', statuses: ['ARRIVED', 'READY_FOR_PICKUP'], tone: 'border-emerald-400' },
  { label: 'Delivered', statuses: ['DELIVERED'], tone: 'border-slate-400' },
];

function MobileLinks() {
  const [qr, setQr] = useState('');
  const [notice, setNotice] = useState('');
  const links = [{ slug: 'collect', name: 'Collection agent' }, ...Object.values(ROLE_META)];
  return <section className="border-b bg-white p-4">
    <h2 className="font-bold">CargoTZ mobile links</h2>
    <p className="mb-3 text-sm text-slate-600">Assign staff access in Owner. Send each collection agent their personal invitation from Owner.</p>
    <ul className="grid gap-2 sm:grid-cols-2">
      {links.map(({ slug, name }) => {
        const url = cargoTzLink('/cargotz/' + slug);
        return <li key={slug} className="min-w-0 rounded-lg border border-slate-200 p-3">
          <a href={url} target="_blank" rel="noopener noreferrer" className="block text-sm font-bold text-blue-700 underline">{name}</a>
          <p className="break-all text-xs text-slate-600">{url}</p>
          <div className="mt-2 flex gap-3 text-xs font-bold">
            <button type="button" onClick={() => {
              void (navigator.clipboard?.writeText(url) ?? Promise.reject()).then(() => setNotice(name + ' link copied.'), () => setNotice('Select and copy the address below ' + name + '.'));
            }}>Copy link</button>
            <button type="button" aria-expanded={qr === slug} onClick={() => setQr(value => value === slug ? '' : slug)}>Phone QR</button>
          </div>
          {qr === slug && <QRCodeSVG className="mt-3" value={url} size={104} marginSize={4} title={'Open ' + name + ' on a phone'} />}
        </li>;
      })}
    </ul>
    <p role="status" className="mt-2 text-sm">{notice}</p>
  </section>;
}

interface FreightVolume {
  hours: { hour: number; today: number; yesterday: number }[];
  agents: { id: string; name: string; today: number; yesterday: number }[];
}

function volumeChange(today: number, yesterday: number) {
  const delta = today - yesterday;
  if (!delta) return '—  No change';
  const sign = delta > 0 ? '+' : '−';
  return (delta > 0 ? '▲ ' : '▼ ') + sign + Math.abs(delta)
    + (yesterday ? ' (' + sign + Math.round(Math.abs(delta) / yesterday * 100) + '%)' : ' from 0');
}

function VolumePanel({ volume, failed, display }: { volume: FreightVolume | null; failed: boolean; display: boolean }) {
  const totals = { today: 0, yesterday: 0 };
  const trend = volume?.hours.map(point => {
    totals.today += point.today;
    totals.yesterday += point.yesterday;
    return { hour: String(point.hour).padStart(2, '0') + ':00', ...totals };
  }) ?? [];
  const agents = [...(volume?.agents ?? [])].sort((a, b) => b.today - a.today || b.yesterday - a.yesterday || a.name.localeCompare(b.name));
  const color = (today: number, yesterday: number) => today > yesterday ? '#6ee7b7' : today < yesterday ? '#fda4af' : '#cbd5e1';
  return <div className={display ? '' : 'grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]'}>
    <section className="min-w-0 rounded-xl border border-slate-700 p-4" style={{ background: '#19263c' }}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h3 className="text-sm font-bold" style={{ color: '#f1f5f9' }}>Cartons registered today</h3>
          <p className="text-xs" style={{ color: '#cbd5e1' }}>Compared with the same time yesterday · EAT</p></div>
        {volume && <div className="flex items-baseline gap-2"><strong className="text-3xl tabular-nums">{totals.today}</strong>
          <span className="text-sm font-bold" style={{ color: color(totals.today, totals.yesterday) }}>{volumeChange(totals.today, totals.yesterday)}</span></div>}
      </div>
      {failed && <p role="status" className="mt-2 text-xs" style={{ color: '#fda4af' }}>{volume ? 'Showing the last volume update.' : 'Volume comparison unavailable.'}</p>}
      {volume ? <>
        <div role="img" aria-label={'Cumulative cartons: ' + totals.today + ' today, ' + totals.yesterday + ' yesterday at the same time'}>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={trend} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#334155" vertical={false} />
              <XAxis dataKey="hour" tick={{ fill: '#cbd5e1', fontSize: 10 }} minTickGap={28} />
              <YAxis allowDecimals={false} width={30} tick={{ fill: '#cbd5e1', fontSize: 10 }} domain={[0, 'auto']} />
              <Tooltip contentStyle={{ background: '#0f172a', borderColor: '#475569', color: '#fff' }} />
              <Line name="Yesterday" dataKey="yesterday" stroke="#94a3b8" strokeDasharray="5 4" strokeWidth={2} dot={trend.length === 1} isAnimationActive={false} />
              <Line name="Today" dataKey="today" stroke="#38bdf8" strokeWidth={3} dot={trend.length === 1} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs font-semibold"><span style={{ color: '#7dd3fc' }}>Today {totals.today}</span><span className="ml-4" style={{ color: '#cbd5e1' }}>Yesterday {totals.yesterday}</span></p>
      </> : !failed && <p className="mt-3 text-sm">Loading volume…</p>}
    </section>
    {!display && <section className="min-w-0 rounded-xl border border-slate-700 p-4" style={{ background: '#19263c' }}>
      <h3 className="text-sm font-bold" style={{ color: '#f1f5f9' }}>Collection agent performance</h3>
      <p className="mb-2 text-xs" style={{ color: '#cbd5e1' }}>Cartons registered by each agent</p>
      <div className="max-h-44 overflow-auto">
        <table className="w-full text-left text-xs tabular-nums" style={{ color: '#f1f5f9' }}>
          <thead><tr>{['Agent', 'Today', 'Yesterday', 'Change'].map(label => <th key={label} scope="col" className="px-1 py-1">{label}</th>)}</tr></thead>
          <tbody>{agents.map(agent => <tr key={agent.id} className="border-t border-slate-700">
            <th scope="row" className="px-1 py-2">{agent.name}</th><td className="px-1">{agent.today}</td><td className="px-1">{agent.yesterday}</td>
            <td className="whitespace-nowrap px-1 font-bold" style={{ color: color(agent.today, agent.yesterday) }}>{volumeChange(agent.today, agent.yesterday)}</td>
          </tr>)}</tbody>
        </table>
        {volume && !agents.length && <p className="mt-2 text-xs" style={{ color: '#cbd5e1' }}>Add collection agents in Owner to see their performance.</p>}
      </div>
    </section>}
  </div>;
}

function FreightBoard({ openParcel }: { openParcel: (tracking: string) => void }) {
  const [lane, setLane] = useState('');
  const [volume, setVolume] = useState<FreightVolume | null>(null);
  const [volumeFailed, setVolumeFailed] = useState(false);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [agents, setAgents] = useState<Record<string, string>>({});
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [failed, setFailed] = useState(false);
  const [destination, setDestination] = useState('');
  const [query, setQuery] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [display, setDisplay] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let busy = false;
    const load = async () => {
      if (busy) return;
      busy = true;
      try {
        const options = {
          offlineFallback: false, cache: 'no-store',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
        } as const;
        const [rows, invites, volumeResult] = await Promise.all([
          api<Parcel[]>('/cargotz/parcels', options),
          api<{ id: string; agentName: string }[]>('/cargotz/collector-invites', options).catch(() => null),
          api<FreightVolume>('/cargotz/freight-volume', options).catch(() => null),
        ]);
        if (!Array.isArray(rows)) throw new Error('Invalid parcel response');
        if (controller.signal.aborted) return;
        if (Array.isArray(volumeResult?.hours) && Array.isArray(volumeResult.agents)) {
          setVolume(volumeResult); setVolumeFailed(false);
        } else setVolumeFailed(true);
        setParcels(rows); setLastSync(new Date()); setFailed(false);
        if (Array.isArray(invites)) setAgents(previous => ({ ...previous, ...Object.fromEntries(invites.map(agent => [agent.id, agent.agentName])) }));
      } catch {
        if (!controller.signal.aborted) { setFailed(true); setVolumeFailed(true); }
      } finally { busy = false; }
    };
    void load();
    const timer = window.setInterval(() => void load(), 12000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [refresh]);

  const visible = parcels.filter(parcel => parcel.status !== 'CANCELLED');
  const destinations = [...new Set(visible.map(parcel => parcel.destination).filter(Boolean))].sort();
  const term = display ? '' : query.trim().toLowerCase();
  const collector = (parcel: Parcel) => parcel.collectorAccessId ? agents[parcel.collectorAccessId] : parcel.receivedByName;
  const filtered = visible.filter(parcel => (display || !destination || parcel.destination === destination)
    && (!term || [parcel.trackingNumber, parcel.origin, parcel.destination, parcel.description, collector(parcel)]
      .some(value => value?.toLowerCase().includes(term))));
  const paymentDue = (parcel: Parcel) => parcel.status !== 'AWAITING_HANDOFF' && parcel.paymentStatus === 'UNPAID';
  const metrics = [
    ...freightLanes.map(item => ({ ...item, matches: (parcel: Parcel) => item.statuses.includes(parcel.status) })),
    { label: 'Payment due', tone: 'border-rose-400', matches: paymentDue },
  ];
  const filter = display ? undefined : metrics.find(item => item.label === lane);
  const rows = filtered.filter(filter?.matches ?? (parcel => parcel.status !== 'DELIVERED'));
  return <section className="min-h-full space-y-4 p-4" style={{ background: '#101a2d', color: '#f1f5f9' }}>
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-black" style={{ color: '#fff' }}>Freight control board</h2>
        <p role="status" className="mt-1 text-sm" style={{ color: failed ? '#fda4af' : '#cbd5e1' }}>
          {failed ? lastSync ? 'Connection lost. Showing last received parcels.' : 'Could not load parcels' : lastSync ? 'Updated ' + lastSync.toLocaleTimeString() : 'Loading parcels…'}
          {parcels.length >= 500 && ' · Latest 500 parcels'}
        </p>
      </div>
      <div className="flex gap-2">
        <button onClick={() => setRefresh(attempt => attempt + 1)} className="rounded-lg border border-slate-500 px-3 py-2 text-sm font-bold" style={{ color: '#f1f5f9' }}>Refresh</button>
        <button aria-pressed={display} onClick={() => setDisplay(value => !value)} className="rounded-lg bg-sky-300 px-3 py-2 text-sm font-bold" style={{ color: '#0f172a' }}>{display ? 'Exit display mode' : 'Display mode'}</button>
      </div>
    </header>
    <VolumePanel volume={volume} failed={volumeFailed} display={display} />
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
      {metrics.map(item => {
        const label = <><span className="block text-xs font-semibold">{item.label}</span><span className="mt-1 block text-2xl font-black tabular-nums">{lastSync ? filtered.filter(item.matches).length : '–'}</span></>;
        const style = { color: '#f1f5f9', background: filter === item ? '#334865' : '#1c2b43' };
        const className = 'rounded-lg border-t-2 p-3 text-left ' + item.tone;
        return display ? <div key={item.label} className={className} style={style}>{label}</div> :
          <button key={item.label} className={className} style={style} aria-pressed={filter === item} onClick={() => setLane(value => value === item.label ? '' : item.label)}>{label}</button>;
      })}
    </div>
    {!display && <div className="flex flex-wrap gap-2 text-slate-900">
      <input aria-label="Search freight board" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search tracking, route, goods or agent" className="min-w-48 flex-1 rounded-lg border bg-white px-3 py-2 text-sm" />
      <select aria-label="Filter by destination" value={destination} onChange={event => setDestination(event.target.value)} className="rounded-lg border bg-white px-3 py-2 text-sm">
        <option value="">All destinations</option>
        {destination && !destinations.includes(destination) && <option>{destination}</option>}
        {destinations.map(place => <option key={place}>{place}</option>)}
      </select>
    </div>}
    <div className="overflow-x-auto rounded-xl border border-slate-700" style={{ background: '#19263c' }}>
      <table className="w-full min-w-[650px] text-left" style={{ color: '#f1f5f9' }}>
        <caption className="px-3 py-2 text-left text-sm font-bold">{filter?.label ?? 'Active freight'}{lastSync && ' · ' + rows.length}</caption>
        <thead style={{ background: '#23344e', color: '#cbd5e1' }}><tr>
          {['Tracking', 'Route & location', 'Custody', ...(!display ? ['Collection agent', 'Payment'] : []), 'Last activity'].map(label => <th scope="col" key={label} className="px-3 py-2 text-xs font-bold">{label}</th>)}
        </tr></thead>
        <tbody>{rows.map(parcel => <tr key={parcel.id} className="border-t border-slate-700">
          <td className="px-3 py-3 font-mono text-xs font-bold">{display ? parcel.trackingNumber : <button type="button" style={{ color: '#7dd3fc' }} className="text-left underline underline-offset-2" onClick={() => openParcel(parcel.trackingNumber)}>{parcel.trackingNumber}</button>}
            {parcel.fragile && <span className="mt-1 block" style={{ color: '#fbbf24' }}>Fragile</span>}</td>
          <td className="px-3 py-3 text-sm font-bold">{parcel.origin} → {parcel.destination}<span className="block text-xs font-normal" style={{ color: '#cbd5e1' }}>{parcel.currentLocation || 'Location unavailable'}</span></td>
          <td className="px-3 py-3 text-sm font-bold" style={{ color: parcel.status === 'AWAITING_HANDOFF' ? '#fbbf24' : '#7dd3fc' }}>{LABEL[parcel.status] ?? parcel.status}</td>
          {!display && <><td className="px-3 py-3 text-sm">{collector(parcel) || '—'}</td><td className="px-3 py-3 text-sm font-bold" style={{ color: paymentDue(parcel) ? '#fda4af' : '#a7f3d0' }}>
            {parcel.status === 'AWAITING_HANDOFF' ? 'At intake' : parcel.paymentStatus === 'PAID' ? 'Recorded' : Number(parcel.transportFee) > 0 ? tsh(parcel.transportFee) + ' due' : 'Fee needed'}
          </td></>}
          <td className="px-3 py-3 text-xs tabular-nums">{parcel.updatedAt ? new Date(parcel.updatedAt).toLocaleString() : '—'}</td>
        </tr>)}</tbody>
      </table>
      {lastSync && rows.length === 0 && <p className="p-4 text-sm">No parcels match this view.</p>}
    </div>
  </section>;
}

/* ─────────── Receiving Agent — intake ─────────── */
function IntakeTab({ apiPin }: { apiPin: <T,>(p: string, i?: RequestInit) => Promise<T> }) {
  const empty = { senderName: '', senderPhone: '', senderId: '', receiverName: '', receiverPhone: '', parcelType: '', description: '', quantity: 1, weight: '', value: '', origin: '', destination: '', transportFee: '', paymentStatus: 'UNPAID' as 'PAID' | 'UNPAID', fragile: false, cashOnDelivery: false, notes: '' };
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Parcel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    setError(null);
    if (!f.senderName || !f.senderPhone || !f.receiverName || !f.receiverPhone || !f.origin || !f.destination) { setError('Fill sender, receiver and route.'); return; }
    setBusy(true);
    try {
      const p = await apiPin<Parcel>('/cargotz/parcels', { method: 'POST', body: JSON.stringify({ ...f, quantity: Number(f.quantity) || 1, weight: Number(f.weight) || 0, value: Number(f.value) || 0, transportFee: Number(f.transportFee) || 0 }) });
      setDone(p);
    } catch (e) { setError((e as Error).message || 'Could not create parcel'); }
    finally { setBusy(false); }
  };

  if (done) {
    return (
      <div className="p-4 max-w-md mx-auto text-center space-y-4">
        <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto" />
        <div><div className="text-sm text-slate-500">Parcel received</div><div className="text-2xl font-extrabold font-mono">{done.trackingNumber}</div></div>
        <LabelPrintStyles />
        <div className="ctz-print-labels"><ParcelLabel parcel={done} /></div>
        <div className="text-sm text-slate-600">{done.origin} → {done.destination} · {done.receiverName}</div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="flex-1 h-11 rounded-xl bg-slate-800 text-white font-bold inline-flex items-center justify-center gap-2"><Printer className="w-4 h-4" /> Print</button>
          <button onClick={() => { setDone(null); setF(empty); }} className="flex-1 h-11 rounded-xl bg-emerald-600 text-white font-bold inline-flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> New parcel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-md mx-auto space-y-3">
      <Section title="Sender">
        <In v={f.senderName} set={(v) => set('senderName', v)} ph="Sender name *" />
        <In v={f.senderPhone} set={(v) => set('senderPhone', v)} ph="Sender phone *" />
        <In v={f.senderId} set={(v) => set('senderId', v)} ph="Sender ID (optional)" />
      </Section>
      <Section title="Receiver">
        <In v={f.receiverName} set={(v) => set('receiverName', v)} ph="Receiver name *" />
        <In v={f.receiverPhone} set={(v) => set('receiverPhone', v)} ph="Receiver phone *" />
      </Section>
      <Section title="Parcel">
        <In v={f.description} set={(v) => set('description', v)} ph="Description" />
        <div className="grid grid-cols-3 gap-2">
          <In v={f.parcelType} set={(v) => set('parcelType', v)} ph="Type" />
          <In v={f.quantity} set={(v) => set('quantity', v)} ph="Qty" type="number" />
          <In v={f.weight} set={(v) => set('weight', v)} ph="Kg" type="number" />
        </div>
      </Section>
      <Section title="Route">
        <div className="grid grid-cols-2 gap-2">
          <In v={f.origin} set={(v) => set('origin', v)} ph="From *" />
          <In v={f.destination} set={(v) => set('destination', v)} ph="To *" />
        </div>
      </Section>
      <Section title="Charges">
        <div className="grid grid-cols-2 gap-2">
          <In v={f.transportFee} set={(v) => set('transportFee', v)} ph="Transport fee" type="number" />
          <select value={f.paymentStatus} onChange={(e) => set('paymentStatus', e.target.value)} className="h-10 px-2 rounded-lg border border-slate-200 text-sm">
            <option value="UNPAID">Not paid</option><option value="PAID">Paid</option>
          </select>
        </div>
        <div className="flex gap-4 pt-1">
          <label className="text-xs inline-flex items-center gap-1.5"><input type="checkbox" checked={f.fragile} onChange={(e) => set('fragile', e.target.checked)} /> Fragile</label>
          <label className="text-xs inline-flex items-center gap-1.5"><input type="checkbox" checked={f.cashOnDelivery} onChange={(e) => set('cashOnDelivery', e.target.checked)} /> Cash on delivery</label>
        </div>
      </Section>
      {error && <div className="text-sm text-rose-600 inline-flex items-center gap-1"><AlertCircle className="w-4 h-4" />{error}</div>}
      <button onClick={submit} disabled={busy} className="w-full h-12 rounded-xl bg-emerald-600 text-white font-extrabold inline-flex items-center justify-center gap-2 disabled:opacity-50">
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <PackagePlus className="w-5 h-5" />} Receive parcel → generate tracking
      </button>
    </div>
  );
}

/* ─────────── Warehouse — scan + pack + advance ─────────── */
function WarehouseTab({ apiPin, tracking }: { tracking: string; apiPin: <T,>(p: string, i?: RequestInit) => Promise<T> }) {
  const [tn, setTn] = useState(tracking);
  const [fee, setFee] = useState('');
  const [recording, setRecording] = useState(false);
  const [full, setFull] = useState<Full | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pack, setPack] = useState({ warehouseLocation: '', shelfNumber: '', bagNumber: '', busNumber: '', driverName: '', driverPhone: '', departureTime: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (key: string) => {
    const tracking = trackingFromScan(key) || key.trim().toUpperCase();
    if (!tracking) return;
    setLoading(true); setError(null); setRecording(false); setFee('');
    try { const f = await apiPin<Full>(`/cargotz/parcels/${encodeURIComponent(tracking)}`); setFull(f); setPack((p) => ({ ...p, ...(f.warehouse || {}) })); }
    catch (e) { setError((e as Error).message || 'Not found'); setFull(null); }
    finally { setLoading(false); }
  }, [apiPin]);

  useEffect(() => { if (tracking) void load(tracking); }, [tracking, load]);

  const onScan = (raw: string) => { setScanning(false); const t = trackingFromScan(raw) || raw.trim(); setTn(t.toUpperCase()); load(t); };

  const doPack = async () => {
    if (!full) return;
    setBusy(true); setError(null);
    try { const f = await apiPin<Full>(`/cargotz/parcels/${full.parcel.trackingNumber}/pack`, { method: 'POST', body: JSON.stringify(pack) }); setFull(f); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const advance = async (status: string) => {
    if (!full) return;
    setBusy(true);
    try { const f = await apiPin<Full>(`/cargotz/parcels/${full.parcel.trackingNumber}/status`, { method: 'POST', body: JSON.stringify({ status }) }); setFull(f); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const markPaid = async () => {
    if (!full || busy) return;
    setBusy(true); setError(null);
    try {
      const parcel = await apiPin<Parcel>('/cargotz/parcels/' + full.parcel.trackingNumber + '/payment', {
        method: 'POST',
        body: JSON.stringify({ paid: true, ...(Number(full.parcel.transportFee) <= 0 ? { transportFee: Number(fee) } : {}) }),
      });
      setFull(current => current?.parcel.id === parcel.id ? { ...current, parcel } : current);
      setRecording(false);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto space-y-4">
      <button disabled={busy || loading} onClick={() => setScanning(true)} className="w-full h-16 rounded-2xl bg-emerald-600 text-white font-extrabold text-lg inline-flex items-center justify-center gap-2"><Camera className="w-6 h-6" /> Scan parcel QR</button>
      <div className="flex gap-2">
        <div className="relative flex-1"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={tn} onChange={(e) => setTn(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === 'Enter' && !busy && !loading) load(tn); }} placeholder="or type CTZ-..." className="w-full h-11 pl-9 pr-3 rounded-xl border border-slate-200 text-sm font-mono" /></div>
        <button onClick={() => load(tn)} disabled={loading || busy} className="h-11 px-4 rounded-xl bg-slate-800 text-white text-sm font-bold">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Load'}</button>
      </div>
      {error && <div className="text-sm text-rose-600 inline-flex items-center gap-1"><AlertCircle className="w-4 h-4" />{error}</div>}

      {full && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
            <div><div className="text-[11px] text-white/60">Tracking</div><div className="font-mono font-extrabold">{full.parcel.trackingNumber}</div></div>
            <span className="text-xs font-bold bg-white/15 rounded-full px-2.5 py-1">{LABEL[full.parcel.status] ?? full.parcel.status}</span>
          </div>
          <div className="p-4 space-y-3">
            <div className="text-sm"><MapPin className="w-3.5 h-3.5 inline text-slate-400" /> {full.parcel.origin} → {full.parcel.destination}
              {full.parcel.fragile && <span className="ml-2 text-[10px] font-bold text-rose-600 bg-rose-50 rounded px-1.5 py-0.5">FRAGILE</span>}</div>
            <div className="text-xs text-slate-500">{full.parcel.receiverName} · {full.parcel.receiverPhone} · {full.parcel.description}</div>
            <section className="space-y-2 rounded-lg border border-slate-200 p-3">
              <div className="flex justify-between gap-2 text-sm font-bold">
                <span>Freight payment · {Number(full.parcel.transportFee) > 0 ? tsh(full.parcel.transportFee) : 'Fee unset'}</span>
                <span className={full.parcel.paymentStatus === 'PAID' ? 'text-emerald-700' : 'text-amber-800'}>{full.parcel.paymentStatus === 'PAID' ? 'Recorded' : 'Unpaid'}</span>
              </div>
              {full.parcel.cashOnDelivery && <p className="text-xs text-slate-600">Cash on delivery requested</p>}
              {full.parcel.paymentStatus === 'UNPAID' && !['AWAITING_HANDOFF', 'CANCELLED'].includes(full.parcel.status) &&
                (recording ? <form className="space-y-2" onSubmit={event => { event.preventDefault(); void markPaid(); }}>
                  {Number(full.parcel.transportFee) <= 0 && <label className="block text-sm">Amount received for this carton (TSh)
                    <input value={fee} onChange={event => setFee(event.target.value)} className="mt-1 block w-full rounded-lg border p-2" type="number" min="0.01" step="0.01" max="9999999999.99" required />
                  </label>}
                  <p className="text-xs text-slate-600">Confirm after receiving the freight fee. CargoTZ records the payment.</p>
                  <div className="flex gap-2">
                    <button type="submit" disabled={busy || loading} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">Confirm received</button>
                    <button type="button" disabled={busy} onClick={() => setRecording(false)} className="rounded-lg border px-3 py-2 text-xs font-bold">Cancel</button>
                  </div>
                </form> : <button type="button" disabled={busy || loading} onClick={() => setRecording(true)} className="inline-flex items-center gap-1 rounded-lg border border-emerald-700 px-3 py-2 text-xs font-bold text-emerald-800"><Wallet className="h-3 w-3" /> Record received payment</button>)}
            </section>
            {full.parcel.tripId ? <p className="text-sm text-emerald-900">This carton is managed by its trip manifest.</p> : full.parcel.status === 'AWAITING_HANDOFF' ? <p className="text-sm text-amber-800">Cargo intake must accept custody first.</p> : <>
            <div className="border-t border-slate-100 pt-3">
              <div className="text-xs font-bold text-slate-500 uppercase mb-2">Warehouse packing</div>
              <div className="grid grid-cols-2 gap-2">
                <In v={pack.warehouseLocation} set={(v) => setPack({ ...pack, warehouseLocation: v })} ph="Warehouse" />
                <In v={pack.shelfNumber} set={(v) => setPack({ ...pack, shelfNumber: v })} ph="Shelf" />
                <In v={pack.bagNumber} set={(v) => setPack({ ...pack, bagNumber: v })} ph="Bag" />
                <In v={pack.busNumber} set={(v) => setPack({ ...pack, busNumber: v })} ph="Bus number" />
                <In v={pack.driverName} set={(v) => setPack({ ...pack, driverName: v })} ph="Driver" />
                <In v={pack.driverPhone} set={(v) => setPack({ ...pack, driverPhone: v })} ph="Driver phone" />
              </div>
              <button onClick={doPack} disabled={busy} className="w-full h-10 mt-2 rounded-lg bg-indigo-600 text-white font-bold text-sm inline-flex items-center justify-center gap-1.5 disabled:opacity-50"><Warehouse className="w-4 h-4" /> Save packing</button>
            </div>

            <div className="border-t border-slate-100 pt-3">
              <div className="text-xs font-bold text-slate-500 uppercase mb-2">Advance status</div>
              <div className="grid grid-cols-2 gap-2">
                {ADVANCE.map((s) => (
                  <button key={s} onClick={() => advance(s)} disabled={busy || full.parcel.status === s} className={`h-9 rounded-lg text-xs font-bold border ${full.parcel.status === s ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-200 text-slate-600 hover:border-emerald-400'}`}>{LABEL[s]}</button>
                ))}
              </div>
            </div>
            </>}
          </div>
        </div>
      )}
      {scanning && <Scanner onClose={() => setScanning(false)} onResult={onScan} />}
    </div>
  );
}

/* ─────────── Owner dashboard ─────────── */
function DashboardTab({ apiPin }: { apiPin: <T,>(p: string, i?: RequestInit) => Promise<T> }) {
  const [d, setD] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { apiPin<Dash>('/cargotz/dashboard').then(setD).catch(() => {}).finally(() => setLoading(false)); }, [apiPin]);
  if (loading) return <div className="grid place-items-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  const c = d?.cards;
  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <KPI label="Received today" value={String(c?.receivedToday ?? 0)} Icon={PackagePlus} tone="text-emerald-600" />
        <KPI label="In warehouse" value={String(c?.inWarehouse ?? 0)} Icon={Warehouse} tone="text-indigo-600" />
        <KPI label="Dispatched" value={String(c?.dispatched ?? 0)} Icon={Truck} tone="text-amber-600" />
        <KPI label="Delivered" value={String(c?.delivered ?? 0)} Icon={CheckCircle2} tone="text-teal-600" />
        <KPI label="Cash collected" value={tsh(c?.cashCollected ?? 0)} Icon={Wallet} tone="text-emerald-600" />
        <KPI label="Outstanding" value={tsh(c?.outstanding ?? 0)} Icon={Clock} tone="text-rose-600" />
        <KPI label="Total parcels" value={String(c?.totalParcels ?? 0)} Icon={PackageCheck} tone="text-slate-700" />
      </div>
      <Card title="Parcels & revenue (14 days)">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={d?.trend ?? []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} width={36} />
            <Tooltip /><Line type="monotone" dataKey="parcels" stroke="#10b981" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
      <Card title="By status">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={d?.byStatus ?? []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="status" tick={{ fontSize: 9 }} tickFormatter={(s: string) => LABEL[s] ?? s} interval={0} angle={-30} textAnchor="end" height={60} /><YAxis tick={{ fontSize: 10 }} width={30} />
            <Tooltip /><Bar dataKey="count" radius={[4, 4, 0, 0]}>{(d?.byStatus ?? []).map((_, i) => <Cell key={i} fill={CHART[i % CHART.length]} />)}</Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

/* ── bits ── */
function Scanner({ onClose, onResult }: { onClose: () => void; onResult: (raw: string) => void }) {
  const { videoRef, result, error, start, stop } = useQRScanner({ qrFallback: true });
  const fired = useRef(false);
  useEffect(() => { start(); return () => stop(); }, [start, stop]);
  useEffect(() => { if (result && !fired.current) { fired.current = true; onResult(result.rawValue); } }, [result, onResult]);
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 h-14 text-white"><span className="font-bold">Scan parcel QR</span><button onClick={onClose}><X className="w-6 h-6" /></button></div>
      <div className="relative flex-1"><video ref={videoRef} className="w-full h-full object-cover" muted playsInline /><div className="absolute inset-x-10 top-1/2 -translate-y-1/2 aspect-square border-2 border-emerald-400/80 rounded-2xl pointer-events-none" /></div>
      {error && <div className="p-3 text-xs text-rose-300 bg-black">{error} — type the tracking number instead.</div>}
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="bg-white rounded-2xl border border-slate-200 p-3 space-y-2"><div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">{title}</div>{children}</div>;
}
function In({ v, set, ph, type = 'text' }: { v: string | number; set: (v: string) => void; ph: string; type?: string }) {
  return <input value={v} onChange={(e) => set(e.target.value)} placeholder={ph} type={type} className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm" />;
}
function KPI({ label, value, Icon, tone }: { label: string; value: string; Icon: typeof Truck; tone: string }) {
  return <div className="bg-white rounded-xl border border-slate-200 p-3"><div className="flex items-center justify-between"><span className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</span><Icon className={`w-3.5 h-3.5 ${tone}`} /></div><div className={`text-lg font-extrabold mt-0.5 ${tone}`}>{value}</div></div>;
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="bg-white rounded-xl border border-slate-200 p-3"><div className="text-xs font-bold text-slate-500 mb-2">{title}</div>{children}</div>;
}
