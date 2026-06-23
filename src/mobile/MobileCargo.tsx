import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  Plane, Send, Loader2, CheckCircle2, AlertTriangle, Calculator, BellRing, ExternalLink,
} from 'lucide-react';

/**
 * Mobile cargo screen — two modes side-by-side:
 *
 *   Quote   — pick lane + weight + (optional) dims → see price +
 *             next dispatch date before booking.
 *   Alert   — pre-alert an incoming parcel (carrier tracking #,
 *             destination, owner phone). The server matches by
 *             tracking # when the parcel physically arrives.
 *
 * The mobile webapp shell already gates routing per slug; this screen
 * registers at /m/:slug/cargo (added in MobileRoot + MobileShell).
 */

interface Lane {
  id: string;
  code: string;
  name: string;
  origin: string;
  destination: string;
  pricePerKg: number;
  currency: string;
  dispatchDays: string[];
}

interface Quote {
  laneCode: string;
  currency: string;
  pricePerKg: number;
  chargeableWeight: number;
  actualWeight: number;
  volumetricWeight: number;
  total: number;
  origin: string;
  destination: string;
  defaultCarrier?: string | null;
  nextDispatchAt?: string | null;
}

const fmt = (n: number, c = 'TZS') => `${c} ${Math.round(n).toLocaleString()}`;

export default function MobileCargo() {
  const [tab, setTab] = useState<'quote' | 'alert'>('quote');
  return (
    <div className="p-4 space-y-3 pb-24">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 grid place-items-center">
          <Plane className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 leading-tight">Cargo</h2>
          <p className="text-[11px] text-slate-500">Quote a shipment or alert us of one inbound</p>
        </div>
      </div>

      <div className="flex bg-slate-100 rounded-xl p-1 text-xs font-bold">
        <button
          onClick={() => setTab('quote')}
          className={`flex-1 h-9 rounded-lg inline-flex items-center justify-center gap-1 ${tab === 'quote' ? 'bg-white text-slate-900 shadow' : 'text-slate-500'}`}
        >
          <Calculator className="w-3.5 h-3.5" /> Get quote
        </button>
        <button
          onClick={() => setTab('alert')}
          className={`flex-1 h-9 rounded-lg inline-flex items-center justify-center gap-1 ${tab === 'alert' ? 'bg-white text-slate-900 shadow' : 'text-slate-500'}`}
        >
          <BellRing className="w-3.5 h-3.5" /> Pre-alert
        </button>
      </div>

      {tab === 'quote' ? <QuoteForm /> : <PreAlertForm />}
    </div>
  );
}

