import { useCallback, useEffect, useRef, useState, type ComponentType, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Camera, ClipboardList, Printer, RefreshCw, ScanLine, Truck } from 'lucide-react';
import { uploadFile } from '@/lib/api';
import { trackingFromScan } from './parcel-label';
import type { CargoTzApi } from './handoffs';

export type StaffRole = 'Intake' | 'Dispatch' | 'Loading' | 'Destination';
export type Workspace = { ownerId: string; branch: string; role: StaffRole };
export type TripRole = Exclude<StaffRole, 'Intake'>;
type Scanner = ComponentType<{ onClose: () => void; onResult: (value: string) => void }>;
type Stop = { branch: string; key: string; arrivedAt: string | null; extraCartons?: string[] };
type Trip = {
  id: string; origin: string; plate: string; operator: string; vehicleType: string;
  status: 'LOADING' | 'LOADED' | 'IN_TRANSIT' | 'ARRIVED' | 'CANCELLED';
  stops: Stop[]; sealedAt: string | null; departedAt: string | null;
};
type ReadyCarton = { trackingNumber: string; origin: string; destination: string; cartonNumber: number; cartonCount: number; weight: number };
type Carton = Omit<ReadyCarton, 'origin'> & {
  shipmentKey: string; status: string; loadedAt: string | null; unloadedAt: string | null;
  issue: string; recipient?: string; recipientPhone?: string; shipmentVerified?: number;
};
type TripDetails = Trip & { cartons: Carton[]; sms: { configured: boolean; sent: number; pending: number; failed: number } };
type StaffGrant = { id: string; role: StaffRole; branch: string; name: string };

const staffRoles: StaffRole[] = ['Intake', 'Dispatch', 'Loading', 'Destination'];
const card = 'space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm';
const field = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm';
const primary = 'inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40';
const secondary = 'inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-700 px-3 py-2 text-sm font-semibold text-emerald-900 disabled:opacity-40';
const normBranch = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
const statusName = { LOADING: 'Loading', LOADED: 'Manifest issued', IN_TRANSIT: 'In transit', ARRIVED: 'Arrived', CANCELLED: 'Cancelled' };
const title = { Dispatch: 'Dispatch Office', Loading: 'Loading Crew', Destination: 'Destination Office' };
const post = (body: object = {}): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

export function CargoStaff({ api }: { api: CargoTzApi }) {
  const [grants, setGrants] = useState<StaffGrant[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try { setGrants(await api<StaffGrant[]>('/cargotz/operations/staff')); }
    catch (cause) { setError((cause as Error).message); }
  }, [api]);
  useEffect(() => { void refresh(); }, [refresh]);

  async function change(action: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try { await action(); await refresh(); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    void change(async () => {
      await api('/cargotz/operations/staff', post(values));
      form.reset();
    });
  }

  return <section className={card}>
    <h2 className="font-bold">Branch staff access</h2>
    <p className="text-sm text-slate-600">Assign an existing KobeOS account to a role and branch. Staff sign in with their own account.</p>
    <form className="grid gap-2 sm:grid-cols-3" onSubmit={submit}>
      <label className="text-sm">Account email<input name="email" className={field} type="email" required maxLength={254} /></label>
      <label className="text-sm">Role<select name="role" className={field}>{staffRoles.map((role) => <option key={role}>{role}</option>)}</select></label>
      <label className="text-sm">Branch<input name="branch" className={field} placeholder="Mbeya" required maxLength={80} /></label>
      <button className={primary} disabled={busy}>Grant access</button>
    </form>
    {error && <p role="alert" className="text-sm text-rose-800">{error}</p>}
    {grants.map((grant) => <div className="flex items-center justify-between gap-2 border-t pt-2 text-sm" key={grant.id}>
      <span><b>{grant.name}</b> · {grant.role} · {grant.branch}</span>
      <button className={secondary} disabled={busy} onClick={() => void change(() => api(`/cargotz/operations/staff/${grant.id}`, { method: 'DELETE' }))}>Revoke</button>
    </div>)}
  </section>;
}

