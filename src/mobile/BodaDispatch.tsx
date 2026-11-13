import { useEffect, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { currentDeliveryPoint, deliveryMapLink, type DeliveryPoint } from '@/lib/delivery-location';

interface Rider { id: string; name: string; phone: string }
interface NearbyRider extends Rider { distanceKm: number }
const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900';
const buttonClass = 'rounded-lg bg-indigo-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50';
const cardClass = 'space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-slate-900';
const riderApi = (slug: string) => `/erp-delivery/${encodeURIComponent(slug)}/riders`;

export function BodaSearch({ slug }: { slug: string }) {
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [rows, setRows] = useState<NearbyRider[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const search = async (useGps: boolean) => {
    setBusy(true);
    setRows(null);
    setError('');
    try {
      const point = useGps ? await currentDeliveryPoint() : { latitude: Number(latitude), longitude: Number(longitude) };
      const found = await api<NearbyRider[]>(`${riderApi(slug)}/nearby`, {
        method: 'POST', body: JSON.stringify(point), offlineFallback: false,
      });
      setRows(found);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return <section className={cardClass}>
    <h3 className="font-bold">Find a boda boda for pickup</h3>
    <p className="text-xs text-slate-600">Use GPS if you’re at the shop or warehouse where the rider should collect the parcel.</p>
    <button type="button" className={buttonClass} disabled={busy} onClick={() => void search(true)}>Use my current location</button>
    <form className="space-y-2" onSubmit={event => { event.preventDefault(); void search(false); }}>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs">Pickup latitude
          <input className={inputClass} type="number" step="any" min="-90" max="90" required value={latitude} disabled={busy}
            onChange={event => { setLatitude(event.target.value); setRows(null); }} />
        </label>
        <label className="text-xs">Pickup longitude
          <input className={inputClass} type="number" step="any" min="-180" max="180" required value={longitude} disabled={busy}
            onChange={event => { setLongitude(event.target.value); setRows(null); }} />
        </label>
      </div>
      <button className={buttonClass} disabled={busy}>Search from pickup pin</button>
    </form>
    {busy && <p role="status" className="text-sm">Checking nearby riders…</p>}
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    {rows?.length === 0 && <p className="text-sm text-slate-600">No registered riders have shared a recent location within 10 km.</p>}
    {rows && rows.length > 0 && <ul className="divide-y divide-slate-100">
      {rows.map(rider => <li key={rider.id} className="flex items-center justify-between gap-3 py-2 text-sm">
        <span><strong className="block">{rider.name}</strong>About {rider.distanceKm} km away</span>
        <a className="font-bold text-indigo-700" href={`tel:${rider.phone}`}>Call rider</a>
      </li>)}
    </ul>}
  </section>;
}

export function BodaRoster({ slug, publishedUrl }: { slug: string; publishedUrl?: string | null }) {
  const [riders, setRiders] = useState<Rider[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    api<Rider[]>(riderApi(slug), { offlineFallback: false }).then(
      result => { if (!cancelled) setRiders(result); },
      error => { if (!cancelled) setError(error.message); },
    );
    return () => { cancelled = true; };
  }, [open, slug]);

  const change = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await operation();
      setRiders(await api<Rider[]>(riderApi(slug), { offlineFallback: false }));
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const register = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    if (await change(() => api(riderApi(slug), { method: 'POST', body: JSON.stringify(data), offlineFallback: false }))) form.reset();
  };

  const riderLink = new URL(`/m/${encodeURIComponent(slug)}/rider`, publishedUrl || window.location.origin).href;
  return <details className={cardClass} onToggle={event => { setOpen(event.currentTarget.open); setError(''); }}>
    <summary className="cursor-pointer font-bold">Manage registered boda boda riders</summary>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    {riders && <>
      <p className="text-xs text-slate-600">Register a rider using their KobeOS account email. Share the rider page so they can make themselves available.</p>
      <a className="block break-all text-sm text-indigo-700 underline" href={riderLink}>{riderLink}</a>
      <form onSubmit={register} className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs">Rider account email<input name="email" type="email" required maxLength={254} className={inputClass} /></label>
        <label className="text-xs">Rider name<input name="name" required maxLength={120} className={inputClass} /></label>
        <label className="text-xs">Phone<input name="phone" type="tel" required placeholder="+255 7…" className={inputClass} /></label>
        <button className={`${buttonClass} self-end`} disabled={busy}>Register rider</button>
      </form>
      <ul className="divide-y divide-slate-100">
        {riders.map(rider => <li key={rider.id} className="flex justify-between py-2 text-sm">
          <span>{rider.name} · {rider.phone}</span>
          <button type="button" className="text-rose-700" disabled={busy} onClick={() => void change(() => api(
            `${riderApi(slug)}/${rider.id}`, { method: 'DELETE', offlineFallback: false },
          ))}>Remove</button>
        </li>)}
      </ul>
    </>}
  </details>;
}

interface JumlaDelivery {
  id: string;
  orderNumber: string;
  deliveryAddress: string;
  deliveryPoint: DeliveryPoint | null;
}

export function JumlaDispatchOrders({ slug }: { slug: string }) {
  const [orders, setOrders] = useState<JumlaDelivery[] | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    setOrders(null);
    setError('');
    try {
      setOrders(await api<JumlaDelivery[]>(`${riderApi(slug)}/jumla-orders`, { offlineFallback: false }));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return <details className={cardClass} onToggle={event => { if (event.currentTarget.open) void load(); }}>
    <summary className="cursor-pointer text-sm font-bold">Jumla deliveries ready for pickup</summary>
    {!orders && !error && <p role="status" className="text-sm">Checking ready orders…</p>}
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    {orders?.length === 0 && <p className="text-sm text-slate-600">No Jumla delivery orders marked ready.</p>}
    {orders && orders.length > 0 && <ul className="space-y-3">
      {orders.map(order => <li key={order.id}>
        <details className="space-y-2 rounded-lg border border-slate-200 p-3">
          <summary className="cursor-pointer text-sm font-bold">{order.orderNumber}</summary>
          {order.deliveryAddress && <p className="text-sm">Drop-off · {order.deliveryAddress}</p>}
          {order.deliveryPoint && <a href={deliveryMapLink(order.deliveryPoint)} target="_blank" rel="noreferrer"
            className="block text-sm font-bold text-indigo-700">Open customer’s drop-off pin</a>}
          <BodaSearch slug={slug} />
        </details>
      </li>)}
    </ul>}
  </details>;
}