function QuoteForm() {
  const [lanes, setLanes] = useState<Lane[]>([]);
  const [laneId, setLaneId] = useState('');
  const [weight, setWeight] = useState('');
  const [showDims, setShowDims] = useState(false);
  const [dims, setDims] = useState({ length: '', width: '', height: '' });
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<Lane[]>('/cargo/lanes')
      .then((rows) => {
        if (Array.isArray(rows)) {
          setLanes(rows);
          if (rows[0]) setLaneId(rows[0].id);
        }
      })
      .catch((e) => setErr((e as Error).message));
  }, []);

  const submit = async () => {
    const w = Number(weight);
    if (!laneId || !w || w <= 0) return;
    setLoading(true);
    setErr(null);
    try {
      const dimsCm = showDims && dims.length && dims.width && dims.height
        ? { length: Number(dims.length), width: Number(dims.width), height: Number(dims.height) }
        : undefined;
      const q = await api<Quote>('/cargo/booking/quote', {
        method: 'POST',
        body: JSON.stringify({ laneId, weightKg: w, dimsCm }),
      });
      setQuote(q);
    } catch (e) { setErr((e as Error).message); }
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl border border-slate-200 p-3 space-y-2">
        <div>
          <label className="text-[10px] text-slate-500 uppercase font-bold">Lane</label>
          <select
            value={laneId}
            onChange={(e) => { setLaneId(e.target.value); setQuote(null); }}
            className="w-full h-10 px-2 mt-1 rounded-lg border border-slate-200 text-sm"
          >
            {lanes.length === 0 ? (
              <option value="">— no lanes set up yet —</option>
            ) : (
              lanes.map((l) => <option key={l.id} value={l.id}>{l.code} · {l.name}</option>)
            )}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-slate-500 uppercase font-bold">Weight (kg)</label>
          <input
            type="number"
            step="0.1"
            min={0}
            inputMode="decimal"
            value={weight}
            onChange={(e) => { setWeight(e.target.value); setQuote(null); }}
            placeholder="e.g. 4.5"
            className="w-full h-10 px-2 mt-1 rounded-lg border border-slate-200 text-sm"
          />
        </div>
        <button
          onClick={() => setShowDims((v) => !v)}
          className="text-[11px] text-violet-600 font-bold"
        >
          {showDims ? '− Hide dimensions' : '+ Add box dimensions (for bulky items)'}
        </button>
        {showDims && (
          <div className="grid grid-cols-3 gap-2">
            {(['length', 'width', 'height'] as const).map((k) => (
              <input
                key={k}
                type="number"
                min={0}
                value={dims[k]}
                onChange={(e) => { setDims((d) => ({ ...d, [k]: e.target.value })); setQuote(null); }}
                placeholder={k[0].toUpperCase() + k.slice(1) + ' cm'}
                className="h-9 px-2 rounded-lg border border-slate-200 text-xs"
              />
            ))}
          </div>
        )}
        <button
          onClick={submit}
          disabled={loading || !laneId || !weight}
          className="w-full h-11 rounded-lg bg-amber-500 active:bg-amber-600 disabled:opacity-40 text-amber-950 font-extrabold text-sm inline-flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
          Get quote
        </button>
        {err && (
          <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded p-2 inline-flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {err}
          </div>
        )}
      </div>

      {quote && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 space-y-2">
          <div className="text-[10px] text-amber-700 uppercase font-bold tracking-wide">Quoted price</div>
          <div className="text-3xl font-black text-amber-900 tabular-nums">{fmt(quote.total, quote.currency)}</div>
          <div className="text-[11px] text-amber-700/80">
            {quote.origin || '?'} → {quote.destination || '?'}
            {quote.defaultCarrier && <> · via {quote.defaultCarrier}</>}
          </div>
          <div className="text-[11px] text-amber-800 grid grid-cols-2 gap-1 pt-2 border-t border-amber-200/60">
            <Row label="Rate" value={fmt(quote.pricePerKg, quote.currency) + ' / kg'} />
            <Row label="Actual weight" value={`${quote.actualWeight} kg`} />
            <Row label="Volumetric" value={`${quote.volumetricWeight} kg`} />
            <Row label="Chargeable" value={`${quote.chargeableWeight} kg`} bold />
            {quote.nextDispatchAt && (
              <Row
                label="Next dispatch"
                value={new Date(quote.nextDispatchAt).toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' })}
                full
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PreAlertForm() {
  const [form, setForm] = useState({
    externalTracking: '',
    senderName: '',
    senderPhone: '',
    ownerName: '',
    ownerPhone: '',
    destination: '',
    description: '',
    weight: '',
  });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ parcelId: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!form.externalTracking.trim() || !form.ownerName.trim() || !form.ownerPhone.trim() || !form.destination.trim()) {
      setErr('Tracking number, owner name + phone, and destination are required.');
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const res = await api<{ parcelId: string }>('/cargo/pre-alerts', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          weight: form.weight ? Number(form.weight) : undefined,
        }),
      });
      setDone({ parcelId: res.parcelId });
      setForm({ externalTracking: '', senderName: '', senderPhone: '', ownerName: '', ownerPhone: '', destination: '', description: '', weight: '' });
    } catch (e) { setErr((e as Error).message); }
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      {done && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-900 p-3 space-y-2">
          <div className="inline-flex items-center gap-1.5 text-sm font-extrabold">
            <CheckCircle2 className="w-4 h-4" /> Pre-alert registered
          </div>
          <div className="text-xs">
            Your reference: <span className="font-mono font-bold">{done.parcelId}</span>
          </div>
          <a
            href={`/track/${done.parcelId}`}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-emerald-700 font-bold inline-flex items-center gap-1"
          >
            Open public tracking page <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 space-y-2">
        <Field label="Carrier tracking #" value={form.externalTracking} onChange={(v) => setForm((f) => ({ ...f, externalTracking: v }))} placeholder="YT8879481929295" mono required />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Sender name" value={form.senderName} onChange={(v) => setForm((f) => ({ ...f, senderName: v }))} placeholder="Supplier" />
          <Field label="Sender phone" value={form.senderPhone} onChange={(v) => setForm((f) => ({ ...f, senderPhone: v }))} placeholder="+86 …" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Owner name" value={form.ownerName} onChange={(v) => setForm((f) => ({ ...f, ownerName: v }))} placeholder="Customer" required />
          <Field label="Owner phone" value={form.ownerPhone} onChange={(v) => setForm((f) => ({ ...f, ownerPhone: v }))} placeholder="+255 …" required />
        </div>
        <Field label="Destination" value={form.destination} onChange={(v) => setForm((f) => ({ ...f, destination: v }))} placeholder="Dar es Salaam" required />
        <Field label="Description (optional)" value={form.description} onChange={(v) => setForm((f) => ({ ...f, description: v }))} placeholder="3 boxes of hardware" />
        <Field label="Estimated weight (kg)" value={form.weight} onChange={(v) => setForm((f) => ({ ...f, weight: v }))} placeholder="e.g. 12" />
        {err && (
          <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded p-2 inline-flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {err}
          </div>
        )}
        <button
          onClick={submit}
          disabled={loading}
          className="w-full h-11 rounded-lg bg-amber-500 active:bg-amber-600 disabled:opacity-40 text-amber-950 font-extrabold text-sm inline-flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send pre-alert
        </button>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, mono, required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-[10px] text-slate-500 uppercase font-bold">{label}{required && <span className="text-rose-500 ml-1">*</span>}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full h-10 px-2 mt-1 rounded-lg border border-slate-200 text-sm ${mono ? 'font-mono' : ''}`}
      />
    </div>
  );
}

function Row({ label, value, bold, full }: { label: string; value: string; bold?: boolean; full?: boolean }) {
  return (
    <>
      <div className="text-[10px] text-amber-700/70">{label}</div>
      <div className={`text-right tabular-nums ${bold ? 'font-extrabold text-amber-900' : ''} ${full ? 'col-start-2' : ''}`}>{value}</div>
    </>
  );
}
