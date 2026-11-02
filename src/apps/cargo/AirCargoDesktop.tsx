import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, ArrowUpRight, Boxes, Check, ChevronDown, ChevronRight, CircleHelp, Command, FileCheck2, LayoutGrid, Loader2, Package, Plane, Radio, RefreshCw, Route, ScanLine, ShieldCheck, Truck, Wallet, Warehouse } from 'lucide-react';
import { api } from '@/lib/api';
import './air-cargo-desktop.css';
import CargoFinanceDesk from './CargoFinanceDesk';

export type AirDesktopView = 'dashboard' | 'tracking' | 'warehouse' | 'consolidation' | 'control' | 'flights' | 'customs' | 'business' | 'delivery' | 'money';
export interface AirDeskShipment { id: string; shipmentId: string; origin: string; destination: string; status: string; weight: number; flightNumber?: string | null; carrier?: string | null; eta?: string | null; }
export interface AirDeskParcel { id: string; parcelId: string; description?: string; ownerName: string; destination: string; lifecycleStatus?: string; status: string; weight: number; }
export interface AirDeskData { shipments: AirDeskShipment[]; parcels: AirDeskParcel[]; }
const NAV = [
  { id: 'dashboard', label: 'Overview', icon: LayoutGrid },
  { id: 'tracking', label: 'Route studio', icon: Route },
  { id: 'warehouse', label: 'Warehouse', icon: Warehouse },
  { id: 'flights', label: 'Flight radar', icon: Radio },
  { id: 'money', label: 'KobePay', icon: Wallet },
] as const;
const TOOLS = [
  { id: 'consolidation', label: 'Consolidation', icon: Boxes },
  { id: 'customs', label: 'Customs', icon: ShieldCheck },
  { id: 'delivery', label: 'Collection', icon: Truck },
  { id: 'business', label: 'Customers', icon: FileCheck2 },
  { id: 'control', label: 'Exceptions', icon: CircleHelp },
] as const;
const label = (value: string) => value.replaceAll('_', ' ').toLowerCase();

