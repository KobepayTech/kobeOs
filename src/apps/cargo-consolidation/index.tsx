import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import {
  Users, Route, Box as BoxIcon, Plus, Loader2, Copy, Check,
  Plane, Truck, PackageCheck, AlertTriangle,
} from 'lucide-react';

/**
 * BubbleBee-style cargo operator workflow:
 *   Customers — registry with 3-char displayId badges (G29, P12)
 *   Lanes     — pre-configured shipping lanes
 *   Boxes     — consolidation boxes (parcel → box → shipment)
 *
 * Each tab is a thin list + create panel; the heavy lifting (state
 * machine, displayId generation, shipment hand-off on dispatch)
 * lives in the backend CargoConsolidationService.
 */

interface CargoCustomer {
  id: string;
  displayId: string;
  name: string;
  phone: string;
  country: string;
  balance: number;
  currency: string;
  active: boolean;
}

interface CargoLane {
  id: string;
  code: string;
  name: string;
  origin: string;
  destination: string;
  defaultCarrier?: string | null;
  pricePerKg: number;
  currency: string;
  active: boolean;
  dispatchDays: string[];
}

interface ConsolidationBox {
  id: string;
  boxId: string;
  laneId: string;
  laneCode: string;
  status: 'OPEN' | 'SEALED' | 'DISPATCHED' | 'OVERSEAS_RECEIVED' | 'EMPTIED';
  parcelCount: number;
  totalWeight: number;
  sealedBy?: string | null;
  shipmentId?: string | null;
  notes?: string;
  createdAt?: string;
}

type Tab = 'customers' | 'lanes' | 'boxes';

