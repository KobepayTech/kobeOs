import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Shield, LayoutDashboard, Building2, CreditCard, Receipt, Package, Users, Wrench, Settings,
  Plus, Search, CheckCircle2, Clock, XCircle, AlertTriangle, TrendingUp, DollarSign,
  Eye, Edit, Trash2, ChevronRight, X, Download, Filter, BadgeCheck, Smartphone, Globe,
  Lock, Unlock, RefreshCw, Cpu, HardDrive, Wifi, Activity, Loader2
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

/* ───────── Types ───────── */

/** Shape returned by GET /api/companies */
interface Company {
  id: string;
  name: string;
  email: string;
  country?: string;
  phone?: string;
  status: 'Active' | 'Trial' | 'Suspended' | 'Cancelled' | 'Expired';
  ownerId?: string;
  createdAt?: string;
  updatedAt?: string;
  // Local demo / admin fields
  plan?: 'Basic' | 'Pro' | 'Enterprise';
  users?: number;
  modules?: number;
  revenue?: number;
  joined?: string;
}

/** Shape returned by GET /api/subscriptions */
interface Subscription {
  id: string;
  companyId?: string;
  company?: Company | string;
  plan: 'Basic' | 'Pro' | 'Enterprise';
  price: number;
  startDate: string;
  endDate: string;
  status: 'Trial' | 'Active' | 'Expired' | 'Cancelled';
  autoRenew?: boolean;
  enabledModules?: string[];
  createdAt?: string;
}

interface Invoice {
  id: string;
  company: string;
  amount: number;
  date: string;
  dueDate: string;
  status: 'Paid' | 'Pending' | 'Failed' | 'Overdue';
}

interface ModuleItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  activeCompanies: number;
  enabled: boolean;
}

interface Role {
  id: string;
  name: string;
  permissions: string[];
  userCount: number;
  builtIn: boolean;
}

interface Ticket {
  id: string;
  company: string;
  subject: string;
  status: 'Open' | 'In Progress' | 'Resolved';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  created: string;
}

interface ErrorLog {
  id: string;
  timestamp: string;
  module: string;
  error: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
}

