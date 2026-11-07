import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowUpRight, Boxes, Loader2, Plus, RefreshCw, Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import type { AirDesktopView } from './AirCargoDesktop';

type Row = Record<string, string | number | boolean | null>;
type Field = { key: string; label: string; type?: 'number' | 'select'; options?: string[]; source?: 'shipments' | 'lanes'; optional?: boolean };
interface Resource { path: string; title: string; subtitle: string; columns: [string, string][]; fields: Field[]; }
const SHIPMENT: Field = { key: 'shipmentId', label: 'Shipment', type: 'select', source: 'shipments' };
const resources: Partial<Record<AirDesktopView, Resource>> = {
  warehouse: { path: '/cargo/parcels?limit=100', title: 'Goods in. Proof first.', subtitle: 'Receive and search the actual warehouse parcel registry.', columns: [['parcelId', 'Parcel'], ['ownerName', 'Customer'], ['description', 'Contents'], ['weight', 'Weight / kg'], ['lifecycleStatus', 'Warehouse state']], fields: [
    { key: 'parcelId', label: 'Parcel code' }, { key: 'ownerName', label: 'Customer name' }, { key: 'ownerPhone', label: 'Customer phone' }, { key: 'senderName', label: 'Sender name' }, { key: 'senderPhone', label: 'Sender phone' }, { key: 'destination', label: 'Destination' }, { key: 'weight', label: 'Actual weight / kg', type: 'number' }, { key: 'description', label: 'Contents', optional: true }, { key: 'paymentMode', label: 'Freight payment policy', type: 'select', options: ['PAY_NOW', 'PAY_ON_ARRIVAL'] },
  ] },
  consolidation: { path: '/cargo/boxes', title: 'Many parcels. One movement.', subtitle: 'Build, seal and dispatch real consolidation boxes.', columns: [['boxId', 'Consolidation'], ['laneCode', 'Lane'], ['parcelCount', 'Parcels'], ['totalWeight', 'Weight / kg'], ['status', 'State']], fields: [{ key: 'laneId', label: 'Shipping lane', type: 'select', source: 'lanes' }, { key: 'boxId', label: 'Box code (generated if blank)', optional: true }, { key: 'notes', label: 'Handling notes', optional: true }] },
  customs: { path: '/cargo/air/customs', title: 'Clear documents. Clear progress.', subtitle: 'Export and import records, assessments and holds.', columns: [['shipmentId', 'Shipment'], ['stage', 'Stage'], ['status', 'State'], ['taxAmount', 'Assessment'], ['taxCurrency', 'Currency'], ['holdReason', 'Hold reason']], fields: [SHIPMENT, { key: 'stage', label: 'Customs stage', type: 'select', options: ['EXPORT', 'IMPORT'] }, { key: 'status', label: 'Recorded state', type: 'select', options: ['PENDING', 'DOCUMENTS_CHECKED', 'HELD', 'TAX_REQUIRED'] }, { key: 'officerName', label: 'Agent / officer', optional: true }, { key: 'holdReason', label: 'Query or hold notes', optional: true }, { key: 'taxAmount', label: 'Assessment amount', type: 'number', optional: true }, { key: 'taxCurrency', label: 'Assessment currency', optional: true }] },
  delivery: { path: '/cargo/air/deliveries', title: 'The final handover.', subtitle: 'Destination delivery instructions and recorded collection status.', columns: [['shipmentId', 'Shipment'], ['deliveryAddress', 'Destination'], ['customerPhone', 'Customer phone'], ['status', 'State'], ['otpVerified', 'OTP verified']], fields: [SHIPMENT, { key: 'deliveryAddress', label: 'Collection / delivery address' }, { key: 'customerPhone', label: 'Customer phone' }, { key: 'regionalHub', label: 'Destination hub', optional: true }, { key: 'otpCode', label: 'Customer collection OTP' }, { key: 'notes', label: 'Delivery instructions', optional: true }] },
  business: { path: '/cargo/customers', title: 'Know the name on the parcel.', subtitle: 'Customer cargo codes and contact records. Supplier transfers live in KobePay.', columns: [['displayId', 'Cargo code'], ['name', 'Customer'], ['phone', 'Phone'], ['country', 'Country'], ['active', 'Active']], fields: [{ key: 'name', label: 'Customer name' }, { key: 'phone', label: 'Phone' }, { key: 'country', label: 'Country', optional: true }, { key: 'notes', label: 'Notes', optional: true }] },
  control: { path: '/cargo/air/events', title: 'Every handoff, accounted for.', subtitle: 'Recorded cargo events and operator alerts, with source timestamps.', columns: [['shipmentId', 'Shipment'], ['eventType', 'Event'], ['location', 'Location'], ['eventAt', 'Recorded time'], ['notes', 'Notes']], fields: [SHIPMENT, { key: 'eventType', label: 'Event', type: 'select', options: ['OPERATIONS_ALERT', 'CARGO_LOADED', 'WAREHOUSE_SORTED', 'EXPORT_CUSTOMS_CLEARED', 'CUSTOMS_CLEARED'] }, { key: 'location', label: 'Location' }, { key: 'notes', label: 'Evidence / handover notes' }] },
};
const stringify = (value: unknown) => value === null || value === undefined || value === '' ? '—' : String(value);
const rowName = (row: Row) => stringify(row.shipmentId ?? row.boxId ?? row.parcelId ?? row.name ?? row.id);

