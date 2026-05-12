import { useState, useMemo } from 'react';
import {
  CreditCard, Search, DollarSign, AlertTriangle, CheckCircle2, Clock,
  User, Phone, Send, Plus, X,
  Wallet, Receipt
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

/* ────────────────────────────────────────────
   Types
   ──────────────────────────────────────────── */
interface Customer {
  id: string;
  name: string;
  phone: string;
  creditLimit: number;
  balanceOwed: number;
  paidToDate: number;
  status: 'Active' | 'Overdue' | 'Blocked';
}

interface Transaction {
  id: string;
  date: string;
  invoiceNo: string;
  customerId: string;
  customerName: string;
  type: 'Sale' | 'Payment';
  subType: 'Cash Sale' | 'Credit Sale' | 'Partial Payment' | 'Full Payment';
  amount: number;
  balance: number;
  dueDate?: string;
  status: 'Paid' | 'Pending' | 'Overdue';
}

/* ────────────────────────────────────────────
   Mock Data
   ──────────────────────────────────────────── */
const CUSTOMERS: Customer[] = [
  { id: 'C001', name: 'Juma Abdallah', phone: '+255 712 345 678', creditLimit: 500_000, balanceOwed: 320_000, paidToDate: 180_000, status: 'Active' },
  { id: 'C002', name: 'Amina Hassan', phone: '+255 713 456 789', creditLimit: 1_000_000, balanceOwed: 890_000, paidToDate: 110_000, status: 'Overdue' },
  { id: 'C003', name: 'Rajab Mwinyi', phone: '+255 714 567 890', creditLimit: 300_000, balanceOwed: 0, paidToDate: 450_000, status: 'Active' },
  { id: 'C004', name: 'Fatima Said', phone: '+255 715 678 901', creditLimit: 750_000, balanceOwed: 680_000, paidToDate: 70_000, status: 'Overdue' },
  { id: 'C005', name: 'Peter Omondi', phone: '+255 716 789 012', creditLimit: 200_000, balanceOwed: 120_000, paidToDate: 80_000, status: 'Active' },
  { id: 'C006', name: 'Grace Mushi', phone: '+255 717 890 123', creditLimit: 600_000, balanceOwed: 410_000, paidToDate: 190_000, status: 'Active' },
  { id: 'C007', name: 'Khalid Omar', phone: '+255 718 901 234', creditLimit: 400_000, balanceOwed: 395_000, paidToDate: 5_000, status: 'Overdue' },
  { id: 'C008', name: 'Lucy Nkatha', phone: '+255 719 012 345', creditLimit: 350_000, balanceOwed: 0, paidToDate: 620_000, status: 'Active' },
  { id: 'C009', name: 'Moses Kibona', phone: '+255 720 123 456', creditLimit: 800_000, balanceOwed: 720_000, paidToDate: 80_000, status: 'Overdue' },
  { id: 'C010', name: 'Sofia Juma', phone: '+255 721 234 567', creditLimit: 250_000, balanceOwed: 95_000, paidToDate: 155_000, status: 'Active' },
  { id: 'C011', name: 'Daniel Mrosso', phone: '+255 722 345 678', creditLimit: 500_000, balanceOwed: 0, paidToDate: 340_000, status: 'Active' },
  { id: 'C012', name: 'Halima Rajab', phone: '+255 723 456 789', creditLimit: 1_200_000, balanceOwed: 1_050_000, paidToDate: 150_000, status: 'Overdue' },
  { id: 'C013', name: 'Samwel Kavishe', phone: '+255 724 567 890', creditLimit: 450_000, balanceOwed: 280_000, paidToDate: 170_000, status: 'Active' },
  { id: 'C014', name: 'Rehema Saidi', phone: '+255 725 678 901', creditLimit: 150_000, balanceOwed: 145_000, paidToDate: 5_000, status: 'Blocked' },
  { id: 'C015', name: 'Innocent Bya', phone: '+255 726 789 012', creditLimit: 700_000, balanceOwed: 45_000, paidToDate: 655_000, status: 'Active' },
  { id: 'C016', name: 'Martha Lema', phone: '+255 727 890 123', creditLimit: 550_000, balanceOwed: 380_000, paidToDate: 170_000, status: 'Active' },
  { id: 'C017', name: 'Joseph Mwanga', phone: '+255 728 901 234', creditLimit: 900_000, balanceOwed: 620_000, paidToDate: 280_000, status: 'Active' },
  { id: 'C018', name: 'Zubeda Ally', phone: '+255 729 012 345', creditLimit: 200_000, balanceOwed: 180_000, paidToDate: 20_000, status: 'Overdue' },
  { id: 'C019', name: 'Frank Joseph', phone: '+255 730 123 456', creditLimit: 1_500_000, balanceOwed: 200_000, paidToDate: 1_100_000, status: 'Active' },
  { id: 'C020', name: 'Asha Ramadhani', phone: '+255 731 234 567', creditLimit: 300_000, balanceOwed: 0, paidToDate: 580_000, status: 'Active' },
  { id: 'C021', name: 'Emmanuel Festo', phone: '+255 732 345 678', creditLimit: 650_000, balanceOwed: 560_000, paidToDate: 90_000, status: 'Active' },
  { id: 'C022', name: 'Catherine Julius', phone: '+255 733 456 789', creditLimit: 180_000, balanceOwed: 175_000, paidToDate: 5_000, status: 'Blocked' },
  { id: 'C023', name: 'Hassan Mtoro', phone: '+255 734 567 890', creditLimit: 1_000_000, balanceOwed: 0, paidToDate: 920_000, status: 'Active' },
  { id: 'C024', name: 'Winfrida Mallya', phone: '+255 735 678 901', creditLimit: 420_000, balanceOwed: 310_000, paidToDate: 110_000, status: 'Active' },
];

const TRANSACTIONS: Transaction[] = [
  { id: 'T001', date: '2025-01-18', invoiceNo: 'INV-2025-001', customerId: 'C001', customerName: 'Juma Abdallah', type: 'Sale', subType: 'Credit Sale', amount: 250_000, balance: 250_000, dueDate: '2025-02-18', status: 'Pending' },
  { id: 'T002', date: '2025-01-15', invoiceNo: 'INV-2025-002', customerId: 'C001', customerName: 'Juma Abdallah', type: 'Sale', subType: 'Credit Sale', amount: 250_000, balance: 70_000, dueDate: '2025-02-15', status: 'Pending' },
  { id: 'T003', date: '2025-01-20', invoiceNo: 'PAY-2025-003', customerId: 'C001', customerName: 'Juma Abdallah', type: 'Payment', subType: 'Partial Payment', amount: 180_000, balance: 0, status: 'Paid' },
  { id: 'T004', date: '2025-01-22', invoiceNo: 'INV-2025-004', customerId: 'C002', customerName: 'Amina Hassan', type: 'Sale', subType: 'Credit Sale', amount: 500_000, balance: 500_000, dueDate: '2024-12-22', status: 'Overdue' },
  { id: 'T005', date: '2025-01-10', invoiceNo: 'INV-2025-005', customerId: 'C002', customerName: 'Amina Hassan', type: 'Sale', subType: 'Credit Sale', amount: 500_000, balance: 390_000, dueDate: '2025-02-10', status: 'Overdue' },
  { id: 'T006', date: '2025-01-25', invoiceNo: 'PAY-2025-006', customerId: 'C002', customerName: 'Amina Hassan', type: 'Payment', subType: 'Partial Payment', amount: 110_000, balance: 0, status: 'Paid' },
  { id: 'T007', date: '2025-01-20', invoiceNo: 'INV-2025-007', customerId: 'C003', customerName: 'Rajab Mwinyi', type: 'Sale', subType: 'Cash Sale', amount: 180_000, balance: 0, status: 'Paid' },
  { id: 'T008', date: '2025-01-18', invoiceNo: 'INV-2025-008', customerId: 'C003', customerName: 'Rajab Mwinyi', type: 'Sale', subType: 'Credit Sale', amount: 150_000, balance: 0, dueDate: '2025-02-18', status: 'Paid' },
  { id: 'T009', date: '2025-01-25', invoiceNo: 'PAY-2025-009', customerId: 'C003', customerName: 'Rajab Mwinyi', type: 'Payment', subType: 'Full Payment', amount: 150_000, balance: 0, status: 'Paid' },
  { id: 'T010', date: '2025-01-22', invoiceNo: 'INV-2025-010', customerId: 'C004', customerName: 'Fatima Said', type: 'Sale', subType: 'Credit Sale', amount: 400_000, balance: 400_000, dueDate: '2024-12-22', status: 'Overdue' },
  { id: 'T011', date: '2025-01-15', invoiceNo: 'INV-2025-011', customerId: 'C004', customerName: 'Fatima Said', type: 'Sale', subType: 'Credit Sale', amount: 350_000, balance: 280_000, dueDate: '2025-02-15', status: 'Overdue' },
  { id: 'T012', date: '2025-01-28', invoiceNo: 'PAY-2025-012', customerId: 'C004', customerName: 'Fatima Said', type: 'Payment', subType: 'Partial Payment', amount: 70_000, balance: 0, status: 'Paid' },
  { id: 'T013', date: '2025-01-25', invoiceNo: 'INV-2025-013', customerId: 'C005', customerName: 'Peter Omondi', type: 'Sale', subType: 'Credit Sale', amount: 120_000, balance: 120_000, dueDate: '2025-02-25', status: 'Pending' },
  { id: 'T014', date: '2025-01-22', invoiceNo: 'PAY-2025-014', customerId: 'C005', customerName: 'Peter Omondi', type: 'Payment', subType: 'Full Payment', amount: 80_000, balance: 0, status: 'Paid' },
  { id: 'T015', date: '2025-01-20', invoiceNo: 'INV-2025-015', customerId: 'C006', customerName: 'Grace Mushi', type: 'Sale', subType: 'Credit Sale', amount: 300_000, balance: 220_000, dueDate: '2025-02-20', status: 'Pending' },
  { id: 'T016', date: '2025-01-18', invoiceNo: 'INV-2025-016', customerId: 'C006', customerName: 'Grace Mushi', type: 'Sale', subType: 'Cash Sale', amount: 110_000, balance: 0, status: 'Paid' },
  { id: 'T017', date: '2025-01-25', invoiceNo: 'INV-2025-017', customerId: 'C006', customerName: 'Grace Mushi', type: 'Sale', subType: 'Credit Sale', amount: 110_000, balance: 110_000, dueDate: '2025-02-25', status: 'Pending' },
  { id: 'T018', date: '2025-01-25', invoiceNo: 'PAY-2025-018', customerId: 'C006', customerName: 'Grace Mushi', type: 'Payment', subType: 'Partial Payment', amount: 190_000, balance: 0, status: 'Paid' },
  { id: 'T019', date: '2025-01-15', invoiceNo: 'INV-2025-019', customerId: 'C007', customerName: 'Khalid Omar', type: 'Sale', subType: 'Credit Sale', amount: 400_000, balance: 395_000, dueDate: '2024-12-15', status: 'Overdue' },
  { id: 'T020', date: '2025-01-10', invoiceNo: 'PAY-2025-020', customerId: 'C007', customerName: 'Khalid Omar', type: 'Payment', subType: 'Partial Payment', amount: 5_000, balance: 0, status: 'Paid' },
  { id: 'T021', date: '2025-01-28', invoiceNo: 'INV-2025-021', customerId: 'C008', customerName: 'Lucy Nkatha', type: 'Sale', subType: 'Cash Sale', amount: 250_000, balance: 0, status: 'Paid' },
  { id: 'T022', date: '2025-01-22', invoiceNo: 'INV-2025-022', customerId: 'C009', customerName: 'Moses Kibona', type: 'Sale', subType: 'Credit Sale', amount: 500_000, balance: 500_000, dueDate: '2024-12-22', status: 'Overdue' },
  { id: 'T023', date: '2025-01-20', invoiceNo: 'INV-2025-023', customerId: 'C009', customerName: 'Moses Kibona', type: 'Sale', subType: 'Credit Sale', amount: 300_000, balance: 220_000, dueDate: '2025-02-20', status: 'Overdue' },
  { id: 'T024', date: '2025-01-18', invoiceNo: 'PAY-2025-024', customerId: 'C009', customerName: 'Moses Kibona', type: 'Payment', subType: 'Partial Payment', amount: 80_000, balance: 0, status: 'Paid' },
  { id: 'T025', date: '2025-01-25', invoiceNo: 'INV-2025-025', customerId: 'C010', customerName: 'Sofia Juma', type: 'Sale', subType: 'Credit Sale', amount: 120_000, balance: 40_000, dueDate: '2025-02-25', status: 'Pending' },
  { id: 'T026', date: '2025-01-22', invoiceNo: 'INV-2025-026', customerId: 'C010', customerName: 'Sofia Juma', type: 'Sale', subType: 'Cash Sale', amount: 55_000, balance: 0, status: 'Paid' },
  { id: 'T027', date: '2025-01-20', invoiceNo: 'PAY-2025-027', customerId: 'C010', customerName: 'Sofia Juma', type: 'Payment', subType: 'Partial Payment', amount: 155_000, balance: 0, status: 'Paid' },
  { id: 'T028', date: '2025-01-28', invoiceNo: 'INV-2025-028', customerId: 'C011', customerName: 'Daniel Mrosso', type: 'Sale', subType: 'Cash Sale', amount: 200_000, balance: 0, status: 'Paid' },
  { id: 'T029', date: '2025-01-15', invoiceNo: 'INV-2025-029', customerId: 'C012', customerName: 'Halima Rajab', type: 'Sale', subType: 'Credit Sale', amount: 700_000, balance: 700_000, dueDate: '2024-12-15', status: 'Overdue' },
  { id: 'T030', date: '2025-01-20', invoiceNo: 'INV-2025-030', customerId: 'C012', customerName: 'Halima Rajab', type: 'Sale', subType: 'Credit Sale', amount: 500_000, balance: 350_000, dueDate: '2025-02-20', status: 'Overdue' },
  { id: 'T031', date: '2025-01-25', invoiceNo: 'PAY-2025-031', customerId: 'C012', customerName: 'Halima Rajab', type: 'Payment', subType: 'Partial Payment', amount: 150_000, balance: 0, status: 'Paid' },
  { id: 'T032', date: '2025-01-22', invoiceNo: 'INV-2025-032', customerId: 'C013', customerName: 'Samwel Kavishe', type: 'Sale', subType: 'Credit Sale', amount: 280_000, balance: 280_000, dueDate: '2025-02-22', status: 'Pending' },
  { id: 'T033', date: '2025-01-18', invoiceNo: 'INV-2025-033', customerId: 'C013', customerName: 'Samwel Kavishe', type: 'Sale', subType: 'Cash Sale', amount: 120_000, balance: 0, status: 'Paid' },
  { id: 'T034', date: '2025-01-25', invoiceNo: 'PAY-2025-034', customerId: 'C013', customerName: 'Samwel Kavishe', type: 'Payment', subType: 'Partial Payment', amount: 170_000, balance: 0, status: 'Paid' },
  { id: 'T035', date: '2025-01-15', invoiceNo: 'INV-2025-035', customerId: 'C014', customerName: 'Rehema Saidi', type: 'Sale', subType: 'Credit Sale', amount: 150_000, balance: 145_000, dueDate: '2024-11-15', status: 'Overdue' },
  { id: 'T036', date: '2025-01-10', invoiceNo: 'PAY-2025-036', customerId: 'C014', customerName: 'Rehema Saidi', type: 'Payment', subType: 'Partial Payment', amount: 5_000, balance: 0, status: 'Paid' },
  { id: 'T037', date: '2025-01-28', invoiceNo: 'INV-2025-037', customerId: 'C015', customerName: 'Innocent Bya', type: 'Sale', subType: 'Credit Sale', amount: 250_000, balance: 45_000, dueDate: '2025-02-28', status: 'Pending' },
  { id: 'T038', date: '2025-01-22', invoiceNo: 'INV-2025-038', customerId: 'C016', customerName: 'Martha Lema', type: 'Sale', subType: 'Credit Sale', amount: 250_000, balance: 250_000, dueDate: '2025-02-22', status: 'Pending' },
  { id: 'T039', date: '2025-01-18', invoiceNo: 'INV-2025-039', customerId: 'C016', customerName: 'Martha Lema', type: 'Sale', subType: 'Cash Sale', amount: 130_000, balance: 0, status: 'Paid' },
  { id: 'T040', date: '2025-01-25', invoiceNo: 'PAY-2025-040', customerId: 'C016', customerName: 'Martha Lema', type: 'Payment', subType: 'Partial Payment', amount: 170_000, balance: 0, status: 'Paid' },
];

const AGING_DATA = [
  { bucket: 'Current', amount: 2_150_000 },
  { bucket: '1-30 Days', amount: 3_680_000 },
  { bucket: '31-60 Days', amount: 2_890_000 },
  { bucket: '61-90 Days', amount: 1_820_000 },
  { bucket: '90+ Days', amount: 1_560_000 },
];

const AGING_CUSTOMERS = [
  { name: 'Halima Rajab', current: 0, days1_30: 0, days31_60: 350_000, days61_90: 0, days90plus: 700_000 },
  { name: 'Amina Hassan', current: 0, days1_30: 390_000, days31_60: 0, days61_90: 500_000, days90plus: 0 },
  { name: 'Moses Kibona', current: 0, days1_30: 220_000, days31_60: 0, days61_90: 500_000, days90plus: 0 },
  { name: 'Fatima Said', current: 0, days1_30: 0, days31_60: 280_000, days61_90: 400_000, days90plus: 0 },
  { name: 'Khalid Omar', current: 0, days1_30: 0, days31_60: 0, days61_90: 0, days90plus: 395_000 },
  { name: 'Martha Lema', current: 130_000, days1_30: 250_000, days31_60: 0, days61_90: 0, days90plus: 0 },
  { name: 'Rehema Saidi', current: 0, days1_30: 0, days31_60: 0, days61_90: 0, days90plus: 145_000 },
  { name: 'Joseph Mwanga', current: 200_000, days1_30: 420_000, days31_60: 0, days61_90: 0, days90plus: 0 },
  { name: 'Zubeda Ally', current: 0, days1_30: 0, days31_60: 180_000, days61_90: 0, days90plus: 0 },
  { name: 'Emmanuel Festo', current: 110_000, days1_30: 0, days31_60: 450_000, days61_90: 0, days90plus: 0 },
  { name: 'Juma Abdallah', current: 70_000, days1_30: 250_000, days31_60: 0, days61_90: 0, days90plus: 0 },
  { name: 'Innocent Bya', current: 45_000, days1_30: 0, days31_60: 0, days61_90: 0, days90plus: 0 },
];

/* ────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────── */
const fmt = (n: number) => 'TSh ' + n.toLocaleString('en-US');

const now = new Date('2025-01-29');

function daysOverdue(dueDate?: string): number {
  if (!dueDate) return 0;
  const d = new Date(dueDate);
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)));
}