export function TripOperations({ api, role, workspace, Scanner }: {
  api: CargoTzApi; role: TripRole; workspace?: Workspace; Scanner: Scanner;
}) {
  const base = `/cargotz/operations/${workspace?.ownerId ?? 'mine'}`;
  const [trips, setTrips] = useState<Trip[]>([]);
  const [trip, setTrip] = useState<TripDetails | null>(null);
  const [ready, setReady] = useState<ReadyCarton[]>([]);
  const [origin, setOrigin] = useState(workspace?.branch ?? '');
  const [destination, setDestination] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [branch, setBranch] = useState(workspace?.branch ?? '');
  const [plate, setPlate] = useState('');
  const [searchedPlate, setSearchedPlate] = useState('');
  const [ocrBusy, setOcrBusy] = useState(false);
  const [scanMode, setScanMode] = useState(false);
  const [reference, setReference] = useState('');
  const [issue, setIssue] = useState<'RECEIVED' | 'DAMAGED' | 'MISSING' | 'EXTRA'>('RECEIVED');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pickup, setPickup] = useState<Carton | null>(null);
  const request = useRef<{ signature: string; id: string } | null>(null);
  const tripBranch = role === 'Destination' ? branch : workspace?.branch ?? '';
  const query = new URLSearchParams({ role, ...(tripBranch ? { branch: tripBranch } : {}) }).toString();
  const scopeQuery = workspace ? `?branch=${encodeURIComponent(workspace.branch)}` : '';

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    const filter = new URLSearchParams({ role, ...(workspace ? { branch: workspace.branch } : {}) });
    if (searchedPlate) filter.set('plate', searchedPlate);
    try {
      const [rows, parcels] = await Promise.all([
        api<Trip[]>(`${base}/trips?${filter}`, { signal }),
        role === 'Dispatch' ? api<ReadyCarton[]>(`${base}/ready${scopeQuery}`, { signal }) : Promise.resolve([]),
      ]);
      if (!signal?.aborted) { setTrips(rows); setReady(parcels); }
    } catch (cause) { if (!signal?.aborted) setError((cause as Error).message); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [api, base, role, scopeQuery, searchedPlate, workspace]);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  async function loadTrip(id: string, scopedQuery = query) {
    setTrip(await api<TripDetails>(`${base}/trips/${id}?${scopedQuery}`));
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try { await action(); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  function open(row: Trip) {
    setTrip(null);
    setPickup(null);
    setReference('');
    if (role === 'Destination') {
      const stop = branch || (row.stops.length === 1 ? row.stops[0].branch : '');
      if (!stop) {
        setError('Choose a receiving branch before opening a multi-stop trip.');
        return;
      }
      setBranch(stop);
      void run(() => loadTrip(row.id, new URLSearchParams({ role, branch: stop }).toString()));
    } else void run(() => loadTrip(row.id));
  }

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const body = { origin, plate: String(fields.get('plate')), vehicleType: String(fields.get('vehicleType')), operator: String(fields.get('operator')), trackingNumbers: selected };
    const signature = JSON.stringify(body);
    if (request.current?.signature !== signature) request.current = { signature, id: crypto.randomUUID() };
    const id = request.current.id;
    void run(async () => {
      await api(`${base}/trips`, post({ ...body, id }));
      request.current = null;
      setSelected([]);
      await loadTrip(id);
      await refresh();
      setNotice('Loading checklist created.');
    });
  }

  async function mutate(action: string, body?: object, message?: string) {
    if (!trip) return;
    await run(async () => {
      await api(`${base}/trips/${trip.id}/${action}${scopeQuery}`, post(body));
      setReference('');
      if (action === 'collect') setPickup(null);
      await loadTrip(trip.id);
      if (message) setNotice(message);
      await refresh();
    });
  }

  function scan(raw: string) {
    setScanMode(false);
    const tracking = trackingFromScan(raw);
    if (!tracking) { setError('Scan a CargoTZ carton label or type its reference.'); return; }
    if (role === 'Loading') void mutate('scan', { tracking }, 'Loading scan recorded.');
    if (role === 'Destination') void mutate('unload', { tracking, branch, result: issue }, issue === 'RECEIVED' ? 'Carton verified.' : 'Unloading exception recorded.');
  }

  async function readPlate(file?: File) {
    if (!file) return;
    setOcrBusy(true);
    setNotice('');
    setError('');
    try {
      const result = await uploadFile<{ text: string }>('/ocr/extract', file, { fieldName: 'image', extraFields: { lang: 'eng' } });
      const candidate = result.text.toUpperCase().match(/\bT\s*\d{3}\s*[A-Z]{3}\b/)?.[0].replace(/\s+/g, ' ');
      if (!candidate) { setError('Could not read a Tanzanian plate. Enter it manually.'); return; }
      setPlate(candidate);
      setNotice('Check the detected plate, then find the trip.');
    } catch { setError('Plate recognition is unavailable. Enter the plate manually.'); }
    finally { setOcrBusy(false); }
  }

  const origins = [...new Set(ready.map((row) => row.origin))];
  const activeOrigin = ready.filter((row) => normBranch(row.origin) === normBranch(origin));
  const destinations = [...new Set(activeOrigin.map((row) => row.destination))];
  const branchSuggestions = [...new Set(trips.flatMap((row) => row.stops.map((stop) => stop.branch)))];
  const matchingTrips = role === 'Destination' && branch
    ? trips.filter((row) => row.stops.some((item) => item.key === normBranch(branch)))
    : trips;
  const visible = destination ? activeOrigin.filter((row) => row.destination === destination) : activeOrigin;
  const stop = trip?.stops.find((item) => item.key === normBranch(branch));
  const cartons = trip?.cartons ?? [];
  const loaded = cartons.filter((row) => row.loadedAt).length;
  const unloaded = cartons.filter((row) => row.unloadedAt).length;
  const flagged = cartons.filter((row) => row.issue).length;
  const grouped = new Map<string, Carton[]>();
  for (const carton of cartons) {
    const items = grouped.get(carton.shipmentKey) ?? [];
    items.push(carton);
    grouped.set(carton.shipmentKey, items);
  }
  const shipments = [...grouped.values()];

  return <main className="mx-auto max-w-5xl space-y-4 p-4 text-slate-950">
    <header className="flex items-center justify-between gap-3 rounded-2xl bg-emerald-950 p-5 text-white">
      <div><p className="text-xs font-bold uppercase tracking-wider text-emerald-200">CargoTZ · Operations</p>
        <h1 className="mt-1 text-2xl font-extrabold">{title[role]}</h1>
        {workspace && <p className="mt-1 text-sm text-emerald-100">{workspace.branch} branch</p>}
      </div>
      <button className="rounded-xl border border-emerald-500 p-2 disabled:opacity-50" aria-label="Refresh trips" disabled={loading || busy} onClick={() => void run(async () => {
        if (trip) await loadTrip(trip.id);
        await refresh();
      })}><RefreshCw size={18} /></button>
    </header>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}

    {role === 'Dispatch' && <form className={card} onSubmit={create}>
      <h2 className="flex items-center gap-2 font-bold"><ClipboardList size={18} /> Build a trip</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Origin branch<select className={field} required disabled={!!workspace} value={origin} onChange={(e) => { setOrigin(e.target.value); setDestination(''); setSelected([]); }}>
          <option value="">Choose origin</option>{[...new Set([...(workspace ? [workspace.branch] : []), ...origins])].map((item) => <option key={item}>{item}</option>)}
        </select></label>
        <label className="text-sm">Vehicle plate<input name="plate" className={field} placeholder="T 472 DFR" required maxLength={20} /></label>
        <label className="text-sm">Vehicle type<select name="vehicleType" className={field}><option>Lorry</option><option>Bus</option><option>Van</option><option>Pickup</option></select></label>
        <label className="text-sm">Operator or vehicle name<input name="operator" className={field} required maxLength={120} /></label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className={secondary} type="button" aria-pressed={!destination} onClick={() => setDestination('')}>All destinations</button>
        {destinations.map((name) => <button type="button" className={secondary} aria-pressed={destination === name} key={name} onClick={() => setDestination(name)}>
          {name} · {activeOrigin.filter((row) => row.destination === name).length}
        </button>)}
      </div>
      {visible.length > 0 && <div className="max-h-56 overflow-auto rounded-xl border p-2">
        {visible.map((row) => <label key={row.trackingNumber} className="flex items-center gap-3 border-b p-2 text-sm last:border-0">
          <input type="checkbox" checked={selected.includes(row.trackingNumber)} disabled={busy} onChange={(e) => setSelected((items) => e.target.checked ? [...items, row.trackingNumber] : items.filter((ref) => ref !== row.trackingNumber))} />
          <span><b>{row.destination}</b> · {row.trackingNumber} · {row.weight} kg</span>
        </label>)}
      </div>}
      {origin && visible.length === 0 && <p className="text-sm text-slate-600">No cartons ready at this branch.</p>}
      <button className={primary} disabled={busy || !selected.length || selected.length > 300}>Send loading checklist · {selected.length} selected</button>
    </form>}

    {role === 'Destination' && <form className={card} onSubmit={(e) => { e.preventDefault(); setTrip(null); setPickup(null); setError(''); setSearchedPlate(plate.trim()); }}>
      <h2 className="font-bold">Find arriving vehicle</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Receiving branch<input className={field} list="cargo-receiving-branches" value={branch} disabled={!!workspace} onChange={(e) => { setBranch(e.target.value); setTrip(null); setPickup(null); }} placeholder="Mbeya" /></label>
        <datalist id="cargo-receiving-branches">{branchSuggestions.map((name) => <option key={name} value={name} />)}</datalist>
        <label className="text-sm">Vehicle plate<input className={field} value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder="T 472 DFR" /></label>
      </div>
      <div className="flex flex-wrap gap-2">
        <label className={secondary}><Camera size={16} /> {ocrBusy ? 'Reading plate…' : 'Photograph plate'}
          <input className="sr-only" type="file" accept="image/*" capture="environment" disabled={ocrBusy} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; void readPlate(file); }} />
        </label>
        <button className={primary} disabled={ocrBusy || busy}>Find trip by plate</button>
      </div>
    </form>}

    <section className={card}>
      <h2 className="font-bold">{role === 'Loading' ? 'Loading checklists' : 'Trips'}</h2>
      {loading && !matchingTrips.length ? <p role="status" className="text-sm">Loading trips…</p> : !matchingTrips.length && <p className="text-sm text-slate-600">No matching trips.</p>}
      {matchingTrips.map((row) => <button type="button" className="flex w-full items-center justify-between gap-2 rounded-xl border p-3 text-left text-sm disabled:opacity-50" key={row.id} disabled={busy} onClick={() => open(row)}>
        <span className="flex items-center gap-2"><Truck size={17} /><span><b>{row.plate}</b><br />{row.origin} → {row.stops.map((item) => item.branch).join(' · ')}</span></span>
        <span className="font-semibold text-emerald-900">{statusName[row.status]}</span>
      </button>)}
    </section>

    {trip && <section className={card}>
      <div className="flex items-start justify-between gap-2"><div><p className="text-sm text-slate-600">{trip.operator} · {trip.vehicleType}</p><h2 className="text-xl font-extrabold">{trip.plate}</h2></div>
        {trip.sealedAt && role !== 'Loading' && <button className={secondary} onClick={() => window.print()}><Printer size={16} /> Print manifest</button>}
      </div>
      {trip.sealedAt && role !== 'Loading' && <Manifest trip={trip} branch={role === 'Destination' ? branch : ''} />}
      <p className="text-sm font-semibold">{statusName[trip.status]} · {cartons.length} cartons</p>
      {role === 'Dispatch' && <div className="flex flex-wrap gap-2">
        {trip.status === 'LOADED' && <button className={primary} disabled={busy} onClick={() => void mutate('depart', {}, 'Vehicle departure recorded.')}>Confirm departure</button>}
        {trip.status === 'LOADING' && <button className={secondary} disabled={busy || !!loaded} onClick={() => {
          if (window.confirm('Cancel this trip and return its cartons to dispatch?')) void mutate('cancel', {}, 'Trip cancelled.');
        }}>Cancel unsealed trip</button>}
      </div>}
      {role === 'Loading' && <>
        <p className="font-bold">{loaded} of {cartons.length} loaded</p>
        <progress className="w-full accent-emerald-700" value={loaded} max={Math.max(1, cartons.length)} />
        {trip.status === 'LOADING' && <>
          <ScanForm Scanner={Scanner} open={scanMode} setOpen={setScanMode} onScan={scan} reference={reference} setReference={setReference} busy={busy} />
          <button className={primary} disabled={busy || !cartons.length || loaded !== cartons.length} onClick={() => void mutate('seal', {}, 'Manifest issued. Loaded SMS queued.')}>Confirm loading & issue manifest</button>
        </>}
      </>}
      {role === 'Destination' && stop && <>
        {!stop.arrivedAt && <button className={primary} disabled={busy || trip.status !== 'IN_TRANSIT' || !plate.trim()} onClick={() => void mutate('arrive', { branch, plate: plate.trim() }, 'Vehicle arrival recorded. Customer arrival SMS queued.')}>Confirm plate & arrival</button>}
        {stop.arrivedAt && <>
          <p className="font-bold">{unloaded} of {cartons.length} received {flagged ? `· ${flagged} exceptions` : ''}</p>
          {!!stop.extraCartons?.length && <p className="break-words rounded-lg bg-amber-50 p-2 text-sm text-amber-900">Extra cartons · {stop.extraCartons.join(', ')}</p>}
          <label className="block text-sm">Unloading result
            <select value={issue} className={field} onChange={(e) => setIssue(e.target.value as typeof issue)}>
              <option value="RECEIVED">Received intact</option><option value="DAMAGED">Received damaged</option><option value="MISSING">Report missing</option><option value="EXTRA">Report extra carton</option>
            </select>
          </label>
          <ScanForm Scanner={Scanner} open={scanMode} setOpen={setScanMode} onScan={scan} reference={reference} setReference={setReference} busy={busy} />
          <h3 className="font-bold">Customer pickup</h3>
          {shipments.map((rows) => {
            const first = rows[0];
            const verified = first.shipmentVerified ?? 0;
            const isReady = rows.some((row) => row.status === 'READY_FOR_PICKUP');
            const collected = rows.every((row) => row.status === 'DELIVERED');
            return <div key={first.shipmentKey} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm">
              <span><b>{first.recipient || first.trackingNumber}</b><br />{collected ? 'Collected' : isReady ? 'Ready for pickup' : `${verified} of ${first.cartonCount} verified`}</span>
              {isReady ? <button className={secondary} disabled={busy} onClick={() => setPickup(first)}>Enter pickup code</button> : !collected && <button className={primary} disabled={busy || verified !== first.cartonCount} onClick={() => void mutate('release', { branch, tracking: first.trackingNumber }, 'Shipment ready. Pickup SMS queued.')}>Send pickup code</button>}
            </div>;
          })}
          {pickup && <form className="space-y-2 rounded-xl border p-3" onSubmit={(e) => {
            e.preventDefault();
            const code = new FormData(e.currentTarget).get('code');
            void mutate('collect', { branch, tracking: pickup.trackingNumber, code }, 'Customer collection confirmed.');
          }}>
            <label className="block text-sm">Customer pickup code<input className={field} name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="off" /></label>
            <button className={primary} disabled={busy}>Confirm customer collection</button>
          </form>}
        </>}
      </>}
      {cartons.length > 0 && <ul className="max-h-72 divide-y overflow-auto rounded-xl border">
        {cartons.map((row) => <li key={row.trackingNumber} className="flex flex-wrap items-center justify-between gap-2 p-2 text-sm">
          <span className="break-all">{row.trackingNumber}<span className="block text-xs text-slate-600">{row.destination} · carton {row.cartonNumber} of {row.cartonCount}</span></span>
          {role === 'Loading' ? <span className="flex items-center gap-2">{row.loadedAt ? 'Loaded' : 'Outstanding'}
            {row.loadedAt && trip.status === 'LOADING' && <button className={secondary} disabled={busy} onClick={() => void mutate('scan', { tracking: row.trackingNumber, loaded: false }, 'Loading scan reversed.')}>Undo</button>}
          </span> : role === 'Destination' && <span className={row.issue ? 'font-bold text-amber-800' : 'text-emerald-900'}>{row.issue || (row.unloadedAt ? 'Verified' : 'Awaiting scan')}</span>}
        </li>)}
      </ul>}
      {role !== 'Loading' && trip.sealedAt && <div className="rounded-xl bg-slate-50 p-3 text-sm">
        {trip.sms.configured ? <p>SMS · {trip.sms.sent} accepted by provider · {trip.sms.pending} queued · {trip.sms.failed} failed</p> : <p>SMS provider setup required · {trip.sms.pending} queued</p>}
        {role === 'Destination' && trip.sms.failed > 0 && <button className={secondary} disabled={busy} onClick={() => void mutate('retry-messages', { branch }, 'Failed messages requeued.')}>Retry failed SMS</button>}
      </div>}
    </section>}
  </main>;
}

