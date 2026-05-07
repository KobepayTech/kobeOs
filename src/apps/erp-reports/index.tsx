import { useState } from 'react';
import {
  BarChart3, TrendingUp, TrendingDown, FileText, Download, Printer,
  DollarSign, ArrowUpRight, ArrowDownRight, Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const tzs = (n: number) => `TZS ${n.toLocaleString()}`;

const revenueTrend = [
  { month: 'Jan', revenue: 3200000, expenses: 2100000 },
  { month: 'Feb', revenue: 3800000, expenses: 2300000 },
  { month: 'Mar', revenue: 4100000, expenses: 2500000 },
  { month: 'Apr', revenue: 3600000, expenses: 2400000 },
  { month: 'May', revenue: 5200000, expenses: 2800000 },
  { month: 'Jun', revenue: 4800000, expenses: 3100000 },
];

const expenseBreakdown = [
  { name: 'COGS', value: 4200000, color: '#3b82f6' },
  { name: 'Rent', value: 600000, color: '#8b5cf6' },
  { name: 'Wages', value: 1800000, color: '#f59e0b' },
  { name: 'Utilities', value: 240000, color: '#ef4444' },
  { name: 'Marketing', value: 320000, color: '#10b981' },
  { name: 'Other', value: 150000, color: '#64748b' },
];

const plData = [
  { line: 'Revenue', jan: 3200000, feb: 3800000, mar: 4100000, apr: 3600000, may: 5200000, jun: 4800000 },
  { line: 'COGS', jan: 1800000, feb: 2100000, mar: 2300000, apr: 2000000, may: 2800000, jun: 2600000 },
  { line: 'Gross Profit', jan: 1400000, feb: 1700000, mar: 1800000, apr: 1600000, may: 2400000, jun: 2200000 },
  { line: 'Operating Expenses', jan: 450000, feb: 520000, mar: 580000, apr: 550000, may: 620000, jun: 600000 },
  { line: 'Net Income', jan: 950000, feb: 1180000, mar: 1220000, apr: 1050000, may: 1780000, jun: 1600000 },
];

const balanceSheet = [
  { section: 'ASSETS', items: [
    { label: 'Cash & Equivalents', value: 6250000 },
    { label: 'Accounts Receivable', value: 950000 },
    { label: 'Inventory', value: 4200000 },
    { label: 'Prepaid Expenses', value: 120000 },
    { label: 'Equipment (net)', value: 2000000 },
  ], total: 13520000 },
  { section: 'LIABILITIES', items: [
    { label: 'Accounts Payable', value: 1350000 },
    { label: 'Wages Payable', value: 320000 },
    { label: 'VAT Payable', value: 480000 },
    { label: 'Loans Payable', value: 2500000 },
  ], total: 4650000 },
  { section: 'EQUITY', items: [
    { label: 'Owner Capital', value: 5000000 },
    { label: 'Retained Earnings', value: 2100000 },
    { label: 'Current Year Earnings', value: 1770000 },
  ], total: 8870000 },
];

export default function ERPReports() {
  const [tab, setTab] = useState('overview');
  const [dateRange] = useState('2026-01-01 - 2026-06-30');

  const totalRevenue = revenueTrend.reduce((s, d) => s + d.revenue, 0);
  const totalExpenses = revenueTrend.reduce((s, d) => s + d.expenses, 0);
  const netIncome = totalRevenue - totalExpenses;

  const exportCsv = () => {
    const rows = plData.map((r) => [r.line, r.jan, r.feb, r.mar, r.apr, r.may, r.jun].join(','));
    const csv = ['Line,Jan,Feb,Mar,Apr,May,Jun', ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kobe-pl-report-2026.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full bg-slate-950 text-slate-100 overflow-auto">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            <h1 className="text-lg font-semibold">Reports</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-900 border border-slate-800 text-xs text-slate-400">
              <Calendar className="w-3 h-3" />
              <span>{dateRange}</span>
            </div>
            <Button variant="outline" size="sm" onClick={exportCsv} className="h-7 border-slate-700 text-slate-300 hover:bg-slate-800 text-xs">
              <Download className="w-3 h-3 mr-1" /> CSV
            </Button>
            <Button variant="outline" size="sm" className="h-7 border-slate-700 text-slate-300 hover:bg-slate-800 text-xs">
              <Printer className="w-3 h-3 mr-1" /> Print
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-slate-900 border border-slate-800 h-9">
            <TabsTrigger value="overview" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <BarChart3 className="w-3 h-3 mr-1" /> Overview
            </TabsTrigger>
            <TabsTrigger value="pl" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <FileText className="w-3 h-3 mr-1" /> P&L
            </TabsTrigger>
            <TabsTrigger value="bs" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <DollarSign className="w-3 h-3 mr-1" /> Balance Sheet
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === 'overview' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="bg-slate-900/60 border-slate-800">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <TrendingUp className="w-4 h-4 text-blue-400" />
                    <span className="text-xs text-green-400 flex items-center gap-0.5"><ArrowUpRight className="w-3 h-3" />+18%</span>
                  </div>
                  <div className="text-lg font-bold">{tzs(totalRevenue)}</div>
                  <div className="text-xs text-slate-400">Total Revenue</div>
                </CardContent>
              </Card>
              <Card className="bg-slate-900/60 border-slate-800">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <TrendingDown className="w-4 h-4 text-red-400" />
                    <span className="text-xs text-red-400 flex items-center gap-0.5"><ArrowDownRight className="w-3 h-3" />+12%</span>
                  </div>
                  <div className="text-lg font-bold">{tzs(totalExpenses)}</div>
                  <div className="text-xs text-slate-400">Total Expenses</div>
                </CardContent>
              </Card>
              <Card className="bg-slate-900/60 border-slate-800">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <DollarSign className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-green-400 flex items-center gap-0.5"><ArrowUpRight className="w-3 h-3" />+24%</span>
                  </div>
                  <div className="text-lg font-bold text-green-400">{tzs(netIncome)}</div>
                  <div className="text-xs text-slate-400">Net Income</div>
                </CardContent>
              </Card>
              <Card className="bg-slate-900/60 border-slate-800">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <BarChart3 className="w-4 h-4 text-purple-400" />
                    <span className="text-xs text-slate-400">YTD</span>
                  </div>
                  <div className="text-lg font-bold">28.4%</div>
                  <div className="text-xs text-slate-400">Net Margin</div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <Card className="bg-slate-900/60 border-slate-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Revenue vs Expenses</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={revenueTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `${v / 1000000}M`} />
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }} formatter={(value: number) => tzs(value)} />
                      <Legend />
                      <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={false} name="Revenue" />
                      <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} dot={false} name="Expenses" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card className="bg-slate-900/60 border-slate-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Expense Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={expenseBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="value">
                        {expenseBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }} formatter={(value: number) => tzs(value)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {tab === 'pl' && (
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Profit & Loss Statement — H1 2026</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead className="text-slate-400 text-xs">Line Item</TableHead>
                      <TableHead className="text-slate-400 text-xs text-right">Jan</TableHead>
                      <TableHead className="text-slate-400 text-xs text-right">Feb</TableHead>
                      <TableHead className="text-slate-400 text-xs text-right">Mar</TableHead>
                      <TableHead className="text-slate-400 text-xs text-right">Apr</TableHead>
                      <TableHead className="text-slate-400 text-xs text-right">May</TableHead>
                      <TableHead className="text-slate-400 text-xs text-right">Jun</TableHead>
                      <TableHead className="text-slate-400 text-xs text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plData.map((row) => {
                      const total = row.jan + row.feb + row.mar + row.apr + row.may + row.jun;
                      const isBold = row.line === 'Net Income' || row.line === 'Gross Profit';
                      const isHeader = row.line === 'Revenue';
                      return (
                        <TableRow key={row.line} className={`border-slate-800 hover:bg-slate-800/40 ${isHeader ? 'bg-slate-800/20' : ''}`}>
                          <TableCell className={`text-xs ${isBold ? 'font-bold text-slate-200' : 'text-slate-300'}`}>
                            {row.line}
                          </TableCell>
                          {[row.jan, row.feb, row.mar, row.apr, row.may, row.jun].map((v, i) => (
                            <TableCell key={i} className={`text-xs text-right ${isBold ? 'font-bold text-slate-200' : 'text-slate-400'}`}>
                              {tzs(v)}
                            </TableCell>
                          ))}
                          <TableCell className={`text-xs text-right ${isBold ? 'font-bold text-green-400' : 'text-slate-300'}`}>
                            {tzs(total)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="border-slate-600 bg-slate-800/40">
                      <TableCell className="text-xs font-bold text-slate-200">Net Margin</TableCell>
                      {['29.7%', '31.1%', '29.8%', '29.2%', '34.2%', '33.3%'].map((v, i) => (
                        <TableCell key={i} className="text-xs text-right font-bold text-slate-200">{v}</TableCell>
                      ))}
                      <TableCell className="text-xs text-right font-bold text-green-400">31.2%</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {tab === 'bs' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {balanceSheet.map((section) => (
              <Card key={section.section} className="bg-slate-900/60 border-slate-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{section.section}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {section.items.map((item) => (
                      <div key={item.label} className="flex justify-between text-xs">
                        <span className="text-slate-300">{item.label}</span>
                        <span className="font-medium text-slate-200">{tzs(item.value)}</span>
                      </div>
                    ))}
                    <div className="border-t border-slate-700 pt-2 flex justify-between text-sm font-bold">
                      <span className="text-slate-200">Total {section.section}</span>
                      <span className="text-blue-400">{tzs(section.total)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Card className="lg:col-span-3 bg-slate-900/60 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">Balanced</Badge>
                    <span className="text-slate-400">Assets = Liabilities + Equity</span>
                  </div>
                  <div className="font-bold text-slate-200">{tzs(balanceSheet[0].total)} = {tzs(balanceSheet[1].total)} + {tzs(balanceSheet[2].total)}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