/* ────────────────────────────────────────────
   Status Badge
   ──────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    Overdue: 'bg-red-500/15 text-red-400 border-red-500/20',
    Blocked: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
    Paid: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    Pending: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  };
  return (
    <Badge variant="outline" className={`${map[status] || map.Pending} text-xs font-medium`}>
      {status}
    </Badge>
  );
}

/* ────────────────────────────────────────────
   Main Component
   ──────────────────────────────────────────── */
export default function CreditCollectionsModule() {
  const [activeTab, setActiveTab] = useState('ledger');
  const [search, setSearch] = useState('');
  const [txnFilter, setTxnFilter] = useState('All');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  /* Payment form state */
  const [payCustomerId, setPayCustomerId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [payDate, setPayDate] = useState('2025-01-29');
  const [payNotes, setPayNotes] = useState('');
  const [paySuccess, setPaySuccess] = useState(false);

  /* Sales toggle */
  const [showCreditSales, setShowCreditSales] = useState(true);

  /* Derived data */
  const totalReceivables = useMemo(() => CUSTOMERS.reduce((s, c) => s + c.balanceOwed, 0), []);
  const totalOverdue = useMemo(() => CUSTOMERS.filter(c => c.status === 'Overdue').reduce((s, c) => s + c.balanceOwed, 0), []);
  const paidThisMonth = useMemo(() => CUSTOMERS.reduce((s, c) => s + c.paidToDate, 0), []);
  const activeAccounts = useMemo(() => CUSTOMERS.filter(c => c.status === 'Active').length, []);
  const cashSales = useMemo(() => TRANSACTIONS.filter(t => t.subType === 'Cash Sale').reduce((s, t) => s + t.amount, 0), []);
  const creditSales = useMemo(() => TRANSACTIONS.filter(t => t.subType === 'Credit Sale').reduce((s, t) => s + t.amount, 0), []);

  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return CUSTOMERS;
    const q = search.toLowerCase();
    return CUSTOMERS.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.id.toLowerCase().includes(q));
  }, [search]);

  const filteredTxns = useMemo(() => {
    let list = TRANSACTIONS;
    if (txnFilter === 'Cash Sales') list = list.filter(t => t.subType === 'Cash Sale');
    else if (txnFilter === 'Credit Sales') list = list.filter(t => t.subType === 'Credit Sale');
    else if (txnFilter === 'Payments') list = list.filter(t => t.type === 'Payment');
    else if (txnFilter === 'Overdue') list = list.filter(t => t.status === 'Overdue');
    return list;
  }, [txnFilter]);

  const customerTxns = useMemo(() => {
    if (!selectedCustomer) return [];
    return TRANSACTIONS.filter(t => t.customerId === selectedCustomer.id);
  }, [selectedCustomer]);

  const payCustomer = useMemo(() => CUSTOMERS.find(c => c.id === payCustomerId) || null, [payCustomerId]);

  function handleViewCustomer(c: Customer) {
    setSelectedCustomer(c);
    setDetailOpen(true);
  }

  function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payCustomerId || !payAmount) return;
    setPaySuccess(true);
    setTimeout(() => {
      setPaySuccess(false);
      setPayCustomerId('');
      setPayAmount('');
      setPayNotes('');
    }, 2500);
  }

  /* ── KPI Cards ── */
  const kpiCards = [
    { label: 'Total Receivables', value: fmt(totalReceivables), icon: DollarSign, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Overdue Amount', value: fmt(totalOverdue), icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
    { label: 'Paid This Month', value: fmt(paidThisMonth), icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Active Credit Accounts', value: String(activeAccounts), icon: User, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-slate-100 p-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-500/10 p-3">
            <CreditCard className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Credit & Collections</h1>
            <p className="text-sm text-slate-400">Manage customer credit, track payments, and monitor aging</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-[#13131f] border border-white/[0.06] p-1">
          <button
            onClick={() => setShowCreditSales(false)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${!showCreditSales ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:text-white'}`}
          >
            Cash Sales {fmt(cashSales)}
          </button>
          <button
            onClick={() => setShowCreditSales(true)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${showCreditSales ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:text-white'}`}
          >
            Credit Sales {fmt(creditSales)}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpiCards.map(k => (
          <Card key={k.label} className="bg-[#13131f] border-white/[0.06]">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">{k.label}</p>
                  <p className="text-xl font-bold text-white">{k.value}</p>
                </div>
                <div className={`rounded-lg ${k.bg} p-3`}>
                  <k.icon className={`h-5 w-5 ${k.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[#13131f] border border-white/[0.06] mb-6">
          <TabsTrigger value="ledger" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400 text-slate-400">
            <Receipt className="h-4 w-4 mr-2" /> Customer Ledger
          </TabsTrigger>
          <TabsTrigger value="transactions" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400 text-slate-400">
            <Wallet className="h-4 w-4 mr-2" /> Transactions
          </TabsTrigger>
          <TabsTrigger value="aging" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400 text-slate-400">
            <Clock className="h-4 w-4 mr-2" /> Aging Report
          </TabsTrigger>
          <TabsTrigger value="payment" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400 text-slate-400">
            <Plus className="h-4 w-4 mr-2" /> Record Payment
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Customer Ledger ── */}
        <TabsContent value="ledger">
          <Card className="bg-[#13131f] border-white/[0.06]">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-5">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    placeholder="Search by name, phone, or ID..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-10 bg-[#0a0a1a] border-white/[0.06] text-slate-100 placeholder:text-slate-500"
                  />
                </div>
                <Badge variant="outline" className="bg-white/[0.02] text-slate-400 border-white/[0.06]">
                  {filteredCustomers.length} customers
                </Badge>
              </div>

              <ScrollArea className="h-[520px]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      {['Customer', 'Phone', 'Credit Limit', 'Balance Owed', 'Paid To Date', 'Credit Available', 'Status', 'Actions'].map(h => (
                        <th key={h} className="text-left py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map((c, i) => (
                      <tr key={c.id} className={`${i % 2 === 0 ? 'bg-white/[0.02]' : 'bg-white/[0.01]'} hover:bg-white/[0.04] transition-colors`}>
                        <td className="py-3 px-3">
                          <div className="font-medium text-white">{c.name}</div>
                          <div className="text-xs text-slate-500">{c.id}</div>
                        </td>
                        <td className="py-3 px-3 text-slate-400">
                          <div className="flex items-center gap-1"><Phone className="h-3 w-3" /> {c.phone}</div>
                        </td>
                        <td className="py-3 px-3 text-slate-300">{fmt(c.creditLimit)}</td>
                        <td className={`py-3 px-3 font-semibold ${c.balanceOwed > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{fmt(c.balanceOwed)}</td>
                        <td className="py-3 px-3 text-emerald-400">{fmt(c.paidToDate)}</td>
                        <td className="py-3 px-3 text-slate-300">{fmt(c.creditLimit - c.balanceOwed)}</td>
                        <td className="py-3 px-3"><StatusBadge status={c.status} /></td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" className="h-7 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10" onClick={() => handleViewCustomer(c)}>
                              View
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10" onClick={() => { setPayCustomerId(c.id); setActiveTab('payment'); }}>
                              Pay
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10">
                              <Send className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 2: Transactions ── */}
        <TabsContent value="transactions">
          <Card className="bg-[#13131f] border-white/[0.06]">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-5 flex-wrap">
                {['All', 'Cash Sales', 'Credit Sales', 'Payments', 'Overdue'].map(f => (
                  <Button
                    key={f}
                    size="sm"
                    variant={txnFilter === f ? 'default' : 'outline'}
                    onClick={() => setTxnFilter(f)}
                    className={txnFilter === f ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-transparent text-slate-400 border-white/[0.06] hover:text-white'}
                  >
                    {f}
                  </Button>
                ))}
                <Badge variant="outline" className="bg-white/[0.02] text-slate-400 border-white/[0.06] ml-auto">
                  {filteredTxns.length} transactions
                </Badge>
              </div>

              <ScrollArea className="h-[520px]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      {['Date', 'Invoice #', 'Customer', 'Type', 'Amount', 'Balance', 'Due Date', 'Status'].map(h => (
                        <th key={h} className="text-left py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTxns.map((t, i) => (
                      <tr key={t.id} className={`${i % 2 === 0 ? 'bg-white/[0.02]' : 'bg-white/[0.01]'} hover:bg-white/[0.04] transition-colors`}>
                        <td className="py-3 px-3 text-slate-300">{t.date}</td>
                        <td className="py-3 px-3 text-blue-400 font-mono text-xs">{t.invoiceNo}</td>
                        <td className="py-3 px-3 text-white font-medium">{t.customerName}</td>
                        <td className="py-3 px-3">
                          <span className={`text-xs px-2 py-1 rounded-full ${t.type === 'Sale' ? (t.subType === 'Cash Sale' ? 'bg-blue-500/15 text-blue-400' : 'bg-amber-500/15 text-amber-400') : 'bg-emerald-500/15 text-emerald-400'}`}>
                            {t.subType}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-200 font-medium">{fmt(t.amount)}</td>
                        <td className={`py-3 px-3 ${t.balance > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{fmt(t.balance)}</td>
                        <td className="py-3 px-3 text-slate-400">
                          {t.dueDate ? (
                            <span className={t.status === 'Overdue' ? 'text-red-400' : ''}>
                              {t.dueDate} {t.status === 'Overdue' && <span className="text-xs">({daysOverdue(t.dueDate)}d)</span>}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="py-3 px-3"><StatusBadge status={t.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 3: Aging Report ── */}
        <TabsContent value="aging">
          <div className="space-y-6">
            {/* Chart */}
            <Card className="bg-[#13131f] border-white/[0.06]">
              <CardContent className="p-5">
                <h3 className="text-lg font-semibold text-white mb-4">Aging Buckets</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={AGING_DATA}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="bucket" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={v => `TSh ${(v / 1_000_000).toFixed(1)}M`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#13131f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }}
                      formatter={(value: number) => fmt(value)}
                    />
                    <Bar dataKey="amount" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Aging Table */}
            <Card className="bg-[#13131f] border-white/[0.06]">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Customer Aging Detail</h3>
                  <Button size="sm" className="bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30">
                    <Send className="h-4 w-4 mr-2" /> Send Reminders (90+)
                  </Button>
                </div>
                <ScrollArea className="h-[340px]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        {['Customer', 'Current', '1-30 Days', '31-60 Days', '61-90 Days', '90+ Days', 'Total Overdue'].map(h => (
                          <th key={h} className="text-left py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {AGING_CUSTOMERS.map((c, i) => {
                        const total = c.days1_30 + c.days31_60 + c.days61_90 + c.days90plus;
                        return (
                          <tr key={c.name} className={`${i % 2 === 0 ? 'bg-white/[0.02]' : 'bg-white/[0.01]'} hover:bg-white/[0.04] transition-colors`}>
                            <td className="py-3 px-3 font-medium text-white">{c.name}</td>
                            <td className="py-3 px-3 text-emerald-400">{c.current > 0 ? fmt(c.current) : '—'}</td>
                            <td className="py-3 px-3 text-slate-300">{c.days1_30 > 0 ? fmt(c.days1_30) : '—'}</td>
                            <td className="py-3 px-3 text-amber-400">{c.days31_60 > 0 ? fmt(c.days31_60) : '—'}</td>
                            <td className="py-3 px-3 text-orange-400">{c.days61_90 > 0 ? fmt(c.days61_90) : '—'}</td>
                            <td className="py-3 px-3 text-red-400 font-medium">{c.days90plus > 0 ? fmt(c.days90plus) : '—'}</td>
                            <td className="py-3 px-3 font-bold text-red-400">{total > 0 ? fmt(total) : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </ScrollArea>
                <div className="mt-4 pt-4 border-t border-white/[0.06] flex justify-between items-center">
                  <span className="text-sm text-slate-400">Total Overdue:</span>
                  <span className="text-lg font-bold text-red-400">{fmt(AGING_DATA.reduce((s, d) => s + d.amount, 0))}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Tab 4: Record Payment ── */}
        <TabsContent value="payment">
          <Card className="bg-[#13131f] border-white/[0.06] max-w-2xl mx-auto">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-white mb-5">Record New Payment</h3>

              {paySuccess && (
                <div className="mb-5 flex items-center gap-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 text-emerald-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Payment recorded successfully!</span>
                </div>
              )}

              <form onSubmit={handleRecordPayment} className="space-y-5">
                {/* Customer Selector */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Customer</label>
                  <select
                    value={payCustomerId}
                    onChange={e => setPayCustomerId(e.target.value)}
                    className="w-full rounded-lg bg-[#0a0a1a] border border-white/[0.06] text-slate-100 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    <option value="">Select customer...</option>
                    {CUSTOMERS.map(c => (
                      <option key={c.id} value={c.id}>{c.name} — {c.id}</option>
                    ))}
                  </select>
                </div>

                {/* Balance Display */}
                {payCustomer && (
                  <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider">Current Balance</p>
                      <p className={`text-xl font-bold ${payCustomer.balanceOwed > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {fmt(payCustomer.balanceOwed)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider text-right">Credit Limit</p>
                      <p className="text-sm text-slate-300 text-right">{fmt(payCustomer.creditLimit)}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Amount (TSh)</label>
                    <Input
                      type="number"
                      placeholder="e.g. 50000"
                      value={payAmount}
                      onChange={e => setPayAmount(e.target.value)}
                      className="bg-[#0a0a1a] border-white/[0.06] text-slate-100 placeholder:text-slate-600"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Payment Method</label>
                    <select
                      value={payMethod}
                      onChange={e => setPayMethod(e.target.value)}
                      className="w-full rounded-lg bg-[#0a0a1a] border border-white/[0.06] text-slate-100 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    >
                      <option>Cash</option>
                      <option>Bank Transfer</option>
                      <option>M-Pesa</option>
                      <option>Card</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Payment Date</label>
                  <Input
                    type="date"
                    value={payDate}
                    onChange={e => setPayDate(e.target.value)}
                    className="bg-[#0a0a1a] border-white/[0.06] text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Notes</label>
                  <textarea
                    value={payNotes}
                    onChange={e => setPayNotes(e.target.value)}
                    placeholder="Optional notes..."
                    rows={3}
                    className="w-full rounded-lg bg-[#0a0a1a] border border-white/[0.06] text-slate-100 px-3 py-2.5 text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 h-11 text-sm font-semibold"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Record Payment
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Customer Detail Dialog ── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="bg-[#13131f] border-white/[0.06] text-slate-100 max-w-3xl max-h-[80vh] p-0 gap-0">
          <DialogHeader className="p-6 pb-4 border-b border-white/[0.06]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-blue-500/10 p-2.5">
                  <User className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold text-white">{selectedCustomer?.name}</DialogTitle>
                  <p className="text-xs text-slate-400 mt-0.5">{selectedCustomer?.id} • {selectedCustomer?.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={selectedCustomer?.status || ''} />
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-white" onClick={() => setDetailOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          {selectedCustomer && (
            <div className="p-6 space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3 text-center">
                  <p className="text-xs text-slate-400 mb-1">Credit Limit</p>
                  <p className="text-base font-bold text-white">{fmt(selectedCustomer.creditLimit)}</p>
                </div>
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/15 p-3 text-center">
                  <p className="text-xs text-amber-400/70 mb-1">Balance Owed</p>
                  <p className="text-base font-bold text-amber-400">{fmt(selectedCustomer.balanceOwed)}</p>
                </div>
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/15 p-3 text-center">
                  <p className="text-xs text-emerald-400/70 mb-1">Paid To Date</p>
                  <p className="text-base font-bold text-emerald-400">{fmt(selectedCustomer.paidToDate)}</p>
                </div>
              </div>

              {/* Transaction History */}
              <div>
                <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-blue-400" /> Transaction History
                </h4>
                <ScrollArea className="h-[280px]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        {['Date', 'Invoice #', 'Type', 'Amount', 'Balance', 'Status'].map(h => (
                          <th key={h} className="text-left py-2.5 px-2 text-xs font-semibold text-slate-400 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {customerTxns.map((t, i) => (
                        <tr key={t.id} className={`${i % 2 === 0 ? 'bg-white/[0.02]' : 'bg-white/[0.01]'}`}>
                          <td className="py-2.5 px-2 text-slate-400">{t.date}</td>
                          <td className="py-2.5 px-2 text-blue-400 font-mono text-xs">{t.invoiceNo}</td>
                          <td className="py-2.5 px-2">
                            <span className={`text-xs ${t.type === 'Sale' ? (t.subType === 'Cash Sale' ? 'text-blue-400' : 'text-amber-400') : 'text-emerald-400'}`}>
                              {t.subType}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-slate-200 font-medium">{fmt(t.amount)}</td>
                          <td className="py-2.5 px-2 text-slate-400">{fmt(t.balance)}</td>
                          <td className="py-2.5 px-2"><StatusBadge status={t.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
                {customerTxns.length === 0 && (
                  <p className="text-center text-slate-500 py-8">No transactions found</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