function ScanForm({ Scanner, open, setOpen, onScan, reference, setReference, busy }: {
  Scanner: Scanner; open: boolean; setOpen: (value: boolean) => void; onScan: (value: string) => void;
  reference: string; setReference: (value: string) => void; busy: boolean;
}) {
  return <div className="space-y-2">
    <button className={secondary} disabled={busy} onClick={() => setOpen(true)}><ScanLine size={17} /> Scan carton QR</button>
    <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); onScan(reference); }}>
      <label className="min-w-0 flex-1 text-sm">Tracking reference<input className={field} value={reference} onChange={(e) => setReference(e.target.value)} required /></label>
      <button className={secondary} disabled={busy}>Record carton</button>
    </form>
    {open && <Scanner onClose={() => setOpen(false)} onResult={onScan} />}
  </div>;
}

function Manifest({ trip, branch }: { trip: TripDetails; branch: string }) {
  return createPortal(<>
    <style>{`@media print {
      body:has(> .ctz-manifest) { height:auto!important; overflow:visible!important; }
      body:has(> .ctz-manifest) > #root { display:none!important; }
      body > .ctz-manifest { display:block!important; background:white; color:black; padding:12mm; }
      .ctz-manifest tr { break-inside:avoid; }
      .ctz-manifest thead { display:table-header-group; }
    }`}</style>
    <div className="ctz-manifest hidden">
      <h1 className="text-2xl font-bold">CargoTZ loading manifest</h1>
      <p>Trip {trip.id} · {trip.plate} · {trip.vehicleType} · {trip.operator}</p>
      <p>{trip.origin} → {branch || trip.stops.map((stop) => stop.branch).join(' · ')}</p>
      <p>Issued {new Date(trip.sealedAt!).toLocaleString('en-TZ', { timeZone: 'Africa/Dar_es_Salaam' })} · {trip.cartons.length} cartons</p>
      <table className="mt-4 w-full border-collapse text-left text-xs">
        <thead><tr>{['Tracking', 'Destination', 'Carton', 'Weight', 'Recipient', 'Phone'].map((name) => <th className="border p-1" key={name}>{name}</th>)}</tr></thead>
        <tbody>{trip.cartons.map((row) => <tr key={row.trackingNumber}>
          {[row.trackingNumber, row.destination, `${row.cartonNumber}/${row.cartonCount}`, `${row.weight} kg`, row.recipient, row.recipientPhone].map((value, index) => <td key={index} className="border p-1">{value}</td>)}
        </tr>)}</tbody>
      </table>
    </div>
  </>, document.body);
}
