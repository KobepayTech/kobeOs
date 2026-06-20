import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { ShipmentCreation } from './ShipmentCreation';
import FlightBoard from './FlightBoard';
import CargoPaymentWorkflow from './CargoPaymentWorkflow';
import {
  LayoutDashboard, BarChart3, Package, ShieldCheck, Warehouse, Plane,
  Wallet, MapPin, Truck, Search, CheckCircle2, ArrowRight, Box,
  AlertTriangle, Bell, TrendingUp, Minus, X, Clock, AlertCircle,
  Container, Weight, Ruler, Settings, Plus, Loader2, Receipt,
  Printer, DollarSign, Phone, Calendar, XCircle, CircleDot, Circle,
  Fuel, Navigation, Eye, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { QRCodeSVG } from 'qrcode.react';
import {
  BarChart, Bar, PieChart, Pie, Cell, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ComposedChart,
} from 'recharts';

/* ═══════════════════════════════════════════
   KOBECARGO — Enterprise Cargo Management
   Aladin OS Glassmorphism Light Theme
   ═══════════════════════════════════════════ */

/* ─── TYPES ─── */
type SS = 'DRAFT'|'ORIGIN'|'EXPORT_CUSTOMS'|'IN_TRANSIT'|'ARRIVED'|'IMPORT_CUSTOMS'|'DESTINATION'|'OUT_FOR_DELIVERY'|'DELIVERED'|'CANCELLED';
type SP = 'STANDARD'|'EXPRESS'|'URGENT';
type CL = 'GREEN'|'YELLOW'|'RED';
type PS = 'RECEIVED'|'WEIGHED'|'IN_BIN'|'IN_ULD'|'ON_FLIGHT'|'ARRIVED'|'AT_DESTINATION'|'OUT_FOR_DELIVERY'|'DELIVERED';
type PM = 'Bank Transfer'|'Mobile Money'|'Cash'|'Card';
type Tab = 'dashboard' | 'shipments' | 'customs' | 'warehouse' | 'flights' | 'delivery' | 'payments' | 'tracking' | 'analytics' | 'settings';

interface Shipment { id:string; number:string; status:SS; priority:SP; cargoType:string; masterAWB:string; houseAWB:string; declaredValue:number; currency:string; actualWeight:number; origin:string; destination:string; portCode:string; customer:string; supplier:string; createdAt:string; etd:string; eta:string; packages:number; value:number; cost:number; }
interface CClear { jurisdiction:'CHINA_EXPORT'|'TANZANIA_IMPORT'; portCode:string; status:string; riskScore:number; dutiesEstimated:number; dutiesPaid:number; lane:CL; inspection:boolean; taxDispute:boolean; }
interface Pkg { id:string; qrCode:string; description:string; weight:number; status:PS; shipmentId:string; binNumber?:string; uldNumber?:string; dims:string; }
interface Bin { id:string; number:string; warehouse:string; status:string; weight:number; packages:number; }
interface ULD { id:string; number:string; uldType:string; flight:string; status:string; weight:number; capacity:number; }
interface Flight { id:string; number:string; airline:string; origin:string; destination:string; transit?:string; etd:string; eta:string; status:string; ulds:number; weight:number; capacity:number; costPerKg:number; }
interface TEvent { id:string; shipmentId:string; type:string; location:string; timestamp:string; }
interface Wallet { id:string; customer:string; balanceTZS:number; balanceUSD:number; held:number; creditLimit:number; }
interface Transaction { id:string; walletId:string; amount:number; type:'CREDIT'|'DEBIT'; method:PM; description:string; date:string; status:string; }
interface Delivery { id:string; shipmentId:string; driver:string; phone:string; vehicle:string; status:string; address:string; started:string; delivered?:string; recipient?:string; }
interface Driver { id:string; name:string; phone:string; vehicle:string; licensePlate:string; status:string; rating:number; }
interface AlertItem { id:string; type:string; severity:'critical'|'warning'|'info'|'success'; title:string; message:string; entityId:string; entityType:string; timestamp:string; }

/* ─── SIDEBAR STRUCTURE ─── */
const cargoSections = [
  {
    title: 'Overview',
    tiles: [
      { key: 'dashboard' as Tab, label: 'Dashboard', icon: LayoutDashboard, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
      { key: 'analytics' as Tab, label: 'Analytics', icon: BarChart3, color: 'text-indigo-500', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
    ],
  },
  {
    title: 'Operations',
    tiles: [
      { key: 'shipments' as Tab, label: 'Shipments', icon: Package, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
      { key: 'customs' as Tab, label: 'Customs', icon: ShieldCheck, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
      { key: 'warehouse' as Tab, label: 'Warehouse', icon: Warehouse, color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
      { key: 'flights' as Tab, label: 'Flights', icon: Plane, color: 'text-sky-500', bg: 'bg-sky-500/10', border: 'border-sky-500/20' },
      { key: 'delivery' as Tab, label: 'Delivery', icon: Truck, color: 'text-violet-500', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
    ],
  },
  {
    title: 'Finance',
    tiles: [
      { key: 'payments' as Tab, label: 'Payments', icon: Wallet, color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
      { key: 'tracking' as Tab, label: 'Tracking', icon: MapPin, color: 'text-teal-500', bg: 'bg-teal-500/10', border: 'border-teal-500/20' },
    ],
  },
  {
    title: 'System',
    tiles: [
      { key: 'settings' as Tab, label: 'Settings', icon: Settings, color: 'text-slate-500', bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
    ],
  },
];

/* ─── GLASSMORPHISM STYLES (constants) ─── */
const G = {
  page: 'h-full flex bg-gradient-to-br from-slate-100 via-purple-50 to-indigo-100',
  card: 'bg-white/[0.30] backdrop-blur-xl border border-white/[0.40] rounded-2xl shadow-lg',
  cardHeader: 'text-xs font-semibold text-slate-700',
  text: 'text-slate-600',
  muted: 'text-slate-400',
  sidebar: 'w-60 h-full flex flex-col bg-white/[0.25] backdrop-blur-2xl border-r border-white/[0.40]',
  input: 'bg-white/40 border-white/[0.40] text-slate-700 placeholder:text-slate-400 rounded-xl',
  kpiGrid: 'grid grid-cols-2 lg:grid-cols-4 gap-3',
  chartGrid: 'grid grid-cols-1 lg:grid-cols-2 gap-3',
  btnPrimary: 'bg-blue-500 hover:bg-blue-600 text-white rounded-xl',
  btnOutline: 'border-white/[0.40] text-slate-600 hover:bg-white/40 rounded-xl',
  badge: (color: string) => `inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${color}`,
  sectionPad: 'p-4 space-y-4',
  scrollArea: 'h-full overflow-y-auto',
  emptyState: 'text-center py-8 text-slate-400 text-sm',
  errorState: 'text-center py-8 text-red-500 text-sm',
};

/* ─── HELPERS ─── */
const tzs = (n: number) => `TZS ${(n ?? 0).toLocaleString()}`;
const usd = (n: number) => `$${(n ?? 0).toLocaleString()}`;

const statusColorMap: Record<string, string> = {
  DRAFT: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
  ORIGIN: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  EXPORT_CUSTOMS: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  IN_TRANSIT: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
  ARRIVED: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  IMPORT_CUSTOMS: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  DESTINATION: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  OUT_FOR_DELIVERY: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
  DELIVERED: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  CANCELLED: 'bg-red-500/10 text-red-600 border-red-500/20',
  STANDARD: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  EXPRESS: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  URGENT: 'bg-red-500/10 text-red-600 border-red-500/20',
  GREEN: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  YELLOW: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  RED: 'bg-red-500/10 text-red-600 border-red-500/20',
  Paid: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  Pending: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  Overdue: 'bg-red-500/10 text-red-600 border-red-500/20',
  ASSIGNED: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  OUT_FOR_DELIVERY_D: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
  DELIVERED_D: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  FAILED: 'bg-red-500/10 text-red-600 border-red-500/20',
  SCHEDULED: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  IN_FLIGHT: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
  DELAYED: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  CANCELLED_F: 'bg-red-500/10 text-red-600 border-red-500/20',
  WAITING: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  LOADING: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  LOADED: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  RECEIVED: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  WEIGHED: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  IN_BIN: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
  IN_ULD: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  ON_FLIGHT: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
  AT_DESTINATION: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
};

const SB = ({ s }: { s: string }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border border-white/[0.30] ${statusColorMap[s] || 'bg-gray-500/10 text-gray-600'}`}>
    {s.replace(/_/g, ' ')}
  </span>
);

const KPI = ({ t, v, i: I, c = 'blue' }: { t: string; v: string; i: React.ComponentType<{ className?: string }>; c?: string }) => {
  const cm: Record<string, string> = { blue: 'text-blue-500', emerald: 'text-emerald-500', amber: 'text-amber-500', red: 'text-rose-500', indigo: 'text-indigo-500', violet: 'text-violet-500', rose: 'text-rose-500', teal: 'text-teal-500' };
  return (
    <Card className={G.card}><CardContent className="p-3">
      <div className="flex items-start justify-between mb-2">
        <span className="text-[10px] text-slate-400 font-medium">{t}</span>
        <I className={`w-4 h-4 ${cm[c] || 'text-slate-400'}`} />
      </div>
      <div className="text-sm font-bold text-slate-700">{v}</div>
    </CardContent></Card>
  );
};

/* ─── SPARKLINE ─── */
function Sparkline({ data, color = '#10b981', height = 24 }: { data: number[]; color?: string; height?: number }) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 60;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${height - ((v - min) / range) * (height - 2) - 1}`).join(' ');
  const last = data[data.length - 1];
  const prev = data[data.length - 2] || last;
  const trend = last > prev ? 'up' : last < prev ? 'down' : 'flat';
  return (
    <div className="flex items-center gap-1.5">
      <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`} className="opacity-70">
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={w} cy={height - ((last - min) / range) * (height - 2) - 1} r="2" fill={color} />
      </svg>
      {trend === 'up' && <TrendingUp className="w-3 h-3 text-emerald-500" />}
      {trend === 'down' && <TrendingUp className="w-3 h-3 text-rose-500 rotate-180" />}
      {trend === 'flat' && <Minus className="w-3 h-3 text-amber-500" />}
    </div>
  );
}

/* ─── RECHARTS TOOLTIP ─── */
function CTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ color?: string; name?: string; value?: number | string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/90 backdrop-blur-xl border border-white/[0.40] rounded-lg px-3 py-2 shadow-xl">
      <p className="text-[10px] text-slate-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-[11px] font-medium" style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' && p.value > 1000 ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  );
}

/* ─── LOADING & EMPTY STATES ─── */
function Loading() { return <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 text-blue-500 animate-spin" /></div>; }
function Empty({ m = 'No data yet', action }: { m?: string; action?: React.ReactNode }) {
  return <div className={G.emptyState}><Box className="w-8 h-8 text-slate-300 mx-auto mb-2" /><p>{m}</p>{action}</div>;
}
function Err({ m = 'Failed to load data' }: { m?: string }) { return <div className={G.errorState}><AlertCircle className="w-5 h-5 mx-auto mb-1" /><p>{m}</p></div>; }

/* ─── USE API HOOK ─── */
function useApi<T>(path: string, deps: React.DependencyList = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try { const res = await api<T>(path); setData(res); }
    catch (e: any) { setError(e?.message || 'Failed'); }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  useEffect(() => { refresh(); }, [refresh]);
  return { data, loading, error, refresh, setData };
}

/* ─── SIDEBAR ─── */
function CargoSidebar({ activeTab, onTabChange }: { activeTab: Tab; onTabChange: (t: Tab) => void }) {
  return (
    <div className={G.sidebar}>
      <div className="shrink-0 px-4 py-3.5 border-b border-white/[0.30]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
            <Plane className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-700">KOBECARGO</h1>
            <p className="text-[9px] text-slate-400">Enterprise Cargo System</p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        <div className="px-3 space-y-4">
          {cargoSections.map((section) => (
            <div key={section.title}>
              <div className="px-2 mb-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">{section.title}</div>
              <div className="grid grid-cols-1 gap-1">
                {section.tiles.map((tile) => {
                  const isActive = activeTab === tile.key;
                  return (
                    <button key={tile.key} onClick={() => onTabChange(tile.key)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all group ${
                        isActive ? `${tile.bg} border ${tile.border} shadow-sm` : 'bg-white/[0.15] border border-transparent hover:bg-white/30'
                      }`}>
                      <div className={`w-8 h-8 rounded-lg ${tile.bg} flex items-center justify-center shrink-0 transition-transform group-hover:scale-105`}>
                        <tile.icon className={`w-[16px] h-[16px] ${tile.color}`} />
                      </div>
                      <div className={`text-[11px] font-medium ${isActive ? 'text-slate-800' : 'text-slate-600 group-hover:text-slate-700'}`}>{tile.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   TAB COMPONENTS — All wired to real APIs
   ═══════════════════════════════════════════ */

/* ─── DASHBOARD ─── */
function DashboardTab() {
  const { data: shipments, loading: sLoading } = useApi<Shipment[]>('/cargo/shipments');
  const { data: flights, loading: fLoading } = useApi<Flight[]>('/cargo/flights');
  const { data: payments, loading: pLoading } = useApi<Transaction[]>('/cargo/payments');
  const { data: customs } = useApi<{ customs: Array<{ shipmentId: string; import: CClear; export: CClear }> }>('/cargo/air/customs');

  const sh = shipments || [];
  const fl = flights || [];
  const tx = payments || [];
  const cu = customs?.customs || [];

  const activeCount = sh.filter(s => s.status !== 'DELIVERED' && s.status !== 'CANCELLED').length;
  const inTransit = sh.filter(s => s.status === 'IN_TRANSIT' || s.status === 'ARRIVED').length;
  const atCustoms = sh.filter(s => s.status === 'EXPORT_CUSTOMS' || s.status === 'IMPORT_CUSTOMS').length;
  const deliveredToday = sh.filter(s => s.status === 'DELIVERED').length;
  const revenue = sh.reduce((sum, s) => sum + (s.value || 0), 0);
  const pendingPay = tx.filter(t => t.status === 'Pending' || t.status === 'Overdue').length;

  const alerts: AlertItem[] = useMemo(() => {
    const a: AlertItem[] = [];
    cu.forEach((c) => {
      const s = sh.find(x => x.id === c.shipmentId);
      if (!s) return;
      if (c.import.riskScore > 65) a.push({ id: `exp-${s.id}`, type: 'CUSTOMS_RISK', severity: 'critical', title: 'High Export Risk', message: `${s.number} flagged ${c.import.riskScore}% risk`, entityId: s.id, entityType: 'shipment', timestamp: '2h ago' });
      if (c.import.inspection) a.push({ id: `insp-${s.id}`, type: 'INSPECTION', severity: 'warning', title: 'Import Inspection', message: `${s.number} inspection triggered`, entityId: s.id, entityType: 'shipment', timestamp: '3h ago' });
      if (c.import.taxDispute) a.push({ id: `tax-${s.id}`, type: 'TAX_DISPUTE', severity: 'critical', title: 'Tax Dispute', message: `${s.number} unresolved`, entityId: s.id, entityType: 'shipment', timestamp: '1d ago' });
    });
    tx.filter(t => t.status === 'Overdue').forEach((t, i) => a.push({ id: `pay-${t.id}-${i}`, type: 'PAYMENT_OVERDUE', severity: 'warning', title: 'Overdue Payment', message: `${t.description}: ${tzs(t.amount)}`, entityId: t.id, entityType: 'payment', timestamp: '2d ago' }));
    fl.filter(f => f.status === 'DELAYED').forEach(f => a.push({ id: `flt-${f.id}`, type: 'FLIGHT_DELAYED', severity: 'warning', title: 'Flight Delayed', message: `${f.number} ${f.origin}→${f.destination}`, entityId: f.id, entityType: 'flight', timestamp: '6h ago' }));
    return a;
  }, [cu, sh, tx, fl]);

  const revenueSpark = [28000, 35000, 42000, 148000, revenue || 85000];
  const volumeSpark = [4, 5, 6, 8, sh.length || 6];

  if (sLoading || fLoading || pLoading) return <Loading />;

  return (
    <div className={G.scrollArea}><div className={G.sectionPad}>
      {/* KPI Row */}
      <div className={G.kpiGrid}>
        <KPI t="Active Shipments" v={String(activeCount)} i={Package} c="blue" />
        <KPI t="In Transit" v={String(inTransit)} i={Plane} c="indigo" />
        <KPI t="At Customs" v={String(atCustoms)} i={ShieldCheck} c="amber" />
        <KPI t="Delivered" v={String(deliveredToday)} i={CheckCircle2} c="emerald" />
        <KPI t="Revenue (USD)" v={usd(revenue)} i={DollarSign} c="emerald" />
        <KPI t="Pending Payments" v={String(pendingPay)} i={Wallet} c="rose" />
        <KPI t="Active Flights" v={String(fl.filter(f => f.status === 'IN_FLIGHT' || f.status === 'SCHEDULED').length)} i={Navigation} c="sky" />
        <KPI t="Total Shipments" v={String(sh.length)} i={Box} c="slate" />
      </div>

      {/* Sparklines */}
      <div className={G.chartGrid}>
        <Card className={G.card}><CardContent className="p-4">
          <h3 className={G.cardHeader + ' mb-3'}>Revenue Trend</h3>
          <Sparkline data={revenueSpark} color="#3b82f6" />
        </CardContent></Card>
        <Card className={G.card}><CardContent className="p-4">
          <h3 className={G.cardHeader + ' mb-3'}>Shipment Volume</h3>
          <Sparkline data={volumeSpark} color="#10b981" />
        </CardContent></Card>
      </div>

      {/* Charts Row */}
      <div className={G.chartGrid}>
        <Card className={G.card}><CardContent className="p-4">
          <h3 className={G.cardHeader + ' mb-3 flex items-center gap-2'}><BarChart3 className="w-3.5 h-3.5 text-blue-500" />Status Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={Object.entries(sh.reduce((acc, s) => { acc[s.status] = (acc[s.status] || 0) + 1; return acc; }, {} as Record<string, number>)).map(([name, value]) => ({ name, value }))} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                {['#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#ec4899', '#06b6d4', '#8b5cf6', '#14b8a6', '#f43f5e'].map((c, i) => <Cell key={i} fill={c} />)}
              </Pie>
              <Tooltip content={<CTooltip />} />
              <Legend iconType="circle" iconSize={8} formatter={(v: string) => <span className="text-[10px] text-slate-500">{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent></Card>
        <Card className={G.card}><CardContent className="p-4">
          <h3 className={G.cardHeader + ' mb-3 flex items-center gap-2'}><TrendingUp className="w-3.5 h-3.5 text-emerald-500" />Top Customers</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={[...sh].sort((a, b) => (b.value || 0) - (a.value || 0)).slice(0, 6).map(s => ({ name: s.customer, value: s.value || 0 }))} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <YAxis dataKey="name" type="category" width={100} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CTooltip />} />
              <Bar dataKey="value" name="Revenue" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent></Card>
      </div>

      {/* Alerts + Recent Shipments */}
      <div className={G.chartGrid}>
        <Card className={G.card}><CardContent className="p-4">
          <h3 className={G.cardHeader + ' mb-3 flex items-center gap-2'}><AlertTriangle className="w-3.5 h-3.5 text-amber-500" />Alerts ({alerts.length})</h3>
          {alerts.length === 0 ? <Empty m="No alerts" /> : (
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {alerts.slice(0, 6).map(a => (
                <div key={a.id} className={`flex items-start gap-2 p-2 rounded-lg ${a.severity === 'critical' ? 'bg-rose-500/10' : a.severity === 'warning' ? 'bg-amber-500/10' : 'bg-blue-500/10'}`}>
                  {a.severity === 'critical' ? <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                  <div className="flex-1 min-w-0"><div className="text-[11px] font-medium text-slate-700">{a.title}</div><div className="text-[10px] text-slate-400">{a.message}</div></div>
                </div>
              ))}
            </div>
          )}
        </CardContent></Card>
        <Card className={G.card}><CardContent className="p-4">
          <h3 className={G.cardHeader + ' mb-3 flex items-center gap-2'}><Package className="w-3.5 h-3.5 text-blue-500" />Recent Shipments</h3>
          {sh.length === 0 ? <Empty m="No shipments yet" /> : (
            <div className="space-y-2">
              {sh.slice(0, 5).map(s => (
                <div key={s.id} className="flex items-center justify-between p-2 rounded-lg bg-white/20">
                  <div><div className="text-[11px] font-medium text-slate-700">{s.number}</div><div className="text-[10px] text-slate-400">{s.customer}</div></div>
                  <div className="flex items-center gap-2"><SB s={s.status} /><span className="text-[10px] text-slate-400">{s.origin}→{s.destination}</span></div>
                </div>
              ))}
            </div>
          )}
        </CardContent></Card>
      </div>
    </div></div>
  );
}

/* ─── SHIPMENTS ─── */
function ShipmentsTab({ search }: { search: string }) {
  const { data: shipments, loading, error, refresh, setData } = useApi<Shipment[]>('/cargo/shipments');
  const [filter, setFilter] = useState('ALL');
  const [view, setView] = useState<Shipment | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [events, setEvents] = useState<TEvent[]>([]);
  const [evLoading, setEvLoading] = useState(false);

  const sh = shipments || [];
  const filtered = useMemo(() => sh.filter(s => {
    const ms = !search || s.number.toLowerCase().includes(search.toLowerCase()) || s.customer.toLowerCase().includes(search.toLowerCase())
      || s.origin.toLowerCase().includes(search.toLowerCase()) || s.destination.toLowerCase().includes(search.toLowerCase());
    const mf = filter === 'ALL' || s.status === filter;
    return ms && mf;
  }), [sh, search, filter]);

  const filters: SS[] = ['DRAFT', 'ORIGIN', 'EXPORT_CUSTOMS', 'IN_TRANSIT', 'ARRIVED', 'IMPORT_CUSTOMS', 'DESTINATION', 'OUT_FOR_DELIVERY', 'DELIVERED'];

  const loadEvents = async (sid: string) => {
    setEvLoading(true);
    try { const res = await api<TEvent[]>(`/cargo/air/events?shipmentId=${sid}`); setEvents(res || []); }
    catch { setEvents([]); }
    finally { setEvLoading(false); }
  };

  // ShipmentCreation already POSTs /cargo/shipments and passes the
  // created row back via onCreate. The parent's job is just to refresh
  // the list and close the dialog — calling POST again would
  // double-insert the shipment.
  const handleCreate = async (_created: { id?: string }) => {
    refresh();
    setShowCreate(false);
  };

  const handleStatusUpdate = async (id: string, status: SS) => {
    try { await api(`/cargo/shipments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); refresh(); }
    catch (e: any) { alert('Error: ' + e.message); }
  };

  if (loading) return <Loading />;
  if (error) return <Err m={error} />;

  return (
    <div className={G.scrollArea}><div className={G.sectionPad}>
      <div className="flex items-center justify-between">
        <div><h2 className="text-sm font-bold text-slate-700">Shipments</h2><p className="text-[10px] text-slate-400">{sh.length} total</p></div>
        <Button onClick={() => setShowCreate(true)} className={G.btnPrimary + ' text-xs h-8'}><Plus className="w-3.5 h-3.5 mr-1" />New Shipment</Button>
      </div>

      {/* Filters */}
      <div className="flex gap-1 overflow-x-auto scrollbar-hide">
        <button onClick={() => setFilter('ALL')} className={`px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all border ${filter === 'ALL' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' : 'text-slate-400 hover:text-slate-600 border-transparent'}`}>All</button>
        {filters.map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all border ${filter === f ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' : 'text-slate-400 hover:text-slate-600 border-transparent'}`}>{f.replace(/_/g, ' ')}</button>
        ))}
      </div>

      {filtered.length === 0 ? <Empty m="No shipments found" action={<Button onClick={() => setShowCreate(true)} className={G.btnPrimary + ' mt-2 text-xs'}><Plus className="w-3 h-3 mr-1" />Create</Button>} /> : (
        <div className="space-y-2">
          {filtered.map(s => (
            <Card key={s.id} className={G.card + ' hover:bg-white/40 transition-all cursor-pointer'} onClick={() => { setView(s); loadEvents(s.id); }}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between mb-2">
                  <div><div className="flex items-center gap-2"><span className="text-xs font-semibold text-slate-700">{s.number}</span><SB s={s.priority} /></div><div className="text-[10px] text-slate-400 mt-0.5">{s.customer}</div></div>
                  <SB s={s.status} />
                </div>
                <div className="flex items-center gap-2 mb-2"><span className="text-[11px] text-slate-500">{s.origin}</span><ArrowRight className="w-3 h-3 text-slate-300" /><span className="text-[11px] text-slate-500">{s.destination}</span></div>
                <div className="flex items-center gap-3 text-[10px] text-slate-400">
                  <span>{s.cargoType}</span><span>{s.packages} pkgs</span><span>{s.actualWeight}kg</span><span>{usd(s.value)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      {showCreate && (
        <Dialog open onOpenChange={() => setShowCreate(false)}>
          <DialogContent className="bg-white/95 backdrop-blur-xl border border-white/[0.40] max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="text-sm text-slate-700">New Shipment</DialogTitle></DialogHeader>
            <ShipmentCreation onCreate={handleCreate} onCancel={() => setShowCreate(false)} />
          </DialogContent>
        </Dialog>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!view} onOpenChange={() => setView(null)}>
        <DialogContent className="bg-white/95 backdrop-blur-xl border border-white/[0.40] max-w-lg max-h-[85vh] overflow-y-auto">
          {view && (
            <>
              <DialogHeader><DialogTitle className="text-sm text-slate-700">Shipment {view.number}</DialogTitle></DialogHeader>
              <div className="space-y-3 text-[11px]">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/30 rounded-lg p-2 border border-white/[0.30]"><div className="text-slate-400">Customer</div><div className="text-slate-700 font-medium">{view.customer}</div></div>
                  <div className="bg-white/30 rounded-lg p-2 border border-white/[0.30]"><div className="text-slate-400">Supplier</div><div className="text-slate-700 font-medium">{view.supplier}</div></div>
                  <div className="bg-white/30 rounded-lg p-2 border border-white/[0.30]"><div className="text-slate-400">Route</div><div className="text-slate-700">{view.origin}→{view.destination}</div></div>
                  <div className="bg-white/30 rounded-lg p-2 border border-white/[0.30]"><div className="text-slate-400">Weight</div><div className="text-slate-700">{view.actualWeight}kg</div></div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-500">Update status:</span>
                  {filters.map(f => (
                    <button key={f} onClick={() => handleStatusUpdate(view.id, f)} className="px-2 py-0.5 rounded-lg text-[10px] bg-white/30 border border-white/[0.30] text-slate-600 hover:bg-blue-500/10 hover:text-blue-600 transition-all">
                      {f.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
                <h4 className="text-xs font-medium text-slate-600">Tracking Events</h4>
                {evLoading ? <Loading /> : events.length === 0 ? <Empty m="No events" /> : (
                  <div className="space-y-1">
                    {events.map(ev => (
                      <div key={ev.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/20">
                        <CircleDot className="w-3 h-3 text-blue-500 shrink-0" />
                        <span className="text-slate-600">{ev.type.replace(/_/g, ' ')}</span>
                        <span className="text-slate-400 ml-auto">{ev.location} · {ev.timestamp}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white/30 rounded-lg p-2 border border-white/[0.30]"><div className="text-[9px] text-slate-400">Value</div><div className="text-emerald-600 font-medium">{usd(view.value)}</div></div>
                  <div className="bg-white/30 rounded-lg p-2 border border-white/[0.30]"><div className="text-[9px] text-slate-400">Cost</div><div className="text-rose-500 font-medium">{usd(view.cost)}</div></div>
                  <div className="bg-white/30 rounded-lg p-2 border border-white/[0.30]"><div className="text-[9px] text-slate-400">Margin</div><div className="text-blue-600 font-medium">{view.value > 0 ? (((view.value - view.cost) / view.value) * 100).toFixed(1) : '0.0'}%</div></div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div></div>
  );
}


/* ─── CUSTOMS ─── */
function CustomsTab({ search }: { search: string }) {
  const { data: shipments, loading, error } = useApi<Shipment[]>('/cargo/shipments');
  const { data: customs } = useApi<{ customs: Array<{ shipmentId: string; export: CClear; import: CClear }> }>('/cargo/air/customs');
  const [jurisdiction, setJurisdiction] = useState<'EXPORT' | 'IMPORT'>('EXPORT');
  const [updating, setUpdating] = useState<string | null>(null);

  const sh = shipments || [];
  const cu = customs?.customs || [];

  const filtered = useMemo(() => {
    return sh.filter(s => !search || s.number.toLowerCase().includes(search.toLowerCase()) || s.customer.toLowerCase().includes(search.toLowerCase()));
  }, [sh, search]);

  const handleClear = async (shipmentId: string) => {
    setUpdating(shipmentId);
    try { await api(`/cargo/air/customs/${shipmentId}/clear`, { method: 'POST' }); }
    catch (e: any) { alert('Error: ' + e.message); }
    finally { setUpdating(null); }
  };

  if (loading) return <Loading />;
  if (error) return <Err m={error} />;

  return (
    <div className={G.scrollArea}><div className={G.sectionPad}>
      <div className="flex gap-1">
        <button onClick={() => setJurisdiction('EXPORT')} className={`flex-1 py-2 rounded-xl text-[11px] font-medium transition-all border ${jurisdiction === 'EXPORT' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' : 'text-slate-400 border-transparent hover:bg-white/20'}`}>China Export</button>
        <button onClick={() => setJurisdiction('IMPORT')} className={`flex-1 py-2 rounded-xl text-[11px] font-medium transition-all border ${jurisdiction === 'IMPORT' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'text-slate-400 border-transparent hover:bg-white/20'}`}>Tanzania Import</button>
      </div>

      {filtered.map(s => {
        const c = cu.find(x => x.shipmentId === s.id);
        if (!c) return null;
        const cc = jurisdiction === 'EXPORT' ? c.export : c.import;
        return (
          <Card key={s.id} className={G.card}><CardContent className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-700">{s.number}</div>
                <div className="text-[10px] text-slate-400">{s.customer} · Port: {cc.portCode}</div>
              </div>
              <SB s={cc.lane} />
            </div>

            {/* Risk Score */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-400">Risk Score</span>
                <span className={`text-[10px] font-medium ${cc.riskScore > 65 ? 'text-rose-500' : cc.riskScore > 35 ? 'text-amber-500' : 'text-emerald-500'}`}>{cc.riskScore}/100</span>
              </div>
              <div className="h-2 rounded-full bg-white/30 overflow-hidden">
                <div className={`h-full rounded-full ${cc.riskScore > 65 ? 'bg-rose-500' : cc.riskScore > 35 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, cc.riskScore)}%` }} />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <SB s={cc.status} />
              {cc.inspection && <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20">Inspection</span>}
              {cc.taxDispute && <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-600 border border-rose-500/30">Tax Dispute</span>}
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="bg-white/30 rounded-lg p-2 border border-white/[0.30]"><div className="text-slate-400">Duties Est.</div><div className="text-slate-700 font-medium">{usd(cc.dutiesEstimated)}</div></div>
              <div className="bg-white/30 rounded-lg p-2 border border-white/[0.30]"><div className="text-slate-400">Duties Paid</div><div className={cc.dutiesPaid >= cc.dutiesEstimated ? 'text-emerald-600' : 'text-amber-600'}>{usd(cc.dutiesPaid)}</div></div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="outline" className={G.btnOutline + ' text-[10px] h-7'} onClick={() => handleClear(s.id)} disabled={updating === s.id}>
                {updating === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><ShieldCheck className="w-3 h-3 mr-1" />Clear Hold</>}
              </Button>
              <Button size="sm" variant="outline" className={G.btnOutline + ' text-[10px] h-7'}><Package className="w-3 h-3 mr-1" />Upload Docs</Button>
            </div>
          </CardContent></Card>
        );
      })}
    </div></div>
  );
}

/* ─── WAREHOUSE ─── */
function WarehouseTab() {
  const { data: bins, loading: bLoading, error: bErr, refresh: refreshBins } = useApi<Bin[]>('/cargo/parcels?page=1&limit=100');
  const { data: ulds, loading: uLoading, error: uErr } = useApi<ULD[]>('/cargo/air/hubs');
  const { data: pkgs, loading: pLoading } = useApi<Pkg[]>('/cargo/parcels');

  const [scan, setScan] = useState('');
  const [found, setFound] = useState<Pkg | null>(null);

  const handleScan = () => {
    const p = (pkgs || []).find(pkg => pkg.qrCode === scan || pkg.id === scan);
    setFound(p || null);
  };

  if (bLoading || uLoading || pLoading) return <Loading />;
  if (bErr) return <Err m={bErr} />;

  const binList = (bins as unknown as Bin[]) || [];
  const uldList = (ulds as unknown as ULD[]) || [];
  // Note: bins from /cargo/parcels may not be Bin[] — show what we have
  const safeBins: Bin[] = Array.isArray(binList) ? binList.filter(b => b && typeof b === 'object' && b.number) : [];

  return (
    <div className={G.scrollArea}><div className={G.sectionPad}>
      {/* Package Scanner */}
      <Card className={G.card}><CardContent className="p-3 space-y-3">
        <h3 className={G.cardHeader + ' flex items-center gap-2'}><Box className="w-4 h-4 text-blue-500" />Package Scan</h3>
        <div className="flex gap-2">
          <Input value={scan} onChange={e => setScan(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleScan()} placeholder="Scan QR code or enter package ID" className={G.input + ' h-9 flex-1 text-xs'} />
          <Button onClick={handleScan} className={G.btnPrimary + ' h-9 px-3'}><Search className="w-3.5 h-3.5" /></Button>
        </div>
        {found && (
          <div className="bg-blue-500/10 rounded-lg p-3 space-y-2 border border-blue-500/20">
            <div className="text-xs font-medium text-slate-700">{found.qrCode}</div>
            <div className="text-[11px] text-slate-500">{found.description}</div>
            <div className="flex items-center gap-3 text-[10px] text-slate-400">
              <span className="flex items-center gap-1"><Weight className="w-3 h-3" />{found.weight}kg</span>
              <span className="flex items-center gap-1"><Ruler className="w-3 h-3" />{found.dims}cm</span>
            </div>
            <SB s={found.status} />
          </div>
        )}
        {found === null && scan && <div className="text-center text-[11px] text-rose-500 py-2">Package not found</div>}
      </CardContent></Card>

      {/* Bins Grid */}
      <Card className={G.card}><CardContent className="p-3 space-y-3">
        <h3 className={G.cardHeader + ' flex items-center gap-2'}><Container className="w-4 h-4 text-orange-500" />Bins</h3>
        {safeBins.length === 0 ? <Empty m="No bins configured" action={<Button className={G.btnPrimary + ' text-[10px] mt-2 h-7'}><Plus className="w-3 h-3 mr-1" />Add Bin</Button>} /> : (
          <div className="grid grid-cols-2 gap-2">
            {safeBins.map(b => (
              <div key={b.id} className="bg-white/30 rounded-xl p-2.5 border border-white/[0.30]">
                <div className="text-[11px] font-medium text-slate-700">{b.number}</div>
                <div className="text-[10px] text-slate-400">{b.warehouse}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-slate-400">{b.packages} pkgs</span>
                  <span className="text-[10px] text-slate-400">{b.weight}kg</span>
                </div>
                <SB s={b.status} />
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>

      {/* ULD List */}
      <Card className={G.card}><CardContent className="p-3 space-y-3">
        <h3 className={G.cardHeader + ' flex items-center gap-2'}><Container className="w-4 h-4 text-indigo-500" />ULDs</h3>
        {uldList.length === 0 ? <Empty m="No ULDs found" /> : (
          <div className="space-y-2">
            {uldList.map(u => (
              <div key={u.id} className="bg-white/30 rounded-xl p-2.5 border border-white/[0.30]">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-medium text-slate-700">{u.number}<span className="text-slate-400"> ({u.uldType})</span></div>
                    <div className="text-[10px] text-slate-400">Flight: {u.flight}</div>
                  </div>
                  <SB s={u.status} />
                </div>
                <div className="mt-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                    <span>{u.weight}kg / {u.capacity}kg</span>
                    <span>{u.capacity > 0 ? Math.round((u.weight / u.capacity) * 100) : 0}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/30 overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${u.capacity > 0 ? Math.min(100, (u.weight / u.capacity) * 100) : 0}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>
    </div></div>
  );
}

/* ─── FLIGHTS ─── */
function FlightsTab({ search }: { search: string }) {
  const { data: flights, loading, error } = useApi<Flight[]>('/cargo/flights');
  const { data: ulds } = useApi<ULD[]>('/cargo/air/hubs');
  const [view, setView] = useState<Flight | null>(null);
  const [showBoard, setShowBoard] = useState(false);

  const fl = flights || [];
  const filtered = useMemo(() => fl.filter(f => !search || f.number.toLowerCase().includes(search.toLowerCase()) || f.airline.toLowerCase().includes(search.toLowerCase())), [fl, search]);

  if (showBoard) {
    return (
      <div className={G.scrollArea}><div className={G.sectionPad}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-slate-700">Live Flight Board</h2>
          <Button onClick={() => setShowBoard(false)} size="sm" variant="outline" className={G.btnOutline + ' text-xs h-7'}>Back to Flights</Button>
        </div>
        <FlightBoard />
      </div></div>
    );
  }

  if (loading) return <Loading />;
  if (error) return <Err m={error} />;

  return (
    <div className={G.scrollArea}><div className={G.sectionPad}>
      <div className="flex items-center justify-between">
        <div><h2 className="text-sm font-bold text-slate-700">Flight Schedule</h2><p className="text-[10px] text-slate-400">{fl.length} flights</p></div>
        <Button onClick={() => setShowBoard(true)} size="sm" className={G.btnPrimary + ' text-xs h-8'}><Navigation className="w-3.5 h-3.5 mr-1" />Live Board</Button>
      </div>

      {filtered.length === 0 ? <Empty m="No flights found" /> : (
        <div className="space-y-2">
          {filtered.map(f => (
            <Card key={f.id} className={G.card + ' hover:bg-white/40 transition-all cursor-pointer'} onClick={() => setView(f)}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Plane className="w-4 h-4 text-sky-500" />
                    <div>
                      <div className="text-xs font-semibold text-slate-700">{f.number} · {f.airline}</div>
                      <div className="text-[10px] text-slate-400">{f.ulds} ULDs · ${f.costPerKg}/kg</div>
                    </div>
                  </div>
                  <SB s={f.status} />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] text-slate-600 font-medium">{f.origin}</span>
                  {f.transit && <><ArrowRight className="w-3 h-3 text-slate-300" /><span className="text-[10px] text-slate-400">{f.transit}</span></>}
                  <ArrowRight className="w-3 h-3 text-slate-300" />
                  <span className="text-[11px] text-slate-600 font-medium">{f.destination}</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-slate-400">
                  <span>ETD: {f.etd}</span><span>ETA: {f.eta}</span>
                </div>
                <div className="mt-2">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                    <span>Cargo: {f.weight}kg / {f.capacity}kg</span>
                    <span>{f.capacity > 0 ? Math.round((f.weight / f.capacity) * 100) : 0}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/30 overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${f.capacity > 0 ? Math.min(100, (f.weight / f.capacity) * 100) : 0}%` }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Flight Detail */}
      <Dialog open={!!view} onOpenChange={() => setView(null)}>
        <DialogContent className="bg-white/95 backdrop-blur-xl border border-white/[0.40] max-w-sm">
          {view && (
            <>
              <DialogHeader><DialogTitle className="text-sm text-slate-700">Flight {view.number}</DialogTitle></DialogHeader>
              <div className="space-y-3 text-[11px]">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/30 rounded-lg p-2 border border-white/[0.30]"><div className="text-slate-400">Airline</div><div className="text-slate-700">{view.airline}</div></div>
                  <div className="bg-white/30 rounded-lg p-2 border border-white/[0.30]"><div className="text-slate-400">Status</div><SB s={view.status} /></div>
                </div>
                <div className="bg-white/30 rounded-lg p-2 text-center border border-white/[0.30]">
                  <div className="text-slate-700 text-sm font-medium">{view.origin}→{view.transit ? `${view.transit}→` : ''}{view.destination}</div>
                  <div className="text-slate-400">{view.etd} → {view.eta}</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/30 rounded-lg p-2 border border-white/[0.30]"><div className="text-slate-400">Rate</div><div className="text-emerald-600 font-medium">${view.costPerKg}/kg</div></div>
                  <div className="bg-white/30 rounded-lg p-2 border border-white/[0.30]"><div className="text-slate-400">Utilization</div><div className="text-slate-700">{view.capacity > 0 ? Math.round((view.weight / view.capacity) * 100) : 0}%</div></div>
                </div>
                <h4 className="text-xs font-medium text-slate-600">ULDs</h4>
                {(ulds || []).filter((u: ULD) => u.flight === view.number).map((u: ULD) => (
                  <div key={u.id} className="flex items-center gap-2 p-2 bg-white/20 rounded-lg">
                    <Container className="w-4 h-4 text-indigo-500" /><span className="text-slate-600">{u.number}</span><span className="text-slate-400 ml-auto">{u.weight}kg</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div></div>
  );
}


/* ─── DELIVERY ─── */
function DeliveryTab({ search }: { search: string }) {
  const { data: deliveries, loading, error, refresh } = useApi<Delivery[]>('/cargo/air/deliveries');
  const { data: drivers } = useApi<Driver[]>('/cargo/drivers');
  const { data: shipments } = useApi<Shipment[]>('/cargo/shipments');
  const [updating, setUpdating] = useState<string | null>(null);

  const del = (deliveries as unknown as Delivery[]) || [];
  const sh = shipments || [];
  const dr = drivers || [];

  const filtered = useMemo(() => del.filter(d => !search || d.driver.toLowerCase().includes(search.toLowerCase()) || d.address.toLowerCase().includes(search.toLowerCase())), [del, search]);
  const steps = ['ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED'];

  const handleAssignDriver = async (deliveryId: string, driverId: string) => {
    setUpdating(deliveryId);
    try { await api(`/cargo/air/deliveries/${deliveryId}/assign`, { method: 'POST', body: JSON.stringify({ driverId }) }); refresh(); }
    catch (e: any) { alert('Error: ' + e.message); }
    finally { setUpdating(null); }
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    setUpdating(id);
    try { await api(`/cargo/air/deliveries/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); refresh(); }
    catch (e: any) { alert('Error: ' + e.message); }
    finally { setUpdating(null); }
  };

  if (loading) return <Loading />;
  if (error) return <Err m={error} />;

  return (
    <div className={G.scrollArea}><div className={G.sectionPad}>
      <div><h2 className="text-sm font-bold text-slate-700">Last-Mile Delivery</h2><p className="text-[10px] text-slate-400">{del.length} deliveries</p></div>

      {filtered.length === 0 ? <Empty m="No deliveries yet" action={<Button className={G.btnPrimary + ' text-xs mt-2 h-7'}><Plus className="w-3 h-3 mr-1" />Create Delivery</Button>} /> : (
        <div className="space-y-3">
          {filtered.map(d => {
            const s = sh.find(x => x.id === d.shipmentId);
            const idx = steps.indexOf(d.status);
            return (
              <Card key={d.id} className={G.card}><CardContent className="p-3 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Truck className="w-5 h-5 text-violet-500" />
                    <div>
                      <div className="text-xs font-semibold text-slate-700">{s?.number || d.shipmentId.slice(0, 8)}</div>
                      <div className="text-[10px] text-slate-400">{d.driver} · {d.vehicle}</div>
                    </div>
                  </div>
                  <SB s={d.status} />
                </div>
                <div className="text-[11px] text-slate-500">{d.address}</div>
                {d.recipient && <div className="text-[10px] text-emerald-600">Received by: {d.recipient}</div>}

                {/* Progress Steps */}
                <div className="flex items-center gap-1">
                  {steps.map((step, si) => (
                    <div key={step} className="flex-1 flex flex-col items-center">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${si <= idx ? 'bg-blue-500' : 'bg-white/40'}`}>
                        {si <= idx ? <CheckCircle2 className="w-3 h-3 text-white" /> : <Circle className="w-3 h-3 text-slate-300" />}
                      </div>
                      <span className="text-[8px] text-slate-400 mt-1 hidden sm:block">{step.replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-3 text-[10px] text-slate-400">
                  <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{d.phone}</span>
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{d.started}</span>
                  {d.delivered && <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-3 h-3" />{d.delivered}</span>}
                </div>

                {/* Driver Assignment + Actions */}
                <div className="flex gap-2 flex-wrap">
                  <select
                    className="text-[10px] bg-white/40 border border-white/[0.40] rounded-lg px-2 py-1 text-slate-700"
                    onChange={e => { if (e.target.value) handleAssignDriver(d.id, e.target.value); }}
                    defaultValue=""
                  >
                    <option value="">Assign Driver...</option>
                    {dr.map(driver => <option key={driver.id} value={driver.id}>{driver.name} ({driver.vehicle})</option>)}
                  </select>
                  <Button size="sm" variant="outline" className={G.btnOutline + ' h-6 text-[10px]'} onClick={() => handleStatusUpdate(d.id, 'OUT_FOR_DELIVERY')} disabled={updating === d.id || d.status === 'OUT_FOR_DELIVERY'}>
                    {updating === d.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Out for Delivery'}
                  </Button>
                  <Button size="sm" className={G.btnPrimary + ' h-6 text-[10px]'} onClick={() => handleStatusUpdate(d.id, 'DELIVERED')} disabled={updating === d.id || d.status === 'DELIVERED'}>
                    {updating === d.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><CheckCircle2 className="w-3 h-3 mr-0.5" />Delivered</>}
                  </Button>
                </div>

                {d.status === 'FAILED' && (
                  <div className="bg-rose-500/10 rounded-lg p-2 text-[10px] text-rose-600 border border-rose-500/20">
                    Delivery failed — retry recommended.
                  </div>
                )}
              </CardContent></Card>
            );
          })}
        </div>
      )}
    </div></div>
  );
}

/* ─── PAYMENTS ─── */
function PaymentsTab() {
  const { data: payments, loading, error, refresh } = useApi<Transaction[]>('/cargo/payments');
  const [dialogOpen, setDialogOpen] = useState(false);

  const tx = (payments as unknown as Transaction[]) || [];

  if (loading) return <Loading />;
  if (error) return <Err m={error} />;

  const overdue = tx.filter(t => t.status === 'Overdue');
  const collected = tx.filter(t => t.status === 'Paid').reduce((s, t) => s + (t.type === 'CREDIT' ? (t.amount || 0) : 0), 0);
  const pendingAmt = tx.filter(t => t.status === 'Pending').reduce((s, t) => s + (t.amount || 0), 0);
  const overdueAmt = overdue.reduce((s, t) => s + (t.amount || 0), 0);

  return (
    <div className={G.scrollArea}><div className={G.sectionPad}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-700">Payments</h2>
          <p className="text-[11px] text-slate-400">{tx.length} transactions</p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)} className={G.btnPrimary + ' text-xs h-8'}>
          <Plus className="w-4 h-4 mr-1.5" /> Record Payment
        </Button>
      </div>

      {/* Wallet Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI t="Collected" v={tzs(collected)} i={CheckCircle2} c="emerald" />
        <KPI t="Pending" v={tzs(pendingAmt)} i={Clock} c="amber" />
        <KPI t="Overdue" v={tzs(overdueAmt)} i={AlertTriangle} c="rose" />
        <KPI t="Total Txns" v={String(tx.length)} i={Receipt} c="blue" />
      </div>

      {/* Overdue Alerts */}
      {overdue.length > 0 && (
        <Card className="bg-rose-500/[0.08] border-rose-500/20 backdrop-blur-xl rounded-2xl">
          <CardContent className="p-3">
            <h4 className="text-[11px] font-medium text-rose-600 mb-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{overdue.length} Overdue Payment(s)</h4>
            <div className="space-y-1">
              {overdue.slice(0, 3).map(t => (
                <div key={t.id} className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-600">{t.description}</span>
                  <span className="text-rose-600 font-medium">{tzs(t.amount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction Table */}
      <Card className={G.card}>
        <CardContent className="p-0">
          {tx.length === 0 ? (
            <div className="p-8 text-center">
              <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-[11px] text-slate-400">No payments recorded yet.</p>
              <Button size="sm" onClick={() => setDialogOpen(true)} className={G.btnPrimary + ' mt-3 text-xs'}>
                <Plus className="w-4 h-4 mr-1.5" /> Record first payment
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.30]">
              <div className="grid grid-cols-5 gap-2 px-4 py-2 text-[10px] font-semibold text-slate-500 bg-white/20">
                <span>Description</span><span>Type</span><span>Method</span><span>Status</span><span className="text-right">Amount</span>
              </div>
              {tx.map(t => (
                <div key={t.id} className="grid grid-cols-5 gap-2 px-4 py-2.5 text-[11px] items-center hover:bg-white/20 transition-colors">
                  <span className="text-slate-700 truncate">{t.description}</span>
                  <span className={t.type === 'CREDIT' ? 'text-emerald-600' : 'text-rose-600'}>{t.type}</span>
                  <span className="text-slate-400">{t.method}</span>
                  <span><SB s={t.status} /></span>
                  <span className={`text-right font-medium ${t.type === 'CREDIT' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {t.type === 'CREDIT' ? '+' : '-'}{tzs(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CargoPaymentWorkflow open={dialogOpen} onClose={() => setDialogOpen(false)} onSaved={() => refresh()} />
    </div></div>
  );
}

/* ─── TRACKING ─── */
function TrackingTab({ search: initialSearch }: { search: string }) {
  const { data: shipments } = useApi<Shipment[]>('/cargo/shipments');
  const [search, setSearch] = useState(initialSearch);
  const [found, setFound] = useState<Shipment | null>(null);
  const [events, setEvents] = useState<TEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const sh = shipments || [];

  const handleSearch = async () => {
    const s = sh.find(x => x.masterAWB === search || x.number.toLowerCase() === search.toLowerCase() || x.houseAWB === search);
    if (!s) { setFound(null); setEvents([]); return; }
    setFound(s);
    setLoading(true);
    try { const res = await api<TEvent[]>(`/cargo/air/events?shipmentId=${s.id}`); setEvents(res || []); }
    catch { setEvents([]); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (initialSearch) { setSearch(initialSearch); }
  }, [initialSearch]);

  const evIcon = (type: string) => {
    if (type.includes('CREATED')) return <CircleDot className="w-4 h-4 text-blue-500" />;
    if (type.includes('CUSTOMS')) return <ShieldCheck className="w-4 h-4 text-amber-500" />;
    if (type.includes('FLIGHT') || type.includes('TRANSIT')) return <Plane className="w-4 h-4 text-indigo-500" />;
    if (type.includes('DELIVER') || type.includes('COMPLETED')) return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    return <Circle className="w-4 h-4 text-slate-400" />;
  };

  return (
    <div className={G.scrollArea}><div className={G.sectionPad}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} placeholder="Enter AWB, House AWB, or Shipment Number" className={G.input + ' h-10 pl-10'} />
      </div>
      <Button onClick={handleSearch} className={G.btnPrimary + ' w-full mt-2'} disabled={!search}>
        <MapPin className="w-3.5 h-3.5 mr-1.5" />Track Shipment
      </Button>

      {found && (
        <>
          <Card className={G.card}>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">{found.number}</span>
                <SB s={found.status} />
              </div>
              <div className="text-[11px] text-slate-500">{found.origin} → {found.destination}</div>
              <div className="text-[10px] text-slate-400">{found.customer} · {found.packages}pkgs · ETA: {found.eta}</div>
              <div className="flex items-center gap-3 text-[10px] text-slate-400">
                <span>Master AWB: <span className="font-mono text-slate-600">{found.masterAWB}</span></span>
                <span>House AWB: <span className="font-mono text-slate-600">{found.houseAWB}</span></span>
              </div>
              {/* QR Code */}
              <div className="flex justify-center pt-2">
                <QRCodeSVG value={`AWB:${found.masterAWB}:SHIP:${found.id}`} size={100} bgColor="transparent" fgColor="#475569" />
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <h3 className={G.cardHeader + ' mt-4 mb-2'}>Tracking Events</h3>
          {loading ? <Loading /> : events.length === 0 ? <Empty m="No tracking events yet" /> : (
            <div className="relative pl-6">
              <div className="absolute left-[11px] top-0 bottom-0 w-0.5 bg-white/40" />
              {events.map(ev => (
                <div key={ev.id} className="relative mb-4">
                  <div className="absolute -left-[17px] top-0 w-6 h-6 rounded-full bg-white/50 border-2 border-white/[0.40] flex items-center justify-center z-10">
                    {evIcon(ev.type)}
                  </div>
                  <div className="bg-white/30 backdrop-blur-xl rounded-xl p-2.5 ml-2 border border-white/[0.30]">
                    <div className="text-[11px] font-medium text-slate-700">{ev.type.replace(/_/g, ' ')}</div>
                    <div className="text-[10px] text-slate-400">{ev.location} · {ev.timestamp}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!found && search && !loading && (
        <div className="text-center text-[11px] text-rose-500 py-4">No shipment found for &quot;{search}&quot;</div>
      )}
      {!search && <Empty m="Enter an AWB or tracking number to start tracking" />}
    </div></div>
  );
}


/* ─── ANALYTICS ─── */
function AnalyticsTab() {
  const { data: shipments, loading: sLoading } = useApi<Shipment[]>('/cargo/shipments');
  const { data: payments } = useApi<Transaction[]>('/cargo/payments');
  const [chartView, setChartView] = useState<'volume' | 'cost' | 'customers'>('volume');

  const sh = shipments || [];
  const tx = (payments as unknown as Transaction[]) || [];

  // Monthly volume from real shipment data
  const monthlyVolume = useMemo(() => {
    const map: Record<string, number> = {};
    sh.forEach(s => {
      const d = s.createdAt ? new Date(s.createdAt) : null;
      const key = d && !isNaN(d.getTime()) ? d.toLocaleString('en', { month: 'short' }) : 'Unknown';
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).map(([month, volume]) => ({ month, volume })).sort((a, b) => {
      const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return mo.indexOf(a.month) - mo.indexOf(b.month);
    });
  }, [sh]);

  // Status distribution from real data
  const statusDist = useMemo(() => {
    const map: Record<string, number> = {};
    sh.forEach(s => { map[s.status] = (map[s.status] || 0) + 1; });
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#ec4899', '#06b6d4', '#8b5cf6', '#14b8a6', '#f43f5e'];
    return Object.entries(map).map(([name, value], i) => ({ name: name.replace(/_/g, ' '), value, color: colors[i % colors.length] }));
  }, [sh]);

  // Top customers from real data
  const topCustomers = useMemo(() => {
    const map: Record<string, { value: number; cost: number }> = {};
    sh.forEach(s => {
      if (!map[s.customer]) map[s.customer] = { value: 0, cost: 0 };
      map[s.customer].value += s.value || 0;
      map[s.customer].cost += s.cost || 0;
    });
    return Object.entries(map).map(([name, { value, cost }]) => ({ name, value, profit: value - cost })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [sh]);

  // Cost breakdown from real transactions
  const costBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    tx.forEach(t => { if (t.type === 'DEBIT') map[t.method] = (map[t.method] || 0) + (t.amount || 0); });
    return Object.entries(map).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
  }, [tx]);

  if (sLoading) return <Loading />;

  return (
    <div className={G.scrollArea}><div className={G.sectionPad}>
      <div><h2 className="text-sm font-bold text-slate-700">Analytics</h2><p className="text-[10px] text-slate-400">{sh.length} shipments · {tx.length} transactions</p></div>

      {/* Chart Tabs */}
      <div className="flex gap-1">
        {[{ k: 'volume' as const, l: 'Volume', i: BarChart3 }, { k: 'cost' as const, l: 'Cost', i: DollarSign }, { k: 'customers' as const, l: 'Customers', i: Package }].map(t => (
          <button key={t.k} onClick={() => setChartView(t.k)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all border ${chartView === t.k ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' : 'text-slate-400 hover:text-slate-600 border-transparent hover:bg-white/20'}`}>
            <t.i className="w-3.5 h-3.5" />{t.l}
          </button>
        ))}
      </div>

      {chartView === 'volume' && (
        <div className={G.chartGrid}>
          <Card className={G.card}><CardContent className="p-4">
            <h3 className={G.cardHeader + ' mb-3'}>Monthly Shipment Volume</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyVolume.length > 0 ? monthlyVolume : [{ month: 'No Data', volume: 0 }]}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CTooltip />} />
                <Bar dataKey="volume" name="Shipments" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent></Card>
          <Card className={G.card}><CardContent className="p-4">
            <h3 className={G.cardHeader + ' mb-3'}>Status Distribution</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusDist.length > 0 ? statusDist : [{ name: 'No Data', value: 1, color: '#cbd5e1' }]} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name">
                  {(statusDist.length > 0 ? statusDist : [{ name: 'No Data', value: 1, color: '#cbd5e1' }]).map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip content={<CTooltip />} />
                <Legend iconType="circle" iconSize={8} formatter={(v: string) => <span className="text-[10px] text-slate-500">{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent></Card>
        </div>
      )}

      {chartView === 'cost' && (
        <div className={G.chartGrid}>
          <Card className={G.card}><CardContent className="p-4">
            <h3 className={G.cardHeader + ' mb-3'}>Cost Breakdown by Method</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={costBreakdown.length > 0 ? costBreakdown : [{ category: 'No Data', amount: 1 }]} cx="50%" cy="50%" outerRadius={80} dataKey="amount" nameKey="category"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {costBreakdown.length > 0 ? costBreakdown.map((_, i) => <Cell key={i} fill={['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6'][i % 6]} />) : <Cell fill="#cbd5e1" />}
                </Pie>
                <Tooltip content={<CTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent></Card>
          <Card className={G.card}><CardContent className="p-4">
            <h3 className={G.cardHeader + ' mb-3'}>Transaction Volume</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={[{ month: 'All Time', debit: tx.filter(t => t.type === 'DEBIT').reduce((s, t) => s + (t.amount || 0), 0), credit: tx.filter(t => t.type === 'CREDIT').reduce((s, t) => s + (t.amount || 0), 0) }]}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => tzs(v as number)} />
                <Tooltip content={<CTooltip />} />
                <Legend iconType="circle" iconSize={8} formatter={(v: string) => <span className="text-[10px] text-slate-500">{v}</span>} />
                <Bar dataKey="debit" name="Debit" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="credit" name="Credit" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent></Card>
        </div>
      )}

      {chartView === 'customers' && (
        <Card className={G.card}><CardContent className="p-4">
          <h3 className={G.cardHeader + ' mb-3'}>Top Customers by Revenue & Profit</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topCustomers.length > 0 ? topCustomers : [{ name: 'No Data', value: 0, profit: 0 }]} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v as number / 1000).toFixed(0)}k`} />
              <YAxis dataKey="name" type="category" width={120} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CTooltip />} />
              <Legend iconType="circle" iconSize={8} formatter={(v: string) => <span className="text-[10px] text-slate-500">{v}</span>} />
              <Bar dataKey="value" name="Revenue" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              <Bar dataKey="profit" name="Profit" fill="#10b981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent></Card>
      )}

      {/* Summary Stats */}
      <div className={G.kpiGrid}>
        <KPI t="Total Shipments" v={String(sh.length)} i={Package} c="blue" />
        <KPI t="Total Revenue" v={usd(sh.reduce((s, x) => s + (x.value || 0), 0))} i={DollarSign} c="emerald" />
        <KPI t="Total Costs" v={usd(sh.reduce((s, x) => s + (x.cost || 0), 0))} i={DollarSign} c="rose" />
        <KPI t="Avg Margin" v={`${sh.length > 0 ? (sh.reduce((s, x) => s + ((x.value || 0) - (x.cost || 0)), 0) / sh.reduce((s, x) => s + (x.value || 0), 0) * 100).toFixed(1) : '0.0'}%`} i={TrendingUp} c="indigo" />
      </div>
    </div></div>
  );
}

/* ─── SETTINGS ─── */
function SettingsTab() {
  const [fr24Enabled, setFr24Enabled] = useState(true);
  const [currency, setCurrency] = useState<'TZS' | 'USD' | 'BOTH'>('BOTH');
  const [emailNotif, setEmailNotif] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    // In a real app, this would POST to /cargo/settings
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className={G.scrollArea}><div className={G.sectionPad}>
      <div><h2 className="text-sm font-bold text-slate-700">Settings</h2><p className="text-[10px] text-slate-400">Configure KOBECARGO preferences</p></div>

      <Card className={G.card}><CardContent className="p-4 space-y-4">
        <h3 className={G.cardHeader + ' flex items-center gap-2'}><Navigation className="w-4 h-4 text-sky-500" />FlightRadar24 Integration</h3>
        <div className="flex items-center justify-between p-3 bg-white/20 rounded-xl">
          <div>
            <div className="text-[11px] font-medium text-slate-700">Enable FlightRadar24</div>
            <div className="text-[10px] text-slate-400">Live flight tracking data</div>
          </div>
          <button onClick={() => setFr24Enabled(!fr24Enabled)} className={`w-10 h-5 rounded-full transition-all ${fr24Enabled ? 'bg-blue-500' : 'bg-slate-300'}`}>
            <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${fr24Enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
        {fr24Enabled && (
          <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
            <div className="text-[10px] text-blue-600 font-medium mb-1">API Status</div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] text-slate-500">Connected — fetching live data</span>
            </div>
          </div>
        )}
      </CardContent></Card>

      <Card className={G.card}><CardContent className="p-4 space-y-4">
        <h3 className={G.cardHeader + ' flex items-center gap-2'}><DollarSign className="w-4 h-4 text-emerald-500" />Currency Display</h3>
        <div className="flex gap-2">
          {(['TZS', 'USD', 'BOTH'] as const).map(c => (
            <button key={c} onClick={() => setCurrency(c)} className={`flex-1 py-2 rounded-xl text-[11px] font-medium transition-all border ${currency === c ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'text-slate-400 border-transparent hover:bg-white/20'}`}>
              {c}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-slate-400">Select how currency values are displayed throughout the app.</p>
      </CardContent></Card>

      <Card className={G.card}><CardContent className="p-4 space-y-4">
        <h3 className={G.cardHeader + ' flex items-center gap-2'}><Bell className="w-4 h-4 text-amber-500" />Notifications</h3>
        <div className="flex items-center justify-between p-3 bg-white/20 rounded-xl">
          <div>
            <div className="text-[11px] font-medium text-slate-700">Email Notifications</div>
            <div className="text-[10px] text-slate-400">Receive alerts for customs holds, delays, payments</div>
          </div>
          <button onClick={() => setEmailNotif(!emailNotif)} className={`w-10 h-5 rounded-full transition-all ${emailNotif ? 'bg-blue-500' : 'bg-slate-300'}`}>
            <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${emailNotif ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </CardContent></Card>

      <Card className={G.card}><CardContent className="p-4 space-y-4">
        <h3 className={G.cardHeader + ' flex items-center gap-2'}><Settings className="w-4 h-4 text-slate-500" />Company Information</h3>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Company Name</label>
            <Input defaultValue="KOBECARGO Logistics" className={G.input + ' h-8 text-xs'} />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Default Origin</label>
            <Input defaultValue="Guangzhou (CAN)" className={G.input + ' h-8 text-xs'} />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Default Destination</label>
            <Input defaultValue="Dar es Salaam (DAR)" className={G.input + ' h-8 text-xs'} />
          </div>
        </div>
      </CardContent></Card>

      <div className="flex gap-2">
        <Button onClick={handleSave} className={G.btnPrimary + ' flex-1'}>
          {saved ? <><CheckCircle2 className="w-3.5 h-3.5 mr-1" />Saved</> : 'Save Settings'}
        </Button>
        <Button variant="outline" className={G.btnOutline}>Reset</Button>
      </div>
    </div></div>
  );
}

/* ═══════════════════════════════════════════
   MAIN KOBECARGO COMPONENT
   ═══════════════════════════════════════════ */
export default function KOBECARGO() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [search, setSearch] = useState('');

  const render = (t: Tab) => {
    switch (t) {
      case 'dashboard': return <DashboardTab />;
      case 'shipments': return <ShipmentsTab search={search} />;
      case 'customs': return <CustomsTab search={search} />;
      case 'warehouse': return <WarehouseTab />;
      case 'flights': return <FlightsTab search={search} />;
      case 'delivery': return <DeliveryTab search={search} />;
      case 'payments': return <PaymentsTab />;
      case 'tracking': return <TrackingTab search={search} />;
      case 'analytics': return <AnalyticsTab />;
      case 'settings': return <SettingsTab />;
    }
  };

  return (
    <div className={G.page}>
      {/* Sidebar */}
      <CargoSidebar activeTab={tab} onTabChange={setTab} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <div className="shrink-0 px-4 pt-3 pb-2 flex items-center justify-between gap-3 border-b border-white/[0.30] bg-white/10 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/[0.08] border border-blue-500/15">
              <Plane className="w-3 h-3 text-blue-500" />
              <span className="text-[10px] text-blue-600 font-medium">KOBECARGO</span>
            </div>
          </div>
          <div className="relative w-48 sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input placeholder="Search shipments, AWBs..." value={search} onChange={e => setSearch(e.target.value)} className={G.input + ' h-8 pl-8 text-xs'} />
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {render(tab)}
        </div>
      </div>
    </div>
  );
}
