import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import {
  Box, Plus, Loader2, Truck, PackageCheck, Check, AlertTriangle, Route, ChevronRight,
} from 'lucide-react';

/**
 * Phone-side warehouse Pack screen — mirrors the desktop "Cargo Pack"
 * Boxes tab but for staff who only have a phone. Lists active
 * consolidation boxes (OPEN / SEALED / DISPATCHED) and gives one
 * big action button per box. Open the detail sheet to assign
 * parcels into the box.
 */

interface ConsolidationBox {
  id: string;
  boxId: string;
  laneId: string;
  laneCode: string;
  status: 'OPEN' | 'SEALED' | 'DISPATCHED' | 'OVERSEAS_RECEIVED' | 'EMPTIED';
  parcelCount: number;
  totalWeight: number;
  sealedBy?: string | null;
  createdAt?: string;
}

interface Lane { id: string; code: string; name: string }

interface Parcel {
  id: string;
  parcelId: string;
  ownerName: string;
  ownerPhone: string;
  destination: string;
  weight: number;
  lifecycleStatus: string;
  boxId?: string | null;
  externalTracking?: string | null;
}

export default function MobileCargoPack() {
  const [tab, setTab] = useState<'OPEN' | 'SEALED' | 'DISPATCHED'>('OPEN');
  const [boxes, setBoxes] = useState<ConsolidationBox[]>([]);
  const [lanes, setLanes] = useState<Lane[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState<string | null>(null);
  const [creatingForLane, setCreatingForLane] = useState<string | null>(null);
  const [openBox, setOpenBox] = useState<ConsolidationBox | null>(null);

  const reload = useCallback(async () => {
    try {
      const [b, l] = await Promise.all([
        api<ConsolidationBox[]>('/cargo/boxes'),
        api<Lane[]>('/cargo/lanes'),
      ]);
      if (Array.isArray(b)) setBoxes(b);
      if (Array.isArray(l)) setLanes(l);
    } catch (e) { setErr((e as Error).message); }
  }, []);
  useEffect(() => { void reload().then(() => setLoading(false)); }, [reload]);

  const transition = async (box: ConsolidationBox, action: 'seal' | 'dispatch' | 'receive') => {
    setActing((p) => ({ ...p, [box.id]: true }));
    setErr(null);
    try {
      await api(`/cargo/boxes/${box.id}/${action}`, { method: 'POST', body: '{}' });
      await reload();
    } catch (e) { setErr((e as Error).message); }
    setActing((p) => ({ ...p, [box.id]: false }));
  };

  const createBox = async (laneId: string) => {
    setCreatingForLane(laneId);
    try {
      await api('/cargo/boxes', { method: 'POST', body: JSON.stringify({ laneId }) });
      await reload();
    } catch (e) { setErr((e as Error).message); }
    setCreatingForLane(null);
  };

  const filtered = useMemo(() => boxes.filter((b) => b.status === tab), [boxes, tab]);

  return (
    <div className="p-4 pb-24 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 grid place-items-center">
          <Box className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 leading-tight">Warehouse pack</h2>
          <p className="text-[11px] text-slate-500">Pick parcels into boxes, seal, dispatch.</p>
        </div>
      </div>

      <div className="flex bg-slate-100 rounded-xl p-1 text-xs font-bold">
        {(['OPEN', 'SEALED', 'DISPATCHED'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`flex-1 h-9 rounded-lg ${tab === s ? 'bg-white text-slate-900 shadow' : 'text-slate-500'}`}
          >
            {s.charAt(0) + s.slice(1).toLowerCase()} ({boxes.filter((b) => b.status === s).length})
          </button>
        ))}
      </div>

      {err && (
        <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-2 inline-flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {err}
        </div>
      )}

      {tab === 'OPEN' && lanes.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <div className="text-[10px] text-slate-500 uppercase font-bold mb-2">Open a new box</div>
          <div className="flex gap-2 flex-wrap">
            {lanes.map((l) => (
              <button
                key={l.id}
                onClick={() => createBox(l.id)}
                disabled={creatingForLane === l.id}
                className="h-9 px-3 rounded-lg bg-amber-100 active:bg-amber-200 text-amber-900 text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                {creatingForLane === l.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                {l.code}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-xs italic">
          No {tab.toLowerCase()} boxes.
        </div>
      ) : (
        filtered.map((b) => (
          <div
            key={b.id}
            className={`rounded-xl border p-3 ${
              b.status === 'OPEN'       ? 'border-amber-300 bg-amber-50' :
              b.status === 'SEALED'     ? 'border-blue-300 bg-blue-50'   :
              b.status === 'DISPATCHED' ? 'border-violet-300 bg-violet-50' :
                                          'border-slate-200 bg-white'
            }`}
          >
            <div className="flex items-baseline justify-between mb-1">
              <span className="font-mono font-bold text-xs text-slate-900">{b.boxId}</span>
              <span className="text-[10px] text-slate-500 inline-flex items-center gap-1">
                <Route className="w-3 h-3" /> {b.laneCode}
              </span>
            </div>
            <div className="flex items-baseline justify-between text-sm mb-2">
              <span className="text-slate-700">{b.parcelCount} parcel{b.parcelCount === 1 ? '' : 's'}</span>
              <span className="font-extrabold tabular-nums">{Number(b.totalWeight).toFixed(2)} kg</span>
            </div>
            {b.sealedBy && <div className="text-[10px] text-slate-500 mb-2">sealed by {b.sealedBy}</div>}
            <div className="flex gap-2">
              {b.status === 'OPEN' && (
                <>
                  <button
                    onClick={() => setOpenBox(b)}
                    className="flex-1 h-10 rounded-lg bg-white border border-amber-300 text-amber-700 text-xs font-bold inline-flex items-center justify-center gap-1"
                  >
                    Pick parcels <ChevronRight className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => transition(b, 'seal')}
                    disabled={acting[b.id] || b.parcelCount === 0}
                    className="h-10 px-3 rounded-lg bg-blue-500 active:bg-blue-600 disabled:opacity-40 text-white text-xs font-extrabold inline-flex items-center gap-1"
                  >
                    {acting[b.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <PackageCheck className="w-3 h-3" />} Seal
                  </button>
                </>
              )}
              {b.status === 'SEALED' && (
                <button
                  onClick={() => transition(b, 'dispatch')}
                  disabled={acting[b.id]}
                  className="flex-1 h-10 rounded-lg bg-violet-500 active:bg-violet-600 disabled:opacity-40 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1"
                >
                  {acting[b.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Truck className="w-3 h-3" />} Dispatch
                </button>
              )}
              {b.status === 'DISPATCHED' && (
                <button
                  onClick={() => transition(b, 'receive')}
                  disabled={acting[b.id]}
                  className="flex-1 h-10 rounded-lg bg-emerald-500 active:bg-emerald-600 disabled:opacity-40 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1"
                >
                  {acting[b.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Mark received
                </button>
              )}
            </div>
          </div>
        ))
      )}

      {openBox && (
        <PickParcelsSheet
          box={openBox}
          onClose={() => { setOpenBox(null); void reload(); }}
        />
      )}
    </div>
  );
}

/** Bottom-sheet that lists STORED parcels and lets the operator
 *  tick which ones to drop into this box. */
function PickParcelsSheet({ box, onClose }: { box: ConsolidationBox; onClose: () => void }) {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<Parcel[]>('/cargo/parcels')
      .then((rows) => {
        if (Array.isArray(rows)) {
          // Backend doesn't filter — show STORED parcels with no box.
          setParcels(rows.filter((p) => p.lifecycleStatus === 'STORED' && !p.boxId));
        }
      })
      .catch((e) => setErr((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const assign = async () => {
    if (picked.size === 0) return;
    setSaving(true);
    try {
      await api(`/cargo/boxes/${box.id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ parcelIds: Array.from(picked) }),
      });
      onClose();
    } catch (e) { setErr((e as Error).message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-40 bg-slate-900/60 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-white rounded-t-3xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3 border-b border-slate-100">
          <div className="text-[10px] text-slate-500 uppercase font-bold">Pick parcels into</div>
          <div className="text-base font-extrabold text-slate-900 font-mono">{box.boxId}</div>
          <div className="text-[11px] text-slate-500">{picked.size} selected</div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {loading ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" /> Loading…
            </div>
          ) : parcels.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs italic">
              No parcels in STORED state. Register and receive pre-alerts first.
            </div>
          ) : (
            parcels.map((p) => {
              const isPicked = picked.has(p.id);
              return (
                <label
                  key={p.id}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer ${
                    isPicked ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isPicked}
                    onChange={(e) => {
                      setPicked((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(p.id); else next.delete(p.id);
                        return next;
                      });
                    }}
                    className="accent-amber-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">{p.parcelId} · {p.ownerName}</div>
                    <div className="text-[10px] text-slate-500 truncate">
                      → {p.destination}{p.externalTracking ? ` · ${p.externalTracking}` : ''}
                    </div>
                  </div>
                  <div className="text-[11px] tabular-nums font-bold text-slate-700">
                    {Number(p.weight).toFixed(2)} kg
                  </div>
                </label>
              );
            })
          )}
        </div>
        {err && (
          <div className="px-3 pb-2 text-[11px] text-rose-700">{err}</div>
        )}
        <div className="p-3 border-t border-slate-100 flex gap-2">
          <button onClick={onClose} className="flex-1 h-11 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">
            Done
          </button>
          <button
            onClick={assign}
            disabled={saving || picked.size === 0}
            className="flex-1 h-11 rounded-lg bg-amber-500 active:bg-amber-600 disabled:opacity-40 text-amber-950 text-xs font-extrabold inline-flex items-center justify-center gap-1.5"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Assign {picked.size}
          </button>
        </div>
      </div>
    </div>
  );
}
