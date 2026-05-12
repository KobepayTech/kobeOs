import { useState, useMemo } from 'react';
import {
  Wallet, LayoutDashboard, Users, ArrowDownLeft, Send, Building2, Share2, Receipt, Settings,
  Plus, Search, CheckCircle2, Clock, XCircle, Phone, User, Mail, CreditCard, Banknote,
  Smartphone, Landmark, DollarSign, ChevronRight, X, Check, Download, Printer, QrCode,
  Trash2, Edit, Eye, Filter, BadgeCheck, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QRCodeSVG } from 'qrcode.react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type Role = 'Admin' | 'Cashier TZ' | 'Cashier China';
type Module = 'dashboard' | 'customers' | 'deposits' | 'payouts' | 'suppliers' | 'allocations' | 'receipts' | 'settings';
type DepositStatus = 'Pending' | 'Confirmed';
type PayoutStatus = 'INITIATED' | 'SENT' | 'CONFIRMED' | 'PAID';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  idNumber: string;
  company: string;
  notes: string;
  balance: number;
  depositCount: number;
  lastDeposit: string;
  createdAt: string;
}

interface Deposit {
  id: string;
  customerId: string;
  customerName: string;
  phone: string;
  amount: number;
  currency: string;
  method: string;
  reference: string;
  status: DepositStatus;
  date: string;
}

interface Payout {
  id: string;
  supplierId: string;
  supplierName: string;
  amount: number;
  currency: string;
  method: string;
  status: PayoutStatus;
  initiatedBy: string;
  confirmedBy: string;
  date: string;
  notes: string;
}

interface Supplier {
  id: string;
  name: string;
  country: string;
  contact: string;
  phone: string;
  balance: number;
  orders: number;
  status: 'Active' | 'Inactive';
}

interface Allocation {
  id: string;
  customerId: string;
  customerName: string;
  supplierId: string;
  supplierName: string;
  amount: number;
  orderRef: string;
  type: string;
  date: string;
}

interface Receipt {
  id: string;
  transactionId: string;
  customerName: string;
  supplierName: string;
  amount: number;
  currency: string;
  type: string;
  status: string;
  date: string;
  reference: string;
}

const MOCK_CUSTOMERS: Customer[] = [
  { id: 'C001', name: 'Juma Abdallah', phone: '+255713456789', email: 'juma@email.com', idNumber: 'TZ123456', company: 'Juma Traders', notes: 'Regular customer', balance: 4850, depositCount: 12, lastDeposit: '2024-01-15', createdAt: '2023-08-10' },
  { id: 'C002', name: 'Asha Mohamed', phone: '+255723987654', email: 'asha@email.com', idNumber: 'TZ234567', company: 'Asha Imports', notes: '', balance: 3200, depositCount: 8, lastDeposit: '2024-01-14', createdAt: '2023-09-22' },
  { id: 'C003', name: 'Emmanuel Joseph', phone: '+255734567890', email: 'emmanuel@email.com', idNumber: 'TZ345678', company: 'EJ Logistics', notes: 'Prefers M-Pesa', balance: 1200, depositCount: 5, lastDeposit: '2024-01-13', createdAt: '2023-10-05' },
  { id: 'C004', name: 'Grace Mwangi', phone: '+255745678901', email: 'grace@email.com', idNumber: 'TZ456789', company: 'Grace Enterprises', notes: '', balance: 6750, depositCount: 15, lastDeposit: '2024-01-15', createdAt: '2023-07-18' },
  { id: 'C005', name: 'Patrick Ochieng', phone: '+255756789012', email: 'patrick@email.com', idNumber: 'TZ567890', company: 'Pato Shipping', notes: 'Dubai route', balance: 2100, depositCount: 4, lastDeposit: '2024-01-12', createdAt: '2023-11-01' },
  { id: 'C006', name: 'Fatima Hassan', phone: '+255767890123', email: 'fatima@email.com', idNumber: 'TZ678901', company: 'Hassan Goods', notes: '', balance: 8900, depositCount: 20, lastDeposit: '2024-01-15', createdAt: '2023-06-15' },
  { id: 'C007', name: 'David Kimaro', phone: '+255778901234', email: 'david@email.com', idNumber: 'TZ789012', company: 'DK Transport', notes: 'Nairobi route', balance: 1500, depositCount: 3, lastDeposit: '2024-01-10', createdAt: '2023-12-20' },
  { id: 'C008', name: 'Salome Peter', phone: '+255789012345', email: 'salome@email.com', idNumber: 'TZ890123', company: 'Salome Trade', notes: '', balance: 5600, depositCount: 10, lastDeposit: '2024-01-14', createdAt: '2023-08-30' },
  { id: 'C009', name: 'Michael John', phone: '+255790123456', email: 'michael@email.com', idNumber: 'TZ901234', company: 'MJ Imports', notes: 'New customer Jan', balance: 800, depositCount: 2, lastDeposit: '2024-01-08', createdAt: '2024-01-03' },
  { id: 'C010', name: 'Rehema Issa', phone: '+255701234567', email: 'rehema@email.com', idNumber: 'TZ012345', company: 'Rehema Co', notes: '', balance: 4300, depositCount: 9, lastDeposit: '2024-01-13', createdAt: '2023-09-10' },
];

const MOCK_DEPOSITS: Deposit[] = [
  { id: 'D001', customerId: 'C001', customerName: 'Juma Abdallah', phone: '+255713456789', amount: 500, currency: 'USD', method: 'M-Pesa', reference: 'REFTZ001', status: 'Confirmed', date: '2024-01-15' },
  { id: 'D002', customerId: 'C002', customerName: 'Asha Mohamed', phone: '+255723987654', amount: 1200, currency: 'USD', method: 'Bank Transfer', reference: 'REFTZ002', status: 'Confirmed', date: '2024-01-14' },
  { id: 'D003', customerId: 'C003', customerName: 'Emmanuel Joseph', phone: '+255734567890', amount: 300, currency: 'USD', method: 'Cash', reference: 'REFTZ003', status: 'Confirmed', date: '2024-01-13' },
  { id: 'D004', customerId: 'C004', customerName: 'Grace Mwangi', phone: '+255745678901', amount: 1500, currency: 'USD', method: 'M-Pesa', reference: 'REFTZ004', status: 'Confirmed', date: '2024-01-15' },
  { id: 'D005', customerId: 'C005', customerName: 'Patrick Ochieng', phone: '+255756789012', amount: 700, currency: 'USD', method: 'Agent', reference: 'REFTZ005', status: 'Pending', date: '2024-01-12' },
  { id: 'D006', customerId: 'C006', customerName: 'Fatima Hassan', phone: '+255767890123', amount: 2000, currency: 'USD', method: 'Bank Transfer', reference: 'REFTZ006', status: 'Confirmed', date: '2024-01-15' },
  { id: 'D007', customerId: 'C001', customerName: 'Juma Abdallah', phone: '+255713456789', amount: 350, currency: 'USD', method: 'M-Pesa', reference: 'REFTZ007', status: 'Confirmed', date: '2024-01-11' },
  { id: 'D008', customerId: 'C007', customerName: 'David Kimaro', phone: '+255778901234', amount: 500, currency: 'USD', method: 'Cash', reference: 'REFTZ008', status: 'Confirmed', date: '2024-01-10' },
  { id: 'D009', customerId: 'C008', customerName: 'Salome Peter', phone: '+255789012345', amount: 900, currency: 'USD', method: 'WeChat Pay', reference: 'REFTZ009', status: 'Confirmed', date: '2024-01-14' },
  { id: 'D010', customerId: 'C009', customerName: 'Michael John', phone: '+255790123456', amount: 400, currency: 'USD', method: 'M-Pesa', reference: 'REFTZ010', status: 'Pending', date: '2024-01-08' },
  { id: 'D011', customerId: 'C010', customerName: 'Rehema Issa', phone: '+255701234567', amount: 1100, currency: 'USD', method: 'Bank Transfer', reference: 'REFTZ011', status: 'Confirmed', date: '2024-01-13' },
  { id: 'D012', customerId: 'C004', customerName: 'Grace Mwangi', phone: '+255745678901', amount: 2500, currency: 'USD', method: 'Alipay', reference: 'REFTZ012', status: 'Confirmed', date: '2024-01-09' },
  { id: 'D013', customerId: 'C002', customerName: 'Asha Mohamed', phone: '+255723987654', amount: 800, currency: 'USD', method: 'M-Pesa', reference: 'REFTZ013', status: 'Confirmed', date: '2024-01-07' },
  { id: 'D014', customerId: 'C006', customerName: 'Fatima Hassan', phone: '+255767890123', amount: 3000, currency: 'USD', method: 'Bank Transfer', reference: 'REFTZ014', status: 'Confirmed', date: '2024-01-06' },
  { id: 'D015', customerId: 'C001', customerName: 'Juma Abdallah', phone: '+255713456789', amount: 600, currency: 'USD', method: 'Cash', reference: 'REFTZ015', status: 'Confirmed', date: '2024-01-05' },
];