/* ───────── Mock Data: 20 Companies ───────── */
const COMPANIES: Company[] = [
  { id: '1', name: 'KOBECARGO TZ', email: 'admin@kobecargo.co.tz', country: 'Tanzania', plan: 'Enterprise', users: 85, modules: 8, status: 'Active', revenue: 5988, joined: '2023-01-15' },
  { id: '2', name: 'KobePrint Studio', email: 'hello@kobeprint.studio', country: 'Kenya', plan: 'Pro', users: 32, modules: 5, status: 'Active', revenue: 5364, joined: '2023-02-20' },
  { id: '3', name: 'KobeHotel Arusha', email: 'info@kobehotel.com', country: 'Tanzania', plan: 'Pro', users: 45, modules: 6, status: 'Active', revenue: 5364, joined: '2023-03-10' },
  { id: '4', name: 'CreatorHub', email: 'team@creatorhub.io', country: 'Nigeria', plan: 'Enterprise', users: 120, modules: 10, status: 'Active', revenue: 5988, joined: '2023-04-05' },
  { id: '5', name: 'KobePay Finance', email: 'support@kobepay.co', country: 'South Africa', plan: 'Enterprise', users: 200, modules: 9, status: 'Active', revenue: 5988, joined: '2023-05-12' },
  { id: '6', name: 'Nyerere Logistics', email: 'ops@nyerere.co.tz', country: 'Tanzania', plan: 'Basic', users: 18, modules: 3, status: 'Trial', revenue: 0, joined: '2024-11-01' },
  { id: '7', name: 'Mwanza Cargo Co', email: 'dispatch@mwanzacargo.co.tz', country: 'Tanzania', plan: 'Basic', users: 12, modules: 2, status: 'Active', revenue: 588, joined: '2023-06-18' },
  { id: '8', name: 'Zanzibar Resort', email: 'bookings@zanzibarresort.com', country: 'Tanzania', plan: 'Pro', users: 28, modules: 4, status: 'Active', revenue: 5364, joined: '2023-07-22' },
  { id: '9', name: 'Kilimanjaro Lodge', email: 'stay@kilimanjarolodge.com', country: 'Tanzania', plan: 'Basic', users: 15, modules: 3, status: 'Active', revenue: 588, joined: '2023-08-30' },
  { id: '10', name: 'Dar Express', email: 'info@darexpress.co.tz', country: 'Tanzania', plan: 'Pro', users: 55, modules: 5, status: 'Active', revenue: 5364, joined: '2023-09-14' },
  { id: '11', name: 'Safari Adventures', email: 'tours@safariadv.co.tz', country: 'Tanzania', plan: 'Basic', users: 10, modules: 2, status: 'Expired', revenue: 0, joined: '2023-10-01' },
  { id: '12', name: 'Swahili Creators', email: 'hello@swahilicreators.co.ke', country: 'Kenya', plan: 'Pro', users: 40, modules: 6, status: 'Active', revenue: 5364, joined: '2023-11-15' },
  { id: '13', name: 'Tanga Foods', email: 'orders@tangafoods.co.tz', country: 'Tanzania', plan: 'Basic', users: 8, modules: 2, status: 'Trial', revenue: 0, joined: '2024-12-01' },
  { id: '14', name: 'Mbeya Transport', email: 'dispatch@mbeyatrans.co.tz', country: 'Tanzania', plan: 'Basic', users: 22, modules: 3, status: 'Suspended', revenue: 0, joined: '2023-12-10' },
  { id: '15', name: 'Morogoro Shop', email: 'sales@morogoroshop.co.tz', country: 'Tanzania', plan: 'Basic', users: 6, modules: 2, status: 'Active', revenue: 588, joined: '2024-01-20' },
  { id: '16', name: 'Dodoma Hotel', email: 'res@dodomahotel.co.tz', country: 'Tanzania', plan: 'Pro', users: 35, modules: 5, status: 'Active', revenue: 5364, joined: '2024-02-14' },
  { id: '17', name: 'Iringa Print', email: 'jobs@iringaprint.co.tz', country: 'Tanzania', plan: 'Basic', users: 9, modules: 2, status: 'Trial', revenue: 0, joined: '2024-12-10' },
  { id: '18', name: 'Musoma Lodge', email: 'book@musomalodge.co.tz', country: 'Tanzania', plan: 'Basic', users: 14, modules: 3, status: 'Active', revenue: 588, joined: '2024-03-05' },
  { id: '19', name: 'Kigoma Shipping', email: 'ops@kigomashipping.co.tz', country: 'Tanzania', plan: 'Pro', users: 48, modules: 6, status: 'Active', revenue: 5364, joined: '2024-04-18' },
  { id: '20', name: 'Manyara Safaris', email: 'tours@manyarasafaris.com', country: 'Tanzania', plan: 'Enterprise', users: 65, modules: 7, status: 'Active', revenue: 5988, joined: '2024-05-25' },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _SUBSCRIPTIONS: Subscription[] = [
  { id: 's1', company: 'KOBECARGO TZ', plan: 'Enterprise', price: 499, startDate: '2024-01-15', endDate: '2025-01-15', status: 'Active', autoRenew: true },
  { id: 's2', company: 'KobePrint Studio', plan: 'Pro', price: 149, startDate: '2024-02-20', endDate: '2025-02-20', status: 'Active', autoRenew: true },
  { id: 's3', company: 'KobeHotel Arusha', plan: 'Pro', price: 149, startDate: '2024-03-10', endDate: '2025-03-10', status: 'Active', autoRenew: true },
  { id: 's4', company: 'CreatorHub', plan: 'Enterprise', price: 499, startDate: '2024-04-05', endDate: '2025-04-05', status: 'Active', autoRenew: true },
  { id: 's5', company: 'KobePay Finance', plan: 'Enterprise', price: 499, startDate: '2024-05-12', endDate: '2025-05-12', status: 'Active', autoRenew: true },
  { id: 's6', company: 'Nyerere Logistics', plan: 'Basic', price: 49, startDate: '2024-11-01', endDate: '2024-11-15', status: 'Trial', autoRenew: false },
  { id: 's7', company: 'Mwanza Cargo Co', plan: 'Basic', price: 49, startDate: '2024-06-18', endDate: '2025-06-18', status: 'Active', autoRenew: true },
  { id: 's8', company: 'Zanzibar Resort', plan: 'Pro', price: 149, startDate: '2024-07-22', endDate: '2025-07-22', status: 'Active', autoRenew: true },
  { id: 's9', company: 'Kilimanjaro Lodge', plan: 'Basic', price: 49, startDate: '2024-08-30', endDate: '2025-08-30', status: 'Active', autoRenew: true },
  { id: 's10', company: 'Dar Express', plan: 'Pro', price: 149, startDate: '2024-09-14', endDate: '2025-09-14', status: 'Active', autoRenew: true },
  { id: 's11', company: 'Safari Adventures', plan: 'Basic', price: 49, startDate: '2024-10-01', endDate: '2024-10-01', status: 'Expired', autoRenew: false },
  { id: 's12', company: 'Swahili Creators', plan: 'Pro', price: 149, startDate: '2024-11-15', endDate: '2025-11-15', status: 'Active', autoRenew: true },
  { id: 's13', company: 'Tanga Foods', plan: 'Basic', price: 49, startDate: '2024-12-01', endDate: '2024-12-15', status: 'Trial', autoRenew: false },
  { id: 's14', company: 'Mbeya Transport', plan: 'Basic', price: 49, startDate: '2024-12-10', endDate: '2024-12-10', status: 'Expired', autoRenew: false },
  { id: 's15', company: 'Morogoro Shop', plan: 'Basic', price: 49, startDate: '2024-01-20', endDate: '2025-01-20', status: 'Active', autoRenew: true },
  { id: 's16', company: 'Dodoma Hotel', plan: 'Pro', price: 149, startDate: '2024-02-14', endDate: '2025-02-14', status: 'Active', autoRenew: true },
  { id: 's17', company: 'Iringa Print', plan: 'Basic', price: 49, startDate: '2024-12-10', endDate: '2024-12-24', status: 'Trial', autoRenew: false },
  { id: 's18', company: 'Musoma Lodge', plan: 'Basic', price: 49, startDate: '2024-03-05', endDate: '2025-03-05', status: 'Active', autoRenew: true },
  { id: 's19', company: 'Kigoma Shipping', plan: 'Pro', price: 149, startDate: '2024-04-18', endDate: '2025-04-18', status: 'Active', autoRenew: true },
  { id: 's20', company: 'Manyara Safaris', plan: 'Enterprise', price: 499, startDate: '2024-05-25', endDate: '2025-05-25', status: 'Active', autoRenew: true },
];

const INVOICES: Invoice[] = [
  { id: 'i1', company: 'KOBECARGO TZ', amount: 499, date: '2024-12-01', dueDate: '2024-12-05', status: 'Paid' },
  { id: 'i2', company: 'KobePrint Studio', amount: 149, date: '2024-12-01', dueDate: '2024-12-05', status: 'Paid' },
  { id: 'i3', company: 'KobeHotel Arusha', amount: 149, date: '2024-12-01', dueDate: '2024-12-05', status: 'Paid' },
  { id: 'i4', company: 'CreatorHub', amount: 499, date: '2024-12-01', dueDate: '2024-12-05', status: 'Pending' },
  { id: 'i5', company: 'KobePay Finance', amount: 499, date: '2024-12-01', dueDate: '2024-12-05', status: 'Paid' },
  { id: 'i6', company: 'Mwanza Cargo Co', amount: 49, date: '2024-12-01', dueDate: '2024-12-05', status: 'Paid' },
  { id: 'i7', company: 'Zanzibar Resort', amount: 149, date: '2024-12-01', dueDate: '2024-12-05', status: 'Failed' },
  { id: 'i8', company: 'Kilimanjaro Lodge', amount: 49, date: '2024-12-01', dueDate: '2024-12-05', status: 'Paid' },
  { id: 'i9', company: 'Dar Express', amount: 149, date: '2024-12-01', dueDate: '2024-12-05', status: 'Pending' },
  { id: 'i10', company: 'Swahili Creators', amount: 149, date: '2024-12-01', dueDate: '2024-12-05', status: 'Paid' },
  { id: 'i11', company: 'Morogoro Shop', amount: 49, date: '2024-12-01', dueDate: '2024-12-05', status: 'Overdue' },
  { id: 'i12', company: 'Dodoma Hotel', amount: 149, date: '2024-12-01', dueDate: '2024-12-05', status: 'Paid' },
  { id: 'i13', company: 'Musoma Lodge', amount: 49, date: '2024-12-01', dueDate: '2024-12-05', status: 'Paid' },
  { id: 'i14', company: 'Kigoma Shipping', amount: 149, date: '2024-12-01', dueDate: '2024-12-05', status: 'Pending' },
  { id: 'i15', company: 'Manyara Safaris', amount: 499, date: '2024-12-01', dueDate: '2024-12-05', status: 'Paid' },
];

const MODULES: ModuleItem[] = [
  { id: 'm1', name: 'KOBECARGO', description: 'Cargo & logistics management with tracking and dispatch', icon: 'truck', activeCompanies: 12, enabled: true },
  { id: 'm2', name: 'KobePrint', description: 'Print shop management, jobs, orders and production tracking', icon: 'printer', activeCompanies: 8, enabled: true },
  { id: 'm3', name: 'KobeHotel', description: 'Hotel PMS with bookings, rooms, housekeeping and POS', icon: 'hotel', activeCompanies: 10, enabled: true },
  { id: 'm4', name: 'CreatorHub', description: 'Content creator management and monetization platform', icon: 'pen', activeCompanies: 6, enabled: true },
  { id: 'm5', name: 'ERP Suite', description: 'Enterprise resource planning with inventory, HR and finance', icon: 'briefcase', activeCompanies: 15, enabled: true },
  { id: 'm6', name: 'KobePay', description: 'Payment processing and financial transactions', icon: 'credit-card', activeCompanies: 9, enabled: true },
  { id: 'm7', name: 'Property', description: 'Real estate and property management tools', icon: 'home', activeCompanies: 5, enabled: true },
  { id: 'm8', name: 'Games', description: 'Gaming platform integration and leaderboard', icon: 'gamepad', activeCompanies: 3, enabled: false },
  { id: 'm9', name: 'Developer Tools', description: 'APIs, webhooks, and developer utilities', icon: 'code', activeCompanies: 7, enabled: true },
  { id: 'm10', name: 'Utilities', description: 'General utility tools and converters', icon: 'zap', activeCompanies: 18, enabled: true },
];

const ROLES: Role[] = [
  { id: 'r1', name: 'Super Admin', permissions: ['View', 'Edit', 'Delete', 'Approve', 'Reports', 'Settings'], userCount: 2, builtIn: true },
  { id: 'r2', name: 'Admin', permissions: ['View', 'Edit', 'Approve', 'Reports', 'Settings'], userCount: 5, builtIn: true },
  { id: 'r3', name: 'Manager', permissions: ['View', 'Edit', 'Approve', 'Reports'], userCount: 12, builtIn: true },
  { id: 'r4', name: 'Cashier', permissions: ['View', 'Edit'], userCount: 28, builtIn: true },
  { id: 'r5', name: 'Receptionist', permissions: ['View', 'Edit'], userCount: 16, builtIn: true },
  { id: 'r6', name: 'Waiter', permissions: ['View', 'Edit'], userCount: 22, builtIn: true },
  { id: 'r7', name: 'Chef', permissions: ['View', 'Edit'], userCount: 8, builtIn: true },
  { id: 'r8', name: 'Bartender', permissions: ['View', 'Edit'], userCount: 6, builtIn: true },
  { id: 'r9', name: 'Cleaner', permissions: ['View'], userCount: 14, builtIn: true },
  { id: 'r10', name: 'Security', permissions: ['View'], userCount: 10, builtIn: true },
  { id: 'r11', name: 'Viewer', permissions: ['View'], userCount: 45, builtIn: true },
];

const TICKETS: Ticket[] = [
  { id: 't1', company: 'KOBECARGO TZ', subject: 'Tracking API not returning data', status: 'Open', priority: 'High', created: '2024-12-10 08:23' },
  { id: 't2', company: 'KobeHotel Arusha', subject: 'POS sync failing intermittently', status: 'In Progress', priority: 'Medium', created: '2024-12-09 14:15' },
  { id: 't3', company: 'CreatorHub', subject: 'Video upload timeout error', status: 'Open', priority: 'Critical', created: '2024-12-10 10:45' },
  { id: 't4', company: 'KobePay Finance', subject: 'Webhook delivery delays', status: 'In Progress', priority: 'High', created: '2024-12-08 09:30' },
  { id: 't5', company: 'Dar Express', subject: 'Cannot generate dispatch reports', status: 'Resolved', priority: 'Medium', created: '2024-12-07 11:20' },
  { id: 't6', company: 'Zanzibar Resort', subject: 'Booking calendar not loading', status: 'Open', priority: 'High', created: '2024-12-10 07:50' },
  { id: 't7', company: 'Kigoma Shipping', subject: 'Invoice PDF generation error', status: 'Resolved', priority: 'Low', created: '2024-12-06 16:40' },
  { id: 't8', company: 'Manyara Safaris', subject: 'Email notifications not sending', status: 'In Progress', priority: 'Medium', created: '2024-12-09 12:00' },
];

const ERROR_LOGS: ErrorLog[] = [
  { id: 'e1', timestamp: '2024-12-10 09:15:32', module: 'KOBECARGO', error: 'Database connection timeout on query SELECT * FROM tracking', severity: 'High' },
  { id: 'e2', timestamp: '2024-12-10 08:45:12', module: 'KobePay', error: 'Payment gateway returned 502 Bad Gateway', severity: 'Critical' },
  { id: 'e3', timestamp: '2024-12-10 07:30:05', module: 'KobeHotel', error: 'Redis cache miss rate exceeded 85%', severity: 'Medium' },
  { id: 'e4', timestamp: '2024-12-09 22:10:18', module: 'CreatorHub', error: 'S3 upload failed: Connection reset by peer', severity: 'High' },
  { id: 'e5', timestamp: '2024-12-09 18:55:44', module: 'ERP Suite', error: 'Memory usage exceeded 85% threshold', severity: 'Medium' },
  { id: 'e6', timestamp: '2024-12-09 15:20:30', module: 'KobePrint', error: 'Queue processing lag: 234 jobs pending', severity: 'Low' },
  { id: 'e7', timestamp: '2024-12-09 11:05:22', module: 'KOBECARGO', error: 'API rate limit exceeded for client_id=KOB001', severity: 'Medium' },
];

const REVENUE_DATA = [
  { month: 'Jan', revenue: 8200, subscriptions: 28 },
  { month: 'Feb', revenue: 9100, subscriptions: 30 },
  { month: 'Mar', revenue: 8800, subscriptions: 31 },
  { month: 'Apr', revenue: 10200, subscriptions: 33 },
  { month: 'May', revenue: 11100, subscriptions: 35 },
  { month: 'Jun', revenue: 10500, subscriptions: 36 },
  { month: 'Jul', revenue: 11800, subscriptions: 37 },
  { month: 'Aug', revenue: 11200, subscriptions: 38 },
  { month: 'Sep', revenue: 12000, subscriptions: 39 },
  { month: 'Oct', revenue: 11500, subscriptions: 40 },
  { month: 'Nov', revenue: 12300, subscriptions: 42 },
  { month: 'Dec', revenue: 12500, subscriptions: 45 },
];

const MODULE_USAGE_DATA = [
  { name: 'KOBECARGO', value: 12 },
  { name: 'KobeHotel', value: 10 },
  { name: 'KobePay', value: 9 },
  { name: 'ERP Suite', value: 15 },
  { name: 'KobePrint', value: 8 },
  { name: 'CreatorHub', value: 6 },
  { name: 'Property', value: 5 },
  { name: 'Others', value: 8 },
];

const ACTIVITY_FEED = [
  { id: 1, text: 'KOBECARGO TZ subscription renewed for $499', type: 'success', time: '10 min ago' },
  { id: 2, text: 'CreatorHub upgraded to Enterprise plan', type: 'info', time: '25 min ago' },
  { id: 3, text: 'Payment failed for Zanzibar Resort ($149)', type: 'error', time: '45 min ago' },
  { id: 4, text: 'Nyerere Logistics started 14-day trial', type: 'info', time: '1 hour ago' },
  { id: 5, text: 'New company Tanga Foods registered', type: 'success', time: '2 hours ago' },
  { id: 6, text: 'System backup completed successfully', type: 'success', time: '3 hours ago' },
  { id: 7, text: 'KobePay webhook timeout detected', type: 'warning', time: '4 hours ago' },
  { id: 8, text: 'Mbeya Transport subscription expired', type: 'error', time: '5 hours ago' },
];

const PIE_COLORS = ['#06b6d4', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#f97316', '#64748b'];

/* ───────── Status Helpers ───────── */
function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    Active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    Trial: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    Expired: 'bg-red-500/10 text-red-400 border-red-500/20',
    Suspended: 'bg-red-500/10 text-red-400 border-red-500/20',
    Cancelled: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    Pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    Paid: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    Failed: 'bg-red-500/10 text-red-400 border-red-500/20',
    Overdue: 'bg-red-500/10 text-red-400 border-red-500/20',
    Open: 'bg-red-500/10 text-red-400 border-red-500/20',
    'In Progress': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    Resolved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    Low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    Medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    High: 'bg-red-500/10 text-red-400 border-red-500/20',
    Critical: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return (
    <Badge variant="outline" className={variants[status] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'}>
      {status}
    </Badge>
  );
}

function PriorityIcon({ priority }: { priority: string }) {
  if (priority === 'Critical' || priority === 'High') return <AlertTriangle className="w-4 h-4 text-red-400" />;
  if (priority === 'Medium') return <Clock className="w-4 h-4 text-amber-400" />;
  return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
}

/* ───────── Module 1: Dashboard ───────── */
function DashboardModule() {
  const kpiCards = [
    { label: 'Total Companies', value: '45', icon: Building2, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Active Subs', value: '38', icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Monthly Revenue', value: '$12,500', icon: DollarSign, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Pending Approvals', value: '7', icon: Clock, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { label: 'System Uptime', value: '99.7%', icon: Activity, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { label: 'Active Users', value: '1,240', icon: Users, color: 'text-violet-400', bg: 'bg-violet-500/10' },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label} className="bg-[#13131f] border-white/[0.06]">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-lg ${kpi.bg}`}>
                  <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                </div>
                <div>
                  <p className="text-xs text-slate-400">{kpi.label}</p>
                  <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-[#13131f] border-white/[0.06] lg:col-span-2">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-4">Revenue Trend</h3>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={REVENUE_DATA}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" stroke="#475569" fontSize={12} />
                <YAxis stroke="#475569" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: '#13131f', borderColor: '#334155' }} />
                <Area type="monotone" dataKey="revenue" stroke="#06b6d4" fill="url(#revGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="bg-[#13131f] border-white/[0.06]">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-4">Module Usage</h3>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={MODULE_USAGE_DATA} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                  {MODULE_USAGE_DATA.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#13131f', borderColor: '#334155' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-[#13131f] border-white/[0.06] lg:col-span-2">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-4">Subscription Growth</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={REVENUE_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" stroke="#475569" fontSize={12} />
                <YAxis stroke="#475569" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: '#13131f', borderColor: '#334155' }} />
                <Bar dataKey="subscriptions" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="bg-[#13131f] border-white/[0.06]">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-4">Recent Activity</h3>
            <div className="space-y-3 max-h-[200px] overflow-y-auto">
              {ACTIVITY_FEED.map((activity) => (
                <div key={activity.id} className="flex items-start gap-2 text-sm">
                  {activity.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />}
                  {activity.type === 'error' && <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />}
                  {activity.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />}
                  {activity.type === 'info' && <TrendingUp className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />}
                  <div>
                    <p className="text-slate-300">{activity.text}</p>
                    <p className="text-xs text-slate-500">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Panel */}
      <Card className="bg-[#13131f] border-white/[0.06]">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" /> Alerts
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-3">
              <p className="text-xs text-slate-400">Payment Failures</p>
              <p className="text-lg font-bold text-red-400">2</p>
              <p className="text-xs text-slate-500">Zanzibar Resort, Safari Adventures</p>
            </div>
            <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-3">
              <p className="text-xs text-slate-400">Expiring Trials</p>
              <p className="text-lg font-bold text-amber-400">3</p>
              <p className="text-xs text-slate-500">Nyerere Logistics, Tanga Foods, Iringa Print</p>
            </div>
            <div className="bg-orange-500/5 border border-orange-500/10 rounded-lg p-3">
              <p className="text-xs text-slate-400">System Issues</p>
              <p className="text-lg font-bold text-orange-400">1</p>
              <p className="text-xs text-slate-500">KobePay webhook timeout</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ───────── Module 2: Companies ───────── */
function CompaniesModule() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', country: 'Tanzania', phone: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<Company[]>('/companies');
      setCompanies(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return companies.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.country ?? '').toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filter === 'All' || c.status === filter;
      return matchesSearch && matchesFilter;
    });
  }, [companies, search, filter]);

  const handleCreate = async () => {
    if (!form.name || !form.email) return;
    setSaving(true);
    try {
      await api('/companies', { method: 'POST', body: JSON.stringify(form) });
      setShowAddDialog(false);
      setForm({ name: '', email: '', country: 'Tanzania', phone: '' });
      load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleSuspend = async (id: string, current: string) => {
    const next = current === 'Suspended' ? 'Active' : 'Suspended';
    try {
      await api(`/companies/${id}`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
      setCompanies((prev) => prev.map((c) => c.id === id ? { ...c, status: next as Company['status'] } : c));
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this company? This cannot be undone.')) return;
    try {
      await api(`/companies/${id}`, { method: 'DELETE' });
      setCompanies((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              placeholder="Search companies..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-[#13131f] border-white/[0.06] text-slate-200 w-full sm:w-64"
            />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-36 bg-[#13131f] border-white/[0.06] text-slate-200">
              <Filter className="w-4 h-4 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {['All', 'Active', 'Trial', 'Suspended', 'Cancelled'].map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} className="border-white/[0.06] text-slate-400 hover:text-slate-200">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button onClick={() => setShowAddDialog(true)} className="bg-cyan-600 hover:bg-cyan-700 text-white">
            <Plus className="w-4 h-4 mr-1" /> Add Company
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <Card className="bg-[#13131f] border-white/[0.06]">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading companies…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Building2 className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">No companies found</p>
              <p className="text-xs mt-1 text-slate-600">Add your first company to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {['Name', 'Email', 'Country', 'Status', 'Created', 'Actions'].map((h) => (
                      <th key={h} className="text-left py-3 px-4 text-slate-400 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((company) => (
                    <tr key={company.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="py-3 px-4 text-slate-200 font-medium">{company.name}</td>
                      <td className="py-3 px-4 text-slate-400">{company.email}</td>
                      <td className="py-3 px-4 text-slate-400">{company.country ?? '—'}</td>
                      <td className="py-3 px-4"><StatusBadge status={company.status} /></td>
                      <td className="py-3 px-4 text-slate-500">{company.createdAt ? new Date(company.createdAt).toLocaleDateString() : '—'}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost" size="sm"
                            className={`h-7 w-7 p-0 ${company.status === 'Suspended' ? 'text-emerald-400 hover:text-emerald-300' : 'text-slate-400 hover:text-amber-400'}`}
                            title={company.status === 'Suspended' ? 'Unsuspend' : 'Suspend'}
                            onClick={() => handleSuspend(company.id, company.status)}
                          >
                            {company.status === 'Suspended' ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            className="h-7 w-7 p-0 text-slate-400 hover:text-red-400"
                            title="Delete"
                            onClick={() => handleDelete(company.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Company Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-[#13131f] border-white/[0.06] text-slate-200 max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Company</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Company Name *</label>
              <Input
                placeholder="e.g. New Company Ltd"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="bg-[#0a0a1a] border-white/[0.06] text-slate-200"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Email *</label>
              <Input
                placeholder="admin@company.com"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="bg-[#0a0a1a] border-white/[0.06] text-slate-200"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Country</label>
              <Select value={form.country} onValueChange={(v) => setForm((p) => ({ ...p, country: v }))}>
                <SelectTrigger className="bg-[#0a0a1a] border-white/[0.06] text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['Tanzania', 'Kenya', 'Uganda', 'Rwanda', 'South Africa', 'Nigeria'].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Phone</label>
              <Input
                placeholder="+255 7XX XXX XXX"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                className="bg-[#0a0a1a] border-white/[0.06] text-slate-200"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleCreate}
                disabled={saving || !form.name || !form.email}
                className="bg-cyan-600 hover:bg-cyan-700 text-white flex-1 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                Create Company
              </Button>
              <Button variant="outline" onClick={() => setShowAddDialog(false)} className="border-white/[0.06] text-slate-300 hover:bg-white/5">Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ───────── Module 3: Subscriptions ───────── */
function SubscriptionsModule() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subFilter, setSubFilter] = useState('All');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    companyId: '',
    plan: 'Basic' as 'Basic' | 'Pro' | 'Enterprise',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    autoRenew: false,
  });

  const PLAN_PRICES: Record<string, number> = { Basic: 49, Pro: 149, Enterprise: 499 };

  const planColors: Record<string, string> = {
    Enterprise: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    Pro: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    Basic: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [subs, comps] = await Promise.all([
        api<Subscription[]>('/subscriptions'),
        api<Company[]>('/companies'),
      ]);
      setSubscriptions(subs);
      setCompanies(comps);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() =>
    subscriptions.filter((s) => subFilter === 'All' || s.status === subFilter),
    [subscriptions, subFilter]
  );

  const companyName = (sub: Subscription) =>
    (typeof sub.company === 'object' ? sub.company?.name : sub.company) ?? companies.find((c) => c.id === sub.companyId)?.name ?? sub.companyId;

  const handleCreate = async () => {
    if (!form.companyId) return;
    setSaving(true);
    try {
      await api('/subscriptions', {
        method: 'POST',
        body: JSON.stringify({ ...form, price: PLAN_PRICES[form.plan] }),
      });
      setShowAddDialog(false);
      load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this subscription?')) return;
    try {
      await api(`/subscriptions/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'Cancelled', autoRenew: false }) });
      setSubscriptions((prev) => prev.map((s) => s.id === id ? { ...s, status: 'Cancelled', autoRenew: false } : s));
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleRenew = async (sub: Subscription) => {
    const newEnd = new Date(sub.endDate);
    newEnd.setFullYear(newEnd.getFullYear() + 1);
    try {
      const updated = await api<Subscription>(`/subscriptions/${sub.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'Active', endDate: newEnd.toISOString() }),
      });
      setSubscriptions((prev) => prev.map((s) => s.id === sub.id ? updated : s));
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <Select value={subFilter} onValueChange={setSubFilter}>
          <SelectTrigger className="w-40 bg-[#13131f] border-white/[0.06] text-slate-200">
            <Filter className="w-4 h-4 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {['All', 'Active', 'Trial', 'Expired', 'Cancelled'].map((f) => (
              <SelectItem key={f} value={f}>{f}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} className="border-white/[0.06] text-slate-400 hover:text-slate-200">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button onClick={() => setShowAddDialog(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="w-4 h-4 mr-1" /> New Subscription
          </Button>
        </div>
      </div>

      {/* Plan summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { name: 'Basic', price: '$49', desc: 'Up to 20 users, 3 modules', color: 'border-slate-500/20' },
          { name: 'Pro', price: '$149', desc: 'Up to 100 users, 6 modules', color: 'border-blue-500/20' },
          { name: 'Enterprise', price: '$499', desc: 'Unlimited users, all modules', color: 'border-violet-500/20' },
        ].map((plan) => {
          const count = subscriptions.filter((s) => s.plan === plan.name && s.status === 'Active').length;
          return (
            <Card key={plan.name} className={`bg-[#13131f] border ${plan.color}`}>
              <CardContent className="p-4">
                <h3 className="text-slate-200 font-semibold">{plan.name}</h3>
                <p className="text-2xl font-bold text-slate-100 mt-1">{plan.price}<span className="text-sm font-normal text-slate-500">/mo</span></p>
                <p className="text-xs text-slate-400 mt-1">{plan.desc}</p>
                <p className="text-xs text-slate-500 mt-2">{count} active</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <Card className="bg-[#13131f] border-white/[0.06]">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading subscriptions…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <BadgeCheck className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">No subscriptions found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {['Company', 'Plan', 'Price', 'Start', 'End', 'Status', 'Auto-Renew', 'Actions'].map((h) => (
                      <th key={h} className="text-left py-3 px-4 text-slate-400 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((sub) => (
                    <tr key={sub.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="py-3 px-4 text-slate-200 font-medium">{companyName(sub)}</td>
                      <td className="py-3 px-4"><Badge variant="outline" className={planColors[sub.plan]}>{sub.plan}</Badge></td>
                      <td className="py-3 px-4 text-slate-400">${sub.price}/mo</td>
                      <td className="py-3 px-4 text-slate-400">{new Date(sub.startDate).toLocaleDateString()}</td>
                      <td className="py-3 px-4 text-slate-400">{new Date(sub.endDate).toLocaleDateString()}</td>
                      <td className="py-3 px-4"><StatusBadge status={sub.status} /></td>
                      <td className="py-3 px-4">
                        {sub.autoRenew ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          {sub.status !== 'Cancelled' && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-400 hover:text-emerald-400" onClick={() => handleRenew(sub)}>Renew</Button>
                          )}
                          {sub.status !== 'Cancelled' && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-400 hover:text-red-400" onClick={() => handleCancel(sub.id)}>Cancel</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Subscription Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-[#13131f] border-white/[0.06] text-slate-200 max-w-md">
          <DialogHeader>
            <DialogTitle>New Subscription</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Company *</label>
              <Select value={form.companyId} onValueChange={(v) => setForm((p) => ({ ...p, companyId: v }))}>
                <SelectTrigger className="bg-[#0a0a1a] border-white/[0.06] text-slate-200">
                  <SelectValue placeholder="Select company…" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Plan</label>
              <Select value={form.plan} onValueChange={(v) => setForm((p) => ({ ...p, plan: v as typeof form.plan }))}>
                <SelectTrigger className="bg-[#0a0a1a] border-white/[0.06] text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Basic">Basic — $49/mo</SelectItem>
                  <SelectItem value="Pro">Pro — $149/mo</SelectItem>
                  <SelectItem value="Enterprise">Enterprise — $499/mo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Start Date</label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} className="bg-[#0a0a1a] border-white/[0.06] text-slate-200" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">End Date</label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} className="bg-[#0a0a1a] border-white/[0.06] text-slate-200" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input type="checkbox" checked={form.autoRenew} onChange={(e) => setForm((p) => ({ ...p, autoRenew: e.target.checked }))} className="rounded border-slate-600" />
              Auto-renew
            </label>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleCreate} disabled={saving || !form.companyId} className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                Create Subscription
              </Button>
              <Button variant="outline" onClick={() => setShowAddDialog(false)} className="border-white/[0.06] text-slate-300 hover:bg-white/5">Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ───────── Module 4: Billing ───────── */
function BillingModule() {
  const [billingTab, setBillingTab] = useState('invoices');

  const totalRevenue = INVOICES.filter(i => i.status === 'Paid').reduce((s, i) => s + i.amount, 0);
  const pendingAmount = INVOICES.filter(i => i.status === 'Pending').reduce((s, i) => s + i.amount, 0);
  const failedAmount = INVOICES.filter(i => i.status === 'Failed' || i.status === 'Overdue').reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-4">
      {/* Revenue KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="bg-[#13131f] border-white/[0.06]">
          <CardContent className="p-4">
            <p className="text-xs text-slate-400">This Month</p>
            <p className="text-xl font-bold text-emerald-400">${totalRevenue.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#13131f] border-white/[0.06]">
          <CardContent className="p-4">
            <p className="text-xs text-slate-400">Last Month</p>
            <p className="text-xl font-bold text-slate-200">$11,800</p>
          </CardContent>
        </Card>
        <Card className="bg-[#13131f] border-white/[0.06]">
          <CardContent className="p-4">
            <p className="text-xs text-slate-400">Pending</p>
            <p className="text-xl font-bold text-amber-400">${pendingAmount.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#13131f] border-white/[0.06]">
          <CardContent className="p-4">
            <p className="text-xs text-slate-400">Failed/Overdue</p>
            <p className="text-xl font-bold text-red-400">${failedAmount.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={billingTab} onValueChange={setBillingTab}>
        <TabsList className="bg-[#13131f] border border-white/[0.06]">
          <TabsTrigger value="invoices" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white">Invoices</TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white">Payment History</TabsTrigger>
          <TabsTrigger value="failed" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white">Failed Payments</TabsTrigger>
        </TabsList>
        <TabsContent value="invoices" className="mt-3">
          <Card className="bg-[#13131f] border-white/[0.06]">
            <CardContent className="p-0">
              <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
                <h3 className="text-sm font-semibold text-slate-200">Outstanding Invoices</h3>
                <Button variant="outline" size="sm" className="border-white/[0.06] text-slate-300 hover:bg-white/5">
                  <Download className="w-4 h-4 mr-1" /> Export CSV
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      {['Invoice ID', 'Company', 'Amount', 'Date', 'Due Date', 'Status'].map((h) => (
                        <th key={h} className="text-left py-3 px-4 text-slate-400 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {INVOICES.map((inv) => (
                      <tr key={inv.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                        <td className="py-3 px-4 text-slate-300 font-mono text-xs">{inv.id}</td>
                        <td className="py-3 px-4 text-slate-200">{inv.company}</td>
                        <td className="py-3 px-4 text-slate-300">${inv.amount}</td>
                        <td className="py-3 px-4 text-slate-400">{inv.date}</td>
                        <td className="py-3 px-4 text-slate-400">{inv.dueDate}</td>
                        <td className="py-3 px-4"><StatusBadge status={inv.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="history" className="mt-3">
          <Card className="bg-[#13131f] border-white/[0.06]">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">Payment History (Last 30 Days)</h3>
              <div className="space-y-2">
                {INVOICES.filter(i => i.status === 'Paid').map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between py-2 px-3 bg-white/[0.02] rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-slate-200 text-sm">{inv.company}</span>
                    </div>
                    <span className="text-emerald-400 font-medium text-sm">${inv.amount}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="failed" className="mt-3">
          <Card className="bg-[#13131f] border-white/[0.06]">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">Failed Payments</h3>
              <div className="space-y-2">
                {INVOICES.filter(i => i.status === 'Failed' || i.status === 'Overdue').map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between py-2 px-3 bg-red-500/5 rounded-lg border border-red-500/10">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-red-400" />
                      <span className="text-slate-200 text-sm">{inv.company}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-red-400 font-medium text-sm">${inv.amount}</span>
                      <Button size="sm" className="h-7 bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-500/20">
                        <RefreshCw className="w-3 h-3 mr-1" /> Retry
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ───────── Module 5: Modules ───────── */
function ModulesModule() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Available Modules</h2>
        <span className="text-xs text-slate-500">{MODULES.filter(m => m.enabled).length} of {MODULES.length} active</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {MODULES.map((mod) => (
          <Card key={mod.id} className={`bg-[#13131f] border ${mod.enabled ? 'border-cyan-500/20' : 'border-white/[0.06]'}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2.5 rounded-lg ${mod.enabled ? 'bg-cyan-500/10' : 'bg-slate-500/10'}`}>
                  <Package className={`w-5 h-5 ${mod.enabled ? 'text-cyan-400' : 'text-slate-500'}`} />
                </div>
                <div className="flex items-center gap-2">
                  {mod.enabled ? <Unlock className="w-4 h-4 text-emerald-400" /> : <Lock className="w-4 h-4 text-slate-500" />}
                </div>
              </div>
              <h3 className="text-slate-200 font-semibold text-sm">{mod.name}</h3>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">{mod.description}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-slate-500">{mod.activeCompanies} companies</span>
                <Button variant="ghost" size="sm" className="h-6 text-xs text-slate-400 hover:text-cyan-400 px-2">
                  Configure
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Feature Flags */}
      <Card className="bg-[#13131f] border-white/[0.06]">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Feature Flags per Company</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Company</th>
                  <th className="text-center py-2 px-3 text-slate-400 font-medium">KOBECARGO</th>
                  <th className="text-center py-2 px-3 text-slate-400 font-medium">KobePrint</th>
                  <th className="text-center py-2 px-3 text-slate-400 font-medium">KobeHotel</th>
                  <th className="text-center py-2 px-3 text-slate-400 font-medium">KobePay</th>
                  <th className="text-center py-2 px-3 text-slate-400 font-medium">ERP Suite</th>
                </tr>
              </thead>
              <tbody>
                {COMPANIES.slice(0, 8).map((company) => (
                  <tr key={company.id} className="border-b border-white/[0.04]">
                    <td className="py-2 px-3 text-slate-200">{company.name}</td>
                    {['KOBECARGO', 'KobePrint', 'KobeHotel', 'KobePay', 'ERP Suite'].map((modName) => {
                      const hasMod = (company.modules ?? 0) > Math.floor(Math.random() * 5) + 1;
                      return (
                        <td key={modName} className="py-2 px-3 text-center">
                          {hasMod ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /> : <XCircle className="w-4 h-4 text-slate-600 mx-auto" />}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ───────── Module 6: Roles ───────── */
function RolesModule() {
  const [showCreateRole, setShowCreateRole] = useState(false);
  const allPermissions = ['View', 'Edit', 'Delete', 'Approve', 'Reports', 'Settings'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Role Management</h2>
        <Button onClick={() => setShowCreateRole(true)} className="bg-pink-600 hover:bg-pink-700 text-white">
          <Plus className="w-4 h-4 mr-1" /> Create Role
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {ROLES.map((role) => (
          <Card key={role.id} className="bg-[#13131f] border-white/[0.06]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-lg bg-pink-500/10">
                  <Users className="w-4 h-4 text-pink-400" />
                </div>
                {role.builtIn && <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px]">Built-in</Badge>}
              </div>
              <h3 className="text-slate-200 font-semibold text-sm">{role.name}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{role.userCount} users assigned</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {role.permissions.map((perm) => (
                  <span key={perm} className="text-[10px] px-1.5 py-0.5 bg-white/5 text-slate-400 rounded">{perm}</span>
                ))}
              </div>
              <div className="mt-3 flex gap-1">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-blue-400">
                  <Edit className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Role Dialog */}
      <Dialog open={showCreateRole} onOpenChange={setShowCreateRole}>
        <DialogContent className="bg-[#13131f] border-white/[0.06] text-slate-200 max-w-md">
          <DialogHeader>
            <DialogTitle>Create Custom Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Role Name</label>
              <Input placeholder="e.g. Marketing Manager" className="bg-[#0a0a1a] border-white/[0.06] text-slate-200" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Permissions</label>
              <div className="grid grid-cols-2 gap-2">
                {allPermissions.map((perm) => (
                  <label key={perm} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                    <input type="checkbox" className="rounded border-slate-600" />
                    {perm}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button className="bg-pink-600 hover:bg-pink-700 text-white flex-1">Create Role</Button>
              <Button variant="outline" onClick={() => setShowCreateRole(false)} className="border-white/[0.06] text-slate-300 hover:bg-white/5">Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ───────── Module 7: Troubleshoot ───────── */
function TroubleshootModule() {
  return (
    <div className="space-y-4">
      {/* System Health */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="bg-[#13131f] border-white/[0.06]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10"><Cpu className="w-5 h-5 text-emerald-400" /></div>
              <div>
                <p className="text-xs text-slate-400">CPU Usage</p>
                <p className="text-lg font-bold text-emerald-400">42%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#13131f] border-white/[0.06]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10"><HardDrive className="w-5 h-5 text-amber-400" /></div>
              <div>
                <p className="text-xs text-slate-400">Memory</p>
                <p className="text-lg font-bold text-amber-400">68%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#13131f] border-white/[0.06]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10"><HardDrive className="w-5 h-5 text-blue-400" /></div>
              <div>
                <p className="text-xs text-slate-400">Disk</p>
                <p className="text-lg font-bold text-blue-400">55%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#13131f] border-white/[0.06]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10"><Wifi className="w-5 h-5 text-emerald-400" /></div>
              <div>
                <p className="text-xs text-slate-400">Network</p>
                <p className="text-lg font-bold text-emerald-400">Online</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2">
        <Button variant="outline" className="border-white/[0.06] text-slate-300 hover:bg-white/5">
          <RefreshCw className="w-4 h-4 mr-1" /> Restart Service
        </Button>
        <Button variant="outline" className="border-white/[0.06] text-slate-300 hover:bg-white/5">
          <Trash2 className="w-4 h-4 mr-1" /> Clear Cache
        </Button>
        <Button variant="outline" className="border-white/[0.06] text-slate-300 hover:bg-white/5">
          <Activity className="w-4 h-4 mr-1" /> Run Diagnostics
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Error Logs */}
        <Card className="bg-[#13131f] border-white/[0.06]">
          <CardContent className="p-0">
            <div className="p-4 border-b border-white/[0.06]">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" /> Error Logs
              </h3>
            </div>
            <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#13131f]">
                  <tr className="border-b border-white/[0.06]">
                    {['Time', 'Module', 'Error', 'Severity'].map((h) => (
                      <th key={h} className="text-left py-2 px-3 text-slate-400 font-medium text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ERROR_LOGS.map((log) => (
                    <tr key={log.id} className="border-b border-white/[0.04]">
                      <td className="py-2 px-3 text-slate-500 text-xs whitespace-nowrap">{log.timestamp}</td>
                      <td className="py-2 px-3 text-slate-300 text-xs">{log.module}</td>
                      <td className="py-2 px-3 text-slate-400 text-xs max-w-[200px] truncate">{log.error}</td>
                      <td className="py-2 px-3"><StatusBadge status={log.severity} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Support Tickets */}
        <Card className="bg-[#13131f] border-white/[0.06]">
          <CardContent className="p-0">
            <div className="p-4 border-b border-white/[0.06]">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-orange-400" /> Support Tickets
              </h3>
            </div>
            <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#13131f]">
                  <tr className="border-b border-white/[0.06]">
                    {['ID', 'Company', 'Subject', 'Priority', 'Status'].map((h) => (
                      <th key={h} className="text-left py-2 px-3 text-slate-400 font-medium text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TICKETS.map((ticket) => (
                    <tr key={ticket.id} className="border-b border-white/[0.04]">
                      <td className="py-2 px-3 text-slate-500 text-xs font-mono">{ticket.id}</td>
                      <td className="py-2 px-3 text-slate-300 text-xs">{ticket.company}</td>
                      <td className="py-2 px-3 text-slate-300 text-xs max-w-[180px] truncate">{ticket.subject}</td>
                      <td className="py-2 px-3"><PriorityIcon priority={ticket.priority} /></td>
                      <td className="py-2 px-3"><StatusBadge status={ticket.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* DB Status */}
      <Card className="bg-[#13131f] border-white/[0.06]">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Database Connection Status</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-center gap-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-sm text-slate-200">Primary DB</p>
                <p className="text-xs text-slate-500">Connected - 12ms latency</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-sm text-slate-200">Replica DB</p>
                <p className="text-xs text-slate-500">Connected - 18ms latency</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-sm text-slate-200">Redis Cache</p>
                <p className="text-xs text-slate-500">Connected - 3ms latency</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ───────── Module 8: Settings ───────── */
function SettingsModule() {
  const [activeSettingsTab, setActiveSettingsTab] = useState('platform');

  return (
    <div className="space-y-4">
      <Tabs value={activeSettingsTab} onValueChange={setActiveSettingsTab}>
        <TabsList className="bg-[#13131f] border border-white/[0.06] flex-wrap h-auto">
          <TabsTrigger value="platform" className="data-[state=active]:bg-slate-600 data-[state=active]:text-white">Platform</TabsTrigger>
          <TabsTrigger value="plans" className="data-[state=active]:bg-slate-600 data-[state=active]:text-white">Plans</TabsTrigger>
          <TabsTrigger value="payments" className="data-[state=active]:bg-slate-600 data-[state=active]:text-white">Payments</TabsTrigger>
          <TabsTrigger value="email" className="data-[state=active]:bg-slate-600 data-[state=active]:text-white">Email</TabsTrigger>
          <TabsTrigger value="api" className="data-[state=active]:bg-slate-600 data-[state=active]:text-white">API Keys</TabsTrigger>
        </TabsList>

        <TabsContent value="platform" className="mt-3">
          <Card className="bg-[#13131f] border-white/[0.06]">
            <CardContent className="p-4 space-y-4">
              <h3 className="text-sm font-semibold text-slate-200">Platform Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Platform Name</label>
                  <Input defaultValue="Kobetech" className="bg-[#0a0a1a] border-white/[0.06] text-slate-200" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Contact Email</label>
                  <Input defaultValue="support@kobetech.com" className="bg-[#0a0a1a] border-white/[0.06] text-slate-200" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Logo URL</label>
                  <Input defaultValue="https://cdn.kobetech.com/logo.png" className="bg-[#0a0a1a] border-white/[0.06] text-slate-200" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Support Phone</label>
                  <Input defaultValue="+255 768 123 456" className="bg-[#0a0a1a] border-white/[0.06] text-slate-200" />
                </div>
              </div>
              <Button className="bg-slate-600 hover:bg-slate-700 text-white">Save Settings</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="mt-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { name: 'Basic', price: '49', users: '20', modules: '3', storage: '10GB', color: 'border-slate-500/20' },
              { name: 'Pro', price: '149', users: '100', modules: '6', storage: '50GB', color: 'border-blue-500/20' },
              { name: 'Enterprise', price: '499', users: 'Unlimited', modules: 'All', storage: '500GB', color: 'border-violet-500/20' },
            ].map((plan) => (
              <Card key={plan.name} className={`bg-[#13131f] border ${plan.color}`}>
                <CardContent className="p-4 space-y-3">
                  <h3 className="text-slate-200 font-semibold">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-slate-100">${plan.price}</span>
                    <span className="text-xs text-slate-500">/month</span>
                  </div>
                  <div className="space-y-1 text-xs text-slate-400">
                    <p className="flex items-center gap-2"><Users className="w-3 h-3" /> Up to {plan.users} users</p>
                    <p className="flex items-center gap-2"><Package className="w-3 h-3" /> {plan.modules} modules</p>
                    <p className="flex items-center gap-2"><HardDrive className="w-3 h-3" /> {plan.storage} storage</p>
                  </div>
                  <div className="pt-2">
                    <label className="text-xs text-slate-400 mb-1 block">Price (USD)</label>
                    <Input defaultValue={plan.price} className="bg-[#0a0a1a] border-white/[0.06] text-slate-200 h-8" />
                  </div>
                  <Button variant="outline" size="sm" className="w-full border-white/[0.06] text-slate-300 hover:bg-white/5">
                    <Edit className="w-3 h-3 mr-1" /> Edit Plan
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="payments" className="mt-3">
          <Card className="bg-[#13131f] border-white/[0.06]">
            <CardContent className="p-4 space-y-4">
              <h3 className="text-sm font-semibold text-slate-200">Payment Gateway Configuration</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Stripe Public Key</label>
                  <Input defaultValue="pk_live_51Kx..." type="password" className="bg-[#0a0a1a] border-white/[0.06] text-slate-200" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Stripe Secret Key</label>
                  <Input defaultValue="sk_live_51Kx..." type="password" className="bg-[#0a0a1a] border-white/[0.06] text-slate-200" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Webhook URL</label>
                  <Input defaultValue="https://api.kobetech.com/webhooks/stripe" className="bg-[#0a0a1a] border-white/[0.06] text-slate-200" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Webhook Secret</label>
                  <Input defaultValue="whsec_..." type="password" className="bg-[#0a0a1a] border-white/[0.06] text-slate-200" />
                </div>
              </div>
              <Button className="bg-slate-600 hover:bg-slate-700 text-white">Save Payment Config</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="mt-3">
          <Card className="bg-[#13131f] border-white/[0.06]">
            <CardContent className="p-4 space-y-4">
              <h3 className="text-sm font-semibold text-slate-200">Email Templates</h3>
              <div className="space-y-2">
                {['Welcome Email', 'Subscription Renewal', 'Account Suspension', 'Password Reset', 'Payment Failed', 'Trial Expiring'].map((tpl) => (
                  <div key={tpl} className="flex items-center justify-between py-2 px-3 bg-white/[0.02] rounded-lg hover:bg-white/[0.04] cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Globe className="w-4 h-4 text-slate-500" />
                      <span className="text-sm text-slate-200">{tpl}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="mt-3">
          <Card className="bg-[#13131f] border-white/[0.06]">
            <CardContent className="p-4 space-y-4">
              <h3 className="text-sm font-semibold text-slate-200">API Key Management</h3>
              <div className="space-y-3">
                {[
                  { key: 'kt_live_prod_abc123...', name: 'Production API Key', status: 'Active' },
                  { key: 'kt_live_staging_def456...', name: 'Staging API Key', status: 'Active' },
                  { key: 'kt_test_ghi789...', name: 'Test API Key', status: 'Active' },
                ].map((api, idx) => (
                  <div key={idx} className="flex items-center justify-between py-3 px-3 bg-white/[0.02] rounded-lg">
                    <div>
                      <p className="text-sm text-slate-200">{api.name}</p>
                      <p className="text-xs text-slate-500 font-mono">{api.key}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-400 hover:text-slate-200">
                        <Eye className="w-3.5 h-3.5 mr-1" /> View
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400 hover:text-red-300">
                        <RefreshCw className="w-3.5 h-3.5 mr-1" /> Rotate
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="border-white/[0.06] text-slate-300 hover:bg-white/5">
                <Plus className="w-4 h-4 mr-1" /> Generate New API Key
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ───────── Main Layout ───────── */
export default function KobetechAdmin() {
  const [activeModule, setActiveModule] = useState('dashboard');

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { id: 'companies', label: 'Companies', icon: Building2, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { id: 'billing', label: 'Billing', icon: Receipt, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { id: 'modules', label: 'Modules', icon: Package, color: 'text-violet-400', bg: 'bg-violet-500/10' },
    { id: 'roles', label: 'Roles', icon: Users, color: 'text-pink-400', bg: 'bg-pink-500/10' },
    { id: 'troubleshoot', label: 'Troubleshoot', icon: Wrench, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { id: 'settings', label: 'Settings', icon: Settings, color: 'text-slate-400', bg: 'bg-slate-500/10' },
  ];

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard': return <DashboardModule />;
      case 'companies': return <CompaniesModule />;
      case 'subscriptions': return <SubscriptionsModule />;
      case 'billing': return <BillingModule />;
      case 'modules': return <ModulesModule />;
      case 'roles': return <RolesModule />;
      case 'troubleshoot': return <TroubleshootModule />;
      case 'settings': return <SettingsModule />;
      default: return <DashboardModule />;
    }
  };

  return (
    <div className="flex h-screen bg-[#0a0a1a] text-slate-200 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-[#13131f] border-r border-white/[0.06] flex flex-col shrink-0">
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Shield className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-100 tracking-wide">KOBETECH</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Super Admin</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveModule(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeModule === item.id
                  ? `${item.bg} ${item.color}`
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
              }`}
            >
              <item.icon className={`w-4.5 h-4.5 ${activeModule === item.id ? item.color : 'text-slate-500'}`} />
              {item.label}
              {activeModule === item.id && <ChevronRight className="w-4 h-4 ml-auto" />}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-emerald-500/10">
              <Smartphone className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-slate-300">Kobetech Admin</p>
              <p className="text-[10px] text-slate-500">v2.4.0</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-10 bg-[#0a0a1a]/80 backdrop-blur-md border-b border-white/[0.06] px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-100">
                {navItems.find(n => n.id === activeModule)?.label}
              </h2>
              <X className="w-3 h-3 text-slate-600" />
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5" /> System Online
              </Badge>
            </div>
          </div>
        </header>
        <div className="p-6">
          {renderModule()}
        </div>
      </main>
    </div>
  );
}
