import { useEffect, useState } from 'react';
import { publicApi } from './api';
import { Package, MapPin, Truck, CheckCircle2, Clock, Loader2, Search, PackageCheck } from 'lucide-react';

/**
 * Public Cargo TZ tracker. The parcel QR encodes the tracking number and
 * opens this page (/ctz/:tracking). Shows the live status + full timeline.
 * No auth — the tracking number is the key.
 */
interface Track {
  trackingNumber: string; status: string; currentLocation: string;
  origin: string; destination: string; senderName: string; receiverName: string;
  description: string; quantity: number; paymentStatus: string;
  bus: { busNumber: string; driverName: string; departureTime: string | null; expectedArrival: string | null } | null;
  timeline: { status: string; location: string; note: string; at: string }[];
  createdAt: string;
}

const STAGES = ['RECEIVED_AT_SHOP', 'AT_WAREHOUSE', 'PACKED', 'LOADED', 'IN_TRANSIT', 'ARRIVED', 'READY_FOR_PICKUP', 'DELIVERED'];
const LABEL: Record<string, string> = {
  RECEIVED_AT_SHOP: 'Received at shop', AT_WAREHOUSE: 'At warehouse', PACKED: 'Packed',
  LOADED: 'Loaded on bus', IN_TRANSIT: 'In transit', ARRIVED: 'Arrived', READY_FOR_PICKUP: 'Ready for pickup', DELIVERED: 'Delivered', CANCELLED: 'Cancelled',
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

  const currentIdx = data ? STAGES.indexOf(data.status) : -1;

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900">
      <header className="bg-emerald-700 text-white px-5 py-6">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <PackageCheck className="w-6 h-6" />
          <div><h1 className="text-xl font-extrabold leading-tight">Track your parcel</h1><p className="text-xs text-white/70">Cargo TZ</p></div>
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
              <div className="text-lg font-extrabold font-mono">{data.trackingNumber}</div>
              <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${data.status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {data.status === 'DELIVERED' ? <CheckCircle2 className="w-4 h-4" /> : <Truck className="w-4 h-4" />} {LABEL[data.status] ?? data.status}
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                <MapPin className="w-4 h-4 text-slate-400" /> {data.origin} → {data.destination}
                {data.currentLocation && <span className="text-slate-400">· now at {data.currentLocation}</span>}
              </div>
              {data.bus?.busNumber && <div className="mt-1 text-xs text-slate-500">Bus {data.bus.busNumber}{data.bus.driverName ? ` · ${data.bus.driverName}` : ''}</div>}
            </div>

            {/* Timeline */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Journey</div>
              <div className="space-y-0">
                {STAGES.map((stage, i) => {
                  const done = i <= currentIdx;
                  const ev = data.timeline.find((e) => e.status === stage);
                  return (
                    <div key={stage} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full ${done ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                        {i < STAGES.length - 1 && <div className={`w-0.5 flex-1 min-h-[28px] ${i < currentIdx ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
                      </div>
                      <div className={`pb-3 ${done ? '' : 'opacity-40'}`}>
                        <div className="text-sm font-semibold">{LABEL[stage]}</div>
                        {ev && <div className="text-[11px] text-slate-400">{new Date(ev.at).toLocaleString()}{ev.location ? ` · ${ev.location}` : ''}{ev.note ? ` · ${ev.note}` : ''}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 text-sm space-y-1.5">
              <Row label="From" value={data.senderName} Icon={Package} />
              <Row label="To" value={data.receiverName} />
              <Row label="Contents" value={`${data.description || '—'}${data.quantity ? ` (${data.quantity})` : ''}`} />
              <Row label="Payment" value={data.paymentStatus === 'PAID' ? 'Paid' : 'Pay on arrival'} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, Icon }: { label: string; value: string; Icon?: typeof Package }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400 inline-flex items-center gap-1">{Icon && <Icon className="w-3.5 h-3.5" />}{label}</span>
      <span className="text-slate-700 font-medium">{value}</span>
    </div>
  );
}
