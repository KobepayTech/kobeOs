// @ts-nocheck
import { useEffect, useState } from "react";
import { Package, MapPin, Phone, Loader2, Check, AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";

/**
 * Public Mzigo tracking page — recipient or owner pastes / opens the
 * waybill URL, sees the lifecycle status, and (when the parcel has
 * arrived) taps "I collected it" to close the loop without making
 * the cargo office type into a screen.
 *
 * URL: https://app.kobeapptz.com/mzigo/track/{waybill}
 */

const API_BASE = (import.meta.env && import.meta.env.VITE_API_BASE) || "/api";

const STATUS = {
  REGISTERED:     { label: "Awaiting agent",       color: "bg-amber-100 text-amber-800",     idx: 0 },
  AGENT_SELECTED: { label: "Agent assigned",       color: "bg-amber-100 text-amber-800",     idx: 1 },
  PICKED_UP:      { label: "Picked up",            color: "bg-blue-100 text-blue-800",       idx: 2 },
  AT_WAREHOUSE:   { label: "At warehouse",         color: "bg-blue-100 text-blue-800",       idx: 3 },
  ON_TRUCK:       { label: "Loaded on truck",      color: "bg-violet-100 text-violet-800",   idx: 4 },
  IN_TRANSIT:     { label: "In transit",           color: "bg-violet-100 text-violet-800",   idx: 5 },
  DELIVERED_DEST: { label: "Arrived — collect",    color: "bg-emerald-100 text-emerald-800", idx: 6 },
  COLLECTED:      { label: "Collected",            color: "bg-slate-200 text-slate-700",     idx: 7 },
};

const TIMELINE = [
  { key: "REGISTERED",     label: "Registered" },
  { key: "PICKED_UP",      label: "Picked up by agent" },
  { key: "AT_WAREHOUSE",   label: "Arrived at warehouse" },
  { key: "ON_TRUCK",       label: "Loaded on truck" },
  { key: "IN_TRANSIT",     label: "In transit" },
  { key: "DELIVERED_DEST", label: "Arrived at destination" },
  { key: "COLLECTED",      label: "Collected" },
];

const fmtDate = (iso) => iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

export default function MzigoTrack() {
  const waybill = window.location.pathname.replace(/^\/mzigo\/track\//, "").replace(/\/$/, "").toUpperCase();
  const [parcel, setParcel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [name, setName] = useState("");
  const [collecting, setCollecting] = useState(false);

  const reload = async () => {
    setLoading(true); setErr("");
    try {
      const r = await fetch(`${API_BASE}/mzigo-track/${encodeURIComponent(waybill)}`);
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.message || `HTTP ${r.status}`);
      setParcel(body);
    } catch (e) { setErr(e.message); }
    setLoading(false);
  };
  useEffect(() => { if (waybill) void reload(); }, [waybill]);

  const collect = async () => {
    setCollecting(true);
    try {
      const r = await fetch(`${API_BASE}/mzigo-track/${encodeURIComponent(waybill)}/collected`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectedByName: name.trim() || undefined }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.message || `HTTP ${r.status}`);
      setParcel(body);
    } catch (e) { setErr(e.message); }
    setCollecting(false);
  };

  // -1 for unknown/missing statuses so the timeline isn't falsely
  // anchored at REGISTERED; the raw status is still shown in the badge.
  const currentIdx = parcel ? (STATUS[parcel.status]?.idx ?? -1) : -1;

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-amber-100 text-slate-900">
      <header className="px-5 py-4 border-b border-amber-200 bg-white/70 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white grid place-items-center"><Package className="w-5 h-5" /></div>
          <div>
            <div className="font-extrabold text-base">KobeOS · Mzigo</div>
            <div className="text-[11px] text-amber-700/70">Track your parcel</div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        {loading && <div className="text-center py-12 text-slate-500 text-sm"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>}

        {err && !parcel && (
          <div className="rounded-xl border border-rose-300 bg-rose-50 text-rose-800 p-4">
            <div className="font-bold text-sm inline-flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Couldn't find that waybill</div>
            <div className="text-xs mt-1 opacity-80">{err}</div>
            <div className="text-[11px] text-slate-500 mt-2">Check the code — it looks like KM-XXXXXX.</div>
          </div>
        )}

        {parcel && (
          <>
            <div className="rounded-2xl bg-white border-2 border-amber-300 p-5 shadow-md text-center">
              <div className="text-[10px] uppercase font-bold text-amber-700 tracking-widest">Waybill</div>
              <div className="text-3xl font-mono font-extrabold tracking-widest text-amber-700 mt-1">{parcel.waybill}</div>
              <span className={`inline-block mt-3 text-[11px] font-bold px-2.5 py-1 rounded-full ${STATUS[parcel.status]?.color}`}>
                {STATUS[parcel.status]?.label ?? parcel.status}
              </span>
            </div>

            <div className="rounded-xl bg-white border border-amber-200 p-4 space-y-1.5 text-sm">
              <Pair k="From" v={parcel.ownerName} />
              <Pair k="To" v={`${parcel.recipientName} · ${parcel.recipientPhone}`} />
              <Pair k="Route" v={<span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{parcel.origin} <ArrowRight className="w-3 h-3" /> {parcel.destination}</span>} />
              {parcel.goodsType && <Pair k="Goods" v={parcel.goodsType} />}
              {parcel.weightKg > 0 && <Pair k="Weight" v={`${parcel.weightKg} kg`} />}
              {parcel.agentName && <Pair k="Agent" v={`${parcel.agentName}${parcel.companyName ? ` · ${parcel.companyName}` : ""}`} />}
              {parcel.truckPlate && <Pair k="Truck" v={`${parcel.truckPlate}${parcel.driverName ? ` · ${parcel.driverName}` : ""}`} />}
            </div>

            {/* Lifecycle timeline */}
            <div className="rounded-xl bg-white border border-amber-200 p-4">
              <div className="text-[10px] uppercase font-bold text-amber-700 tracking-wide mb-3">Journey</div>
              <ol className="space-y-3">
                {TIMELINE.map((step, i) => {
                  const past = i < currentIdx;
                  const cur = i === currentIdx;
                  return (
                    <li key={step.key} className="flex items-start gap-3">
                      <div className={`w-6 h-6 rounded-full grid place-items-center shrink-0 ${
                        cur ? "bg-amber-500 text-white" :
                        past ? "bg-emerald-500/30 text-emerald-700" :
                               "bg-slate-100 text-slate-400"
                      }`}>
                        {past ? <Check className="w-3.5 h-3.5" /> : <span className="text-[10px] font-bold">{i + 1}</span>}
                      </div>
                      <div className="flex-1">
                        <div className={`text-sm font-bold ${cur ? "text-amber-700" : past ? "text-slate-700" : "text-slate-400"}`}>{step.label}</div>
                        {step.key === "PICKED_UP" && parcel.pickedUpAt && <div className="text-[10px] text-slate-500">{fmtDate(parcel.pickedUpAt)}</div>}
                        {step.key === "AT_WAREHOUSE" && parcel.atWarehouseAt && <div className="text-[10px] text-slate-500">{fmtDate(parcel.atWarehouseAt)}</div>}
                        {step.key === "ON_TRUCK" && parcel.onTruckAt && <div className="text-[10px] text-slate-500">{fmtDate(parcel.onTruckAt)}</div>}
                        {step.key === "IN_TRANSIT" && parcel.inTransitAt && <div className="text-[10px] text-slate-500">{fmtDate(parcel.inTransitAt)}</div>}
                        {step.key === "DELIVERED_DEST" && parcel.deliveredAt && <div className="text-[10px] text-slate-500">{fmtDate(parcel.deliveredAt)}</div>}
                        {step.key === "COLLECTED" && parcel.collectedAt && <div className="text-[10px] text-slate-500">{fmtDate(parcel.collectedAt)}</div>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* "I collected" CTA when DELIVERED_DEST */}
            {parcel.status === "DELIVERED_DEST" && (
              <div className="rounded-2xl bg-emerald-500 text-white p-5 text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 mx-auto" />
                <div className="text-base font-extrabold">Your parcel is ready — go collect it</div>
                <div className="text-xs opacity-90">{parcel.destination} cargo office. Show this code at the counter.</div>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)" className="w-full h-10 px-3 rounded-lg text-slate-900 text-sm" />
                <button onClick={collect} disabled={collecting} className="w-full h-11 rounded-xl bg-white text-emerald-700 font-extrabold text-sm disabled:opacity-60 inline-flex items-center justify-center gap-2">
                  {collecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  I have collected this parcel
                </button>
              </div>
            )}

            {parcel.status === "COLLECTED" && (
              <div className="rounded-xl bg-slate-100 border border-slate-200 p-4 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1" />
                <div className="text-sm font-bold">Delivered & collected</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{fmtDate(parcel.collectedAt)}</div>
              </div>
            )}

            {err && parcel && (
              <div className="rounded-lg border border-rose-300 bg-rose-50 text-rose-800 text-xs p-2">{err}</div>
            )}
          </>
        )}

        <p className="text-[10px] text-slate-400 text-center pt-2">Powered by KobeOS · Mzigo</p>
      </main>
    </div>
  );
}

function Pair({ k, v }) {
  return <div className="flex justify-between text-xs gap-2"><span className="text-slate-500 shrink-0">{k}</span><span className="font-bold text-right">{v}</span></div>;
}
