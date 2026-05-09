import { useState, useMemo } from 'react';
import {
  BookOpen, Plus, Trash2, Save, AlertCircle, CheckCircle, Search,
  ArrowRightLeft, Scale, FileText,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

const tzs = (n: number) => `TZS ${n.toLocaleString()}`;

type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';

const accounts = [
  { code: '1000', name: 'Cash on Hand', type: 'Asset' as AccountType, balance: 1250000 },
  { code: '1010', name: 'Bank Account - CRDB', type: 'Asset' as AccountType, balance: 3200000 },
  { code: '1020', name: 'Bank Account - NMB', type: 'Asset' as AccountType, balance: 1800000 },
  { code: '1100', name: 'Accounts Receivable', type: 'Asset' as AccountType, balance: 950000 },
  { code: '1200', name: 'Inventory', type: 'Asset' as AccountType, balance: 4200000 },
  { code: '1300', name: 'Prepaid Expenses', type: 'Asset' as AccountType, balance: 120000 },
  { code: '1500', name: 'Equipment', type: 'Asset' as AccountType, balance: 2800000 },
  { code: '1600', name: 'Accumulated Depreciation', type: 'Asset' as AccountType, balance: -800000 },
  { code: '2000', name: 'Accounts Payable', type: 'Liability' as AccountType, balance: 1350000 },
  { code: '2100', name: 'Wages Payable', type: 'Liability' as AccountType, balance: 320000 },
  { code: '2200', name: 'VAT Payable', type: 'Liability' as AccountType, balance: 480000 },
  { code: '2300', name: 'Loans Payable', type: 'Liability' as AccountType, balance: 2500000 },
  { code: '3000', name: 'Owner Capital', type: 'Equity' as AccountType, balance: 5000000 },
  { code: '3100', name: 'Retained Earnings', type: 'Equity' as AccountType, balance: 2100000 },
  { code: '4000', name: 'Sales Revenue', type: 'Revenue' as AccountType, balance: 8900000 },
  { code: '4100', name: 'Service Revenue', type: 'Revenue' as AccountType, balance: 1200000 },
  { code: '5000', name: 'Cost of Goods Sold', type: 'Expense' as AccountType, balance: 4200000 },
  { code: '5100', name: 'Rent Expense', type: 'Expense' as AccountType, balance: 600000 },
  { code: '5200', name: 'Wages Expense', type: 'Expense' as AccountType, balance: 1800000 },
  { code: '5300', name: 'Utilities Expense', type: 'Expense' as AccountType, balance: 240000 },
];

const transactions = [
  { id: 'TXN-0001', date: '2026-05-01', account: '1000', debit: 500000, credit: 0, description: 'Cash deposit from sales' },
  { id: 'TXN-0002', date: '2026-05-01', account: '4000', debit: 0, credit: 500000, description: 'Cash deposit from sales' },
  { id: 'TXN-0003', date: '2026-05-02', account: '1200', debit: 850000, credit: 0, description: 'Inventory purchase' },
  { id: 'TXN-0004', date: '2026-05-02', account: '2000', debit: 0, credit: 850000, description: 'Inventory purchase on credit' },
  { id: 'TXN-0005', date: '2026-05-03', account: '5200', debit: 450000, credit: 0, description: 'Monthly payroll' },
  { id: 'TXN-0006', date: '2026-05-03', account: '1010', debit: 0, credit: 450000, description: 'Monthly payroll' },
  { id: 'TXN-0007', date: '2026-05-04', account: '5100', debit: 200000, credit: 0, description: 'Warehouse rent' },
  { id: 'TXN-0008', date: '2026-05-04', account: '1010', debit: 0, credit: 200000, description: 'Warehouse rent' },
  { id: 'TXN-0009', date: '2026-05-05', account: '1100', debit: 320000, credit: 0, description: 'Invoice #1042' },
  { id: 'TXN-0010', date: '2026-05-05', account: '4000', debit: 0, credit: 320000, description: 'Invoice #1042' },
  { id: 'TXN-0011', date: '2026-05-06', account: '5300', debit: 60000, credit: 0, description: 'Electricity bill' },
  { id: 'TXN-0012', date: '2026-05-06', account: '1010', debit: 0, credit: 60000, description: 'Electricity bill' },
  { id: 'TXN-0013', date: '2026-05-07', account: '5000', debit: 180000, credit: 0, description: 'COGS adjustment' },
  { id: 'TXN-0014', date: '2026-05-07', account: '1200', debit: 0, credit: 180000, description: 'COGS adjustment' },
  { id: 'TXN-0015', date: '2026-05-08', account: '1010', debit: 125000, credit: 0, description: 'M-Pesa settlement' },
  { id: 'TXN-0016', date: '2026-05-08', account: '4000', debit: 0, credit: 125000, description: 'M-Pesa settlement' },
  { id: 'TXN-0017', date: '2026-05-08', account: '2100', debit: 320000, credit: 0, description: 'Wages payment' },
  { id: 'TXN-0018', date: '2026-05-08', account: '1010', debit: 0, credit: 320000, description: 'Wages payment' },
  { id: 'TXN-0019', date: '2026-05-08', account: '4100', debit: 0, credit: 150000, description: 'Service fee received' },
  { id: 'TXN-0020', date: '2026-05-08', account: '1000', debit: 150000, credit: 0, description: 'Service fee received' },
];

const accountColor = (type: string) => {
  const map: Record<string, string> = {
    Asset: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    Liability: 'bg-red-500/10 text-red-400 border-red-500/20',
    Equity: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    Revenue: 'bg-green-500/10 text-green-400 border-green-500/20',
    Expense: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  };
  return map[type] || 'bg-slate-500/10 text-slate-400';
};

export default function ERPAccounting() {
  const [tab, setTab] = useState('coa');
  const [search, setSearch] = useState('');
  const [journalModalOpen, setJournalModalOpen] = useState(false);
  const [journalDate, setJournalDate] = useState('2026-05-08');
  const [journalDesc, setJournalDesc] = useState('');
  const [journalLines, setJournalLines] = useState([{ account: '', debit: 0, credit: 0 }]);
  const [journalEntries, setJournalEntries] = useState(transactions);

  const filteredAccounts = useMemo(() => {
    return accounts.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()) || a.code.includes(search));
  }, [search]);

  const totalDebits = journalLines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredits = journalLines.reduce((s, l) => s + (l.credit || 0), 0);
  const balanced = totalDebits === totalCredits && totalDebits > 0;

  const trialBalance = useMemo(() => {
    const map = new Map<string, { code: string; name: string; type: string; debit: number; credit: number }>();
    accounts.forEach((a) => {
      map.set(a.code, { code: a.code, name: a.name, type: a.type, debit: 0, credit: 0 });
    });
    journalEntries.forEach((t) => {
      const entry = map.get(t.account);
      if (entry) {
        entry.debit += t.debit;
        entry.credit += t.credit;
      }
    });
    return Array.from(map.values()).filter((e) => e.debit > 0 || e.credit > 0);
  }, [journalEntries]);

  const tbTotalDebit = trialBalance.reduce((s, e) => s + e.debit, 0);
  const tbTotalCredit = trialBalance.reduce((s, e) => s + e.credit, 0);

  const addJournalLine = () => {
    setJournalLines((prev) => [...prev, { account: '', debit: 0, credit: 0 }]);
  };

  const removeJournalLine = (idx: number) => {
    setJournalLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateJournalLine = (idx: number, field: string, value: unknown) => {
    setJournalLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  };

  const postJournal = () => {
    if (!balanced) return;
    const baseId = `TXN-${String(journalEntries.length + 1).padStart(4, '0')}`;
    const newEntries = journalLines.map((l, i) => ({
      id: `${baseId}-${i}`,
      date: journalDate,
      account: l.account,
      debit: l.debit,
      credit: l.credit,
      description: journalDesc,
    }));
    setJournalEntries((prev) => [...prev, ...newEntries]);
    setJournalModalOpen(false);
    setJournalLines([{ account: '', debit: 0, credit: 0 }]);
    setJournalDesc('');
  };

  return (
    <div className="h-full bg-slate-950 text-slate-100 overflow-auto">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-400" />
            <h1 className="text-lg font-semibold">Accounting</h1>
          </div>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="bg-slate-900 border border-slate-800 h-9">
              <TabsTrigger value="coa" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <FileText className="w-3 h-3 mr-1" /> Chart of Accounts
              </TabsTrigger>
              <TabsTrigger value="gl" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <ArrowRightLeft className="w-3 h-3 mr-1" /> General Ledger
              </TabsTrigger>
              <TabsTrigger value="journal" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <Plus className="w-3 h-3 mr-1" /> Journal Entry
              </TabsTrigger>
              <TabsTrigger value="tb" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <Scale className="w-3 h-3 mr-1" /> Trial Balance
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {tab === 'coa' && (
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Chart of Accounts</CardTitle>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search accounts..." className="pl-8 h-8 w-56 bg-slate-900 border-slate-700 text-xs" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead className="text-slate-400 text-xs">Code</TableHead>
                      <TableHead className="text-slate-400 text-xs">Account Name</TableHead>
                      <TableHead className="text-slate-400 text-xs">Type</TableHead>
                      <TableHead className="text-slate-400 text-xs text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAccounts.map((a) => (
                      <TableRow key={a.code} className="border-slate-800 hover:bg-slate-800/40">
                        <TableCell className="text-xs font-mono text-slate-300">{a.code}</TableCell>
                        <TableCell className="text-xs font-medium text-slate-200">{a.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={accountColor(a.type)}>
                            {a.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-right font-medium">{tzs(a.balance)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {tab === 'gl' && (
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">General Ledger</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead className="text-slate-400 text-xs">ID</TableHead>
                      <TableHead className="text-slate-400 text-xs">Date</TableHead>
                      <TableHead className="text-slate-400 text-xs">Account</TableHead>
                      <TableHead className="text-slate-400 text-xs">Description</TableHead>
                      <TableHead className="text-slate-400 text-xs text-right">Debit</TableHead>
                      <TableHead className="text-slate-400 text-xs text-right">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {journalEntries.map((t) => {
                      const acc = accounts.find((a) => a.code === t.account);
                      return (
                        <TableRow key={t.id} className="border-slate-800 hover:bg-slate-800/40">
                          <TableCell className="text-xs font-mono text-slate-300">{t.id}</TableCell>
                          <TableCell className="text-xs text-slate-400">{t.date}</TableCell>
                          <TableCell className="text-xs text-slate-300">{acc?.name || t.account}</TableCell>
                          <TableCell className="text-xs text-slate-400">{t.description}</TableCell>
                          <TableCell className="text-xs text-right text-slate-300">{t.debit > 0 ? tzs(t.debit) : ''}</TableCell>
                          <TableCell className="text-xs text-right text-slate-300">{t.credit > 0 ? tzs(t.credit) : ''}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {tab === 'journal' && (
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader className="pb-2 flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Journal Entries</CardTitle>
              <Button size="sm" onClick={() => setJournalModalOpen(true)} className="bg-blue-600 hover:bg-blue-500 text-white">
                <Plus className="w-3 h-3 mr-1" /> New Entry
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[450px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead className="text-slate-400 text-xs">ID</TableHead>
                      <TableHead className="text-slate-400 text-xs">Date</TableHead>
                      <TableHead className="text-slate-400 text-xs">Description</TableHead>
                      <TableHead className="text-slate-400 text-xs text-right">Debit</TableHead>
                      <TableHead className="text-slate-400 text-xs text-right">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {journalEntries.map((t) => (
                      <TableRow key={t.id} className="border-slate-800 hover:bg-slate-800/40">
                        <TableCell className="text-xs font-mono text-slate-300">{t.id}</TableCell>
                        <TableCell className="text-xs text-slate-400">{t.date}</TableCell>
                        <TableCell className="text-xs text-slate-300">{t.description}</TableCell>
                        <TableCell className="text-xs text-right text-slate-300">{t.debit > 0 ? tzs(t.debit) : ''}</TableCell>
                        <TableCell className="text-xs text-right text-slate-300">{t.credit > 0 ? tzs(t.credit) : ''}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {tab === 'tb' && (
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Trial Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[450px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead className="text-slate-400 text-xs">Code</TableHead>
                      <TableHead className="text-slate-400 text-xs">Account</TableHead>
                      <TableHead className="text-slate-400 text-xs">Type</TableHead>
                      <TableHead className="text-slate-400 text-xs text-right">Debit</TableHead>
                      <TableHead className="text-slate-400 text-xs text-right">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trialBalance.map((e) => (
                      <TableRow key={e.code} className="border-slate-800 hover:bg-slate-800/40">
                        <TableCell className="text-xs font-mono text-slate-300">{e.code}</TableCell>
                        <TableCell className="text-xs font-medium text-slate-200">{e.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={accountColor(e.type)}>
                            {e.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-right text-slate-300">{e.debit > 0 ? tzs(e.debit) : ''}</TableCell>
                        <TableCell className="text-xs text-right text-slate-300">{e.credit > 0 ? tzs(e.credit) : ''}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-slate-600 bg-slate-800/40">
                      <TableCell colSpan={3} className="text-xs font-bold text-slate-200">Total</TableCell>
                      <TableCell className="text-xs text-right font-bold text-slate-200">{tzs(tbTotalDebit)}</TableCell>
                      <TableCell className="text-xs text-right font-bold text-slate-200">{tzs(tbTotalCredit)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </ScrollArea>
              <div className="mt-2 flex items-center gap-2 text-xs">
                {tbTotalDebit === tbTotalCredit ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-green-400">Balanced</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-red-400" />
                    <span className="text-red-400">Unbalanced: Difference {tzs(Math.abs(tbTotalDebit - tbTotalCredit))}</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={journalModalOpen} onOpenChange={setJournalModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">New Journal Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Date</label>
                <Input type="date" value={journalDate} onChange={(e) => setJournalDate(e.target.value)} className="bg-slate-800 border-slate-700 text-slate-100" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Reference</label>
                <Input value="JE-2026-0051" disabled className="bg-slate-800 border-slate-700 text-slate-400" />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Description</label>
              <Textarea value={journalDesc} onChange={(e) => setJournalDesc(e.target.value)} className="bg-slate-800 border-slate-700 text-slate-100 text-xs" rows={2} />
            </div>
            <div className="space-y-2">
              {journalLines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5">
                    <select
                      value={line.account}
                      onChange={(e) => updateJournalLine(idx, 'account', e.target.value)}
                      className="w-full h-8 px-2 rounded-md bg-slate-800 border border-slate-700 text-xs text-slate-300"
                    >
                      <option value="">Select account</option>
                      {accounts.map((a) => <option key={a.code} value={a.code}>{a.code} - {a.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <Input type="number" placeholder="Debit" value={line.debit || ''} onChange={(e) => updateJournalLine(idx, 'debit', Number(e.target.value))} className="h-8 bg-slate-800 border-slate-700 text-xs" />
                  </div>
                  <div className="col-span-3">
                    <Input type="number" placeholder="Credit" value={line.credit || ''} onChange={(e) => updateJournalLine(idx, 'credit', Number(e.target.value))} className="h-8 bg-slate-800 border-slate-700 text-xs" />
                  </div>
                  <div className="col-span-1">
                    <button onClick={() => removeJournalLine(idx)} className="text-slate-500 hover:text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              <Button variant="outline" onClick={addJournalLine} className="w-full border-slate-700 text-slate-300 hover:bg-slate-800 text-xs">
                <Plus className="w-3 h-3 mr-1" /> Add Line
              </Button>
            </div>
            <div className="flex justify-between text-xs pt-2 border-t border-slate-800">
              <span className={balanced ? 'text-green-400' : 'text-red-400'}>
                {balanced ? 'Balanced' : `Diff: ${tzs(Math.abs(totalDebits - totalCredits))}`}
              </span>
              <span className="text-slate-400">Dr {tzs(totalDebits)} / Cr {tzs(totalCredits)}</span>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setJournalModalOpen(false)} className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800">
                Cancel
              </Button>
              <Button onClick={postJournal} disabled={!balanced} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white">
                <Save className="w-3 h-3 mr-1" /> Post Entry
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
