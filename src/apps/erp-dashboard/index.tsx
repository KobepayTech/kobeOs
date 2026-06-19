import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  TrendingUp, TrendingDown, ShoppingCart, Users, Package, DollarSign,
  Receipt, ShoppingBag, Palette, BarChart3, Store, Warehouse,
  FileText, ShieldCheck, Truck, Heart, UserCircle,
  ChevronRight, Boxes, CircleDollarSign,
  Globe, LayoutDashboard, CreditCard, Percent,
  NotebookPen, Calculator,
} from 'lucide-react';
import { useOSStore } from '@/os/store';
import {
  AreaChart, Area, XAxis as ReXAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';

/* ─── API HOOK ─── */
interface ErpDashboardData {
  kpis: { revenue: number; orders: number; customers: number; lowStock: number; transactions: number };
  monthlyRevenue: { month: string; revenue: number }[];
}

const EMPTY_KPIS: ErpDashboardData['kpis'] = {
  revenue: 0, orders: 0, customers: 0, lowStock: 0, transactions: 0,
};

function normalizeDashboard(raw: unknown): ErpDashboardData {
  const d = (raw && typeof raw === 'object') ? raw as Partial<ErpDashboardData> : {};
  const rawKpis = (d.kpis && typeof d.kpis === 'object') ? d.kpis : {};
  return {
    kpis: { ...EMPTY_KPIS, ...rawKpis },
    monthlyRevenue: Array.isArray(d.monthlyRevenue) ? d.monthlyRevenue : [],
  };
}

function useErpDashboard() {
  const [data, setData] = useState<ErpDashboardData | null>(null);
  useEffect(() => {
    api<unknown>('/erp/dashboard')
      .then((d) => setData(normalizeDashboard(d)))
      .catch(() => {});
  }, []);
  return data;
}

/* ─── FALLBACK STATIC DATA (shown while loading or offline) ─── */
const categoryData = [
  { name: 'Electronics', value: 35 },
  { name: 'Clothing', value: 25 },
  { name: 'Food', value: 20 },
  { name: 'Household', value: 15 },
  { name: 'Other', value: 5 },
];

/* ─── MODULE TILE DATA ─── */
interface ModuleTile {
  id: string;
  appId: string;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  border: string;
}

const moduleSections = [
  {
    title: 'Overview',
    tiles: [
      { id: 'overview', appId: '', label: 'Dashboard', desc: 'Real-time overview', icon: LayoutDashboard, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    ] as ModuleTile[],
  },
  {
    title: 'Sales & Commerce',
    tiles: [
      { id: 'pos', appId: 'erp-pos', label: 'POS System', desc: 'Point of sale & invoicing', icon: Receipt, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
      { id: 'shop', appId: 'erp-shop', label: 'Online Shop', desc: 'Customer storefront', icon: ShoppingBag, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
      { id: 'store', appId: 'erp-store', label: 'Product Manager', desc: 'SKU, inventory & pricing', icon: Store, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
      { id: 'store-editor', appId: 'erp-store-editor', label: 'Store Editor', desc: 'Customize your storefront', icon: Palette, color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
      { id: 'credit', appId: 'erp-credit', label: 'Credit & Collections', desc: 'Customer credit & balances', icon: CreditCard, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
      { id: 'discounts', appId: 'erp-discounts', label: 'Discounts & Promos', desc: 'Rules, campaigns & coupons', icon: Percent, color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20' },
    ] as ModuleTile[],
  },
  {
    title: 'Warehouse & Logistics',
    tiles: [
      { id: 'warehouse', appId: 'erp-warehouse', label: 'Warehouse', desc: 'Stock & storage management', icon: Warehouse, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
      { id: 'shipments', appId: 'erp-shipments', label: 'Shipments', desc: 'Track deliveries & routes', icon: Truck, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
      { id: 'sourcing', appId: 'erp-sourcing', label: 'Sourcing', desc: 'Supplier & procurement', icon: Globe, color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/20' },
    ] as ModuleTile[],
  },
  {
    title: 'Finance & Reports',
    tiles: [
      { id: 'summary', appId: 'erp-summary', label: 'Sales & Expenses', desc: 'Quick-entry summary log', icon: NotebookPen, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
      { id: 'eod', appId: 'erp-eod', label: 'End of Day', desc: 'Count till & close trading day', icon: Calculator, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
      { id: 'accounting', appId: 'erp-accounting', label: 'Accounting', desc: 'Financial records & ledgers', icon: CircleDollarSign, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
      { id: 'reports', appId: 'erp-reports', label: 'Reports', desc: 'Analytics & business insights', icon: FileText, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
      { id: 'loyalty', appId: 'erp-loyalty', label: 'Loyalty Program', desc: 'Customer rewards & points', icon: Heart, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
    ] as ModuleTile[],
  },
  {
    title: 'Administration',
    tiles: [
      { id: 'admin', appId: 'erp-admin', label: 'Admin Panel', desc: 'Users, roles & permissions', icon: ShieldCheck, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
      { id: 'rider', appId: 'erp-rider', label: 'Rider Manager', desc: 'Delivery personnel', icon: UserCircle, color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20' },
    ] as ModuleTile[],
  },
];

/* ─── SIDEBAR WITH TILE GRID ─── */
function Sidebar({ activeModule, onModuleChange, launchApp }: {
  activeModule: string;
  onModuleChange: (id: string) => void;
  launchApp: (appId: string) => void;
}) {
  return (
    <div className="w-72 h-full flex flex-col bg-[#0c0c1a] border-r border-white/[0.06]">
      {/* Header */}
      <div className="shrink-0 px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <BarChart3 className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white/90">KOBE ERP</h1>
            <p className="text-[9px] text-white/30">Enterprise Suite v1.0</p>
          </div>
        </div>
      </div>

      {/* Tile Grid Navigation */}
      <div className="flex-1 overflow-y-auto py-3">
        <div className="px-4 space-y-5">
          {moduleSections.map((section) => (
            <div key={section.title}>
              <div className="px-1 mb-2 text-[10px] font-semibold text-white/25 uppercase tracking-widest">
                {section.title}
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {section.tiles.map((tile) => {
                  const isActive = activeModule === tile.id;
                  return (
                    <button
                      key={tile.id}
                      onClick={() => {
                        onModuleChange(tile.id);
                        if (tile.appId) launchApp(tile.appId);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all group ${
                        isActive
                          ? `${tile.bg} border ${tile.border} shadow-sm`
                          : 'bg-white/[0.02] border border-transparent hover:bg-white/[0.05] hover:border-white/[0.06]'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg ${tile.bg} flex items-center justify-center shrink-0 transition-transform group-hover:scale-105`}>
                        <tile.icon className={`w-[18px] h-[18px] ${tile.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-[12px] font-medium ${isActive ? 'text-white/90' : 'text-white/70 group-hover:text-white/90'}`}>
                          {tile.label}
                        </div>
                        <div className="text-[10px] text-white/30 truncate">
                          {tile.desc}
                        </div>
                      </div>
                      <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-all ${isActive ? `${tile.color} opacity-100` : 'text-white/15 opacity-0 group-hover:opacity-100'}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 px-5 py-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">A</span>
          </div>
          <div>
            <div className="text-[11px] font-medium text-white/70">Admin User</div>
            <div className="text-[9px] text-white/30">Super Admin</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── MAIN CONTENT: DASHBOARD OVERVIEW ─── */
function DashboardOverview({ launchApp }: { launchApp: (appId: string) => void }) {
  const erpData = useErpDashboard();
  return (
    <div className="p-5 space-y-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white/90">Dashboard</h2>
          <p className="text-xs text-slate-500">Real-time business overview</p>
        </div>
        <div className="flex items-center gap-2">
          {['7d', '30d', '90d'].map((p) => (
            <button
              key={p}
              className="h-7 px-3 text-[11px] rounded-lg bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-white transition-all"
            >
              {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : 'Quarter'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Sales', value: erpData ? `TZS ${(erpData.kpis.revenue / 1000).toFixed(0)}K` : '…', up: true, icon: DollarSign },
          { label: 'Orders', value: erpData ? String(erpData.kpis.orders) : '…', up: true, icon: ShoppingCart },
          { label: 'Customers', value: erpData ? String(erpData.kpis.customers) : '…', up: true, icon: Users },
          { label: 'Low Stock', value: erpData ? String(erpData.kpis.lowStock) : '…', up: erpData ? erpData.kpis.lowStock === 0 : true, icon: Package },
        ].map((kpi) => (
          <Card key={kpi.label} className="bg-[#13131f] border-white/[0.06] hover:border-white/[0.1] transition-colors">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-slate-500 font-medium">{kpi.label}</span>
                <kpi.icon className="w-4 h-4 text-slate-600" />
              </div>
              <div className="text-lg font-semibold text-white/90">{kpi.value}</div>
              <div className={`flex items-center gap-1 mt-1 text-[10px] ${kpi.up ? 'text-emerald-400' : 'text-red-400'}`}>
                {kpi.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {kpi.up ? 'Live' : 'Needs attention'}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Launch Modules */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Boxes className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Quick Launch Modules</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {[
            { appId: 'erp-pos', label: 'POS System', desc: 'Point of sale', icon: Receipt, color: 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25', border: 'border-amber-500/20 hover:border-amber-500/40' },
            { appId: 'erp-shop', label: 'Online Shop', desc: 'Customer storefront', icon: ShoppingBag, color: 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/25', border: 'border-blue-500/20 hover:border-blue-500/40' },
            { appId: 'erp-warehouse', label: 'Warehouse', desc: 'Stock management', icon: Warehouse, color: 'bg-orange-500/15 text-orange-400 hover:bg-orange-500/25', border: 'border-orange-500/20 hover:border-orange-500/40' },
            { appId: 'erp-accounting', label: 'Accounting', desc: 'Financial records', icon: CircleDollarSign, color: 'bg-green-500/15 text-green-400 hover:bg-green-500/25', border: 'border-green-500/20 hover:border-green-500/40' },
            { appId: 'erp-reports', label: 'Reports', desc: 'Analytics & insights', icon: FileText, color: 'bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25', border: 'border-indigo-500/20 hover:border-indigo-500/40' },
            { appId: 'erp-admin', label: 'Admin Panel', desc: 'System settings', icon: ShieldCheck, color: 'bg-red-500/15 text-red-400 hover:bg-red-500/25', border: 'border-red-500/20 hover:border-red-500/40' },
            { appId: 'erp-store-editor', label: 'Store Editor', desc: 'Customize storefront', icon: Palette, color: 'bg-violet-500/15 text-violet-400 hover:bg-violet-500/25', border: 'border-violet-500/20 hover:border-violet-500/40' },
            { appId: 'erp-shipments', label: 'Shipments', desc: 'Delivery tracking', icon: Truck, color: 'bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25', border: 'border-cyan-500/20 hover:border-cyan-500/40' },
            { appId: 'erp-credit', label: 'Credit & Collections', desc: 'Customer balances', icon: CreditCard, color: 'bg-red-500/15 text-red-400 hover:bg-red-500/25', border: 'border-red-500/20 hover:border-red-500/40' },
            { appId: 'erp-discounts', label: 'Discounts & Promos', desc: 'Rules & coupons', icon: Percent, color: 'bg-pink-500/15 text-pink-400 hover:bg-pink-500/25', border: 'border-pink-500/20 hover:border-pink-500/40' },
          ].map((mod) => (
            <button
              key={mod.appId}
              onClick={() => launchApp(mod.appId)}
              className={`group flex items-center gap-3 p-3 rounded-xl bg-[#13131f] border ${mod.border} transition-all text-left hover:scale-[1.02] active:scale-[0.98]`}
            >
              <div className={`w-10 h-10 rounded-lg ${mod.color} flex items-center justify-center shrink-0 transition-colors`}>
                <mod.icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-white/90">{mod.label}</div>
                <div className="text-[10px] text-white/30">{mod.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="lg:col-span-2 bg-[#13131f] border-white/[0.06]">
          <CardContent className="p-3">
            <h3 className="text-xs font-medium text-white/80 mb-3">Sales Trend</h3>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={erpData?.monthlyRevenue ?? []}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <ReXAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '11px' }}
                  itemStyle={{ color: '#94a3b8' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="url(#salesGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-[#13131f] border-white/[0.06]">
          <CardContent className="p-3">
            <h3 className="text-xs font-medium text-white/80 mb-3">By Category</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={categoryData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                <ReXAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} width={70} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '11px' }}
                  itemStyle={{ color: '#94a3b8' }}
                />
                <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Orders + Inventory */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="bg-[#13131f] border-white/[0.06]">
          <CardContent className="p-3">
            <h3 className="text-xs font-medium text-white/80 mb-3">Revenue Trend</h3>
            <div className="space-y-2">
              {(erpData?.monthlyRevenue ?? []).map((m) => (
                <div key={m.month} className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.03]">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                    <Receipt className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium text-white/80">{m.month}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[11px] font-medium text-white/80">TZS {(m.revenue / 1000).toFixed(0)}K</div>
                    <div className="text-[10px] text-emerald-400">revenue</div>
                  </div>
                </div>
              ))}
              {!erpData && <div className="text-[11px] text-white/20 text-center py-4">Loading…</div>}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#13131f] border-white/[0.06]">
          <CardContent className="p-3">
            <h3 className="text-xs font-medium text-white/80 mb-3">Low Stock Alerts</h3>
            <div className="space-y-2">
              {(erpData?.kpis.lowStock ?? 0) === 0 && (
                <div className="text-[11px] text-emerald-400 text-center py-4">All items stocked ✓</div>
              )}
              {!erpData && <div className="text-[11px] text-white/20 text-center py-4">Loading…</div>}
              {erpData && erpData.kpis.lowStock > 0 && (
                <div className="flex items-center gap-3 p-2 rounded-lg bg-red-500/5 border border-red-500/10">
                  <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4 text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium text-red-400">{erpData.kpis.lowStock} items below reorder level</div>
                    <div className="text-[10px] text-white/30">Check Sourcing module</div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="text-center text-[10px] text-white/10 pt-2 pb-4">
        KOBE ERP v1.0 &middot; All modules accessible via sidebar
      </div>
    </div>
  );
}

/* ─── MAIN ERP DASHBOARD WITH SIDEBAR ─── */
export default function ERPDashboard() {
  const [activeModule, setActiveModule] = useState('overview');
  const launchApp = useOSStore((s) => s.launchApp);

  return (
    <div className="h-full flex bg-[#0a0a1a] text-white/90">
      {/* Left Sidebar - Tile Grid */}
      <Sidebar activeModule={activeModule} onModuleChange={setActiveModule} launchApp={launchApp} />

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {activeModule === 'overview' ? (
          <DashboardOverview launchApp={launchApp} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-4">
              <Boxes className="w-8 h-8 text-white/20" />
            </div>
            <h3 className="text-sm font-medium text-white/50 mb-1">Module Launched</h3>
            <p className="text-[11px] text-white/30 max-w-xs">
              The module window has opened separately. Check your taskbar or desktop for the new window.
            </p>
            <button
              onClick={() => setActiveModule('overview')}
              className="mt-4 px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] text-white/50 hover:text-white/80 hover:bg-white/[0.08] transition-all"
            >
              Back to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
