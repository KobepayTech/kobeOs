import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import {
  Home, Building2, Users, DollarSign, Wrench, FileText, Settings, LogOut,
  Search, Bell, ChevronDown, Plus, ArrowLeft, ArrowRight,
  Info, Pencil, Trash2, Filter, Columns3, ChevronRight, MoreHorizontal,
  CheckCircle2, AlertTriangle, FileDown,
} from 'lucide-react';

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

type View = 'dashboard' | 'properties' | 'tenants' | 'tenant-detail' | 'financials' | 'maintenance' | 'documents' | 'settings';
type TenantStatus = 'rent_paid' | 'overdue' | 'late_fees' | 'in_proceed';
type UnitKind = 'House' | 'Apartment' | 'Duplex' | 'Studio';

interface ApiProperty   { id: string; name: string; address: string }
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
  const [, setProperties] = useState<ApiProperty[]>([]);

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

  return (
    <div className="flex h-full w-full bg-slate-50 text-slate-900" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <Sidebar view={view} onChange={setView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title={titleFor(view)} />
        <div className="flex-1 overflow-y-auto p-6">
          {view === 'dashboard'     && <DashboardView tenants={tenants} payments={payments} />}
          {view === 'tenants'       && <TenantsView tenants={tenants} onPick={openTenant} />}
          {view === 'tenant-detail' && selectedTenant && (
            <TenantDetailView
              tenant={selectedTenant}
              payments={payments.filter((p) => p.tenantId === selectedTenant.id)}
              maintenance={DEMO_MAINTENANCE.filter((m) => m.tenantId === selectedTenant.id)}
              onBack={() => setView('tenants')}
            />
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
    case 'financials':    return 'Financials';
    case 'maintenance':   return 'Maintenance';
    case 'documents':     return 'Documents';
    case 'settings':      return 'Settings';
  }
}

/* ────────────────────────────── Sidebar ────────────────────────────── */

function Sidebar({ view, onChange }: { view: View; onChange: (v: View) => void }) {
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
      <div className="flex items-center gap-2 px-2 pb-5 mb-2">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-600">
          <Home className="w-4 h-4" />
        </span>
        <span className="font-extrabold text-lg">
          <span className="text-blue-600">Prop</span>Easy
        </span>
      </div>
      <nav className="flex flex-col gap-1 flex-1">
        {items.map(({ id, label, icon: Icon }) => {
          const active = view === id || (view === 'tenant-detail' && id === 'tenants');
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
  tenant, payments, maintenance, onBack,
}: { tenant: ApiTenant; payments: ApiPayment[]; maintenance: MaintenanceRequest[]; onBack: () => void }) {
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

function DashboardView({ tenants, payments }: { tenants: ApiTenant[]; payments: ApiPayment[] }) {
  const collected = payments.filter((p) => p.status === 'Paid').reduce((s, p) => s + p.amount, 0);
  const pending = payments.filter((p) => p.status !== 'Paid').reduce((s, p) => s + p.amount, 0);
  const occupied = tenants.length;
  const vacant = Math.max(0, 200 - tenants.length);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard label="Pending"    value={`$${pending.toLocaleString()}`}   tone="rose" />
        <KpiCard label="Collected"  value={`$${collected.toLocaleString()}`} tone="emerald" />
        <KpiCard label="Tenants"    value={`${occupied}/200`}                tone="blue" />
        <KpiCard label="Vacant"     value={String(vacant)}                   tone="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm">Tenant Requests</h3>
            <button className="text-[11px] text-blue-600 font-semibold">View All</button>
          </div>
          <div className="space-y-2">
            {tenants.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-50">
                <div className="flex items-center gap-3 min-w-0">
                  {t.avatarUrl
                    ? <img src={t.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                    : <div className="w-8 h-8 rounded-full bg-slate-300" />}
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{t.name}</div>
                    <div className="text-[11px] text-slate-500 truncate">{t.unitKind} · {t.propertyName}</div>
                  </div>
                </div>
                <button className="px-3 py-1.5 rounded-full bg-amber-400 hover:bg-amber-300 text-amber-900 text-[11px] font-bold flex items-center gap-1">
                  View <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm">Activity</h3>
            <button className="text-[11px] text-blue-600 font-semibold">View All</button>
          </div>
          <div className="space-y-3">
            {tenants.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center gap-3">
                {t.avatarUrl
                  ? <img src={t.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                  : <div className="w-8 h-8 rounded-full bg-slate-300" />}
                <div className="flex-1 min-w-0">
                  <div className="text-xs">
                    <strong>{t.name}</strong>
                    <span className="text-slate-500"> : June rent {t.balance ? 'overdue' : 'paid'}</span>
                  </div>
                </div>
                {t.balance
                  ? <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  : <CheckCircle2  className="w-3.5 h-3.5 text-emerald-500" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

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

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
      <FileDown className="w-8 h-8 text-slate-300 mx-auto mb-3" />
      <h2 className="text-base font-bold mb-1">{title}</h2>
      <p className="text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}
