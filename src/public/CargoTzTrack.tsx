import { useEffect, useState, type FormEvent } from 'react';
import { publicApi } from './api';
import { MapPin, Truck, CheckCircle2, Loader2, Search, PackageCheck, LockKeyhole } from 'lucide-react';

/** Public parcel status from a label URL or a typed tracking reference. */
interface Track {
  trackingNumber: string;
  status: string;
  origin: string;
  destination: string;
  cartonNumber: number;
  cartonCount: number;
  timeline: { status: string; at: string }[];
}

const STAGES = ['AWAITING_HANDOFF', 'RECEIVED_AT_SHOP', 'AT_WAREHOUSE', 'PACKED', 'LOADED', 'IN_TRANSIT', 'ARRIVED', 'READY_FOR_PICKUP', 'DELIVERED'];
const LABEL: Record<string, string> = {
  AWAITING_HANDOFF: 'Awaiting cargo handoff', RECEIVED_AT_SHOP: 'Received by cargo intake', AT_WAREHOUSE: 'At warehouse', PACKED: 'Packed',
  LOADED: 'Loaded on vehicle', IN_TRANSIT: 'In transit', ARRIVED: 'Arrived', READY_FOR_PICKUP: 'Ready for pickup', DELIVERED: 'Delivered', CANCELLED: 'Cancelled',
};

export default function CargoTzTrack({ tracking }: { tracking?: string }) {
  const [input, setInput] = useState(tracking ?? '');
  const [data, setData] = useState<Track | null>(null);
  const [loading, setLoading] = useState(!!tracking);
  const [error, setError] = useState<string | null>(null);

  const load = async (tn: string) => {
    if (!tn.trim()) return;
    setLoading(true); setError(null); setData(null);
    try { setData(await publicApi<Track>(`/cargotz-track/${encodeURIComponent(tn.trim().toUpperCase())}`)); }
    catch { setError('Tracking number not found.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (tracking) load(tracking); }, [tracking]);

  const stages = data?.timeline.some((event) => event.status === 'AWAITING_HANDOFF') ? STAGES : STAGES.slice(1);
  const currentIdx = data ? stages.indexOf(data.status) : -1;

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900">
      <header className="bg-emerald-700 text-white px-5 py-6">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <PackageCheck className="w-6 h-6" />
          <div><h1 className="text-xl font-extrabold leading-tight">Track your parcel</h1><p className="text-xs text-white/70">CargoTZ</p></div>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={input} onChange={(e) => setInput(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === 'Enter') load(input); }}
              placeholder="CTZ-2026...-000234" className="w-full h-11 pl-9 pr-3 rounded-xl border border-slate-200 text-sm font-mono" />
          </div>
          <button onClick={() => load(input)} className="h-11 px-4 rounded-xl bg-emerald-600 text-white font-bold text-sm">Track</button>
        </div>

        {loading && <div className="grid place-items-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>}
        {error && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3">{error}</div>}

        {data && (
          <>
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="text-[11px] uppercase text-slate-400 tracking-wide">Tracking number</div>
              <div className="break-all text-lg font-extrabold font-mono">{data.trackingNumber}</div>
              <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${data.status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {data.status === 'DELIVERED' ? <CheckCircle2 className="w-4 h-4" /> : <Truck className="w-4 h-4" />} {LABEL[data.status] ?? data.status}
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                <MapPin className="w-4 h-4 text-slate-400" /> {data.origin} → {data.destination}
              </div>
              {data.cartonCount > 1 && <p className="mt-1 text-xs text-slate-500">Carton {data.cartonNumber} of {data.cartonCount}</p>}
            </div>

            <OwnerTracking tracking={data.trackingNumber} key={data.trackingNumber} />

            {/* Timeline */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Journey</div>
              <div className="space-y-0">
                {stages.map((stage, i) => {
                  const done = i <= currentIdx;
                  const ev = data.timeline.find((e) => e.status === stage);
                  return (
                    <div key={stage} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full ${done ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                        {i < stages.length - 1 && <div className={`w-0.5 flex-1 min-h-[28px] ${i < currentIdx ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
                      </div>
                      <div className={`pb-3 ${done ? '' : 'opacity-40'}`}>
                        <div className="text-sm font-semibold">{LABEL[stage]}</div>
                        {ev && <div className="text-[11px] text-slate-400">{new Date(ev.at).toLocaleString()}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </>
        )}
      </div>
    </div>
  );
}

type OwnerDetails = {
  ownerName: string; ownerPhone: string; recipientName: string; recipientPhone: string;
  description: string; quantity: number; cartonCount: number;
};

function OwnerTracking({ tracking }: { tracking: string }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [details, setDetails] = useState<OwnerDetails | null>(null);
  const path = `/cargotz-track/${encodeURIComponent(tracking)}`;
  const field = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const init = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store' as const,
    };
    try {
      if (requested) {
        setDetails(await publicApi<OwnerDetails>(`${path}/owner-details`, { ...init, body: JSON.stringify({ phone: phone.trim(), code }) }));
        setCode('');
      } else {
        await publicApi(`${path}/owner-code`, { ...init, body: JSON.stringify({ phone: phone.trim() }) });
        setRequested(true);
      }
    } catch (cause) {
      setError((cause as Error).message);
    } finally { setBusy(false); }
  }

  return <details className="rounded-2xl border border-slate-200 bg-white p-4">
    <summary className="cursor-pointer font-semibold text-emerald-900">View private shipment details</summary>
    {details ? <dl className="mt-3 space-y-2 text-sm">
      <div><dt className="text-slate-600">Goods owner</dt><dd>{details.ownerName} · {details.ownerPhone}</dd></div>
      <div><dt className="text-slate-600">Recipient</dt><dd>{details.recipientName} · {details.recipientPhone}</dd></div>
      <div><dt className="text-slate-600">Contents</dt><dd>{details.description || 'No description recorded'}</dd></div>
      <div><dt className="text-slate-600">Cartons</dt><dd>{details.cartonCount}</dd></div>
      <button type="button" className="font-semibold text-emerald-800 underline" onClick={() => { setDetails(null); setRequested(false); setPhone(''); }}>Hide private details</button>
    </dl> : <form className="mt-3 space-y-3 text-sm" onSubmit={(event) => void submit(event)}>
      <p className="text-slate-600">Verify the goods owner’s saved phone number to view names and contents.</p>
      <label className="block">Owner phone<input className={field} value={phone} onChange={(event) => setPhone(event.target.value)} type="tel" maxLength={25} autoComplete="tel" required readOnly={requested} /></label>
      {requested && <>
        <p className="text-slate-600">If the number matches the shipment, a verification code will arrive by SMS.</p>
        <label className="block">Verification code<input className={field} value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required /></label>
      </>}
      {error && <p role="alert" className="text-rose-800">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-3 py-2 font-semibold text-white disabled:opacity-50" disabled={busy}><LockKeyhole size={15} />{requested ? 'Verify & view details' : 'Send verification code'}</button>
        {requested && <button type="button" className="text-emerald-800 underline" disabled={busy} onClick={() => { setRequested(false); setCode(''); setError(''); }}>Start over</button>}
      </div>
    </form>}
  </details>;
}