export default function CargoOperationsDesk({ view }: { view: AirDesktopView }) {
  const resource = resources[view]!;
  const [rows, setRows] = useState<Row[]>([]);
  const [shipments, setShipments] = useState<Row[]>([]);
  const [lanes, setLanes] = useState<Row[]>([]);
  const [parcels, setParcels] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<'record' | 'lane' | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState('');
  const [selectedParcels, setSelectedParcels] = useState<string[]>([]);
  const [otp, setOtp] = useState('');
  const selected = rows.find(r => r.id === selectedId);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const paths = [resource.path, '/cargo/shipments?limit=100', ...(view === 'consolidation' ? ['/cargo/lanes', '/cargo/parcels?limit=100'] : [])];
      const values = await Promise.all(paths.map(path => api<Row[]>(path, { offlineFallback: false })));
      setRows(Array.isArray(values[0]) ? values[0] : []); setShipments(Array.isArray(values[1]) ? values[1] : []);
      if (view === 'consolidation') { setLanes(Array.isArray(values[2]) ? values[2] : []); setParcels(Array.isArray(values[3]) ? values[3] : []); }
    } catch (e) { setError(e instanceof Error && !e.message.includes('fetch') ? e.message : 'Cargo service unavailable. Check the connection and refresh your records.'); }
    finally { setLoading(false); }
  }, [resource.path, view]);
  useEffect(() => { setSelectedId(''); setForm(null); setQuery(''); setMessage(''); void load(); }, [load]);
  const filtered = useMemo(() => rows.filter(row => resource.columns.some(([key]) => stringify(row[key]).toLowerCase().includes(query.toLowerCase()))), [query, rows, resource]);
  const fields: Field[] = form === 'lane' ? [{ key: 'code', label: 'Lane code' }, { key: 'name', label: 'Service name' }, { key: 'origin', label: 'Origin' }, { key: 'destination', label: 'Destination' }, { key: 'pricePerKg', label: 'Price per kg', type: 'number' }, { key: 'currency', label: 'Price currency' }] : resource.fields;
  const mutate = async (path: string, payload: Record<string, unknown>, notice: string) => {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try { await api(path, { method: 'POST', body: JSON.stringify(payload), offlineFallback: false }); setMessage(notice); setForm(null); setSelectedParcels([]); setOtp(''); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'The action could not be confirmed. Refresh the records before retrying.'); }
    finally { setBusy(false); }
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    const payload: Record<string, unknown> = {};
    for (const field of fields) {
      const value = draft[field.key] ?? (field.options?.[0] || '');
      if (!value && field.optional) continue;
      payload[field.key] = field.type === 'number' ? Number(value) : value;
    }
    await mutate(form === 'lane' ? '/cargo/lanes' : resource.path.split('?')[0], payload, form === 'lane' ? 'Shipping lane saved.' : 'Record saved.');
  };
  return <section className="ad-operations-desk">
    <div className="ad-page-heading"><div><div className="ad-overline">OPERATIONS / {view === 'business' ? 'CUSTOMERS' : view.toUpperCase()}</div><h1>{resource.title}</h1><p>{resource.subtitle}</p></div><button className="ad-primary cursor-interaction" type="button" disabled={busy} onClick={() => { setForm('record'); setDraft({}); }}><Plus size={16} />{view === 'warehouse' ? 'Receive parcel' : 'Add record'}</button></div>
    <div className="ad-record-toolbar"><label className="ad-search"><Search size={16} /><input aria-label="Search cargo records" placeholder="Search records or scan a parcel code" value={query} onChange={e => setQuery(e.target.value)} /></label><div>{view === 'consolidation' && <button className="ad-text-button cursor-interaction" type="button" disabled={busy} onClick={() => { setForm('lane'); setDraft({ currency: 'TZS' }); }}>Add shipping lane</button>}<button className="ad-text-button cursor-interaction" type="button" disabled={busy || loading} onClick={() => void load()}><RefreshCw size={14} />Refresh</button></div></div>
    {error && <div className="ad-load-state" role="alert">{error}</div>}{message && <div className="ad-load-state" role="status">{message}</div>}
    {form && <form className="ad-operation-form" onSubmit={save}><div className="ad-section-heading"><h2>{form === 'lane' ? 'Create shipping lane' : view === 'warehouse' ? 'Parcel receiving record' : 'New record'}</h2><button type="button" aria-label="Close record form" disabled={busy} className="ad-text-button cursor-interaction" onClick={() => setForm(null)}><X size={18} /></button></div><div className="ad-form-grid">{fields.map(field => <label key={field.key}>{field.label}{field.optional ? ' (optional)' : ''}{field.type === 'select' ? <select required={!field.optional} disabled={busy} value={draft[field.key] ?? field.options?.[0] ?? ''} onChange={e => setDraft({ ...draft, [field.key]: e.target.value })}>{field.source && <option value="">Select {field.label.toLowerCase()}</option>}{(field.source ? field.source === 'shipments' ? shipments : lanes : field.options ?? []).map(option => typeof option === 'string' ? <option key={option} value={option}>{option.replaceAll('_', ' ')}</option> : <option key={String(option.id)} value={String(option.id)}>{rowName(option)}</option>)}</select> : <input required={!field.optional} disabled={busy} type={field.type === 'number' ? 'number' : 'text'} step={field.type === 'number' ? '0.0001' : undefined} min={field.type === 'number' ? 0 : undefined} value={draft[field.key] ?? ''} onChange={e => setDraft({ ...draft, [field.key]: e.target.value })} />}</label>)}</div><div className="ad-form-actions"><button className="ad-primary cursor-interaction" disabled={busy} type="submit">{busy ? 'Saving…' : 'Save record'}<ArrowUpRight size={16} /></button></div></form>}
    {loading ? <div className="ad-empty" role="status"><Loader2 size={22} className="animate-spin" />Loading recorded operations…</div> : <div className="ad-record-table-wrap"><table className="ad-record-table"><thead><tr>{resource.columns.map(([key, name]) => <th key={key}>{name}</th>)}<th>Details</th></tr></thead><tbody>{filtered.map(row => <tr key={String(row.id)}>{resource.columns.map(([key]) => <td key={key}>{key === 'shipmentId' ? rowName(shipments.find(s => s.id === row[key]) ?? row) : stringify(row[key])}</td>)}<td><button type="button" className="ad-round-button cursor-interaction" aria-label={`Open ${rowName(row)}`} onClick={() => { setSelectedId(String(row.id)); setSelectedParcels([]); }}><ArrowUpRight size={16} /></button></td></tr>)}</tbody></table>{!filtered.length && !error && <div className="ad-empty"><Boxes size={26} /><h3>No matching records yet.</h3><p>Add a record to start this workspace.</p></div>}</div>}
    {selected && <section className="ad-record-detail"><div className="ad-section-heading"><h2>{rowName(selected)}</h2><button className="ad-text-button cursor-interaction" aria-label="Close record details" type="button" disabled={busy} onClick={() => setSelectedId('')}><X size={18} /></button></div><dl>{Object.entries(selected).filter(([key]) => !['ownerId', 'otpCode'].includes(key)).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{stringify(value)}</dd></div>)}</dl>
      {view === 'consolidation' && <><div className="ad-form-actions">{selected.status === 'OPEN' && <button type="button" className="ad-primary cursor-interaction" disabled={busy || !Number(selected.parcelCount)} onClick={() => void mutate(`/cargo/boxes/${selected.id}/seal`, {}, 'Consolidation sealed.')}>Confirm sealed contents</button>}{selected.status === 'SEALED' && <button type="button" className="ad-primary cursor-interaction" disabled={busy} onClick={() => void mutate(`/cargo/boxes/${selected.id}/dispatch`, {}, 'Consolidation dispatched.')}>Confirm physical dispatch</button>}{selected.status === 'DISPATCHED' && <button type="button" className="ad-primary cursor-interaction" disabled={busy} onClick={() => void mutate(`/cargo/boxes/${selected.id}/receive`, {}, 'Destination warehouse receipt recorded.')}>Confirm warehouse receipt</button>}</div>{selected.status === 'OPEN' && <div className="ad-parcel-picklist"><h3>Choose received parcels</h3>{parcels.filter(p => !p.boxId && !['IN_TRANSIT', 'DELIVERED', 'ON_HOLD', 'PRE_ALERTED', 'CANCELLED'].includes(String(p.lifecycleStatus ?? p.status))).map(p => <label key={String(p.id)}><input type="checkbox" checked={selectedParcels.includes(String(p.id))} onChange={e => setSelectedParcels(current => e.target.checked ? [...current, String(p.id)] : current.filter(id => id !== String(p.id)))} />{rowName(p)} · {p.ownerName} · {p.weight} kg</label>)}<button type="button" className="ad-primary cursor-interaction" disabled={busy || !selectedParcels.length} onClick={() => void mutate(`/cargo/boxes/${selected.id}/assign`, { parcelIds: selectedParcels }, 'Parcels assigned to consolidation.')}>Assign {selectedParcels.length} parcels</button></div>}</>}
    </section>}
  </section>;
}
