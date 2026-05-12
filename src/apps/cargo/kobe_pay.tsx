import { useState, useMemo } from 'react';
import {
  Wallet, Plus, Download, Share2, Printer, CheckCircle2, Clock,
  XCircle, Copy, Check, DollarSign, Building2, User, Phone,
  Globe, Receipt, History as HistoryIcon,
  Send, Trash2, Edit, Eye, ChevronRight,
  BadgeCheck, AlertTriangle, ShoppingCart, Package, ArrowUpRight,
  ArrowDownLeft, RotateCcw, Mail
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QRCodeSVG } from 'qrcode.react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Supplier {
  id: string;
  name: string;
  country: string;
  flag: string;
  contact: string;
  email: string;
  balance: number;
  reserved: number;
  orders: number;
  status: 'active' | 'inactive';
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  balance: number;
  deposits: number;
  status: 'active' | 'inactive';
}

interface Transaction {
  id: string;
  type: 'deposit' | 'allocate' | 'cancel' | 'order';
  description: string;
  customerId?: string;
  customerName?: string;
  supplierId?: string;
  supplierName?: string;
  orderRef?: string;
  amount: number;
  currency: string;
  method: string;
  paymentType?: 'deposit' | 'full';
  status: 'pending' | 'confirmed' | 'rejected';
  confirmedBy?: string;
  txRef: string;
  date: string;
  balanceAfter: number;
}

