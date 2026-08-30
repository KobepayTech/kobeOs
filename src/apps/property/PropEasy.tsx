import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2, CheckCircle2, ExternalLink, Globe2, Home, Loader2, Plus, QrCode, Receipt, RefreshCw,
  Search, Users, Wallet, X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { QRCodeSVG } from 'qrcode.react';

type PropertyType = 'residential' | 'commercial' | 'mixed';
type UnitStatus = 'vacant' | 'occupied' | 'turnover' | 'unavailable' | 'maintenance';
type TenantStatus = 'active' | 'past' | 'pending' | 'late' | 'moving_out';

interface PropertyRow {
  id: string;
  name: string;
  address?: string;
  city?: string;
  plotNo?: string;
  blockNo?: string;
  type?: PropertyType;
  totalUnits?: number;
  imageUrl?: string;
  notes?: string;
  publicSlug?: string | null;
  marketplaceEnabled?: boolean;
  marketplaceTagline?: string;
  marketplaceBrandColor?: string;
}

interface UnitRow {
  id: string;
  propertyId: string;
  unitNumber: string;
  type?: string;
  bedrooms?: number;
  bathrooms?: number;
  floor?: string;
  rentAmount?: number | string;
  currency?: string;
  status?: UnitStatus;
}

interface TenantRow {
  id: string;
  unitId?: string | null;
  name: string;
  phone: string;
  email?: string;
  leaseStart?: string;
  leaseEnd?: string;
  status?: TenantStatus;
  notes?: string;
}

interface PaymentRow {
  id: string;
  tenantId: string;
  unitId: string;
  amount: number | string;
  currency: string;
  forMonth: string;
  paidAt: string;
  method?: string;
  reference?: string;
}

interface MarketplaceMap {
  property: PropertyRow;
  floors: Array<{ id: string; name: string; code: string; level: number; shopCount: number }>;
  shops: Array<{ id: string; floorId: string; unitNumber: string; publicCode: string; status: 'AVAILABLE' | 'CLAIMED' | 'INACTIVE'; businessId?: string | null; categoryId?: string }>;
  businesses: Array<{ id: string; name: string; publicSlug: string; phone?: string; tier?: string }>;
}

