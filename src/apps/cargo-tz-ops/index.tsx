import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useQRScanner } from '@/hooks/useQRScanner';
import { usePwaManifest } from '@/hooks/usePwaManifest';
import { InstallPwaButton } from '@/mobile/InstallPwaButton';
import { QRCodeSVG } from 'qrcode.react';
import {
  PackagePlus, Warehouse, LayoutDashboard, Camera, Loader2, CheckCircle2, Printer, Plus,
  Truck, MapPin, Clock, Wallet, PackageCheck, X, Search, ArrowRight, Users, AlertCircle,
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell } from 'recharts';

/* ── Types ── */
interface Parcel {
  id: string; trackingNumber: string; senderName: string; senderPhone: string;
  receiverName: string; receiverPhone: string; description: string; quantity: number;
  origin: string; destination: string; transportFee: number | string; paymentStatus: 'PAID' | 'UNPAID';
  status: string; currentLocation: string; fragile: boolean; cashOnDelivery: boolean;
}
interface Warehouse2 { warehouseLocation: string; shelfNumber: string; bagNumber: string; busNumber: string; driverName: string; packedBy: string }
interface Timeline { status: string; location: string; note: string; at: string }
interface Full { parcel: Parcel; warehouse: Warehouse2 | null; timeline: Timeline[] }
interface Dash { cards: { receivedToday: number; inWarehouse: number; dispatched: number; delivered: number; cashCollected: number; outstanding: number; totalParcels: number }; byStatus: { status: string; count: number }[]; trend: { date: string; parcels: number; revenue: number }[] }

const ADVANCE = ['AT_WAREHOUSE', 'PACKED', 'LOADED', 'IN_TRANSIT', 'ARRIVED', 'READY_FOR_PICKUP', 'DELIVERED'];
const LABEL: Record<string, string> = { RECEIVED_AT_SHOP: 'Received', AT_WAREHOUSE: 'At warehouse', PACKED: 'Packed', LOADED: 'Loaded', IN_TRANSIT: 'In transit', ARRIVED: 'Arrived', READY_FOR_PICKUP: 'Ready for pickup', DELIVERED: 'Delivered', CANCELLED: 'Cancelled' };
const tsh = (n: number | string) => `TSh ${Number(n || 0).toLocaleString()}`;
const CHART = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

const ROLE_META: Record<'intake' | 'warehouse' | 'dashboard', { slug: string; name: string; short: string; icon: string; theme: string }> = {
  intake: { slug: 'receive', name: 'Cargo TZ · Receiving Agent', short: 'CTZ Receive', icon: '/ctz-receive', theme: '#059669' },
  warehouse: { slug: 'warehouse', name: 'Cargo TZ · Warehouse', short: 'CTZ Warehouse', icon: '/ctz-warehouse', theme: '#4f46e5' },
  dashboard: { slug: 'owner', name: 'Cargo TZ · Owner', short: 'CTZ Owner', icon: '/ctz-owner', theme: '#d97706' },
};