const MOCK_PAYOUTS: Payout[] = [
  { id: 'P001', supplierId: 'S001', supplierName: 'Shua Logistics', amount: 5000, currency: 'CNY', method: 'Bank', status: 'PAID', initiatedBy: 'Cashier TZ', confirmedBy: 'Cashier China', date: '2024-01-15', notes: 'Regular shipment' },
  { id: 'P002', supplierId: 'S002', supplierName: 'Yiwu Market', amount: 12000, currency: 'CNY', method: 'WeChat', status: 'CONFIRMED', initiatedBy: 'Cashier TZ', confirmedBy: 'Cashier China', date: '2024-01-14', notes: 'Container order' },
  { id: 'P003', supplierId: 'S003', supplierName: 'Guangzhou Ltd', amount: 8500, currency: 'CNY', method: 'Bank', status: 'SENT', initiatedBy: 'Cashier TZ', confirmedBy: '', date: '2024-01-13', notes: 'Electronics batch' },
  { id: 'P004', supplierId: 'S001', supplierName: 'Shua Logistics', amount: 3200, currency: 'CNY', method: 'Alipay', status: 'INITIATED', initiatedBy: 'Cashier TZ', confirmedBy: '', date: '2024-01-15', notes: 'Express delivery' },
  { id: 'P005', supplierId: 'S004', supplierName: 'Dar Port', amount: 2100, currency: 'USD', method: 'Bank', status: 'PAID', initiatedBy: 'Cashier TZ', confirmedBy: 'Cashier China', date: '2024-01-12', notes: 'Port clearance' },
  { id: 'P006', supplierId: 'S005', supplierName: 'Arusha Hub', amount: 4500, currency: 'USD', method: 'M-Pesa', status: 'CONFIRMED', initiatedBy: 'Cashier TZ', confirmedBy: 'Cashier China', date: '2024-01-11', notes: 'Warehouse fee' },
  { id: 'P007', supplierId: 'S002', supplierName: 'Yiwu Market', amount: 18000, currency: 'CNY', method: 'Bank', status: 'PAID', initiatedBy: 'Cashier TZ', confirmedBy: 'Cashier China', date: '2024-01-10', notes: 'Bulk textiles' },
  { id: 'P008', supplierId: 'S006', supplierName: 'Mwanza Cargo', amount: 6700, currency: 'USD', method: 'Bank', status: 'SENT', initiatedBy: 'Cashier TZ', confirmedBy: '', date: '2024-01-09', notes: 'Lake transport' },
  { id: 'P009', supplierId: 'S003', supplierName: 'Guangzhou Ltd', amount: 9500, currency: 'CNY', method: 'WeChat', status: 'INITIATED', initiatedBy: 'Cashier TZ', confirmedBy: '', date: '2024-01-08', notes: 'New order' },
  { id: 'P010', supplierId: 'S007', supplierName: 'Nairobi Express', amount: 4200, currency: 'USD', method: 'M-Pesa', status: 'PAID', initiatedBy: 'Cashier TZ', confirmedBy: 'Cashier China', date: '2024-01-07', notes: 'Cross-border' },
  { id: 'P011', supplierId: 'S001', supplierName: 'Shua Logistics', amount: 7800, currency: 'CNY', method: 'Alipay', status: 'CONFIRMED', initiatedBy: 'Cashier TZ', confirmedBy: 'Cashier China', date: '2024-01-06', notes: 'Air freight' },
  { id: 'P012', supplierId: 'S008', supplierName: 'Dubai Freight', amount: 15000, currency: 'USD', method: 'Bank', status: 'PAID', initiatedBy: 'Cashier TZ', confirmedBy: 'Cashier China', date: '2024-01-05', notes: 'Dubai route' },
  { id: 'P013', supplierId: 'S004', supplierName: 'Dar Port', amount: 5600, currency: 'USD', method: 'Bank', status: 'SENT', initiatedBy: 'Cashier TZ', confirmedBy: '', date: '2024-01-04', notes: 'Port storage' },
  { id: 'P014', supplierId: 'S005', supplierName: 'Arusha Hub', amount: 3300, currency: 'USD', method: 'M-Pesa', status: 'INITIATED', initiatedBy: 'Cashier TZ', confirmedBy: '', date: '2024-01-03', notes: 'Hub rental' },
  { id: 'P015', supplierId: 'S002', supplierName: 'Yiwu Market', amount: 22000, currency: 'CNY', method: 'Bank', status: 'PAID', initiatedBy: 'Cashier TZ', confirmedBy: 'Cashier China', date: '2024-01-02', notes: 'Annual order' },
];

const MOCK_SUPPLIERS: Supplier[] = [
  { id: 'S001', name: 'Shua Logistics', country: 'China', contact: 'Li Wei', phone: '+8613810012345', balance: 45000, orders: 128, status: 'Active' },
  { id: 'S002', name: 'Yiwu Market', country: 'China', contact: 'Wang Fang', phone: '+8613910056789', balance: 128000, orders: 342, status: 'Active' },
  { id: 'S003', name: 'Guangzhou Ltd', country: 'China', contact: 'Chen Ming', phone: '+8613710098765', balance: 76000, orders: 215, status: 'Active' },
  { id: 'S004', name: 'Dar Port', country: 'Tanzania', contact: 'Omar Hassan', phone: '+255713456789', balance: 23000, orders: 89, status: 'Active' },
  { id: 'S005', name: 'Arusha Hub', country: 'Tanzania', contact: 'Anna Joseph', phone: '+255723987654', balance: 18000, orders: 67, status: 'Active' },
  { id: 'S006', name: 'Mwanza Cargo', country: 'Tanzania', contact: 'Peter Simon', phone: '+255734567890', balance: 12000, orders: 45, status: 'Inactive' },
  { id: 'S007', name: 'Nairobi Express', country: 'Kenya', contact: 'James Kamau', phone: '+254712345678', balance: 34000, orders: 156, status: 'Active' },
  { id: 'S008', name: 'Dubai Freight', country: 'UAE', contact: 'Ahmed Al-Rashid', phone: '+971501234567', balance: 89000, orders: 203, status: 'Active' },
];

const MOCK_ALLOCATIONS: Allocation[] = [
  { id: 'A001', customerId: 'C001', customerName: 'Juma Abdallah', supplierId: 'S001', supplierName: 'Shua Logistics', amount: 2000, orderRef: 'ORD-2024-001', type: 'Deposit', date: '2024-01-15' },
  { id: 'A002', customerId: 'C002', customerName: 'Asha Mohamed', supplierId: 'S002', supplierName: 'Yiwu Market', amount: 3000, orderRef: 'ORD-2024-002', type: 'Full', date: '2024-01-14' },
  { id: 'A003', customerId: 'C004', customerName: 'Grace Mwangi', supplierId: 'S003', supplierName: 'Guangzhou Ltd', amount: 4500, orderRef: 'ORD-2024-003', type: 'Deposit', date: '2024-01-13' },
  { id: 'A004', customerId: 'C006', customerName: 'Fatima Hassan', supplierId: 'S001', supplierName: 'Shua Logistics', amount: 5500, orderRef: 'ORD-2024-004', type: 'Full', date: '2024-01-12' },
  { id: 'A005', customerId: 'C008', customerName: 'Salome Peter', supplierId: 'S002', supplierName: 'Yiwu Market', amount: 1800, orderRef: 'ORD-2024-005', type: 'Deposit', date: '2024-01-11' },
  { id: 'A006', customerId: 'C001', customerName: 'Juma Abdallah', supplierId: 'S004', supplierName: 'Dar Port', amount: 1200, orderRef: 'ORD-2024-006', type: 'Full', date: '2024-01-10' },
  { id: 'A007', customerId: 'C010', customerName: 'Rehema Issa', supplierId: 'S005', supplierName: 'Arusha Hub', amount: 2800, orderRef: 'ORD-2024-007', type: 'Deposit', date: '2024-01-09' },
  { id: 'A008', customerId: 'C004', customerName: 'Grace Mwangi', supplierId: 'S007', supplierName: 'Nairobi Express', amount: 3600, orderRef: 'ORD-2024-008', type: 'Full', date: '2024-01-08' },
  { id: 'A009', customerId: 'C002', customerName: 'Asha Mohamed', supplierId: 'S008', supplierName: 'Dubai Freight', amount: 4200, orderRef: 'ORD-2024-009', type: 'Deposit', date: '2024-01-07' },
  { id: 'A010', customerId: 'C006', customerName: 'Fatima Hassan', supplierId: 'S002', supplierName: 'Yiwu Market', amount: 6000, orderRef: 'ORD-2024-010', type: 'Full', date: '2024-01-06' },
  { id: 'A011', customerId: 'C003', customerName: 'Emmanuel Joseph', supplierId: 'S001', supplierName: 'Shua Logistics', amount: 900, orderRef: 'ORD-2024-011', type: 'Deposit', date: '2024-01-05' },
  { id: 'A012', customerId: 'C007', customerName: 'David Kimaro', supplierId: 'S004', supplierName: 'Dar Port', amount: 1500, orderRef: 'ORD-2024-012', type: 'Full', date: '2024-01-04' },
  { id: 'A013', customerId: 'C008', customerName: 'Salome Peter', supplierId: 'S003', supplierName: 'Guangzhou Ltd', amount: 2200, orderRef: 'ORD-2024-013', type: 'Deposit', date: '2024-01-03' },
  { id: 'A014', customerId: 'C001', customerName: 'Juma Abdallah', supplierId: 'S007', supplierName: 'Nairobi Express', amount: 1700, orderRef: 'ORD-2024-014', type: 'Full', date: '2024-01-02' },
  { id: 'A015', customerId: 'C005', customerName: 'Patrick Ochieng', supplierId: 'S008', supplierName: 'Dubai Freight', amount: 2100, orderRef: 'ORD-2024-015', type: 'Deposit', date: '2024-01-01' },
];

