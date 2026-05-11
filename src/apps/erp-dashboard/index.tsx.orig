import { useState } from 'react';
import {
  TrendingUp, TrendingDown, ShoppingCart, Users, Package, DollarSign,
  Receipt, AlertTriangle, Truck, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const tzs = (n: number) => `TZS ${n.toLocaleString()}`;

const kpis = [
  { label: 'Total Sales', value: 'TZS 4,230,000', change: '+12.5%', up: true, icon: DollarSign },
  { label: 'Orders Today', value: '48', change: '+8.2%', up: true, icon: ShoppingCart },
  { label: 'Customers', value: '1,245', change: '+3.1%', up: true, icon: Users },
  { label: 'Products', value: '312', change: '-1.4%', up: false, icon: Package },
  { label: 'Revenue', value: 'TZS 12.8M', change: '+15.3%', up: true, icon: TrendingUp },
  { label: 'Expenses', value: 'TZS 3.4M', change: '-2.1%', up: true, icon: TrendingDown },
];

const revenueData = [
  { day: 'Mon', revenue: 580000, expenses: 320000 },
  { day: 'Tue', revenue: 720000, expenses: 410000 },
  { day: 'Wed', revenue: 610000, expenses: 350000 },
  { day: 'Thu', revenue: 890000, expenses: 420000 },
  { day: 'Fri', revenue: 950000, expenses: 480000 },
  { day: 'Sat', revenue: 740000, expenses: 390000 },
  { day: 'Sun', revenue: 540000, expenses: 310000 },
];

const categoryData = [
  { name: 'Electronics', sales: 2100000 },
  { name: 'Clothing', sales: 1450000 },
  { name: 'Food', sales: 980000 },
  { name: 'Household', sales: 760000 },
  { name: 'Beauty', sales: 520000 },
];

const statusData = [
  { name: 'Completed', value: 342, color: '#22c55e' },
  { name: 'Pending', value: 56, color: '#eab308' },
  { name: 'Processing', value: 28, color: '#3b82f6' },
  { name: 'Cancelled', value: 12, color: '#ef4444' },
];

const recentOrders = [
  { id: 'ORD-2026-1042', customer: 'Juma Bakari', amount: 125000, status: 'Completed', date: '2026-05-08' },
  { id: 'ORD-2026-1041', customer: 'Asha Mwangi', amount: 45000, status: 'Processing', date: '2026-05-08' },
  { id: 'ORD-2026-1040', customer: 'David Ochieng', amount: 230000, status: 'Pending', date: '2026-05-07' },
  { id: 'ORD-2026-1039', customer: 'Fatuma Said', amount: 78000, status: 'Completed', date: '2026-05-07' },
  { id: 'ORD-2026-1038', customer: 'Peter Njoroge', amount: 156000, status: 'Completed', date: '2026-05-07' },
  { id: 'ORD-2026-1037', customer: 'Grace Wambui', amount: 34000, status: 'Cancelled', date: '2026-05-06' },
  { id: 'ORD-2026-1036', customer: 'Omari Juma', amount: 210000, status: 'Completed', date: '2026-05-06' },
];

const lowStock = [
  { sku: 'ELEC-042', name: 'Samsung Galaxy A14', qty: 3, threshold: 10 },
  { sku: 'CLTH-018', name: "Men's Cotton T-Shirt L", qty: 5, threshold: 20 },
  { sku: 'FOOD-033', name: 'Mama Ntilie Rice 5kg', qty: 4, threshold: 15 },
  { sku: 'HSHD-009', name: 'Borehole Pump 1HP', qty: 2, threshold: 5 },
];

const fulfillmentQueue = [
  { id: 'FL-1021', items: 4, priority: 'High', status: 'Picking', assignee: 'John D.' },
  { id: 'FL-1022', items: 12, priority: 'Normal', status: 'Pending', assignee: 'Unassigned' },
  { id: 'FL-1023', items: 2, priority: 'High', status: 'Ready', assignee: 'Mary K.' },
  { id: 'FL-1024', items: 7, priority: 'Normal', status: 'Picking', assignee: 'John D.' },
  { id: 'FL-1025', items: 3, priority: 'Low', status: 'Shipped', assignee: 'Mary K.' },
];

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    Completed: 'bg-green-500/10 text-green-400 border-green-500/20',
    Processing: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    Pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    Cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
    Picking: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    Ready: 'bg-green-500/10 text-green-400 border-green-500/20',
    Shipped: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    High: 'bg-red-500/10 text-red-400 border-red-500/20',
    Normal: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    Low: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  };
  return map[status] || 'bg-slate-500/10 text-slate-400';
};

