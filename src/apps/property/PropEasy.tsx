import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import {
  Home, Building2, Users, DollarSign, Wrench, FileText, Settings, LogOut,
  Search, Bell, ChevronDown, Plus, ArrowLeft, ArrowRight,
  Info, Pencil, Trash2, Filter, Columns3, ChevronRight, MoreHorizontal,
  FileDown, ShieldCheck, X,
  Image as ImageIcon, Smile,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

/**
 * PropEasy — property-management UI for KobeOS, matching the requested
 * mockups (light theme, blue accents, sidebar + topbar shell, tenants
 * table, tenant detail, dashboard with KPI cards / requests / lease
 * status / activity feed).
 *
 * Wired to existing backend:
 *   GET  /property/properties
 *   GET  /property/units
 *   GET  /property/tenants
 *   GET  /property/payments
 *   POST /property/payments
 *
 * When the backend is reachable rows reflect live data; otherwise demo
 * fixtures keep the screens populated so the design renders cleanly.
 */

/* ────────────────────────────── Types ────────────────────────────── */

type View = 'dashboard' | 'properties' | 'tenants' | 'tenant-detail' | 'screening' | 'financials' | 'maintenance' | 'documents' | 'settings';
type TenantStatus = 'rent_paid' | 'overdue' | 'late_fees' | 'in_proceed';
type UnitKind = 'House' | 'Apartment' | 'Duplex' | 'Studio';

interface ApiProperty   { id: string; name: string; address: string; imageUrl?: string }
interface ApiUnit       { id: string; propertyId: string; kind?: UnitKind; rent?: number }
interface ApiTenant     {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  unitId?: string;
  propertyName?: string;
  propertyAddress?: string;
  unitKind?: UnitKind;
  rent?: number;
  balance?: number;
  status?: TenantStatus;
  avatarUrl?: string;
  occupation?: string;
  emergencyPhone?: string;
  currentAddress?: string;
  leaseStart?: string;
  leaseEnd?: string;
  paymentTerms?: 'Monthly' | 'Quarterly' | 'Annual';
  leaseDocUrl?: string;
  guarantorName?: string;
  allottedParking?: string;
  accessCardNo?: string;
}
interface ApiPayment   { id: string; tenantId: string; amount: number; method?: string; status?: 'Paid' | 'Overdue' | 'Pending'; paidAt?: string }
interface MaintenanceRequest {
  id: string;
  tenantId: string;
  date: string;
  description: string;
  status: 'Pending' | 'In Progress' | 'Completed';
  priority: 'Low' | 'Normal' | 'High';
}

/* ────────────────────────────── Demo data fallback ────────────────────────────── */

const DEMO_TENANTS: ApiTenant[] = [
  { id: 't1', name: 'Caitlin Robles',     phone: '+44 9999 999 999', email: 'caitlin@example.com', propertyName: 'Tavares Cliffs', propertyAddress: '089 Grant Overpass', unitKind: 'House',     rent: 5000, balance: 5000, status: 'overdue',    avatarUrl: 'https://i.pravatar.cc/64?img=1' },
  { id: 't2', name: 'Justin Moon',        phone: '+44 9999 999 998', email: 'justin@example.com',   propertyName: 'Tavares Cliffs', propertyAddress: '089 Grant Overpass', unitKind: 'Apartment', rent: 5000, balance: 0,    status: 'rent_paid',  avatarUrl: 'https://i.pravatar.cc/64?img=12' },
  { id: 't3', name: 'Kody Spence',        phone: '+44 9999 999 997', email: 'kody@example.com',     propertyName: 'Tavares Cliffs', propertyAddress: '089 Grant Overpass', unitKind: 'Duplex',    rent: 5000, balance: 5000, status: 'late_fees',  avatarUrl: 'https://i.pravatar.cc/64?img=13' },
  { id: 't4', name: 'Wendy Mullins',      phone: '+44 9999 999 996', email: 'wendy@example.com',    propertyName: 'Tavares Cliffs', propertyAddress: '089 Grant Overpass', unitKind: 'House',     rent: 5000, balance: 2500, status: 'in_proceed', avatarUrl: 'https://i.pravatar.cc/64?img=5' },
  { id: 't5', name: 'Jude Goodman',       phone: '+44 9999 999 995', email: 'jude@example.com',     propertyName: 'Tavares Cliffs', propertyAddress: '089 Grant Overpass', unitKind: 'Apartment', rent: 5000, balance: 0,    status: 'rent_paid',  avatarUrl: 'https://i.pravatar.cc/64?img=15' },
  { id: 't6', name: 'Emmy Witt',          phone: '+44 9999 999 994', email: 'emmy@example.com',     propertyName: 'Tavares Cliffs', propertyAddress: '089 Grant Overpass', unitKind: 'Duplex',    rent: 5000, balance: 5000, status: 'overdue',    avatarUrl: 'https://i.pravatar.cc/64?img=16' },
  { id: 't7', name: 'Brock Ray',          phone: '+44 9999 999 993', email: 'brock@example.com',    propertyName: 'Tavares Cliffs', propertyAddress: '089 Grant Overpass', unitKind: 'House',     rent: 5000, balance: 5000, status: 'late_fees',  avatarUrl: 'https://i.pravatar.cc/64?img=17' },
  { id: 't8', name: 'Desiree Chapman',    phone: '+44 9999 999 992', email: 'desiree@example.com',  propertyName: 'Tavares Cliffs', propertyAddress: '089 Grant Overpass', unitKind: 'Duplex',    rent: 5000, balance: 0,    status: 'rent_paid',  avatarUrl: 'https://i.pravatar.cc/64?img=20' },
  { id: 't9',  name: 'Jake Hicks',         phone: '+44 9999 999 991', email: 'jake@example.com',     propertyName: 'Tavares Cliffs', propertyAddress: '089 Grant Overpass', unitKind: 'House',     rent: 5000, balance: 5000, status: 'overdue',    avatarUrl: 'https://i.pravatar.cc/64?img=33' },
  { id: 't10', name: 'Jesse Waters',       phone: '+44 9999 999 990', email: 'jesse@example.com',    propertyName: 'Tavares Cliffs', propertyAddress: '089 Grant Overpass', unitKind: 'Apartment', rent: 5000, balance: 5000, status: 'overdue',    avatarUrl: 'https://i.pravatar.cc/64?img=14' },
  { id: 't11', name: 'Bernice Lopez',      phone: '+44 9999 999 989', email: 'bernice@example.com',  propertyName: 'Tavares Cliffs', propertyAddress: '089 Grant Overpass', unitKind: 'Apartment', rent: 5000, balance: 0,    status: 'rent_paid',  avatarUrl: 'https://i.pravatar.cc/64?img=22' },
  { id: 't12', name: 'Owen Bishop',        phone: '+44 9999 999 988', email: 'owen@example.com',     propertyName: 'Tavares Cliffs', propertyAddress: '089 Grant Overpass', unitKind: 'House',     rent: 5000, balance: 2500, status: 'in_proceed', avatarUrl: 'https://i.pravatar.cc/64?img=51' },
  { id: 't13', name: 'Hazel Drake',        phone: '+44 9999 999 987', email: 'hazel@example.com',    propertyName: 'Tavares Cliffs', propertyAddress: '089 Grant Overpass', unitKind: 'Duplex',    rent: 5000, balance: 0,    status: 'rent_paid',  avatarUrl: 'https://i.pravatar.cc/64?img=36' },
  { id: 't14', name: 'Marcus Holt',        phone: '+44 9999 999 986', email: 'marcus@example.com',   propertyName: 'Tavares Cliffs', propertyAddress: '089 Grant Overpass', unitKind: 'House',     rent: 5000, balance: 5000, status: 'late_fees',  avatarUrl: 'https://i.pravatar.cc/64?img=58' },
  { id: 't15', name: 'Felicia Stone',      phone: '+44 9999 999 985', email: 'felicia@example.com',  propertyName: 'Tavares Cliffs', propertyAddress: '089 Grant Overpass', unitKind: 'Apartment', rent: 5000, balance: 0,    status: 'rent_paid',  avatarUrl: 'https://i.pravatar.cc/64?img=44' },
  { id: 't16', name: 'Roy Mendez',         phone: '+44 9999 999 984', email: 'roy@example.com',      propertyName: 'Tavares Cliffs', propertyAddress: '089 Grant Overpass', unitKind: 'Duplex',    rent: 5000, balance: 5000, status: 'overdue',    avatarUrl: 'https://i.pravatar.cc/64?img=11' },
  { id: 't17', name: 'Priya Sharma',       phone: '+44 9999 999 983', email: 'priya@example.com',    propertyName: 'Tavares Cliffs', propertyAddress: '089 Grant Overpass', unitKind: 'House',     rent: 5000, balance: 0,    status: 'rent_paid',  avatarUrl: 'https://i.pravatar.cc/64?img=47' },
  { id: 't18', name: 'Lukas Vogel',        phone: '+44 9999 999 982', email: 'lukas@example.com',    propertyName: 'Tavares Cliffs', propertyAddress: '089 Grant Overpass', unitKind: 'Apartment', rent: 5000, balance: 5000, status: 'late_fees',  avatarUrl: 'https://i.pravatar.cc/64?img=60' },
  { id: 't19', name: 'Amaya Cole',         phone: '+44 9999 999 981', email: 'amaya@example.com',    propertyName: 'Tavares Cliffs', propertyAddress: '089 Grant Overpass', unitKind: 'House',     rent: 5000, balance: 0,    status: 'rent_paid',  avatarUrl: 'https://i.pravatar.cc/64?img=29' },
  { id: 't20', name: 'Theo Reed',          phone: '+44 9999 999 980', email: 'theo@example.com',     propertyName: 'Tavares Cliffs', propertyAddress: '089 Grant Overpass', unitKind: 'Duplex',    rent: 5000, balance: 0,    status: 'rent_paid',  avatarUrl: 'https://i.pravatar.cc/64?img=53' },
];

const DEMO_MAINTENANCE: MaintenanceRequest[] = [
  { id: 'm1', tenantId: 't1', date: '23-06-20', description: 'Leaky faucet in kitchen', status: 'Pending',     priority: 'High'   },
  { id: 'm2', tenantId: 't1', date: '23-06-20', description: 'Broken AC unit in bedroom', status: 'In Progress', priority: 'Normal' },
  { id: 'm3', tenantId: 't1', date: '23-06-20', description: 'Broken garage door opener', status: 'Pending',     priority: 'Normal' },
];

const DEMO_PAYMENTS: ApiPayment[] = [
  { id: 'p1', tenantId: 't1', amount: 5000, paidAt: '2024-06-23', method: 'Online', status: 'Overdue' },
  { id: 'p2', tenantId: 't1', amount: 5000, paidAt: '2024-05-23', method: 'Check',  status: 'Paid' },
];

/* ────────────────────────────── Helpers ────────────────────────────── */

const initials = (name: string) => name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();

function statusPill(status: TenantStatus) {
  switch (status) {
    case 'rent_paid':  return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700">Rent Paid</span>;
    case 'overdue':    return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700">Overdue</span>;
    case 'late_fees':  return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700">Late fees</span>;
    case 'in_proceed': return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700">In Proceed</span>;
  }
}

function priorityChip(p: MaintenanceRequest['priority']) {
  const cls =
    p === 'High'   ? 'text-rose-600'    :
    p === 'Normal' ? 'text-slate-700'   :
                     'text-slate-400';
  return <span className={`text-xs font-semibold ${cls}`}>{p}</span>;
}

function maintenanceStatusPill(s: MaintenanceRequest['status']) {
  switch (s) {
    case 'Pending':     return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700">Pending</span>;
    case 'In Progress': return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700">In Progress</span>;
    case 'Completed':   return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">Completed</span>;
  }
}

/* ════════════════════════════════════════════════════════════════════
   Main shell
   ══════════════════════════════════════════════════════════════════ */

export default function PropEasyApp() {
  const [view, setView] = useState<View>('tenants');
  const [selectedTenant, setSelectedTenant] = useState<ApiTenant | null>(null);

  const [tenants, setTenants] = useState<ApiTenant[]>(DEMO_TENANTS);
  const [payments, setPayments] = useState<ApiPayment[]>(DEMO_PAYMENTS);
  const [properties, setProperties] = useState<ApiProperty[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [t, p, props] = await Promise.all([
          api<ApiTenant[]>('/property/tenants').catch(() => [] as ApiTenant[]),
          api<ApiPayment[]>('/property/payments').catch(() => [] as ApiPayment[]),
          api<ApiProperty[]>('/property/properties').catch(() => [] as ApiProperty[]),
        ]);
        if (cancelled) return;
        if (t.length) setTenants(t);
        if (p.length) setPayments(p);
        setProperties(props);
      } catch { /* demo data stays */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const openTenant = (t: ApiTenant) => { setSelectedTenant(t); setView('tenant-detail'); };
  const openScreening = (t: ApiTenant) => { setSelectedTenant(t); setView('screening'); };

  return (
    <div className="flex h-full w-full bg-slate-50 text-slate-900" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <Sidebar view={view} onChange={setView} onInviteTenant={() => setView('tenants')} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title={titleFor(view)} />
        <div className="flex-1 overflow-y-auto p-6">
          {view === 'dashboard'     && <DashboardView tenants={tenants} payments={payments} properties={properties} onOpenTenant={openTenant} />}
          {view === 'tenants'       && <TenantsView tenants={tenants} onPick={openTenant} />}
          {view === 'tenant-detail' && selectedTenant && (
            <TenantDetailView
              tenant={selectedTenant}
              payments={payments.filter((p) => p.tenantId === selectedTenant.id)}
              maintenance={DEMO_MAINTENANCE.filter((m) => m.tenantId === selectedTenant.id)}
              onBack={() => setView('tenants')}
              onScreen={() => openScreening(selectedTenant)}
            />
          )}
          {view === 'screening'   && selectedTenant && (
            <ScreeningView tenant={selectedTenant} onBack={() => setView('tenant-detail')} />
          )}
          {view === 'properties'  && <EmptyState title="Properties" subtitle="Buildings, units, and floor plans live here." />}
          {view === 'financials'  && <EmptyState title="Financials" subtitle="Rent roll, expenses, P&L, exports." />}
          {view === 'maintenance' && <EmptyState title="Maintenance" subtitle="Work orders across every unit." />}
          {view === 'documents'   && <EmptyState title="Documents" subtitle="Leases, IDs, insurance, inspections." />}
          {view === 'settings'    && <EmptyState title="Settings" subtitle="Reminders, late-fee policy, integrations." />}
        </div>
      </div>
    </div>
  );
}

function titleFor(v: View): string {
  switch (v) {
    case 'dashboard':     return 'Dashboard';
    case 'properties':    return 'Properties';
    case 'tenants':       return 'Tenants';
    case 'tenant-detail': return 'Tenants';
    case 'screening':     return 'Tenants';
    case 'financials':    return 'Financials';
    case 'maintenance':   return 'Maintenance';
    case 'documents':     return 'Documents';
    case 'settings':      return 'Settings';
  }
}

/* ────────────────────────────── Sidebar ────────────────────────────── */

function Sidebar({ view, onChange, onInviteTenant }: { view: View; onChange: (v: View) => void; onInviteTenant: () => void }) {
  const items: Array<{ id: View; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'dashboard',   label: 'Dashboard',   icon: Home },
    { id: 'properties',  label: 'Properties',  icon: Building2 },
    { id: 'tenants',     label: 'Tenants',     icon: Users },
    { id: 'financials',  label: 'Financials',  icon: DollarSign },
    { id: 'maintenance', label: 'Maintenance', icon: Wrench },
    { id: 'documents',   label: 'Documents',   icon: FileText },
    { id: 'settings',    label: 'Settings',    icon: Settings },
  ];
  return (
    <aside className="w-56 shrink-0 bg-white m-4 mr-0 rounded-2xl p-4 flex flex-col">
      <div className="flex items-center gap-2 px-2 pb-4 mb-2">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-600">
          <Home className="w-4 h-4" />
        </span>
        <span className="font-extrabold text-lg">
          <span className="text-blue-600">Prop</span>Easy
        </span>
      </div>

      {/* Invite-new-tenant pill — mirrors the IRES dashboard's CTA so a
          new tenant can be invited from any screen, not just Tenants. */}
      <button
        onClick={onInviteTenant}
        className="flex items-center justify-between gap-2 px-3 py-2 mb-4 rounded-full bg-slate-50 hover:bg-amber-50 border border-transparent hover:border-amber-200 text-sm text-slate-700 font-medium transition-colors"
      >
        <span className="leading-tight text-xs">
          Invite new<br />Tenant
        </span>
        <span className="w-7 h-7 rounded-full bg-amber-400 text-amber-900 inline-flex items-center justify-center">
          <Plus className="w-3.5 h-3.5" />
        </span>
      </button>

      <nav className="flex flex-col gap-1 flex-1">
        {items.map(({ id, label, icon: Icon }) => {
          const active = view === id || ((view === 'tenant-detail' || view === 'screening') && id === 'tenants');
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm font-medium transition-colors
                ${active ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          );
        })}
      </nav>

      {/* Operator profile card — keeps the IRES-style "Sarah Bano · Profile
          Setting" affordance inside the app's own sidebar so it survives
          screen captures even when the OS chrome isn't visible. */}
      <div className="mt-3 mb-2 rounded-xl bg-amber-100/70 px-3 py-2 flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shrink-0" />
        <div className="flex-1 min-w-0 text-xs">
          <div className="font-bold leading-tight truncate">Courtney Henry</div>
          <div className="text-amber-900/70 text-[10px]">Profile Setting</div>
        </div>
        <button
          onClick={() => onChange('settings')}
          className="w-6 h-6 rounded-full bg-white/60 hover:bg-white inline-flex items-center justify-center text-amber-700"
          title="Notifications & settings"
        >
          <Bell className="w-3 h-3" />
        </button>
      </div>

      <button className="flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm font-medium text-slate-600 hover:bg-slate-50">
        <LogOut className="w-4 h-4" /> Log Out
      </button>
    </aside>
  );
}

/* ────────────────────────────── Topbar ────────────────────────────── */

function TopBar({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-3">
      <h1 className="text-xl font-bold text-slate-900">{title}</h1>
      <div className="flex items-center gap-3">
        <button className="relative w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-500 shadow-sm border border-slate-200">
          <Bell className="w-4 h-4" />
          <span className="absolute top-2 right-2.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white" />
        </button>
        <div className="flex items-center gap-2.5 pr-1">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500" />
          <div className="text-xs leading-tight">
            <div className="font-semibold">Courtney Henry</div>
            <div className="text-slate-400 text-[10px]">courtney@example.com</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   Tenants view (mockup 1)
   ══════════════════════════════════════════════════════════════════ */

function TenantsView({ tenants, onPick }: { tenants: ApiTenant[]; onPick: (t: ApiTenant) => void }) {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'all' | 'requests'>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter((t) =>
      t.name.toLowerCase().includes(q) ||
      (t.propertyName ?? '').toLowerCase().includes(q) ||
      (t.email ?? '').toLowerCase().includes(q),
    );
  }, [tenants, search]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tenants"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-sm placeholder:text-slate-400 focus:outline-none focus:border-blue-400"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1">
            <button
              onClick={() => setTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${tab === 'all' ? 'bg-slate-50 text-slate-900' : 'text-slate-500'}`}
            >
              <Users className="w-3.5 h-3.5" /> All Tenants
            </button>
            <button
              onClick={() => setTab('requests')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${tab === 'requests' ? 'bg-slate-50 text-slate-900' : 'text-slate-500'}`}
            >
              <Plus className="w-3.5 h-3.5" /> Tenant Requests
            </button>
          </div>
          <button className="px-3.5 py-2 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-500 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Tenant
          </button>
          <button className="w-9 h-9 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900">
            <Filter className="w-4 h-4" />
          </button>
          <button className="w-9 h-9 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900">
            <Columns3 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-500 text-xs">
              <Th>No</Th>
              <Th>Image</Th>
              <Th sortable>Name</Th>
              <Th sortable>Property Name</Th>
              <Th sortable>Property Address</Th>
              <Th sortable>Contact Details</Th>
              <Th sortable>Rent</Th>
              <Th sortable>Status</Th>
              <Th>Action</Th>
            </tr>
          </thead>
          <tbody>
            {visible.map((t, i) => (
              <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50/60 cursor-pointer" onClick={() => onPick(t)}>
                <Td className="text-slate-400">{(page - 1) * pageSize + i + 1}</Td>
                <Td>
                  {t.avatarUrl ? (
                    <img src={t.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 text-white text-[11px] font-bold flex items-center justify-center">
                      {initials(t.name)}
                    </div>
                  )}
                </Td>
                <Td className="font-semibold">{t.name}</Td>
                <Td>{t.propertyName ?? '—'}</Td>
                <Td>{t.propertyAddress ?? '—'}</Td>
                <Td>{t.unitKind ?? '—'}</Td>
                <Td>${(t.rent ?? 0).toLocaleString()}/month</Td>
                <Td>{t.status ? statusPill(t.status) : null}</Td>
                <Td>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Info     className="w-4 h-4 hover:text-blue-600"   onClick={(e) => { e.stopPropagation(); onPick(t); }} />
                    <Pencil   className="w-4 h-4 hover:text-emerald-600" onClick={(e) => e.stopPropagation()} />
                    <Trash2   className="w-4 h-4 hover:text-rose-600"    onClick={(e) => e.stopPropagation()} />
                  </div>
                </Td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={9} className="text-center text-slate-400 py-8 text-sm">No tenants match that search.</td></tr>
            )}
          </tbody>
        </table>

        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            Rows Per Page
            <div className="flex items-center gap-1 bg-slate-50 rounded-md px-2 py-1 font-semibold text-slate-700">
              {pageSize} <ChevronDown className="w-3 h-3" />
            </div>
          </div>
          <Pagination current={page} total={pages} onChange={setPage} />
        </div>
      </div>
    </div>
  );
}

function Pagination({ current, total, onChange }: { current: number; total: number; onChange: (p: number) => void }) {
  const cells: Array<number | '…'> = [];
  if (total <= 7) for (let i = 1; i <= total; i++) cells.push(i);
  else {
    cells.push(1, 2, 3, 4, 5);
    if (current > 6) cells.push('…');
    cells.push(total);
  }
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => onChange(Math.max(1, current - 1))} className="w-7 h-7 rounded-md border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900">
        <ArrowLeft className="w-3 h-3" />
      </button>
      {cells.map((c, i) =>
        c === '…' ? (
          <span key={`d${i}`} className="px-1 text-slate-400">…</span>
        ) : (
          <button
            key={c}
            onClick={() => onChange(c)}
            className={`w-7 h-7 rounded-md text-xs font-semibold ${current === c ? 'bg-blue-600 text-white' : 'border border-slate-200 text-slate-500 hover:text-slate-900'}`}
          >
            {c}
          </button>
        ),
      )}
      <button onClick={() => onChange(Math.min(total, current + 1))} className="w-7 h-7 rounded-md border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900">
        <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   Tenant Detail view (mockup 2)
   ══════════════════════════════════════════════════════════════════ */

function TenantDetailView({
  tenant, payments, maintenance, onBack, onScreen,
}: { tenant: ApiTenant; payments: ApiPayment[]; maintenance: MaintenanceRequest[]; onBack: () => void; onScreen: () => void }) {
  const rentPaid = tenant.balance === 0;
  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 text-xs">
        <button onClick={onBack} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
        <button onClick={onBack} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900">
          <Home className="w-3.5 h-3.5" /> Tenants
        </button>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="flex items-center gap-1.5 text-blue-600 font-semibold">
          <Home className="w-3.5 h-3.5" /> Tenant Details
        </span>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-start justify-between mb-5">
          <h2 className="text-lg font-bold">Tenant Details</h2>
          <button
            onClick={onScreen}
            className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-amber-900 text-xs font-bold flex items-center gap-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5" /> View Screening Report
          </button>
        </div>

        {/* Tenant header */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-3">
            {tenant.avatarUrl ? (
              <img src={tenant.avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover ring-2 ring-emerald-300" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white font-bold flex items-center justify-center">
                {initials(tenant.name)}
              </div>
            )}
            <div>
              <div className="font-semibold">{tenant.name}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-500">Rent Details</span>
            <span className="text-2xl font-extrabold">${(tenant.rent ?? 0).toLocaleString()}<span className="text-sm text-slate-400 font-medium">/month</span></span>
            {rentPaid
              ? <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700">Paid</span>
              : <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700">Overdue</span>}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
          {/* Left column */}
          <div className="space-y-5">
            <Section title="Personal Details">
              <KeyValuePair label="Contact No.">{tenant.phone || '—'}</KeyValuePair>
              <KeyValuePair label="Emergency No.">{tenant.emergencyPhone || '+44 9999 999 999'}</KeyValuePair>
              <KeyValuePair label="Email Id">{tenant.email || '—'}</KeyValuePair>
              <KeyValuePair label="Current Address">{tenant.currentAddress || '9865 Aurore Expressway'}</KeyValuePair>
              <KeyValuePair label="Occupation">{tenant.occupation || 'Sr. UX/UI Designer'}</KeyValuePair>
            </Section>

            <Section title="Lease Agreement">
              <div className="grid grid-cols-2 gap-x-6">
                <div>
                  <KeyValuePair label="Start Date">{tenant.leaseStart || '21 June 2023'}</KeyValuePair>
                  <KeyValuePair label="End Date">{tenant.leaseEnd || '21 June 2024'}</KeyValuePair>
                  <KeyValuePair label="Payment terms">{tenant.paymentTerms || 'Monthly'}</KeyValuePair>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500 mb-1.5">Lease document :</div>
                  <a href={tenant.leaseDocUrl || '#'} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 hover:border-blue-300">
                    <span className="px-1.5 py-0.5 rounded bg-rose-500 text-white text-[9px] font-bold">PDF</span>
                    <div className="text-xs">
                      <div className="font-semibold text-slate-700">Lease_document_{tenant.name.split(' ')[0]}.pdf</div>
                      <div className="text-[10px] text-slate-400">20 MB</div>
                    </div>
                  </a>
                </div>
              </div>
            </Section>

            <Section title="Additional Details">
              <div className="grid grid-cols-2 gap-x-6">
                <div>
                  <KeyValuePair label="Guarantor Name">{tenant.guarantorName || 'Alexa Joseph'}</KeyValuePair>
                  <KeyValuePair label="Allotted Parking">{tenant.allottedParking || '02'}</KeyValuePair>
                  <KeyValuePair label="Occupation">{tenant.occupation || 'Sr. UX/UI Designer'}</KeyValuePair>
                </div>
                <div>
                  <KeyValuePair label="Contact No.">{tenant.phone || '+44 9999 999 999'}</KeyValuePair>
                  <KeyValuePair label="Access Card No.">{tenant.accessCardNo || '9834Y65'}</KeyValuePair>
                </div>
              </div>
            </Section>
          </div>

          {/* Right column — Maintenance + Payments */}
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold">Maintenance Requests</h3>
                <button className="text-[11px] text-blue-600 font-semibold">View All</button>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400">
                      <Th tight>Date</Th>
                      <Th tight>Issue Description</Th>
                      <Th tight>Status</Th>
                      <Th tight>Priority</Th>
                      <Th tight>Action</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(maintenance.length ? maintenance : DEMO_MAINTENANCE).map((m) => (
                      <tr key={m.id} className="border-t border-slate-100">
                        <Td tight>{m.date}</Td>
                        <Td tight className="max-w-[140px] truncate">{m.description}</Td>
                        <Td tight>{maintenanceStatusPill(m.status)}</Td>
                        <Td tight>{priorityChip(m.priority)}</Td>
                        <Td tight>
                          <div className="flex items-center gap-1 text-slate-400">
                            <MoreHorizontal className="w-3.5 h-3.5" />
                            <ArrowRight className="w-3.5 h-3.5" />
                          </div>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold">Payment History</h3>
                <button className="text-[11px] text-blue-600 font-semibold">View All</button>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400">
                      <Th tight>Date</Th>
                      <Th tight>Amount</Th>
                      <Th tight>Payment Method</Th>
                      <Th tight>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(payments.length ? payments : DEMO_PAYMENTS).map((p) => (
                      <tr key={p.id} className="border-t border-slate-100">
                        <Td tight>{(p.paidAt || '').slice(0, 10)}</Td>
                        <Td tight className="font-semibold">${p.amount.toLocaleString()}</Td>
                        <Td tight>{p.method || 'Online'}</Td>
                        <Td tight>
                          {p.status === 'Paid' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700">Paid</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700">Overdue</span>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   Dashboard view (mockup 4 trimmed for current scope)
   ══════════════════════════════════════════════════════════════════ */

function DashboardView({ tenants, payments, properties, onOpenTenant }: { tenants: ApiTenant[]; payments: ApiPayment[]; properties: ApiProperty[]; onOpenTenant: (t: ApiTenant) => void }) {
  // Lease-status cards — use real properties when the operator has data,
  // fall back to the bundled fixtures so the dashboard never renders empty.
  const leaseRows: Array<{ name: string; ending: string; rent: number; daysLeft: number; image: string }> =
    properties.length
      ? properties.slice(0, 3).map((p, i) => ({
          name:     p.name || `Unit ${i + 1}`,
          ending:   '23 Mar 2026',
          rent:     15_000,
          daysLeft: [1, 3, 5][i] ?? 5,
          image:    p.imageUrl || LEASE_STATUS[i]?.image || '',
        }))
      : LEASE_STATUS;
  const collected = payments.filter((p) => p.status === 'Paid').reduce((s, p) => s + p.amount, 0) || 15_000;
  const pending   = payments.filter((p) => p.status !== 'Paid').reduce((s, p) => s + p.amount, 0) || 5_000;
  const total     = collected + pending;
  const occupied  = tenants.length || 110;
  const vacant    = Math.max(0, 200 - occupied) || 34;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
      {/* ─── Main column ─────────────────────────────────────────── */}
      <div className="space-y-4">
        {/* Big metric strip with pie chart + pay-reminder */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto] items-center gap-5">
          <div>
            <div className="text-3xl font-extrabold text-rose-500">${pending.toLocaleString()}</div>
            <div className="text-[10px] tracking-wider text-slate-400 mt-1 uppercase">Pending</div>
            <div className="text-xs text-slate-500 mt-3">{Math.max(1, Math.round(occupied * 0.55))}/200 <span className="text-slate-400">tenants</span></div>
            <AvatarStack tenants={tenants.filter((t) => t.balance && t.balance > 0).slice(0, 5)} extra={Math.max(0, tenants.filter((t) => t.balance && t.balance > 0).length - 5)} />
          </div>

          <div className="relative w-32 h-32 mx-auto">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Collected', value: collected, color: '#10b981' },
                    { name: 'Pending',   value: pending,   color: '#ef4444' },
                  ]}
                  innerRadius={42}
                  outerRadius={56}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  <Cell fill="#10b981" />
                  <Cell fill="#ef4444" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <div className="text-xs text-slate-400 font-medium">March</div>
              <div className="text-sm font-bold mt-0.5">${total.toLocaleString()}</div>
            </div>
          </div>

          <div className="text-right md:text-left">
            <div className="text-3xl font-extrabold">${collected.toLocaleString()}</div>
            <div className="text-[10px] tracking-wider text-slate-400 mt-1 uppercase">Collected</div>
            <div className="text-xs text-slate-500 mt-3">{occupied}/200 <span className="text-slate-400">tenants</span></div>
            <AvatarStack tenants={tenants.filter((t) => !t.balance).slice(0, 5)} extra={Math.max(0, tenants.filter((t) => !t.balance).length - 5)} align="right" />
          </div>

          <div className="bg-amber-400 rounded-2xl p-4 flex flex-col gap-2 min-w-[160px]">
            <Bell className="w-5 h-5 text-amber-900" />
            <div>
              <div className="text-sm font-bold text-amber-900">Pay Reminder</div>
              <div className="text-[11px] text-amber-900/80">Send reminder</div>
            </div>
            <button className="self-start mt-1 px-3 py-1 rounded-full bg-white text-amber-700 text-[11px] font-bold flex items-center gap-1 hover:bg-amber-50">
              REMIND <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Tenant requests + Lease status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm">Tenant Request</h3>
              <button className="text-[11px] text-blue-600 font-semibold">View All</button>
            </div>
            <div className="space-y-2">
              {tenants.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-50">
                  <div className="flex items-center gap-3 min-w-0">
                    {t.avatarUrl
                      ? <img src={t.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
                      : <div className="w-9 h-9 rounded-full bg-slate-300" />}
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{t.name}</div>
                      <div className="text-[11px] text-slate-500 truncate">{t.unitKind} · {t.propertyName}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => onOpenTenant(t)}
                    className="px-3 py-1.5 rounded-full bg-amber-400 hover:bg-amber-300 text-amber-900 text-[11px] font-bold flex items-center gap-1"
                  >
                    VIEW <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm">Lease Status</h3>
              <button className="text-[11px] text-blue-600 font-semibold">View All</button>
            </div>
            <div className="space-y-2">
              {leaseRows.map((l, i) => (
                <div key={i} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50">
                  <div className="w-14 h-14 rounded-lg bg-slate-200 bg-cover bg-center shrink-0" style={{ backgroundImage: `url('${l.image}')` }} />
                  <div className="flex-1 min-w-0 text-xs">
                    <div className="font-semibold text-sm">{l.name}</div>
                    <div className="text-slate-500 flex items-center gap-2">
                      <span>Ending</span><span className="text-slate-700 font-medium">{l.ending}</span>
                    </div>
                    <div className="text-slate-500 flex items-center gap-2">
                      <span>Rent</span><span className="text-slate-700 font-medium">KES {l.rent.toLocaleString()}</span>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${l.daysLeft <= 1 ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
                    {l.daysLeft} {l.daysLeft === 1 ? 'Day' : 'Days'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Right sidebar (Vacant/Occupied, Activity, Alerts) ─────────── */}
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500" />
            <div>
              <div className="font-bold text-sm">Hi Courtney, morning <span className="text-amber-500">👋</span></div>
              <div className="text-[11px] text-slate-400">courtney@example.com</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-xl bg-slate-50 p-3 text-center">
              <div className="text-xl font-extrabold">{vacant}</div>
              <div className="text-[10px] text-slate-500 tracking-wide uppercase mt-0.5">Vacant</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-center">
              <div className="text-xl font-extrabold">{occupied}</div>
              <div className="text-[10px] text-slate-500 tracking-wide uppercase mt-0.5">Occupied</div>
            </div>
          </div>

          <h4 className="font-bold text-sm mb-2">Activity</h4>
          <div className="space-y-2.5">
            {tenants.slice(0, 5).map((t, i) => (
              <div key={t.id} className="flex items-center gap-2.5 text-[11px]">
                {t.avatarUrl
                  ? <img src={t.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                  : <div className="w-7 h-7 rounded-full bg-slate-300 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <span className="font-semibold">{t.name}</span>
                  <span className="text-slate-500"> : January month rent has paid the rent</span>
                </div>
                <span className="text-slate-400 text-[10px]">{2 + i * 2}m</span>
              </div>
            ))}
          </div>

          <h4 className="font-bold text-sm mt-4 mb-2">Alerts</h4>
          <div className="text-[11px] text-slate-500">
            You have <span className="text-rose-500 font-semibold">23 Tenants</span> who are going to complete 1 Yr
          </div>

          <div className="mt-4 rounded-xl bg-slate-50 p-3 flex items-center gap-2 text-xs">
            <Smile className="w-4 h-4 text-emerald-500" />
            <div className="flex-1">
              <div className="font-semibold">Eric Nduku</div>
              <div className="text-[10px] text-slate-500">Say Congratulations</div>
            </div>
            <ArrowRight className="w-3 h-3 text-slate-400" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Lease-status fixtures used by the dashboard right column. */
const LEASE_STATUS: Array<{ name: string; ending: string; rent: number; daysLeft: number; image: string }> = [
  { name: '5BHK Apartment', ending: '23 Mar 2019', rent: 15_000, daysLeft: 1, image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=200&q=80' },
  { name: '2BHK Apartment', ending: '23 Mar 2019', rent: 15_000, daysLeft: 3, image: 'https://images.unsplash.com/photo-1502672023488-70e25813eb80?w=200&q=80' },
  { name: '4BHK Apartment', ending: '23 Mar 2019', rent: 15_000, daysLeft: 5, image: 'https://images.unsplash.com/photo-1494526585095-c41746248156?w=200&q=80' },
];

/* ════════════════════════════════════════════════════════════════════
   Screening Overview (IRES mockup 3)
   ══════════════════════════════════════════════════════════════════ */

interface ScreeningReport {
  rentalHistoryPct: number;
  evictionHistoryPct: number;
  criminalHistoryPct: number;
  creditHistoryPct: number;
  overallScore: number;
  verdict: 'pending' | 'accepted' | 'rejected';
  provider: string;
  reportPdfUrl?: string;
  identityProofUrl?: string;
}

function ScreeningView({ tenant, onBack }: { tenant: ApiTenant; onBack: () => void }) {
  const [report, setReport] = useState<ScreeningReport | null>(null);
  const [deciding, setDeciding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await api<ScreeningReport>(`/property/tenants/${tenant.id}/screening`);
        if (!cancelled) setReport(r);
      } catch { /* fall through to local fixture below */ }
    })();
    return () => { cancelled = true; };
  }, [tenant.id]);

  const decide = async (verdict: 'accepted' | 'rejected') => {
    setDeciding(true);
    try {
      const r = await api<ScreeningReport>(
        `/property/tenants/${tenant.id}/screening/decide`,
        { method: 'POST', body: JSON.stringify({ verdict }) },
      );
      setReport(r);
    } catch { /* keep the existing report visible */ }
    finally { setDeciding(false); }
  };

  // Local fallback only when the backend hasn't responded yet (first render
  // before the fetch resolves, or when the API isn't reachable at all).
  const seed = tenant.id.charCodeAt(0) || 1;
  const rentalPct   = report?.rentalHistoryPct   ?? (70 + (seed * 7)  % 26);
  const evictionPct = report?.evictionHistoryPct ?? (30 + (seed * 11) % 50);
  const criminalPct = report?.criminalHistoryPct ?? (60 + (seed * 5)  % 36);
  const creditPct   = report?.creditHistoryPct   ?? (40 + (seed * 13) % 50);
  const overall     = report?.overallScore       ?? (300 + ((rentalPct + evictionPct + criminalPct + creditPct) * 2));
  const verdict     = report?.verdict ?? 'pending';

  const overallLabel = overall >= 750 ? 'EXCELLENT' : overall >= 670 ? 'GOOD' : overall >= 580 ? 'FAIR' : 'POOR';

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 text-xs">
        <button onClick={onBack} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
        <span className="text-slate-500">Tenants</span>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-slate-500">{tenant.name}</span>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-blue-600 font-semibold">Screening Report</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-6">
          {/* Header */}
          <div>
            <h2 className="text-lg font-bold mb-1">Overview</h2>
            <div className="text-xs text-slate-500">Tenant screening across four risk categories.</div>
          </div>

          {/* Score circles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ScoreCircle pct={rentalPct}   label="Home & Rental" sub="History" tone="emerald" />
            <ScoreCircle pct={evictionPct} label="Eviction"      sub="History" tone="rose" />
            <ScoreCircle pct={criminalPct} label="Criminal"      sub="History" tone="emerald" />
            <ScoreCircle pct={creditPct}   label="Credit History" sub="History" tone="emerald" />
          </div>

          {/* Tenant Basic Details */}
          <div>
            <h3 className="font-bold text-sm mb-3">Tenant Basic Details</h3>
            <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-1 md:grid-cols-[auto_1fr_1fr_1fr] gap-4 items-center">
              {tenant.avatarUrl
                ? <img src={tenant.avatarUrl} alt="" className="w-20 h-20 rounded-xl object-cover" />
                : <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white font-bold text-2xl flex items-center justify-center">{initials(tenant.name)}</div>}
              <ScreeningField label="NAME"       value={tenant.name} />
              <ScreeningField label="MOBILE"     value={tenant.phone || '—'} />
              <ScreeningField label="EMAIL"      value={tenant.email || '—'} />
              <div className="hidden md:block" />
              <ScreeningField label="PROFESSION" value={tenant.occupation || 'Sr. UX/UI Designer'} />
              <ScreeningField label="ADDRESS"    value={tenant.currentAddress || `Room 23, ${tenant.propertyName ?? 'Building dc'}, Nairobi, Kenya`} />
            </div>
          </div>

          {/* Documents */}
          <div>
            <h3 className="font-bold text-sm mb-3">Documents</h3>
            <div className="space-y-2">
              <DocumentRow kind="PDF" name="Download Screening Reports" size="4.5 Mb" href={report?.reportPdfUrl} />
              <DocumentRow kind="JPG" name="Identity Proof Documents"   size="4.5 Mb" href={report?.identityProofUrl} />
            </div>
          </div>
        </div>

        {/* Right column — Overall score + actions + past requests */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 p-5 text-center">
            <div className="text-sm font-bold mb-1">Overall Score</div>
            <div className="text-[10px] text-slate-400 mb-3">Score Range 300-850</div>

            <div className="relative w-40 h-40 mx-auto">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40" stroke="#f1f5f9" strokeWidth="10" fill="none" />
                <circle
                  cx="50" cy="50" r="40"
                  stroke="url(#scoreGrad)"
                  strokeWidth="10"
                  fill="none"
                  strokeDasharray={`${(overall - 300) / 550 * 251} 251`}
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%"   stopColor="#ef4444" />
                    <stop offset="50%"  stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-3xl font-extrabold">{overall}</div>
                <div className="text-[10px] tracking-wider text-slate-500 mt-0.5">{overallLabel}</div>
              </div>
            </div>

            {verdict !== 'pending' && (
              <div className={`mt-4 mx-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold
                ${verdict === 'accepted' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                {verdict === 'accepted' ? 'ACCEPTED' : 'REJECTED'}
              </div>
            )}
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                onClick={() => decide('accepted')}
                disabled={deciding || verdict === 'accepted'}
                className="flex-1 px-3 py-2 rounded-full bg-amber-400 text-amber-900 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-amber-300 disabled:opacity-50"
              >
                {deciding ? '…' : 'ACCEPT'} <ArrowRight className="w-3 h-3" />
              </button>
              <button
                onClick={() => decide('rejected')}
                disabled={deciding || verdict === 'rejected'}
                className="flex-1 px-3 py-2 rounded-full bg-white border border-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-slate-50 disabled:opacity-50"
              >
                <X className="w-3 h-3" /> {deciding ? '…' : 'CANCEL'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-sm">Past Requests</h4>
              <button className="text-[11px] text-blue-600 font-semibold">View All</button>
            </div>
            <div className="space-y-2.5">
              {PAST_REQUESTS.map((r, i) => (
                <div key={i} className="flex items-center gap-2.5 text-xs">
                  <div className="w-9 h-9 rounded-lg bg-cover bg-center bg-slate-200" style={{ backgroundImage: `url('${r.image}')` }} />
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{r.name}</div>
                    <div className="text-[10px] text-slate-400">{r.date}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreCircle({ pct, label, sub, tone }: { pct: number; label: string; sub: string; tone: 'rose' | 'emerald' }) {
  const stroke = tone === 'rose' ? '#ef4444' : '#10b981';
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
      <div className="relative w-20 h-20 mx-auto">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="42" stroke="#f1f5f9" strokeWidth="8" fill="none" />
          <circle cx="50" cy="50" r="42" stroke={stroke} strokeWidth="8" fill="none"
            strokeDasharray={`${pct * 2.64} 264`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-sm font-bold">{pct}%</div>
      </div>
      <div className="mt-2 text-sm font-bold">{label}</div>
      <div className="text-[11px] text-slate-400">{sub}</div>
      <button className="mt-2 w-7 h-7 rounded-full bg-amber-400 hover:bg-amber-300 text-amber-900 inline-flex items-center justify-center mx-auto">
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function ScreeningField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-sm font-semibold text-slate-900 leading-tight">{value}</div>
      <div className="text-[10px] text-slate-400 tracking-wider mt-0.5">{label}</div>
    </div>
  );
}

function DocumentRow({ kind, name, size, href }: { kind: 'PDF' | 'JPG'; name: string; size: string; href?: string }) {
  const badge =
    kind === 'PDF'
      ? <span className="px-1.5 py-0.5 rounded bg-rose-500 text-white text-[9px] font-bold">PDF</span>
      : <span className="px-1.5 py-0.5 rounded bg-sky-500 text-white text-[9px] font-bold">JPG</span>;
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-100">
      {kind === 'PDF' ? <FileText className="w-5 h-5 text-rose-500" /> : <ImageIcon className="w-5 h-5 text-sky-500" />}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold flex items-center gap-2">{name} {badge}</div>
        <div className="text-[10px] text-slate-400">{size}</div>
      </div>
      <a
        href={href || '#'}
        target={href ? '_blank' : undefined}
        rel="noreferrer"
        onClick={(e) => { if (!href) e.preventDefault(); }}
        className={`w-8 h-8 rounded-full inline-flex items-center justify-center ${href ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
        title={href ? 'Download' : 'Not available yet'}
      >
        <FileDown className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}

const PAST_REQUESTS: Array<{ name: string; date: string; image: string }> = [
  { name: '2bhk Nairobi Home',  date: '23 May 2019', image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=120&q=80' },
  { name: '4bhk New York Home', date: '1 July 2019', image: 'https://images.unsplash.com/photo-1572120360610-d971b9d7767c?w=120&q=80' },
  { name: '6bhk Nairobi Villa', date: '3 Jan 2019',  image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=120&q=80' },
  { name: '5bhk Super Duplex',  date: '23 May 2019', image: 'https://images.unsplash.com/photo-1599809275671-b5942cabc7a2?w=120&q=80' },
  { name: '2bhk Nairobi Home',  date: '23 May 2019', image: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=120&q=80' },
];

function KpiCard({ label, value, tone }: { label: string; value: string; tone: 'rose' | 'emerald' | 'blue' | 'amber' }) {
  const ring =
    tone === 'rose'    ? 'border-rose-200 bg-rose-50/40' :
    tone === 'emerald' ? 'border-emerald-200 bg-emerald-50/40' :
    tone === 'blue'    ? 'border-blue-200 bg-blue-50/40' :
                         'border-amber-200 bg-amber-50/40';
  const text =
    tone === 'rose'    ? 'text-rose-600' :
    tone === 'emerald' ? 'text-emerald-600' :
    tone === 'blue'    ? 'text-blue-600' :
                         'text-amber-600';
  return (
    <div className={`rounded-2xl border ${ring} p-4`}>
      <div className="text-[11px] text-slate-500 uppercase tracking-wide font-semibold">{label}</div>
      <div className={`text-2xl font-extrabold mt-1 ${text}`}>{value}</div>
    </div>
  );
}

/* ────────────────────────────── Small primitives ────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-bold mb-3">{title}</h3>
      <div className="rounded-xl border border-slate-200 bg-white p-4">{children}</div>
    </section>
  );
}

function KeyValuePair({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span className="text-[11px] text-slate-500 w-32 shrink-0">{label} :</span>
      <span className="text-sm text-slate-900">{children}</span>
    </div>
  );
}

function Th({ children, sortable, tight }: { children: React.ReactNode; sortable?: boolean; tight?: boolean }) {
  return (
    <th className={`text-left font-semibold ${tight ? 'px-3 py-2' : 'px-4 py-3'} border-b border-slate-100`}>
      <span className="inline-flex items-center gap-1.5">
        {children}
        {sortable && <ChevronDown className="w-3 h-3 text-slate-300" />}
      </span>
    </th>
  );
}

function Td({ children, tight, className = '' }: { children: React.ReactNode; tight?: boolean; className?: string }) {
  return <td className={`${tight ? 'px-3 py-2' : 'px-4 py-3'} ${className}`}>{children}</td>;
}

/**
 * Overlapping-avatar chip used under the Pending/Collected totals on the
 * dashboard. Mirrors the IRES "+12" cluster — up to 5 tenants stacked
 * with -1.5 overlap, then a final circle showing the count of the rest.
 */
function AvatarStack({ tenants, extra, align = 'left' }: { tenants: ApiTenant[]; extra: number; align?: 'left' | 'right' }) {
  if (tenants.length === 0 && extra === 0) return null;
  return (
    <div className={`mt-2 flex items-center -space-x-1.5 ${align === 'right' ? 'justify-end' : ''}`}>
      {tenants.map((t) => (
        t.avatarUrl
          ? <img key={t.id} src={t.avatarUrl} alt={t.name} title={t.name} className="w-6 h-6 rounded-full ring-2 ring-white object-cover" />
          : <div key={t.id} title={t.name} className="w-6 h-6 rounded-full ring-2 ring-white bg-slate-300 flex items-center justify-center text-[8px] font-bold text-white">{initials(t.name)}</div>
      ))}
      {extra > 0 && (
        <div className="w-6 h-6 rounded-full ring-2 ring-white bg-amber-100 text-amber-800 text-[9px] font-bold flex items-center justify-center">
          +{extra}
        </div>
      )}
    </div>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
      <FileDown className="w-8 h-8 text-slate-300 mx-auto mb-3" />
      <h2 className="text-base font-bold mb-1">{title}</h2>
      <p className="text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}
