import { useState, useMemo, useCallback } from 'react';
import {
  Building2, Users, BarChart3, Search,
  Phone, Mail, MapPin, Bed, Bath, Square,
  DollarSign, Calendar,
  Receipt, CreditCard, Banknote, Smartphone, DoorOpen,
  CheckCircle2, AlertCircle, QrCode, Send,
  MessageSquare, ScanLine, UserCheck,
  TrendingUp, Check,
  Eye, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QRCodeSVG } from 'qrcode.react';

/* ─────────────────── TYPES ─────────────────── */

interface Property {
  id: string; name: string; address: string;
  type: 'Residential' | 'Commercial' | 'Mixed-Use';
  units: number; occupied: number;
  status: 'Active' | 'Under Renovation' | 'Inactive';
  monthlyIncome: number; annualIncome: number;
  gradient: string;
}

interface Tenant {
  id: string; name: string; phone: string; email: string;
  propertyId: string; unit: string;
  leaseStart: string; leaseEnd: string;
  monthlyRent: number; annualRent: number;
  status: 'Active' | 'Pending' | 'Late' | 'Moving Out';
  avatar: string; shortCode: string;
  amountPaid: number; balance: number;
  paidMonths: string[]; unpaidMonths: string[];
}

interface Unit {
  id: string; propertyId: string; number: string;
  type: string; beds: number; baths: number; sqft: number;
  rent: number; status: 'Occupied' | 'Vacant' | 'Maintenance' | 'Reserved';
  tenantName?: string; tenantId?: string; amenities: string[];
}

interface Payment {
  id: string; tenantId: string; tenantName: string;
  propertyId: string; unit: string; amount: number;
  date: string; month: string; year: number;
  method: 'Bank Transfer' | 'Cash' | 'Mobile Money' | 'Card';
  status: 'Paid' | 'Pending' | 'Overdue' | 'Partial';
  type: 'Rent' | 'Deposit' | 'Maintenance' | 'Utility';
  receiptNo: string;
}

/* ─────────────────── DEMO DATA ─────────────────── */

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CURRENT_YEAR = 2025;

const properties: Property[] = [
  { id: 'p1', name: 'Mbezi Beach Apartments', address: 'Mbezi Beach, Dar es Salaam', type: 'Residential', units: 24, occupied: 20, status: 'Active', monthlyIncome: 48000000, annualIncome: 576000000, gradient: 'from-blue-600 to-indigo-700' },
  { id: 'p2', name: 'Masaki Office Complex', address: 'Masaki, Dar es Salaam', type: 'Commercial', units: 12, occupied: 10, status: 'Active', monthlyIncome: 72000000, annualIncome: 864000000, gradient: 'from-emerald-600 to-teal-700' },
  { id: 'p3', name: 'Mikocheni Villas', address: 'Mikocheni, Dar es Salaam', type: 'Residential', units: 8, occupied: 8, status: 'Active', monthlyIncome: 32000000, annualIncome: 384000000, gradient: 'from-amber-600 to-orange-700' },
  { id: 'p4', name: 'Kariakor Retail Plaza', address: 'Kariakor, Dar es Salaam', type: 'Commercial', units: 18, occupied: 14, status: 'Active', monthlyIncome: 54000000, annualIncome: 648000000, gradient: 'from-rose-600 to-pink-700' },
  { id: 'p5', name: 'Upanga Heights', address: 'Upanga, Dar es Salaam', type: 'Mixed-Use', units: 32, occupied: 28, status: 'Active', monthlyIncome: 64000000, annualIncome: 768000000, gradient: 'from-violet-600 to-purple-700' },
];

