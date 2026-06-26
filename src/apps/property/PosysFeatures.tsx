import { useMemo, useState } from 'react';
import {
  Building2, Layers, Search, AlertTriangle, TrendingUp, TrendingDown, Zap,
  CheckCircle2, Clock, XCircle, Wrench, Sparkles, Copy, Share2, RefreshCw,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react';

/**
 * POSys feature pass — implements the most distinctive parts of the
 * Property OS architecture (Building Map, Payment Cycle ring, Token
 * display, Simulation panel, Insights/Alert cards) using the existing
 * PropEasy UI patterns (light glass surface, blue accent, rounded
 * cards). These components are intentionally self-contained and pure
 * so they can be slotted into PropEasy.tsx without disturbing the
 * existing dashboard / tenant / detail views.
 */

/* ─── Type contracts ────────────────────────────────────────────── */

export type UnitStatus = 'paid' | 'pending' | 'overdue' | 'vacant' | 'maintenance' | 'partial';

export interface UnitCell {
  id: string;
  label: string;         // "A1", "B2", etc.
  tenantName?: string;
  unitKind?: string;     // "Shop", "Office", etc.
  status: UnitStatus;
}

export interface CorridorBlock {
  id: string;
  name: string;          // "Corridor A (Front Shops)"
  units: UnitCell[];
}

export interface FloorBlock {
  id: string;
  label: string;         // "Ground Floor", "1st Floor"
  corridors: CorridorBlock[];
}

export interface BuildingMapProps {
  propertyName: string;
  floors: FloorBlock[];
  selectedUnitId?: string;
  onPickUnit?: (unitId: string) => void;
}

/* ─── Status palette ────────────────────────────────────────────── */

const STATUS_STYLE: Record<UnitStatus, { dot: string; bg: string; ring: string; label: string }> = {
  paid:        { dot: 'bg-emerald-500', bg: 'bg-emerald-50',  ring: 'ring-emerald-300', label: 'Paid' },
  pending:     { dot: 'bg-slate-500',   bg: 'bg-slate-50',    ring: 'ring-slate-300',   label: 'Pending' },
  overdue:     { dot: 'bg-rose-500',    bg: 'bg-rose-50',     ring: 'ring-rose-300',    label: 'Overdue' },
  vacant:      { dot: 'bg-slate-400',   bg: 'bg-slate-100',   ring: 'ring-slate-300',   label: 'Vacant' },
  maintenance: { dot: 'bg-amber-500',   bg: 'bg-amber-50',    ring: 'ring-amber-300',   label: 'Maintenance' },
  partial:     { dot: 'bg-amber-400',   bg: 'bg-amber-50',    ring: 'ring-amber-300',   label: 'Partial' },
};

export function StatusBadge({ status, size = 'md' }: { status: UnitStatus; size?: 'sm' | 'md' }) {
  const s = STATUS_STYLE[status];
  const pad = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-bold ${pad} ${s.bg} text-slate-800`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

/* ─── 1. BUILDING MAP ───────────────────────────────────────────── */

export function BuildingMapView({ propertyName, floors, selectedUnitId, onPickUnit }: BuildingMapProps) {
  const [filter, setFilter] = useState<UnitStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  const totals = useMemo(() => {
    const all = floors.flatMap((f) => f.corridors.flatMap((c) => c.units));
    return {
      total: all.length,
      paid: all.filter((u) => u.status === 'paid').length,
      pending: all.filter((u) => u.status === 'pending').length,
      overdue: all.filter((u) => u.status === 'overdue').length,
      vacant: all.filter((u) => u.status === 'vacant').length,
      maintenance: all.filter((u) => u.status === 'maintenance').length,
      partial: all.filter((u) => u.status === 'partial').length,
    };
  }, [floors]);

  const occupancyRate = totals.total > 0 ? Math.round(((totals.total - totals.vacant) / totals.total) * 100) : 0;
  const collectionRate = totals.total - totals.vacant > 0
    ? Math.round((totals.paid / (totals.total - totals.vacant)) * 100)
    : 0;

  return (
    <div className="px-6 pb-6 space-y-4">
      {/* Header KPIs */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 inline-flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" /> {propertyName}
            </h2>
            <p className="text-xs text-slate-700 mt-0.5">Live unit status across every floor and corridor</p>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-700" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search unit or tenant…"
              className="h-8 w-56 pl-8 pr-3 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-500 outline-none focus:border-blue-400"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <Kpi label="Occupancy" value={`${occupancyRate}%`} tone="blue" />
          <Kpi label="Collection" value={`${collectionRate}%`} tone={collectionRate >= 85 ? 'emerald' : 'amber'} />
          <Kpi label="Paid" value={String(totals.paid)} tone="emerald" />
          <Kpi label="Overdue" value={String(totals.overdue)} tone="rose" />
          <Kpi label="Vacant" value={String(totals.vacant)} tone="slate" />
          <Kpi label="Maintenance" value={String(totals.maintenance)} tone="amber" />
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {(['all', 'paid', 'pending', 'overdue', 'vacant', 'maintenance', 'partial'] as const).map((k) => {
          const active = filter === k;
          const count = k === 'all' ? totals.total : totals[k];
          return (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`px-3 py-1 rounded-full text-[11px] font-bold tracking-wide transition-colors ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-800 hover:border-blue-400'
              }`}
            >
              {k === 'all' ? 'ALL' : k.toUpperCase()} · {count}
            </button>
          );
        })}
      </div>

      {/* Floor + corridor + unit grid */}
      {floors.map((floor) => (
        <div key={floor.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <h3 className="text-sm font-bold text-slate-900 mb-3 inline-flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-blue-600" /> {floor.label}
          </h3>
          <div className="space-y-3">
            {floor.corridors.map((corridor) => {
              const visibleUnits = corridor.units.filter((u) => {
                if (filter !== 'all' && u.status !== filter) return false;
                if (search) {
                  const q = search.toLowerCase();
                  return u.label.toLowerCase().includes(q) || (u.tenantName ?? '').toLowerCase().includes(q);
                }
                return true;
              });
              if (visibleUnits.length === 0) return null;
              return (
                <div key={corridor.id}>
                  <div className="text-[10px] uppercase font-bold tracking-widest text-slate-700 mb-2">
                    {corridor.name}
                  </div>
                  <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                    {visibleUnits.map((u) => {
                      const style = STATUS_STYLE[u.status];
                      const sel = u.id === selectedUnitId;
                      return (
                        <button
                          key={u.id}
                          onClick={() => onPickUnit?.(u.id)}
                          className={`aspect-square rounded-lg ${style.bg} ${sel ? `ring-2 ${style.ring}` : 'ring-1 ring-slate-200'} hover:ring-2 hover:${style.ring} transition-all p-2 text-left flex flex-col justify-between`}
                          title={u.tenantName ?? 'Vacant'}
                        >
                          <div className="flex items-start justify-between">
                            <span className="font-mono font-extrabold text-xs text-slate-900">{u.label}</span>
                            <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                          </div>
                          <div className="text-[9px] font-semibold text-slate-700 truncate">
                            {u.tenantName ? u.tenantName.split(' ')[0] : 'Vacant'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: 'blue'|'emerald'|'amber'|'rose'|'slate' }) {
  const toneCls = {
    blue:    'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber:   'bg-amber-50 text-amber-700',
    rose:    'bg-rose-50 text-rose-700',
    slate:   'bg-slate-100 text-slate-700',
  }[tone];
  return (
    <div className={`rounded-lg ${toneCls} px-3 py-2`}>
      <div className="text-[9px] uppercase tracking-widest font-bold opacity-80">{label}</div>
      <div className="text-base font-extrabold mt-0.5">{value}</div>
    </div>
  );
}

/* ─── 2. PAYMENT CYCLE RING (12 months) ─────────────────────────── */

export type CycleMonthStatus = 'paid' | 'pending' | 'partial' | 'future' | 'overdue';

export interface PaymentCycleProps {
  months: Array<{ month: string; year: number; status: CycleMonthStatus }>;
  currentIdx: number;
  monthlyRent: number;
  paidThisCycle: number;
}

export function PaymentCycleRing({ months, currentIdx, monthlyRent, paidThisCycle }: PaymentCycleProps) {
  const fmt = (n: number) => `TZS ${Math.round(n).toLocaleString()}`;
  const cls: Record<CycleMonthStatus, string> = {
    paid:    'bg-emerald-500 text-white',
    pending: 'bg-slate-400 text-white',
    partial: 'bg-amber-400 text-amber-900',
    overdue: 'bg-rose-500 text-white',
    future:  'bg-slate-100 text-slate-700 border border-dashed border-slate-300',
  };

  const expected = monthlyRent * 12;
  const completion = expected > 0 ? Math.min(100, Math.round((paidThisCycle / expected) * 100)) : 0;

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">12-month payment cycle</h3>
          <p className="text-xs text-slate-700 mt-0.5">Each circle is one rent period</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase font-bold text-slate-700 tracking-wide">This cycle</div>
          <div className="text-lg font-extrabold text-slate-900">{fmt(paidThisCycle)}</div>
          <div className="text-[10px] text-slate-700">of {fmt(expected)}</div>
        </div>
      </div>

      <div className="grid grid-cols-6 md:grid-cols-12 gap-2 mt-3">
        {months.map((m, i) => {
          const isCurrent = i === currentIdx;
          return (
            <div key={`${m.year}-${m.month}-${i}`} className="flex flex-col items-center gap-1">
              <div
                className={`w-9 h-9 rounded-full grid place-items-center text-[10px] font-extrabold ${cls[m.status]} ${isCurrent ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-white' : ''}`}
                title={`${m.month} ${m.year} · ${m.status}`}
              >
                {m.month.slice(0, 1)}
              </div>
              <div className="text-[9px] font-bold text-slate-700">{m.month.slice(0, 3)}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500" style={{ width: `${completion}%` }} />
        </div>
        <div className="text-[10px] text-slate-700 mt-1.5 flex items-center justify-between">
          <span>{completion}% collected this cycle</span>
          <span className="inline-flex items-center gap-3">
            <Legend dot="bg-emerald-500" label="Paid" />
            <Legend dot="bg-amber-400" label="Partial" />
            <Legend dot="bg-rose-500" label="Overdue" />
            <Legend dot="bg-slate-400" label="Pending" />
          </span>
        </div>
      </div>
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} /> {label}
    </span>
  );
}