interface Allocation {
  id: string;
  supplierId: string;
  supplierName: string;
  orderRef: string;
  orderAmount: number;
  amount: number;
  paymentType: 'deposit' | 'full';
  status: 'active' | 'cancelled' | 'completed';
  date: string;
  remaining: number;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const INITIAL_SUPPLIERS: Supplier[] = [
  { id: 'SUP-001', name: 'Shua Logistics', country: 'China', flag: '\uD83C\uDDE8\uD83C\uDDF3', contact: '+86 138-0000-0001', email: 'info@shualogistics.cn', balance: 8000, reserved: 3200, orders: 12, status: 'active' },
  { id: 'SUP-002', name: 'Yiwu Market', country: 'China', flag: '\uD83C\uDDE8\uD83C\uDDF3', contact: '+86 138-0000-0002', email: 'orders@yiwumarket.cn', balance: 3500, reserved: 1500, orders: 5, status: 'active' },
  { id: 'SUP-003', name: 'Guangzhou Ltd', country: 'China', flag: '\uD83C\uDDE8\uD83C\uDDF3', contact: '+86 138-0000-0003', email: 'trade@guangzhoultd.cn', balance: 5000, reserved: 2000, orders: 8, status: 'active' },
  { id: 'SUP-004', name: 'Dar Port', country: 'Tanzania', flag: '\uD83C\uDDF9\uD83C\uDDFF', contact: '+255 713-000-001', email: 'cargo@darport.co.tz', balance: 2000, reserved: 800, orders: 15, status: 'active' },
  { id: 'SUP-005', name: 'Arusha Hub', country: 'Tanzania', flag: '\uD83C\uDDF9\uD83C\uDDFF', contact: '+255 713-000-002', email: 'hub@arushacargo.co.tz', balance: 1500, reserved: 500, orders: 7, status: 'active' },
  { id: 'SUP-006', name: 'Mwanza Cargo', country: 'Tanzania', flag: '\uD83C\uDDF9\uD83C\uDDFF', contact: '+255 713-000-003', email: 'info@mwanzacargo.co.tz', balance: 0, reserved: 0, orders: 0, status: 'inactive' },
  { id: 'SUP-007', name: 'Nairobi Express', country: 'Kenya', flag: '\uD83C\uDDF0\uD83C\uDDEA', contact: '+254 700-000-001', email: 'ship@nairobiexpress.co.ke', balance: 0, reserved: 0, orders: 0, status: 'inactive' },
  { id: 'SUP-008', name: 'Dubai Freight', country: 'UAE', flag: '\uD83C\uDDE6\uD83C\uDDEA', contact: '+971 50-000-0001', email: 'cargo@dubaifreight.ae', balance: 0, reserved: 0, orders: 0, status: 'inactive' },
];

const INITIAL_CUSTOMERS: Customer[] = [
  { id: 'CUST-001', name: 'Stephene Sosteri', phone: '+255 713 456 789', email: 'stephene@kobecargo.com', balance: 15000, deposits: 8, status: 'active' },
  { id: 'CUST-002', name: 'Amina Hassan', phone: '+255 714 123 456', email: 'amina.hassan@email.com', balance: 8200, deposits: 5, status: 'active' },
  { id: 'CUST-003', name: 'Rajab Mwinyi', phone: '+255 715 789 012', email: 'rajab.m@email.com', balance: 5400, deposits: 3, status: 'active' },
  { id: 'CUST-004', name: 'Fatima Said', phone: '+255 716 345 678', email: 'fatima.said@email.com', balance: 11200, deposits: 6, status: 'active' },
  { id: 'CUST-005', name: 'Peter Omondi', phone: '+255 717 901 234', email: 'peter.o@email.com', balance: 3500, deposits: 2, status: 'active' },
  { id: 'CUST-006', name: 'Grace Wanjiru', phone: '+255 718 567 890', email: 'grace.w@email.com', balance: 7800, deposits: 4, status: 'active' },
  { id: 'CUST-007', name: 'John Mwakasege', phone: '+255 719 123 456', email: 'john.m@email.com', balance: 2000, deposits: 1, status: 'active' },
  { id: 'CUST-008', name: 'Mariam Juma', phone: '+255 710 789 012', email: 'mariam.j@email.com', balance: 0, deposits: 0, status: 'inactive' },
];

const INITIAL_TRANSACTIONS: Transaction[] = [
  { id: 'TX-001', type: 'deposit', description: 'Cash via Agent John', customerId: 'CUST-001', customerName: 'Stephene Sosteri', amount: 2000, currency: 'USD', method: 'Cash', txRef: 'KBE-TX-2025-001847', date: '12 May 2026, 09:15', balanceAfter: 25000, status: 'confirmed', confirmedBy: 'Agent John Doe' },
  { id: 'TX-002', type: 'allocate', description: '\u2192 Shua Logistics', supplierId: 'SUP-001', supplierName: 'Shua Logistics', orderRef: 'ORD-2025-042', amount: 800, currency: 'USD', method: 'Wallet', paymentType: 'deposit', txRef: 'KBE-TX-2025-001846', date: '12 May 2026, 14:32', balanceAfter: 23000, status: 'confirmed', confirmedBy: 'Agent John Doe' },
  { id: 'TX-003', type: 'order', description: 'Order ORD-2025-041 deducted', supplierId: 'SUP-001', supplierName: 'Shua Logistics', orderRef: 'ORD-2025-041', amount: 1500, currency: 'USD', method: 'Wallet', txRef: 'KBE-TX-2025-001845', date: '11 May 2026, 16:45', balanceAfter: 23800, status: 'confirmed', confirmedBy: 'System' },
  { id: 'TX-004', type: 'deposit', description: 'M-Pesa payment', amount: 5000, currency: 'USD', method: 'M-Pesa', txRef: 'KBE-TX-2025-001844', date: '10 May 2026, 11:20', balanceAfter: 25300, status: 'confirmed', confirmedBy: 'Agent Mary' },
  { id: 'TX-005', type: 'cancel', description: 'Returned from Yiwu Market', supplierId: 'SUP-002', supplierName: 'Yiwu Market', orderRef: 'ORD-2025-038', amount: 500, currency: 'USD', method: 'Refund', txRef: 'KBE-TX-2025-001843', date: '10 May 2026, 10:05', balanceAfter: 20300, status: 'confirmed', confirmedBy: 'Agent John Doe' },
  { id: 'TX-006', type: 'allocate', description: '\u2192 Guangzhou Ltd', supplierId: 'SUP-003', supplierName: 'Guangzhou Ltd', orderRef: 'ORD-2025-040', amount: 2000, currency: 'USD', method: 'Wallet', paymentType: 'full', txRef: 'KBE-TX-2025-001842', date: '9 May 2026, 13:50', balanceAfter: 19800, status: 'confirmed', confirmedBy: 'Agent John Doe' },
  { id: 'TX-007', type: 'deposit', description: 'Bank transfer - CRDB', amount: 3500, currency: 'USD', method: 'Bank', txRef: 'KBE-TX-2025-001841', date: '9 May 2026, 08:30', balanceAfter: 21800, status: 'confirmed', confirmedBy: 'Bank System' },
  { id: 'TX-008', type: 'allocate', description: '\u2192 Dar Port', supplierId: 'SUP-004', supplierName: 'Dar Port', orderRef: 'ORD-2025-039', amount: 600, currency: 'USD', method: 'Wallet', paymentType: 'deposit', txRef: 'KBE-TX-2025-001840', date: '8 May 2026, 15:10', balanceAfter: 18300, status: 'confirmed', confirmedBy: 'Agent Mary' },
  { id: 'TX-009', type: 'order', description: 'Order ORD-2025-037 deducted', supplierId: 'SUP-004', supplierName: 'Dar Port', orderRef: 'ORD-2025-037', amount: 900, currency: 'USD', method: 'Wallet', txRef: 'KBE-TX-2025-001839', date: '7 May 2026, 12:00', balanceAfter: 18900, status: 'confirmed', confirmedBy: 'System' },
  { id: 'TX-010', type: 'deposit', description: 'Agent collection - DSM', amount: 1500, currency: 'USD', method: 'Agent', txRef: 'KBE-TX-2025-001838', date: '7 May 2026, 09:45', balanceAfter: 19800, status: 'confirmed', confirmedBy: 'Agent Peter' },
  { id: 'TX-011', type: 'allocate', description: '\u2192 Arusha Hub', supplierId: 'SUP-005', supplierName: 'Arusha Hub', orderRef: 'ORD-2025-036', amount: 750, currency: 'USD', method: 'Wallet', paymentType: 'deposit', txRef: 'KBE-TX-2025-001837', date: '6 May 2026, 14:20', balanceAfter: 18300, status: 'confirmed', confirmedBy: 'Agent John Doe' },
  { id: 'TX-012', type: 'cancel', description: 'Returned from Guangzhou', supplierId: 'SUP-003', supplierName: 'Guangzhou Ltd', orderRef: 'ORD-2025-034', amount: 1200, currency: 'USD', method: 'Refund', txRef: 'KBE-TX-2025-001836', date: '5 May 2026, 11:30', balanceAfter: 19050, status: 'confirmed', confirmedBy: 'Agent Mary' },
  { id: 'TX-013', type: 'deposit', description: 'Cash deposit HQ', amount: 3000, currency: 'USD', method: 'Cash', txRef: 'KBE-TX-2025-001835', date: '5 May 2026, 08:00', balanceAfter: 17850, status: 'confirmed', confirmedBy: 'Agent John Doe' },
  { id: 'TX-014', type: 'allocate', description: '\u2192 Shua Logistics', supplierId: 'SUP-001', supplierName: 'Shua Logistics', orderRef: 'ORD-2025-035', amount: 1500, currency: 'USD', method: 'Wallet', paymentType: 'full', txRef: 'KBE-TX-2025-001834', date: '4 May 2026, 16:00', balanceAfter: 14850, status: 'confirmed', confirmedBy: 'Agent John Doe' },
  { id: 'TX-015', type: 'order', description: 'Order ORD-2025-033 deducted', supplierId: 'SUP-002', supplierName: 'Yiwu Market', orderRef: 'ORD-2025-033', amount: 650, currency: 'USD', method: 'Wallet', txRef: 'KBE-TX-2025-001833', date: '4 May 2026, 10:45', balanceAfter: 16350, status: 'confirmed', confirmedBy: 'System' },
  { id: 'TX-016', type: 'deposit', description: 'M-Pesa - agent network', amount: 2500, currency: 'USD', method: 'M-Pesa', txRef: 'KBE-TX-2025-001832', date: '3 May 2026, 13:15', balanceAfter: 17000, status: 'confirmed', confirmedBy: 'Agent Peter' },
  { id: 'TX-017', type: 'allocate', description: '\u2192 Yiwu Market', supplierId: 'SUP-002', supplierName: 'Yiwu Market', orderRef: 'ORD-2025-032', amount: 1000, currency: 'USD', method: 'Wallet', paymentType: 'deposit', txRef: 'KBE-TX-2025-001831', date: '3 May 2026, 09:30', balanceAfter: 14500, status: 'confirmed', confirmedBy: 'Agent Mary' },
  { id: 'TX-018', type: 'cancel', description: 'Partial return - Dar Port', supplierId: 'SUP-004', supplierName: 'Dar Port', orderRef: 'ORD-2025-030', amount: 300, currency: 'USD', method: 'Refund', txRef: 'KBE-TX-2025-001830', date: '2 May 2026, 15:45', balanceAfter: 15500, status: 'confirmed', confirmedBy: 'Agent John Doe' },
  { id: 'TX-019', type: 'deposit', description: 'NBC Bank wire', amount: 4500, currency: 'USD', method: 'Bank', txRef: 'KBE-TX-2025-001829', date: '2 May 2026, 08:20', balanceAfter: 15200, status: 'confirmed', confirmedBy: 'Bank System' },
  { id: 'TX-020', type: 'allocate', description: '\u2192 Shua Logistics', supplierId: 'SUP-001', supplierName: 'Shua Logistics', orderRef: 'ORD-2025-031', amount: 2200, currency: 'USD', method: 'Wallet', paymentType: 'deposit', txRef: 'KBE-TX-2025-001828', date: '1 May 2026, 14:10', balanceAfter: 10700, status: 'confirmed', confirmedBy: 'Agent John Doe' },
  { id: 'TX-021', type: 'order', description: 'Order ORD-2025-029 fulfilled', supplierId: 'SUP-003', supplierName: 'Guangzhou Ltd', orderRef: 'ORD-2025-029', amount: 1800, currency: 'USD', method: 'Wallet', txRef: 'KBE-TX-2025-001827', date: '30 Apr 2026, 12:30', balanceAfter: 12900, status: 'confirmed', confirmedBy: 'System' },
  { id: 'TX-022', type: 'deposit', description: 'Cash via branch office', amount: 1800, currency: 'USD', method: 'Cash', txRef: 'KBE-TX-2025-001826', date: '30 Apr 2026, 09:00', balanceAfter: 14700, status: 'confirmed', confirmedBy: 'Agent Peter' },
  { id: 'TX-023', type: 'allocate', description: '\u2192 Dar Port', supplierId: 'SUP-004', supplierName: 'Dar Port', orderRef: 'ORD-2025-028', amount: 500, currency: 'USD', method: 'Wallet', paymentType: 'full', txRef: 'KBE-TX-2025-001825', date: '29 Apr 2026, 16:30', balanceAfter: 12900, status: 'confirmed', confirmedBy: 'Agent Mary' },
  { id: 'TX-024', type: 'cancel', description: 'Order cancellation refund', supplierId: 'SUP-001', supplierName: 'Shua Logistics', orderRef: 'ORD-2025-027', amount: 800, currency: 'USD', method: 'Refund', txRef: 'KBE-TX-2025-001824', date: '29 Apr 2026, 10:15', balanceAfter: 13400, status: 'confirmed', confirmedBy: 'Agent John Doe' },
  { id: 'TX-025', type: 'deposit', description: 'Opening balance', amount: 12500, currency: 'USD', method: 'Bank', txRef: 'KBE-TX-2025-001823', date: '28 Apr 2026, 08:00', balanceAfter: 12500, status: 'confirmed', confirmedBy: 'System' },
];

const INITIAL_ALLOCATIONS: Allocation[] = [
  { id: 'AL-001', supplierId: 'SUP-001', supplierName: 'Shua Logistics', orderRef: 'ORD-2025-042', orderAmount: 2000, amount: 800, paymentType: 'deposit', status: 'active', date: '12 May 2026', remaining: 1200 },
  { id: 'AL-002', supplierId: 'SUP-003', supplierName: 'Guangzhou Ltd', orderRef: 'ORD-2025-040', orderAmount: 2000, amount: 2000, paymentType: 'full', status: 'completed', date: '9 May 2026', remaining: 0 },
  { id: 'AL-003', supplierId: 'SUP-004', supplierName: 'Dar Port', orderRef: 'ORD-2025-039', orderAmount: 1500, amount: 600, paymentType: 'deposit', status: 'active', date: '8 May 2026', remaining: 900 },
  { id: 'AL-004', supplierId: 'SUP-005', supplierName: 'Arusha Hub', orderRef: 'ORD-2025-036', orderAmount: 1500, amount: 750, paymentType: 'deposit', status: 'active', date: '6 May 2026', remaining: 750 },
  { id: 'AL-005', supplierId: 'SUP-001', supplierName: 'Shua Logistics', orderRef: 'ORD-2025-035', orderAmount: 1500, amount: 1500, paymentType: 'full', status: 'completed', date: '4 May 2026', remaining: 0 },
  { id: 'AL-006', supplierId: 'SUP-002', supplierName: 'Yiwu Market', orderRef: 'ORD-2025-032', orderAmount: 2500, amount: 1000, paymentType: 'deposit', status: 'active', date: '3 May 2026', remaining: 1500 },
  { id: 'AL-007', supplierId: 'SUP-001', supplierName: 'Shua Logistics', orderRef: 'ORD-2025-031', orderAmount: 3500, amount: 2200, paymentType: 'deposit', status: 'active', date: '1 May 2026', remaining: 1300 },
  { id: 'AL-008', supplierId: 'SUP-004', supplierName: 'Dar Port', orderRef: 'ORD-2025-028', orderAmount: 500, amount: 500, paymentType: 'full', status: 'completed', date: '29 Apr 2026', remaining: 0 },
  { id: 'AL-009', supplierId: 'SUP-003', supplierName: 'Guangzhou Ltd', orderRef: 'ORD-2025-026', orderAmount: 3200, amount: 3200, paymentType: 'full', status: 'completed', date: '27 Apr 2026', remaining: 0 },
  { id: 'AL-010', supplierId: 'SUP-002', supplierName: 'Yiwu Market', orderRef: 'ORD-2025-025', orderAmount: 1800, amount: 900, paymentType: 'deposit', status: 'cancelled', date: '25 Apr 2026', remaining: 900 },
  { id: 'AL-011', supplierId: 'SUP-005', supplierName: 'Arusha Hub', orderRef: 'ORD-2025-024', orderAmount: 1000, amount: 1000, paymentType: 'full', status: 'completed', date: '23 Apr 2026', remaining: 0 },
  { id: 'AL-012', supplierId: 'SUP-001', supplierName: 'Shua Logistics', orderRef: 'ORD-2025-023', orderAmount: 4500, amount: 4500, paymentType: 'full', status: 'completed', date: '20 Apr 2026', remaining: 0 },
  { id: 'AL-013', supplierId: 'SUP-004', supplierName: 'Dar Port', orderRef: 'ORD-2025-022', orderAmount: 800, amount: 400, paymentType: 'deposit', status: 'active', date: '18 Apr 2026', remaining: 400 },
  { id: 'AL-014', supplierId: 'SUP-003', supplierName: 'Guangzhou Ltd', orderRef: 'ORD-2025-021', orderAmount: 2800, amount: 1400, paymentType: 'deposit', status: 'cancelled', date: '15 Apr 2026', remaining: 1400 },
  { id: 'AL-015', supplierId: 'SUP-002', supplierName: 'Yiwu Market', orderRef: 'ORD-2025-020', orderAmount: 1200, amount: 1200, paymentType: 'full', status: 'completed', date: '10 Apr 2026', remaining: 0 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cn = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

const txIcon = (type: string) => {
  switch (type) {
    case 'deposit': return <ArrowDownLeft className="w-4 h-4 text-emerald-400" />;
    case 'allocate': return <ArrowUpRight className="w-4 h-4 text-blue-400" />;
    case 'cancel': return <RotateCcw className="w-4 h-4 text-amber-400" />;
    case 'order': return <ShoppingCart className="w-4 h-4 text-violet-400" />;
    default: return <DollarSign className="w-4 h-4" />;
  }
};

const txColor = (type: string) => {
  switch (type) {
    case 'deposit': return 'text-emerald-400';
    case 'allocate': return 'text-blue-400';
    case 'cancel': return 'text-amber-400';
    case 'order': return 'text-violet-400';
    default: return 'text-slate-400';
  }
};

const statusBadge = (status: string) => {
  switch (status) {
    case 'confirmed': case 'completed': case 'active': return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Confirmed</Badge>;
    case 'pending': return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Pending</Badge>;
    case 'cancelled': return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Cancelled</Badge>;
    case 'rejected': return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Rejected</Badge>;
    case 'inactive': return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">Inactive</Badge>;
    default: return <Badge variant="secondary">{status}</Badge>;
  }
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function KobePay() {
  const [suppliers, setSuppliers] = useState<Supplier[]>(INITIAL_SUPPLIERS);
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [allocations, setAllocations] = useState<Allocation[]>(INITIAL_ALLOCATIONS);
  const [customers, setCustomers] = useState<Customer[]>(INITIAL_CUSTOMERS);

  const [activeTab, setActiveTab] = useState('wallet');
  const [depositOpen, setDepositOpen] = useState(false);
  const [addSupplierOpen, setAddSupplierOpen] = useState(false);
  const [allocateOpen, setAllocateOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [supplierDetailOpen, setSupplierDetailOpen] = useState(false);

  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  const [historyFilter, setHistoryFilter] = useState('all');
  const [receiptFilter, setReceiptFilter] = useState('all');
  const [copiedLink, setCopiedLink] = useState(false);

  // Deposit form
  const [depAmount, setDepAmount] = useState('');
  const [depCurrency, setDepCurrency] = useState('USD');
  const [depMethod, setDepMethod] = useState('Cash');
  const [depNotes, setDepNotes] = useState('');
  const [depCustomerId, setDepCustomerId] = useState('CUST-001');

  // Add customer form
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);

  // Add supplier form
  const [newSupName, setNewSupName] = useState('');
  const [newSupCountry, setNewSupCountry] = useState('');
  const [newSupContact, setNewSupContact] = useState('');
  const [newSupEmail, setNewSupEmail] = useState('');

  // Allocate form
  const [allocSupplier, setAllocSupplier] = useState('');
  const [allocOrderRef, setAllocOrderRef] = useState('');
  const [allocOrderAmount, setAllocOrderAmount] = useState('');
  const [allocPaymentType, setAllocPaymentType] = useState<'deposit' | 'full'>('deposit');
  const [allocAmount, setAllocAmount] = useState('');

  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast({ message: '', visible: false }), 3000);
  };

  // Derived values
  const totalBalance = 25000;
  const allocated = suppliers.reduce((s, sup) => s + sup.balance, 0);
  const unassigned = totalBalance - allocated;

  const filteredHistory = useMemo(() => {
    let txs = [...transactions];
    if (historyFilter !== 'all') txs = txs.filter(t => t.type === historyFilter);
    return txs;
  }, [transactions, historyFilter]);

  const filteredReceipts = useMemo(() => {
    let recs = [...allocations];
    if (receiptFilter === 'deposit') recs = recs.filter(r => r.paymentType === 'deposit');
    if (receiptFilter === 'full') recs = recs.filter(r => r.paymentType === 'full');
    if (receiptFilter === 'pending') recs = recs.filter(r => r.status === 'active');
    if (receiptFilter === 'confirmed') recs = recs.filter(r => r.status === 'completed');
    return recs;
  }, [allocations, receiptFilter]);

  const recentTx = transactions.slice(0, 10);

  // ─── Actions ────────────────────────────────────────────────────────────────
  const handleDeposit = () => {
    const amt = parseFloat(depAmount);
    if (!amt || amt <= 0) return;
    const cust = customers.find(c => c.id === depCustomerId);
    const newTx: Transaction = {
      id: `TX-${String(transactions.length + 1).padStart(3, '0')}`,
      type: 'deposit',
      description: depNotes || `${depMethod} deposit${cust ? ' — ' + cust.name : ''}`,
      customerId: depCustomerId,
      customerName: cust?.name || 'Unknown',
      amount: amt,
      currency: depCurrency,
      method: depMethod,
      txRef: `KBE-TX-2025-${String(1850 + transactions.length).padStart(6, '0')}`,
      date: '12 May 2026, ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      balanceAfter: totalBalance + amt,
      status: 'confirmed',
      confirmedBy: 'Agent John Doe',
    };
    setTransactions([newTx, ...transactions]);
    setCustomers(prev => prev.map(c => c.id === depCustomerId ? { ...c, balance: c.balance + amt, deposits: c.deposits + 1 } : c));
    setDepositOpen(false);
    setDepAmount(''); setDepNotes('');
    showToast(`Deposit of $${fmt(amt)} confirmed for ${cust?.name || 'customer'}`);
  };

  const handleAddSupplier = () => {
    if (!newSupName.trim()) return;
    const newSup: Supplier = {
      id: `SUP-${String(suppliers.length + 1).padStart(3, '0')}`,
      name: newSupName,
      country: newSupCountry || 'Other',
      flag: '\uD83C\uDF10',
      contact: newSupContact,
      email: newSupEmail,
      balance: 0,
      reserved: 0,
      orders: 0,
      status: 'active',
    };
    setSuppliers([...suppliers, newSup]);
    setAddSupplierOpen(false);
    setNewSupName(''); setNewSupCountry(''); setNewSupContact(''); setNewSupEmail('');
    showToast(`Supplier "${newSupName}" added successfully`);
  };

  const handleAllocate = () => {
    const amt = parseFloat(allocAmount);
    const orderAmt = parseFloat(allocOrderAmount);
    if (!amt || !allocSupplier || !allocOrderRef || !orderAmt) return;
    if (amt > unassigned) { showToast('Insufficient unassigned balance'); return; }

    const sup = suppliers.find(s => s.id === allocSupplier);
    if (!sup) return;

    const newAlloc: Allocation = {
      id: `AL-${String(allocations.length + 1).padStart(3, '0')}`,
      supplierId: sup.id,
      supplierName: sup.name,
      orderRef: allocOrderRef,
      orderAmount: orderAmt,
      amount: amt,
      paymentType: allocPaymentType,
      status: 'active',
      date: '12 May 2026',
      remaining: orderAmt - amt,
    };
    setAllocations([newAlloc, ...allocations]);

    const newTx: Transaction = {
      id: `TX-${String(transactions.length + 1).padStart(3, '0')}`,
      type: 'allocate',
      description: `\u2192 ${sup.name}`,
      supplierId: sup.id,
      supplierName: sup.name,
      orderRef: allocOrderRef,
      amount: amt,
      currency: 'USD',
      method: 'Wallet',
      paymentType: allocPaymentType,
      txRef: `KBE-TX-2025-${String(1850 + transactions.length).padStart(6, '0')}`,
      date: '12 May 2026, ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      balanceAfter: totalBalance - amt,
      status: 'confirmed',
      confirmedBy: 'Agent John Doe',
    };
    setTransactions([newTx, ...transactions]);

    setSuppliers(suppliers.map(s => s.id === sup.id ? { ...s, balance: s.balance + amt, reserved: s.reserved + amt } : s));

    setAllocateOpen(false);
    setAllocSupplier(''); setAllocOrderRef(''); setAllocOrderAmount(''); setAllocAmount(''); setAllocPaymentType('deposit');
    showToast(`Allocated $${fmt(amt)} to ${sup.name}`);
  };

  const handleCancelAllocation = (alloc: Allocation) => {
    setAllocations(allocations.map(a => a.id === alloc.id ? { ...a, status: 'cancelled' as const } : a));
    setSuppliers(suppliers.map(s => s.id === alloc.supplierId ? { ...s, balance: s.balance - alloc.amount, reserved: s.reserved - alloc.amount } : s));
    const newTx: Transaction = {
      id: `TX-${String(transactions.length + 1).padStart(3, '0')}`,
      type: 'cancel',
      description: `Returned from ${alloc.supplierName}`,
      supplierId: alloc.supplierId,
      supplierName: alloc.supplierName,
      orderRef: alloc.orderRef,
      amount: alloc.amount,
      currency: 'USD',
      method: 'Refund',
      txRef: `KBE-TX-2025-${String(1850 + transactions.length).padStart(6, '0')}`,
      date: '12 May 2026, ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      balanceAfter: totalBalance + alloc.amount,
      status: 'confirmed',
      confirmedBy: 'Agent John Doe',
    };
    setTransactions([newTx, ...transactions]);
    showToast(`Allocation cancelled. $${fmt(alloc.amount)} returned to wallet`);
  };

  const openReceipt = (tx: Transaction) => {
    setSelectedTx(tx);
    setReceiptOpen(true);
  };

  const openAllocReceipt = (alloc: Allocation) => {
    const tx = transactions.find(t => t.orderRef === alloc.orderRef && t.type === 'allocate');
    if (tx) {
      setSelectedTx(tx);
      setReceiptOpen(true);
    } else {
      showToast('Receipt not found');
    }
  };

  const viewSupplier = (sup: Supplier) => {
    setSelectedSupplier(sup);
    setSupplierDetailOpen(true);
  };

  const copyLink = (txRef: string) => {
    navigator.clipboard?.writeText(`https://kobe.app/tx/${txRef.replace('KBE-TX-', '')}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    showToast('Link copied to clipboard');
  };

  // Validation for allocation
  const allocOrderAmtNum = parseFloat(allocOrderAmount) || 0;
  const allocAmtNum = parseFloat(allocAmount) || 0;
  const remainingForOrder = allocOrderAmtNum - allocAmtNum;
  const isFullPayment = allocPaymentType === 'full';
  const showFullPaymentWarning = isFullPayment && allocAmtNum > 0 && allocAmtNum !== allocOrderAmtNum;
  const canAllocate = allocSupplier && allocOrderRef && allocOrderAmtNum > 0 && allocAmtNum > 0 && allocAmtNum <= unassigned && (!isFullPayment || allocAmtNum === allocOrderAmtNum);

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white">
      {/* Toast */}
      {toast.visible && (
        <div className="fixed top-4 right-4 z-[70] bg-emerald-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <CheckCircle2 className="w-4 h-4" />
          {toast.message}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a0a1a]/80 backdrop-blur-md border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">KOBE Pay</h1>
              <p className="text-xs text-slate-400">Trade Finance Wallet</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-slate-400">Customer</p>
              <p className="text-sm font-medium">Stephene Sosteri</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <User className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="sticky top-[57px] z-40 bg-[#0a0a1a]/80 backdrop-blur-md border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-transparent h-12 gap-1">
              <TabsTrigger value="wallet" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 data-[state=active]:border-emerald-500/30 text-xs px-3 py-1.5 rounded-lg border border-transparent">
                <Wallet className="w-3.5 h-3.5 mr-1.5" />Wallet
              </TabsTrigger>
              <TabsTrigger value="suppliers" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400 data-[state=active]:border-blue-500/30 text-xs px-3 py-1.5 rounded-lg border border-transparent">
                <Building2 className="w-3.5 h-3.5 mr-1.5" />Suppliers
              </TabsTrigger>
              <TabsTrigger value="allocate" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 data-[state=active]:border-amber-500/30 text-xs px-3 py-1.5 rounded-lg border border-transparent">
                <Send className="w-3.5 h-3.5 mr-1.5" />Allocate
              </TabsTrigger>
              <TabsTrigger value="receipts" className="data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-400 data-[state=active]:border-violet-500/30 text-xs px-3 py-1.5 rounded-lg border border-transparent">
                <Receipt className="w-3.5 h-3.5 mr-1.5" />Receipts
              </TabsTrigger>
              <TabsTrigger value="history" className="data-[state=active]:bg-slate-500/20 data-[state=active]:text-slate-300 data-[state=active]:border-slate-500/30 text-xs px-3 py-1.5 rounded-lg border border-transparent">
                <HistoryIcon className="w-3.5 h-3.5 mr-1.5" />History
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* ─── TAB: WALLET ─────────────────────────────────────────────────────── */}
      {activeTab === 'wallet' && (
        <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
          {/* Customer Selector + Add */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-[10px] text-white/30 uppercase tracking-wider mb-1 block">Customer</label>
              <Select value={depCustomerId} onValueChange={setDepCustomerId}>
                <SelectTrigger className="bg-white/[0.05] border-white/[0.1] text-white h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a2e] border-white/[0.1]">
                  {customers.filter(c => c.status === 'active').map(c => (
                    <SelectItem key={c.id} value={c.id} className="text-white text-xs">
                      <div className="flex items-center gap-2">
                        <User className="w-3 h-3 text-blue-400" />
                        <span>{c.name}</span>
                        <span className="text-white/30">{c.phone}</span>
                        <span className="text-emerald-400 ml-1">${fmt(c.balance)}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" className="border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 h-9 mt-4" onClick={() => setAddCustomerOpen(true)}>
              <Plus className="w-3 h-3 mr-1" /> New
            </Button>
          </div>

          {/* Customer Info Card */}
          {(() => {
            const cust = customers.find(c => c.id === depCustomerId);
            if (!cust) return null;
            return (
              <Card className="bg-[#13131f] border-blue-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-500/15 flex items-center justify-center">
                      <span className="text-lg font-bold text-blue-400">{cust.name.charAt(0)}</span>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-white">{cust.name}</div>
                      <div className="flex items-center gap-3 text-[11px] text-white/40">
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {cust.phone}</span>
                        {cust.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {cust.email}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-white/30">Balance</div>
                      <div className="text-lg font-bold text-emerald-400">${fmt(cust.balance)}</div>
                      <div className="text-[10px] text-white/20">{cust.deposits} deposits</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Hero Balance Card */}
          <Card className="bg-[#13131f] border-white/[0.06] overflow-hidden relative">
            <div className="absolute inset-0 bg-emerald-500/[0.03]" />
            <CardContent className="p-6 relative">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-emerald-400" />
                    <span className="text-sm text-emerald-400 font-medium">Total Wallet Balance</span>
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-4xl font-bold">${fmt(totalBalance)}</span>
                    <span className="text-lg text-slate-400">TZS {(totalBalance * 2500).toLocaleString()}</span>
                  </div>
                  <div className="flex gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-amber-400" />
                      <span className="text-slate-400">Unassigned:</span>
                      <span className="text-amber-400 font-semibold">${fmt(unassigned)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-400" />
                      <span className="text-slate-400">Allocated:</span>
                      <span className="text-blue-400 font-semibold">${fmt(allocated)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button onClick={() => setDepositOpen(true)} className="bg-emerald-500 hover:bg-emerald-600 text-white">
                    <Plus className="w-4 h-4 mr-1.5" /> Deposit
                  </Button>
                  <Button onClick={() => setAddSupplierOpen(true)} variant="outline" className="border-white/[0.1] bg-white/[0.05] hover:bg-white/[0.1] text-white">
                    <Plus className="w-4 h-4 mr-1.5" /> Add Supplier
                  </Button>
                  <Button onClick={() => setAllocateOpen(true)} variant="outline" className="border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400">
                    <Send className="w-4 h-4 mr-1.5" /> Allocate
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Supplier Cards - Horizontal */}
          <div>
            <h2 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4" /> Supplier Balances
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {suppliers.map(sup => (
                <Card key={sup.id} className="bg-[#13131f] border-white/[0.06] min-w-[240px] flex-shrink-0 cursor-pointer hover:border-white/[0.12] transition-colors"
                  onClick={() => viewSupplier(sup)}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{sup.flag}</span>
                        <span className="font-medium text-sm">{sup.name}</span>
                      </div>
                      <BadgeCheck className={cn('w-4 h-4', sup.status === 'active' ? 'text-emerald-400' : 'text-slate-600')} />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>Available: ${fmt(sup.balance - sup.reserved)}</span>
                        <span>Reserved: ${fmt(sup.reserved)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${sup.balance > 0 ? ((sup.balance - sup.reserved) / sup.balance) * 100 : 0}%` }} />
                      </div>
                      <div className="h-2 rounded-full bg-slate-800 overflow-hidden -mt-1">
                        <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${sup.balance > 0 ? (sup.reserved / (sup.balance + 1)) * 100 : 0}%` }} />
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="w-full h-7 text-xs border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400"
                      onClick={(e) => { e.stopPropagation(); setAllocSupplier(sup.id); setAllocateOpen(true); }}>
                      <Send className="w-3 h-3 mr-1" /> Allocate
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Recent Transactions */}
          <Card className="bg-[#13131f] border-white/[0.06]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-400 flex items-center gap-2">
                  <HistoryIcon className="w-4 h-4" /> Recent Transactions
                </h2>
                <Button variant="ghost" size="sm" className="text-xs text-slate-400 hover:text-white" onClick={() => setActiveTab('history')}>
                  View All <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
              <div className="space-y-2">
                {recentTx.map(tx => (
                  <div key={tx.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] cursor-pointer transition-colors"
                    onClick={() => openReceipt(tx)}>
                    <div className="w-9 h-9 rounded-lg bg-white/[0.05] flex items-center justify-center flex-shrink-0">
                      {txIcon(tx.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{tx.description}</p>
                      <p className="text-xs text-slate-400">{tx.date} &bull; {tx.txRef}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={cn('text-sm font-semibold', tx.type === 'deposit' || tx.type === 'cancel' ? 'text-emerald-400' : 'text-blue-400')}>
                        {tx.type === 'deposit' || tx.type === 'cancel' ? '+' : '-'}${fmt(tx.amount)}
                      </p>
                      {statusBadge(tx.status)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── TAB: SUPPLIERS ──────────────────────────────────────────────────── */}
      {activeTab === 'suppliers' && (
        <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-400" /> Suppliers
            </h2>
            <Button onClick={() => setAddSupplierOpen(true)} className="bg-blue-500 hover:bg-blue-600 text-white">
              <Plus className="w-4 h-4 mr-1.5" /> Add Supplier
            </Button>
          </div>

          <Card className="bg-[#13131f] border-white/[0.06] overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-slate-400 text-left">
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Country</th>
                      <th className="px-4 py-3 font-medium">Contact</th>
                      <th className="px-4 py-3 font-medium text-right">Balance</th>
                      <th className="px-4 py-3 font-medium text-right">Reserved</th>
                      <th className="px-4 py-3 font-medium text-right">Available</th>
                      <th className="px-4 py-3 font-medium text-center">Orders</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.map(sup => (
                      <tr key={sup.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] cursor-pointer transition-colors"
                        onClick={() => viewSupplier(sup)}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{sup.flag}</span>
                            <span className="font-medium">{sup.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-400">{sup.country}</td>
                        <td className="px-4 py-3 text-slate-400">{sup.contact}</td>
                        <td className="px-4 py-3 text-right font-medium">${fmt(sup.balance)}</td>
                        <td className="px-4 py-3 text-right text-amber-400">${fmt(sup.reserved)}</td>
                        <td className="px-4 py-3 text-right text-emerald-400">${fmt(sup.balance - sup.reserved)}</td>
                        <td className="px-4 py-3 text-center">{sup.orders}</td>
                        <td className="px-4 py-3">{statusBadge(sup.status)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:text-blue-400"
                              onClick={(e) => { e.stopPropagation(); viewSupplier(sup); }}>
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:text-amber-400">
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:text-red-400">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── TAB: ALLOCATE ───────────────────────────────────────────────────── */}
      {activeTab === 'allocate' && (
        <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Allocation Form */}
            <Card className="bg-[#13131f] border-white/[0.06]">
              <CardContent className="p-5 space-y-4">
                <h2 className="text-base font-bold flex items-center gap-2">
                  <Send className="w-5 h-5 text-amber-400" /> New Allocation
                </h2>

                {/* From Wallet */}
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <p className="text-xs text-amber-400 mb-1">From Wallet (Unassigned)</p>
                  <p className="text-xl font-bold text-amber-400">${fmt(unassigned)}</p>
                </div>

                {/* Select Supplier */}
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400">Select Supplier</label>
                  <Select value={allocSupplier} onValueChange={setAllocSupplier}>
                    <SelectTrigger className="bg-white/[0.05] border-white/[0.1] text-white">
                      <SelectValue placeholder="Choose supplier..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a2e] border-white/[0.1]">
                      {suppliers.filter(s => s.status === 'active').map(s => (
                        <SelectItem key={s.id} value={s.id} className="text-white hover:bg-white/[0.05] focus:bg-white/[0.05]">
                          {s.flag} {s.name} — Balance: ${fmt(s.balance)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Order Reference */}
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400">Order Reference</label>
                  <Input value={allocOrderRef} onChange={e => setAllocOrderRef(e.target.value)}
                    placeholder="e.g., ORD-2025-042" className="bg-white/[0.05] border-white/[0.1] text-white" />
                </div>

                {/* Order Amount */}
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400">Order Amount ($)</label>
                  <Input type="number" value={allocOrderAmount} onChange={e => setAllocOrderAmount(e.target.value)}
                    placeholder="Total order cost e.g., 2000" className="bg-white/[0.05] border-white/[0.1] text-white" />
                </div>

                {/* Payment Type */}
                <div className="space-y-2">
                  <label className="text-xs text-slate-400">Payment Type</label>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 p-3 rounded-lg border border-white/[0.1] bg-white/[0.02] cursor-pointer hover:bg-white/[0.04] flex-1"
                      onClick={() => setAllocPaymentType('deposit')}>
                      <div className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center', allocPaymentType === 'deposit' ? 'border-amber-400' : 'border-slate-600')}>
                        {allocPaymentType === 'deposit' && <div className="w-2 h-2 rounded-full bg-amber-400" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium">Deposit</p>
                        <p className="text-xs text-slate-400">Partial payment</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-2 p-3 rounded-lg border border-white/[0.1] bg-white/[0.02] cursor-pointer hover:bg-white/[0.04] flex-1"
                      onClick={() => setAllocPaymentType('full')}>
                      <div className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center', allocPaymentType === 'full' ? 'border-emerald-400' : 'border-slate-600')}>
                        {allocPaymentType === 'full' && <div className="w-2 h-2 rounded-full bg-emerald-400" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium">Full Payment</p>
                        <p className="text-xs text-slate-400">Pay entire order</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Amount */}
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400">Allocation Amount ($)</label>
                  <Input type="number" value={allocAmount} onChange={e => setAllocAmount(e.target.value)}
                    placeholder={isFullPayment && allocOrderAmount ? `Auto: $${fmt(allocOrderAmtNum)}` : 'Enter amount'}
                    className="bg-white/[0.05] border-white/[0.1] text-white" />
                  {allocAmtNum > unassigned && (
                    <p className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Amount exceeds unassigned balance</p>
                  )}
                </div>

                {/* Smart Validation Preview */}
                {allocAmtNum > 0 && allocOrderAmtNum > 0 && (
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 space-y-1">
                    <p className="text-xs text-blue-400 font-medium">Payment Preview</p>
                    <p className="text-sm text-slate-300">
                      Paying <span className="text-white font-semibold">${fmt(allocAmtNum)}</span> of{' '}
                      <span className="text-white font-semibold">${fmt(allocOrderAmtNum)}</span> remaining
                    </p>
                    <p className="text-xs text-slate-400">
                      New unassigned balance: <span className="text-amber-400">${fmt(Math.max(0, unassigned - allocAmtNum))}</span>
                    </p>
                    {remainingForOrder > 0 && (
                      <p className="text-xs text-slate-400">
                        Order remaining after payment: <span className="text-violet-400">${fmt(remainingForOrder)}</span>
                      </p>
                    )}
                    {showFullPaymentWarning && (
                      <p className="text-xs text-amber-400 flex items-center gap-1 mt-1">
                        <AlertTriangle className="w-3 h-3" />
                        Not full payment. <button className="underline hover:text-amber-300" onClick={() => setAllocPaymentType('deposit')}>Switch to Deposit?</button>
                      </p>
                    )}
                  </div>
                )}

                <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold" onClick={handleAllocate} disabled={!canAllocate}>
                  <Send className="w-4 h-4 mr-1.5" /> Confirm Allocation
                </Button>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <div className="space-y-4">
              <Card className="bg-[#13131f] border-white/[0.06]">
                <CardContent className="p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-slate-400">Allocation Summary</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <p className="text-xs text-emerald-400">Total Allocated</p>
                      <p className="text-lg font-bold text-emerald-400">${fmt(allocated)}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <p className="text-xs text-amber-400">Available to Allocate</p>
                      <p className="text-lg font-bold text-amber-400">${fmt(unassigned)}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <p className="text-xs text-blue-400">Active Allocations</p>
                      <p className="text-lg font-bold text-blue-400">{allocations.filter(a => a.status === 'active').length}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
                      <p className="text-xs text-violet-400">Completed</p>
                      <p className="text-lg font-bold text-violet-400">{allocations.filter(a => a.status === 'completed').length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Top Suppliers */}
              <Card className="bg-[#13131f] border-white/[0.06]">
                <CardContent className="p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-400">Top Suppliers by Balance</h3>
                  {suppliers.filter(s => s.balance > 0).sort((a, b) => b.balance - a.balance).map(sup => (
                    <div key={sup.id} className="flex items-center gap-3">
                      <span className="text-base">{sup.flag}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm">
                          <span>{sup.name}</span>
                          <span className="text-slate-400">${fmt(sup.balance)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-800 mt-1">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, (sup.balance / 8000) * 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Allocation History */}
          <Card className="bg-[#13131f] border-white/[0.06]">
            <CardContent className="p-4">
              <h2 className="text-base font-bold mb-4 flex items-center gap-2">
                <HistoryIcon className="w-4 h-4 text-amber-400" /> Allocation History
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-slate-400 text-left">
                      <th className="px-3 py-2.5 font-medium">Date</th>
                      <th className="px-3 py-2.5 font-medium">Supplier</th>
                      <th className="px-3 py-2.5 font-medium">Order #</th>
                      <th className="px-3 py-2.5 font-medium">Type</th>
                      <th className="px-3 py-2.5 font-medium text-right">Amount</th>
                      <th className="px-3 py-2.5 font-medium text-right">Order Total</th>
                      <th className="px-3 py-2.5 font-medium">Remaining</th>
                      <th className="px-3 py-2.5 font-medium">Status</th>
                      <th className="px-3 py-2.5 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocations.map(alloc => (
                      <tr key={alloc.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                        <td className="px-3 py-2.5 text-slate-400">{alloc.date}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span>{suppliers.find(s => s.id === alloc.supplierId)?.flag}</span>
                            <span>{alloc.supplierName}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs">{alloc.orderRef}</td>
                        <td className="px-3 py-2.5">
                          <Badge className={alloc.paymentType === 'full' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}>
                            {alloc.paymentType === 'full' ? 'Full' : 'Deposit'}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold">${fmt(alloc.amount)}</td>
                        <td className="px-3 py-2.5 text-right text-slate-400">${fmt(alloc.orderAmount)}</td>
                        <td className="px-3 py-2.5 text-slate-400">${fmt(alloc.remaining)}</td>
                        <td className="px-3 py-2.5">{statusBadge(alloc.status)}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:text-violet-400"
                              onClick={() => openAllocReceipt(alloc)}>
                              <Receipt className="w-3.5 h-3.5" />
                            </Button>
                            {alloc.status === 'active' && (
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:text-red-400"
                                onClick={() => handleCancelAllocation(alloc)}>
                                <XCircle className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── TAB: RECEIPTS ───────────────────────────────────────────────────── */}
      {activeTab === 'receipts' && (
        <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Receipt className="w-5 h-5 text-violet-400" /> Payment Receipts
            </h2>
            <div className="flex gap-2">
              {['all', 'deposit', 'full', 'pending', 'confirmed'].map(f => (
                <Button key={f} size="sm" variant={receiptFilter === f ? 'default' : 'outline'}
                  className={receiptFilter === f ? 'bg-violet-500 hover:bg-violet-600 text-white text-xs' : 'border-white/[0.1] bg-white/[0.05] hover:bg-white/[0.1] text-white text-xs'}
                  onClick={() => setReceiptFilter(f)}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredReceipts.map(alloc => {
              const tx = transactions.find(t => t.orderRef === alloc.orderRef && t.type === 'allocate');
              return (
                <Card key={alloc.id} className="bg-[#13131f] border-white/[0.06] hover:border-white/[0.12] cursor-pointer transition-all"
                  onClick={() => tx && openReceipt(tx)}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{tx?.txRef || 'N/A'}</p>
                          <p className="text-xs text-slate-400">{alloc.date}</p>
                        </div>
                      </div>
                      <Badge className={alloc.paymentType === 'full' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}>
                        {alloc.paymentType === 'full' ? 'Full' : 'Deposit'}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Supplier</span>
                        <span className="font-medium">{alloc.supplierName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Order</span>
                        <span className="font-mono text-xs">{alloc.orderRef}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Amount Paid</span>
                        <span className="font-bold text-emerald-400">${fmt(alloc.amount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Order Total</span>
                        <span>${fmt(alloc.orderAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Remaining</span>
                        <span className={alloc.remaining === 0 ? 'text-emerald-400' : 'text-amber-400'}>${fmt(alloc.remaining)}</span>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-white/[0.06] flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1 h-8 text-xs border-white/[0.1] bg-white/[0.05] hover:bg-white/[0.1] text-white"
                        onClick={(e) => { e.stopPropagation(); showToast('PDF download started'); }}>
                        <Download className="w-3 h-3 mr-1" /> PDF
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 h-8 text-xs border-white/[0.1] bg-white/[0.05] hover:bg-white/[0.1] text-white"
                        onClick={(e) => { e.stopPropagation(); copyLink(tx?.txRef || ''); }}>
                        {copiedLink ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />} Link
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── TAB: HISTORY ────────────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <HistoryIcon className="w-5 h-5 text-slate-400" /> Transaction History
            </h2>
            <div className="flex gap-2">
              {['all', 'deposit', 'allocate', 'cancel', 'order'].map(f => (
                <Button key={f} size="sm" variant={historyFilter === f ? 'default' : 'outline'}
                  className={historyFilter === f ? 'bg-slate-500 hover:bg-slate-600 text-white text-xs' : 'border-white/[0.1] bg-white/[0.05] hover:bg-white/[0.1] text-white text-xs'}
                  onClick={() => setHistoryFilter(f)}>
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1) + 's'}
                </Button>
              ))}
            </div>
          </div>

          <Card className="bg-[#13131f] border-white/[0.06]">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-slate-400 text-left">
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Description</th>
                      <th className="px-4 py-3 font-medium">Reference</th>
                      <th className="px-4 py-3 font-medium text-right">Amount</th>
                      <th className="px-4 py-3 font-medium text-right">Balance After</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map(tx => (
                      <tr key={tx.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 text-slate-400">{tx.date}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {txIcon(tx.type)}
                            <span className={cn('capitalize', txColor(tx.type))}>{tx.type}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">{tx.description}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-400">{tx.txRef}</td>
                        <td className={cn('px-4 py-3 text-right font-semibold', tx.type === 'deposit' || tx.type === 'cancel' ? 'text-emerald-400' : 'text-blue-400')}>
                          {tx.type === 'deposit' || tx.type === 'cancel' ? '+' : '-'}${fmt(tx.amount)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-400">${fmt(tx.balanceAfter)}</td>
                        <td className="px-4 py-3">{statusBadge(tx.status)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:text-violet-400"
                              onClick={() => openReceipt(tx)}>
                              <Receipt className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */
      /*                           DIALOGS                                       */
      /* ═══════════════════════════════════════════════════════════════════════ */}

      {/* Deposit Dialog */}
      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent className="bg-[#13131f] border-white/[0.06] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-400">
              <Plus className="w-5 h-5" /> Deposit Funds
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-xs text-emerald-400">Current Balance</p>
              <p className="text-xl font-bold text-emerald-400">${fmt(totalBalance)}</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Customer <span className="text-red-400">*</span></label>
              <Select value={depCustomerId} onValueChange={setDepCustomerId}>
                <SelectTrigger className="bg-white/[0.05] border-white/[0.1] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a2e] border-white/[0.1]">
                  {customers.filter(c => c.status === 'active').map(c => (
                    <SelectItem key={c.id} value={c.id} className="text-white">
                      <div className="flex items-center gap-2">
                        <User className="w-3 h-3 text-blue-400" />
                        <span>{c.name}</span>
                        <span className="text-white/30 text-[10px]">{c.phone}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1 mt-1">
                <Button variant="ghost" size="sm" className="h-5 text-[10px] text-blue-400 hover:text-blue-300 px-1" onClick={() => setAddCustomerOpen(true)}>
                  <Plus className="w-3 h-3 mr-1" /> New Customer
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Amount</label>
              <Input type="number" value={depAmount} onChange={e => setDepAmount(e.target.value)}
                placeholder="Enter amount" className="bg-white/[0.05] border-white/[0.1] text-white" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Currency</label>
              <Select value={depCurrency} onValueChange={setDepCurrency}>
                <SelectTrigger className="bg-white/[0.05] border-white/[0.1] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a2e] border-white/[0.1]">
                  <SelectItem value="USD" className="text-white">USD ($)</SelectItem>
                  <SelectItem value="CNY" className="text-white">CNY (¥)</SelectItem>
                  <SelectItem value="TZS" className="text-white">TZS (TSh)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Method</label>
              <Select value={depMethod} onValueChange={setDepMethod}>
                <SelectTrigger className="bg-white/[0.05] border-white/[0.1] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a2e] border-white/[0.1]">
                  <SelectItem value="Cash" className="text-white">Cash</SelectItem>
                  <SelectItem value="M-Pesa" className="text-white">M-Pesa</SelectItem>
                  <SelectItem value="Bank" className="text-white">Bank Transfer</SelectItem>
                  <SelectItem value="Agent" className="text-white">Agent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Notes</label>
              <Input value={depNotes} onChange={e => setDepNotes(e.target.value)}
                placeholder="Optional notes..." className="bg-white/[0.05] border-white/[0.1] text-white" />
            </div>
            <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold" onClick={handleDeposit} disabled={!depAmount || parseFloat(depAmount) <= 0}>
              <CheckCircle2 className="w-4 h-4 mr-1.5" /> Confirm Deposit
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Customer Dialog */}
      <Dialog open={addCustomerOpen} onOpenChange={setAddCustomerOpen}>
        <DialogContent className="bg-[#13131f] border-white/[0.06] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-400">
              <Plus className="w-5 h-5" /> Add Customer
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Full Name <span className="text-red-400">*</span></label>
              <Input value={newCustName} onChange={e => setNewCustName(e.target.value)}
                placeholder="e.g., Stephene Sosteri" className="bg-white/[0.05] border-white/[0.1] text-white" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Phone Number <span className="text-red-400">*</span></label>
              <Input value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)}
                placeholder="+255 713 456 789" className="bg-white/[0.05] border-white/[0.1] text-white" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Email</label>
              <Input value={newCustEmail} onChange={e => setNewCustEmail(e.target.value)}
                placeholder="customer@email.com" className="bg-white/[0.05] border-white/[0.1] text-white" />
            </div>
            <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold" onClick={() => {
              if (!newCustName.trim() || !newCustPhone.trim()) return;
              const newCust: Customer = {
                id: `CUST-${String(customers.length + 1).padStart(3, '0')}`,
                name: newCustName,
                phone: newCustPhone,
                email: newCustEmail,
                balance: 0,
                deposits: 0,
                status: 'active',
              };
              setCustomers([...customers, newCust]);
              setDepCustomerId(newCust.id);
              setAddCustomerOpen(false);
              setNewCustName(''); setNewCustPhone(''); setNewCustEmail('');
              showToast(`Customer ${newCust.name} added`);
            }} disabled={!newCustName.trim() || !newCustPhone.trim()}>
              <CheckCircle2 className="w-4 h-4 mr-1.5" /> Add Customer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Supplier Dialog */}
      <Dialog open={addSupplierOpen} onOpenChange={setAddSupplierOpen}>
        <DialogContent className="bg-[#13131f] border-white/[0.06] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-400">
              <Plus className="w-5 h-5" /> Add Supplier
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Supplier Name</label>
              <Input value={newSupName} onChange={e => setNewSupName(e.target.value)}
                placeholder="e.g., Shanghai Cargo Co." className="bg-white/[0.05] border-white/[0.1] text-white" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Country</label>
              <Input value={newSupCountry} onChange={e => setNewSupCountry(e.target.value)}
                placeholder="e.g., China" className="bg-white/[0.05] border-white/[0.1] text-white" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Contact Phone</label>
              <Input value={newSupContact} onChange={e => setNewSupContact(e.target.value)}
                placeholder="+86 138-0000-0000" className="bg-white/[0.05] border-white/[0.1] text-white" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Email</label>
              <Input value={newSupEmail} onChange={e => setNewSupEmail(e.target.value)}
                placeholder="supplier@example.com" className="bg-white/[0.05] border-white/[0.1] text-white" />
            </div>
            <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold" onClick={handleAddSupplier} disabled={!newSupName.trim()}>
              <CheckCircle2 className="w-4 h-4 mr-1.5" /> Add Supplier
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Allocate Dialog */}
      <Dialog open={allocateOpen} onOpenChange={setAllocateOpen}>
        <DialogContent className="bg-[#13131f] border-white/[0.06] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400">
              <Send className="w-5 h-5" /> Allocate Funds
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-xs text-amber-400">Available to Allocate</p>
              <p className="text-xl font-bold text-amber-400">${fmt(unassigned)}</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Customer <span className="text-red-400">*</span></label>
              <Select value={depCustomerId} onValueChange={setDepCustomerId}>
                <SelectTrigger className="bg-white/[0.05] border-white/[0.1] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a2e] border-white/[0.1]">
                  {customers.filter(c => c.status === 'active').map(c => (
                    <SelectItem key={c.id} value={c.id} className="text-white">
                      <div className="flex items-center gap-2">
                        <User className="w-3 h-3 text-blue-400" />
                        {c.name} — {c.phone}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Supplier</label>
              <Select value={allocSupplier} onValueChange={setAllocSupplier}>
                <SelectTrigger className="bg-white/[0.05] border-white/[0.1] text-white">
                  <SelectValue placeholder="Select supplier..." />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a2e] border-white/[0.1]">
                  {suppliers.filter(s => s.status === 'active').map(s => (
                    <SelectItem key={s.id} value={s.id} className="text-white">{s.flag} {s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Order Reference</label>
              <Input value={allocOrderRef} onChange={e => setAllocOrderRef(e.target.value)}
                placeholder="ORD-2025-042" className="bg-white/[0.05] border-white/[0.1] text-white" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Order Amount ($)</label>
              <Input type="number" value={allocOrderAmount} onChange={e => setAllocOrderAmount(e.target.value)}
                placeholder="Total cost" className="bg-white/[0.05] border-white/[0.1] text-white" />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400">Payment Type</label>
              <div className="flex gap-2">
                <Button type="button" variant={allocPaymentType === 'deposit' ? 'default' : 'outline'}
                  className={allocPaymentType === 'deposit' ? 'bg-amber-500 hover:bg-amber-600 text-white flex-1' : 'border-white/[0.1] bg-white/[0.05] hover:bg-white/[0.1] text-white flex-1'}
                  onClick={() => setAllocPaymentType('deposit')}>
                  Deposit
                </Button>
                <Button type="button" variant={allocPaymentType === 'full' ? 'default' : 'outline'}
                  className={allocPaymentType === 'full' ? 'bg-emerald-500 hover:bg-emerald-600 text-white flex-1' : 'border-white/[0.1] bg-white/[0.05] hover:bg-white/[0.1] text-white flex-1'}
                  onClick={() => setAllocPaymentType('full')}>
                  Full Payment
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Amount ($)</label>
              <Input type="number" value={allocAmount} onChange={e => setAllocAmount(e.target.value)}
                placeholder={isFullPayment && allocOrderAmount ? String(allocOrderAmtNum) : 'Enter amount'}
                className="bg-white/[0.05] border-white/[0.1] text-white" />
              {allocAmtNum > unassigned && <p className="text-xs text-red-400">Exceeds available balance</p>}
            </div>
            {allocAmtNum > 0 && allocOrderAmtNum > 0 && (
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm space-y-1">
                <p className="text-xs text-blue-400 font-medium">Preview</p>
                <p className="text-slate-300">Paying <span className="text-white font-semibold">${fmt(allocAmtNum)}</span> of <span className="text-white font-semibold">${fmt(allocOrderAmtNum)}</span></p>
                <p className="text-xs text-slate-400">New balance: ${fmt(Math.max(0, unassigned - allocAmtNum))}</p>
                {showFullPaymentWarning && (
                  <p className="text-xs text-amber-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Not full payment</p>
                )}
              </div>
            )}
            <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold" onClick={handleAllocate} disabled={!canAllocate}>
              <Send className="w-4 h-4 mr-1.5" /> Confirm Allocation
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="bg-[#13131f] border-white/[0.06] text-white max-w-lg">
          {selectedTx && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-emerald-400">
                  <BadgeCheck className="w-5 h-5" /> Payment Confirmation
                </DialogTitle>
              </DialogHeader>

              {/* Bank-Style Receipt Card */}
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-6 space-y-5 relative overflow-hidden">
                {/* Subtle gradient overlay */}
                <div className="absolute inset-0 bg-emerald-500/[0.02] pointer-events-none" />
                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />

                {/* Header */}
                <div className="text-center space-y-1 relative">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center mx-auto mb-2">
                    <Wallet className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold tracking-wide">KOBE PAY</h3>
                  <p className="text-xs text-slate-400 uppercase tracking-widest">Payment Confirmation</p>
                </div>

                {/* Divider */}
                <div className="border-t border-dashed border-white/[0.1]" />

                {/* Transaction Details */}
                <div className="space-y-3 text-sm relative">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Transaction ID</span>
                    <span className="font-mono text-xs">{selectedTx.txRef}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Date</span>
                    <span>{selectedTx.date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Customer</span>
                    <span className="font-medium">Stephene Sosteri</span>
                  </div>
                  {selectedTx.supplierName && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Supplier</span>
                      <span className="font-medium">{selectedTx.supplierName}</span>
                    </div>
                  )}
                  {selectedTx.orderRef && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Order Reference</span>
                      <span className="font-mono text-xs">{selectedTx.orderRef}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-400">Payment Type</span>
                    <Badge className={selectedTx.paymentType === 'full' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}>
                      {selectedTx.paymentType === 'full' ? 'FULL PAYMENT' : 'DEPOSIT'}
                    </Badge>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-dashed border-white/[0.1]" />

                  <div className="flex justify-between">
                    <span className="text-slate-400">Amount Paid</span>
                    <span className="text-xl font-bold text-emerald-400">${fmt(selectedTx.amount)}</span>
                  </div>
                  {selectedTx.paymentType === 'deposit' && selectedTx.orderRef && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Remaining</span>
                      <span className="text-amber-400 font-medium">
                        ${fmt(allocations.find(a => a.orderRef === selectedTx.orderRef)?.remaining || 0)}
                      </span>
                    </div>
                  )}

                  {/* Status */}
                  <div className="flex items-center justify-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span className="font-bold text-emerald-400">CONFIRMED</span>
                  </div>

                  {selectedTx.confirmedBy && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Confirmed by</span>
                      <span>{selectedTx.confirmedBy}</span>
                    </div>
                  )}

                  {/* QR Code */}
                  <div className="flex flex-col items-center gap-2 pt-2">
                    <div className="p-3 rounded-xl bg-white shadow-lg">
                      <QRCodeSVG value={`https://kobe.app/tx/${selectedTx.txRef.replace('KBE-TX-', '')}`} size={120} bgColor="#ffffff" fgColor="#0a0a1a" level="M" />
                    </div>
                    <p className="text-xs text-slate-400">Scan to verify transaction</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1 border-white/[0.1] bg-white/[0.05] hover:bg-white/[0.1] text-white"
                  onClick={() => showToast('PDF download started')}>
                  <Download className="w-4 h-4 mr-1.5" /> Download PDF
                </Button>
                <Button variant="outline" className="flex-1 border-white/[0.1] bg-white/[0.05] hover:bg-white/[0.1] text-white"
                  onClick={() => { const url = `https://kobe.app/tx/${selectedTx.txRef.replace('KBE-TX-', '')}`; navigator.clipboard?.writeText(url); showToast('Share link copied'); }}>
                  <Share2 className="w-4 h-4 mr-1.5" /> Share Link
                </Button>
                <Button variant="outline" className="flex-1 border-white/[0.1] bg-white/[0.05] hover:bg-white/[0.1] text-white"
                  onClick={() => showToast('Printing receipt...')}>
                  <Printer className="w-4 h-4 mr-1.5" /> Print
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Supplier Detail Dialog */}
      <Dialog open={supplierDetailOpen} onOpenChange={setSupplierDetailOpen}>
        <DialogContent className="bg-[#13131f] border-white/[0.06] text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedSupplier && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-blue-400">
                  <Building2 className="w-5 h-5" /> {selectedSupplier.name}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 pt-2">
                {/* Balance Card */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                    <p className="text-xs text-emerald-400">Balance</p>
                    <p className="text-lg font-bold text-emerald-400">${fmt(selectedSupplier.balance)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
                    <p className="text-xs text-amber-400">Reserved</p>
                    <p className="text-lg font-bold text-amber-400">${fmt(selectedSupplier.reserved)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
                    <p className="text-xs text-blue-400">Available</p>
                    <p className="text-lg font-bold text-blue-400">${fmt(selectedSupplier.balance - selectedSupplier.reserved)}</p>
                  </div>
                </div>

                {/* Info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Globe className="w-4 h-4" /> {selectedSupplier.country}
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Phone className="w-4 h-4" /> {selectedSupplier.contact}
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Mail className="w-4 h-4" /> {selectedSupplier.email}
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Package className="w-4 h-4" /> {selectedSupplier.orders} orders
                  </div>
                </div>

                {/* Allocations for this supplier */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-400 mb-2">Allocation History</h4>
                  <div className="space-y-2">
                    {allocations.filter(a => a.supplierId === selectedSupplier.id).slice(0, 5).map(alloc => (
                      <div key={alloc.id} className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02]">
                        <div className="flex items-center gap-2">
                          {alloc.paymentType === 'full' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Clock className="w-4 h-4 text-amber-400" />}
                          <div>
                            <p className="text-sm">{alloc.orderRef}</p>
                            <p className="text-xs text-slate-400">{alloc.date}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">${fmt(alloc.amount)}</p>
                          {statusBadge(alloc.status)}
                        </div>
                      </div>
                    ))}
                    {allocations.filter(a => a.supplierId === selectedSupplier.id).length === 0 && (
                      <p className="text-sm text-slate-400 text-center py-4">No allocations yet</p>
                    )}
                  </div>
                </div>

                {/* Transactions for this supplier */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-400 mb-2">Transaction History</h4>
                  <div className="space-y-2">
                    {transactions.filter(t => t.supplierId === selectedSupplier.id).slice(0, 5).map(tx => (
                      <div key={tx.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] cursor-pointer hover:bg-white/[0.04]"
                        onClick={() => openReceipt(tx)}>
                        {txIcon(tx.type)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{tx.description}</p>
                          <p className="text-xs text-slate-400">{tx.date}</p>
                        </div>
                        <span className={cn('text-sm font-semibold', tx.type === 'deposit' || tx.type === 'cancel' ? 'text-emerald-400' : 'text-blue-400')}>
                          {tx.type === 'deposit' || tx.type === 'cancel' ? '+' : '-'}${fmt(tx.amount)}
                        </span>
                      </div>
                    ))}
                    {transactions.filter(t => t.supplierId === selectedSupplier.id).length === 0 && (
                      <p className="text-sm text-slate-400 text-center py-4">No transactions yet</p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
                    onClick={() => { setAllocSupplier(selectedSupplier.id); setAllocateOpen(true); setSupplierDetailOpen(false); }}>
                    <Send className="w-4 h-4 mr-1.5" /> Allocate Funds
                  </Button>
                  <Button variant="outline" className="border-white/[0.1] bg-white/[0.05] hover:bg-white/[0.1] text-white">
                    <Edit className="w-4 h-4 mr-1.5" /> Edit
                  </Button>
                  <Button variant="outline" className="border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400">
                    <XCircle className="w-4 h-4 mr-1.5" /> Deactivate
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