export default function ERPDashboard() {
  const [period, setPeriod] = useState('7d');

  const periodBtn = (p: string, label: string) => (
    <button
      key={p}
      onClick={() => setPeriod(p)}
      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
        period === p ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="h-full bg-slate-950 text-slate-100 overflow-auto">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">ERP Dashboard</h1>
            <p className="text-xs text-slate-400">KOBE Enterprises &middot; Real-time business overview</p>
          </div>
          <div className="flex gap-2">
            {periodBtn('24h', '24h')}
            {periodBtn('7d', '7 Days')}
            {periodBtn('30d', '30 Days')}
            {periodBtn('90d', 'Quarter')}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {kpis.map((kpi) => (
            <Card key={kpi.label} className="bg-slate-900/60 border-slate-800">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <kpi.icon className="w-4 h-4 text-blue-400" />
                  <span className={`text-xs flex items-center gap-0.5 ${kpi.up ? 'text-green-400' : 'text-red-400'}`}>
                    {kpi.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {kpi.change}
                  </span>
                </div>
                <div className="text-base font-bold">{kpi.value}</div>
                <div className="text-xs text-slate-400">{kpi.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Card className="lg:col-span-2 bg-slate-900/60 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Revenue vs Expenses (7 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
                    formatter={(value: number) => tzs(value)}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRev)" name="Revenue" />
                  <Area type="monotone" dataKey="expenses" stroke="#ef4444" fillOpacity={1} fill="url(#colorExp)" name="Expenses" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Order Status</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Sales by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `${v / 1000000}M`} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
                    formatter={(value: number) => tzs(value)}
                  />
                  <Bar dataKey="sales" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader className="pb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <CardTitle className="text-sm font-medium">Low Stock Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {lowStock.map((item) => (
                    <div key={item.sku} className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
                      <div>
                        <div className="text-xs font-medium">{item.name}</div>
                        <div className="text-[10px] text-slate-400">{item.sku}</div>
                      </div>
                      <Badge variant="outline" className="text-red-400 border-red-400/20 bg-red-500/10">
                        {item.qty} left
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader className="pb-2 flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-400" />
              <CardTitle className="text-sm font-medium">Fulfillment Queue</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {fulfillmentQueue.map((q) => (
                    <div key={q.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
                      <div>
                        <div className="text-xs font-medium">{q.id}</div>
                        <div className="text-[10px] text-slate-400">{q.items} items &middot; {q.assignee}</div>
                      </div>
                      <Badge variant="outline" className={statusBadge(q.status)}>
                        {q.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardHeader className="pb-2 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-slate-400" />
            <CardTitle className="text-sm font-medium">Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-slate-400 text-xs">Order ID</TableHead>
                  <TableHead className="text-slate-400 text-xs">Customer</TableHead>
                  <TableHead className="text-slate-400 text-xs">Amount</TableHead>
                  <TableHead className="text-slate-400 text-xs">Status</TableHead>
                  <TableHead className="text-slate-400 text-xs">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.map((order) => (
                  <TableRow key={order.id} className="border-slate-800 hover:bg-slate-800/40">
                    <TableCell className="text-xs font-mono text-slate-300">{order.id}</TableCell>
                    <TableCell className="text-xs text-slate-300">{order.customer}</TableCell>
                    <TableCell className="text-xs font-medium text-slate-200">{tzs(order.amount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusBadge(order.status)}>
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-400">{order.date}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