type Tab = 'portfolio' | 'units' | 'tenants' | 'payments' | 'marketplace';
const money = (n: number | string, c = 'TZS') => `${c === 'TZS' ? 'TSh ' : `${c} `}${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const shortDate = (v?: string) => v ? new Date(v).toLocaleDateString() : '—';

export default function PropEasyApp() {
  const [tab, setTab] = useState<Tab>('portfolio');
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<'property' | 'unit' | 'tenant' | 'payment' | null>(null);
  const [marketplaceMap, setMarketplaceMap] = useState<MarketplaceMap | null>(null);
  const [marketplaceLoading, setMarketplaceLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [p, u, t, pay] = await Promise.all([
        api<PropertyRow[]>('/property/properties', { offlineFallback: false }),
        api<UnitRow[]>('/property/units', { offlineFallback: false }),
        api<TenantRow[]>('/property/tenants', { offlineFallback: false }),
        api<PaymentRow[]>('/property/payments', { offlineFallback: false }),
      ]);
      const props = Array.isArray(p) ? p : [];
      setProperties(props);
      setUnits(Array.isArray(u) ? u : []);
      setTenants(Array.isArray(t) ? t : []);
      setPayments(Array.isArray(pay) ? pay : []);
      setSelectedPropertyId((current) => current || props[0]?.id || '');
    } catch (e) {
      setProperties([]); setUnits([]); setTenants([]); setPayments([]);
      setError((e as Error).message || 'Could not load Property.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (tab !== 'marketplace' || !selectedPropertyId) { setMarketplaceMap(null); return; }
    let active = true;
    setMarketplaceLoading(true);
    api<MarketplaceMap>(`/commerce/properties/${selectedPropertyId}/map`, { offlineFallback: false })
      .then((value) => { if (active) setMarketplaceMap(value); })
      .catch((reason) => { if (active) setError((reason as Error).message || 'Could not load marketplace.'); })
      .finally(() => { if (active) setMarketplaceLoading(false); });
    return () => { active = false; };
  }, [tab, selectedPropertyId]);

  const unitById = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);
  const propertyById = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);
  const tenantById = useMemo(() => new Map(tenants.map((t) => [t.id, t])), [tenants]);
  const visibleUnits = selectedPropertyId ? units.filter((u) => u.propertyId === selectedPropertyId) : units;
  const visibleTenantIds = new Set(visibleUnits.map((u) => u.id));
  const visibleTenants = selectedPropertyId ? tenants.filter((t) => !t.unitId || visibleTenantIds.has(t.unitId)) : tenants;
  const q = search.trim().toLowerCase();

  const occupied = units.filter((u) => u.status === 'occupied').length;
  const rentRoll = units.reduce((sum, u) => sum + Number(u.rentAmount || 0), 0);
  const paidTotal = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const currency = units.find((u) => u.currency)?.currency ?? payments.find((p) => p.currency)?.currency ?? 'TZS';

  return (
    <div className="h-full min-h-0 flex flex-col bg-[#f5f7fb] text-slate-900 overflow-hidden" data-surface="light">
      <header className="shrink-0 bg-[#10223f] text-white">
        <div className="h-16 px-4 sm:px-6 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-400 text-[#10223f] grid place-items-center"><Building2 className="h-5 w-5" /></div>
          <div><h1 className="font-black">Kobe Property</h1><p className="text-[11px] text-white/55">Portfolio · units · tenants · rent payments</p></div>
          {properties.length > 0 && <select value={selectedPropertyId} onChange={(e) => setSelectedPropertyId(e.target.value)} className="ml-auto h-9 max-w-64 rounded-lg bg-white/10 border border-white/15 px-3 text-xs font-bold"><option value="">All properties</option>{properties.map((p) => <option key={p.id} value={p.id} className="text-black">{p.name}</option>)}</select>}
          <button onClick={() => void load()} disabled={loading} className={`${properties.length ? '' : 'ml-auto'} h-9 w-9 rounded-lg border border-white/15 grid place-items-center disabled:opacity-50`}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
        <nav className="px-3 sm:px-5 flex overflow-x-auto">{([['portfolio', 'Portfolio', Building2], ['units', 'Units', Home], ['tenants', 'Tenants', Users], ['payments', 'Payments', Receipt], ['marketplace', 'Marketplace', Globe2]] as const).map(([id, label, Icon]) => <button key={id} onClick={() => setTab(id)} className={`h-11 px-3 inline-flex items-center gap-2 text-xs font-black border-b-2 ${tab === id ? 'text-blue-300 border-blue-300' : 'text-white/55 border-transparent'}`}><Icon className="h-4 w-4" />{label}</button>)}</nav>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
        {error && <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 text-sm">{error}</div>}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Metric label="Properties" value={String(properties.length)} icon={<Building2 />} />
          <Metric label="Units occupied" value={`${occupied}/${units.length}`} icon={<Home />} />
          <Metric label="Rent roll" value={money(rentRoll, currency)} icon={<Wallet />} />
          <Metric label="Payments recorded" value={money(paidTotal, currency)} icon={<Receipt />} />
        </div>

        <div className="flex gap-2 items-center">
          <div className="relative flex-1 max-w-lg"><Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="w-full h-10 rounded-xl bg-white border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-blue-400" /></div>
          {tab !== 'marketplace' && <button onClick={() => setModal(tab === 'portfolio' ? 'property' : tab === 'units' ? 'unit' : tab === 'tenants' ? 'tenant' : 'payment')} className="h-10 px-3 rounded-xl bg-blue-600 text-white text-xs font-black inline-flex items-center gap-1.5"><Plus className="h-4 w-4" /> Add {tab === 'portfolio' ? 'property' : tab === 'units' ? 'unit' : tab === 'tenants' ? 'tenant' : 'payment'}</button>}
        </div>

        {loading && !properties.length && !units.length && !tenants.length ? <div className="py-24 grid place-items-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div> : tab === 'portfolio' ? (
          <Portfolio rows={properties.filter((p) => !q || `${p.name} ${p.address ?? ''} ${p.city ?? ''}`.toLowerCase().includes(q))} units={units} tenants={tenants} payments={payments} onSelect={(id) => { setSelectedPropertyId(id); setTab('units'); }} />
        ) : tab === 'units' ? (
          <Units rows={visibleUnits.filter((u) => !q || `${u.unitNumber} ${u.type ?? ''} ${u.floor ?? ''}`.toLowerCase().includes(q))} propertyById={propertyById} />
        ) : tab === 'tenants' ? (
          <Tenants rows={visibleTenants.filter((t) => !q || `${t.name} ${t.phone} ${t.email ?? ''}`.toLowerCase().includes(q))} unitById={unitById} propertyById={propertyById} payments={payments} />
        ) : tab === 'marketplace' ? (
          <MarketplaceAdmin map={marketplaceMap} loading={marketplaceLoading} property={propertyById.get(selectedPropertyId)} />
        ) : (
          <Payments rows={payments.filter((p) => {
            const t = tenantById.get(p.tenantId); const u = unitById.get(p.unitId);
            const inProperty = !selectedPropertyId || u?.propertyId === selectedPropertyId;
            return inProperty && (!q || `${t?.name ?? ''} ${p.reference ?? ''} ${p.method ?? ''}`.toLowerCase().includes(q));
          })} tenantById={tenantById} unitById={unitById} />
        )}
      </main>

      {modal && <CreateModal mode={modal} properties={properties} units={units} tenants={tenants} selectedPropertyId={selectedPropertyId} onClose={() => setModal(null)} onSaved={async () => { setModal(null); await load(); }} />}
    </div>
  );
}

function Portfolio({ rows, units, tenants, payments, onSelect }: { rows: PropertyRow[]; units: UnitRow[]; tenants: TenantRow[]; payments: PaymentRow[]; onSelect: (id: string) => void }) {
  if (!rows.length) return <Panel><Empty title="No properties yet" body="Add the first property, then add its units and tenants." /></Panel>;
  return <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{rows.map((p) => { const pu = units.filter((u) => u.propertyId === p.id); const unitIds = new Set(pu.map((u) => u.id)); const pt = tenants.filter((t) => t.unitId && unitIds.has(t.unitId)); const pp = payments.filter((pay) => unitIds.has(pay.unitId)); const cur = pu.find((u) => u.currency)?.currency ?? pp[0]?.currency ?? 'TZS'; return <button key={p.id} onClick={() => onSelect(p.id)} className="text-left rounded-2xl bg-white border border-slate-200 p-5 hover:border-blue-300 hover:shadow-sm"><div className="flex items-start"><div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-700 grid place-items-center"><Building2 className="h-5 w-5" /></div><span className="ml-auto text-[10px] uppercase font-black text-slate-400">{p.type ?? 'property'}</span></div><h3 className="font-black mt-4">{p.name}</h3><p className="text-xs text-slate-500 mt-1">{[p.address, p.city].filter(Boolean).join(', ') || 'No address saved'}</p><div className="grid grid-cols-3 gap-2 mt-4"><Mini label="Units" value={String(pu.length)} /><Mini label="Tenants" value={String(pt.length)} /><Mini label="Collected" value={money(pp.reduce((s, x) => s + Number(x.amount || 0), 0), cur)} /></div>{p.marketplaceEnabled && p.publicSlug && <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2"><span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wide text-emerald-700"><Globe2 className="h-3 w-3" /> Marketplace live</span><span className="mt-1 block truncate text-[10px] font-bold text-emerald-900">https://{p.publicSlug}.kobeapptz.com</span></div>}</button>; })}</div>;
}

function MarketplaceAdmin({ map, loading, property }: { map: MarketplaceMap | null; loading: boolean; property?: PropertyRow }) {
  if (!property) return <Panel><Empty title="Select a property" body="Choose a property to manage its public marketplace." /></Panel>;
  if (property.type === 'residential') return <Panel><Empty title="Residential property" body="Automatic storefronts and Shop IDs are created for commercial and mixed properties." /></Panel>;
  if (loading && !map) return <Panel><div className="py-20 grid place-items-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div></Panel>;
  const slug = map?.property.publicSlug || property.publicSlug;
  if (!map || !slug) return <Panel><Empty title="Marketplace is being provisioned" body="Save or refresh the property and KobeOS will assign its public domain and Shop IDs automatically." /></Panel>;
  const businessById = new Map(map.businesses.map((business) => [business.id, business]));
  const floorById = new Map(map.floors.map((floor) => [floor.id, floor]));
  const publicUrl = `https://${slug}.kobeapptz.com`;
  return <div className="space-y-4">
    <section className="overflow-hidden rounded-3xl bg-[#10223f] text-white shadow-sm">
      <div className="p-5 sm:p-6 flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-300 text-[#10223f]"><Globe2 className="h-7 w-7" /></div>
        <div className="min-w-0 flex-1"><span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">Public marketplace live</span><h2 className="mt-1 text-2xl font-black">{map.property.name}</h2><p className="mt-1 truncate text-xs text-white/55">{publicUrl}</p></div>
        <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-black text-[#10223f]">Open marketplace <ExternalLink className="h-4 w-4" /></a>
      </div>
      <div className="grid grid-cols-3 border-t border-white/10"><MiniDark label="Permanent shops" value={String(map.shops.filter((shop) => shop.status !== 'INACTIVE').length)} /><MiniDark label="Claimed" value={String(map.shops.filter((shop) => shop.status === 'CLAIMED').length)} /><MiniDark label="Available" value={String(map.shops.filter((shop) => shop.status === 'AVAILABLE').length)} /></div>
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex items-center gap-2"><QrCode className="h-5 w-5 text-emerald-700" /><div><h3 className="font-black">Permanent Shop IDs & QR codes</h3><p className="text-xs text-slate-500">The QR belongs to the physical unit. When tenants change, the QR stays the same and KobeOS changes the business behind it.</p></div></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{map.shops.filter((shop) => shop.status !== 'INACTIVE').map((shop) => {
        const business = shop.businessId ? businessById.get(shop.businessId) : undefined;
        const floor = floorById.get(shop.floorId);
        const url = `${publicUrl}/shop/${shop.publicCode}`;
        return <article key={shop.id} className="rounded-2xl border border-slate-200 p-4">
          <div className="flex gap-4"><div className="shrink-0 rounded-xl border bg-white p-2"><QRCodeSVG value={url} size={82} level="M" /></div><div className="min-w-0 flex-1"><span className={`inline-block rounded-full px-2 py-1 text-[9px] font-black ${shop.status === 'CLAIMED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{shop.status}</span><b className="mt-2 block font-mono text-sm">{shop.publicCode}</b><span className="block text-[10px] text-slate-500">{floor?.name || 'Ground'} · Unit {shop.unitNumber}</span><span className="mt-2 block truncate text-xs font-bold text-slate-800">{business?.name || 'Ready for tenant claim'}</span></div></div>
          <div className="mt-3 flex gap-2"><a href={url} target="_blank" rel="noreferrer" className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-xl border text-[10px] font-black">Open <ExternalLink className="h-3 w-3" /></a>{shop.status === 'AVAILABLE' && <a href={`${publicUrl}/claim-shop?shop=${encodeURIComponent(shop.publicCode)}`} target="_blank" rel="noreferrer" className="inline-flex h-9 flex-1 items-center justify-center rounded-xl bg-emerald-600 text-[10px] font-black text-white">Claim link</a>}</div>
        </article>;
      })}</div>
    </section>
  </div>;
}

function MiniDark({ label, value }: { label: string; value: string }) { return <div className="p-4 text-center"><span className="text-[9px] uppercase tracking-wide text-white/40">{label}</span><b className="mt-1 block text-lg">{value}</b></div>; }

function Units({ rows, propertyById }: { rows: UnitRow[]; propertyById: Map<string, PropertyRow> }) {
  if (!rows.length) return <Panel><Empty title="No units" body="Add the first unit to the selected property." /></Panel>;
  return <Panel><div className="divide-y divide-slate-100">{rows.map((u) => <div key={u.id} className="py-3 flex items-center gap-3"><div className="h-10 w-10 rounded-xl bg-slate-100 grid place-items-center"><Home className="h-5 w-5 text-slate-500" /></div><div className="flex-1 min-w-0"><b className="block">Unit {u.unitNumber}</b><span className="text-xs text-slate-500">{propertyById.get(u.propertyId)?.name}{u.type ? ` · ${u.type}` : ''}{u.floor ? ` · floor ${u.floor}` : ''}</span></div><div className="text-right"><b className="text-sm">{money(u.rentAmount ?? 0, u.currency ?? 'TZS')}</b><span className="block"><UnitPill status={u.status ?? 'vacant'} /></span></div></div>)}</div></Panel>;
}

function Tenants({ rows, unitById, propertyById, payments }: { rows: TenantRow[]; unitById: Map<string, UnitRow>; propertyById: Map<string, PropertyRow>; payments: PaymentRow[] }) {
  if (!rows.length) return <Panel><Empty title="No tenants" body="Add a tenant and assign them to a unit." /></Panel>;
  return <Panel><div className="divide-y divide-slate-100">{rows.map((t) => { const u = t.unitId ? unitById.get(t.unitId) : undefined; const paid = payments.filter((p) => p.tenantId === t.id).reduce((s, p) => s + Number(p.amount || 0), 0); return <div key={t.id} className="py-3 flex items-center gap-3"><div className="h-10 w-10 rounded-full bg-blue-50 text-blue-700 grid place-items-center font-black text-xs">{t.name.split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase()}</div><div className="min-w-0 flex-1"><b className="block truncate">{t.name}</b><span className="text-xs text-slate-500">{t.phone}{u ? ` · ${propertyById.get(u.propertyId)?.name ?? ''} / ${u.unitNumber}` : ' · Unassigned'}</span><span className="block text-[10px] text-slate-400">Lease {shortDate(t.leaseStart)} → {shortDate(t.leaseEnd)}</span></div><div className="text-right"><span className={`text-[10px] font-black ${t.status === 'late' ? 'text-rose-600' : 'text-emerald-600'}`}>{(t.status ?? 'active').replace('_', ' ').toUpperCase()}</span><span className="block text-xs text-slate-500 mt-1">Paid {money(paid, u?.currency ?? 'TZS')}</span></div></div>; })}</div></Panel>;
}

function Payments({ rows, tenantById, unitById }: { rows: PaymentRow[]; tenantById: Map<string, TenantRow>; unitById: Map<string, UnitRow> }) {
  if (!rows.length) return <Panel><Empty title="No rent payments" body="Record a real payment when rent is received." /></Panel>;
  return <Panel><div className="divide-y divide-slate-100">{rows.slice().sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()).map((p) => <div key={p.id} className="py-3 flex items-center gap-3"><div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-700 grid place-items-center"><Receipt className="h-5 w-5" /></div><div className="flex-1"><b>{tenantById.get(p.tenantId)?.name ?? 'Tenant'}</b><span className="block text-xs text-slate-500">Unit {unitById.get(p.unitId)?.unitNumber ?? '—'} · {p.method || 'Payment'} · {p.reference || 'no reference'}</span><span className="block text-[10px] text-slate-400">For {shortDate(p.forMonth)} · paid {shortDate(p.paidAt)}</span></div><b>{money(p.amount, p.currency)}</b></div>)}</div></Panel>;
}

function CreateModal({ mode, properties, units, tenants, selectedPropertyId, onClose, onSaved }: { mode: 'property' | 'unit' | 'tenant' | 'payment'; properties: PropertyRow[]; units: UnitRow[]; tenants: TenantRow[]; selectedPropertyId: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [form, setForm] = useState<Record<string, string>>({ propertyId: selectedPropertyId || properties[0]?.id || '', currency: 'TZS', status: 'vacant', tenantStatus: 'active', paidAt: new Date().toISOString().slice(0, 10), forMonth: new Date().toISOString().slice(0, 10), method: 'Cash' });
  const save = async () => {
    setBusy(true); setError('');
    try {
      if (mode === 'property') await api('/property/properties', { method: 'POST', offlineFallback: false, body: JSON.stringify({ name: form.name, address: form.address || undefined, city: form.city || undefined, type: (form.type || 'residential') as PropertyType }) });
      if (mode === 'unit') await api('/property/units', { method: 'POST', offlineFallback: false, body: JSON.stringify({ propertyId: form.propertyId, unitNumber: form.unitNumber, type: form.unitType || undefined, floor: form.floor || undefined, rentAmount: Number(form.rentAmount || 0), currency: form.currency || 'TZS', status: (form.status || 'vacant') as UnitStatus }) });
      if (mode === 'tenant') await api('/property/tenants', { method: 'POST', offlineFallback: false, body: JSON.stringify({ unitId: form.unitId || undefined, name: form.name, phone: form.phone, email: form.email || undefined, leaseStart: form.leaseStart || undefined, leaseEnd: form.leaseEnd || undefined, status: (form.tenantStatus || 'active') as TenantStatus }) });
      if (mode === 'payment') {
        const unit = units.find((u) => u.id === form.unitId); if (!unit) throw new Error('Select a unit.');
        await api('/property/payments', { method: 'POST', offlineFallback: false, body: JSON.stringify({ tenantId: form.tenantId, unitId: form.unitId, amount: Number(form.amount || 0), currency: unit.currency || 'TZS', forMonth: new Date(form.forMonth).toISOString(), paidAt: new Date(form.paidAt).toISOString(), method: form.method || undefined, reference: form.reference || undefined }) });
      }
      await onSaved();
    } catch (e) { setError((e as Error).message || `Could not create ${mode}.`); } finally { setBusy(false); }
  };
  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const tenantUnits = units.filter((u) => !form.propertyId || u.propertyId === form.propertyId);
  return <div className="fixed inset-0 z-50 bg-black/45 grid place-items-center p-4" onMouseDown={onClose}><div onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-5 shadow-xl"><div className="flex items-center"><h2 className="font-black capitalize">Add {mode}</h2><button onClick={onClose} className="ml-auto"><X className="h-5 w-5" /></button></div><div className="mt-4 grid gap-3">{mode === 'property' && <><Field label="Property name"><input className="control-light" value={form.name || ''} onChange={(e) => set('name', e.target.value)} /></Field><Field label="Address"><input className="control-light" value={form.address || ''} onChange={(e) => set('address', e.target.value)} /></Field><div className="grid grid-cols-2 gap-3"><Field label="City"><input className="control-light" value={form.city || ''} onChange={(e) => set('city', e.target.value)} /></Field><Field label="Type"><select className="control-light" value={form.type || 'residential'} onChange={(e) => set('type', e.target.value)}><option value="residential">Residential</option><option value="commercial">Commercial</option><option value="mixed">Mixed</option></select></Field></div>{(form.type === 'commercial' || form.type === 'mixed') && <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-[11px] leading-relaxed text-emerald-800"><b>Marketplace included.</b> KobeOS will automatically create a public property website, permanent Shop IDs and claimable storefronts as you add units.</div>}</>}{mode === 'unit' && <><Field label="Property"><select className="control-light" value={form.propertyId || ''} onChange={(e) => set('propertyId', e.target.value)}>{properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field><div className="grid grid-cols-2 gap-3"><Field label="Unit number"><input className="control-light" value={form.unitNumber || ''} onChange={(e) => set('unitNumber', e.target.value)} /></Field><Field label="Type"><input className="control-light" value={form.unitType || ''} onChange={(e) => set('unitType', e.target.value)} /></Field></div><div className="grid grid-cols-2 gap-3"><Field label="Rent amount"><input type="number" className="control-light" value={form.rentAmount || ''} onChange={(e) => set('rentAmount', e.target.value)} /></Field><Field label="Currency"><input className="control-light" value={form.currency || 'TZS'} onChange={(e) => set('currency', e.target.value.toUpperCase())} /></Field></div><div className="grid grid-cols-2 gap-3"><Field label="Floor"><input className="control-light" value={form.floor || ''} onChange={(e) => set('floor', e.target.value)} /></Field><Field label="Status"><select className="control-light" value={form.status || 'vacant'} onChange={(e) => set('status', e.target.value)}>{['vacant','occupied','turnover','maintenance','unavailable'].map((v) => <option key={v}>{v}</option>)}</select></Field></div></>}{mode === 'tenant' && <><Field label="Unit"><select className="control-light" value={form.unitId || ''} onChange={(e) => set('unitId', e.target.value)}><option value="">Unassigned</option>{units.map((u) => <option key={u.id} value={u.id}>{properties.find((p) => p.id === u.propertyId)?.name} · {u.unitNumber}</option>)}</select></Field><Field label="Tenant name"><input className="control-light" value={form.name || ''} onChange={(e) => set('name', e.target.value)} /></Field><div className="grid grid-cols-2 gap-3"><Field label="Phone"><input className="control-light" value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} /></Field><Field label="Email"><input className="control-light" value={form.email || ''} onChange={(e) => set('email', e.target.value)} /></Field></div><div className="grid grid-cols-2 gap-3"><Field label="Lease start"><input type="date" className="control-light" value={form.leaseStart || ''} onChange={(e) => set('leaseStart', e.target.value)} /></Field><Field label="Lease end"><input type="date" className="control-light" value={form.leaseEnd || ''} onChange={(e) => set('leaseEnd', e.target.value)} /></Field></div></>}{mode === 'payment' && <><Field label="Tenant"><select className="control-light" value={form.tenantId || ''} onChange={(e) => { set('tenantId', e.target.value); const t = tenants.find((x) => x.id === e.target.value); if (t?.unitId) set('unitId', t.unitId); }}><option value="">Select tenant</option>{tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field><Field label="Unit"><select className="control-light" value={form.unitId || ''} onChange={(e) => set('unitId', e.target.value)}><option value="">Select unit</option>{tenantUnits.map((u) => <option key={u.id} value={u.id}>{properties.find((p) => p.id === u.propertyId)?.name} · {u.unitNumber}</option>)}</select></Field><div className="grid grid-cols-2 gap-3"><Field label="Amount"><input type="number" className="control-light" value={form.amount || ''} onChange={(e) => set('amount', e.target.value)} /></Field><Field label="Method"><input className="control-light" value={form.method || 'Cash'} onChange={(e) => set('method', e.target.value)} /></Field></div><div className="grid grid-cols-2 gap-3"><Field label="For period"><input type="date" className="control-light" value={form.forMonth || ''} onChange={(e) => set('forMonth', e.target.value)} /></Field><Field label="Paid date"><input type="date" className="control-light" value={form.paidAt || ''} onChange={(e) => set('paidAt', e.target.value)} /></Field></div><Field label="Reference"><input className="control-light" value={form.reference || ''} onChange={(e) => set('reference', e.target.value)} /></Field></>}{error && <p className="text-xs text-rose-600">{error}</p>}<button onClick={() => void save()} disabled={busy} className="h-10 rounded-xl bg-blue-600 text-white font-black disabled:opacity-50">{busy ? 'Saving…' : `Save ${mode}`}</button></div></div></div>;
}

function Panel({ children }: { children: React.ReactNode }) { return <section className="rounded-2xl bg-white border border-slate-200 p-4">{children}</section>; }
function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) { return <div className="rounded-2xl bg-white border border-slate-200 p-4"><div className="h-8 w-8 rounded-lg bg-slate-100 text-slate-500 grid place-items-center">{icon}</div><span className="block mt-3 text-xs text-slate-500">{label}</span><b className="block mt-1 truncate">{value}</b></div>; }
function Mini({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-2"><span className="text-[9px] uppercase text-slate-400">{label}</span><b className="block text-xs truncate">{value}</b></div>; }
function Empty({ title, body }: { title: string; body: string }) { return <div className="py-14 text-center"><CheckCircle2 className="h-9 w-9 mx-auto text-slate-300" /><b className="block mt-3">{title}</b><p className="text-sm text-slate-500 mt-1">{body}</p></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1 text-xs text-slate-500">{label}{children}</label>; }
function UnitPill({ status }: { status: UnitStatus }) { const cls = status === 'occupied' ? 'text-emerald-600' : status === 'maintenance' || status === 'unavailable' ? 'text-rose-600' : 'text-blue-600'; return <span className={`text-[10px] font-black uppercase ${cls}`}>{status}</span>; }