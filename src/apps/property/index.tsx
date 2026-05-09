import { useState, useMemo } from 'react';
import {
  Building2, Users, Wallet, Wrench, TrendingUp, TrendingDown,
  Plus, Search, Filter, MoreHorizontal, Phone, Mail, MapPin,
  Bed, Bath, Square, CheckCircle2, Clock, AlertCircle, XCircle,
  ChevronRight, DollarSign, Calendar, ArrowUpRight, ArrowDownRight,
  Receipt, CreditCard, Banknote, Smartphone, BarChart3, PieChart,
  Home, DoorOpen, Droplets, Zap, Paintbrush, Trash2, Edit, Eye,
  X, ChevronLeft, Star, FileText, Download, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/* ─────────────────────── demo data ─────────────────────── */

interface Property {
  id: string;
  name: string;
  address: string;
  type: 'Residential' | 'Commercial' | 'Mixed-Use';
  units: number;
  occupied: number;
  image: string;
  status: 'Active' | 'Under Renovation' | 'Inactive';
  monthlyIncome: number;
}

interface Tenant {
  id: string;
  name: string;
  phone: string;
  email: string;
  propertyId: string;
  unit: string;
  leaseStart: string;
  leaseEnd: string;
  rent: number;
  status: 'Active' | 'Pending' | 'Late' | 'Moving Out';
  avatar: string;
}

interface Unit {
  id: string;
  propertyId: string;
  number: string;
  type: string;
  beds: number;
  baths: number;
  sqft: number;
  rent: number;
  status: 'Occupied' | 'Vacant' | 'Maintenance' | 'Reserved';
  tenantName?: string;
  amenities: string[];
}

interface Payment {
  id: string;
  tenantId: string;
  tenantName: string;
  propertyId: string;
  unit: string;
  amount: number;
  date: string;
  method: 'Bank Transfer' | 'Cash' | 'Mobile Money' | 'Card';
  status: 'Paid' | 'Pending' | 'Overdue' | 'Partial';
  type: 'Rent' | 'Deposit' | 'Maintenance' | 'Utility';
}

interface MaintenanceReq {
  id: string;
  propertyId: string;
  unit: string;
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  status: 'Open' | 'In Progress' | 'Completed' | 'Cancelled';
  requested: string;
  assigned?: string;
  cost?: number;
}

const properties: Property[] = [
  { id: 'p1', name: 'Mbezi Beach Apartments', address: 'Mbezi Beach, Dar es Salaam', type: 'Residential', units: 24, occupied: 20, image: 'bg-gradient-to-br from-blue-600 to-indigo-700', status: 'Active', monthlyIncome: 48000000 },
  { id: 'p2', name: 'Masaki Office Complex', address: 'Masaki, Dar es Salaam', type: 'Commercial', units: 12, occupied: 10, image: 'bg-gradient-to-br from-emerald-600 to-teal-700', status: 'Active', monthlyIncome: 72000000 },
  { id: 'p3', name: 'Mikocheni Villas', address: 'Mikocheni, Dar es Salaam', type: 'Residential', units: 8, occupied: 8, image: 'bg-gradient-to-br from-amber-600 to-orange-700', status: 'Active', monthlyIncome: 32000000 },
  { id: 'p4', name: 'Kariakor Retail Plaza', address: 'Kariakor, Dar es Salaam', type: 'Commercial', units: 18, occupied: 14, image: 'bg-gradient-to-br from-rose-600 to-pink-700', status: 'Active', monthlyIncome: 54000000 },
  { id: 'p5', name: 'Upanga Heights', address: 'Upanga, Dar es Salaam', type: 'Mixed-Use', units: 32, occupied: 28, image: 'bg-gradient-to-br from-violet-600 to-purple-700', status: 'Active', monthlyIncome: 64000000 },
  { id: 'p6', name: 'Oysterbay Townhouses', address: 'Oysterbay, Dar es Salaam', type: 'Residential', units: 6, occupied: 4, image: 'bg-gradient-to-br from-cyan-600 to-blue-700', status: 'Under Renovation', monthlyIncome: 24000000 },
];

const tenants: Tenant[] = [
  { id: 't1', name: 'James Mwakasege', phone: '+255 712 345 678', email: 'james.m@email.com', propertyId: 'p1', unit: 'A-12', leaseStart: '2024-01-15', leaseEnd: '2025-01-14', rent: 2500000, status: 'Active', avatar: 'JM' },
  { id: 't2', name: 'Grace Mwangala', phone: '+255 713 456 789', email: 'grace.m@email.com', propertyId: 'p1', unit: 'B-05', leaseStart: '2024-03-01', leaseEnd: '2025-02-28', rent: 1800000, status: 'Active', avatar: 'GM' },
  { id: 't3', name: 'KOBEPay Technologies', phone: '+255 714 567 890', email: 'admin@kobepay.co.tz', propertyId: 'p2', unit: 'Suite-301', leaseStart: '2024-06-01', leaseEnd: '2026-05-31', rent: 6000000, status: 'Active', avatar: 'KT' },
  { id: 't4', name: 'Safari Logistics Ltd', phone: '+255 715 678 901', email: 'info@safarilog.co.tz', propertyId: 'p2', unit: 'Suite-205', leaseStart: '2024-04-15', leaseEnd: '2025-04-14', rent: 4500000, status: 'Late', avatar: 'SL' },
  { id: 't5', name: 'Dr. Amina Rashid', phone: '+255 716 789 012', email: 'amina.r@email.com', propertyId: 'p3', unit: 'Villa-3', leaseStart: '2024-02-01', leaseEnd: '2025-01-31', rent: 4000000, status: 'Active', avatar: 'AR' },
  { id: 't6', name: 'Bongo Foods Ltd', phone: '+255 717 890 123', email: 'orders@bongofoods.co.tz', propertyId: 'p4', unit: 'Shop-08', leaseStart: '2024-05-01', leaseEnd: '2025-04-30', rent: 3000000, status: 'Active', avatar: 'BF' },
  { id: 't7', name: 'Peter Omondi', phone: '+255 718 901 234', email: 'peter.o@email.com', propertyId: 'p5', unit: 'PH-01', leaseStart: '2024-07-01', leaseEnd: '2025-06-30', rent: 5500000, status: 'Moving Out', avatar: 'PO' },
  { id: 't8', name: 'Mary Kisare', phone: '+255 719 012 345', email: 'mary.k@email.com', propertyId: 'p1', unit: 'C-08', leaseStart: '2024-08-01', leaseEnd: '2025-07-31', rent: 2200000, status: 'Pending', avatar: 'MK' },
];

const units: Unit[] = [
  { id: 'u1', propertyId: 'p1', number: 'A-12', type: '2 Bedroom', beds: 2, baths: 1, sqft: 850, rent: 2500000, status: 'Occupied', tenantName: 'James Mwakasege', amenities: ['Parking', 'Gated', 'Water'] },
  { id: 'u2', propertyId: 'p1', number: 'B-05', type: '1 Bedroom', beds: 1, baths: 1, sqft: 550, rent: 1800000, status: 'Occupied', tenantName: 'Grace Mwangala', amenities: ['Parking', 'Water'] },
  { id: 'u3', propertyId: 'p1', number: 'C-08', type: 'Studio', beds: 0, baths: 1, sqft: 400, rent: 1200000, status: 'Reserved', amenities: ['Water'] },
  { id: 'u4', propertyId: 'p1', number: 'A-01', type: '3 Bedroom', beds: 3, baths: 2, sqft: 1200, rent: 3500000, status: 'Vacant', amenities: ['Parking', 'Gated', 'Water', 'Garden'] },
  { id: 'u5', propertyId: 'p2', number: 'Suite-301', type: 'Office', beds: 0, baths: 2, sqft: 1500, rent: 6000000, status: 'Occupied', tenantName: 'KOBEPay Technologies', amenities: ['Parking', 'Security', 'Generator'] },
  { id: 'u6', propertyId: 'p2', number: 'Suite-205', type: 'Office', beds: 0, baths: 1, sqft: 1100, rent: 4500000, status: 'Occupied', tenantName: 'Safari Logistics Ltd', amenities: ['Parking', 'Security'] },
  { id: 'u7', propertyId: 'p2', number: 'Shop-01', type: 'Retail', beds: 0, baths: 1, sqft: 600, rent: 2800000, status: 'Vacant', amenities: ['Street Front'] },
  { id: 'u8', propertyId: 'p3', number: 'Villa-3', type: '3 Bedroom Villa', beds: 3, baths: 3, sqft: 2200, rent: 4000000, status: 'Occupied', tenantName: 'Dr. Amina Rashid', amenities: ['Parking', 'Gated', 'Pool', 'Garden'] },
  { id: 'u9', propertyId: 'p5', number: 'PH-01', type: 'Penthouse', beds: 4, baths: 3, sqft: 2800, rent: 5500000, status: 'Occupied', tenantName: 'Peter Omondi', amenities: ['Parking', 'Pool', 'Gym', 'Elevator'] },
  { id: 'u10', propertyId: 'p4', number: 'Shop-08', type: 'Retail', beds: 0, baths: 1, sqft: 450, rent: 3000000, status: 'Occupied', tenantName: 'Bongo Foods Ltd', amenities: ['Street Front', 'Storage'] },
];

const payments: Payment[] = [
  { id: 'pay1', tenantId: 't1', tenantName: 'James Mwakasege', propertyId: 'p1', unit: 'A-12', amount: 2500000, date: '2025-05-01', method: 'Bank Transfer', status: 'Paid', type: 'Rent' },
  { id: 'pay2', tenantId: 't2', tenantName: 'Grace Mwangala', propertyId: 'p1', unit: 'B-05', amount: 1800000, date: '2025-05-02', method: 'Mobile Money', status: 'Paid', type: 'Rent' },
  { id: 'pay3', tenantId: 't3', tenantName: 'KOBEPay Technologies', propertyId: 'p2', unit: 'Suite-301', amount: 6000000, date: '2025-05-01', method: 'Bank Transfer', status: 'Paid', type: 'Rent' },
  { id: 'pay4', tenantId: 't4', tenantName: 'Safari Logistics Ltd', propertyId: 'p2', unit: 'Suite-205', amount: 4500000, date: '2025-04-15', method: 'Bank Transfer', status: 'Overdue', type: 'Rent' },
  { id: 'pay5', tenantId: 't5', tenantName: 'Dr. Amina Rashid', propertyId: 'p3', unit: 'Villa-3', amount: 4000000, date: '2025-05-03', method: 'Mobile Money', status: 'Paid', type: 'Rent' },
  { id: 'pay6', tenantId: 't6', tenantName: 'Bongo Foods Ltd', propertyId: 'p4', unit: 'Shop-08', amount: 3000000, date: '2025-05-01', method: 'Cash', status: 'Paid', type: 'Rent' },
  { id: 'pay7', tenantId: 't7', tenantName: 'Peter Omondi', propertyId: 'p5', unit: 'PH-01', amount: 5500000, date: '2025-04-01', method: 'Bank Transfer', status: 'Partial', type: 'Rent' },
  { id: 'pay8', tenantId: 't1', tenantName: 'James Mwakasege', propertyId: 'p1', unit: 'A-12', amount: 500000, date: '2025-05-01', method: 'Bank Transfer', status: 'Paid', type: 'Utility' },
];

const maintenanceRequests: MaintenanceReq[] = [
  { id: 'm1', propertyId: 'p1', unit: 'B-05', title: 'Leaking kitchen tap', description: 'Tenant reported water leaking from kitchen tap since yesterday.', priority: 'Medium', status: 'Open', requested: '2025-05-07', cost: 85000 },
  { id: 'm2', propertyId: 'p2', unit: 'Suite-205', title: 'AC unit not cooling', description: 'Air conditioner in main office blowing warm air.', priority: 'High', status: 'In Progress', requested: '2025-05-06', assigned: 'Hassan Repairs', cost: 450000 },
  { id: 'm3', propertyId: 'p3', unit: 'Villa-3', title: 'Garden irrigation repair', description: 'Sprinkler system not working in backyard.', priority: 'Low', status: 'Completed', requested: '2025-05-01', assigned: 'Green Gardens', cost: 180000 },
  { id: 'm4', propertyId: 'p1', unit: 'A-12', title: 'Broken window latch', description: 'Bedroom window latch is broken, cannot lock.', priority: 'Medium', status: 'Open', requested: '2025-05-08', cost: 120000 },
  { id: 'm5', propertyId: 'p4', unit: 'Shop-08', title: 'Electrical wiring check', description: 'Flickering lights reported by tenant.', priority: 'Urgent', status: 'In Progress', requested: '2025-05-08', assigned: 'PowerTech Electric', cost: 320000 },
  { id: 'm6', propertyId: 'p5', unit: 'PH-01', title: 'Elevator maintenance', description: 'Scheduled quarterly elevator service.', priority: 'Low', status: 'Completed', requested: '2025-04-28', assigned: 'KONE Tanzania', cost: 950000 },
];

const tzs = (n: number) => `TZS ${n.toLocaleString()}`;

/* ─────────────────────── helpers ─────────────────────── */

const statusColors: Record<string, string> = {
  Active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  Occupied: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  Paid: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  Vacant: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  Pending: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  'Moving Out': 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  Late: 'bg-red-500/15 text-red-400 border-red-500/20',
  Overdue: 'bg-red-500/15 text-red-400 border-red-500/20',
  Partial: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  Open: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  'In Progress': 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  Completed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  Cancelled: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
  Reserved: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  Maintenance: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  'Under Renovation': 'bg-violet-500/15 text-violet-400 border-violet-500/20',
  Urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
  High: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  Medium: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  Low: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
  Inactive: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
};

const StatusBadge = ({ status }: { status: string }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusColors[status] || 'bg-gray-500/15 text-gray-400 border-gray-500/20'}`}>
    {status}
  </span>
);

const KPICard = ({ title, value, change, changeType, icon: Icon }: {
  title: string; value: string; change: string; changeType: 'up' | 'down'; icon: any;
}) => (
  <Card className="bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05] transition-colors">
    <CardContent className="p-3 sm:p-4">
      <div className="flex items-start justify-between mb-2">
        <span className="text-[11px] text-white/40 font-medium">{title}</span>
        <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 text-white/50" />
        </div>
      </div>
      <div className="text-base sm:text-lg font-semibold text-white/90 mb-1">{value}</div>
      <div className={`flex items-center gap-0.5 text-[10px] font-medium ${changeType === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>
        {changeType === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        {change}
      </div>
    </CardContent>
  </Card>
);

/* ─────────────────────── tabs ─────────────────────── */

type Tab = 'dashboard' | 'properties' | 'tenants' | 'units' | 'payments' | 'maintenance';

/* ═══════════════════ MAIN COMPONENT ═══════════════════ */

export default function PropertyManager() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [search, setSearch] = useState('');

  return (
    <div className="h-full flex flex-col bg-[#0a0a1a] text-white/90">
      {/* Header */}
      <div className="shrink-0 px-4 sm:px-5 pt-4 pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white/90">Property Manager</h1>
              <p className="text-[10px] text-white/35">Manage your properties & tenants</p>
            </div>
          </div>
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 pr-3 text-xs bg-white/[0.04] border-white/[0.06] text-white/80 placeholder:text-white/25 rounded-xl focus:border-blue-500/30 focus:ring-1 focus:ring-blue-500/20 w-full"
            />
          </div>
        </div>

        {/* Scrollable tabs */}
        <ScrollArea className="w-full" orientation="horizontal">
          <div className="flex gap-1 pb-1 min-w-max">
            {([
              { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
              { key: 'properties', label: 'Properties', icon: Building2 },
              { key: 'tenants', label: 'Tenants', icon: Users },
              { key: 'units', label: 'Units', icon: DoorOpen },
              { key: 'payments', label: 'Payments', icon: Wallet },
              { key: 'maintenance', label: 'Maintenance', icon: Wrench },
            ] as const).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap ${
                  tab === t.key
                    ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                    : 'text-white/40 hover:text-white/60 hover:bg-white/[0.03] border border-transparent'
                }`}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'properties' && <PropertiesTab search={search} />}
        {tab === 'tenants' && <TenantsTab search={search} />}
        {tab === 'units' && <UnitsTab search={search} />}
        {tab === 'payments' && <PaymentsTab search={search} />}
        {tab === 'maintenance' && <MaintenanceTab search={search} />}
      </div>
    </div>
  );
}

/* ─────────────────────── DASHBOARD ─────────────────────── */

function DashboardTab() {
  const totalProperties = properties.length;
  const totalUnits = units.length;
  const occupiedUnits = units.filter((u) => u.status === 'Occupied').length;
  const occupancyRate = Math.round((occupiedUnits / totalUnits) * 100);
  const totalMonthlyIncome = properties.reduce((s, p) => s + p.monthlyIncome, 0);
  const collectedThisMonth = payments.filter((p) => p.status === 'Paid' && p.type === 'Rent').reduce((s, p) => s + p.amount, 0);
  const overduePayments = payments.filter((p) => p.status === 'Overdue').length;
  const pendingMaintenance = maintenanceRequests.filter((m) => m.status === 'Open' || m.status === 'In Progress').length;

  const recentPayments = [...payments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
  const recentMaintenance = [...maintenanceRequests].sort((a, b) => new Date(b.requested).getTime() - new Date(a.requested).getTime()).slice(0, 4);

  return (
    <ScrollArea className="h-full">
      <div className="p-4 sm:p-5 space-y-4">
        {/* KPI Grid - responsive */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPICard title="Properties" value={totalProperties.toString()} change="+1 this month" changeType="up" icon={Building2} />
          <KPICard title="Total Units" value={totalUnits.toString()} change="+4 added" changeType="up" icon={DoorOpen} />
          <KPICard title="Occupancy" value={`${occupancyRate}%`} change="+3% vs last" changeType="up" icon={Users} />
          <KPICard title="Monthly Rent" value={tzs(totalMonthlyIncome)} change="+8% vs last" changeType="up" icon={DollarSign} />
          <KPICard title="Collected" value={tzs(collectedThisMonth)} change="92% collection" changeType="up" icon={Receipt} />
          <KPICard title="Overdue" value={overduePayments.toString()} change="2 tenants late" changeType="down" icon={AlertCircle} />
        </div>

        {/* Middle row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Occupancy Chart */}
          <Card className="bg-white/[0.03] border-white/[0.06] lg:col-span-2">
            <CardHeader className="pb-2 px-4 pt-3">
              <CardTitle className="text-xs font-medium text-white/70">Occupancy Overview</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-3">
                {properties.slice(0, 5).map((p) => {
                  const pct = Math.round((p.occupied / p.units) * 100);
                  return (
                    <div key={p.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-white/60 truncate flex-1 mr-2">{p.name}</span>
                        <span className="text-[10px] text-white/40 shrink-0">{p.occupied}/{p.units} ({pct}%)</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            background: pct >= 90 ? 'linear-gradient(90deg, #10b981, #34d399)' : pct >= 70 ? 'linear-gradient(90deg, #3b82f6, #6366f1)' : 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="bg-white/[0.03] border-white/[0.06]">
            <CardHeader className="pb-2 px-4 pt-3">
              <CardTitle className="text-xs font-medium text-white/70">Pending Maintenance</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-4 space-y-2">
              {recentMaintenance.map((m) => (
                <div key={m.id} className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-white/[0.03] transition-colors">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    m.priority === 'Urgent' ? 'bg-red-500/15' : m.priority === 'High' ? 'bg-orange-500/15' : 'bg-blue-500/15'
                  }`}>
                    <Wrench className={`w-3.5 h-3.5 ${
                      m.priority === 'Urgent' ? 'text-red-400' : m.priority === 'High' ? 'text-orange-400' : 'text-blue-400'
                    }`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-white/70 truncate font-medium">{m.title}</p>
                    <p className="text-[10px] text-white/35">{m.unit} &middot; {m.requested}</p>
                  </div>
                  <StatusBadge status={m.priority} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Bottom: Recent Payments */}
        <Card className="bg-white/[0.03] border-white/[0.06]">
          <CardHeader className="pb-2 px-4 pt-3 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-white/70">Recent Payments</CardTitle>
            <span className="text-[10px] text-white/30">Last 5 transactions</span>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="overflow-x-auto -mx-1">
              <table className="w-full min-w-[500px] text-[11px]">
                <thead>
                  <tr className="text-white/30 border-b border-white/[0.06]">
                    <th className="text-left py-2 px-2 font-medium">Tenant</th>
                    <th className="text-left py-2 px-2 font-medium">Property</th>
                    <th className="text-left py-2 px-2 font-medium">Date</th>
                    <th className="text-left py-2 px-2 font-medium">Method</th>
                    <th className="text-right py-2 px-2 font-medium">Amount</th>
                    <th className="text-center py-2 px-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPayments.map((p) => (
                    <tr key={p.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="py-2.5 px-2 text-white/70">{p.tenantName}</td>
                      <td className="py-2.5 px-2 text-white/50">{properties.find((pr) => pr.id === p.propertyId)?.name || p.propertyId}</td>
                      <td className="py-2.5 px-2 text-white/40">{p.date}</td>
                      <td className="py-2.5 px-2">
                        <span className="flex items-center gap-1 text-white/50">
                          {p.method === 'Bank Transfer' && <Banknote className="w-3 h-3" />}
                          {p.method === 'Mobile Money' && <Smartphone className="w-3 h-3" />}
                          {p.method === 'Cash' && <DollarSign className="w-3 h-3" />}
                          {p.method === 'Card' && <CreditCard className="w-3 h-3" />}
                          {p.method}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right font-medium text-white/80">{tzs(p.amount)}</td>
                      <td className="py-2.5 px-2 text-center"><StatusBadge status={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}

/* ─────────────────────── PROPERTIES ─────────────────────── */

function PropertiesTab({ search }: { search: string }) {
  const [typeFilter, setTypeFilter] = useState('All');
  const [viewProperty, setViewProperty] = useState<Property | null>(null);

  const filtered = useMemo(() => {
    return properties.filter((p) => {
      const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.address.toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === 'All' || p.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [search, typeFilter]);

  return (
    <ScrollArea className="h-full">
      <div className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-8 w-36 text-xs bg-white/[0.04] border-white/[0.06] text-white/70 rounded-xl">
                <Filter className="w-3 h-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a2e] border-white/[0.08]">
                {['All', 'Residential', 'Commercial', 'Mixed-Use'].map((t) => (
                  <SelectItem key={t} value={t} className="text-xs text-white/70">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-[11px] text-white/30">{filtered.length} properties</span>
          </div>
          <Button size="sm" className="h-8 text-[11px] bg-blue-500 hover:bg-blue-600 rounded-xl">
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Property
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((p) => (
            <Card key={p.id} className="bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05] transition-all cursor-pointer group" onClick={() => setViewProperty(p)}>
              <CardContent className="p-0">
                <div className={`h-20 ${p.image} rounded-t-lg relative overflow-hidden`}>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between">
                    <h3 className="text-xs font-semibold text-white truncate">{p.name}</h3>
                    <StatusBadge status={p.status} />
                  </div>
                </div>
                <div className="p-3 space-y-2">
                  <div className="flex items-center gap-1 text-[10px] text-white/35">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate">{p.address}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-white/40"><Home className="w-3 h-3 inline mr-0.5" />{p.units} units</span>
                      <span className="text-[10px] text-white/40"><Users className="w-3 h-3 inline mr-0.5" />{p.occupied} occ</span>
                    </div>
                    <span className="text-[10px] font-medium text-white/60">{tzs(p.monthlyIncome)}<span className="text-white/30">/mo</span></span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-400"
                      style={{ width: `${(p.occupied / p.units) * 100}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* View Property Dialog */}
      <Dialog open={!!viewProperty} onOpenChange={() => setViewProperty(null)}>
        <DialogContent className="bg-[#0f0f1a] border-white/[0.08] text-white max-w-md max-h-[85vh] overflow-y-auto">
          {viewProperty && (
            <>
              <DialogHeader>
                <DialogTitle className="text-sm flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-400" />
                  {viewProperty.name}
                </DialogTitle>
              </DialogHeader>
              <div className={`h-28 ${viewProperty.image} rounded-xl mb-3`} />
              <div className="space-y-3 text-[11px]">
                <div className="flex items-center gap-2 text-white/50">
                  <MapPin className="w-3.5 h-3.5" /> {viewProperty.address}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/[0.03] rounded-lg p-2.5 text-center">
                    <div className="text-lg font-semibold text-white/80">{viewProperty.units}</div>
                    <div className="text-[10px] text-white/35">Total Units</div>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg p-2.5 text-center">
                    <div className="text-lg font-semibold text-emerald-400">{viewProperty.occupied}</div>
                    <div className="text-[10px] text-white/35">Occupied</div>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg p-2.5 text-center">
                    <div className="text-lg font-semibold text-amber-400">{viewProperty.units - viewProperty.occupied}</div>
                    <div className="text-[10px] text-white/35">Vacant</div>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg p-2.5 text-center">
                    <div className="text-lg font-semibold text-blue-400">{tzs(viewProperty.monthlyIncome)}</div>
                    <div className="text-[10px] text-white/35">Monthly Income</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </ScrollArea>
  );
}

/* ─────────────────────── TENANTS ─────────────────────── */

function TenantsTab({ search }: { search: string }) {
  const [statusFilter, setStatusFilter] = useState('All');
  const [viewTenant, setViewTenant] = useState<Tenant | null>(null);

  const filtered = useMemo(() => {
    return tenants.filter((t) => {
      const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.unit.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'All' || t.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [search, statusFilter]);

  return (
    <ScrollArea className="h-full">
      <div className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 overflow-x-auto">
            {['All', 'Active', 'Pending', 'Late', 'Moving Out'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all ${
                  statusFilter === s ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' : 'text-white/35 hover:text-white/50 border border-transparent'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <Button size="sm" className="h-8 text-[11px] bg-blue-500 hover:bg-blue-600 rounded-xl shrink-0">
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Tenant
          </Button>
        </div>

        <div className="space-y-2">
          {filtered.map((t) => {
            const property = properties.find((p) => p.id === t.propertyId);
            return (
              <div
                key={t.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-all cursor-pointer"
                onClick={() => setViewTenant(t)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                    {t.avatar}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12px] font-medium text-white/80 truncate">{t.name}</div>
                    <div className="text-[10px] text-white/35 truncate">{property?.name} &middot; Unit {t.unit}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:gap-4 ml-12 sm:ml-0">
                  <div className="text-right shrink-0">
                    <div className="text-[11px] font-medium text-white/60">{tzs(t.rent)}</div>
                    <div className="text-[10px] text-white/30">/month</div>
                  </div>
                  <StatusBadge status={t.status} />
                  <ChevronRight className="w-4 h-4 text-white/20 shrink-0 hidden sm:block" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={!!viewTenant} onOpenChange={() => setViewTenant(null)}>
        <DialogContent className="bg-[#0f0f1a] border-white/[0.08] text-white max-w-sm">
          {viewTenant && (
            <>
              <DialogHeader>
                <DialogTitle className="text-sm">{viewTenant.name}</DialogTitle>
              </DialogHeader>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-sm font-bold text-white">
                  {viewTenant.avatar}
                </div>
                <div>
                  <StatusBadge status={viewTenant.status} />
                  <p className="text-[11px] text-white/40 mt-1">{properties.find((p) => p.id === viewTenant.propertyId)?.name} &middot; {viewTenant.unit}</p>
                </div>
              </div>
              <div className="space-y-2 text-[11px]">
                <div className="flex items-center gap-2 text-white/50"><Phone className="w-3.5 h-3.5" /> {viewTenant.phone}</div>
                <div className="flex items-center gap-2 text-white/50"><Mail className="w-3.5 h-3.5" /> {viewTenant.email}</div>
                <div className="flex items-center gap-2 text-white/50"><Calendar className="w-3.5 h-3.5" /> {viewTenant.leaseStart} → {viewTenant.leaseEnd}</div>
                <div className="flex items-center gap-2 text-white/50"><DollarSign className="w-3.5 h-3.5" /> {tzs(viewTenant.rent)} / month</div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </ScrollArea>
  );
}

/* ─────────────────────── UNITS ─────────────────────── */

function UnitsTab({ search }: { search: string }) {
  const [statusFilter, setStatusFilter] = useState('All');
  const [propertyFilter, setPropertyFilter] = useState('All');

  const filtered = useMemo(() => {
    return units.filter((u) => {
      const matchSearch = !search || u.number.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'All' || u.status === statusFilter;
      const matchProperty = propertyFilter === 'All' || u.propertyId === propertyFilter;
      return matchSearch && matchStatus && matchProperty;
    });
  }, [search, statusFilter, propertyFilter]);

  return (
    <ScrollArea className="h-full">
      <div className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <Select value={propertyFilter} onValueChange={setPropertyFilter}>
            <SelectTrigger className="h-8 w-full sm:w-44 text-xs bg-white/[0.04] border-white/[0.06] text-white/70 rounded-xl">
              <Building2 className="w-3 h-3 mr-1" />
              <SelectValue placeholder="All Properties" />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a2e] border-white/[0.08]">
              <SelectItem value="All" className="text-xs text-white/70">All Properties</SelectItem>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs text-white/70">{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-1 overflow-x-auto">
            {['All', 'Occupied', 'Vacant', 'Maintenance', 'Reserved'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all ${
                  statusFilter === s ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' : 'text-white/35 hover:text-white/50 border border-transparent'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((u) => {
            const property = properties.find((p) => p.id === u.propertyId);
            return (
              <Card key={u.id} className="bg-white/[0.03] border-white/[0.06]">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="text-xs font-medium text-white/80">{u.number}</h4>
                      <p className="text-[10px] text-white/30 truncate max-w-[140px]">{property?.name}</p>
                    </div>
                    <StatusBadge status={u.status} />
                  </div>
                  <p className="text-[11px] text-white/50 mb-2">{u.type}</p>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[10px] text-white/30 flex items-center gap-0.5"><Bed className="w-3 h-3" />{u.beds}</span>
                    <span className="text-[10px] text-white/30 flex items-center gap-0.5"><Bath className="w-3 h-3" />{u.baths}</span>
                    <span className="text-[10px] text-white/30 flex items-center gap-0.5"><Square className="w-3 h-3" />{u.sqft} sqft</span>
                  </div>
                  {u.tenantName && (
                    <p className="text-[10px] text-white/35 mb-2 truncate">Tenant: {u.tenantName}</p>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
                    <span className="text-[11px] font-medium text-white/70">{tzs(u.rent)}<span className="text-white/30">/mo</span></span>
                    <div className="flex gap-0.5">
                      {u.amenities.slice(0, 3).map((a, i) => (
                        <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-white/30">{a}</span>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </ScrollArea>
  );
}

/* ─────────────────────── PAYMENTS ─────────────────────── */

function PaymentsTab({ search }: { search: string }) {
  const [statusFilter, setStatusFilter] = useState('All');

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      const matchSearch = !search || p.tenantName.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'All' || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [search, statusFilter]);

  const totals = useMemo(() => ({
    paid: payments.filter((p) => p.status === 'Paid').reduce((s, p) => s + p.amount, 0),
    pending: payments.filter((p) => p.status === 'Pending').reduce((s, p) => s + p.amount, 0),
    overdue: payments.filter((p) => p.status === 'Overdue').reduce((s, p) => s + p.amount, 0),
  }), []);

  return (
    <ScrollArea className="h-full">
      <div className="p-4 sm:p-5 space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card className="bg-emerald-500/[0.04] border-emerald-500/10">
            <CardContent className="p-3">
              <div className="text-[10px] text-emerald-400/60 mb-1">Total Paid</div>
              <div className="text-sm font-semibold text-emerald-400">{tzs(totals.paid)}</div>
            </CardContent>
          </Card>
          <Card className="bg-amber-500/[0.04] border-amber-500/10">
            <CardContent className="p-3">
              <div className="text-[10px] text-amber-400/60 mb-1">Pending</div>
              <div className="text-sm font-semibold text-amber-400">{tzs(totals.pending)}</div>
            </CardContent>
          </Card>
          <Card className="bg-red-500/[0.04] border-red-500/10 col-span-2 sm:col-span-1">
            <CardContent className="p-3">
              <div className="text-[10px] text-red-400/60 mb-1">Overdue</div>
              <div className="text-sm font-semibold text-red-400">{tzs(totals.overdue)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-1 overflow-x-auto">
          {['All', 'Paid', 'Pending', 'Overdue', 'Partial'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all ${
                statusFilter === s ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' : 'text-white/35 hover:text-white/50 border border-transparent'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Payment list */}
        <div className="space-y-2">
          {filtered.map((p) => (
            <div key={p.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  p.status === 'Paid' ? 'bg-emerald-500/15' : p.status === 'Overdue' ? 'bg-red-500/15' : 'bg-amber-500/15'
                }`}>
                  {p.method === 'Bank Transfer' && <Banknote className={`w-4 h-4 ${p.status === 'Paid' ? 'text-emerald-400' : 'text-white/40'}`} />}
                  {p.method === 'Mobile Money' && <Smartphone className={`w-4 h-4 ${p.status === 'Paid' ? 'text-emerald-400' : 'text-white/40'}`} />}
                  {p.method === 'Cash' && <DollarSign className={`w-4 h-4 ${p.status === 'Paid' ? 'text-emerald-400' : 'text-white/40'}`} />}
                  {p.method === 'Card' && <CreditCard className={`w-4 h-4 ${p.status === 'Paid' ? 'text-emerald-400' : 'text-white/40'}`} />}
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-white/70 truncate">{p.tenantName}</div>
                  <div className="text-[10px] text-white/30">{p.unit} &middot; {p.date}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 ml-11 sm:ml-0">
                <span className="text-[11px] font-medium text-white/70">{tzs(p.amount)}</span>
                <StatusBadge status={p.status} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}

/* ─────────────────────── MAINTENANCE ─────────────────────── */

function MaintenanceTab({ search }: { search: string }) {
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');

  const filtered = useMemo(() => {
    return maintenanceRequests.filter((m) => {
      const matchSearch = !search || m.title.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'All' || m.status === statusFilter;
      const matchPriority = priorityFilter === 'All' || m.priority === priorityFilter;
      return matchSearch && matchStatus && matchPriority;
    });
  }, [search, statusFilter, priorityFilter]);

  const counts = useMemo(() => ({
    open: maintenanceRequests.filter((m) => m.status === 'Open').length,
    inProgress: maintenanceRequests.filter((m) => m.status === 'In Progress').length,
    completed: maintenanceRequests.filter((m) => m.status === 'Completed').length,
  }), []);

  return (
    <ScrollArea className="h-full">
      <div className="p-4 sm:p-5 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-amber-500/[0.04] border-amber-500/10">
            <CardContent className="p-3 text-center">
              <div className="text-lg font-semibold text-amber-400">{counts.open}</div>
              <div className="text-[10px] text-amber-400/50">Open</div>
            </CardContent>
          </Card>
          <Card className="bg-blue-500/[0.04] border-blue-500/10">
            <CardContent className="p-3 text-center">
              <div className="text-lg font-semibold text-blue-400">{counts.inProgress}</div>
              <div className="text-[10px] text-blue-400/50">In Progress</div>
            </CardContent>
          </Card>
          <Card className="bg-emerald-500/[0.04] border-emerald-500/10">
            <CardContent className="p-3 text-center">
              <div className="text-lg font-semibold text-emerald-400">{counts.completed}</div>
              <div className="text-[10px] text-emerald-400/50">Completed</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex gap-1 overflow-x-auto">
            {['All', 'Open', 'In Progress', 'Completed'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all ${
                  statusFilter === s ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' : 'text-white/35 hover:text-white/50 border border-transparent'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {['All', 'Urgent', 'High', 'Medium', 'Low'].map((s) => (
              <button
                key={s}
                onClick={() => setPriorityFilter(s)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all ${
                  priorityFilter === s ? 'bg-red-500/15 text-red-400 border border-red-500/20' : 'text-white/35 hover:text-white/50 border border-transparent'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Requests */}
        <div className="space-y-2">
          {filtered.map((m) => {
            const property = properties.find((p) => p.id === m.propertyId);
            return (
              <Card key={m.id} className="bg-white/[0.03] border-white/[0.06]">
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      m.priority === 'Urgent' ? 'bg-red-500/15' : m.priority === 'High' ? 'bg-orange-500/15' : m.priority === 'Medium' ? 'bg-blue-500/15' : 'bg-gray-500/15'
                    }`}>
                      <Wrench className={`w-4 h-4 ${
                        m.priority === 'Urgent' ? 'text-red-400' : m.priority === 'High' ? 'text-orange-400' : m.priority === 'Medium' ? 'text-blue-400' : 'text-gray-400'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-[12px] font-medium text-white/80">{m.title}</span>
                        <StatusBadge status={m.priority} />
                      </div>
                      <p className="text-[10px] text-white/35 mb-1.5">{property?.name} &middot; {m.unit}</p>
                      <p className="text-[11px] text-white/50 mb-2">{m.description}</p>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-[10px] text-white/30 flex items-center gap-1"><Calendar className="w-3 h-3" />{m.requested}</span>
                        {m.assigned && <span className="text-[10px] text-white/30 flex items-center gap-1"><Users className="w-3 h-3" />{m.assigned}</span>}
                        {m.cost && <span className="text-[10px] text-white/30 flex items-center gap-1"><DollarSign className="w-3 h-3" />{tzs(m.cost)}</span>}
                        <StatusBadge status={m.status} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </ScrollArea>
  );
}
