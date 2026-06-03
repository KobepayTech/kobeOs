import React, { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { ensureSession } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Building2, CalendarDays, CreditCard, DoorOpen, FileText, Gauge, Home, Loader2, Plus, RefreshCw, Search, Settings, Trash2, UserCheck, Users, Wallet, Wrench } from 'lucide-react';

type Row = Record<string, any>;
type Key = 'dashboard' | 'properties' | 'units' | 'tenants' | 'leases' | 'rentCharges' | 'payments' | 'workOrders' | 'vendors' | 'applications' | 'settings' | 'expenses' | 'simulations' | 'tenantPortal';
type Field = { name: string; label: string; type?: 'text' | 'number' | 'date' | 'datetime-local' | 'select'; required?: boolean; options?: string[]; placeholder?: string; from?: Key; valueKey?: string; labelKey?: string };
type Resource = { key: Key; title: string; subtitle: string; path: string; icon: React.ComponentType<{ className?: string }>; fields: Field[]; columns: string[]; canCreate?: boolean; canEdit?: boolean; canDelete?: boolean; query?: () => string; extraActions?: (row: Row) => React.ReactNode };

type State = Record<Key, Row[]> & { settings: Row[]; dashboard: Row[]; tenantPortal: Row[] };

type FormState = { resource: Resource; row?: Row } | null;

const emptyState: State = {
  dashboard: [], properties: [], units: [], tenants: [], leases: [], rentCharges: [], payments: [], workOrders: [], vendors: [], applications: [], settings: [], expenses: [], simulations: [], tenantPortal: [],
};

const money = (v: unknown, cur = 'TZS') => `${cur} ${Math.round(Number(v || 0)).toLocaleString()}`;
const fmt = (v: unknown) => String(v ?? '');
const todayPeriod = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

