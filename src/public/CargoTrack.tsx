import { useEffect, useState } from 'react';
import { API_BASE } from '@/lib/api';
import {
  Package, Plane, Truck, Check, Loader2, Search, MapPin, Clock, AlertTriangle,
} from 'lucide-react';

/**
 * Public cargo tracking page — no auth, designed to be shared over
 * WhatsApp. Hits GET /api/track/:reference (public endpoint that
 * returns a sanitised view — no PII). URL convention:
 *
 *   https://app.kobeapptz.com/track/PA-XXXXXX
 *   https://app.kobeapptz.com/track/YT8879481929295   (carrier tracking)
 *   https://app.kobeapptz.com/track/SH-…              (shipment id)
 */

interface TrackResult {
  reference: string;
  status: string;
  destination: string;
  weight?: number;
  packageCount?: number;
  preAlertedAt?: string | null;
  externalTracking?: string | null;
  carrier?: string | null;
  flightNumber?: string | null;
  etd?: string | null;
  eta?: string | null;
  shipmentStatus?: string | null;
  timeline: Array<{ stage: string; at?: string | null; current: boolean }>;
}

const STAGE_LABELS: Record<string, string> = {
  PRE_ALERTED: 'Pre-alerted',
  AWAITING_STORAGE: 'At our dock',
  STORED: 'In storage',
  ON_HOLD: 'On hold',
  FOR_CONSOLIDATION: 'Being packed',
  CONSOLIDATED: 'Packed & ready to ship',
  IN_TRANSIT: 'In transit',
  OVERSEAS_RECEIVED: 'Arrived at destination',
  READY_FOR_PICKUP: 'Ready for pickup',
  DELIVERED: 'Delivered',
};

export default function CargoTrack() {
  const path = window.location.pathname;
  const initialRef = decodeURIComponent(path.replace(/^\/track\//, '').trim());
  const [reference, setReference] = useState(initialRef);
  const [result, setResult] = useState<TrackResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const lookup = async (ref: string) => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${API_BASE}/track/${encodeURIComponent(ref)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || `Not found (${res.status})`);
      }
      setResult(await res.json());
    } catch (e) {
      setErr((e as Error).message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialRef) void lookup(initialRef);
  }, [initialRef]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reference.trim()) return;
    window.history.replaceState({}, '', `/track/${encodeURIComponent(reference.trim())}`);
    void lookup(reference.trim());
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 text-white">
      <header className="border-b border-white/[0.06] px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 grid place-items-center">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-extrabold">KobeOS Cargo</h1>
            <p className="text-[11px] text-white/50">Track your parcel</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <form onSubmit={submit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="PA-XXXXXX, YT8879481…, SH-…"
              className="w-full h-11 pl-9 pr-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm placeholder-white/30"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !reference.trim()}
            className="h-11 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-amber-950 font-extrabold text-sm"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Track'}
          </button>
        </form>

        {err && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-rose-200">Couldn't find that reference</div>
              <div className="text-xs text-rose-300/80 mt-0.5">{err}</div>
              <div className="text-[10px] text-white/40 mt-2">
                Double-check the format. References usually look like PA-XXXXXX (pre-alert),
                YT… / 1Z… (carrier tracking), or SH-… (shipment).
              </div>
            </div>
          </div>
        )}

        {result && (
          <>
            {/* Status hero */}
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
              <div className="text-[10px] text-white/40 uppercase font-bold tracking-wide">Status</div>
              <div className="text-2xl font-extrabold text-amber-300 mt-0.5">
                {STAGE_LABELS[result.status] ?? result.status}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <Stat label="Reference" value={result.reference} mono />
                <Stat label="Destination" value={result.destination} icon={<MapPin className="w-3 h-3" />} />
                {result.weight != null && result.weight > 0 && (
                  <Stat label="Weight" value={`${Number(result.weight).toFixed(2)} kg`} />
                )}
                {result.packageCount != null && (
                  <Stat label="Packages" value={String(result.packageCount)} />
                )}
                {result.carrier && <Stat label="Carrier" value={result.carrier} icon={<Truck className="w-3 h-3" />} />}
                {result.flightNumber && (
                  <Stat label="Flight" value={result.flightNumber} icon={<Plane className="w-3 h-3" />} mono />
                )}
                {result.etd && <Stat label="Departed" value={formatDate(result.etd)} icon={<Clock className="w-3 h-3" />} />}
                {result.eta && <Stat label="Arrives" value={formatDate(result.eta)} icon={<Clock className="w-3 h-3" />} />}
              </div>
            </div>

            {/* Timeline */}
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
              <div className="text-xs font-bold text-white/60 uppercase tracking-wide mb-3">Journey</div>
              <ol className="space-y-3">
                {result.timeline.map((step, i) => {
                  const past = i < result.timeline.findIndex((s) => s.current);
                  const at = step.current || past;
                  return (
                    <li key={step.stage} className="flex items-start gap-3">
                      <div className={`w-6 h-6 rounded-full grid place-items-center mt-0.5 shrink-0 ${
                        step.current ? 'bg-amber-500 text-amber-950' :
                        past         ? 'bg-emerald-500/30 text-emerald-300' :
                                       'bg-white/[0.06] text-white/30'
                      }`}>
                        {past ? <Check className="w-3.5 h-3.5" /> : <span className="text-[10px] font-bold">{i + 1}</span>}
                      </div>
                      <div className="flex-1">
                        <div className={`text-sm font-bold ${
                          step.current ? 'text-amber-200' : at ? 'text-white' : 'text-white/40'
                        }`}>
                          {STAGE_LABELS[step.stage] ?? step.stage}
                        </div>
                        {step.at && (
                          <div className="text-[10px] text-white/40">{formatDate(step.at)}</div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            <p className="text-[10px] text-white/30 text-center">
              Updates appear automatically as the parcel moves through our hubs.
            </p>
          </>
        )}

        {!result && !err && !loading && initialRef === '' && (
          <div className="text-center py-12 text-white/40 text-sm">
            Enter a reference above to track your parcel.
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, icon, mono }: { label: string; value: string; icon?: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="text-[9px] text-white/40 uppercase font-bold tracking-wide">{label}</div>
      <div className={`text-xs text-white/90 mt-0.5 inline-flex items-center gap-1 ${mono ? 'font-mono' : ''}`}>
        {icon}{value}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}