const tenants: Tenant[] = [
  { id: 't1', name: 'James Mwakasege', phone: '+255 712 345 678', email: 'james.m@email.com', propertyId: 'p1', unit: 'A-12', leaseStart: '2024-01-15', leaseEnd: '2025-01-14', monthlyRent: 2500000, annualRent: 30000000, status: 'Active', avatar: 'JM', shortCode: 'KBE0001', amountPaid: 27500000, balance: 2500000, paidMonths: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov'], unpaidMonths: ['Dec'] },
  { id: 't2', name: 'Grace Mwangala', phone: '+255 713 456 789', email: 'grace.m@email.com', propertyId: 'p1', unit: 'B-05', leaseStart: '2024-03-01', leaseEnd: '2025-02-28', monthlyRent: 1800000, annualRent: 21600000, status: 'Active', avatar: 'GM', shortCode: 'KBE0002', amountPaid: 19800000, balance: 1800000, paidMonths: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov'], unpaidMonths: ['Dec'] },
  { id: 't3', name: 'KOBEPay Technologies', phone: '+255 714 567 890', email: 'admin@kobepay.co.tz', propertyId: 'p2', unit: 'Suite-301', leaseStart: '2024-06-01', leaseEnd: '2026-05-31', monthlyRent: 6000000, annualRent: 72000000, status: 'Active', avatar: 'KT', shortCode: 'KBE0003', amountPaid: 66000000, balance: 6000000, paidMonths: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov'], unpaidMonths: ['Dec'] },
  { id: 't4', name: 'Safari Logistics Ltd', phone: '+255 715 678 901', email: 'info@safarilog.co.tz', propertyId: 'p2', unit: 'Suite-205', leaseStart: '2024-04-15', leaseEnd: '2025-04-14', monthlyRent: 4500000, annualRent: 54000000, status: 'Late', avatar: 'SL', shortCode: 'KBE0004', amountPaid: 40500000, balance: 13500000, paidMonths: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep'], unpaidMonths: ['Oct','Nov','Dec'] },
  { id: 't5', name: 'Dr. Amina Rashid', phone: '+255 716 789 012', email: 'amina.r@email.com', propertyId: 'p3', unit: 'Villa-3', leaseStart: '2024-02-01', leaseEnd: '2025-01-31', monthlyRent: 4000000, annualRent: 48000000, status: 'Active', avatar: 'AR', shortCode: 'KBE0005', amountPaid: 48000000, balance: 0, paidMonths: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], unpaidMonths: [] },
  { id: 't6', name: 'Bongo Foods Ltd', phone: '+255 717 890 123', email: 'orders@bongofoods.co.tz', propertyId: 'p4', unit: 'Shop-08', leaseStart: '2024-05-01', leaseEnd: '2025-04-30', monthlyRent: 3000000, annualRent: 36000000, status: 'Active', avatar: 'BF', shortCode: 'KBE0006', amountPaid: 33000000, balance: 3000000, paidMonths: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov'], unpaidMonths: ['Dec'] },
  { id: 't7', name: 'Peter Omondi', phone: '+255 718 901 234', email: 'peter.o@email.com', propertyId: 'p5', unit: 'PH-01', leaseStart: '2024-07-01', leaseEnd: '2025-06-30', monthlyRent: 5500000, annualRent: 66000000, status: 'Moving Out', avatar: 'PO', shortCode: 'KBE0007', amountPaid: 49500000, balance: 16500000, paidMonths: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep'], unpaidMonths: ['Oct','Nov','Dec'] },
  { id: 't8', name: 'Mary Kisare', phone: '+255 719 012 345', email: 'mary.k@email.com', propertyId: 'p1', unit: 'C-08', leaseStart: '2024-08-01', leaseEnd: '2025-07-31', monthlyRent: 2200000, annualRent: 26400000, status: 'Pending', avatar: 'MK', shortCode: 'KBE0008', amountPaid: 0, balance: 26400000, paidMonths: [], unpaidMonths: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] },
  { id: 't9', name: 'Hassan Mdee', phone: '+255 720 123 456', email: 'hassan.m@email.com', propertyId: 'p3', unit: 'Villa-1', leaseStart: '2024-05-15', leaseEnd: '2025-05-14', monthlyRent: 3500000, annualRent: 42000000, status: 'Active', avatar: 'HM', shortCode: 'KBE0009', amountPaid: 38500000, balance: 3500000, paidMonths: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov'], unpaidMonths: ['Dec'] },
  { id: 't10', name: 'Nuru Enterprises', phone: '+255 721 234 567', email: 'accounts@nuru.co.tz', propertyId: 'p4', unit: 'Shop-12', leaseStart: '2024-09-01', leaseEnd: '2025-08-31', monthlyRent: 2500000, annualRent: 30000000, status: 'Late', avatar: 'NE', shortCode: 'KBE0010', amountPaid: 22500000, balance: 7500000, paidMonths: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep'], unpaidMonths: ['Oct','Nov','Dec'] },
];

const units: Unit[] = [
  { id: 'u1', propertyId: 'p1', number: 'A-12', type: '2 Bedroom', beds: 2, baths: 1, sqft: 850, rent: 2500000, status: 'Occupied', tenantName: 'James Mwakasege', tenantId: 't1', amenities: ['Parking','Gated','Water'] },
  { id: 'u2', propertyId: 'p1', number: 'B-05', type: '1 Bedroom', beds: 1, baths: 1, sqft: 550, rent: 1800000, status: 'Occupied', tenantName: 'Grace Mwangala', tenantId: 't2', amenities: ['Parking','Water'] },
  { id: 'u3', propertyId: 'p1', number: 'C-08', type: 'Studio', beds: 0, baths: 1, sqft: 400, rent: 1200000, status: 'Occupied', tenantName: 'Mary Kisare', tenantId: 't8', amenities: ['Water'] },
  { id: 'u4', propertyId: 'p1', number: 'A-01', type: '3 Bedroom', beds: 3, baths: 2, sqft: 1200, rent: 3500000, status: 'Vacant', amenities: ['Parking','Gated','Water','Garden'] },
  { id: 'u5', propertyId: 'p2', number: 'Suite-301', type: 'Office', beds: 0, baths: 2, sqft: 1500, rent: 6000000, status: 'Occupied', tenantName: 'KOBEPay Technologies', tenantId: 't3', amenities: ['Parking','Security','Generator'] },
  { id: 'u6', propertyId: 'p2', number: 'Suite-205', type: 'Office', beds: 0, baths: 1, sqft: 1100, rent: 4500000, status: 'Occupied', tenantName: 'Safari Logistics Ltd', tenantId: 't4', amenities: ['Parking','Security'] },
  { id: 'u7', propertyId: 'p2', number: 'Shop-01', type: 'Retail', beds: 0, baths: 1, sqft: 600, rent: 2800000, status: 'Vacant', amenities: ['Street Front'] },
  { id: 'u8', propertyId: 'p3', number: 'Villa-3', type: '3 Bedroom Villa', beds: 3, baths: 3, sqft: 2200, rent: 4000000, status: 'Occupied', tenantName: 'Dr. Amina Rashid', tenantId: 't5', amenities: ['Parking','Gated','Pool','Garden'] },
  { id: 'u9', propertyId: 'p3', number: 'Villa-1', type: '4 Bedroom Villa', beds: 4, baths: 4, sqft: 2800, rent: 3500000, status: 'Occupied', tenantName: 'Hassan Mdee', tenantId: 't9', amenities: ['Parking','Pool','Gym','Garden'] },
  { id: 'u10', propertyId: 'p4', number: 'Shop-08', type: 'Retail', beds: 0, baths: 1, sqft: 450, rent: 3000000, status: 'Occupied', tenantName: 'Bongo Foods Ltd', tenantId: 't6', amenities: ['Street Front','Storage'] },
  { id: 'u11', propertyId: 'p4', number: 'Shop-12', type: 'Retail', beds: 0, baths: 1, sqft: 500, rent: 2500000, status: 'Occupied', tenantName: 'Nuru Enterprises', tenantId: 't10', amenities: ['Street Front','Storage'] },
  { id: 'u12', propertyId: 'p5', number: 'PH-01', type: 'Penthouse', beds: 4, baths: 3, sqft: 2800, rent: 5500000, status: 'Occupied', tenantName: 'Peter Omondi', tenantId: 't7', amenities: ['Parking','Pool','Gym','Elevator'] },
  { id: 'u13', propertyId: 'p5', number: '2B-04', type: '2 Bedroom', beds: 2, baths: 1, sqft: 900, rent: 2800000, status: 'Vacant', amenities: ['Parking','Water'] },
];

const payments: Payment[] = [
  { id: 'pay1', tenantId: 't1', tenantName: 'James Mwakasege', propertyId: 'p1', unit: 'A-12', amount: 2500000, date: '2025-11-01', month: 'Nov', year: 2025, method: 'Bank Transfer', status: 'Paid', type: 'Rent', receiptNo: 'RCP-2025-001' },
  { id: 'pay2', tenantId: 't2', tenantName: 'Grace Mwangala', propertyId: 'p1', unit: 'B-05', amount: 1800000, date: '2025-11-02', month: 'Nov', year: 2025, method: 'Mobile Money', status: 'Paid', type: 'Rent', receiptNo: 'RCP-2025-002' },
  { id: 'pay3', tenantId: 't3', tenantName: 'KOBEPay Technologies', propertyId: 'p2', unit: 'Suite-301', amount: 6000000, date: '2025-11-01', month: 'Nov', year: 2025, method: 'Bank Transfer', status: 'Paid', type: 'Rent', receiptNo: 'RCP-2025-003' },
  { id: 'pay4', tenantId: 't4', tenantName: 'Safari Logistics Ltd', propertyId: 'p2', unit: 'Suite-205', amount: 4500000, date: '2025-09-15', month: 'Sep', year: 2025, method: 'Bank Transfer', status: 'Paid', type: 'Rent', receiptNo: 'RCP-2025-004' },
  { id: 'pay5', tenantId: 't5', tenantName: 'Dr. Amina Rashid', propertyId: 'p3', unit: 'Villa-3', amount: 4000000, date: '2025-11-03', month: 'Nov', year: 2025, method: 'Mobile Money', status: 'Paid', type: 'Rent', receiptNo: 'RCP-2025-005' },
  { id: 'pay6', tenantId: 't6', tenantName: 'Bongo Foods Ltd', propertyId: 'p4', unit: 'Shop-08', amount: 3000000, date: '2025-11-01', month: 'Nov', year: 2025, method: 'Cash', status: 'Paid', type: 'Rent', receiptNo: 'RCP-2025-006' },
  { id: 'pay7', tenantId: 't7', tenantName: 'Peter Omondi', propertyId: 'p5', unit: 'PH-01', amount: 3000000, date: '2025-10-01', month: 'Oct', year: 2025, method: 'Bank Transfer', status: 'Partial', type: 'Rent', receiptNo: 'RCP-2025-007' },
  { id: 'pay8', tenantId: 't8', tenantName: 'Mary Kisare', propertyId: 'p1', unit: 'C-08', amount: 0, date: '', month: 'Nov', year: 2025, method: 'Bank Transfer', status: 'Overdue', type: 'Rent', receiptNo: '' },
  { id: 'pay9', tenantId: 't9', tenantName: 'Hassan Mdee', propertyId: 'p3', unit: 'Villa-1', amount: 3500000, date: '2025-11-05', month: 'Nov', year: 2025, method: 'Mobile Money', status: 'Paid', type: 'Rent', receiptNo: 'RCP-2025-009' },
  { id: 'pay10', tenantId: 't10', tenantName: 'Nuru Enterprises', propertyId: 'p4', unit: 'Shop-12', amount: 0, date: '', month: 'Nov', year: 2025, method: 'Cash', status: 'Overdue', type: 'Rent', receiptNo: '' },
];



/* ─────────────────── HELPERS ─────────────────── */

const tzs = (n: number) => `TZS ${n.toLocaleString()}`;

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
  Reserved: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  Maintenance: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  Urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
  High: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  Medium: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  Low: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
};

const StatusBadge = ({ status }: { status: string }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusColors[status] || 'bg-gray-500/15 text-gray-400'}`}>
    {status}
  </span>
);

const getProperty = (id: string) => properties.find(p => p.id === id);
const getTenant = (id: string) => tenants.find(t => t.id === id);

/* ─────────────────── MONTH STATUS ─────────────────── */

function MonthIndicator({ month, paidMonths, unpaidMonths }: { month: string; paidMonths: string[]; unpaidMonths: string[] }) {
  const isPaid = paidMonths.includes(month);
  const isUnpaid = unpaidMonths.includes(month);
  return (
    <div className={`text-center px-1 py-1 rounded text-[9px] font-medium ${
      isPaid ? 'bg-emerald-500/20 text-emerald-400' :
      isUnpaid ? 'bg-red-500/20 text-red-400' :
      'bg-white/[0.03] text-white/20'
    }`}>
      {month}
    </div>
  );
}

/* ─────────────────── KPI CARD ─────────────────── */

const KPICard = ({ title, value, sub, icon: Icon, color = 'blue' }: {
  title: string; value: string; sub?: string; icon: any; color?: string;
}) => {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-400', emerald: 'text-emerald-400', amber: 'text-amber-400',
    red: 'text-red-400', violet: 'text-violet-400', rose: 'text-rose-400',
  };
  return (
    <Card className="bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05] transition-colors">
      <CardContent className="p-3">
        <div className="flex items-start justify-between mb-2">
          <span className="text-[10px] text-white/40 font-medium">{title}</span>
          <Icon className={`w-4 h-4 ${colorMap[color] || 'text-white/40'}`} />
        </div>
        <div className="text-sm font-semibold text-white/90">{value}</div>
        {sub && <div className="text-[10px] text-white/30 mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
};

/* ─────────────────── MAIN APP ─────────────────── */

type Tab = 'dashboard' | 'properties' | 'tenants' | 'units' | 'payments' | 'cashier';

export default function PropertyManager() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [search, setSearch] = useState('');

  const tabs = [
    { key: 'dashboard' as Tab, label: 'Dashboard', icon: BarChart3 },
    { key: 'properties' as Tab, label: 'Properties', icon: Building2 },
    { key: 'tenants' as Tab, label: 'Tenants', icon: Users },
    { key: 'units' as Tab, label: 'Units', icon: DoorOpen },
    { key: 'payments' as Tab, label: 'Payments', icon: Receipt },
    { key: 'cashier' as Tab, label: 'Cashier', icon: ScanLine },
  ];

  return (
    <div className="h-full flex flex-col bg-[#0a0a1a] text-white/90">
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white/90">Property Manager</h1>
              <p className="text-[10px] text-white/35">Manage properties, tenants & payments</p>
            </div>
          </div>
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <Input
              placeholder="Search tenants, units, receipts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 pr-3 text-xs bg-white/[0.04] border-white/[0.06] text-white/80 placeholder:text-white/25 rounded-xl w-full"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 pb-1 overflow-x-auto scrollbar-hide">
          {tabs.map(t => (
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
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === 'dashboard' && <DashboardTab search={search} />}
        {tab === 'properties' && <PropertiesTab search={search} />}
        {tab === 'tenants' && <TenantsTab search={search} />}
        {tab === 'units' && <UnitsTab search={search} />}
        {tab === 'payments' && <PaymentsTab search={search} />}
        {tab === 'cashier' && <CashierTab search={search} />}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   DASHBOARD TAB
   ═══════════════════════════════════════════════════ */

function DashboardTab({ search: _search }: { search: string }) {
  const [selectedProperty, setSelectedProperty] = useState<string>('all');
  const [viewTenant, setViewTenant] = useState<Tenant | null>(null);

  const totalAnnualIncome = properties.reduce((s, p) => s + p.annualIncome, 0);
  const totalCollected = tenants.reduce((s, t) => s + t.amountPaid, 0);
  const totalBalance = tenants.reduce((s, t) => s + t.balance, 0);
  const collectionRate = Math.round((totalCollected / totalAnnualIncome) * 100);
  const occupiedUnits = units.filter(u => u.status === 'Occupied').length;
  const totalUnits = units.length;
  const overdueTenants = tenants.filter(t => t.unpaidMonths.length > 0);

  const filteredProperties = selectedProperty === 'all'
    ? properties
    : properties.filter(p => p.id === selectedProperty);

  const propertyTenants = (pId: string) => tenants.filter(t => t.propertyId === pId);
  const propertyPaid = (pId: string) => propertyTenants(pId).reduce((s, t) => s + t.amountPaid, 0);
  const propertyBalance = (pId: string) => propertyTenants(pId).reduce((s, t) => s + t.balance, 0);

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Annual Income Summary */}
        <Card className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-semibold text-white/90">Annual Income Overview</h2>
              <span className="text-[10px] text-white/40 ml-auto">{CURRENT_YEAR}</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-lg font-bold text-white/90">{tzs(totalAnnualIncome)}</div>
                <div className="text-[10px] text-white/40">Total Annual Rent</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-emerald-400">{tzs(totalCollected)}</div>
                <div className="text-[10px] text-white/40">Collected ({collectionRate}%)</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-amber-400">{tzs(totalBalance)}</div>
                <div className="text-[10px] text-white/40">Remaining Balance</div>
              </div>
            </div>
            <div className="mt-3 h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all"
                style={{ width: `${collectionRate}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* KPI Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KPICard title="Properties" value={properties.length.toString()} icon={Building2} color="blue" />
          <KPICard title="Occupancy" value={`${occupiedUnits}/${totalUnits}`} sub={`${Math.round((occupiedUnits/totalUnits)*100)}% occupied`} icon={Users} color="emerald" />
          <KPICard title="Tenants" value={tenants.length.toString()} sub={`${overdueTenants.length} with balance`} icon={UserCheck} color="violet" />
          <KPICard title="Overdue" value={overdueTenants.length.toString()} sub={`${tzs(totalBalance)} outstanding`} icon={AlertCircle} color="red" />
        </div>

        {/* Property Filter */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setSelectedProperty('all')}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all ${
              selectedProperty === 'all' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' : 'text-white/40 hover:text-white/60 border border-transparent'
            }`}
          >
            All Properties
          </button>
          {properties.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedProperty(p.id)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all ${
                selectedProperty === p.id ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' : 'text-white/40 hover:text-white/60 border border-transparent'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>

        {/* Property Income Cards */}
        <div className="space-y-3">
          {filteredProperties.map(p => {
            const pt = propertyTenants(p.id);
            const paid = propertyPaid(p.id);
            const bal = propertyBalance(p.id);
            const pct = Math.round((paid / p.annualIncome) * 100);
            return (
              <Card key={p.id} className="bg-white/[0.03] border-white/[0.06]">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${p.gradient} flex items-center justify-center`}>
                        <Building2 className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xs font-medium text-white/80">{p.name}</h3>
                        <p className="text-[10px] text-white/30">{p.occupied}/{p.units} units occupied</p>
                      </div>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div className="bg-white/[0.03] rounded-lg p-2 text-center">
                      <div className="text-xs font-semibold text-white/80">{tzs(p.annualIncome)}</div>
                      <div className="text-[9px] text-white/30">Annual</div>
                    </div>
                    <div className="bg-emerald-500/[0.05] rounded-lg p-2 text-center">
                      <div className="text-xs font-semibold text-emerald-400">{tzs(paid)}</div>
                      <div className="text-[9px] text-emerald-400/50">Collected</div>
                    </div>
                    <div className="bg-amber-500/[0.05] rounded-lg p-2 text-center">
                      <div className="text-xs font-semibold text-amber-400">{tzs(bal)}</div>
                      <div className="text-[9px] text-amber-400/50">Balance</div>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden mb-2">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500" style={{ width: `${pct}%` }} />
                  </div>
                  {/* Occupied Units with Tenant Status */}
                  <div className="space-y-1.5">
                    {pt.slice(0, 3).map(t => (
                      <button
                        key={t.id}
                        onClick={() => setViewTenant(t)}
                        className="w-full flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] transition-colors text-left"
                      >
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                          {t.avatar}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] text-white/70 truncate">{t.name}</div>
                          <div className="text-[9px] text-white/30">Unit {t.unit} &middot; {tzs(t.monthlyRent)}/mo</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[10px] text-white/50">{tzs(t.amountPaid)}</div>
                          <div className="text-[9px] text-amber-400/60">{tzs(t.balance)} bal</div>
                        </div>
                        <StatusBadge status={t.balance === 0 ? 'Paid' : t.unpaidMonths.length > 2 ? 'Overdue' : t.unpaidMonths.length > 0 ? 'Partial' : 'Paid'} />
                      </button>
                    ))}
                    {pt.length > 3 && (
                      <div className="text-center text-[10px] text-white/30 py-1">+{pt.length - 3} more tenants</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Tenant Detail Dialog */}
      <TenantDialog tenant={viewTenant} onClose={() => setViewTenant(null)} />
    </ScrollArea>
  );
}

/* ═══════════════════════════════════════════════════
   PROPERTIES TAB
   ═══════════════════════════════════════════════════ */

function PropertiesTab({ search }: { search: string }) {
  const [viewProperty, setViewProperty] = useState<Property | null>(null);

  const filtered = useMemo(() => {
    return properties.filter(p =>
      !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.address.toLowerCase().includes(search.toLowerCase())
    );
  }, [search]);

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-3">
        {filtered.map(p => {
          const pt = tenants.filter(t => t.propertyId === p.id);
          const paid = pt.reduce((s, t) => s + t.amountPaid, 0);
          const bal = pt.reduce((s, t) => s + t.balance, 0);
          const pct = Math.round((paid / p.annualIncome) * 100);
          return (
            <Card key={p.id} className="bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05] transition-all cursor-pointer" onClick={() => setViewProperty(p)}>
              <CardContent className="p-0">
                <div className={`h-16 bg-gradient-to-r ${p.gradient} rounded-t-lg relative`}>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between">
                    <h3 className="text-xs font-semibold text-white">{p.name}</h3>
                    <StatusBadge status={p.status} />
                  </div>
                </div>
                <div className="p-3 space-y-2">
                  <div className="flex items-center gap-1 text-[10px] text-white/35">
                    <MapPin className="w-3 h-3" />
                    <span>{p.address}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="text-center"><div className="text-[11px] font-medium text-white/70">{p.units}</div><div className="text-[9px] text-white/30">Units</div></div>
                    <div className="text-center"><div className="text-[11px] font-medium text-emerald-400">{p.occupied}</div><div className="text-[9px] text-white/30">Occupied</div></div>
                    <div className="text-center"><div className="text-[11px] font-medium text-blue-400">{tzs(p.annualIncome)}</div><div className="text-[9px] text-white/30">Annual</div></div>
                    <div className="text-center"><div className="text-[11px] font-medium text-amber-400">{tzs(bal)}</div><div className="text-[9px] text-white/30">Balance</div></div>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

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
              <div className={`h-24 bg-gradient-to-r ${viewProperty.gradient} rounded-xl mb-3`} />
              <div className="space-y-3 text-[11px]">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/[0.03] rounded-lg p-2.5 text-center">
                    <div className="text-base font-semibold text-white/80">{viewProperty.units}</div>
                    <div className="text-[10px] text-white/35">Total Units</div>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg p-2.5 text-center">
                    <div className="text-base font-semibold text-emerald-400">{viewProperty.occupied}</div>
                    <div className="text-[10px] text-white/35">Occupied</div>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg p-2.5 text-center">
                    <div className="text-base font-semibold text-blue-400">{tzs(viewProperty.annualIncome)}</div>
                    <div className="text-[10px] text-white/35">Annual Income</div>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg p-2.5 text-center">
                    <div className="text-base font-semibold text-amber-400">{tzs(viewProperty.annualIncome - tenants.filter(t => t.propertyId === viewProperty.id).reduce((s, t) => s + t.amountPaid, 0))}</div>
                    <div className="text-[10px] text-white/35">Remaining</div>
                  </div>
                </div>
                <h4 className="text-xs font-medium text-white/60 pt-1">Tenants</h4>
                {tenants.filter(t => t.propertyId === viewProperty.id).map(t => (
                  <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.03]">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[10px] font-bold text-white">{t.avatar}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-white/70 truncate">{t.name}</div>
                      <div className="text-[9px] text-white/30">{t.unit} &middot; {t.phone}</div>
                    </div>
                    <StatusBadge status={t.balance === 0 ? 'Paid' : t.unpaidMonths.length > 0 ? 'Partial' : 'Paid'} />
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </ScrollArea>
  );
}

/* ═══════════════════════════════════════════════════
   TENANTS TAB
   ═══════════════════════════════════════════════════ */

function TenantsTab({ search }: { search: string }) {
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [viewTenant, setViewTenant] = useState<Tenant | null>(null);
  const [smsDialog, setSmsDialog] = useState<Tenant | null>(null);
  const [smsText, setSmsText] = useState('');
  const [smsSent, setSmsSent] = useState(false);
  const [qrDialog, setQrDialog] = useState<Tenant | null>(null);

  const filtered = useMemo(() => {
    return tenants.filter(t => {
      const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.unit.toLowerCase().includes(search.toLowerCase()) || t.phone.includes(search) || t.shortCode.toLowerCase().includes(search.toLowerCase());
      const matchProperty = propertyFilter === 'all' || t.propertyId === propertyFilter;
      return matchSearch && matchProperty;
    });
  }, [search, propertyFilter]);

  const sendSMS = () => {
    setSmsSent(true);
    setTimeout(() => {
      setSmsSent(false);
      setSmsDialog(null);
      setSmsText('');
    }, 2000);
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-3">
        {/* Property Filter */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          <button onClick={() => setPropertyFilter('all')} className={`px-3 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all ${propertyFilter === 'all' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' : 'text-white/40 hover:text-white/60 border border-transparent'}`}>
            All Properties
          </button>
          {properties.map(p => (
            <button key={p.id} onClick={() => setPropertyFilter(p.id)} className={`px-3 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all ${propertyFilter === p.id ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' : 'text-white/40 hover:text-white/60 border border-transparent'}`}>
              {p.name}
            </button>
          ))}
        </div>

        {/* Tenant Cards */}
        {filtered.map(t => {
          const property = getProperty(t.propertyId);
          const paymentStatus = t.balance === 0 ? 'Fully Paid' : t.unpaidMonths.length > 2 ? 'Overdue' : 'Partial';
          return (
            <Card key={t.id} className="bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05] transition-all">
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
                    {t.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-[12px] font-medium text-white/80">{t.name}</span>
                      <StatusBadge status={paymentStatus} />
                    </div>
                    <div className="text-[10px] text-white/35 mb-1">{property?.name} &middot; Unit {t.unit}</div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-[10px] text-white/40 flex items-center gap-1"><Phone className="w-3 h-3" />{t.phone}</span>
                      <span className="text-[10px] text-blue-400 font-mono bg-blue-500/10 px-1.5 py-0.5 rounded">{t.shortCode}</span>
                    </div>
                    {/* Monthly Payment Grid */}
                    <div className="grid grid-cols-12 gap-0.5 mb-2">
                      {MONTHS.map(m => (
                        <MonthIndicator key={m} month={m} paidMonths={t.paidMonths} unpaidMonths={t.unpaidMonths} />
                      ))}
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-white/[0.04]">
                      <div className="text-[10px] text-white/40">
                        Paid: <span className="text-emerald-400">{tzs(t.amountPaid)}</span>
                        {' · '}Bal: <span className="text-amber-400">{tzs(t.balance)}</span>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => setQrDialog(t)} className="w-6 h-6 rounded-lg bg-white/[0.06] flex items-center justify-center hover:bg-white/[0.1] transition-colors" title="QR Code">
                          <QrCode className="w-3 h-3 text-white/50" />
                        </button>
                        <button onClick={() => setSmsDialog(t)} className="w-6 h-6 rounded-lg bg-white/[0.06] flex items-center justify-center hover:bg-white/[0.1] transition-colors" title="Send SMS">
                          <MessageSquare className="w-3 h-3 text-white/50" />
                        </button>
                        <button onClick={() => setViewTenant(t)} className="w-6 h-6 rounded-lg bg-blue-500/15 flex items-center justify-center hover:bg-blue-500/25 transition-colors" title="View Details">
                          <Eye className="w-3 h-3 text-blue-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tenant Detail Dialog */}
      <TenantDialog tenant={viewTenant} onClose={() => setViewTenant(null)} />

      {/* QR Code Dialog */}
      <Dialog open={!!qrDialog} onOpenChange={() => setQrDialog(null)}>
        <DialogContent className="bg-[#0f0f1a] border-white/[0.08] text-white max-w-xs">
          {qrDialog && (
            <>
              <DialogHeader>
                <DialogTitle className="text-sm flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-blue-400" />
                  Tenant QR Code
                </DialogTitle>
              </DialogHeader>
              <div className="flex flex-col items-center gap-3 py-2">
                <div className="bg-white p-3 rounded-xl">
                  <QRCodeSVG value={`KOBE:${qrDialog.shortCode}:${qrDialog.phone}`} size={160} />
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium text-white/80">{qrDialog.name}</div>
                  <div className="text-[11px] text-blue-400 font-mono">{qrDialog.shortCode}</div>
                  <div className="text-[10px] text-white/30">{qrDialog.phone}</div>
                </div>
                <div className="text-[10px] text-white/30 text-center bg-white/[0.03] p-2 rounded-lg w-full">
                  Scan this QR code at any cashier to make rent payments. Your short code <strong className="text-blue-400">{qrDialog.shortCode}</strong> can also be used.
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* SMS Dialog */}
      <Dialog open={!!smsDialog} onOpenChange={() => { setSmsDialog(null); setSmsText(''); setSmsSent(false); }}>
        <DialogContent className="bg-[#0f0f1a] border-white/[0.08] text-white max-w-sm">
          {smsDialog && (
            <>
              <DialogHeader>
                <DialogTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-blue-400" />
                  Send SMS to {smsDialog.name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[11px] text-white/50">
                  <Phone className="w-3.5 h-3.5" /> {smsDialog.phone}
                </div>
                <textarea
                  value={smsText}
                  onChange={(e) => setSmsText(e.target.value)}
                  placeholder="Type your message here..."
                  className="w-full h-24 p-3 rounded-xl text-xs bg-white/[0.04] border border-white/[0.08] text-white/80 placeholder:text-white/20 resize-none outline-none focus:border-blue-500/30"
                />
                <Button
                  onClick={sendSMS}
                  disabled={!smsText.trim() || smsSent}
                  className="w-full h-9 text-xs bg-blue-500 hover:bg-blue-600 rounded-xl"
                >
                  {smsSent ? <><Check className="w-3.5 h-3.5 mr-1" /> Sent!</> : <><Send className="w-3.5 h-3.5 mr-1" /> Send SMS</>}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </ScrollArea>
  );
}

/* ═══════════════════════════════════════════════════
   UNITS TAB
   ═══════════════════════════════════════════════════ */

function UnitsTab({ search }: { search: string }) {
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [viewUnit, setViewUnit] = useState<Unit | null>(null);

  const filtered = useMemo(() => {
    return units.filter(u => {
      const matchSearch = !search || u.number.toLowerCase().includes(search.toLowerCase());
      const matchProperty = propertyFilter === 'all' || u.propertyId === propertyFilter;
      return matchSearch && matchProperty;
    });
  }, [search, propertyFilter]);

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-3">
        {/* Property Filter */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          <button onClick={() => setPropertyFilter('all')} className={`px-3 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all ${propertyFilter === 'all' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' : 'text-white/40 hover:text-white/60 border border-transparent'}`}>
            All Properties
          </button>
          {properties.map(p => (
            <button key={p.id} onClick={() => setPropertyFilter(p.id)} className={`px-3 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all ${propertyFilter === p.id ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' : 'text-white/40 hover:text-white/60 border border-transparent'}`}>
              {p.name}
            </button>
          ))}
        </div>

        {/* Unit Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map(u => {
            const property = getProperty(u.propertyId);
            const tenant = u.tenantId ? getTenant(u.tenantId) : null;
            return (
              <Card key={u.id} className="bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05] transition-all cursor-pointer" onClick={() => setViewUnit(u)}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="text-xs font-medium text-white/80">{u.number}</h4>
                      <p className="text-[10px] text-white/30">{property?.name}</p>
                    </div>
                    <StatusBadge status={u.status} />
                  </div>
                  <p className="text-[11px] text-white/50 mb-2">{u.type}</p>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[10px] text-white/30 flex items-center gap-0.5"><Bed className="w-3 h-3" />{u.beds}</span>
                    <span className="text-[10px] text-white/30 flex items-center gap-0.5"><Bath className="w-3 h-3" />{u.baths}</span>
                    <span className="text-[10px] text-white/30 flex items-center gap-0.5"><Square className="w-3 h-3" />{u.sqft}</span>
                  </div>
                  {tenant && (
                    <div className="flex items-center gap-2 p-1.5 rounded-lg bg-white/[0.03] mb-2">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[8px] font-bold text-white">{tenant.avatar}</div>
                      <span className="text-[10px] text-white/50 truncate">{tenant.name}</span>
                      <span className={`text-[9px] ml-auto ${tenant.balance === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>{tenant.balance === 0 ? 'Paid' : tzs(tenant.balance)}</span>
                    </div>
                  )}
                  <div className="text-[11px] font-medium text-white/70">{tzs(u.rent)}<span className="text-white/30 text-[10px]">/mo</span></div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Dialog open={!!viewUnit} onOpenChange={() => setViewUnit(null)}>
        <DialogContent className="bg-[#0f0f1a] border-white/[0.08] text-white max-w-sm max-h-[85vh] overflow-y-auto">
          {viewUnit && (
            <>
              <DialogHeader>
                <DialogTitle className="text-sm">Unit {viewUnit.number}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-[11px]">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/[0.03] rounded-lg p-2.5 text-center"><div className="text-sm font-semibold text-white/80">{viewUnit.type}</div><div className="text-[10px] text-white/35">Type</div></div>
                  <div className="bg-white/[0.03] rounded-lg p-2.5 text-center"><div className="text-sm font-semibold text-blue-400">{tzs(viewUnit.rent)}</div><div className="text-[10px] text-white/35">Monthly</div></div>
                </div>
                {(() => {
                  const t = viewUnit.tenantId ? getTenant(viewUnit.tenantId) : null;
                  return t ? (
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-white/60">Current Tenant</h4>
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.03]">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white">{t.avatar}</div>
                        <div className="flex-1">
                          <div className="text-[11px] text-white/70">{t.name}</div>
                          <div className="text-[10px] text-white/30">{t.phone}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-emerald-500/[0.05] rounded-lg p-2 text-center"><div className="text-xs font-semibold text-emerald-400">{tzs(t.amountPaid)}</div><div className="text-[9px] text-emerald-400/50">Paid</div></div>
                        <div className="bg-amber-500/[0.05] rounded-lg p-2 text-center"><div className="text-xs font-semibold text-amber-400">{tzs(t.balance)}</div><div className="text-[9px] text-amber-400/50">Balance</div></div>
                      </div>
                      <div className="grid grid-cols-12 gap-0.5">
                        {MONTHS.map(m => <MonthIndicator key={m} month={m} paidMonths={t.paidMonths} unpaidMonths={t.unpaidMonths} />)}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-[11px] text-white/30">No tenant - Vacant</div>
                  );
                })()}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </ScrollArea>
  );
}

/* ═══════════════════════════════════════════════════
   PAYMENTS TAB
   ═══════════════════════════════════════════════════ */

function PaymentsTab({ search }: { search: string }) {
  const [statusFilter, setStatusFilter] = useState('All');

  const filtered = useMemo(() => {
    return payments.filter(p => {
      const matchSearch = !search || p.tenantName.toLowerCase().includes(search.toLowerCase()) || p.receiptNo.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'All' || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [search, statusFilter]);

  const totals = useMemo(() => ({
    paid: payments.filter(p => p.status === 'Paid').reduce((s, p) => s + p.amount, 0),
    pending: payments.filter(p => p.status === 'Pending').reduce((s, p) => s + p.amount, 0),
    overdue: payments.filter(p => p.status === 'Overdue').reduce((s, p) => s + p.amount, 0),
  }), []);

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-emerald-500/[0.04] border-emerald-500/10">
            <CardContent className="p-3"><div className="text-[10px] text-emerald-400/60 mb-1">Total Paid</div><div className="text-sm font-semibold text-emerald-400">{tzs(totals.paid)}</div></CardContent>
          </Card>
          <Card className="bg-amber-500/[0.04] border-amber-500/10">
            <CardContent className="p-3"><div className="text-[10px] text-amber-400/60 mb-1">Pending</div><div className="text-sm font-semibold text-amber-400">{tzs(totals.pending)}</div></CardContent>
          </Card>
          <Card className="bg-red-500/[0.04] border-red-500/10">
            <CardContent className="p-3"><div className="text-[10px] text-red-400/60 mb-1">Overdue</div><div className="text-sm font-semibold text-red-400">{tzs(totals.overdue)}</div></CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          {['All', 'Paid', 'Pending', 'Overdue', 'Partial'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all ${statusFilter === s ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' : 'text-white/35 hover:text-white/50 border border-transparent'}`}>{s}</button>
          ))}
        </div>

        {/* Payment List */}
        <div className="space-y-2">
          {filtered.map(p => (
            <Card key={p.id} className="bg-white/[0.03] border-white/[0.06]">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${p.status === 'Paid' ? 'bg-emerald-500/15' : p.status === 'Overdue' ? 'bg-red-500/15' : 'bg-amber-500/15'}`}>
                    {p.method === 'Bank Transfer' && <Banknote className="w-4 h-4 text-white/40" />}
                    {p.method === 'Mobile Money' && <Smartphone className="w-4 h-4 text-white/40" />}
                    {p.method === 'Cash' && <DollarSign className="w-4 h-4 text-white/40" />}
                    {p.method === 'Card' && <CreditCard className="w-4 h-4 text-white/40" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium text-white/70">{p.tenantName}</div>
                    <div className="text-[10px] text-white/30">{p.unit} &middot; {p.month} {p.year} &middot; {p.receiptNo || 'No receipt'}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[11px] font-medium text-white/70">{p.amount > 0 ? tzs(p.amount) : '-'}</div>
                    <StatusBadge status={p.status} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}

/* ═══════════════════════════════════════════════════
   CASHIER TAB
   ═══════════════════════════════════════════════════ */

function CashierTab({ search: _search }: { search: string }) {
  const [receiptNo, setReceiptNo] = useState('');
  const [amount, setAmount] = useState('');
  const [shortCode, setShortCode] = useState('');
  const [foundTenant, setFoundTenant] = useState<Tenant | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Bank Transfer' | 'Mobile Money' | 'Card'>('Cash');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  const lookupTenant = useCallback(() => {
    const t = tenants.find(t => t.shortCode.toLowerCase() === shortCode.toLowerCase() || t.phone.includes(shortCode));
    setFoundTenant(t || null);
  }, [shortCode]);

  const processPayment = () => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setReceiptNo('');
        setAmount('');
        setShortCode('');
        setFoundTenant(null);
      }, 3000);
    }, 1500);
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Header */}
        <Card className="bg-blue-500/[0.05] border-blue-500/15">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <ScanLine className="w-5 h-5 text-blue-400" />
              <div>
                <h2 className="text-sm font-semibold text-white/90">Cashier Station</h2>
                <p className="text-[10px] text-white/40">Scan or enter receipt to update payment</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Success Message */}
        {success && (
          <div className="bg-emerald-500/15 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <div>
              <div className="text-xs font-medium text-emerald-400">Payment Recorded Successfully</div>
              <div className="text-[10px] text-emerald-400/60">Receipt {receiptNo} has been processed.</div>
            </div>
          </div>
        )}

        {/* Lookup Section */}
        <Card className="bg-white/[0.03] border-white/[0.06]">
          <CardContent className="p-3 space-y-3">
            <h3 className="text-xs font-medium text-white/70">1. Find Tenant</h3>
            <div className="flex gap-2">
              <Input
                placeholder="Enter short code or phone number"
                value={shortCode}
                onChange={(e) => setShortCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && lookupTenant()}
                className="h-9 text-xs bg-white/[0.04] border-white/[0.06] text-white/80 placeholder:text-white/20 rounded-xl flex-1"
              />
              <Button onClick={lookupTenant} className="h-9 px-3 text-xs bg-blue-500 hover:bg-blue-600 rounded-xl">
                <Search className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* QR Code Scanner Simulation */}
            <div className="border-2 border-dashed border-white/[0.08] rounded-xl p-4 text-center">
              <QrCode className="w-8 h-8 text-white/20 mx-auto mb-2" />
              <p className="text-[11px] text-white/30">Scan tenant QR code</p>
              <p className="text-[10px] text-white/20">or enter short code above</p>
            </div>
          </CardContent>
        </Card>

        {/* Tenant Found */}
        {foundTenant && (
          <Card className="bg-blue-500/[0.05] border-blue-500/15">
            <CardContent className="p-3">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-sm font-bold text-white">{foundTenant.avatar}</div>
                <div>
                  <div className="text-xs font-medium text-white/80">{foundTenant.name}</div>
                  <div className="text-[10px] text-white/40">{foundTenant.phone} &middot; {foundTenant.shortCode}</div>
                  <div className="text-[10px] text-white/40">Unit {foundTenant.unit} &middot; {getProperty(foundTenant.propertyId)?.name}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <div className="bg-white/[0.03] rounded-lg p-2 text-center">
                  <div className="text-xs font-medium text-white/70">{tzs(foundTenant.monthlyRent)}</div>
                  <div className="text-[9px] text-white/30">Monthly</div>
                </div>
                <div className="bg-emerald-500/[0.05] rounded-lg p-2 text-center">
                  <div className="text-xs font-medium text-emerald-400">{tzs(foundTenant.amountPaid)}</div>
                  <div className="text-[9px] text-emerald-400/50">Paid</div>
                </div>
                <div className="bg-amber-500/[0.05] rounded-lg p-2 text-center">
                  <div className="text-xs font-medium text-amber-400">{tzs(foundTenant.balance)}</div>
                  <div className="text-[9px] text-amber-400/50">Balance</div>
                </div>
              </div>
              <div className="grid grid-cols-12 gap-0.5">
                {MONTHS.map(m => <MonthIndicator key={m} month={m} paidMonths={foundTenant.paidMonths} unpaidMonths={foundTenant.unpaidMonths} />)}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Entry */}
        {foundTenant && (
          <Card className="bg-white/[0.03] border-white/[0.06]">
            <CardContent className="p-3 space-y-3">
              <h3 className="text-xs font-medium text-white/70">2. Payment Details</h3>
              <div>
                <label className="text-[10px] text-white/40 mb-1 block">Receipt Number</label>
                <Input
                  value={receiptNo}
                  onChange={(e) => setReceiptNo(e.target.value)}
                  placeholder="e.g. RCP-2025-099"
                  className="h-9 text-xs bg-white/[0.04] border-white/[0.06] text-white/80 placeholder:text-white/20 rounded-xl"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/40 mb-1 block">Amount Received (TZS)</label>
                <Input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  type="number"
                  className="h-9 text-xs bg-white/[0.04] border-white/[0.06] text-white/80 placeholder:text-white/20 rounded-xl"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/40 mb-1 block">Payment Method</label>
                <div className="flex gap-1 flex-wrap">
                  {(['Cash', 'Bank Transfer', 'Mobile Money', 'Card'] as const).map(m => (
                    <button key={m} onClick={() => setPaymentMethod(m)} className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all ${paymentMethod === m ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' : 'text-white/40 border border-white/[0.06]'}`}>{m}</button>
                  ))}
                </div>
              </div>
              <Button
                onClick={processPayment}
                disabled={!receiptNo || !amount || processing}
                className="w-full h-10 text-xs bg-emerald-500 hover:bg-emerald-600 rounded-xl"
              >
                {processing ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Processing...</> : <><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Record Payment</>}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Recent Transactions */}
        <Card className="bg-white/[0.03] border-white/[0.06]">
          <CardHeader className="pb-2 px-3 pt-3"><CardTitle className="text-xs font-medium text-white/70">Recent Transactions</CardTitle></CardHeader>
          <CardContent className="px-3 pb-3 space-y-2">
            {payments.filter(p => p.amount > 0).slice(0, 5).map(p => (
              <div key={p.id} className="flex items-center gap-2 text-[11px]">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${p.status === 'Paid' ? 'bg-emerald-500/15' : 'bg-amber-500/15'}`}>
                  {p.method === 'Cash' ? <DollarSign className="w-3 h-3 text-emerald-400" /> : <Banknote className="w-3 h-3 text-blue-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white/60 truncate">{p.tenantName}</div>
                  <div className="text-white/30 text-[10px]">{p.receiptNo}</div>
                </div>
                <div className="text-emerald-400 font-medium">{tzs(p.amount)}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}

/* ═══════════════════════════════════════════════════
   SHARED: TENANT DETAIL DIALOG
   ═══════════════════════════════════════════════════ */

function TenantDialog({ tenant, onClose }: { tenant: Tenant | null; onClose: () => void }) {
  if (!tenant) return null;
  const property = getProperty(tenant.propertyId);
  const paymentStatus = tenant.balance === 0 ? 'Fully Paid' : tenant.unpaidMonths.length > 2 ? 'Overdue' : 'Partial';

  return (
    <Dialog open={!!tenant} onOpenChange={onClose}>
      <DialogContent className="bg-[#0f0f1a] border-white/[0.08] text-white max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" />
            Tenant Details
          </DialogTitle>
        </DialogHeader>

        {/* Profile */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-sm font-bold text-white">
            {tenant.avatar}
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-white/90">{tenant.name}</div>
            <div className="text-[10px] text-white/40">{property?.name} &middot; Unit {tenant.unit}</div>
            <StatusBadge status={paymentStatus} />
          </div>
        </div>

        {/* Contact */}
        <div className="space-y-1.5 mb-3 text-[11px]">
          <div className="flex items-center gap-2 text-white/50"><Phone className="w-3.5 h-3.5" /> {tenant.phone}</div>
          <div className="flex items-center gap-2 text-white/50"><Mail className="w-3.5 h-3.5" /> {tenant.email}</div>
          <div className="flex items-center gap-2 text-white/50"><Calendar className="w-3.5 h-3.5" /> {tenant.leaseStart} → {tenant.leaseEnd}</div>
          <div className="flex items-center gap-2 text-white/50"><QrCode className="w-3.5 h-3.5" /> Short Code: <span className="text-blue-400 font-mono">{tenant.shortCode}</span></div>
        </div>

        {/* QR Code */}
        <div className="flex flex-col items-center gap-2 mb-3 p-3 bg-white/[0.03] rounded-xl">
          <div className="bg-white p-2 rounded-lg">
            <QRCodeSVG value={`KOBE:${tenant.shortCode}:${tenant.phone}`} size={120} />
          </div>
          <div className="text-[10px] text-white/30 text-center">Scan at cashier or use short code for payments</div>
        </div>

        {/* Financial Summary */}
        <h4 className="text-xs font-medium text-white/60 mb-2">Annual Payment Summary</h4>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-blue-500/[0.05] rounded-lg p-2.5 text-center">
            <div className="text-sm font-semibold text-blue-400">{tzs(tenant.annualRent)}</div>
            <div className="text-[9px] text-blue-400/50">Annual Rent</div>
          </div>
          <div className="bg-emerald-500/[0.05] rounded-lg p-2.5 text-center">
            <div className="text-sm font-semibold text-emerald-400">{tzs(tenant.amountPaid)}</div>
            <div className="text-[9px] text-emerald-400/50">Collected</div>
          </div>
          <div className="bg-amber-500/[0.05] rounded-lg p-2.5 text-center">
            <div className="text-sm font-semibold text-amber-400">{tzs(tenant.balance)}</div>
            <div className="text-[9px] text-amber-400/50">Balance</div>
          </div>
        </div>

        {/* Monthly Breakdown */}
        <h4 className="text-xs font-medium text-white/60 mb-2">Monthly Breakdown {CURRENT_YEAR}</h4>
        <div className="grid grid-cols-12 gap-0.5 mb-2">
          {MONTHS.map(m => <MonthIndicator key={m} month={m} paidMonths={tenant.paidMonths} unpaidMonths={tenant.unpaidMonths} />)}
        </div>

        {/* Payment History */}
        <h4 className="text-xs font-medium text-white/60 mb-2">Payment History</h4>
        <div className="space-y-1.5">
          {payments.filter(p => p.tenantId === tenant.id && p.amount > 0).map(p => (
            <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.03] text-[11px]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-white/60">{p.month} {p.year}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-medium">{tzs(p.amount)}</span>
                <span className="text-white/30">{p.receiptNo}</span>
              </div>
            </div>
          ))}
          {payments.filter(p => p.tenantId === tenant.id && p.amount > 0).length === 0 && (
            <div className="text-center text-[11px] text-white/30 py-3">No payment records found</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