export default function PropertyProduction() {
  const [tab, setTab] = useState<Key>('dashboard');
  const [data, setData] = useState<State>(emptyState);
  const [dashboard, setDashboard] = useState<Row>({});
  const [period, setPeriod] = useState(todayPeriod());
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('Production Property app: backend-connected mode.');
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<FormState>(null);
  const [tenantPortalId, setTenantPortalId] = useState('');

  const resources = useMemo<Resource[]>(() => [
    { key: 'properties', title: 'Properties', subtitle: 'Buildings, plots and property records.', path: '/property/properties', icon: Building2, canCreate: true, canEdit: true, canDelete: true, columns: ['name', 'type', 'address', 'city', 'totalUnits'], fields: [
      { name: 'name', label: 'Name', required: true }, { name: 'type', label: 'Type', type: 'select', options: ['residential', 'commercial', 'mixed'] }, { name: 'address', label: 'Address' }, { name: 'city', label: 'City' }, { name: 'plotNo', label: 'Plot No' }, { name: 'blockNo', label: 'Block No' }, { name: 'totalUnits', label: 'Total Units', type: 'number' }, { name: 'notes', label: 'Notes' },
    ] },
    { key: 'units', title: 'Units', subtitle: 'Rooms, shops, apartments and offices.', path: '/property/units', icon: DoorOpen, canCreate: true, canEdit: true, canDelete: true, columns: ['unitNumber', 'propertyId', 'type', 'rentAmount', 'status'], fields: [
      { name: 'propertyId', label: 'Property', required: true, type: 'select', from: 'properties', labelKey: 'name' }, { name: 'unitNumber', label: 'Unit Number', required: true }, { name: 'type', label: 'Type' }, { name: 'bedrooms', label: 'Bedrooms', type: 'number' }, { name: 'bathrooms', label: 'Bathrooms', type: 'number' }, { name: 'sqft', label: 'Sqft', type: 'number' }, { name: 'floor', label: 'Floor' }, { name: 'rentAmount', label: 'Rent Amount', type: 'number' }, { name: 'currency', label: 'Currency' }, { name: 'status', label: 'Status', type: 'select', options: ['vacant', 'occupied', 'turnover', 'unavailable', 'maintenance'] }, { name: 'notes', label: 'Notes' },
    ] },
    { key: 'tenants', title: 'Tenants', subtitle: 'Tenant profiles and payment codes.', path: '/property/tenants', icon: Users, canCreate: true, canEdit: true, canDelete: true, columns: ['name', 'phone', 'email', 'unitId', 'status'], fields: [
      { name: 'unitId', label: 'Unit', type: 'select', from: 'units', labelKey: 'unitNumber' }, { name: 'name', label: 'Name', required: true }, { name: 'firstName', label: 'First Name' }, { name: 'middleName', label: 'Middle Name' }, { name: 'lastName', label: 'Last Name' }, { name: 'phone', label: 'Phone', required: true }, { name: 'email', label: 'Email' }, { name: 'tin', label: 'TIN' }, { name: 'businessLicense', label: 'Business License' }, { name: 'employer', label: 'Employer' }, { name: 'monthlyIncome', label: 'Monthly Income', type: 'number' }, { name: 'emergencyContact', label: 'Emergency Contact' }, { name: 'shortCode', label: 'Short Code' }, { name: 'paymentCode', label: 'Payment Code' }, { name: 'leaseStart', label: 'Lease Start', type: 'date' }, { name: 'leaseEnd', label: 'Lease End', type: 'date' }, { name: 'status', label: 'Status', type: 'select', options: ['active', 'past', 'pending', 'late', 'moving_out'] }, { name: 'notes', label: 'Notes' },
    ] },
    { key: 'leases', title: 'Leases', subtitle: 'Contracts between tenants and units.', path: '/property/leases', icon: FileText, canCreate: true, canEdit: true, canDelete: true, columns: ['tenantId', 'unitId', 'startDate', 'endDate', 'monthlyRent', 'status'], fields: [
      { name: 'tenantId', label: 'Tenant', required: true, type: 'select', from: 'tenants', labelKey: 'name' }, { name: 'unitId', label: 'Unit', required: true, type: 'select', from: 'units', labelKey: 'unitNumber' }, { name: 'startDate', label: 'Start Date', type: 'date', required: true }, { name: 'endDate', label: 'End Date', type: 'date', required: true }, { name: 'monthlyRent', label: 'Monthly Rent', type: 'number', required: true }, { name: 'deposit', label: 'Deposit', type: 'number' }, { name: 'rentDueDay', label: 'Rent Due Day', type: 'number' }, { name: 'lateFee', label: 'Late Fee', type: 'number' }, { name: 'status', label: 'Status', type: 'select', options: ['upcoming', 'active', 'ended', 'cancelled'] }, { name: 'notes', label: 'Notes' },
    ] },
    { key: 'rentCharges', title: 'Rent Charges', subtitle: 'Monthly rent invoices and balances.', path: '/property/rent-charges', query: () => `?period=${encodeURIComponent(period)}`, icon: Wallet, canCreate: true, canEdit: true, canDelete: true, columns: ['period', 'tenantId', 'unitId', 'dueDate', 'amount', 'amountPaid', 'status'], fields: [
      { name: 'leaseId', label: 'Lease', required: true, type: 'select', from: 'leases', labelKey: 'id' }, { name: 'tenantId', label: 'Tenant', required: true, type: 'select', from: 'tenants', labelKey: 'name' }, { name: 'unitId', label: 'Unit', required: true, type: 'select', from: 'units', labelKey: 'unitNumber' }, { name: 'period', label: 'Period YYYY-MM', required: true }, { name: 'dueDate', label: 'Due Date', type: 'date', required: true }, { name: 'amount', label: 'Amount', type: 'number', required: true }, { name: 'amountPaid', label: 'Amount Paid', type: 'number' }, { name: 'status', label: 'Status', type: 'select', options: ['open', 'partial', 'paid', 'overdue', 'waived'] }, { name: 'notes', label: 'Notes' },
    ], extraActions: (row) => <Button size="sm" variant="outline" onClick={() => waiveCharge(row.id)} className="h-8 border-white/10 text-xs">Waive</Button> },
    { key: 'payments', title: 'Payments', subtitle: 'Rent payment records linked to tenants and charges.', path: '/property/payments', icon: CreditCard, canCreate: true, canDelete: true, columns: ['tenantId', 'unitId', 'amount', 'currency', 'forMonth', 'paidAt', 'method'], fields: [
      { name: 'chargeId', label: 'Charge', type: 'select', from: 'rentCharges', labelKey: 'id' }, { name: 'tenantId', label: 'Tenant', required: true, type: 'select', from: 'tenants', labelKey: 'name' }, { name: 'unitId', label: 'Unit', required: true, type: 'select', from: 'units', labelKey: 'unitNumber' }, { name: 'amount', label: 'Amount', type: 'number', required: true }, { name: 'currency', label: 'Currency' }, { name: 'forMonth', label: 'For Month', type: 'date', required: true }, { name: 'paidAt', label: 'Paid At', type: 'datetime-local', required: true }, { name: 'method', label: 'Method' }, { name: 'reference', label: 'Reference' }, { name: 'notes', label: 'Notes' },
    ] },
    { key: 'workOrders', title: 'Maintenance', subtitle: 'Work orders, costs, vendors and schedules.', path: '/property/work-orders', icon: Wrench, canCreate: true, canEdit: true, canDelete: true, columns: ['title', 'propertyId', 'unitId', 'vendorId', 'priority', 'status', 'cost'], fields: [
      { name: 'propertyId', label: 'Property', type: 'select', from: 'properties', labelKey: 'name' }, { name: 'unitId', label: 'Unit', type: 'select', from: 'units', labelKey: 'unitNumber' }, { name: 'tenantId', label: 'Tenant', type: 'select', from: 'tenants', labelKey: 'name' }, { name: 'vendorId', label: 'Vendor', type: 'select', from: 'vendors', labelKey: 'name' }, { name: 'title', label: 'Title', required: true }, { name: 'description', label: 'Description' }, { name: 'priority', label: 'Priority', type: 'select', options: ['low', 'normal', 'high', 'urgent'] }, { name: 'status', label: 'Status', type: 'select', options: ['open', 'assigned', 'in_progress', 'completed', 'cancelled'] }, { name: 'scheduledAt', label: 'Scheduled At', type: 'datetime-local' }, { name: 'completedAt', label: 'Completed At', type: 'datetime-local' }, { name: 'cost', label: 'Cost', type: 'number' }, { name: 'notes', label: 'Notes' },
    ] },
    { key: 'vendors', title: 'Vendors', subtitle: 'Maintenance suppliers and service providers.', path: '/property/vendors', icon: UserCheck, canCreate: true, canEdit: true, canDelete: true, columns: ['name', 'category', 'phone', 'email', 'color'], fields: [
      { name: 'name', label: 'Name', required: true }, { name: 'category', label: 'Category', type: 'select', options: ['plumber', 'electrician', 'hvac', 'handyman', 'cleaning', 'landscaping', 'general'] }, { name: 'phone', label: 'Phone' }, { name: 'email', label: 'Email' }, { name: 'color', label: 'Color' }, { name: 'notes', label: 'Notes' },
    ] },
    { key: 'applications', title: 'Applications', subtitle: 'Applicants and approval flow.', path: '/property/applications', icon: UserCheck, canCreate: true, canEdit: true, canDelete: true, columns: ['firstName', 'lastName', 'phone', 'unitId', 'monthlyIncome', 'desiredMoveIn', 'status'], fields: [
      { name: 'unitId', label: 'Unit', type: 'select', from: 'units', labelKey: 'unitNumber' }, { name: 'firstName', label: 'First Name', required: true }, { name: 'lastName', label: 'Last Name' }, { name: 'phone', label: 'Phone' }, { name: 'email', label: 'Email' }, { name: 'monthlyIncome', label: 'Monthly Income', type: 'number' }, { name: 'employer', label: 'Employer' }, { name: 'desiredMoveIn', label: 'Desired Move In', type: 'date' }, { name: 'status', label: 'Status', type: 'select', options: ['new', 'screening', 'approved', 'declined', 'withdrawn'] }, { name: 'notes', label: 'Notes' },
    ], extraActions: (row) => <Button size="sm" onClick={() => approveApplication(row.id)} className="h-8 bg-emerald-600 text-xs">Approve</Button> },
    { key: 'expenses', title: 'Expenses', subtitle: 'Property and unit expenses.', path: '/property/expenses', icon: CreditCard, canCreate: true, canEdit: true, canDelete: true, columns: ['title', 'propertyId', 'unitId', 'category', 'amount', 'currency', 'spentAt'], fields: [
      { name: 'propertyId', label: 'Property', type: 'select', from: 'properties', labelKey: 'name' }, { name: 'unitId', label: 'Unit', type: 'select', from: 'units', labelKey: 'unitNumber' }, { name: 'title', label: 'Title', required: true }, { name: 'category', label: 'Category' }, { name: 'amount', label: 'Amount', type: 'number', required: true }, { name: 'currency', label: 'Currency' }, { name: 'spentAt', label: 'Spent At', type: 'date', required: true }, { name: 'notes', label: 'Notes' },
    ] },
    { key: 'simulations', title: 'Rent Increase Simulations', subtitle: 'Model rent increases and revenue impact.', path: '/property/rent-increase-simulations', icon: Gauge, canCreate: true, columns: ['propertyId', 'increasePercent', 'currentMonthlyRent', 'projectedMonthlyRent', 'monthlyDifference', 'annualDifference'], fields: [
      { name: 'propertyId', label: 'Property', type: 'select', from: 'properties', labelKey: 'name' }, { name: 'increasePercent', label: 'Increase Percent', type: 'number', required: true }, { name: 'notes', label: 'Notes' },
    ] },
  ], [period]);

  const resourceMap = useMemo(() => Object.fromEntries(resources.map((r) => [r.key, r])) as Record<string, Resource>, [resources]);

  useEffect(() => { void loadAll(); }, [period]);

  async function loadAll() {
    setLoading(true);
    try {
      await ensureSession();
      const dash = await api<Row>(`/property/dashboard/summary?period=${encodeURIComponent(period)}`);
      const results = await Promise.all(resources.map(async (r) => [r.key, await api<Row[]>(`${r.path}${r.query?.() ?? ''}`)] as const));
      const settings = await api<Row>('/property/settings');
      setDashboard(dash);
      setData({ ...emptyState, ...Object.fromEntries(results), settings: [settings], dashboard: [dash], tenantPortal: data.tenantPortal });
      setToast('Property data synced from backend.');
    } catch (err) {
      setToast(`Backend sync failed: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  async function save(resource: Resource, row: Row) {
    const isEdit = Boolean(row.id);
    const payload = cleanPayload(resource, row);
    try {
      await api(`${resource.path}${isEdit ? `/${row.id}` : ''}`, { method: isEdit ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      setToast(`${resource.title} saved to backend.`);
      setForm(null);
      await loadAll();
    } catch (err) {
      setToast(`Save failed: ${(err as Error).message}`);
    }
  }

  async function remove(resource: Resource, row: Row) {
    if (!confirm(`Delete ${resource.title} record?`)) return;
    try {
      await api(`${resource.path}/${row.id}`, { method: 'DELETE' });
      setToast(`${resource.title} deleted.`);
      await loadAll();
    } catch (err) {
      setToast(`Delete failed: ${(err as Error).message}`);
    }
  }

  async function generateCharges() {
    try {
      await api('/property/rent-charges/generate', { method: 'POST', body: JSON.stringify({ period }) });
      setToast(`Rent charges generated for ${period}.`);
      await loadAll();
    } catch (err) { setToast(`Charge generation failed: ${(err as Error).message}`); }
  }

  async function waiveCharge(id: string) {
    try { await api(`/property/rent-charges/${id}/waive`, { method: 'POST' }); setToast('Charge waived.'); await loadAll(); }
    catch (err) { setToast(`Waive failed: ${(err as Error).message}`); }
  }

  async function approveApplication(id: string) {
    try { await api(`/property/applications/${id}/approve`, { method: 'POST' }); setToast('Application approved and converted to tenant + lease.'); await loadAll(); }
    catch (err) { setToast(`Approval failed: ${(err as Error).message}`); }
  }

  async function loadTenantPortal() {
    if (!tenantPortalId) return;
    try { const portal = await api<Row>(`/property/tenant-portal/${tenantPortalId}`); setData((old) => ({ ...old, tenantPortal: [portal] })); setToast('Tenant portal loaded.'); }
    catch (err) { setToast(`Tenant portal failed: ${(err as Error).message}`); }
  }

  async function saveSettings(row: Row) {
    try { await api('/property/settings', { method: 'PATCH', body: JSON.stringify(row) }); setToast('Settings saved.'); await loadAll(); }
    catch (err) { setToast(`Settings save failed: ${(err as Error).message}`); }
  }

  const searchRows = (rows: Row[]) => rows.filter((r) => JSON.stringify(r).toLowerCase().includes(query.toLowerCase()));
  const current = resourceMap[tab];

  return <div className="flex h-full min-h-0 bg-[#080b12] text-white">
    <aside className="hidden w-72 shrink-0 border-r border-white/10 bg-[#0d111b] p-3 lg:block">
      <div className="mb-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <div className="font-semibold">Kobe Property</div>
        <div className="text-xs text-white/45">Production backend-connected app</div>
      </div>
      <NavButton active={tab === 'dashboard'} icon={Home} label="Dashboard" onClick={() => setTab('dashboard')} />
      {resources.map((r) => <NavButton key={r.key} active={tab === r.key} icon={r.icon} label={r.title} onClick={() => setTab(r.key)} />)}
      <NavButton active={tab === 'settings'} icon={Settings} label="Settings / Policy" onClick={() => setTab('settings')} />
      <NavButton active={tab === 'tenantPortal'} icon={Users} label="Tenant Portal Check" onClick={() => setTab('tenantPortal')} />
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-[11px] text-white/50">{toast}</div>
    </aside>
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="border-b border-white/10 bg-[#0b0f18] p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div><h1 className="text-lg font-semibold">Property Management</h1><p className="text-xs text-white/45">All modules now read/write through backend APIs.</p></div>
          <div className="flex flex-wrap gap-2">
            <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-white/30" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search current table" className="h-9 w-72 border-white/10 bg-white/[0.04] pl-9 text-xs text-white" /></div>
            <Input value={period} onChange={(e) => setPeriod(e.target.value)} className="h-9 w-32 border-white/10 bg-white/[0.04] text-xs text-white" />
            <Button onClick={loadAll} disabled={loading} className="h-9 bg-blue-600 text-xs">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</Button>
          </div>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto lg:hidden"><button onClick={() => setTab('dashboard')} className="shrink-0 rounded-xl border border-white/10 px-3 py-1 text-xs">Dashboard</button>{resources.map((r) => <button key={r.key} onClick={() => setTab(r.key)} className="shrink-0 rounded-xl border border-white/10 px-3 py-1 text-xs">{r.title}</button>)}</div>
      </header>
      <ScrollArea className="min-h-0 flex-1"><div className="p-4">
        {tab === 'dashboard' && <Dashboard dashboard={dashboard} data={data} period={period} generateCharges={generateCharges} />}
        {current && <ResourcePage resource={current} rows={searchRows(data[current.key] ?? [])} data={data} openForm={(row) => setForm({ resource: current, row })} remove={(row) => remove(current, row)} />}
        {tab === 'settings' && <SettingsPage row={data.settings[0] ?? {}} save={saveSettings} />}
        {tab === 'tenantPortal' && <TenantPortal tenants={data.tenants} tenantId={tenantPortalId} setTenantId={setTenantPortalId} load={loadTenantPortal} row={data.tenantPortal[0]} />}
      </div></ScrollArea>
    </main>
    {form && <CrudModal state={form} data={data} close={() => setForm(null)} save={save} />}
  </div>;
}

function cleanPayload(resource: Resource, row: Row) {
  const payload: Row = {};
  for (const f of resource.fields) {
    const value = row[f.name];
    if (value === undefined || value === '') continue;
    payload[f.name] = f.type === 'number' ? Number(value) : value;
  }
  if (resource.key === 'payments' && payload.paidAt && String(payload.paidAt).length === 16) payload.paidAt = new Date(payload.paidAt).toISOString();
  return payload;
}

function NavButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void }) {
  return <button onClick={onClick} className={`mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs ${active ? 'bg-blue-500/15 text-blue-300' : 'text-white/55 hover:bg-white/[0.04]'}`}><Icon className="h-4 w-4" />{label}</button>;
}

function Dashboard({ dashboard, data, period, generateCharges }: { dashboard: Row; data: State; period: string; generateCharges: () => void }) {
  return <div className="space-y-4">
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <Metric label="Properties" value={dashboard.properties ?? data.properties.length} sub="Total properties" />
      <Metric label="Occupancy" value={`${dashboard.occupancyRate ?? 0}%`} sub={`${dashboard.occupied ?? 0} occupied / ${dashboard.units ?? 0} units`} />
      <Metric label="Collected" value={money(dashboard.collected)} sub={`For ${period}`} />
      <Metric label="Outstanding" value={money(dashboard.outstanding)} sub={`${dashboard.overdueCount ?? 0} overdue charges`} />
      <Metric label="Open Work Orders" value={dashboard.openWorkOrders ?? 0} sub={`${dashboard.urgentWorkOrders ?? 0} urgent`} />
      <Metric label="Expenses" value={money(dashboard.expenses)} sub="Recorded expenses" />
      <Metric label="Net" value={money(dashboard.net)} sub="Collected minus expenses" />
      <Metric label="Applications" value={data.applications.length} sub="Rental applications" />
    </div>
    <Panel title="Backend Actions"><div className="flex flex-wrap gap-2"><Button onClick={generateCharges} className="bg-blue-600 text-xs"><CalendarDays className="mr-2 h-4 w-4" />Generate Rent Charges</Button></div></Panel>
  </div>;
}

function Metric({ label, value, sub }: { label: string; value: React.ReactNode; sub: string }) { return <Card className="border-white/10 bg-white/[0.03]"><CardContent className="p-4"><div className="text-[10px] uppercase tracking-wider text-white/35">{label}</div><div className="mt-1 text-xl font-bold">{value}</div><div className="text-xs text-white/40">{sub}</div></CardContent></Card>; }
function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <Card className="border-white/10 bg-white/[0.03]"><CardHeader className="px-4 py-3"><CardTitle className="text-sm">{title}</CardTitle></CardHeader><CardContent className="px-4 pb-4">{children}</CardContent></Card>; }

function ResourcePage({ resource, rows, data, openForm, remove }: { resource: Resource; rows: Row[]; data: State; openForm: (row?: Row) => void; remove: (row: Row) => void }) {
  return <div className="space-y-4">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-semibold">{resource.title}</h2><p className="text-xs text-white/45">{resource.subtitle}</p></div>{resource.canCreate && <Button onClick={() => openForm()} className="w-fit bg-blue-600 text-xs"><Plus className="mr-1 h-4 w-4" />Add</Button>}</div>
    <Card className="border-white/10 bg-white/[0.03]"><CardContent className="overflow-x-auto p-0"><table className="w-full min-w-[900px] text-left text-xs"><thead className="border-b border-white/10 text-white/35"><tr>{resource.columns.map((c) => <th key={c} className="p-3 font-medium">{label(c)}</th>)}<th className="p-3 text-right">Actions</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b border-white/5"><td colSpan={0} className="hidden" />{resource.columns.map((c) => <td key={c} className="p-3 text-white/75">{display(data, c, row[c])}</td>)}<td className="p-3"><div className="flex justify-end gap-1">{resource.extraActions?.(row)}{resource.canEdit && <Button size="sm" variant="outline" onClick={() => openForm(row)} className="h-8 border-white/10 text-xs">Edit</Button>}{resource.canDelete && <Button size="sm" variant="outline" onClick={() => remove(row)} className="h-8 border-red-500/20 text-xs text-red-300"><Trash2 className="h-3.5 w-3.5" /></Button>}</div></td></tr>)}{!rows.length && <tr><td colSpan={resource.columns.length + 1} className="p-6 text-center text-white/35">No records found. Add one or refresh backend data.</td></tr>}</tbody></table></CardContent></Card>
  </div>;
}

function SettingsPage({ row, save }: { row: Row; save: (row: Row) => void }) {
  const fields: Field[] = [{ name: 'defaultRentDueDay', label: 'Default Due Day', type: 'number' }, { name: 'lateFeeAmount', label: 'Late Fee Amount', type: 'number' }, { name: 'lateFeeGraceDays', label: 'Grace Days', type: 'number' }, { name: 'currency', label: 'Currency' }, { name: 'reminderChannels', label: 'Reminder Channels' }, { name: 'invoicePrefix', label: 'Invoice Prefix' }];
  const [draft, setDraft] = useState<Row>(row);
  useEffect(() => setDraft(row), [row]);
  return <Panel title="Rent Policy Settings"><FormGrid fields={fields} row={draft} setRow={setDraft} data={emptyState} /><Button onClick={() => save(draft)} className="mt-4 bg-blue-600 text-xs">Save Settings</Button></Panel>;
}

function TenantPortal({ tenants, tenantId, setTenantId, load, row }: { tenants: Row[]; tenantId: string; setTenantId: (id: string) => void; load: () => void; row?: Row }) {
  return <div className="space-y-4"><Panel title="Tenant Portal Preview"><div className="flex gap-2"><select value={tenantId} onChange={(e) => setTenantId(e.target.value)} className="h-9 rounded-md border border-white/10 bg-[#111827] px-3 text-xs"><option value="">Select tenant</option>{tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select><Button onClick={load} className="bg-blue-600 text-xs">Load Portal</Button></div></Panel>{row && <Panel title="Portal Result"><pre className="overflow-auto rounded-xl bg-black/30 p-3 text-xs text-white/70">{JSON.stringify(row, null, 2)}</pre></Panel>}</div>;
}

function CrudModal({ state, data, close, save }: { state: { resource: Resource; row?: Row }; data: State; close: () => void; save: (resource: Resource, row: Row) => void }) {
  const [draft, setDraft] = useState<Row>(state.row ?? {});
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><Card className="max-h-[90vh] w-full max-w-4xl overflow-hidden border-white/10 bg-[#0d111b] text-white"><CardHeader className="flex flex-row items-center justify-between border-b border-white/10"><CardTitle className="text-base">{state.row ? 'Edit' : 'Add'} {state.resource.title}</CardTitle><Button variant="ghost" onClick={close}>Close</Button></CardHeader><CardContent className="max-h-[72vh] overflow-auto p-4"><FormGrid fields={state.resource.fields} row={draft} setRow={setDraft} data={data} /><div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={close} className="border-white/10">Cancel</Button><Button onClick={() => save(state.resource, draft)} className="bg-blue-600">Save to Backend</Button></div></CardContent></Card></div>;
}

function FormGrid({ fields, row, setRow, data }: { fields: Field[]; row: Row; setRow: React.Dispatch<React.SetStateAction<Row>>; data: State }) {
  return <div className="grid gap-3 md:grid-cols-2">{fields.map((f) => <label key={f.name} className="space-y-1"><div className="text-xs text-white/55">{f.label}{f.required ? ' *' : ''}</div>{f.type === 'select' ? <select value={fmt(row[f.name])} onChange={(e) => setRow((r) => ({ ...r, [f.name]: e.target.value }))} className="h-10 w-full rounded-md border border-white/10 bg-[#111827] px-3 text-sm"><option value="">Select</option>{(f.from ? data[f.from] : (f.options ?? []).map((x) => ({ id: x, name: x }))).map((x: any) => <option key={x.id ?? x} value={x[f.valueKey ?? 'id'] ?? x}>{x[f.labelKey ?? 'name'] ?? x}</option>)}</select> : <Input type={f.type ?? 'text'} value={fmt(row[f.name])} onChange={(e) => setRow((r) => ({ ...r, [f.name]: e.target.value }))} placeholder={f.placeholder} className="border-white/10 bg-white/[0.04] text-white" />}</label>)}</div>;
}

function display(data: State, key: string, value: unknown) {
  const v = fmt(value);
  if (key.endsWith('Id')) {
    if (key === 'propertyId') return data.properties.find((x) => x.id === v)?.name ?? v;
    if (key === 'unitId') return data.units.find((x) => x.id === v)?.unitNumber ?? v;
    if (key === 'tenantId') return data.tenants.find((x) => x.id === v)?.name ?? v;
    if (key === 'vendorId') return data.vendors.find((x) => x.id === v)?.name ?? v;
  }
  if (['amount', 'amountPaid', 'rentAmount', 'monthlyRent', 'deposit', 'lateFee', 'cost', 'monthlyIncome', 'currentMonthlyRent', 'projectedMonthlyRent', 'monthlyDifference', 'annualDifference'].includes(key)) return money(value);
  return v;
}
function label(s: string) { return s.replace(/([A-Z])/g, ' $1').replace(/^./, (x) => x.toUpperCase()); }