const MOCK_RECEIPTS: Receipt[] = [
  { id: 'R001', transactionId: 'TXN-20240115-001', customerName: 'Juma Abdallah', supplierName: 'Shua Logistics', amount: 500, currency: 'USD', type: 'Deposit', status: 'Confirmed', date: '2024-01-15', reference: 'REFTZ001' },
  { id: 'R002', transactionId: 'TXN-20240114-002', customerName: 'Asha Mohamed', supplierName: 'Yiwu Market', amount: 1200, currency: 'USD', type: 'Deposit', status: 'Confirmed', date: '2024-01-14', reference: 'REFTZ002' },
  { id: 'R003', transactionId: 'TXN-20240115-003', customerName: 'Grace Mwangi', supplierName: 'Guangzhou Ltd', amount: 1500, currency: 'USD', type: 'Deposit', status: 'Confirmed', date: '2024-01-15', reference: 'REFTZ004' },
  { id: 'R004', transactionId: 'TXN-20240112-004', customerName: 'Fatima Hassan', supplierName: 'Shua Logistics', amount: 2000, currency: 'USD', type: 'Deposit', status: 'Confirmed', date: '2024-01-15', reference: 'REFTZ006' },
  { id: 'R005', transactionId: 'TXN-20240110-005', customerName: 'Patrick Ochieng', supplierName: 'Dar Port', amount: 2100, currency: 'USD', type: 'Payout', status: 'Paid', date: '2024-01-12', reference: 'PAYOUT005' },
  { id: 'R006', transactionId: 'TXN-20240108-006', customerName: 'Salome Peter', supplierName: 'Arusha Hub', amount: 4500, currency: 'USD', type: 'Payout', status: 'Paid', date: '2024-01-11', reference: 'PAYOUT006' },
  { id: 'R007', transactionId: 'TXN-20240106-007', customerName: 'David Kimaro', supplierName: 'Nairobi Express', amount: 4200, currency: 'USD', type: 'Payout', status: 'Paid', date: '2024-01-07', reference: 'PAYOUT010' },
  { id: 'R008', transactionId: 'TXN-20240105-008', customerName: 'Rehema Issa', supplierName: 'Dubai Freight', amount: 15000, currency: 'USD', type: 'Payout', status: 'Paid', date: '2024-01-05', reference: 'PAYOUT012' },
];

const WEEKLY_DATA = [
  { day: 'Mon', deposits: 4200, payouts: 3100 },
  { day: 'Tue', deposits: 5800, payouts: 4200 },
  { day: 'Wed', deposits: 3900, payouts: 2800 },
  { day: 'Thu', deposits: 7200, payouts: 5600 },
  { day: 'Fri', deposits: 6500, payouts: 4800 },
  { day: 'Sat', deposits: 2100, payouts: 1200 },
  { day: 'Sun', deposits: 1800, payouts: 900 },
];

const SIDEBAR_ITEMS: { id: Module; label: string; icon: typeof Wallet; color: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'text-cyan-400' },
  { id: 'customers', label: 'Customers', icon: Users, color: 'text-blue-400' },
  { id: 'deposits', label: 'Deposits', icon: ArrowDownLeft, color: 'text-emerald-400' },
  { id: 'payouts', label: 'Payouts', icon: Send, color: 'text-amber-400' },
  { id: 'suppliers', label: 'Suppliers', icon: Building2, color: 'text-violet-400' },
  { id: 'allocations', label: 'Allocations', icon: Share2, color: 'text-pink-400' },
  { id: 'receipts', label: 'Receipts', icon: Receipt, color: 'text-orange-400' },
  { id: 'settings', label: 'Settings', icon: Settings, color: 'text-slate-400' },
];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Pending: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    Confirmed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    INITIATED: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    SENT: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    CONFIRMED: 'bg-violet-500/15 text-violet-400 border-violet-500/20',
    PAID: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    Active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    Inactive: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
  };
  return <Badge variant="outline" className={`${map[status] || 'bg-slate-500/15 text-slate-400'} text-xs font-medium`}>{status}</Badge>;
}

function MethodIcon({ method }: { method: string }) {
  switch (method) {
    case 'Cash': return <Banknote className="w-4 h-4 text-emerald-400" />;
    case 'M-Pesa': return <Smartphone className="w-4 h-4 text-green-400" />;
    case 'Bank Transfer': return <Landmark className="w-4 h-4 text-blue-400" />;
    case 'Agent': return <User className="w-4 h-4 text-violet-400" />;
    case 'WeChat Pay': return <CreditCard className="w-4 h-4 text-cyan-400" />;
    case 'Alipay': return <CreditCard className="w-4 h-4 text-blue-500" />;
    case 'Bank': return <Landmark className="w-4 h-4 text-blue-400" />;
    case 'WeChat': return <Smartphone className="w-4 h-4 text-green-400" />;
    default: return <DollarSign className="w-4 h-4 text-slate-400" />;
  }
}

