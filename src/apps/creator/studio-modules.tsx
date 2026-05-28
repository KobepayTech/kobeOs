import { useState } from 'react';
import {
  QrCode, ShieldAlert, TrendingUp, TrendingDown, BadgeCheck,
  Settings, Plus, Search, CheckCircle2, AlertCircle, Clock,
  ChevronRight, Send, X, Check, Users, Shield,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type DisputeStatus = 'open' | 'under_review' | 'resolved_creator' | 'resolved_brand' | 'resolved_split' | 'closed';
type DisputeType = 'kpi_not_met' | 'payment_not_received' | 'content_rejected' | 'fraud' | 'other';

interface DisputeItem {
  id: string; type: DisputeType; status: DisputeStatus;
  description: string; raisedBy: string; againstUser: string;
  campaignTitle?: string; createdAt: string; resolution?: string;
}

interface QrEntry {
  id: string; type: 'customer' | 'supplier'; reference: string;
  shortCode: string; label: string; amount: number; currency: string;
  used: boolean; createdAt: string;
}

interface ExchangeEntry {
  id: string; date: string; currency: string; amountUsd: number;
  customerRate: number; actualRate: number; customerReceives: number;
  actualPaid: number; profitLoss: number; status: 'pending' | 'funded';
  txnRef: string;
}

interface VerifEntry {
  id: string; date: string; country: string; cashierName: string;
  systemAmount: number; cashOnHand: number; bankBalance: number;
  mobileBalance: number; cashPaidOut: number; remainingCash: number;
  remainingPayout: number; notes: string; verifiedBy: string;
}

interface AdminUser {
  id: string; email: string; displayName: string;
  role: string; country?: string; createdAt: string;
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_DISPUTES: DisputeItem[] = [
  { id: 'D001', type: 'kpi_not_met', status: 'open', description: 'Creator did not reach 50K views as agreed.', raisedBy: 'Brand A', againstUser: 'Creator X', campaignTitle: 'Summer Launch 2024', createdAt: '2024-01-15' },
  { id: 'D002', type: 'payment_not_received', status: 'under_review', description: 'Escrow released but funds never arrived.', raisedBy: 'Creator Y', againstUser: 'Brand B', campaignTitle: 'Tech Review Q1', createdAt: '2024-01-12' },
  { id: 'D003', type: 'content_rejected', status: 'resolved_creator', description: 'Brand rejected content without valid reason after 3 revisions.', raisedBy: 'Creator Z', againstUser: 'Brand C', campaignTitle: 'Fashion Week', createdAt: '2024-01-08', resolution: 'Escrow released to creator — brand failed to provide specific feedback within 48h.' },
];

const MOCK_QR: QrEntry[] = [
  { id: 'Q1', type: 'customer', reference: 'TXN-20240115-001', shortCode: 'AB3X7K', label: 'Zhang Wei', amount: 6740, currency: 'CNY', used: false, createdAt: '2024-01-15' },
  { id: 'Q2', type: 'supplier', reference: 'TXN-20240115-001', shortCode: 'PQ9R2M', label: 'Shua Logistics', amount: 6740, currency: 'CNY', used: true, createdAt: '2024-01-15' },
  { id: 'Q3', type: 'customer', reference: 'TXN-20240114-002', shortCode: 'LK5T8N', label: 'Wang Fang', amount: 13440, currency: 'CNY', used: false, createdAt: '2024-01-14' },
];

const MOCK_EXCHANGE: ExchangeEntry[] = [
  { id: 'EX1', date: '2024-01-15', currency: 'CNY', amountUsd: 1000, customerRate: 6.74, actualRate: 6.79, customerReceives: 6740, actualPaid: 6790, profitLoss: 50, status: 'funded', txnRef: 'TXN-20240115-001' },
  { id: 'EX2', date: '2024-01-14', currency: 'CNY', amountUsd: 2000, customerRate: 6.72, actualRate: 6.68, customerReceives: 13440, actualPaid: 13360, profitLoss: -80, status: 'funded', txnRef: 'TXN-20240114-002' },
  { id: 'EX3', date: '2024-01-13', currency: 'TZS', amountUsd: 500, customerRate: 2650, actualRate: 2700, customerReceives: 1325000, actualPaid: 1350000, profitLoss: 25000, status: 'funded', txnRef: 'TXN-20240113-003' },
  { id: 'EX4', date: '2024-01-12', currency: 'TZS', amountUsd: 800, customerRate: 2680, actualRate: 2660, customerReceives: 2144000, actualPaid: 2128000, profitLoss: -16000, status: 'funded', txnRef: 'TXN-20240112-004' },
  { id: 'EX5', date: '2024-01-11', currency: 'INR', amountUsd: 600, customerRate: 83.2, actualRate: 83.8, customerReceives: 49920, actualPaid: 50280, profitLoss: 360, status: 'funded', txnRef: 'TXN-20240111-005' },
  { id: 'EX6', date: '2024-01-10', currency: 'CNY', amountUsd: 1500, customerRate: 6.76, actualRate: 6.71, customerReceives: 10140, actualPaid: 10065, profitLoss: -75, status: 'pending', txnRef: 'TXN-20240110-006' },
];

const MOCK_VERIF: VerifEntry[] = [
  { id: 'V1', date: '2024-01-15', country: 'Tanzania', cashierName: 'Amina Cashier', systemAmount: 15400, cashOnHand: 15200, bankBalance: 8500, mobileBalance: 6700, cashPaidOut: 0, remainingCash: 0, remainingPayout: 0, notes: 'Minor discrepancy — $200 pending M-Pesa confirmation', verifiedBy: 'Manager TZ' },
  { id: 'V2', date: '2024-01-15', country: 'China', cashierName: 'Li Cashier', systemAmount: 45000, cashOnHand: 44800, bankBalance: 0, mobileBalance: 0, cashPaidOut: 38000, remainingCash: 6800, remainingPayout: 7000, notes: 'CNY 200 difference under investigation', verifiedBy: 'Manager China/India' },
];

const MOCK_USERS: AdminUser[] = [
  { id: 'U1', email: 'admin@kobeos.com', displayName: 'Admin', role: 'admin', createdAt: '2024-01-01' },
  { id: 'U2', email: 'amina@kobeos.com', displayName: 'Amina Cashier', role: 'cashier_tz', country: 'Tanzania', createdAt: '2024-01-05' },
  { id: 'U3', email: 'li@kobeos.com', displayName: 'Li Cashier', role: 'cashier_china', country: 'China', createdAt: '2024-01-06' },
  { id: 'U4', email: 'mgr.tz@kobeos.com', displayName: 'Manager TZ', role: 'manager_tz', country: 'Tanzania', createdAt: '2024-01-07' },
  { id: 'U5', email: 'creator1@example.com', displayName: 'Creator One', role: 'creator', createdAt: '2024-01-10' },
  { id: 'U6', email: 'brand1@example.com', displayName: 'Brand One', role: 'brand', createdAt: '2024-01-11' },
];

const DISPUTE_COLOR: Record<DisputeStatus, string> = {
  open: 'bg-red-500/10 text-red-400 border-red-500/20',
  under_review: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  resolved_creator: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  resolved_brand: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  resolved_split: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  closed: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

const ROLE_COLOR: Record<string, string> = {
  admin: 'bg-red-500/10 text-red-400',
  creator: 'bg-violet-500/10 text-violet-400',
  brand: 'bg-blue-500/10 text-blue-400',
  cashier_tz: 'bg-emerald-500/10 text-emerald-400',
  cashier_china: 'bg-cyan-500/10 text-cyan-400',
  cashier_india: 'bg-orange-500/10 text-orange-400',
  manager_tz: 'bg-teal-500/10 text-teal-400',
  manager_abroad: 'bg-sky-500/10 text-sky-400',
  user: 'bg-slate-500/10 text-slate-400',
};

// ── QrPayoutsModule ───────────────────────────────────────────────────────────

export function QrPayoutsModule() {
  const [qrs] = useState<QrEntry[]>(MOCK_QR);
  const [tab, setTab] = useState<'all' | 'customer' | 'supplier'>('all');
  const [lookup, setLookup] = useState('');
  const [lookupResult, setLookupResult] = useState<QrEntry | null | 'not-found'>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  const filtered = tab === 'all' ? qrs : qrs.filter(q => q.type === tab);

  const doLookup = async () => {
    if (lookup.trim().length < 4) return;
    setLookupLoading(true); setLookupResult(null);
    try {
      const res = await fetch(`/api/qr/lookup?code=${encodeURIComponent(lookup.trim().toUpperCase())}`);
      const data = await res.json();
      if (data.found && data.qr) { setLookupResult(data.qr as QrEntry); }
      else { setLookupResult(qrs.find(q => q.shortCode === lookup.trim().toUpperCase()) ?? 'not-found'); }
    } catch {
      setLookupResult(qrs.find(q => q.shortCode === lookup.trim().toUpperCase()) ?? 'not-found');
    }
    setLookupLoading(false);
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      <div><h1 className="text-lg font-bold text-white flex items-center gap-2"><QrCode className="w-5 h-5 text-cyan-400" />QR Payouts</h1><p className="text-xs text-slate-400 mt-0.5">Generate and look up payout QR codes</p></div>
      <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-3">
        <h3 className="text-sm font-semibold text-white">Short Code Lookup</h3>
        <div className="flex gap-2">
          <input value={lookup} onChange={e => setLookup(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && doLookup()} maxLength={8}
            placeholder="Enter 6-char code (e.g. AB3X7K)" className="flex-1 h-9 px-3 rounded-xl text-sm bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/20 outline-none font-mono tracking-widest" />
          <button onClick={doLookup} disabled={lookupLoading || lookup.length < 4} className="h-9 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-700 disabled:opacity-40 text-white text-sm transition-colors">
            {lookupLoading ? <Clock className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </button>
        </div>
        {lookupResult === 'not-found' && <p className="text-sm text-red-400 flex items-center gap-2"><AlertCircle className="w-4 h-4" />No QR code found for "{lookup}"</p>}
        {lookupResult && lookupResult !== 'not-found' && (
          <div className="p-3 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20 space-y-2">
            <p className="text-xs text-emerald-400 font-medium flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />Found</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-slate-400 text-xs">Label</span><p className="text-white">{lookupResult.label}</p></div>
              <div><span className="text-slate-400 text-xs">Amount</span><p className="text-white font-bold">{lookupResult.amount.toLocaleString()} {lookupResult.currency}</p></div>
              <div><span className="text-slate-400 text-xs">Type</span><p className="text-white capitalize">{lookupResult.type}</p></div>
              <div><span className="text-slate-400 text-xs">Status</span><p className={lookupResult.used ? 'text-slate-400' : 'text-emerald-400'}>{lookupResult.used ? 'Used' : 'Active'}</p></div>
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        {(['all', 'customer', 'supplier'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors capitalize ${tab === t ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}>{t}</button>
        ))}
      </div>
      <div className="space-y-2">
        {filtered.map(q => (
          <div key={q.id} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${q.type === 'customer' ? 'bg-cyan-500/10' : 'bg-violet-500/10'}`}>
                <QrCode className={`w-4 h-4 ${q.type === 'customer' ? 'text-cyan-400' : 'text-violet-400'}`} />
              </div>
              <div><p className="text-sm font-medium text-white">{q.label}</p><p className="text-xs text-slate-400">{q.reference} · <span className="font-mono">{q.shortCode}</span></p></div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-white">{q.amount.toLocaleString()} {q.currency}</p>
              <span className={`text-xs ${q.used ? 'text-slate-500' : 'text-emerald-400'}`}>{q.used ? 'Used' : 'Active'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ExchangePLModule ──────────────────────────────────────────────────────────

export function ExchangePLModule() {
  const [entries] = useState<ExchangeEntry[]>(MOCK_EXCHANGE);
  const [currFilter, setCurrFilter] = useState('All');
  const filtered = currFilter === 'All' ? entries : entries.filter(e => e.currency === currFilter);
  const funded = filtered.filter(e => e.status === 'funded');
  const totalPL = funded.reduce((s, e) => s + e.profitLoss, 0);
  const totalVol = funded.reduce((s, e) => s + e.amountUsd, 0);
  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      <div><h1 className="text-lg font-bold text-white flex items-center gap-2"><TrendingUp className="w-5 h-5 text-lime-400" />Exchange P&L</h1><p className="text-xs text-slate-400 mt-0.5">Rate profit/loss per transaction</p></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Volume (USD)', value: `$${totalVol.toLocaleString()}`, color: 'text-cyan-400' },
          { label: 'Net P&L', value: `${totalPL >= 0 ? '+' : ''}${totalPL.toLocaleString()}`, color: totalPL >= 0 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'Profitable', value: String(funded.filter(e => e.profitLoss > 0).length), color: 'text-emerald-400' },
          { label: 'Loss', value: String(funded.filter(e => e.profitLoss < 0).length), color: 'text-red-400' },
        ].map(k => (
          <div key={k.label} className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <p className="text-xs text-slate-400 mb-1">{k.label}</p>
            <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        {['All', 'CNY', 'TZS', 'INR'].map(c => (
          <button key={c} onClick={() => setCurrFilter(c)} className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${currFilter === c ? 'bg-lime-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>{c}</button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl bg-white/[0.03] border border-white/[0.06]">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-white/[0.06]">
            {['Date', 'Ref', 'Curr', 'USD', 'Cust Rate', 'Actual Rate', 'Cust Gets', 'Actual Paid', 'P&L', 'Status'].map(h => (
              <th key={h} className="text-left py-3 px-3 text-xs font-medium text-slate-400 whitespace-nowrap">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.map(e => (
              <tr key={e.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                <td className="py-2 px-3 text-slate-400 whitespace-nowrap">{e.date}</td>
                <td className="py-2 px-3 text-slate-500 font-mono text-xs">{e.txnRef.slice(-8)}</td>
                <td className="py-2 px-3 text-slate-300">{e.currency}</td>
                <td className="py-2 px-3 text-white font-medium">${e.amountUsd.toLocaleString()}</td>
                <td className="py-2 px-3 text-slate-300">{e.customerRate}</td>
                <td className="py-2 px-3 text-slate-300">{e.actualRate}</td>
                <td className="py-2 px-3 text-slate-400">{e.customerReceives.toLocaleString()}</td>
                <td className="py-2 px-3 text-slate-400">{e.actualPaid.toLocaleString()}</td>
                <td className={`py-2 px-3 font-bold ${e.profitLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{e.profitLoss >= 0 ? '+' : ''}{e.profitLoss.toLocaleString()}</td>
                <td className="py-2 px-3"><span className={`text-xs px-2 py-0.5 rounded-lg ${e.status === 'funded' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>{e.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── VerificationModule ────────────────────────────────────────────────────────

export function VerificationModule() {
  const [entries] = useState<VerifEntry[]>(MOCK_VERIF);
  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      <div><h1 className="text-lg font-bold text-white flex items-center gap-2"><BadgeCheck className="w-5 h-5 text-teal-400" />Manager Verification</h1><p className="text-xs text-slate-400 mt-0.5">Daily cash reconciliation by country managers</p></div>
      <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-3">
        <h3 className="text-sm font-semibold text-white">Submit Today's Verification</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {['System Amount', 'Cash on Hand', 'Bank Balance', 'Mobile Money', 'Cash Paid Out', 'Remaining Payout'].map(f => (
            <div key={f}><label className="text-xs text-slate-400 mb-1 block">{f}</label><input type="number" placeholder="0.00" className="w-full h-9 px-3 rounded-xl text-sm bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-slate-600 outline-none" /></div>
          ))}
          <div className="col-span-2 md:col-span-3"><label className="text-xs text-slate-400 mb-1 block">Notes</label><input placeholder="Any discrepancies…" className="w-full h-9 px-3 rounded-xl text-sm bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-slate-600 outline-none" /></div>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors"><BadgeCheck className="w-4 h-4" />Submit Verification</button>
      </div>
      <h3 className="text-sm font-semibold text-white">History</h3>
      <div className="space-y-3">
        {entries.map(v => {
          const diff = v.cashOnHand - v.systemAmount;
          const balanced = Math.abs(diff) < 10;
          return (
            <div key={v.id} className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-3">
              <div className="flex items-start justify-between">
                <div><p className="text-sm font-medium text-white">{v.cashierName} — {v.country}</p><p className="text-xs text-slate-400">{v.date} · Verified by {v.verifiedBy}</p></div>
                <span className={`text-xs px-2 py-0.5 rounded-lg border ${balanced ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>{balanced ? 'Balanced' : `Diff: ${diff > 0 ? '+' : ''}${diff}`}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div><span className="text-slate-500">System</span><p className="text-white font-medium">${v.systemAmount.toLocaleString()}</p></div>
                <div><span className="text-slate-500">Cash on Hand</span><p className="text-white font-medium">${v.cashOnHand.toLocaleString()}</p></div>
                {v.bankBalance > 0 && <div><span className="text-slate-500">Bank</span><p className="text-white font-medium">${v.bankBalance.toLocaleString()}</p></div>}
                {v.mobileBalance > 0 && <div><span className="text-slate-500">Mobile</span><p className="text-white font-medium">${v.mobileBalance.toLocaleString()}</p></div>}
                {v.cashPaidOut > 0 && <div><span className="text-slate-500">Paid Out</span><p className="text-white font-medium">${v.cashPaidOut.toLocaleString()}</p></div>}
                {v.remainingPayout > 0 && <div><span className="text-slate-500">Remaining</span><p className="text-amber-400 font-medium">${v.remainingPayout.toLocaleString()}</p></div>}
              </div>
              {v.notes && <p className="text-xs text-slate-500 italic">{v.notes}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── AdminModule ───────────────────────────────────────────────────────────────

export function AdminModule() {
  const [users, setUsers] = useState<AdminUser[]>(MOCK_USERS);
  const [search, setSearch] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState('');
  const [editCountry, setEditCountry] = useState('');

  const filtered = users.filter(u => u.email.includes(search) || u.displayName.toLowerCase().includes(search.toLowerCase()));

  const saveRole = (id: string) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, role: editRole, country: editCountry || u.country } : u));
    setEditId(null);
  };

  const ALL_ROLES = ['admin', 'user', 'creator', 'brand', 'cashier_tz', 'cashier_china', 'cashier_india', 'manager_tz', 'manager_abroad'];

  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      <div><h1 className="text-lg font-bold text-white flex items-center gap-2"><Settings className="w-5 h-5 text-slate-400" />Admin</h1><p className="text-xs text-slate-400 mt-0.5">Manage users, roles, and platform settings</p></div>
      <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Users className="w-4 h-4 text-blue-400" />Users & Roles</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users…" className="h-8 pl-8 pr-3 rounded-xl text-xs bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-slate-600 outline-none w-48" />
          </div>
        </div>
        <div className="space-y-2">
          {filtered.map(u => (
            <div key={u.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-bold text-white">{u.displayName[0]}</div>
                <div>
                  <p className="text-sm font-medium text-white">{u.displayName}</p>
                  <p className="text-xs text-slate-500">{u.email}{u.country ? ` · ${u.country}` : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {editId === u.id ? (
                  <>
                    <select value={editRole} onChange={e => setEditRole(e.target.value)} className="h-7 px-2 rounded-lg text-xs bg-white/[0.06] border border-white/[0.08] text-white outline-none">
                      {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <input value={editCountry} onChange={e => setEditCountry(e.target.value)} placeholder="Country" className="h-7 px-2 rounded-lg text-xs bg-white/[0.06] border border-white/[0.08] text-white placeholder:text-slate-600 outline-none w-24" />
                    <button onClick={() => saveRole(u.id)} className="w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center transition-colors"><Check className="w-3.5 h-3.5 text-white" /></button>
                    <button onClick={() => setEditId(null)} className="w-7 h-7 rounded-lg bg-white/[0.06] hover:bg-white/[0.10] flex items-center justify-center transition-colors"><X className="w-3.5 h-3.5 text-slate-400" /></button>
                  </>
                ) : (
                  <>
                    <span className={`text-xs px-2 py-0.5 rounded-lg ${ROLE_COLOR[u.role] ?? 'bg-slate-500/10 text-slate-400'}`}>{u.role}</span>
                    <button onClick={() => { setEditId(u.id); setEditRole(u.role); setEditCountry(u.country ?? ''); }} className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition-colors">
                      <Shield className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── DisputesModule ────────────────────────────────────────────────────────────

export function DisputesModule() {
  const [disputes, setDisputes] = useState<DisputeItem[]>(MOCK_DISPUTES);
  const [filter, setFilter] = useState<'all' | DisputeStatus>('all');
  const [selected, setSelected] = useState<DisputeItem | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState<DisputeType>('kpi_not_met');
  const [newAgainst, setNewAgainst] = useState('');

  const filtered = filter === 'all' ? disputes : disputes.filter(d => d.status === filter);

  const submit = () => {
    if (!newDesc.trim() || !newAgainst.trim()) return;
    setDisputes(p => [{ id: `D${Date.now()}`, type: newType, status: 'open', description: newDesc.trim(), raisedBy: 'You', againstUser: newAgainst.trim(), createdAt: new Date().toISOString().slice(0, 10) }, ...p]);
    setNewDesc(''); setNewAgainst(''); setShowNew(false);
  };

  if (selected) return (
    <div className="h-full overflow-y-auto p-6 space-y-4">
      <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
        <ChevronRight className="w-4 h-4 rotate-180" />Back to disputes
      </button>
      <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-white">{selected.campaignTitle ?? 'Dispute'}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{selected.raisedBy} vs {selected.againstUser} · {selected.createdAt}</p>
          </div>
          <span className={`text-xs px-2 py-1 rounded-lg border ${DISPUTE_COLOR[selected.status]}`}>{selected.status.replace(/_/g, ' ')}</span>
        </div>
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
          <p className="text-xs text-slate-400 mb-1 uppercase tracking-wider">Description</p>
          <p className="text-sm text-white/80">{selected.description}</p>
        </div>
        {selected.resolution && (
          <div className="p-3 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20">
            <p className="text-xs text-emerald-400 mb-1 uppercase tracking-wider">Resolution</p>
            <p className="text-sm text-white/80">{selected.resolution}</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-lg font-bold text-white flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-red-400" />Disputes</h1><p className="text-xs text-slate-400 mt-0.5">Raise and track campaign disputes</p></div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"><Plus className="w-4 h-4" />New Dispute</button>
      </div>
      {showNew && (
        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-3">
          <h3 className="text-sm font-semibold text-white">Open a Dispute</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Type</label>
              <select value={newType} onChange={e => setNewType(e.target.value as DisputeType)} className="w-full h-9 px-3 rounded-xl text-sm bg-white/[0.04] border border-white/[0.08] text-white outline-none">
                {(['kpi_not_met', 'payment_not_received', 'content_rejected', 'fraud', 'other'] as DisputeType[]).map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Against</label>
              <input value={newAgainst} onChange={e => setNewAgainst(e.target.value)} placeholder="Brand or creator name" className="w-full h-9 px-3 rounded-xl text-sm bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/20 outline-none" />
            </div>
          </div>
          <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={3} placeholder="Describe the issue clearly…" className="w-full px-3 py-2 rounded-xl text-sm bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/20 outline-none resize-none" />
          <div className="flex gap-2">
            <button onClick={submit} className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors">Submit</button>
            <button onClick={() => setShowNew(false)} className="px-4 py-2 rounded-xl bg-white/[0.04] text-slate-400 text-sm hover:bg-white/[0.08] transition-colors">Cancel</button>
          </div>
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'open', 'under_review', 'resolved_creator', 'resolved_brand', 'closed'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${filter === s ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}>{s === 'all' ? 'All' : s.replace(/_/g, ' ')}</button>
        ))}
      </div>
      <div className="space-y-3">
        {filtered.map(d => (
          <button key={d.id} onClick={() => setSelected(d)} className="w-full text-left p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors space-y-2">
            <div className="flex items-start justify-between">
              <div><p className="text-sm font-semibold text-white">{d.campaignTitle ?? d.type.replace(/_/g, ' ')}</p><p className="text-xs text-slate-400">{d.raisedBy} vs {d.againstUser} · {d.createdAt}</p></div>
              <span className={`text-xs px-2 py-0.5 rounded-lg border shrink-0 ${DISPUTE_COLOR[d.status]}`}>{d.status.replace(/_/g, ' ')}</span>
            </div>
            <p className="text-xs text-slate-500 line-clamp-2">{d.description}</p>
          </button>
        ))}
        {filtered.length === 0 && <p className="text-center text-slate-500 text-sm py-8">No disputes found</p>}
      </div>
    </div>
  );
}