export default function CargoConsolidation() {
  const [tab, setTab] = useState<Tab>('boxes');
  return (
    <div className="h-full flex flex-col bg-[#0e0e18] text-white">
      <header className="h-14 px-6 flex items-center justify-between border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <BoxIcon className="w-5 h-5 text-amber-400" />
          <span className="font-extrabold">Cargo Pack</span>
        </div>
        <div className="flex items-center gap-1">
          <TabBtn active={tab === 'boxes'}     onClick={() => setTab('boxes')}     icon={<BoxIcon className="w-4 h-4" />}>Boxes</TabBtn>
          <TabBtn active={tab === 'customers'} onClick={() => setTab('customers')} icon={<Users className="w-4 h-4" />}>Customers</TabBtn>
          <TabBtn active={tab === 'lanes'}     onClick={() => setTab('lanes')}     icon={<Route className="w-4 h-4" />}>Lanes</TabBtn>
        </div>
      </header>
      <div className="flex-1 overflow-hidden">
        {tab === 'boxes'     && <BoxesTab />}
        {tab === 'customers' && <CustomersTab />}
        {tab === 'lanes'     && <LanesTab />}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 h-9 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 ${
        active ? 'bg-amber-500/20 text-amber-200' : 'text-white/60 hover:bg-white/[0.05]'
      }`}
    >
      {icon}{children}
    </button>
  );
}

// ── Customers ───────────────────────────────────────────────────────────────

function CustomersTab() {
  const [list, setList] = useState<CargoCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', country: '' });
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const rows = await api<CargoCustomer[]>('/cargo/customers');
      if (Array.isArray(rows)) setList(rows);
    } catch (e) { setErr((e as Error).message); }
  }, []);

  useEffect(() => { void reload().then(() => setLoading(false)); }, [reload]);

  const submit = async () => {
    if (!form.name.trim() || !form.phone.trim()) return;
    setSubmitting(true);
    setErr(null);
    try {
      await api('/cargo/customers', { method: 'POST', body: JSON.stringify(form) });
      setForm({ name: '', phone: '', country: '' });
      await reload();
    } catch (e) { setErr((e as Error).message); }
    setSubmitting(false);
  };

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    }).catch(() => { /* clipboard blocked — silently skip */ });
  };

  return (
    <div className="h-full p-5 overflow-y-auto">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <h2 className="text-sm font-bold text-white/60 uppercase mb-2 tracking-wide">Customer registry</h2>
          {loading ? (
            <div className="text-white/40 text-xs"><Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Loading…</div>
          ) : list.length === 0 ? (
            <div className="text-white/40 text-xs italic">No customers yet — register one on the right.</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-white/40 text-left border-b border-white/[0.06]">
                  <th className="py-2 pr-3">ID</th>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Phone</th>
                  <th className="py-2 pr-3">Country</th>
                  <th className="py-2 pr-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="py-2 pr-3">
                      <button
                        onClick={() => copyId(c.displayId)}
                        className="px-2 h-6 rounded bg-emerald-500/20 text-emerald-200 font-mono font-bold inline-flex items-center gap-1.5"
                        title="Copy display ID"
                      >
                        {c.displayId}
                        {copied === c.displayId ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3 opacity-50" />}
                      </button>
                    </td>
                    <td className="py-2 pr-3 font-bold">{c.name}</td>
                    <td className="py-2 pr-3 text-white/60">{c.phone}</td>
                    <td className="py-2 pr-3 text-white/60">{c.country || '—'}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{c.currency} {Math.round(Number(c.balance)).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div>
          <h2 className="text-sm font-bold text-white/60 uppercase mb-2 tracking-wide">Register customer</h2>
          <div className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Name"
              className="w-full h-9 px-2 rounded-lg bg-[#06060f] border border-white/[0.08] text-xs"
            />
            <input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="+255 712 345 678"
              className="w-full h-9 px-2 rounded-lg bg-[#06060f] border border-white/[0.08] text-xs"
            />
            <input
              value={form.country}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
              placeholder="Country (optional)"
              className="w-full h-9 px-2 rounded-lg bg-[#06060f] border border-white/[0.08] text-xs"
            />
            {err && <div className="text-rose-300 text-[10px]">{err}</div>}
            <button
              onClick={submit}
              disabled={submitting || !form.name.trim() || !form.phone.trim()}
              className="w-full h-10 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-white/[0.06] disabled:text-white/30 text-amber-950 font-extrabold text-xs"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : <><Plus className="w-3.5 h-3.5 inline mr-1" /> Register & assign ID</>}
            </button>
            <p className="text-[10px] text-white/40 leading-relaxed">
              A 3-character display ID (A00–Z99) is assigned automatically. Write it on the customer's parcel with a marker so the warehouse can find the owner at a glance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Lanes ──────────────────────────────────────────────────────────────────

function LanesTab() {
  const [list, setList] = useState<CargoLane[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ code: '', name: '', origin: '', destination: '', defaultCarrier: '', pricePerKg: 0 });
  const [submitting, setSubmitting] = useState(false);

  const reload = useCallback(async () => {
    try {
      const rows = await api<CargoLane[]>('/cargo/lanes');
      if (Array.isArray(rows)) setList(rows);
    } catch (e) { setErr((e as Error).message); }
  }, []);

  useEffect(() => { void reload().then(() => setLoading(false)); }, [reload]);

  const submit = async () => {
    if (!form.code.trim() || !form.name.trim()) return;
    setSubmitting(true);
    setErr(null);
    try {
      await api('/cargo/lanes', { method: 'POST', body: JSON.stringify(form) });
      setForm({ code: '', name: '', origin: '', destination: '', defaultCarrier: '', pricePerKg: 0 });
      await reload();
    } catch (e) { setErr((e as Error).message); }
    setSubmitting(false);
  };

  return (
    <div className="h-full p-5 overflow-y-auto">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <h2 className="text-sm font-bold text-white/60 uppercase mb-2 tracking-wide">Shipping lanes</h2>
          {loading ? (
            <div className="text-white/40 text-xs"><Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Loading…</div>
          ) : list.length === 0 ? (
            <div className="text-white/40 text-xs italic">No lanes yet. A lane is the route + carrier combo your boxes get dispatched on.</div>
          ) : (
            <div className="space-y-2">
              {list.map((l) => (
                <div key={l.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono font-bold text-amber-300">{l.code}</span>
                    <span className="text-[10px] text-white/40">{l.currency} {Math.round(l.pricePerKg).toLocaleString()} / kg</span>
                  </div>
                  <div className="text-xs font-bold mt-1">{l.name}</div>
                  <div className="text-[10px] text-white/50 mt-0.5 inline-flex items-center gap-1">
                    <Plane className="w-3 h-3" /> {l.origin || '?'} → {l.destination || '?'} · {l.defaultCarrier || 'carrier TBD'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <h2 className="text-sm font-bold text-white/60 uppercase mb-2 tracking-wide">Add lane</h2>
          <div className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <input
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              placeholder="Code (e.g. TZASLK-G)"
              className="w-full h-9 px-2 rounded-lg bg-[#06060f] border border-white/[0.08] text-xs font-mono"
            />
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Lane name (Guangzhou → Dar)"
              className="w-full h-9 px-2 rounded-lg bg-[#06060f] border border-white/[0.08] text-xs"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={form.origin}
                onChange={(e) => setForm((f) => ({ ...f, origin: e.target.value }))}
                placeholder="Origin"
                className="h-9 px-2 rounded-lg bg-[#06060f] border border-white/[0.08] text-xs"
              />
              <input
                value={form.destination}
                onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
                placeholder="Destination"
                className="h-9 px-2 rounded-lg bg-[#06060f] border border-white/[0.08] text-xs"
              />
            </div>
            <input
              value={form.defaultCarrier}
              onChange={(e) => setForm((f) => ({ ...f, defaultCarrier: e.target.value }))}
              placeholder="Default carrier (Ethiopian, Qatar…)"
              className="w-full h-9 px-2 rounded-lg bg-[#06060f] border border-white/[0.08] text-xs"
            />
            <input
              type="number"
              min={0}
              value={form.pricePerKg || ''}
              onChange={(e) => setForm((f) => ({ ...f, pricePerKg: Number(e.target.value) || 0 }))}
              placeholder="Price per kg (TZS)"
              className="w-full h-9 px-2 rounded-lg bg-[#06060f] border border-white/[0.08] text-xs"
            />
            {err && <div className="text-rose-300 text-[10px]">{err}</div>}
            <button
              onClick={submit}
              disabled={submitting || !form.code.trim() || !form.name.trim()}
              className="w-full h-10 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-white/[0.06] disabled:text-white/30 text-amber-950 font-extrabold text-xs"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : <><Plus className="w-3.5 h-3.5 inline mr-1" /> Add lane</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Boxes ──────────────────────────────────────────────────────────────────

function BoxesTab() {
  const [boxes, setBoxes] = useState<ConsolidationBox[]>([]);
  const [lanes, setLanes] = useState<CargoLane[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | ConsolidationBox['status']>('ALL');
  const [creating, setCreating] = useState(false);
  const [newLaneId, setNewLaneId] = useState('');
  const [acting, setActing] = useState<Record<string, boolean>>({});

  const reload = useCallback(async () => {
    try {
      const [b, l] = await Promise.all([
        api<ConsolidationBox[]>('/cargo/boxes'),
        api<CargoLane[]>('/cargo/lanes'),
      ]);
      if (Array.isArray(b)) setBoxes(b);
      if (Array.isArray(l)) setLanes(l);
    } catch (e) { setErr((e as Error).message); }
  }, []);
  useEffect(() => { void reload().then(() => setLoading(false)); }, [reload]);

  const createBox = async () => {
    if (!newLaneId) return;
    setCreating(true);
    try {
      await api('/cargo/boxes', { method: 'POST', body: JSON.stringify({ laneId: newLaneId }) });
      setNewLaneId('');
      await reload();
    } catch (e) { setErr((e as Error).message); }
    setCreating(false);
  };

  const transition = async (box: ConsolidationBox, action: 'seal' | 'dispatch' | 'receive') => {
    setActing((p) => ({ ...p, [box.id]: true }));
    setErr(null);
    try {
      await api(`/cargo/boxes/${box.id}/${action}`, { method: 'POST', body: '{}' });
      await reload();
    } catch (e) { setErr((e as Error).message); }
    setActing((p) => ({ ...p, [box.id]: false }));
  };

  const filtered = useMemo(() => (
    filter === 'ALL' ? boxes : boxes.filter((b) => b.status === filter)
  ), [boxes, filter]);

  return (
    <div className="h-full p-5 overflow-y-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1 text-xs">
          {(['ALL', 'OPEN', 'SEALED', 'DISPATCHED', 'OVERSEAS_RECEIVED'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 h-7 rounded font-bold ${filter === s ? 'bg-amber-500/20 text-amber-200' : 'text-white/60 hover:bg-white/[0.04]'}`}
            >
              {s.replace(/_/g, ' ')} {s !== 'ALL' && (
                <span className="opacity-60">({boxes.filter((b) => b.status === s).length})</span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={newLaneId}
            onChange={(e) => setNewLaneId(e.target.value)}
            className="h-8 px-2 rounded bg-[#06060f] border border-white/[0.08] text-xs text-white"
          >
            <option value="">— pick a lane —</option>
            {lanes.map((l) => <option key={l.id} value={l.id}>{l.code}</option>)}
          </select>
          <button
            onClick={createBox}
            disabled={!newLaneId || creating}
            className="h-8 px-3 rounded bg-amber-500 hover:bg-amber-400 disabled:bg-white/[0.06] disabled:text-white/30 text-amber-950 font-extrabold text-xs"
          >
            {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Plus className="w-3 h-3 inline mr-1" /> Open box</>}
          </button>
        </div>
      </div>

      {err && (
        <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded p-2 inline-flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {err}
        </div>
      )}

      {loading ? (
        <div className="text-white/40 text-xs"><Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-white/40 text-xs italic">
          No boxes {filter !== 'ALL' && `in ${filter.replace(/_/g, ' ').toLowerCase()}`} yet.
          {lanes.length === 0 && ' Add a lane on the Lanes tab first.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((b) => (
            <div key={b.id} className={`rounded-xl border p-3 space-y-2 ${
              b.status === 'OPEN'              ? 'border-amber-500/30 bg-amber-500/[0.04]'   :
              b.status === 'SEALED'            ? 'border-blue-500/30 bg-blue-500/[0.04]'     :
              b.status === 'DISPATCHED'        ? 'border-violet-500/30 bg-violet-500/[0.04]' :
              b.status === 'OVERSEAS_RECEIVED' ? 'border-emerald-500/30 bg-emerald-500/[0.04]' :
                                                 'border-white/[0.06] bg-white/[0.02]'
            }`}>
              <div className="flex items-baseline justify-between">
                <span className="font-mono font-bold text-xs">{b.boxId}</span>
                <span className="text-[9px] uppercase font-bold opacity-80">{b.status.replace(/_/g, ' ')}</span>
              </div>
              <div className="text-[10px] text-white/60 inline-flex items-center gap-1">
                <Route className="w-3 h-3" /> {b.laneCode}
              </div>
              <div className="flex items-baseline justify-between text-xs">
                <span>{b.parcelCount} parcel{b.parcelCount === 1 ? '' : 's'}</span>
                <span className="tabular-nums font-bold">{Number(b.totalWeight).toFixed(2)} kg</span>
              </div>
              {b.sealedBy && (
                <div className="text-[10px] text-white/40">sealed by {b.sealedBy}</div>
              )}
              <div className="flex gap-1">
                {b.status === 'OPEN' && (
                  <button
                    onClick={() => transition(b, 'seal')}
                    disabled={acting[b.id] || b.parcelCount === 0}
                    className="flex-1 h-8 rounded bg-blue-500 hover:bg-blue-400 disabled:bg-white/[0.06] disabled:text-white/30 text-white text-[10px] font-extrabold inline-flex items-center justify-center gap-1"
                  >
                    {acting[b.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <PackageCheck className="w-3 h-3" />}
                    Seal
                  </button>
                )}
                {b.status === 'SEALED' && (
                  <button
                    onClick={() => transition(b, 'dispatch')}
                    disabled={acting[b.id]}
                    className="flex-1 h-8 rounded bg-violet-500 hover:bg-violet-400 disabled:bg-white/[0.06] text-white text-[10px] font-extrabold inline-flex items-center justify-center gap-1"
                  >
                    {acting[b.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Truck className="w-3 h-3" />}
                    Dispatch
                  </button>
                )}
                {b.status === 'DISPATCHED' && (
                  <button
                    onClick={() => transition(b, 'receive')}
                    disabled={acting[b.id]}
                    className="flex-1 h-8 rounded bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/[0.06] text-white text-[10px] font-extrabold inline-flex items-center justify-center gap-1"
                  >
                    {acting[b.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    Mark received
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