/* ─── 3. PAYMENT TOKEN DISPLAY ──────────────────────────────────── */

export interface TokenDisplayProps {
  code: string;                  // 6-digit
  expiresInSec: number;
  amount: number;
  tenantName: string;
  unitLabel: string;
  onCopy?: () => void;
  onShare?: () => void;
  onCancel?: () => void;
}

export function TokenDisplay({ code, expiresInSec, amount, tenantName, unitLabel, onCopy, onShare, onCancel }: TokenDisplayProps) {
  const mins = Math.floor(expiresInSec / 60);
  const secs = expiresInSec % 60;
  const fmt = (n: number) => `TZS ${Math.round(n).toLocaleString()}`;
  const expired = expiresInSec <= 0;
  return (
    <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-6 text-white shadow-lg">
      <div className="text-[10px] uppercase font-bold tracking-[0.2em] opacity-80 mb-2">
        {expired ? 'Token expired' : 'Payment token'}
      </div>
      <div className="flex items-center gap-2 font-mono font-black text-4xl tracking-widest">
        {code.split('').map((d, i) => (
          <span key={i} className="bg-white/15 rounded-md px-3 py-1.5 min-w-[2.4rem] text-center">
            {d}
          </span>
        ))}
      </div>
      <div className={`mt-3 inline-flex items-center gap-1.5 text-sm font-bold ${expired ? 'text-rose-200' : 'text-amber-200'}`}>
        <Clock className="w-4 h-4" />
        {expired ? 'Expired — generate a new token' : `Expires in ${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="bg-white/10 rounded-lg p-2.5">
          <div className="text-[9px] uppercase tracking-wider opacity-70 font-bold">Amount</div>
          <div className="font-extrabold text-base mt-0.5">{fmt(amount)}</div>
        </div>
        <div className="bg-white/10 rounded-lg p-2.5">
          <div className="text-[9px] uppercase tracking-wider opacity-70 font-bold">Unit · Tenant</div>
          <div className="font-bold mt-0.5 truncate">{unitLabel} · {tenantName}</div>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={onCopy} disabled={expired} className="flex-1 h-9 rounded-lg bg-white text-blue-700 font-extrabold text-xs inline-flex items-center justify-center gap-1.5 disabled:opacity-40">
          <Copy className="w-3.5 h-3.5" /> Copy
        </button>
        <button onClick={onShare} disabled={expired} className="flex-1 h-9 rounded-lg bg-white/15 hover:bg-white/25 text-white font-extrabold text-xs inline-flex items-center justify-center gap-1.5 disabled:opacity-40">
          <Share2 className="w-3.5 h-3.5" /> Share
        </button>
        <button onClick={onCancel} className="h-9 px-3 rounded-lg bg-rose-500/30 hover:bg-rose-500/50 text-white font-extrabold text-xs inline-flex items-center justify-center gap-1">
          <XCircle className="w-3.5 h-3.5" /> Cancel
        </button>
      </div>
    </div>
  );
}

/* ─── 4. SIMULATION PANEL ───────────────────────────────────────── */

export interface SimulationPanelProps {
  unitCount: number;
  currentMonthlyRevenue: number;
}

export function SimulationPanel({ unitCount, currentMonthlyRevenue }: SimulationPanelProps) {
  const [pct, setPct] = useState(10);
  const [block, setBlock] = useState('all');

  const projected = currentMonthlyRevenue * (1 + pct / 100);
  const delta = projected - currentMonthlyRevenue;

  // Naive risk model — higher % increase = higher chance of churn.
  const churnProb = Math.min(1, Math.max(0, (pct - 5) / 30));
  const expectedChurn = Math.round(unitCount * churnProb);
  const retained = unitCount - expectedChurn;
  const expectedRetentionPct = unitCount > 0 ? Math.round((retained / unitCount) * 100) : 100;
  const expectedNet = projected * (retained / Math.max(1, unitCount));

  const fmt = (n: number) => `TZS ${Math.round(n).toLocaleString()}`;
  const riskBand = pct <= 8 ? 'Low' : pct <= 15 ? 'Moderate' : 'High';
  const riskCls = riskBand === 'Low' ? 'bg-emerald-50 text-emerald-700' :
                  riskBand === 'Moderate' ? 'bg-amber-50 text-amber-700' :
                  'bg-rose-50 text-rose-700';

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 inline-flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-violet-600" /> Rent simulation
          </h3>
          <p className="text-xs text-slate-700 mt-0.5">Model an increase and see projected revenue + churn risk</p>
        </div>
        <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${riskCls}`}>
          {riskBand} risk
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <label className="text-[10px] uppercase font-bold text-slate-700 tracking-wide">Increase by</label>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="range" min={0} max={30} value={pct}
              onChange={(e) => setPct(Number(e.target.value))}
              className="flex-1 accent-blue-600"
            />
            <span className="font-extrabold text-slate-900 text-sm tabular-nums w-12 text-right">{pct}%</span>
          </div>
        </div>
        <div>
          <label className="text-[10px] uppercase font-bold text-slate-700 tracking-wide">Apply to</label>
          <select
            value={block}
            onChange={(e) => setBlock(e.target.value)}
            className="h-9 mt-1 w-full rounded-lg bg-slate-100 border border-slate-200 text-xs px-2 text-slate-900 focus:border-blue-400 outline-none"
          >
            <option value="all">All blocks</option>
            <option value="a">Block A</option>
            <option value="b">Block B</option>
            <option value="c">Block C</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3">
        <SimStat label="Current revenue" value={fmt(currentMonthlyRevenue)} />
        <SimStat label="Projected revenue" value={fmt(projected)} delta={delta >= 0 ? `+${fmt(delta)}` : fmt(delta)} positive={delta >= 0} />
        <SimStat label="Expected retention" value={`${expectedRetentionPct}%`} sub={`${retained} of ${unitCount} units`} />
        <SimStat label="Net after churn" value={fmt(expectedNet)} sub={`${expectedChurn} units at risk`} />
      </div>

      <div className="mt-4 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-900">
        <span className="font-bold">Recommendation:</span>{' '}
        {pct <= 5 ? 'Safe to roll out across the portfolio.'
         : pct <= 12 ? 'Phase-in moderate-risk tenants over 60 days for best retention.'
         : 'High churn likelihood — consider targeting only high-margin or new tenants.'}
      </div>
    </div>
  );
}

