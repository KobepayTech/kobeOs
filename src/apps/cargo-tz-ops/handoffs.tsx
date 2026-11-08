import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowUpRight, Camera, CheckCircle2, RefreshCw } from 'lucide-react';
import { cargoTzLink, isLocalCargoTz, trackingFromScan, type ParcelLabelData } from './parcel-label';

export type CargoTzApi = <T>(path: string, init?: RequestInit) => Promise<T>;

type Agent = { id: string; companyName: string; agentName: string; agentPhone: string };
type Invite = Agent & { accepted: boolean; expiresAt: string };
type Parcel = ParcelLabelData & {
  id: string; senderName: string; senderPhone: string; receiverName: string; receiverPhone: string;
  description: string; status: string; notes: string;
};
type HandoffCarton = { trackingNumber: string; cartonNumber: number; status: string };
type Handoff = { parcel: Parcel; collector: Agent | null; cartons?: HandoffCarton[] };
const card = 'space-y-3 rounded-2xl border border-slate-200 bg-white p-4';
const input = 'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
const action = 'inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50';

export function CollectorInvites({ api }: { api: CargoTzApi }) {
  if (isLocalCargoTz()) {
    return (
      <section className={card}>
        <h2 className="font-bold">Collecting agents</h2>
        <p className="text-sm text-slate-600">Open the shared CargoTZ workspace to invite an agent from another device.</p>
        <a className={action} href={cargoTzLink('/cargotz/owner')} target="_blank" rel="noreferrer">Open hosted CargoTZ <ArrowUpRight size={15} /></a>
      </section>
    );
  }
  return <HostedCollectorInvites api={api} />;
}