export default function AirCargoDesktop({ view, onView, children, previewData }: {
  view: AirDesktopView; onView: (view: AirDesktopView) => void; children?: ReactNode; previewData?: AirDeskData;
}) {
  const [data, setData] = useState<AirDeskData>(previewData ?? { shipments: [], parcels: [] });
  const [loading, setLoading] = useState(!previewData);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [toolsOpen, setToolsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const [windowHeight, setWindowHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [view]);
  useLayoutEffect(() => {
    const root = rootRef.current;
    const host = root?.closest('[data-window-content]');
    if (!root || !host) return;
    const footer = root.parentElement?.nextElementSibling;
    const measure = () => setWindowHeight(Math.max(200, host.clientHeight - (footer?.getBoundingClientRect().height ?? 0)));
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    if (footer) observer.observe(footer);
    measure();
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (previewData || view !== 'dashboard') return;
    let active = true;
    setLoading(true);
    Promise.all([
      api<AirDeskShipment[]>('/cargo/shipments?limit=50', { offlineFallback: false }),
      api<AirDeskParcel[]>('/cargo/parcels?limit=50', { offlineFallback: false }),
    ]).then(([shipments, parcels]) => {
      if (active) { setData({ shipments: Array.isArray(shipments) ? shipments : [], parcels: Array.isArray(parcels) ? parcels : [] }); setError(''); }
    }).catch(e => { if (active) setError(e instanceof Error && !e.message.includes('fetch') ? e.message : 'Cargo server unavailable. Current records could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [previewData, revision, view]);
  const onMoney = () => onView('money');
  const legacy = !['dashboard', 'tracking', 'flights', 'money'].includes(view);
  return <div ref={rootRef} className="airdesk" data-module="kobe-air-cargo" style={windowHeight ? { height: windowHeight, minHeight: 0 } : undefined}>
    <aside className="ad-rail" aria-label="Kobe Air navigation">
      <div className="ad-brand" aria-label="Kobe Air">k<span>.</span></div>
      <span className="ad-rail-rule" />
      {NAV.map(({ id, label: name, icon: Icon }) => <button key={id} type="button" className="ad-rail-item cursor-interaction" aria-label={name} aria-pressed={view === id} onClick={() => onView(id)} data-tooltip={name}><Icon size={20} /><span>{name}</span></button>)}
      <div className="ad-rail-bottom"><span className="ad-rail-rule" /><div className="ad-company">KO</div><span>KobeOS</span></div>
    </aside>
    <div className="ad-window">
      <header className="ad-topbar">
        <div className="ad-product"><span>KOBE AIR</span><span className="ad-divider">/</span><span className="ad-subtle">Freight workspace</span></div>
        <div className="ad-top-actions"><span className="ad-desktop-label"><Command size={13} /> KobeOS</span><button type="button" className="ad-text-button cursor-interaction" onClick={() => setToolsOpen(v => !v)} aria-expanded={toolsOpen}>Workspaces <ChevronDown size={14} /></button></div>
      </header>
      {toolsOpen && <nav className="ad-toolstrip" aria-label="Operational workspaces">{TOOLS.map(({ id, label: name, icon: Icon }) => <button type="button" className="ad-text-button cursor-interaction" key={id} onClick={() => { onView(id); setToolsOpen(false); }}><Icon size={15} />{name}</button>)}</nav>}
      <main ref={contentRef} className="ad-content">
        {view === 'dashboard' && <>
          <div className="ad-page-heading"><div><div className="ad-overline">CHINA TO TANZANIA / AIR FREIGHT</div><h1>A world closer.</h1><p>Your cargo, your routes, your next move.</p></div><button className="ad-primary cursor-interaction" type="button" onClick={() => onView('warehouse')}><ScanLine size={16} /> Warehouse desk <ArrowUpRight size={16} /></button></div>
          {previewData && <div className="ad-preview-tag">Interface preview · sample shipments</div>}
          {!previewData && (loading || error) && <div className="ad-load-state" role={error ? 'alert' : 'status'}>{loading ? <><Loader2 size={16} className="animate-spin" /> Loading cargo records</> : <><span>{error}</span><button className="ad-text-button cursor-interaction" type="button" onClick={() => setRevision(v => v + 1)}><RefreshCw size={14} /> Retry</button></>}</div>}
          <Overview data={data} available={Boolean(previewData) || (!loading && !error)} onView={onView} onMoney={onMoney} />
        </>}
        {view === 'tracking' && <RouteStudio onFlights={() => onView('flights')} />}
        {view === 'money' && (previewData ? <MoneyDesk onMoney={onMoney} preview /> : <CargoFinanceDesk />)}
        {view !== 'dashboard' && view !== 'tracking' && view !== 'money' && <div className={legacy ? 'ad-legacy' : 'ad-flight-workspace'}>{children}</div>}
      </main>
      <footer className="ad-footer"><span>GUANGZHOU <span className="ad-footer-line" /> DAR ES SALAAM</span><span>{previewData ? 'Design preview' : 'Cargo records · latest 50'}<span className="ad-footer-dot">·</span>KOBE OS</span></footer>
    </div>
  </div>;
}

function Overview({ data, available, onView, onMoney }: { data: AirDeskData; available: boolean; onView: (view: AirDesktopView) => void; onMoney: () => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const shipments = available ? data.shipments.slice(0, 5) : [];
  const selected = shipments.find(s => s.id === selectedId) ?? shipments[0];
  const holds = data.parcels.filter(p => p.lifecycleStatus === 'ON_HOLD');
  return <>
    <div className="ad-feature-grid">
      <section className="ad-passport">
        <div className="ad-passport-top"><span className="ad-overline">THE CARGO PASSPORT</span><span className="ad-chip"><span className="ad-dot" />{selected ? label(selected.status) : 'Route network'}</span></div>
        <div className="ad-airports"><div><span>ORIGIN</span><strong>{selected?.origin || 'Guangzhou'}</strong><small>China gateway</small></div><div className="ad-journey-mark"><span /><Plane size={28} strokeWidth={1.3} /><span /></div><div><span>DESTINATION</span><strong>{selected?.destination || 'Dar es Salaam'}</strong><small>Tanzania gateway</small></div></div>
        <div className="ad-flight-line"><div><span>SHIPMENT</span><b>{selected?.shipmentId ?? 'Select a shipment'}</b></div><div><span>ASSIGNED FLIGHT</span><b>{selected?.flightNumber || 'Not assigned'}</b></div><button type="button" className="ad-round-button cursor-interaction" aria-label="Open flight radar" onClick={() => onView('flights')}><ArrowUpRight size={21} /></button></div>
        <div className="ad-ticket-tear"><span /><i /><span /></div>
        <div className="ad-passport-bottom"><div><span className="ad-label">CURRENT RECORD</span><p>{selected ? `${Number(selected.weight || 0).toLocaleString()} kg · ${label(selected.status)}` : 'Receive, consolidate and dispatch.'}</p></div><button type="button" className="ad-text-button cursor-interaction" onClick={() => onView('tracking')}>Explore route <ArrowRight size={15} /></button></div>
      </section>
      <aside className="ad-action-panel"><div className="ad-overline">THE NEXT MOVE</div><h2>Keep things<br />moving<span>.</span></h2><div className="ad-action-list"><button type="button" className="cursor-interaction" onClick={() => onView('warehouse')}><span className="ad-number">01</span><span>Receive a parcel<small>Scan it. Check it. Shelf it.</small></span><ArrowUpRight size={18} /></button><button type="button" className="cursor-interaction" onClick={() => onView('consolidation')}><span className="ad-number">02</span><span>Build a shipment<small>Bring your parcels together.</small></span><ArrowUpRight size={18} /></button><button type="button" className="cursor-interaction" onClick={onMoney}><span className="ad-number">03</span><span>Move money<small>Suppliers & freight, via KobePay.</small></span><ArrowUpRight size={18} /></button></div></aside>
    </div>
    <div className="ad-lower-grid">
      <section className="ad-manifest"><div className="ad-section-heading"><h2>The manifest <span>{available ? shipments.length.toString().padStart(2, '0') : '—'}</span></h2><button type="button" className="ad-text-button cursor-interaction" onClick={() => onView('flights')}>Flight board <ArrowUpRight size={15} /></button></div>
        {shipments.length ? shipments.map((s, i) => <button type="button" className="ad-manifest-row cursor-interaction" aria-pressed={selected?.id === s.id} key={s.id} onClick={() => setSelectedId(s.id)}><span className="ad-number">{String(i + 1).padStart(2, '0')}</span><span><b>{s.shipmentId}</b><small>{s.origin} → {s.destination}</small></span><span className="ad-manifest-state">{label(s.status)}</span><ChevronRight size={16} /></button>) : <div className="ad-empty"><Package size={25} /><h3>{available ? 'Your next shipment starts here.' : 'Current shipment records are unavailable.'}</h3><p>Received cargo and assigned flights will appear after a successful refresh.</p><button type="button" className="ad-text-button cursor-interaction" onClick={() => onView('warehouse')}>Open warehouse <ArrowRight size={15} /></button></div>}
      </section>
      <section className="ad-attention"><div className="ad-section-heading"><h2>On the ground</h2><span className="ad-label">WAREHOUSE</span></div><div className="ad-ground-tally"><strong>{available ? data.parcels.filter(p => ['STORED', 'AWAITING_STORAGE', 'FOR_CONSOLIDATION'].includes(p.lifecycleStatus ?? '')).length.toString().padStart(2, '0') : '—'}</strong><div>parcels in the warehouse<small>From the latest 50 parcel records</small></div></div><div className="ad-attention-note"><span className="ad-dot" /><p>{!available ? 'Warehouse status is unavailable until records load.' : holds.length ? `${holds.length} parcel${holds.length === 1 ? '' : 's'} on hold. Open the desk to review.` : 'No holds in the loaded parcel records.'}</p></div><button className="ad-text-button cursor-interaction" type="button" onClick={() => onView('warehouse')}>Go to warehouse <ArrowUpRight size={15} /></button></section>
    </div>
  </>;
}

function RouteStudio({ onFlights }: { onFlights: () => void }) {
  const [lane, setLane] = useState<'normal' | 'special'>('normal');
  const special = lane === 'special';
  const steps = special ? [['01', 'Guangzhou', 'Origin warehouse', 'Receive & verify'], ['02', 'Hong Kong', 'Export gateway', 'Ground transfer · export checks'], ['03', 'Ethiopia', 'Connection hub', 'Aircraft transfer'], ['04', 'Zanzibar', 'Tanzania gateway', 'Arrival & clearance'], ['05', 'Dar es Salaam', 'Destination office', 'Collection & delivery']] : [['01', 'Guangzhou', 'Origin warehouse', 'Receive & verify'], ['02', 'China export', 'Departure gateway', 'Checks · carrier acceptance'], ['03', 'Zanzibar', 'Tanzania gateway', 'Arrival & clearance'], ['04', 'Dar es Salaam', 'Destination office', 'Collection & delivery']];
  return <><div className="ad-page-heading"><div><div className="ad-overline">THE CHINA — TANZANIA CORRIDOR</div><h1>Every stop.<br />One clear journey.</h1></div><button type="button" className="ad-primary cursor-interaction" onClick={onFlights}>Open flight radar <ArrowUpRight size={16} /></button></div><div className="ad-route-layout"><section className="ad-route-index"><span className="ad-overline">CHOOSE YOUR LANE</span><button type="button" className="ad-lane cursor-interaction" aria-pressed={!special} onClick={() => setLane('normal')}><span>N1</span><div><h2>Normal goods</h2><p>Guangzhou / Zanzibar / Dar</p></div><ArrowUpRight size={18} /></button><button type="button" className="ad-lane cursor-interaction" aria-pressed={special} onClick={() => setLane('special')}><span>S1</span><div><h2>Special goods</h2><p>Via Hong Kong & Ethiopia</p></div><ArrowUpRight size={18} /></button><div className="ad-route-advice"><ShieldCheck size={22} /><h3>Right goods. Right route.</h3><p>Eligibility, carrier acceptance and documents are checked before departure.</p></div></section><section className="ad-route-detail" aria-live="polite"><div className="ad-route-title"><span className="ad-overline">ROUTE {special ? 'S1' : 'N1'}</span><span className="ad-chip">Service template</span></div><div className="ad-route-endpoints"><strong>CN</strong><Plane size={30} strokeWidth={1} /><strong>TZ</strong></div><ol className="ad-stop-list">{steps.map(([n, city, role, action]) => <li key={city}><span>{n}</span><div><h3>{city}</h3><p>{role}</p></div><small>{action}</small></li>)}</ol><p className="ad-route-footnote">Template only · flight, service date and transfer mode are confirmed per departure.</p></section></div></>;
}

function MoneyDesk({ onMoney, preview }: { onMoney: () => void; preview: boolean }) {
  const [purpose, setPurpose] = useState<'supplier' | 'freight'>('supplier');
  return <><div className="ad-page-heading"><div><div className="ad-overline">TRADE FINANCE / POWERED BY KOBEPAY</div><h1>Money that<br />moves with you.</h1><p>From your Tanzania desk to your China suppliers.</p></div><Wallet size={46} strokeWidth={1} /></div><div className="ad-money-layout"><section className="ad-finance-pass"><span className="ad-overline">KOBEPAY / BUSINESS</span><div className="ad-currency-route"><strong>TZS</strong><ArrowUpRight size={40} strokeWidth={1} /><strong>CNY</strong></div><p>Your trade. Connected.</p><div className="ad-finance-bottom"><span>Supplier payments<br />Freight & settlement</span><span className="ad-finance-logo">kobe<span>pay</span></span></div></section><section className="ad-money-action"><div className="ad-purpose-tabs"><button type="button" className="cursor-interaction" aria-pressed={purpose === 'supplier'} onClick={() => setPurpose('supplier')}>Pay a supplier</button><button type="button" className="cursor-interaction" aria-pressed={purpose === 'freight'} onClick={() => setPurpose('freight')}>Pay freight</button></div><h2>{purpose === 'supplier' ? 'China, within reach.' : 'The next leg, covered.'}</h2><p>{purpose === 'supplier' ? 'Select a supplier, review the exchange quote and follow your transfer through KobePay.' : 'Review your cargo invoice and allocate confirmed funding to the freight payment.'}</p><ul className="ad-money-checks">{(purpose === 'supplier' ? ['A clear quote before you commit', 'Verified beneficiary & payment instructions', 'Funding and supplier payout tracked separately'] : ['An itemized freight invoice', 'Payments linked to the correct shipment', 'A receipt and a clear outstanding balance']).map(t => <li key={t}><Check size={15} />{t}</li>)}</ul><button type="button" className="ad-primary cursor-interaction" disabled={preview} onClick={onMoney}>{preview ? 'KobePay opens inside KobeOS' : 'Continue in KobePay'}<ArrowUpRight size={17} /></button><small>{preview ? 'Design preview · no money moves here.' : 'Opens the existing KobePay finance application.'}</small></section></div></>;
}