function SimStat({ label, value, sub, delta, positive }: { label: string; value: string; sub?: string; delta?: string; positive?: boolean }) {
  return (
    <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
      <div className="text-[9px] uppercase font-bold text-slate-700 tracking-wide">{label}</div>
      <div className="text-base font-extrabold text-slate-900 mt-0.5">{value}</div>
      {delta && (
        <div className={`text-[10px] font-bold mt-0.5 inline-flex items-center gap-0.5 ${positive ? 'text-emerald-700' : 'text-rose-700'}`}>
          {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />} {delta}
        </div>
      )}
      {sub && <div className="text-[10px] text-slate-700 mt-0.5">{sub}</div>}
    </div>
  );
}

/* ─── 5. ALERT CARDS / INSIGHTS ─────────────────────────────────── */

export type Severity = 'high' | 'medium' | 'low' | 'info' | 'opportunity';

export interface Insight {
  id: string;
  severity: Severity;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

const SEVERITY_STYLE: Record<Severity, { bar: string; bg: string; icon: React.ReactNode; tagBg: string; tagText: string; label: string }> = {
  high:        { bar: 'bg-rose-500',    bg: 'bg-rose-50',    icon: <AlertTriangle className="w-4 h-4 text-rose-600" />,     tagBg: 'bg-rose-100',    tagText: 'text-rose-700',    label: 'HIGH' },
  medium:      { bar: 'bg-amber-500',   bg: 'bg-amber-50',   icon: <AlertTriangle className="w-4 h-4 text-amber-600" />,    tagBg: 'bg-amber-100',   tagText: 'text-amber-700',   label: 'MEDIUM' },
  low:         { bar: 'bg-slate-400',   bg: 'bg-slate-50',   icon: <Clock className="w-4 h-4 text-slate-600" />,           tagBg: 'bg-slate-200',   tagText: 'text-slate-700',   label: 'LOW' },
  info:        { bar: 'bg-blue-500',    bg: 'bg-blue-50',    icon: <CheckCircle2 className="w-4 h-4 text-blue-600" />,     tagBg: 'bg-blue-100',    tagText: 'text-blue-700',    label: 'INFO' },
  opportunity: { bar: 'bg-emerald-500', bg: 'bg-emerald-50', icon: <TrendingUp className="w-4 h-4 text-emerald-600" />,    tagBg: 'bg-emerald-100', tagText: 'text-emerald-700', label: 'OPPORTUNITY' },
};

export function AlertCard({ insight }: { insight: Insight }) {
  const s = SEVERITY_STYLE[insight.severity];
  return (
    <div className={`relative rounded-xl ${s.bg} border border-slate-200 pl-4 pr-3 py-3 flex items-start gap-3 overflow-hidden`}>
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${s.bar}`} />
      <div className="shrink-0 mt-0.5">{s.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded ${s.tagBg} ${s.tagText} tracking-widest`}>{s.label}</span>
          <h4 className="text-sm font-bold text-slate-900">{insight.title}</h4>
        </div>
        <p className="text-xs text-slate-700">{insight.description}</p>
      </div>
      {insight.actionLabel && (
        <button
          onClick={insight.onAction}
          className="shrink-0 h-7 px-3 rounded-lg bg-white border border-slate-300 hover:border-slate-900 text-xs font-bold text-slate-900"
        >
          {insight.actionLabel}
        </button>
      )}
    </div>
  );
}