function HostedCollectorInvites({ api }: { api: CargoTzApi }) {
  const [rows, setRows] = useState<Invite[]>([]);
  const [link, setLink] = useState<{ id: string; url: string } | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    try { setRows(await api<Invite[]>('/cargotz/collector-invites')); }
    catch (cause) { setError((cause as Error).message); }
  }, [api]);
  useEffect(() => { void refresh(); }, [refresh]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await api<{ id: string; token: string }>('/cargotz/collector-invites', {
        method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      setLink({ id: result.id, url: cargoTzLink(`/cargotz/collect#invite=${result.token}`) });
      form.reset();
      await refresh();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(`/cargotz/collector-invites/${id}`, { method: 'DELETE' });
      if (link?.id === id) setLink(null);
      await refresh();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={card}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><h2 className="font-bold">Collecting agents</h2><p className="mt-1 text-sm text-slate-600">Give an agent access to send sealed parcels to this cargo company.</p></div>
        <a className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-800" href={cargoTzLink('/cargotz/collect')} target="_blank" rel="noreferrer">Open agent web app <ArrowUpRight size={15} /></a>
      </div>
      <form onSubmit={(event) => void create(event)} className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-medium">Cargo company name<input name="companyName" maxLength={120} required className={input} /></label>
        <label className="text-sm font-medium">Agent name<input name="agentName" maxLength={120} required className={input} /></label>
        <label className="text-sm font-medium">Agent phone<input name="agentPhone" type="tel" maxLength={25} required className={input} /></label>
        <button disabled={busy} className={action}>Create invitation</button>
      </form>
      {link && (
        <div className="rounded-xl bg-emerald-50 p-3">
          <label className="block text-sm font-medium">Private invitation link
            <input className={input} value={link.url} readOnly onFocus={(event) => event.currentTarget.select()} />
          </label>
          <button className="mt-2 text-sm font-semibold text-emerald-800 underline" onClick={() => {
            void (navigator.clipboard?.writeText(link.url) ?? Promise.reject()).then(() => setNotice('Invitation copied.'), () => setNotice('Select and copy the link above.'));
          }}>Copy link</button>
          <p className="mt-1 text-xs text-slate-600">Share directly with the named agent. The link can be claimed by one account within seven days.</p>
        </div>
      )}
      {notice && <p role="status" className="text-sm">{notice}</p>}
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <ul className="divide-y">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-2 py-2 text-sm">
            <div><b>{row.agentName}</b><p className="text-slate-600">{row.companyName} · {row.accepted ? 'Active' : new Date(row.expiresAt).getTime() < Date.now() ? 'Expired' : 'Invitation pending'}</p></div>
            <button disabled={busy} className="rounded border px-2 py-1 text-rose-800 disabled:opacity-50" onClick={() => void revoke(row.id)}>Revoke access</button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PendingHandoffs({ api, Scanner, initialReference }: {
  api: CargoTzApi;
  initialReference?: string;
  Scanner: React.ComponentType<{ onClose: () => void; onResult: (value: string) => void }>;
}) {
  const [queue, setQueue] = useState<Parcel[]>([]);
  const [active, setActive] = useState<Handoff | null>(null);
  const [reference, setReference] = useState('');
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [queueError, setQueueError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setQueueError('');
    try { setQueue(await api<Parcel[]>('/cargotz/handoffs', { signal })); }
    catch (cause) { if (!signal?.aborted) { setQueue([]); setQueueError((cause as Error).message); } }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [api]);
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  const open = useCallback(async (raw: string, signal?: AbortSignal) => {
    setScanning(false);
    setActive(null);
    setNotice('');
    const tracking = trackingFromScan(raw);
    if (!tracking) {
      setError('Scan a CargoTZ label or enter its tracking number.');
      return;
    }
    setReference(tracking);
    setBusy(true);
    setError('');
    try {
      const data = await api<Handoff>(`/cargotz/handoffs/${encodeURIComponent(tracking)}`, { signal });
      if (!signal?.aborted) setActive(data);
    } catch (cause) {
      if (!signal?.aborted) setError((cause as Error).message);
    } finally {
      if (!signal?.aborted) setBusy(false);
    }
  }, [api]);

  useEffect(() => {
    if (!initialReference) return;
    const controller = new AbortController();
    void open(initialReference, controller.signal);
    return () => controller.abort();
  }, [initialReference, open]);

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active) return;
    const form = new FormData(event.currentTarget);
    const measurements = Object.fromEntries(['weight', 'lengthCm', 'widthCm', 'heightCm']
      .filter((name) => form.get(name))
      .map((name) => [name, Number(form.get(name))]));
    setBusy(true);
    setError('');
    try {
      const tracking = active.parcel.trackingNumber;
      const saved = await api<Parcel>(`/cargotz/handoffs/${encodeURIComponent(tracking)}/confirm`, {
        method: 'POST', body: JSON.stringify({ ...measurements, note: form.get('note') || undefined }),
      });
      const next = active.cartons?.find((carton) => carton.trackingNumber !== tracking && carton.status === 'AWAITING_HANDOFF');
      if (next) {
        await open(next.trackingNumber);
      } else {
        setActive({
          ...active,
          parcel: saved,
          cartons: active.cartons?.map((carton) => carton.trackingNumber === tracking ? { ...carton, status: saved.status } : carton),
        });
      }
      setNotice(`Custody accepted for ${tracking}.`);
      await refresh();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={card}>
      <div className="flex items-start justify-between gap-2">
        <div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Cargo intake</p><h2 className="mt-1 text-xl font-bold">Collector handoffs</h2></div>
        <button type="button" aria-label="Refresh handoffs" disabled={loading || busy} className="rounded-lg border p-2 disabled:opacity-50" onClick={() => void refresh()}><RefreshCw size={16} /></button>
      </div>
      <button disabled={busy} type="button" className={`${action} w-full`} onClick={() => setScanning(true)}><Camera size={19} /> Scan handoff QR or carton label</button>
      <form className="flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); void open(reference); }}>
        <label className="min-w-0 flex-1 text-sm font-medium">Tracking number<input className={input} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="CTZ-…" /></label>
        <button className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50" disabled={busy || !reference.trim()}>Open</button>
      </form>
      {scanning && <Scanner onClose={() => setScanning(false)} onResult={(raw) => void open(raw)} />}
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      {active && (
        <div className="space-y-3 rounded-xl bg-slate-50 p-3 text-sm">
          <p className="font-bold">{active.parcel.origin} → {active.parcel.destination} · Carton {active.parcel.cartonNumber} of {active.parcel.cartonCount}</p>
          <p>Owner · {active.parcel.senderName} · {active.parcel.senderPhone}</p>
          <p>Recipient · {active.parcel.receiverName} · {active.parcel.receiverPhone}</p>
          {active.collector && <p>Collector · {active.collector.agentName} · {active.collector.agentPhone}</p>}
          <p>{active.parcel.description}</p><p>{active.parcel.notes}</p>
          {active.cartons && active.cartons.length > 1 && (
            <div className="space-y-1.5">
              <h3 className="font-semibold">Shipment cartons</h3>
              {active.cartons.map((carton) => (
                <button
                  key={carton.trackingNumber}
                  type="button"
                  aria-pressed={carton.trackingNumber === active.parcel.trackingNumber}
                  disabled={busy}
                  onClick={() => void open(carton.trackingNumber)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-left aria-pressed:border-emerald-700 aria-pressed:bg-emerald-50"
                >
                  <span>Carton {carton.cartonNumber}</span>{' '}
                  <span className="text-xs text-slate-600">{carton.status === 'AWAITING_HANDOFF' ? 'Awaiting custody' : carton.status === 'CANCELLED' ? 'Cancelled' : 'Accepted'}</span>
                </button>
              ))}
            </div>
          )}
          {active.parcel.status === 'AWAITING_HANDOFF' ? (
            <form key={active.parcel.id} className="space-y-3" onSubmit={(event) => void confirm(event)}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Object.entries({ weight: 'Weight (kg)', lengthCm: 'Length (cm)', widthCm: 'Width (cm)', heightCm: 'Height (cm)' }).map(([name, label]) => (
                  <label key={name}>{label}<input name={name} className={input} type="number" min="0.01" max="100000" step="0.01" /></label>
                ))}
              </div>
              <label className="block">Seal or condition note<input name="note" className={input} maxLength={500} /></label>
              <button className={action} disabled={busy}><CheckCircle2 size={17} /> Confirm physical handoff</button>
            </form>
          ) : <p className="font-semibold text-emerald-800">This carton has already left the handoff queue.</p>}
        </div>
      )}
      {queueError ? <p role="alert" className="text-sm text-rose-700">{queueError}</p> : loading ? <p role="status" className="text-sm text-slate-600">Loading handoffs…</p> : (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Awaiting custody · {queue.length}{queue.length === 100 ? '+' : ''}</h3>
          {!queue.length && <p className="text-sm text-slate-500">New collector submissions will appear here.</p>}
          {queue.map((row) => (
            <button key={row.id} type="button" disabled={busy} onClick={() => void open(row.trackingNumber)} className="block w-full rounded-lg border p-2 text-left text-sm disabled:opacity-50">
              <b>{row.destination}</b> · {row.senderName} · {row.cartonNumber}/{row.cartonCount}
              <span className="block break-all font-mono text-xs text-slate-500">{row.trackingNumber}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