export default function KobePay() {
  const [role, setRole] = useState<Role>('Admin');
  const [module, setModule] = useState<Module>('dashboard');
  const [customers, setCustomers] = useState<Customer[]>(MOCK_CUSTOMERS);
  const [deposits, setDeposits] = useState<Deposit[]>(MOCK_DEPOSITS);
  const [payouts, setPayouts] = useState<Payout[]>(MOCK_PAYOUTS);
  const [suppliers] = useState<Supplier[]>(MOCK_SUPPLIERS);
  const [allocations, setAllocations] = useState<Allocation[]>(MOCK_ALLOCATIONS);

  // Customer search state
  const [phoneSearch, setPhoneSearch] = useState('');
  const [searchedCustomer, setSearchedCustomer] = useState<Customer | null>(null);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerId, setNewCustomerId] = useState('');
  const [newCustomerCompany, setNewCustomerCompany] = useState('');
  const [newCustomerNotes, setNewCustomerNotes] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');

  // Customer edit state
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Deposit form state
  const [depositPhone, setDepositPhone] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositCurrency, setDepositCurrency] = useState('USD');
  const [depositMethod, setDepositMethod] = useState('M-Pesa');
  const [depositRef, setDepositRef] = useState('');
  const [selectedDepositCustomer, setSelectedDepositCustomer] = useState<Customer | null>(null);
  const [depositStatusFilter, setDepositStatusFilter] = useState<string>('All');

  // Payout form state
  const [payoutSupplier, setPayoutSupplier] = useState('');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutCurrency, setPayoutCurrency] = useState('CNY');
  const [payoutMethod, setPayoutMethod] = useState('Bank');
  const [payoutNotes, setPayoutNotes] = useState('');

  // Allocation form state
  const [allocCustomer, setAllocCustomer] = useState('');
  const [allocSupplier, setAllocSupplier] = useState('');
  const [allocAmount, setAllocAmount] = useState('');
  const [allocOrderRef, setAllocOrderRef] = useState('');
  const [allocType, setAllocType] = useState('Deposit');

  // Receipt dialog
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);

  // Transaction detail dialog
  const [selectedTransaction, setSelectedTransaction] = useState<Deposit | null>(null);
  const [showTransactionDialog, setShowTransactionDialog] = useState(false);

  // Settings state
  const [businessName, setBusinessName] = useState('KobePay Trade Finance');
  const [businessPhone, setBusinessPhone] = useState('+255 713 456 789');
  const [businessEmail, setBusinessEmail] = useState('support@kobepay.co');
  const [businessAddress, setBusinessAddress] = useState('Kariakoo, Dar es Salaam, Tanzania');
  const [defaultCurrency, setDefaultCurrency] = useState('USD');
  const [receiptPrefix, setReceiptPrefix] = useState('REFTZ');
  const [taxRate, setTaxRate] = useState('0');

  const totalWallet = useMemo(() => deposits.filter(d => d.status === 'Confirmed').reduce((s, d) => s + d.amount, 0), [deposits]);
  const unassigned = useMemo(() => totalWallet - allocations.reduce((s, a) => s + a.amount, 0), [totalWallet, allocations]);
  const allocated = useMemo(() => allocations.reduce((s, a) => s + a.amount, 0), [allocations]);
  const pendingPayouts = useMemo(() => payouts.filter(p => p.status === 'INITIATED' || p.status === 'SENT').reduce((s, p) => s + p.amount, 0), [payouts]);

  const canAccess = (m: Module): boolean => {
    if (role === 'Admin') return true;
    if (role === 'Cashier TZ') return ['dashboard', 'customers', 'deposits', 'payouts', 'receipts'].includes(m);
    if (role === 'Cashier China') return ['dashboard', 'payouts', 'receipts', 'suppliers'].includes(m);
    return false;
  };

  const handlePhoneSearch = () => {
    if (!phoneSearch.trim()) { setSearchedCustomer(null); setShowNewCustomer(false); return; }
    const found = customers.find(c => c.phone.includes(phoneSearch.trim()));
    if (found) { setSearchedCustomer(found); setShowNewCustomer(false); }
    else { setSearchedCustomer(null); setShowNewCustomer(true); setNewCustomerPhone(phoneSearch.trim()); }
  };

  const handleCreateCustomer = () => {
    if (!newCustomerName.trim() || !newCustomerPhone.trim()) return;
    const newCust: Customer = {
      id: `C${String(customers.length + 1).padStart(3, '0')}`,
      name: newCustomerName.trim(),
      phone: newCustomerPhone.trim(),
      email: newCustomerEmail,
      idNumber: newCustomerId,
      company: newCustomerCompany,
      notes: newCustomerNotes,
      balance: 0,
      depositCount: 0,
      lastDeposit: '-',
      createdAt: new Date().toISOString().split('T')[0],
    };
    setCustomers([newCust, ...customers]);
    setSearchedCustomer(newCust);
    setShowNewCustomer(false);
    setNewCustomerName(''); setNewCustomerEmail(''); setNewCustomerId(''); setNewCustomerCompany(''); setNewCustomerNotes('');
  };

  const openEditCustomer = (customer: Customer) => {
    setEditCustomer(customer);
    setEditName(customer.name);
    setEditEmail(customer.email);
    setEditCompany(customer.company);
    setEditNotes(customer.notes);
    setShowEditDialog(true);
  };

  const handleSaveEditCustomer = () => {
    if (!editCustomer || !editName.trim()) return;
    setCustomers(customers.map(c => c.id === editCustomer.id ? { ...c, name: editName.trim(), email: editEmail, company: editCompany, notes: editNotes } : c));
    if (searchedCustomer?.id === editCustomer.id) {
      setSearchedCustomer({ ...searchedCustomer, name: editName.trim(), email: editEmail, company: editCompany, notes: editNotes });
    }
    setShowEditDialog(false);
    setEditCustomer(null);
  };

  const handleDeleteCustomer = (customerId: string) => {
    setCustomers(customers.filter(c => c.id !== customerId));
    if (searchedCustomer?.id === customerId) { setSearchedCustomer(null); setShowNewCustomer(false); }
  };

  const handleDepositSubmit = () => {
    if (!selectedDepositCustomer || !depositAmount) return;
    const newDeposit: Deposit = {
      id: `D${String(deposits.length + 1).padStart(3, '0')}`,
      customerId: selectedDepositCustomer.id,
      customerName: selectedDepositCustomer.name,
      phone: selectedDepositCustomer.phone,
      amount: parseFloat(depositAmount),
      currency: depositCurrency,
      method: depositMethod,
      reference: depositRef || `${receiptPrefix}${String(deposits.length + 1).padStart(3, '0')}`,
      status: 'Confirmed',
      date: new Date().toISOString().split('T')[0],
    };
    setDeposits([newDeposit, ...deposits]);
    setCustomers(customers.map(c => c.id === selectedDepositCustomer.id ? { ...c, balance: c.balance + parseFloat(depositAmount), depositCount: c.depositCount + 1, lastDeposit: newDeposit.date } : c));
    setDepositAmount(''); setDepositRef(''); setDepositPhone(''); setSelectedDepositCustomer(null);
  };

  const handlePayoutSubmit = () => {
    if (!payoutSupplier || !payoutAmount) return;
    const sup = suppliers.find(s => s.id === payoutSupplier);
    if (!sup) return;
    const newPayout: Payout = {
      id: `P${String(payouts.length + 1).padStart(3, '0')}`,
      supplierId: sup.id,
      supplierName: sup.name,
      amount: parseFloat(payoutAmount),
      currency: payoutCurrency,
      method: payoutMethod,
      status: 'INITIATED',
      initiatedBy: role,
      confirmedBy: '',
      date: new Date().toISOString().split('T')[0],
      notes: payoutNotes,
    };
    setPayouts([newPayout, ...payouts]);
    setPayoutAmount(''); setPayoutNotes(''); setPayoutSupplier('');
  };

  const handleConfirmPayout = (payoutId: string, newStatus: PayoutStatus) => {
    setPayouts(payouts.map(p => p.id === payoutId ? { ...p, status: newStatus, confirmedBy: role } : p));
  };

  const handleAllocationSubmit = () => {
    if (!allocCustomer || !allocSupplier || !allocAmount) return;
    const amt = parseFloat(allocAmount);
    if (amt > unassigned) return;
    const cust = customers.find(c => c.id === allocCustomer);
    const sup = suppliers.find(s => s.id === allocSupplier);
    if (!cust || !sup) return;
    const newAlloc: Allocation = {
      id: `A${String(allocations.length + 1).padStart(3, '0')}`,
      customerId: cust.id,
      customerName: cust.name,
      supplierId: sup.id,
      supplierName: sup.name,
      amount: amt,
      orderRef: allocOrderRef || `ORD-${Date.now()}`,
      type: allocType,
      date: new Date().toISOString().split('T')[0],
    };
    setAllocations([newAlloc, ...allocations]);
    setAllocAmount(''); setAllocOrderRef('');
  };

  const handleDepositSearch = () => {
    const found = customers.find(c => c.phone.includes(depositPhone.trim()));
    setSelectedDepositCustomer(found || null);
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerFilter.toLowerCase()) ||
    c.phone.includes(customerFilter) ||
    c.company.toLowerCase().includes(customerFilter.toLowerCase())
  );

  const filteredDeposits = deposits.filter(d => depositStatusFilter === 'All' || d.status === depositStatusFilter);

  const getCustomerTransactions = (custId: string) => {
    const custDeposits = deposits.filter(d => d.customerId === custId);
    const custAllocs = allocations.filter(a => a.customerId === custId);
    return { deposits: custDeposits, allocations: custAllocs };
  };

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Wallet', value: `$${totalWallet.toLocaleString()}`, icon: Wallet, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
          { label: 'Unassigned', value: `$${unassigned.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Allocated', value: `$${allocated.toLocaleString()}`, icon: Share2, color: 'text-violet-400', bg: 'bg-violet-500/10' },
          { label: 'Pending Payouts', value: `$${pendingPayouts.toLocaleString()}`, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
        ].map(card => (
          <Card key={card.label} className="bg-[#13131f] border-white/[0.06]">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">{card.label}</p>
                  <p className="text-2xl font-bold text-white mt-1">{card.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center`}>
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-[#13131f] border-white/[0.06]">
          <CardContent className="p-5">
            <h3 className="text-white font-semibold mb-4">Deposits This Week</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={WEEKLY_DATA}><CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" /><XAxis dataKey="day" stroke="#64748b" fontSize={12} /><YAxis stroke="#64748b" fontSize={12} /><Tooltip contentStyle={{ background: '#13131f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} /><Bar dataKey="deposits" fill="#06b6d4" radius={[4, 4, 0, 0]} /></BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="bg-[#13131f] border-white/[0.06]">
          <CardContent className="p-5">
            <h3 className="text-white font-semibold mb-4">Payouts This Week</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={WEEKLY_DATA}><CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" /><XAxis dataKey="day" stroke="#64748b" fontSize={12} /><YAxis stroke="#64748b" fontSize={12} /><Tooltip contentStyle={{ background: '#13131f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} /><Bar dataKey="payouts" fill="#f59e0b" radius={[4, 4, 0, 0]} /></BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-[#13131f] border-white/[0.06]">
          <CardContent className="p-5">
            <h3 className="text-white font-semibold mb-3">Recent Deposits</h3>
            <div className="space-y-2">
              {deposits.slice(0, 5).map(d => (
                <div key={d.id} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center"><ArrowDownLeft className="w-4 h-4 text-emerald-400" /></div>
                    <div><p className="text-sm text-white">{d.customerName}</p><p className="text-xs text-slate-500">{d.date}</p></div>
                  </div>
                  <span className="text-sm font-medium text-emerald-400">+${d.amount}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#13131f] border-white/[0.06]">
          <CardContent className="p-5">
            <h3 className="text-white font-semibold mb-3">Recent Payouts</h3>
            <div className="space-y-2">
              {payouts.slice(0, 5).map(p => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center"><Send className="w-4 h-4 text-amber-400" /></div>
                    <div><p className="text-sm text-white">{p.supplierName}</p><p className="text-xs text-slate-500">{p.status}</p></div>
                  </div>
                  <span className="text-sm font-medium text-amber-400">-{p.amount} {p.currency}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#13131f] border-white/[0.06]">
          <CardContent className="p-5">
            <h3 className="text-white font-semibold mb-3">New Customers</h3>
            <div className="space-y-2">
              {customers.slice(0, 5).map(c => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center"><User className="w-4 h-4 text-blue-400" /></div>
                    <div><p className="text-sm text-white">{c.name}</p><p className="text-xs text-slate-500">{c.phone}</p></div>
                  </div>
                  <span className="text-xs text-slate-500">{c.createdAt}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="flex gap-3">
        {role !== 'Cashier China' && <Button onClick={() => setModule('deposits')} className="bg-cyan-600 hover:bg-cyan-700 text-white"><Plus className="w-4 h-4 mr-2" />New Deposit</Button>}
        <Button onClick={() => setModule('customers')} variant="outline" className="border-white/10 text-white hover:bg-white/5"><Search className="w-4 h-4 mr-2" />Search Customer</Button>
        {role !== 'Cashier China' && <Button onClick={() => setModule('payouts')} variant="outline" className="border-white/10 text-white hover:bg-white/5"><Send className="w-4 h-4 mr-2" />Initiate Payout</Button>}
      </div>
    </div>
  );

  const renderCustomers = () => (
    <div className="space-y-6">
      <Card className="bg-[#13131f] border-white/[0.06]">
        <CardContent className="p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Search className="w-5 h-5 text-blue-400" />Search Customer by Phone</h3>
          <div className="flex gap-3">
            <div className="flex-1 relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" /><Input placeholder="Enter phone number..." value={phoneSearch} onChange={e => setPhoneSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && handlePhoneSearch()} className="pl-10 bg-[#0a0a1a] border-white/[0.08] text-white placeholder:text-slate-600" /></div>
            <Button onClick={handlePhoneSearch} className="bg-blue-600 hover:bg-blue-700 text-white"><Search className="w-4 h-4 mr-2" />Search</Button>
          </div>
          {searchedCustomer && (
            <div className="mt-4 p-4 rounded-xl bg-[#0a0a1a] border border-white/[0.06]">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-500/15 flex items-center justify-center"><User className="w-6 h-6 text-blue-400" /></div>
                  <div>
                    <h4 className="text-lg font-semibold text-white">{searchedCustomer.name}</h4>
                    <p className="text-sm text-slate-400">{searchedCustomer.phone}</p>
                    {searchedCustomer.company && <p className="text-xs text-slate-500">{searchedCustomer.company}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-emerald-400">${searchedCustomer.balance.toLocaleString()}</p>
                  <p className="text-xs text-slate-500">Balance</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/[0.06]">
                <div><p className="text-xs text-slate-500">Deposits</p><p className="text-sm font-medium text-white">{searchedCustomer.depositCount}</p></div>
                <div><p className="text-xs text-slate-500">Last Deposit</p><p className="text-sm font-medium text-white">{searchedCustomer.lastDeposit}</p></div>
                <div><p className="text-xs text-slate-500">Member Since</p><p className="text-sm font-medium text-white">{searchedCustomer.createdAt}</p></div>
              </div>
              {searchedCustomer.email && <p className="text-xs text-slate-500 mt-2"><Mail className="w-3 h-3 inline mr-1" />{searchedCustomer.email}</p>}
              {searchedCustomer.notes && <p className="text-xs text-slate-500 mt-1">{searchedCustomer.notes}</p>}
              <div className="mt-3 flex gap-2">
                <Button onClick={() => openEditCustomer(searchedCustomer)} size="sm" variant="outline" className="border-white/10 text-white hover:bg-white/5"><Edit className="w-3 h-3 mr-1" />Edit</Button>
                {role === 'Admin' && <Button onClick={() => handleDeleteCustomer(searchedCustomer.id)} size="sm" variant="outline" className="border-red-500/20 text-red-400 hover:bg-red-500/10"><Trash2 className="w-3 h-3 mr-1" />Delete</Button>}
              </div>
              <div className="mt-4 pt-4 border-t border-white/[0.06]">
                <h5 className="text-sm font-medium text-white mb-2">Transaction History</h5>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {getCustomerTransactions(searchedCustomer.id).deposits.map(d => (
                    <div key={d.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-white/[0.02]">
                      <span className="text-xs text-slate-400">Deposit ({d.method})</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-emerald-400">+${d.amount}</span>
                        <button onClick={() => { setSelectedTransaction(d); setShowTransactionDialog(true); }} className="text-slate-500 hover:text-white"><Eye className="w-3 h-3" /></button>
                      </div>
                    </div>
                  ))}
                  {getCustomerTransactions(searchedCustomer.id).allocations.map(a => (
                    <div key={a.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-white/[0.02]">
                      <span className="text-xs text-slate-400">Allocation &rarr; {a.supplierName}</span>
                      <span className="text-xs font-medium text-violet-400">-${a.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {showNewCustomer && (
            <div className="mt-4 p-4 rounded-xl bg-[#0a0a1a] border border-amber-500/20">
              <div className="flex items-center gap-2 mb-4"><AlertTriangle className="w-5 h-5 text-amber-400" /><h4 className="text-white font-semibold">New Customer Registration</h4><Badge variant="outline" className="bg-amber-500/15 text-amber-400 border-amber-500/20">First Time</Badge></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><label className="text-xs text-slate-400 mb-1 block">Full Name *</label><Input placeholder="Enter full name" value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} className="bg-[#0a0a1a] border-white/[0.08] text-white placeholder:text-slate-600" /></div>
                <div><label className="text-xs text-slate-400 mb-1 block">Phone Number *</label><Input value={newCustomerPhone} readOnly className="bg-[#0a0a1a] border-white/[0.08] text-white opacity-60" /></div>
                <div><label className="text-xs text-slate-400 mb-1 block">Email</label><Input placeholder="email@example.com" value={newCustomerEmail} onChange={e => setNewCustomerEmail(e.target.value)} className="bg-[#0a0a1a] border-white/[0.08] text-white placeholder:text-slate-600" /></div>
                <div><label className="text-xs text-slate-400 mb-1 block">ID / Passport Number</label><Input placeholder="ID or Passport" value={newCustomerId} onChange={e => setNewCustomerId(e.target.value)} className="bg-[#0a0a1a] border-white/[0.08] text-white placeholder:text-slate-600" /></div>
                <div><label className="text-xs text-slate-400 mb-1 block">Company / Agent Name</label><Input placeholder="Company or agent" value={newCustomerCompany} onChange={e => setNewCustomerCompany(e.target.value)} className="bg-[#0a0a1a] border-white/[0.08] text-white placeholder:text-slate-600" /></div>
                <div><label className="text-xs text-slate-400 mb-1 block">Notes</label><Input placeholder="Additional notes" value={newCustomerNotes} onChange={e => setNewCustomerNotes(e.target.value)} className="bg-[#0a0a1a] border-white/[0.08] text-white placeholder:text-slate-600" /></div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button onClick={handleCreateCustomer} disabled={!newCustomerName.trim()} className="bg-emerald-600 hover:bg-emerald-700 text-white"><Check className="w-4 h-4 mr-2" />Save Customer</Button>
                <Button onClick={() => { setShowNewCustomer(false); setNewCustomerName(''); }} variant="outline" className="border-white/10 text-white hover:bg-white/5"><X className="w-4 h-4 mr-2" />Cancel</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <Card className="bg-[#13131f] border-white/[0.06]">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">All Customers</h3>
            <div className="relative w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" /><Input placeholder="Search customers..." value={customerFilter} onChange={e => setCustomerFilter(e.target.value)} className="pl-10 bg-[#0a0a1a] border-white/[0.08] text-white placeholder:text-slate-600" /></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-white/[0.06]"><th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Name</th><th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Phone</th><th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Company</th><th className="text-right py-3 px-4 text-xs font-medium text-slate-400">Balance</th><th className="text-center py-3 px-4 text-xs font-medium text-slate-400">Deposits</th><th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Last Deposit</th><th className="text-center py-3 px-4 text-xs font-medium text-slate-400">Actions</th></tr></thead>
              <tbody>
                {filteredCustomers.map(c => (
                  <tr key={c.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center"><User className="w-4 h-4 text-blue-400" /></div><span className="text-sm text-white font-medium">{c.name}</span></div></td>
                    <td className="py-3 px-4 text-sm text-slate-400">{c.phone}</td>
                    <td className="py-3 px-4 text-sm text-slate-400">{c.company || '-'}</td>
                    <td className="py-3 px-4 text-right text-sm font-medium text-emerald-400">${c.balance.toLocaleString()}</td>
                    <td className="py-3 px-4 text-center"><Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs">{c.depositCount}</Badge></td>
                    <td className="py-3 px-4 text-sm text-slate-500">{c.lastDeposit}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => { setPhoneSearch(c.phone); handlePhoneSearch(); }} className="p-1 rounded hover:bg-white/5 text-slate-500 hover:text-white"><Eye className="w-3.5 h-3.5" /></button>
                        <button onClick={() => openEditCustomer(c)} className="p-1 rounded hover:bg-white/5 text-slate-500 hover:text-white"><Edit className="w-3.5 h-3.5" /></button>
                        {role === 'Admin' && <button onClick={() => handleDeleteCustomer(c.id)} className="p-1 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-[#13131f] border-white/[0.06]">
          <DialogHeader><DialogTitle className="text-white flex items-center gap-2"><Edit className="w-5 h-5 text-blue-400" />Edit Customer</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-xs text-slate-400 mb-1 block">Full Name</label><Input value={editName} onChange={e => setEditName(e.target.value)} className="bg-[#0a0a1a] border-white/[0.08] text-white" /></div>
            <div><label className="text-xs text-slate-400 mb-1 block">Email</label><Input value={editEmail} onChange={e => setEditEmail(e.target.value)} className="bg-[#0a0a1a] border-white/[0.08] text-white" /></div>
            <div><label className="text-xs text-slate-400 mb-1 block">Company</label><Input value={editCompany} onChange={e => setEditCompany(e.target.value)} className="bg-[#0a0a1a] border-white/[0.08] text-white" /></div>
            <div><label className="text-xs text-slate-400 mb-1 block">Notes</label><Input value={editNotes} onChange={e => setEditNotes(e.target.value)} className="bg-[#0a0a1a] border-white/[0.08] text-white" /></div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSaveEditCustomer} className="bg-blue-600 hover:bg-blue-700 text-white"><Check className="w-4 h-4 mr-2" />Save</Button>
              <Button onClick={() => setShowEditDialog(false)} variant="outline" className="border-white/10 text-white hover:bg-white/5"><X className="w-4 h-4 mr-2" />Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  const renderDeposits = () => (
    <div className="space-y-6">
      {role !== 'Cashier China' && (
        <Card className="bg-[#13131f] border-white/[0.06]">
          <CardContent className="p-5">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Plus className="w-5 h-5 text-emerald-400" />New Deposit</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div><label className="text-xs text-slate-400 mb-1 block">Search Customer Phone</label><div className="flex gap-2"><Input placeholder="Enter phone..." value={depositPhone} onChange={e => setDepositPhone(e.target.value)} className="bg-[#0a0a1a] border-white/[0.08] text-white placeholder:text-slate-600" /><Button onClick={handleDepositSearch} size="sm" className="bg-blue-600 hover:bg-blue-700"><Search className="w-4 h-4" /></Button></div>{selectedDepositCustomer && <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />{selectedDepositCustomer.name}</p>}</div>
              <div><label className="text-xs text-slate-400 mb-1 block">Amount</label><Input type="number" placeholder="0.00" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} className="bg-[#0a0a1a] border-white/[0.08] text-white placeholder:text-slate-600" /></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Currency</label><Select value={depositCurrency} onValueChange={setDepositCurrency}><SelectTrigger className="bg-[#0a0a1a] border-white/[0.08] text-white"><SelectValue /></SelectTrigger><SelectContent className="bg-[#13131f] border-white/[0.08]"><SelectItem value="USD" className="text-white">USD</SelectItem><SelectItem value="TZS" className="text-white">TZS</SelectItem><SelectItem value="CNY" className="text-white">CNY</SelectItem></SelectContent></Select></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Payment Method</label><Select value={depositMethod} onValueChange={setDepositMethod}><SelectTrigger className="bg-[#0a0a1a] border-white/[0.08] text-white"><SelectValue /></SelectTrigger><SelectContent className="bg-[#13131f] border-white/[0.08]"><SelectItem value="Cash" className="text-white">Cash</SelectItem><SelectItem value="M-Pesa" className="text-white">M-Pesa</SelectItem><SelectItem value="Bank Transfer" className="text-white">Bank Transfer</SelectItem><SelectItem value="Agent" className="text-white">Agent</SelectItem><SelectItem value="WeChat Pay" className="text-white">WeChat Pay</SelectItem><SelectItem value="Alipay" className="text-white">Alipay</SelectItem></SelectContent></Select></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Reference Number</label><Input placeholder="Receipt from customer" value={depositRef} onChange={e => setDepositRef(e.target.value)} className="bg-[#0a0a1a] border-white/[0.08] text-white placeholder:text-slate-600" /></div>
              <div className="flex items-end"><Button onClick={handleDepositSubmit} disabled={!selectedDepositCustomer || !depositAmount} className="bg-emerald-600 hover:bg-emerald-700 text-white w-full"><Check className="w-4 h-4 mr-2" />Confirm Deposit</Button></div>
            </div>
          </CardContent>
        </Card>
      )}
      <Card className="bg-[#13131f] border-white/[0.06]">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Recent Deposits</h3>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <Select value={depositStatusFilter} onValueChange={setDepositStatusFilter}>
                <SelectTrigger className="w-36 bg-[#0a0a1a] border-white/[0.08] text-white text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#13131f] border-white/[0.08]">
                  <SelectItem value="All" className="text-white text-xs">All Status</SelectItem>
                  <SelectItem value="Confirmed" className="text-white text-xs">Confirmed</SelectItem>
                  <SelectItem value="Pending" className="text-white text-xs">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-white/[0.06]"><th className="text-left py-3 px-4 text-xs font-medium text-slate-400">ID</th><th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Customer</th><th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Phone</th><th className="text-right py-3 px-4 text-xs font-medium text-slate-400">Amount</th><th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Method</th><th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Reference</th><th className="text-center py-3 px-4 text-xs font-medium text-slate-400">Status</th><th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Date</th><th className="text-center py-3 px-4 text-xs font-medium text-slate-400">Actions</th></tr></thead>
              <tbody>
                {filteredDeposits.map(d => (
                  <tr key={d.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 text-sm text-slate-500">{d.id}</td>
                    <td className="py-3 px-4 text-sm text-white font-medium">{d.customerName}</td>
                    <td className="py-3 px-4 text-sm text-slate-400">{d.phone}</td>
                    <td className="py-3 px-4 text-right text-sm font-medium text-emerald-400">{d.amount} {d.currency}</td>
                    <td className="py-3 px-4"><div className="flex items-center gap-1.5"><MethodIcon method={d.method} /><Badge variant="outline" className="bg-white/[0.04] text-slate-300 border-white/[0.08] text-xs">{d.method}</Badge></div></td>
                    <td className="py-3 px-4 text-sm text-slate-500">{d.reference}</td>
                    <td className="py-3 px-4 text-center"><StatusBadge status={d.status} /></td>
                    <td className="py-3 px-4 text-sm text-slate-500">{d.date}</td>
                    <td className="py-3 px-4 text-center"><button onClick={() => { setSelectedTransaction(d); setShowTransactionDialog(true); }} className="p-1 rounded hover:bg-white/5 text-slate-500 hover:text-white"><Eye className="w-3.5 h-3.5" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <Dialog open={showTransactionDialog} onOpenChange={setShowTransactionDialog}>
        <DialogContent className="bg-[#13131f] border-white/[0.06]">
          <DialogHeader><DialogTitle className="text-white flex items-center gap-2"><Eye className="w-5 h-5 text-emerald-400" />Transaction Details</DialogTitle></DialogHeader>
          {selectedTransaction && (
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-[#0a0a1a] border border-white/[0.06] text-center">
                <div className="flex justify-center mb-3"><QrCode className="w-16 h-16 text-cyan-400" /></div>
                <p className="text-xs text-slate-500 font-mono">{selectedTransaction.reference}</p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between py-1.5 border-b border-white/[0.04]"><span className="text-xs text-slate-400">Customer</span><span className="text-sm text-white">{selectedTransaction.customerName}</span></div>
                <div className="flex justify-between py-1.5 border-b border-white/[0.04]"><span className="text-xs text-slate-400">Phone</span><span className="text-sm text-white">{selectedTransaction.phone}</span></div>
                <div className="flex justify-between py-1.5 border-b border-white/[0.04]"><span className="text-xs text-slate-400">Amount</span><span className="text-sm font-bold text-emerald-400">${selectedTransaction.amount} {selectedTransaction.currency}</span></div>
                <div className="flex justify-between py-1.5 border-b border-white/[0.04]"><span className="text-xs text-slate-400">Method</span><span className="text-sm text-white">{selectedTransaction.method}</span></div>
                <div className="flex justify-between py-1.5 border-b border-white/[0.04]"><span className="text-xs text-slate-400">Status</span><StatusBadge status={selectedTransaction.status} /></div>
                <div className="flex justify-between py-1.5"><span className="text-xs text-slate-400">Date</span><span className="text-sm text-white">{selectedTransaction.date}</span></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

  const renderPayouts = () => (
    <div className="space-y-6">
      {role !== 'Cashier China' && (
        <Card className="bg-[#13131f] border-white/[0.06]">
          <CardContent className="p-5">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Plus className="w-5 h-5 text-amber-400" />Initiate Payout</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div><label className="text-xs text-slate-400 mb-1 block">Select Supplier</label><Select value={payoutSupplier} onValueChange={setPayoutSupplier}><SelectTrigger className="bg-[#0a0a1a] border-white/[0.08] text-white"><SelectValue placeholder="Choose supplier" /></SelectTrigger><SelectContent className="bg-[#13131f] border-white/[0.08]">{suppliers.map(s => <SelectItem key={s.id} value={s.id} className="text-white">{s.name}</SelectItem>)}</SelectContent></Select></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Amount</label><Input type="number" placeholder="0.00" value={payoutAmount} onChange={e => setPayoutAmount(e.target.value)} className="bg-[#0a0a1a] border-white/[0.08] text-white placeholder:text-slate-600" /></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Currency</label><Select value={payoutCurrency} onValueChange={setPayoutCurrency}><SelectTrigger className="bg-[#0a0a1a] border-white/[0.08] text-white"><SelectValue /></SelectTrigger><SelectContent className="bg-[#13131f] border-white/[0.08]"><SelectItem value="CNY" className="text-white">CNY</SelectItem><SelectItem value="USD" className="text-white">USD</SelectItem><SelectItem value="TZS" className="text-white">TZS</SelectItem></SelectContent></Select></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Method</label><Select value={payoutMethod} onValueChange={setPayoutMethod}><SelectTrigger className="bg-[#0a0a1a] border-white/[0.08] text-white"><SelectValue /></SelectTrigger><SelectContent className="bg-[#13131f] border-white/[0.08]"><SelectItem value="Bank" className="text-white">Bank</SelectItem><SelectItem value="M-Pesa" className="text-white">M-Pesa</SelectItem><SelectItem value="WeChat" className="text-white">WeChat</SelectItem><SelectItem value="Alipay" className="text-white">Alipay</SelectItem></SelectContent></Select></div>
              <div className="lg:col-span-3"><label className="text-xs text-slate-400 mb-1 block">Notes</label><Input placeholder="Additional notes..." value={payoutNotes} onChange={e => setPayoutNotes(e.target.value)} className="bg-[#0a0a1a] border-white/[0.08] text-white placeholder:text-slate-600" /></div>
              <div className="flex items-end"><Button onClick={handlePayoutSubmit} disabled={!payoutSupplier || !payoutAmount} className="bg-amber-600 hover:bg-amber-700 text-white w-full"><Send className="w-4 h-4 mr-2" />Initiate</Button></div>
            </div>
          </CardContent>
        </Card>
      )}
      {role === 'Cashier China' && (
        <Card className="bg-[#13131f] border-white/[0.06]">
          <CardContent className="p-5">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><BadgeCheck className="w-5 h-5 text-violet-400" />Pending Confirmations</h3>
            <div className="space-y-3">
              {payouts.filter(p => p.status === 'SENT').length === 0 && <p className="text-sm text-slate-500">No pending payouts to confirm.</p>}
              {payouts.filter(p => p.status === 'SENT').map(p => (
                <div key={p.id} className="p-4 rounded-xl bg-[#0a0a1a] border border-white/[0.06] flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">{p.supplierName}</p>
                    <p className="text-xs text-slate-500">{p.method} | {p.date}</p>
                    <p className="text-xs text-slate-500">{p.notes}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-amber-400">{p.amount.toLocaleString()} {p.currency}</p>
                    <div className="flex gap-2 mt-2">
                      <Button onClick={() => handleConfirmPayout(p.id, 'CONFIRMED')} size="sm" className="bg-violet-600 hover:bg-violet-700 text-white"><Check className="w-3 h-3 mr-1" />Confirm</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <h3 className="text-white font-semibold mt-6 mb-4">Confirmed - Mark as Paid</h3>
            <div className="space-y-3">
              {payouts.filter(p => p.status === 'CONFIRMED').length === 0 && <p className="text-sm text-slate-500">No confirmed payouts.</p>}
              {payouts.filter(p => p.status === 'CONFIRMED').map(p => (
                <div key={p.id} className="p-4 rounded-xl bg-[#0a0a1a] border border-white/[0.06] flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">{p.supplierName}</p>
                    <p className="text-xs text-slate-500">{p.method} | Confirmed by: {p.confirmedBy}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-violet-400">{p.amount.toLocaleString()} {p.currency}</p>
                    <Button onClick={() => handleConfirmPayout(p.id, 'PAID')} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white mt-2"><Check className="w-3 h-3 mr-1" />Mark Paid</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      <Card className="bg-[#13131f] border-white/[0.06]">
        <CardContent className="p-5">
          <h3 className="text-white font-semibold mb-4">All Payouts</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-white/[0.06]"><th className="text-left py-3 px-4 text-xs font-medium text-slate-400">ID</th><th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Supplier</th><th className="text-right py-3 px-4 text-xs font-medium text-slate-400">Amount</th><th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Method</th><th className="text-center py-3 px-4 text-xs font-medium text-slate-400">Status</th><th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Initiated</th><th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Confirmed</th><th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Date</th></tr></thead>
              <tbody>
                {payouts.map(p => (
                  <tr key={p.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 text-sm text-slate-500">{p.id}</td>
                    <td className="py-3 px-4 text-sm text-white font-medium">{p.supplierName}</td>
                    <td className="py-3 px-4 text-right text-sm font-medium text-amber-400">{p.amount.toLocaleString()} {p.currency}</td>
                    <td className="py-3 px-4"><div className="flex items-center gap-1.5"><MethodIcon method={p.method} /><Badge variant="outline" className="bg-white/[0.04] text-slate-300 border-white/[0.08] text-xs">{p.method}</Badge></div></td>
                    <td className="py-3 px-4 text-center"><StatusBadge status={p.status} /></td>
                    <td className="py-3 px-4 text-sm text-slate-500">{p.initiatedBy}</td>
                    <td className="py-3 px-4 text-sm text-slate-500">{p.confirmedBy || '-'}</td>
                    <td className="py-3 px-4 text-sm text-slate-500">{p.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderSuppliers = () => (
    <div className="space-y-6">
      <Card className="bg-[#13131f] border-white/[0.06]">
        <CardContent className="p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Building2 className="w-5 h-5 text-violet-400" />Suppliers</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {suppliers.map(s => (
              <div key={s.id} className="p-4 rounded-xl bg-[#0a0a1a] border border-white/[0.06] hover:border-violet-500/20 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center"><Building2 className="w-5 h-5 text-violet-400" /></div>
                  <StatusBadge status={s.status} />
                </div>
                <h4 className="text-white font-semibold">{s.name}</h4>
                <p className="text-xs text-slate-500">{s.country} | {s.contact}</p>
                <p className="text-xs text-slate-600">{s.phone}</p>
                <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between">
                  <div><p className="text-xs text-slate-500">Balance</p><p className="text-sm font-medium text-white">${s.balance.toLocaleString()}</p></div>
                  <div className="text-right"><p className="text-xs text-slate-500">Orders</p><p className="text-sm font-medium text-white">{s.orders}</p></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card className="bg-[#13131f] border-white/[0.06]">
        <CardContent className="p-5">
          <h3 className="text-white font-semibold mb-4">Supplier Directory</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-white/[0.06]"><th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Name</th><th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Country</th><th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Contact</th><th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Phone</th><th className="text-right py-3 px-4 text-xs font-medium text-slate-400">Balance</th><th className="text-center py-3 px-4 text-xs font-medium text-slate-400">Orders</th><th className="text-center py-3 px-4 text-xs font-medium text-slate-400">Status</th></tr></thead>
              <tbody>
                {suppliers.map(s => (
                  <tr key={s.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 text-sm text-white font-medium">{s.name}</td>
                    <td className="py-3 px-4 text-sm text-slate-400">{s.country}</td>
                    <td className="py-3 px-4 text-sm text-slate-400">{s.contact}</td>
                    <td className="py-3 px-4 text-sm text-slate-500">{s.phone}</td>
                    <td className="py-3 px-4 text-right text-sm font-medium text-emerald-400">${s.balance.toLocaleString()}</td>
                    <td className="py-3 px-4 text-center"><Badge variant="outline" className="bg-violet-500/10 text-violet-400 border-violet-500/20 text-xs">{s.orders}</Badge></td>
                    <td className="py-3 px-4 text-center"><StatusBadge status={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderAllocations = () => (
    <div className="space-y-6">
      {role !== 'Cashier China' && (
        <Card className="bg-[#13131f] border-white/[0.06]">
          <CardContent className="p-5">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Plus className="w-5 h-5 text-pink-400" />Allocate Funds</h3>
            <div className="mb-3 p-3 rounded-lg bg-[#0a0a1a] border border-white/[0.06]"><p className="text-xs text-slate-400">Available for Allocation: <span className="text-emerald-400 font-semibold">${unassigned.toLocaleString()}</span></p></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div><label className="text-xs text-slate-400 mb-1 block">Customer</label><Select value={allocCustomer} onValueChange={setAllocCustomer}><SelectTrigger className="bg-[#0a0a1a] border-white/[0.08] text-white"><SelectValue placeholder="Select customer" /></SelectTrigger><SelectContent className="bg-[#13131f] border-white/[0.08]">{customers.map(c => <SelectItem key={c.id} value={c.id} className="text-white">{c.name}</SelectItem>)}</SelectContent></Select></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Supplier</label><Select value={allocSupplier} onValueChange={setAllocSupplier}><SelectTrigger className="bg-[#0a0a1a] border-white/[0.08] text-white"><SelectValue placeholder="Select supplier" /></SelectTrigger><SelectContent className="bg-[#13131f] border-white/[0.08]">{suppliers.filter(s => s.status === 'Active').map(s => <SelectItem key={s.id} value={s.id} className="text-white">{s.name}</SelectItem>)}</SelectContent></Select></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Amount</label><Input type="number" placeholder="0.00" value={allocAmount} onChange={e => setAllocAmount(e.target.value)} className="bg-[#0a0a1a] border-white/[0.08] text-white placeholder:text-slate-600" /></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Order Reference</label><Input placeholder="Order number" value={allocOrderRef} onChange={e => setAllocOrderRef(e.target.value)} className="bg-[#0a0a1a] border-white/[0.08] text-white placeholder:text-slate-600" /></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Type</label><Select value={allocType} onValueChange={setAllocType}><SelectTrigger className="bg-[#0a0a1a] border-white/[0.08] text-white"><SelectValue /></SelectTrigger><SelectContent className="bg-[#13131f] border-white/[0.08]"><SelectItem value="Deposit" className="text-white">Deposit</SelectItem><SelectItem value="Full" className="text-white">Full Payment</SelectItem></SelectContent></Select></div>
              <div className="flex items-end"><Button onClick={handleAllocationSubmit} disabled={!allocCustomer || !allocSupplier || !allocAmount || parseFloat(allocAmount) > unassigned} className="bg-pink-600 hover:bg-pink-700 text-white w-full"><Check className="w-4 h-4 mr-2" />Allocate</Button></div>
            </div>
          </CardContent>
        </Card>
      )}
      <Card className="bg-[#13131f] border-white/[0.06]">
        <CardContent className="p-5">
          <h3 className="text-white font-semibold mb-4">Allocation History</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-white/[0.06]"><th className="text-left py-3 px-4 text-xs font-medium text-slate-400">ID</th><th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Customer</th><th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Supplier</th><th className="text-right py-3 px-4 text-xs font-medium text-slate-400">Amount</th><th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Order Ref</th><th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Type</th><th className="text-left py-3 px-4 text-xs font-medium text-slate-400">Date</th></tr></thead>
              <tbody>
                {allocations.map(a => (
                  <tr key={a.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 text-sm text-slate-500">{a.id}</td>
                    <td className="py-3 px-4 text-sm text-white font-medium">{a.customerName}</td>
                    <td className="py-3 px-4 text-sm text-violet-400">{a.supplierName}</td>
                    <td className="py-3 px-4 text-right text-sm font-medium text-pink-400">${a.amount.toLocaleString()}</td>
                    <td className="py-3 px-4 text-sm text-slate-500">{a.orderRef}</td>
                    <td className="py-3 px-4"><Badge variant="outline" className="bg-pink-500/10 text-pink-400 border-pink-500/20 text-xs">{a.type}</Badge></td>
                    <td className="py-3 px-4 text-sm text-slate-500">{a.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderReceipts = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {MOCK_RECEIPTS.map(r => (
          <Card key={r.id} className="bg-[#13131f] border-white/[0.06] cursor-pointer hover:border-orange-500/30 transition-colors" onClick={() => { setSelectedReceipt(r); setShowReceiptDialog(true); }}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center"><Receipt className="w-5 h-5 text-orange-400" /></div>
                <StatusBadge status={r.status} />
              </div>
              <h4 className="text-white font-semibold">{r.transactionId}</h4>
              <p className="text-xs text-slate-500">{r.customerName} &rarr; {r.supplierName}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-lg font-bold text-emerald-400">${r.amount.toLocaleString()}</span>
                <span className="text-xs text-slate-500">{r.date}</span>
              </div>
              <div className="mt-2 flex gap-2">
                <Badge variant="outline" className="bg-white/[0.04] text-slate-300 border-white/[0.08] text-xs">{r.type}</Badge>
                <Badge variant="outline" className="bg-white/[0.04] text-slate-300 border-white/[0.08] text-xs">{r.currency}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
        <DialogContent className="bg-[#13131f] border-white/[0.06] max-w-md">
          <DialogHeader><DialogTitle className="text-white flex items-center gap-2"><Receipt className="w-5 h-5 text-orange-400" />Transaction Receipt</DialogTitle></DialogHeader>
          {selectedReceipt && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#0a0a1a] border border-white/[0.06] text-center">
                <h3 className="text-xl font-bold text-white">{businessName}</h3>
                <p className="text-xs text-slate-500">{businessPhone} | {businessEmail}</p>
                <p className="text-xs text-slate-600">{businessAddress}</p>
                <div className="my-4 flex justify-center"><QRCodeSVG value={selectedReceipt.transactionId} size={120} bgColor="#0a0a1a" fgColor="#06b6d4" /></div>
                <p className="text-xs text-slate-500 font-mono">{selectedReceipt.transactionId}</p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between py-1.5 border-b border-white/[0.04]"><span className="text-xs text-slate-400">Customer</span><span className="text-sm text-white">{selectedReceipt.customerName}</span></div>
                <div className="flex justify-between py-1.5 border-b border-white/[0.04]"><span className="text-xs text-slate-400">Supplier</span><span className="text-sm text-white">{selectedReceipt.supplierName}</span></div>
                <div className="flex justify-between py-1.5 border-b border-white/[0.04]"><span className="text-xs text-slate-400">Amount</span><span className="text-sm font-bold text-emerald-400">${selectedReceipt.amount.toLocaleString()} {selectedReceipt.currency}</span></div>
                <div className="flex justify-between py-1.5 border-b border-white/[0.04]"><span className="text-xs text-slate-400">Type</span><span className="text-sm text-white">{selectedReceipt.type}</span></div>
                <div className="flex justify-between py-1.5 border-b border-white/[0.04]"><span className="text-xs text-slate-400">Status</span><StatusBadge status={selectedReceipt.status} /></div>
                <div className="flex justify-between py-1.5 border-b border-white/[0.04]"><span className="text-xs text-slate-400">Reference</span><span className="text-sm text-white">{selectedReceipt.reference}</span></div>
                <div className="flex justify-between py-1.5"><span className="text-xs text-slate-400">Date</span><span className="text-sm text-white">{selectedReceipt.date}</span></div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 border-white/10 text-white hover:bg-white/5"><Download className="w-4 h-4 mr-2" />Download</Button>
                <Button variant="outline" className="flex-1 border-white/10 text-white hover:bg-white/5"><Printer className="w-4 h-4 mr-2" />Print</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6">
      <Card className="bg-[#13131f] border-white/[0.06]">
        <CardContent className="p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Settings className="w-5 h-5 text-slate-400" />Business Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="text-xs text-slate-400 mb-1 block">Business Name</label><Input value={businessName} onChange={e => setBusinessName(e.target.value)} className="bg-[#0a0a1a] border-white/[0.08] text-white" /></div>
            <div><label className="text-xs text-slate-400 mb-1 block">Phone</label><Input value={businessPhone} onChange={e => setBusinessPhone(e.target.value)} className="bg-[#0a0a1a] border-white/[0.08] text-white" /></div>
            <div><label className="text-xs text-slate-400 mb-1 block">Email</label><Input value={businessEmail} onChange={e => setBusinessEmail(e.target.value)} className="bg-[#0a0a1a] border-white/[0.08] text-white" /></div>
            <div><label className="text-xs text-slate-400 mb-1 block">Address</label><Input value={businessAddress} onChange={e => setBusinessAddress(e.target.value)} className="bg-[#0a0a1a] border-white/[0.08] text-white" /></div>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-[#13131f] border-white/[0.06]">
        <CardContent className="p-5">
          <h3 className="text-white font-semibold mb-4">Currency Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><label className="text-xs text-slate-400 mb-1 block">Default Currency</label><Select value={defaultCurrency} onValueChange={setDefaultCurrency}><SelectTrigger className="bg-[#0a0a1a] border-white/[0.08] text-white"><SelectValue /></SelectTrigger><SelectContent className="bg-[#13131f] border-white/[0.08]"><SelectItem value="USD" className="text-white">USD - US Dollar</SelectItem><SelectItem value="TZS" className="text-white">TZS - Tanzanian Shilling</SelectItem><SelectItem value="CNY" className="text-white">CNY - Chinese Yuan</SelectItem></SelectContent></Select></div>
            <div><label className="text-xs text-slate-400 mb-1 block">Receipt Prefix</label><Input value={receiptPrefix} onChange={e => setReceiptPrefix(e.target.value)} className="bg-[#0a0a1a] border-white/[0.08] text-white" /></div>
            <div><label className="text-xs text-slate-400 mb-1 block">Tax Rate (%)</label><Input type="number" value={taxRate} onChange={e => setTaxRate(e.target.value)} className="bg-[#0a0a1a] border-white/[0.08] text-white" /></div>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-[#13131f] border-white/[0.06]">
        <CardContent className="p-5">
          <h3 className="text-white font-semibold mb-4">Payment Methods</h3>
          <div className="space-y-2">
            {[{ name: 'Cash', icon: Banknote, enabled: true }, { name: 'M-Pesa', icon: Smartphone, enabled: true }, { name: 'Bank Transfer', icon: Landmark, enabled: true }, { name: 'Agent', icon: User, enabled: true }, { name: 'WeChat Pay', icon: CreditCard, enabled: true }, { name: 'Alipay', icon: CreditCard, enabled: false }].map(method => (
              <div key={method.name} className="flex items-center justify-between p-3 rounded-lg bg-[#0a0a1a] border border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <method.icon className="w-5 h-5 text-slate-400" />
                  <span className="text-sm text-white">{method.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {method.enabled ? <><BadgeCheck className="w-4 h-4 text-emerald-400" /><span className="text-xs text-emerald-400">Active</span></> : <><XCircle className="w-4 h-4 text-slate-500" /><span className="text-xs text-slate-500">Inactive</span></>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card className="bg-[#13131f] border-white/[0.06]">
        <CardContent className="p-5">
          <h3 className="text-white font-semibold mb-4">Receipt Template</h3>
          <div className="p-4 rounded-xl bg-[#0a0a1a] border border-white/[0.06]">
            <div className="text-center">
              <h4 className="text-lg font-bold text-white">{businessName}</h4>
              <p className="text-xs text-slate-500">{businessPhone} | {businessEmail}</p>
              <p className="text-xs text-slate-600">{businessAddress}</p>
              <div className="my-4 flex justify-center"><QRCodeSVG value="SAMPLE-RECEIPT-001" size={100} bgColor="#0a0a1a" fgColor="#06b6d4" /></div>
              <p className="text-xs text-slate-600">Receipt includes: Transaction ID, Customer, Supplier, Amount, Date, QR Code</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderModule = () => {
    switch (module) {
      case 'dashboard': return renderDashboard();
      case 'customers': return renderCustomers();
      case 'deposits': return renderDeposits();
      case 'payouts': return renderPayouts();
      case 'suppliers': return renderSuppliers();
      case 'allocations': return renderAllocations();
      case 'receipts': return renderReceipts();
      case 'settings': return renderSettings();
      default: return renderDashboard();
    }
  };

  const getModuleTitle = () => {
    const titles: Record<Module, string> = { dashboard: 'Dashboard', customers: 'Customers', deposits: 'Deposits', payouts: 'Payouts', suppliers: 'Suppliers', allocations: 'Allocations', receipts: 'Receipts', settings: 'Settings' };
    return titles[module] || 'Dashboard';
  };

  return (
    <div className="flex h-screen bg-[#0a0a1a] text-white overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-[#0d0d1f] border-r border-white/[0.06] flex flex-col">
        <div className="p-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">KOBE PAY</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Trade Finance</p>
            </div>
          </div>
        </div>
        <div className="flex-1 p-3 space-y-1 overflow-y-auto">
          {SIDEBAR_ITEMS.map(item => {
            const Icon = item.icon;
            const accessible = canAccess(item.id);
            return (
              <button
                key={item.id}
                onClick={() => accessible && setModule(item.id)}
                disabled={!accessible}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  module === item.id ? 'bg-white/[0.06] text-white' : 'text-slate-400 hover:text-white hover:bg-white/[0.02]'
                } ${!accessible ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <Icon className={`w-5 h-5 ${module === item.id ? item.color : ''}`} />
                <span>{item.label}</span>
                {module === item.id && <ChevronRight className="w-4 h-4 ml-auto text-slate-500" />}
              </button>
            );
          })}
        </div>
        <div className="p-4 border-t border-white/[0.06]">
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Current Role</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-sm font-medium text-white">{role}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-16 border-b border-white/[0.06] flex items-center justify-between px-6 bg-[#0a0a1a]/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-white">{getModuleTitle()}</h2>
            {role === 'Cashier TZ' && module === 'customers' && <Badge variant="outline" className="bg-blue-500/15 text-blue-400 border-blue-500/20">Phone Search Active</Badge>}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">Role:</span>
            <div className="flex rounded-lg bg-white/[0.03] border border-white/[0.06] overflow-hidden">
              {(['Admin', 'Cashier TZ', 'Cashier China'] as Role[]).map(r => (
                <button
                  key={r}
                  onClick={() => { setRole(r); if (!canAccess(module)) setModule('dashboard'); }}
                  className={`px-4 py-1.5 text-xs font-medium transition-all ${role === r ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderModule()}
        </div>
      </div>
    </div>
  );
}