export default function CargoTzOps({ role }: { role?: 'intake' | 'warehouse' | 'dashboard' }) {
  const [tab, setTab] = useState<'intake' | 'warehouse' | 'dashboard'>(role ?? 'intake');
  const [pin, setPin] = useState('');

  // Route-scoped installable PWA: installing while on a tab adds a home-screen
  // app for THAT role (e.g. "Cargo TZ · Warehouse" opening at /cargotz/warehouse),
  // so each staffer gets their own app. Only meaningful on the standalone URL.
  const standalone = typeof window !== 'undefined' && /^\/cargotz(\/|$)/.test(window.location.pathname);
  const meta = ROLE_META[tab];
  usePwaManifest({ name: meta.name, shortName: meta.short, startUrl: `/cargotz/${meta.slug}`, iconBase: meta.icon, themeColor: meta.theme, enabled: standalone });
  useEffect(() => {
    if (standalone && window.location.pathname !== `/cargotz/${meta.slug}`) {
      window.history.replaceState(null, '', `/cargotz/${meta.slug}`);
    }
  }, [standalone, meta.slug]);
  const apiPin = useCallback(<T,>(path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (pin.trim()) headers.set('x-ctz-pin', pin.trim());
    return api<T>(path, { ...init, headers });
  }, [pin]);

  const tabs = [
    { key: 'intake', label: 'Receive', Icon: PackagePlus },
    { key: 'warehouse', label: 'Warehouse', Icon: Warehouse },
    { key: 'dashboard', label: 'Owner', Icon: LayoutDashboard },
  ] as const;

  return (
    <div className="h-full flex flex-col bg-slate-50 text-slate-900 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-emerald-700 text-white shrink-0">
        <div className="flex items-center gap-2"><PackageCheck className="w-5 h-5" /><span className="font-extrabold">Cargo TZ</span></div>
        <div className="flex items-center gap-2">
          {standalone && <InstallPwaButton />}
          <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="Staff PIN" inputMode="numeric"
            className="w-24 h-8 px-2 rounded-md text-slate-900 text-xs text-center tracking-widest" title="Optional — your 4-digit staff PIN attributes the action" />
        </div>
      </div>
      <div className="flex border-b border-slate-200 bg-white shrink-0">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex-1 py-2.5 inline-flex items-center justify-center gap-1.5 text-xs font-bold ${tab === t.key ? 'text-emerald-700 border-b-2 border-emerald-600' : 'text-slate-500'}`}>
            <t.Icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto">
        {tab === 'intake' && <IntakeTab apiPin={apiPin} />}
        {tab === 'warehouse' && <WarehouseTab apiPin={apiPin} />}
        {tab === 'dashboard' && <DashboardTab apiPin={apiPin} />}
      </div>
    </div>
  );
}

/* ─────────── Receiving Agent — intake ─────────── */
function IntakeTab({ apiPin }: { apiPin: <T,>(p: string, i?: RequestInit) => Promise<T> }) {
  const empty = { senderName: '', senderPhone: '', senderId: '', receiverName: '', receiverPhone: '', parcelType: '', description: '', quantity: 1, weight: '', value: '', origin: '', destination: '', transportFee: '', paymentStatus: 'UNPAID' as 'PAID' | 'UNPAID', fragile: false, cashOnDelivery: false, notes: '' };
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Parcel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    setError(null);
    if (!f.senderName || !f.senderPhone || !f.receiverName || !f.receiverPhone || !f.origin || !f.destination) { setError('Fill sender, receiver and route.'); return; }
    setBusy(true);
    try {
      const p = await apiPin<Parcel>('/cargotz/parcels', { method: 'POST', body: JSON.stringify({ ...f, quantity: Number(f.quantity) || 1, weight: Number(f.weight) || 0, value: Number(f.value) || 0, transportFee: Number(f.transportFee) || 0 }) });
      setDone(p);
    } catch (e) { setError((e as Error).message || 'Could not create parcel'); }
    finally { setBusy(false); }
  };

  if (done) {
    const url = `${window.location.origin}/ctz/${done.trackingNumber}`;
    return (
      <div className="p-4 max-w-md mx-auto text-center space-y-4">
        <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto" />
        <div><div className="text-sm text-slate-500">Parcel received</div><div className="text-2xl font-extrabold font-mono">{done.trackingNumber}</div></div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 inline-block">
          <QRCodeSVG value={done.trackingNumber} size={180} />
          <div className="text-[11px] text-slate-400 mt-2">Scan at the warehouse or to track</div>
        </div>
        <div className="text-sm text-slate-600">{done.origin} → {done.destination} · {done.receiverName}</div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="flex-1 h-11 rounded-xl bg-slate-800 text-white font-bold inline-flex items-center justify-center gap-2"><Printer className="w-4 h-4" /> Print</button>
          <button onClick={() => { setDone(null); setF(empty); }} className="flex-1 h-11 rounded-xl bg-emerald-600 text-white font-bold inline-flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> New parcel</button>
        </div>
        <a href={url} target="_blank" rel="noreferrer" className="text-xs text-emerald-600 underline inline-flex items-center gap-1">Open tracking page <ArrowRight className="w-3 h-3" /></a>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-md mx-auto space-y-3">
      <Section title="Sender">
        <In v={f.senderName} set={(v) => set('senderName', v)} ph="Sender name *" />
        <In v={f.senderPhone} set={(v) => set('senderPhone', v)} ph="Sender phone *" />
        <In v={f.senderId} set={(v) => set('senderId', v)} ph="Sender ID (optional)" />
      </Section>
      <Section title="Receiver">
        <In v={f.receiverName} set={(v) => set('receiverName', v)} ph="Receiver name *" />
        <In v={f.receiverPhone} set={(v) => set('receiverPhone', v)} ph="Receiver phone *" />
      </Section>
      <Section title="Parcel">
        <In v={f.description} set={(v) => set('description', v)} ph="Description" />
        <div className="grid grid-cols-3 gap-2">
          <In v={f.parcelType} set={(v) => set('parcelType', v)} ph="Type" />
          <In v={f.quantity} set={(v) => set('quantity', v)} ph="Qty" type="number" />
          <In v={f.weight} set={(v) => set('weight', v)} ph="Kg" type="number" />
        </div>
      </Section>
      <Section title="Route">
        <div className="grid grid-cols-2 gap-2">
          <In v={f.origin} set={(v) => set('origin', v)} ph="From *" />
          <In v={f.destination} set={(v) => set('destination', v)} ph="To *" />
        </div>
      </Section>
      <Section title="Charges">
        <div className="grid grid-cols-2 gap-2">
          <In v={f.transportFee} set={(v) => set('transportFee', v)} ph="Transport fee" type="number" />
          <select value={f.paymentStatus} onChange={(e) => set('paymentStatus', e.target.value)} className="h-10 px-2 rounded-lg border border-slate-200 text-sm">
            <option value="UNPAID">Not paid</option><option value="PAID">Paid</option>
          </select>
        </div>
        <div className="flex gap-4 pt-1">
          <label className="text-xs inline-flex items-center gap-1.5"><input type="checkbox" checked={f.fragile} onChange={(e) => set('fragile', e.target.checked)} /> Fragile</label>
          <label className="text-xs inline-flex items-center gap-1.5"><input type="checkbox" checked={f.cashOnDelivery} onChange={(e) => set('cashOnDelivery', e.target.checked)} /> Cash on delivery</label>
        </div>
      </Section>
      {error && <div className="text-sm text-rose-600 inline-flex items-center gap-1"><AlertCircle className="w-4 h-4" />{error}</div>}
      <button onClick={submit} disabled={busy} className="w-full h-12 rounded-xl bg-emerald-600 text-white font-extrabold inline-flex items-center justify-center gap-2 disabled:opacity-50">
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <PackagePlus className="w-5 h-5" />} Receive parcel → generate tracking
      </button>
    </div>
  );
}

/* ─────────── Warehouse — scan + pack + advance ─────────── */
function WarehouseTab({ apiPin }: { apiPin: <T,>(p: string, i?: RequestInit) => Promise<T> }) {
  const [tn, setTn] = useState('');
  const [full, setFull] = useState<Full | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pack, setPack] = useState({ warehouseLocation: '', shelfNumber: '', bagNumber: '', busNumber: '', driverName: '', driverPhone: '', departureTime: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (key: string) => {
    if (!key.trim()) return;
    setLoading(true); setError(null);
    try { const f = await apiPin<Full>(`/cargotz/parcels/${encodeURIComponent(key.trim().toUpperCase())}`); setFull(f); setPack((p) => ({ ...p, ...(f.warehouse || {}) })); }
    catch (e) { setError((e as Error).message || 'Not found'); setFull(null); }
    finally { setLoading(false); }
  }, [apiPin]);

  const onScan = (raw: string) => { setScanning(false); const m = raw.match(/CTZ-\d{8}-\d{6}/i); const t = m ? m[0] : raw.trim(); setTn(t.toUpperCase()); load(t); };

  const doPack = async () => {
    if (!full) return;
    setBusy(true); setError(null);
    try { const f = await apiPin<Full>(`/cargotz/parcels/${full.parcel.trackingNumber}/pack`, { method: 'POST', body: JSON.stringify(pack) }); setFull(f); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const advance = async (status: string) => {
    if (!full) return;
    setBusy(true);
    try { const f = await apiPin<Full>(`/cargotz/parcels/${full.parcel.trackingNumber}/status`, { method: 'POST', body: JSON.stringify({ status }) }); setFull(f); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const markPaid = async () => { if (!full) return; await apiPin(`/cargotz/parcels/${full.parcel.trackingNumber}/payment`, { method: 'POST', body: JSON.stringify({ paid: true }) }); load(full.parcel.trackingNumber); };

  return (
    <div className="p-4 max-w-md mx-auto space-y-4">
      <button onClick={() => setScanning(true)} className="w-full h-16 rounded-2xl bg-emerald-600 text-white font-extrabold text-lg inline-flex items-center justify-center gap-2"><Camera className="w-6 h-6" /> Scan parcel QR</button>
      <div className="flex gap-2">
        <div className="relative flex-1"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={tn} onChange={(e) => setTn(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === 'Enter') load(tn); }} placeholder="or type CTZ-..." className="w-full h-11 pl-9 pr-3 rounded-xl border border-slate-200 text-sm font-mono" /></div>
        <button onClick={() => load(tn)} disabled={loading} className="h-11 px-4 rounded-xl bg-slate-800 text-white text-sm font-bold">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Load'}</button>
      </div>
      {error && <div className="text-sm text-rose-600 inline-flex items-center gap-1"><AlertCircle className="w-4 h-4" />{error}</div>}

      {full && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
            <div><div className="text-[11px] text-white/60">Tracking</div><div className="font-mono font-extrabold">{full.parcel.trackingNumber}</div></div>
            <span className="text-xs font-bold bg-white/15 rounded-full px-2.5 py-1">{LABEL[full.parcel.status] ?? full.parcel.status}</span>
          </div>
          <div className="p-4 space-y-3">
            <div className="text-sm"><MapPin className="w-3.5 h-3.5 inline text-slate-400" /> {full.parcel.origin} → {full.parcel.destination}
              {full.parcel.fragile && <span className="ml-2 text-[10px] font-bold text-rose-600 bg-rose-50 rounded px-1.5 py-0.5">FRAGILE</span>}</div>
            <div className="text-xs text-slate-500">{full.parcel.receiverName} · {full.parcel.receiverPhone} · {full.parcel.description}</div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold">{tsh(full.parcel.transportFee)}</span>
              {full.parcel.paymentStatus === 'PAID' ? <span className="text-emerald-600 text-xs font-bold">PAID</span> : <button onClick={markPaid} className="text-xs font-bold text-white bg-emerald-600 rounded-lg px-2 py-1 inline-flex items-center gap-1"><Wallet className="w-3 h-3" /> Mark paid</button>}
            </div>

            <div className="border-t border-slate-100 pt-3">
              <div className="text-xs font-bold text-slate-500 uppercase mb-2">Warehouse packing</div>
              <div className="grid grid-cols-2 gap-2">
                <In v={pack.warehouseLocation} set={(v) => setPack({ ...pack, warehouseLocation: v })} ph="Warehouse" />
                <In v={pack.shelfNumber} set={(v) => setPack({ ...pack, shelfNumber: v })} ph="Shelf" />
                <In v={pack.bagNumber} set={(v) => setPack({ ...pack, bagNumber: v })} ph="Bag" />
                <In v={pack.busNumber} set={(v) => setPack({ ...pack, busNumber: v })} ph="Bus number" />
                <In v={pack.driverName} set={(v) => setPack({ ...pack, driverName: v })} ph="Driver" />
                <In v={pack.driverPhone} set={(v) => setPack({ ...pack, driverPhone: v })} ph="Driver phone" />
              </div>
              <button onClick={doPack} disabled={busy} className="w-full h-10 mt-2 rounded-lg bg-indigo-600 text-white font-bold text-sm inline-flex items-center justify-center gap-1.5 disabled:opacity-50"><Warehouse className="w-4 h-4" /> Save packing</button>
            </div>

            <div className="border-t border-slate-100 pt-3">
              <div className="text-xs font-bold text-slate-500 uppercase mb-2">Advance status</div>
              <div className="grid grid-cols-2 gap-2">
                {ADVANCE.map((s) => (
                  <button key={s} onClick={() => advance(s)} disabled={busy || full.parcel.status === s} className={`h-9 rounded-lg text-xs font-bold border ${full.parcel.status === s ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-200 text-slate-600 hover:border-emerald-400'}`}>{LABEL[s]}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {scanning && <Scanner onClose={() => setScanning(false)} onResult={onScan} />}
    </div>
  );
}

/* ─────────── Owner dashboard ─────────── */
function DashboardTab({ apiPin }: { apiPin: <T,>(p: string, i?: RequestInit) => Promise<T> }) {
  const [d, setD] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { apiPin<Dash>('/cargotz/dashboard').then(setD).catch(() => {}).finally(() => setLoading(false)); }, [apiPin]);
  if (loading) return <div className="grid place-items-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  const c = d?.cards;
  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <KPI label="Received today" value={String(c?.receivedToday ?? 0)} Icon={PackagePlus} tone="text-emerald-600" />
        <KPI label="In warehouse" value={String(c?.inWarehouse ?? 0)} Icon={Warehouse} tone="text-indigo-600" />
        <KPI label="Dispatched" value={String(c?.dispatched ?? 0)} Icon={Truck} tone="text-amber-600" />
        <KPI label="Delivered" value={String(c?.delivered ?? 0)} Icon={CheckCircle2} tone="text-teal-600" />
        <KPI label="Cash collected" value={tsh(c?.cashCollected ?? 0)} Icon={Wallet} tone="text-emerald-600" />
        <KPI label="Outstanding" value={tsh(c?.outstanding ?? 0)} Icon={Clock} tone="text-rose-600" />
        <KPI label="Total parcels" value={String(c?.totalParcels ?? 0)} Icon={PackageCheck} tone="text-slate-700" />
      </div>
      <Card title="Parcels & revenue (14 days)">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={d?.trend ?? []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} width={36} />
            <Tooltip /><Line type="monotone" dataKey="parcels" stroke="#10b981" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
      <Card title="By status">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={d?.byStatus ?? []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="status" tick={{ fontSize: 9 }} tickFormatter={(s: string) => LABEL[s] ?? s} interval={0} angle={-30} textAnchor="end" height={60} /><YAxis tick={{ fontSize: 10 }} width={30} />
            <Tooltip /><Bar dataKey="count" radius={[4, 4, 0, 0]}>{(d?.byStatus ?? []).map((_, i) => <Cell key={i} fill={CHART[i % CHART.length]} />)}</Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

/* ── bits ── */
function Scanner({ onClose, onResult }: { onClose: () => void; onResult: (raw: string) => void }) {
  const { videoRef, result, error, start, stop } = useQRScanner();
  const fired = useRef(false);
  useEffect(() => { start(); return () => stop(); }, [start, stop]);
  useEffect(() => { if (result && !fired.current) { fired.current = true; onResult(result.rawValue); } }, [result, onResult]);
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 h-14 text-white"><span className="font-bold">Scan parcel QR</span><button onClick={onClose}><X className="w-6 h-6" /></button></div>
      <div className="relative flex-1"><video ref={videoRef} className="w-full h-full object-cover" muted playsInline /><div className="absolute inset-x-10 top-1/2 -translate-y-1/2 aspect-square border-2 border-emerald-400/80 rounded-2xl pointer-events-none" /></div>
      {error && <div className="p-3 text-xs text-rose-300 bg-black">{error} — type the tracking number instead.</div>}
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="bg-white rounded-2xl border border-slate-200 p-3 space-y-2"><div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">{title}</div>{children}</div>;
}
function In({ v, set, ph, type = 'text' }: { v: string | number; set: (v: string) => void; ph: string; type?: string }) {
  return <input value={v} onChange={(e) => set(e.target.value)} placeholder={ph} type={type} className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm" />;
}
function KPI({ label, value, Icon, tone }: { label: string; value: string; Icon: typeof Truck; tone: string }) {
  return <div className="bg-white rounded-xl border border-slate-200 p-3"><div className="flex items-center justify-between"><span className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</span><Icon className={`w-3.5 h-3.5 ${tone}`} /></div><div className={`text-lg font-extrabold mt-0.5 ${tone}`}>{value}</div></div>;
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="bg-white rounded-xl border border-slate-200 p-3"><div className="text-xs font-bold text-slate-500 mb-2">{title}</div>{children}</div>;
}