/* ─── 6. INSIGHTS VIEW (combines all the above) ─────────────────── */

export interface InsightsViewProps {
  insights: Insight[];
  unitCount: number;
  currentMonthlyRevenue: number;
  portfolioHealthScore: number;     // 0-100
  collectionRate: number;            // 0-100
  occupancyRate: number;             // 0-100
  expenseRatio: number;              // 0-100
}

export function InsightsView({
  insights, unitCount, currentMonthlyRevenue,
  portfolioHealthScore, collectionRate, occupancyRate, expenseRatio,
}: InsightsViewProps) {
  return (
    <div className="px-6 pb-6 space-y-4">
      {/* Portfolio health card */}
      <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 inline-flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" /> Portfolio Pulse
            </h2>
            <p className="text-xs text-slate-700 mt-0.5">A single-number read on portfolio health</p>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold tracking-wide text-slate-700">Health score</div>
            <div className={`text-3xl font-extrabold ${portfolioHealthScore >= 80 ? 'text-emerald-600' : portfolioHealthScore >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>
              {portfolioHealthScore}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <PulseStat label="Collection" value={`${collectionRate}%`} target={85} actual={collectionRate} />
          <PulseStat label="Occupancy"  value={`${occupancyRate}%`}  target={90} actual={occupancyRate} />
          <PulseStat label="Expense ratio" value={`${expenseRatio}%`} target={30} actual={100 - expenseRatio} />
        </div>
      </div>

      {/* Alerts */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <h3 className="text-sm font-bold text-slate-900">Insights · {insights.length} active</h3>
          <button className="text-[11px] font-bold text-blue-700 hover:underline inline-flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
        <div className="space-y-2">
          {insights.map((i) => <AlertCard key={i.id} insight={i} />)}
        </div>
      </div>

      {/* Simulation */}
      <SimulationPanel unitCount={unitCount} currentMonthlyRevenue={currentMonthlyRevenue} />
    </div>
  );
}

function PulseStat({ label, value, target, actual }: { label: string; value: string; target: number; actual: number }) {
  const pct = Math.min(100, Math.max(0, actual));
  const ok = actual >= target;
  return (
    <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5">
      <div className="flex items-center justify-between">
        <div className="text-[9px] uppercase font-bold text-slate-700 tracking-wide">{label}</div>
        {ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <TrendingDown className="w-3.5 h-3.5 text-amber-600" />}
      </div>
      <div className="text-base font-extrabold text-slate-900 mt-1">{value}</div>
      <div className="h-1 mt-1.5 bg-slate-200 rounded overflow-hidden">
        <div className={`h-full ${ok ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-[9px] text-slate-700 mt-1">Target {target}%</div>
    </div>
  );
}

/* ─── Maintenance status pill (re-export-ready) ─────────────────── */

export function MaintenancePill({ status }: { status: 'Pending' | 'In Progress' | 'Completed' }) {
  const cls = status === 'Completed' ? 'bg-emerald-100 text-emerald-700'
            : status === 'In Progress' ? 'bg-blue-100 text-blue-700'
            : 'bg-amber-100 text-amber-700';
  const Icon = status === 'Completed' ? CheckCircle2 : status === 'In Progress' ? Wrench : Clock;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cls}`}>
      <Icon className="w-3 h-3" /> {status}
    </span>
  );
}
