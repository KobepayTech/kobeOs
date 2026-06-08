import React, { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type Row = Record<string, any>;
type Tab = 'dashboard' | 'parcels' | 'shipments' | 'flights' | 'drivers' | 'routes' | 'hubs' | 'airlines' | 'customs' | 'events' | 'deliveries' | 'analytics';
type Field = { name: string; label: string; type?: string; options?: string[] };
type Resource = { key: Tab; title: string; path: string; columns: string[]; fields: Field[]; create?: boolean; update?: boolean; extra?: (row: Row) => React.ReactNode };

const empty: Record<Tab, Row[]> = { dashboard: [], parcels: [], shipments: [], flights: [], drivers: [], routes: [], hubs: [], airlines: [], customs: [], events: [], deliveries: [], analytics: [] };
const money = (v: unknown, c = 'TZS') => `${c} ${Number(v || 0).toLocaleString()}`;
const fmt = (v: unknown) => String(v ?? '');
const nowLocal = () => new Date().toISOString().slice(0, 16);

export default function KobeCargo() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [data, setData] = useState<Record<Tab, Row[]>>(empty);
  const [analytics, setAnalytics] = useState<Row>({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('KOBECARGO Air Route Flow UI ready.');
  const [form, setForm] = useState<{ resource: Resource; row?: Row } | null>(null);

  const resources = useMemo<Resource[]>(() => [
    { key: 'parcels', title: 'Parcels / QR Intake', path: '/cargo/parcels', create: true, update: true, columns: ['parcelId', 'senderName', 'ownerName', 'destination', 'weight', 'paymentMode', 'status'], fields: [
      f('parcelId', 'Parcel Code'), f('senderName', 'Sender Name'), f('senderPhone', 'Sender Phone'), f('ownerName', 'Owner Name'), f('ownerPhone', 'Owner Phone'), f('destination', 'Destination'), f('packageCount', 'Package Count', 'number'), f('weight', 'Weight kg', 'number'), f('description', 'Description'), select('paymentMode', 'Payment Mode', ['PAY_NOW', 'PAY_ON_ARRIVAL'])
    ], extra: (r) => <StatusButton label="Transit" onClick={() => patch(`/cargo/parcels/${r.id}/status`, { status: 'IN_TRANSIT' })} /> },
    { key: 'shipments', title: 'Shipments', path: '/cargo/shipments', create: true, update: true, columns: ['shipmentId', 'origin', 'destination', 'weight', 'carrier', 'flightNumber', 'status'], fields: [
      f('shipmentId', 'Shipment ID'), f('origin', 'Origin'), f('destination', 'Destination'), f('weight', 'Weight kg', 'number'), f('carrier', 'Carrier'), f('flightNumber', 'Flight Number'), f('etd', 'ETD', 'datetime-local'), f('eta', 'ETA', 'datetime-local')
    ], extra: (r) => <StatusButton label="Load" onClick={() => patch(`/cargo/shipments/${r.id}/status`, { status: 'LOADING' })} /> },
    { key: 'flights', title: 'Flights', path: '/cargo/flights', create: true, update: true, columns: ['flightNumber', 'origin', 'destination', 'carrier', 'capacityKg', 'bookedKg', 'status'], fields: [
      f('flightNumber', 'Flight Number'), f('origin', 'Origin'), f('destination', 'Destination'), f('departureAt', 'Departure', 'datetime-local'), f('arrivalAt', 'Arrival', 'datetime-local'), f('carrier', 'Carrier'), f('capacityKg', 'Capacity kg', 'number'), f('status', 'Status')
    ] },
    { key: 'drivers', title: 'Drivers', path: '/cargo/drivers', create: true, update: true, columns: ['name', 'phone', 'vehicle', 'plateNumber', 'status', 'rating'], fields: [f('name', 'Name'), f('phone', 'Phone'), f('vehicle', 'Vehicle'), f('plateNumber', 'Plate Number'), select('status', 'Status', ['AVAILABLE', 'ON_TRIP', 'OFF_DUTY'])] },
    { key: 'routes', title: 'Air Route Planner', path: '/cargo/air/routes', create: true, columns: ['routeCode', 'priority', 'origin', 'destination', 'selectedAirline', 'etaHours', 'riskLevel', 'status'], fields: [
      f('routeCode', 'Route Code'), select('priority', 'Priority', ['STANDARD', 'EXPRESS', 'SMART_MULTI_HUB']), f('origin', 'Origin'), f('destination', 'Destination'), f('cargoType', 'Cargo Type'), f('weightKg', 'Weight kg', 'number'), f('selectedAirline', 'Airline Code'), f('selectedFlightNumber', 'Flight Number'), f('estimatedFlightHours', 'Flight Hours', 'number'), f('customsDelayHours', 'Customs Delay Hours', 'number'), f('transitDelayHours', 'Transit Delay Hours', 'number'), f('deliveryHours', 'Delivery Hours', 'number')
    ], extra: (r) => <StatusButton label="Reroute" onClick={() => post(`/cargo/air/routes/${r.id}/reroute`, {})} /> },
    { key: 'hubs', title: 'Transit Hubs', path: '/cargo/air/hubs', create: true, columns: ['code', 'name', 'city', 'country', 'type', 'delayHours', 'reliabilityScore'], fields: [f('code', 'Hub Code'), f('name', 'Hub Name'), f('city', 'City'), f('country', 'Country'), select('type', 'Type', ['PRIMARY', 'EMERGENCY', 'CUSTOMS', 'EXPRESS', 'REGIONAL_REDISTRIBUTION']), f('delayHours', 'Delay Hours', 'number'), f('reliabilityScore', 'Reliability Score', 'number')] },
    { key: 'airlines', title: 'Airlines', path: '/cargo/air/airlines', create: true, columns: ['code', 'name', 'pricePerKg', 'currency', 'reliabilityScore', 'averageDelayHours', 'cargoCapacityKg'], fields: [f('code', 'Airline Code'), f('name', 'Airline Name'), f('contractRef', 'Contract Ref'), f('pricePerKg', 'Price per kg', 'number'), f('currency', 'Currency'), f('reliabilityScore', 'Reliability Score', 'number'), f('averageDelayHours', 'Avg Delay Hours', 'number'), f('cargoCapacityKg', 'Capacity kg', 'number')] },
    { key: 'customs', title: 'Customs Flow', path: '/cargo/air/customs', create: true, columns: ['stage', 'status', 'taxAmount', 'taxCurrency', 'delayHours', 'officerName', 'clearedAt'], fields: [f('shipmentId', 'Shipment UUID'), f('parcelId', 'Parcel UUID'), select('stage', 'Stage', ['EXPORT', 'IMPORT']), select('status', 'Status', ['PENDING', 'DOCUMENTS_CHECKED', 'CLEARED', 'HELD', 'TAX_REQUIRED', 'REJECTED']), f('taxAmount', 'Tax Amount', 'number'), f('taxCurrency', 'Tax Currency'), f('delayHours', 'Delay Hours', 'number'), f('officerName', 'Officer Name'), f('holdReason', 'Hold Reason'), f('clearedAt', 'Cleared At', 'datetime-local')] },
    { key: 'events', title: 'Tracking Timeline', path: '/cargo/air/events', create: true, columns: ['eventType', 'location', 'flightNumber', 'eventAt', 'notes'], fields: [f('shipmentId', 'Shipment UUID'), f('parcelId', 'Parcel UUID'), select('eventType', 'Event', ['SHIPMENT_CREATED', 'CARGO_CONSOLIDATED', 'FLIGHT_ASSIGNED', 'EXPORT_CUSTOMS_CLEARED', 'CARGO_LOADED', 'FLIGHT_DEPARTED', 'ARRIVED_TRANSIT_HUB', 'FLIGHT_ARRIVED_DESTINATION', 'CUSTOMS_CLEARED', 'WAREHOUSE_SORTED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'REROUTED', 'OPERATIONS_ALERT']), f('location', 'Location'), f('flightNumber', 'Flight Number'), f('eventAt', 'Event At', 'datetime-local'), f('notes', 'Notes')] },
    { key: 'deliveries', title: 'Last-Mile Delivery', path: '/cargo/air/deliveries', create: true, columns: ['regionalHub', 'deliveryAddress', 'customerPhone', 'otpVerified', 'status', 'deliveredAt'], fields: [f('shipmentId', 'Shipment UUID'), f('parcelId', 'Parcel UUID'), f('driverId', 'Driver UUID'), f('regionalHub', 'Regional Hub'), f('deliveryAddress', 'Delivery Address'), f('customerPhone', 'Customer Phone'), f('otpCode', 'OTP'), select('status', 'Status', ['PENDING', 'ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED'])], extra: (r) => <StatusButton label="Delivered" onClick={() => patch(`/cargo/air/deliveries/${r.id}/proof`, { status: 'DELIVERED', otpCode: r.otpCode })} /> },
  ], []);

  const current = resources.find((r) => r.key === tab);

  useEffect(() => { void loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const pairs = await Promise.all(resources.map(async (r) => [r.key, await api<Row[]>(r.path)] as const));
      let a: Row = {};
      try { a = await api<Row>('/cargo/air/analytics'); } catch { a = {}; }
      setData({ ...empty, ...Object.fromEntries(pairs), analytics: a?.id ? [a] : [] });
      setAnalytics(a);
      setToast('KOBECARGO synced from backend.');
    } catch (e) { setToast(`Sync failed: ${(e as Error).message}`); }
    finally { setLoading(false); }
  }

  async function save(resource: Resource, row: Row) {
    const body = clean(row);
    try { await api(resource.path, { method: 'POST', body: JSON.stringify(body) }); setForm(null); setToast(`${resource.title} saved.`); await loadAll(); }
    catch (e) { setToast(`Save failed: ${(e as Error).message}`); }
  }
  async function post(path: string, body: Row) { try { await api(path, { method: 'POST', body: JSON.stringify(body) }); await loadAll(); } catch (e) { setToast((e as Error).message); } }
  async function patch(path: string, body: Row) { try { await api(path, { method: 'PATCH', body: JSON.stringify(body) }); await loadAll(); } catch (e) { setToast((e as Error).message); } }

  return <div className="flex h-full bg-slate-950 text-white">
    <aside className="w-72 border-r border-white/10 bg-slate-900/80 p-3">
      <div className="mb-4 rounded-2xl border border-orange-400/20 bg-orange-500/10 p-3"><div className="text-lg font-bold">✈️ KOBECARGO OS</div><div className="text-xs text-orange-100/60">Air Route Flow System</div></div>
      <Nav tab={tab} setTab={setTab} id="dashboard" label="Dashboard" />
      {resources.map((r) => <Nav key={r.key} tab={tab} setTab={setTab} id={r.key} label={r.title} />)}
      <div className="mt-4 rounded-xl bg-black/20 p-3 text-xs text-white/55">{toast}</div>
    </aside>
    <main className="flex-1 overflow-auto p-4">
      <div className="mb-4 flex items-center justify-between"><div><h1 className="text-2xl font-bold">{current?.title ?? 'Air Cargo Dashboard'}</h1><p className="text-sm text-white/50">Cargo movement, routing, hubs, customs, tracking, delivery and analytics.</p></div><Button onClick={loadAll} disabled={loading} className="bg-orange-600">{loading ? 'Syncing...' : 'Refresh'}</Button></div>
      {tab === 'dashboard' && <Dashboard data={data} analytics={analytics} />}
      {current && <Table resource={current} rows={data[current.key] ?? []} open={() => setForm({ resource: current })} />}
    </main>
    {form && <Modal state={form} close={() => setForm(null)} save={save} />}
  </div>;
}

function f(name: string, label: string, type = 'text'): Field { return { name, label, type }; }
function select(name: string, label: string, options: string[]): Field { return { name, label, type: 'select', options }; }
function clean(row: Row) { const out: Row = {}; Object.entries(row).forEach(([k, v]) => { if (v !== '') out[k] = typeof v === 'string' && ['weight', 'capacityKg', 'bookedKg', 'weightKg', 'estimatedFlightHours', 'customsDelayHours', 'transitDelayHours', 'deliveryHours', 'delayHours', 'reliabilityScore', 'pricePerKg', 'averageDelayHours', 'cargoCapacityKg', 'taxAmount', 'packageCount'].includes(k) ? Number(v) : v; }); return out; }
function Nav({ tab, setTab, id, label }: { tab: Tab; setTab: (t: Tab) => void; id: Tab; label: string }) { return <button onClick={() => setTab(id)} className={`mb-1 w-full rounded-xl px-3 py-2 text-left text-xs ${tab === id ? 'bg-orange-500/20 text-orange-200' : 'text-white/60 hover:bg-white/5'}`}>{label}</button>; }
function StatusButton({ label, onClick }: { label: string; onClick: () => void }) { return <Button size="sm" variant="outline" onClick={onClick} className="h-8 border-white/10 text-xs">{label}</Button>; }
function Dashboard({ data, analytics }: { data: Record<Tab, Row[]>; analytics: Row }) { return <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4"><Metric label="Parcels" value={data.parcels.length} /><Metric label="Shipments" value={data.shipments.length} /><Metric label="Routes" value={data.routes.length} /><Metric label="Flights" value={data.flights.length} /><Metric label="Hubs" value={data.hubs.length} /><Metric label="Airlines" value={data.airlines.length} /><Metric label="Customs" value={data.customs.length} /><Metric label="Deliveries" value={data.deliveries.length} /><Metric label="Cargo Volume" value={`${analytics.cargoVolumeKg ?? 0} kg`} /><Metric label="Avg ETA" value={`${Math.round(analytics.averageTransitHours ?? 0)}h`} /><Metric label="Customs Delay" value={`${analytics.customsDelayHours ?? 0}h`} /><Metric label="Utilization" value={`${Math.round(analytics.flightUtilization ?? 0)}%`} /></div>; }
function Metric({ label, value }: { label: string; value: React.ReactNode }) { return <Card className="border-white/10 bg-white/[0.04]"><CardContent className="p-4"><div className="text-xs text-white/45">{label}</div><div className="text-2xl font-bold">{value}</div></CardContent></Card>; }
function Table({ resource, rows, open }: { resource: Resource; rows: Row[]; open: () => void }) { return <Card className="border-white/10 bg-white/[0.04]"><CardHeader className="flex flex-row items-center justify-between"><CardTitle>{resource.title}</CardTitle>{resource.create && <Button onClick={open} className="bg-orange-600">Add</Button>}</CardHeader><CardContent className="overflow-auto"><table className="w-full min-w-[900px] text-xs"><thead><tr>{resource.columns.map((c) => <th key={c} className="border-b border-white/10 p-2 text-left text-white/40">{c}</th>)}<th className="border-b border-white/10 p-2 text-right text-white/40">Action</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}>{resource.columns.map((c) => <td key={c} className="border-b border-white/5 p-2">{display(c, r[c])}</td>)}<td className="border-b border-white/5 p-2 text-right">{resource.extra?.(r)}</td></tr>)}{!rows.length && <tr><td colSpan={resource.columns.length + 1} className="p-8 text-center text-white/40">No records yet.</td></tr>}</tbody></table></CardContent></Card>; }
function display(k: string, v: unknown) { if (['amount', 'taxAmount', 'pricePerKg'].includes(k)) return money(v); return fmt(v); }
function Modal({ state, close, save }: { state: { resource: Resource; row?: Row }; close: () => void; save: (resource: Resource, row: Row) => void }) { const [row, setRow] = useState<Row>({ eventAt: nowLocal(), departureAt: nowLocal(), arrivalAt: nowLocal(), ...state.row }); return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><Card className="max-h-[88vh] w-full max-w-3xl overflow-auto border-white/10 bg-slate-900 text-white"><CardHeader><CardTitle>Add {state.resource.title}</CardTitle></CardHeader><CardContent><div className="grid gap-3 md:grid-cols-2">{state.resource.fields.map((field) => <label key={field.name} className="space-y-1"><div className="text-xs text-white/50">{field.label}</div>{field.type === 'select' ? <select value={fmt(row[field.name])} onChange={(e) => setRow({ ...row, [field.name]: e.target.value })} className="h-10 w-full rounded-md bg-slate-800 px-3 text-sm"><option value="">Select</option>{field.options?.map((o) => <option key={o} value={o}>{o}</option>)}</select> : <Input type={field.type ?? 'text'} value={fmt(row[field.name])} onChange={(e) => setRow({ ...row, [field.name]: e.target.value })} className="border-white/10 bg-slate-800" />}</label>)}</div><div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={close}>Cancel</Button><Button onClick={() => save(state.resource, row)} className="bg-orange-600">Save</Button></div></CardContent></Card></div>; }
