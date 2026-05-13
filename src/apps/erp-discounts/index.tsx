import React, { useState, useMemo, useEffect } from 'react';
import { api } from '@/lib/api';
import { ensureSession } from '@/lib/auth';
import {
  Percent, Tag, ShoppingBag, Ticket, Plus, Search, Copy, CheckCircle2,
  Clock, Trash2, Edit, ArrowRight, Gift, TrendingUp, X, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Status = 'Active' | 'Scheduled' | 'Expired';
type DiscountType = 'Percentage' | 'Fixed' | 'BuyXGetY' | 'Bundle';

interface Rule { id: number; name: string; type: DiscountType; value: string; products: string; startDate: string; endDate: string; status: Status; usageCount: number; }
interface Campaign { id: number; name: string; description: string; productsCount: number; startDate: string; endDate: string; status: Status; salesLift: string; redemptions: number; gradient: string; }
interface Coupon { id: number; code: string; type: string; discount: string; usage: number; limit: number; expiry: string; status: Status; }

const discountRules: Rule[] = [
  { id: 1, name: 'Summer Sale', type: 'Percentage', value: '15%', products: 'All products', startDate: '2024-06-01', endDate: '2024-08-31', status: 'Active', usageCount: 342 },
  { id: 2, name: 'Bulk Buy', type: 'BuyXGetY', value: 'Buy 3 Get 1 Free', products: 'Electronics', startDate: '2024-01-01', endDate: '2024-12-31', status: 'Active', usageCount: 156 },
  { id: 3, name: 'New Customer', type: 'Fixed', value: 'TSh 5,000', products: 'All', startDate: '2024-01-01', endDate: '2024-12-31', status: 'Active', usageCount: 89 },
  { id: 4, name: 'Flash Sale', type: 'Percentage', value: '25%', products: 'Selected items', startDate: '2024-05-15', endDate: '2024-05-16', status: 'Expired', usageCount: 512 },
  { id: 5, name: 'Loyalty Reward', type: 'Percentage', value: '10%', products: 'Clothing', startDate: '2024-02-01', endDate: '2024-12-31', status: 'Active', usageCount: 203 },
  { id: 6, name: 'Clearance', type: 'Percentage', value: '40%', products: 'Old stock', startDate: '2024-07-01', endDate: '2024-07-31', status: 'Active', usageCount: 78 },
  { id: 7, name: 'Weekend Special', type: 'Percentage', value: '20%', products: 'Food items', startDate: '2024-08-01', endDate: '2024-08-31', status: 'Scheduled', usageCount: 0 },
  { id: 8, name: 'Staff Discount', type: 'Percentage', value: '30%', products: 'All', startDate: '2024-01-01', endDate: '2024-12-31', status: 'Active', usageCount: 45 },
  { id: 9, name: 'Birthday', type: 'Percentage', value: '50%', products: 'All', startDate: '2024-01-01', endDate: '2024-12-31', status: 'Active', usageCount: 67 },
  { id: 10, name: 'Referral', type: 'Fixed', value: 'TSh 10,000', products: 'All', startDate: '2024-03-01', endDate: '2024-12-31', status: 'Active', usageCount: 34 },
];

const campaigns: Campaign[] = [
  { id: 1, name: 'Summer Splash Sale', description: 'Biggest summer discounts across all categories. Up to 60% off selected items.', productsCount: 245, startDate: '2024-06-01', endDate: '2024-08-31', status: 'Active', salesLift: '+24%', redemptions: 1843, gradient: 'from-orange-500 to-red-600' },
  { id: 2, name: 'Back to School', description: 'Special discounts on stationery, electronics, and school supplies for students.', productsCount: 128, startDate: '2024-08-01', endDate: '2024-09-15', status: 'Scheduled', salesLift: '+0%', redemptions: 0, gradient: 'from-blue-500 to-indigo-600' },
  { id: 3, name: 'Black Friday Early', description: 'Early access Black Friday deals for loyalty members only.', productsCount: 89, startDate: '2024-11-20', endDate: '2024-11-30', status: 'Scheduled', salesLift: '+0%', redemptions: 0, gradient: 'from-violet-500 to-purple-600' },
  { id: 4, name: 'New Year Blowout', description: 'Ring in the new year with massive savings storewide.', productsCount: 312, startDate: '2024-12-28', endDate: '2025-01-05', status: 'Scheduled', salesLift: '+0%', redemptions: 0, gradient: 'from-emerald-500 to-teal-600' },
  { id: 5, name: 'Flash Friday', description: '24-hour lightning deals every Friday. Limited quantities available.', productsCount: 56, startDate: '2024-04-01', endDate: '2024-06-30', status: 'Expired', salesLift: '+18%', redemptions: 892, gradient: 'from-amber-500 to-orange-600' },
];

const coupons: Coupon[] = [
  { id: 1, code: 'SAVE10', type: 'Percentage', discount: '10%', usage: 45, limit: 100, expiry: '2024-12-31', status: 'Active' },
  { id: 2, code: 'SUMMER25', type: 'Percentage', discount: '25%', usage: 78, limit: 200, expiry: '2024-08-31', status: 'Active' },
  { id: 3, code: 'BULK20', type: 'Percentage', discount: '20%', usage: 32, limit: 150, expiry: '2024-12-31', status: 'Active' },
  { id: 4, code: 'LOYAL15', type: 'Percentage', discount: '15%', usage: 67, limit: 500, expiry: '2024-12-31', status: 'Active' },
  { id: 5, code: 'WELCOME5K', type: 'Fixed', discount: 'TSh 5,000', usage: 23, limit: 100, expiry: '2024-12-31', status: 'Active' },
  { id: 6, code: 'FLASH50', type: 'Percentage', discount: '50%', usage: 156, limit: 200, expiry: '2024-05-16', status: 'Expired' },
  { id: 7, code: 'WEEKEND', type: 'Percentage', discount: '20%', usage: 0, limit: 300, expiry: '2024-08-31', status: 'Scheduled' },
  { id: 8, code: 'STAFF30', type: 'Percentage', discount: '30%', usage: 12, limit: 999, expiry: '2024-12-31', status: 'Active' },
  { id: 9, code: 'CLEAR40', type: 'Percentage', discount: '40%', usage: 8, limit: 100, expiry: '2024-07-31', status: 'Active' },
  { id: 10, code: 'BDAY50', type: 'Percentage', discount: '50%', usage: 15, limit: 200, expiry: '2024-12-31', status: 'Active' },
  { id: 11, code: 'REFER10K', type: 'Fixed', discount: 'TSh 10,000', usage: 7, limit: 50, expiry: '2024-12-31', status: 'Active' },
  { id: 12, code: 'FIRSTBUY', type: 'Fixed', discount: 'TSh 3,000', usage: 41, limit: 200, expiry: '2024-12-31', status: 'Active' },
  { id: 13, code: 'HOLIDAY', type: 'Percentage', discount: '15%', usage: 0, limit: 400, expiry: '2024-12-25', status: 'Scheduled' },
  { id: 14, code: 'NEWYEAR', type: 'Percentage', discount: '20%', usage: 0, limit: 500, expiry: '2025-01-05', status: 'Scheduled' },
  { id: 15, code: 'SPECIAL', type: 'Percentage', discount: '12%', usage: 56, limit: 250, expiry: '2024-10-31', status: 'Active' },
];

const statusStyles: Record<Status, string> = {
  Active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  Scheduled: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  Expired: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
};

function StatusBadge({ status }: { status: Status }) {
  return (
    <Badge variant="outline" className={`${statusStyles[status]} text-xs font-medium`}>
      {status === 'Active' && <Zap className="w-3 h-3 mr-1" />}
      {status === 'Scheduled' && <Clock className="w-3 h-3 mr-1" />}
      {status === 'Expired' && <X className="w-3 h-3 mr-1" />}
      {status}
    </Badge>
  );
}

function KPICard({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string }) {
  return (
    <Card className="bg-[#13131f] border-white/[0.06]">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm">{label}</p>
            <p className="text-white text-xl font-bold mt-1">{value}</p>
            {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
          </div>
          <div className="w-10 h-10 rounded-lg bg-violet-500/15 flex items-center justify-center">
            <Icon className="w-5 h-5 text-violet-400" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const ruleHeaders = ['Rule Name', 'Type', 'Value', 'Products', 'Start Date', 'End Date', 'Status', 'Usage', 'Actions'];
const couponHeaders = ['Code', 'Type', 'Discount', 'Usage / Limit', 'Expiry', 'Status', ''];

function TableCard({ children, height = 'h-[500px]' }: { children: React.ReactNode; height?: string }) {
  return (
    <Card className="bg-[#13131f] border-white/[0.06]">
      <CardContent className="p-0">
        <ScrollArea className={height}>
          <table className="w-full text-sm">{children}</table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function Thead({ headers }: { headers: string[] }) {
  return (
    <thead className="sticky top-0 z-10">
      <tr className="border-b border-white/[0.06] bg-[#1a1a2e]">
        {headers.map(h => <th key={h} className="text-left py-3 px-4 text-slate-400 font-medium text-xs uppercase tracking-wider">{h}</th>)}
      </tr>
    </thead>
  );
}

function Row({ children, i }: { children: React.ReactNode; i: number }) {
  return (
    <tr className={`border-b border-white/[0.04] ${i % 2 === 0 ? 'bg-[#13131f]' : 'bg-[#161625]'} hover:bg-white/[0.02] transition-colors`}>
      {children}
    </tr>
  );
}

export default function DiscountsPromotions() {
  const [activeTab, setActiveTab] = useState('rules');
  const [showAddRule, setShowAddRule] = useState(false);
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);
  const [couponSearch, setCouponSearch] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Seed /api/discounts on first mount so the backend mirrors the demo catalog.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensureSession();
        const existing = await api<Array<{ id: string }>>('/discounts/rules');
        if (cancelled || existing.length > 0) return;
        const numericValue = (v: string) => Number(v.replace(/[^\d.]/g, '')) || 0;
        await Promise.all([
          ...discountRules.map((r) =>
            api('/discounts/rules', {
              method: 'POST',
              body: JSON.stringify({
                name: r.name,
                type: r.type === 'Fixed' ? 'Fixed' : r.type === 'BuyXGetY' ? 'BOGO' : 'Percentage',
                value: numericValue(r.value),
                productScope: r.products,
              }),
            }),
          ),
          ...campaigns.map((c) =>
            api('/discounts/campaigns', {
              method: 'POST',
              body: JSON.stringify({
                name: c.name, description: c.description,
                startDate: c.startDate + 'T00:00:00Z',
                endDate: c.endDate + 'T23:59:59Z',
                status: c.status,
              }),
            }),
          ),
          ...coupons.map((c) =>
            api('/discounts/coupons', {
              method: 'POST',
              body: JSON.stringify({
                code: c.code,
                type: c.type === 'Fixed' ? 'Fixed' : 'Percentage',
                value: numericValue(c.discount),
                usageLimit: c.limit,
                expiresAt: c.expiry + 'T23:59:59Z',
                active: c.status === 'Active',
              }),
            }),
          ),
        ]);
      } catch { /* leave demo data alone */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Form states
  const [discountName, setDiscountName] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType>('Percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [productScope, setProductScope] = useState('All');
  const [customerScope, setCustomerScope] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [maxPerCustomer, setMaxPerCustomer] = useState('');
  const [totalMax, setTotalMax] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [stackable, setStackable] = useState(false);

  // Coupon generator state
  const [couponPrefix, setCouponPrefix] = useState('');
  const [couponCount, setCouponCount] = useState('10');
  const [couponType, setCouponType] = useState('Percentage');
  const [couponValue, setCouponValue] = useState('');
  const [couponExpiry, setCouponExpiry] = useState('');

  const filteredCoupons = useMemo(() => {
    if (!couponSearch) return coupons;
    return coupons.filter(c => c.code.toLowerCase().includes(couponSearch.toLowerCase()));
  }, [couponSearch]);

  const handleCopy = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const [now] = useState(() => Date.now());
  const campaignProgress = (c: Campaign) => {
    if (c.status === 'Scheduled') return 0;
    const p = Math.min(100, Math.max(0, ((now - new Date(c.startDate).getTime()) / (new Date(c.endDate).getTime() - new Date(c.startDate).getTime())) * 100));
    return Math.round(p);
  };

  const previewSavings = () => {
    if (!discountValue) return '—';
    const val = parseFloat(discountValue);
    if (discountType === 'Percentage') return `TSh ${Math.round(50000 * val / 100).toLocaleString()}`;
    return `TSh ${(isNaN(val) ? 0 : val).toLocaleString()}`;
  };


  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Discounts & Promotions</h1>
          <p className="text-slate-400 text-sm mt-1">Manage pricing rules, campaigns, and coupon codes</p>
        </div>
        <Button onClick={() => setShowAddRule(true)} className="bg-violet-600 hover:bg-violet-700 text-white">
          <Plus className="w-4 h-4 mr-2" /> Add Rule
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <KPICard icon={Tag} label="Active Discounts" value="12" sub="rules running" />
        <KPICard icon={ShoppingBag} label="Active Campaigns" value="3" sub="promotions live" />
        <KPICard icon={Ticket} label="Coupons Issued" value="245" sub="87 redeemed" />
        <KPICard icon={Percent} label="Revenue Impact" value="TSh -1.2M" sub="discounts given" />
        <KPICard icon={TrendingUp} label="Sales Lift" value="+18%" sub="from promotions" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[#13131f] border border-white/[0.06] mb-4">
          {[
            { v: 'rules', l: 'Discount Rules', i: Tag },
            { v: 'campaigns', l: 'Campaigns', i: ShoppingBag },
            { v: 'coupons', l: 'Coupon Codes', i: Ticket },
            { v: 'create', l: 'Create Discount', i: Gift },
          ].map(t => (
            <TabsTrigger key={t.v} value={t.v} className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">
              <t.i className="w-4 h-4 mr-2" /> {t.l}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Tab 1: Discount Rules */}
        <TabsContent value="rules">
          <TableCard>
            <Thead headers={ruleHeaders} />
            <tbody>
              {discountRules.map((rule, i) => (
                <Row key={rule.id} i={i}>
                  <td className="py-3 px-4 font-medium text-white">{rule.name}</td>
                  <td className="py-3 px-4 text-slate-300">{rule.type}</td>
                  <td className="py-3 px-4 text-violet-400 font-medium">{rule.value}</td>
                  <td className="py-3 px-4 text-slate-400">{rule.products}</td>
                  <td className="py-3 px-4 text-slate-400">{rule.startDate}</td>
                  <td className="py-3 px-4 text-slate-400">{rule.endDate}</td>
                  <td className="py-3 px-4"><StatusBadge status={rule.status} /></td>
                  <td className="py-3 px-4 text-slate-300">{rule.usageCount}</td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-white"><Edit className="w-3.5 h-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </td>
                </Row>
              ))}
            </tbody>
          </TableCard>
        </TabsContent>

        {/* Tab 2: Campaigns */}
        <TabsContent value="campaigns">
          <div className="flex justify-between items-center mb-4">
            <p className="text-slate-400 text-sm">{campaigns.length} campaigns total</p>
            <Button onClick={() => setShowCreateCampaign(true)} size="sm" className="bg-violet-600 hover:bg-violet-700"><Plus className="w-4 h-4 mr-2" /> Create Campaign</Button>
          </div>
          <div className="space-y-4">
            {campaigns.map(c => (
              <Card key={c.id} className="bg-[#13131f] border-white/[0.06] overflow-hidden">
                <CardContent className="p-0">
                  <div className={`h-24 bg-gradient-to-r ${c.gradient} relative flex items-center px-6`}>
                    <div className="relative z-10">
                      <h3 className="text-lg font-bold text-white">{c.name}</h3>
                      <p className="text-white/80 text-sm mt-1">{c.description}</p>
                    </div>
                    <div className="absolute right-4 top-4"><StatusBadge status={c.status} /></div>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-4 gap-4 mb-4">
                      {[
                        ['Products', String(c.productsCount)],
                        ['Duration', `${c.startDate} — ${c.endDate}`],
                        ['Sales Lift', c.salesLift, 'text-emerald-400'],
                        ['Redemptions', c.redemptions.toLocaleString()],
                      ].map(([label, val, cls]) => (
                        <div key={label}>
                          <p className="text-slate-500 text-xs uppercase">{label}</p>
                          <p className={`font-semibold text-sm mt-0.5 ${cls || 'text-white'}`}>{val}</p>
                        </div>
                      ))}
                    </div>
                    {c.status !== 'Scheduled' && (
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-400">Progress</span>
                          <span className="text-slate-300">{campaignProgress(c)}%</span>
                        </div>
                        <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                          <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${campaignProgress(c)}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tab 3: Coupon Codes */}
        <TabsContent value="coupons">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input placeholder="Search coupons by code..." value={couponSearch} onChange={e => setCouponSearch(e.target.value)}
              className="pl-10 bg-[#13131f] border-white/[0.06] text-white placeholder:text-slate-500" />
          </div>
          <TableCard height="h-[400px]">
            <Thead headers={couponHeaders} />
            <tbody>
              {filteredCoupons.map((c, i) => (
                <Row key={c.id} i={i}>
                  <td className="py-3 px-4">
                    <span className="font-mono text-xs bg-violet-500/15 text-violet-300 px-2 py-1 rounded border border-violet-500/20">{c.code}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-300">{c.type}</td>
                  <td className="py-3 px-4 text-emerald-400 font-medium">{c.discount}</td>
                  <td className="py-3 px-4 text-slate-300">{c.usage} / {c.limit}</td>
                  <td className="py-3 px-4 text-slate-400">{c.expiry}</td>
                  <td className="py-3 px-4"><StatusBadge status={c.status} /></td>
                  <td className="py-3 px-4">
                    <Button size="sm" variant="ghost" className="h-7 text-slate-400 hover:text-white" onClick={() => handleCopy(c.code)}>
                      {copiedCode === c.code ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </td>
                </Row>
              ))}
            </tbody>
          </TableCard>

          {/* Generate Coupon Form */}
          <Card className="bg-[#13131f] border-white/[0.06] mt-4">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Plus className="w-4 h-4 text-violet-400" /> Generate New Coupons</h3>
              <div className="grid grid-cols-5 gap-3 items-end">
                {([
                  { label: 'Prefix', value: couponPrefix, onChange: setCouponPrefix, placeholder: 'e.g. SALE' },
                  { label: 'Count', value: couponCount, onChange: setCouponCount, type: 'number' },
                  { label: 'Value', value: couponValue, onChange: setCouponValue, placeholder: 'e.g. 15' },
                ] as Array<{ label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }>).map(f => (
                  <div key={f.label}>
                    <label className="text-xs text-slate-400 block mb-1">{f.label}</label>
                    <Input value={f.value} onChange={e => f.onChange(e.target.value)} type={f.type || 'text'} placeholder={f.placeholder}
                      className="bg-[#0a0a1a] border-white/[0.06] text-white" />
                  </div>
                ))}
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Type</label>
                  <Select value={couponType} onValueChange={setCouponType}>
                    <SelectTrigger className="bg-[#0a0a1a] border-white/[0.06] text-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#1a1a2e] border-white/[0.06]">
                      <SelectItem value="Percentage">Percentage</SelectItem>
                      <SelectItem value="Fixed">Fixed Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-slate-400 block mb-1">Expiry</label>
                    <Input value={couponExpiry} onChange={e => setCouponExpiry(e.target.value)} type="date" className="bg-[#0a0a1a] border-white/[0.06] text-white" />
                  </div>
                  <Button className="bg-violet-600 hover:bg-violet-700"><ArrowRight className="w-4 h-4" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Create Discount */}
        <TabsContent value="create">
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 space-y-4">
              {[
                { title: 'Discount Details', content: (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Discount Name</label>
                      <Input value={discountName} onChange={e => setDiscountName(e.target.value)} placeholder="e.g. Summer Sale 2024" className="bg-[#0a0a1a] border-white/[0.06] text-white" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Type</label>
                        <Select value={discountType} onValueChange={v => setDiscountType(v as DiscountType)}>
                          <SelectTrigger className="bg-[#0a0a1a] border-white/[0.06] text-white"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-[#1a1a2e] border-white/[0.06]">
                            {['Percentage', 'Fixed', 'BuyXGetY', 'Bundle'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">{discountType === 'Percentage' ? 'Percentage Off' : discountType === 'Fixed' ? 'Amount Off (TSh)' : 'Value'}</label>
                        <Input value={discountValue} onChange={e => setDiscountValue(e.target.value)} placeholder="e.g. 15" className="bg-[#0a0a1a] border-white/[0.06] text-white" />
                      </div>
                    </div>
                  </div>
                )},
                { title: 'Scope & Eligibility', content: (
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'Product Scope', val: productScope, set: setProductScope, opts: ['All Products', 'Categories', 'Specific Products'] },
                      { label: 'Customer Scope', val: customerScope, set: setCustomerScope, opts: ['All Customers', 'New Customers', 'Loyalty Members', 'Staff Only'] },
                    ].map(f => (
                      <div key={f.label}>
                        <label className="text-xs text-slate-400 block mb-1">{f.label}</label>
                        <Select value={f.val} onValueChange={f.set}>
                          <SelectTrigger className="bg-[#0a0a1a] border-white/[0.06] text-white"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-[#1a1a2e] border-white/[0.06]">
                            {f.opts.map(o => <SelectItem key={o} value={o.split(' ')[0]}>{o}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                )},
                { title: 'Duration & Limits', content: (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {[{ l: 'Start Date', v: startDate, s: setStartDate }, { l: 'End Date', v: endDate, s: setEndDate }].map(f => (
                        <div key={f.l}>
                          <label className="text-xs text-slate-400 block mb-1">{f.l}</label>
                          <Input value={f.v} onChange={e => f.s(e.target.value)} type="date" className="bg-[#0a0a1a] border-white/[0.06] text-white" />
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      {[{ l: 'Max per Customer', v: maxPerCustomer, s: setMaxPerCustomer, p: 'Unlimited' }, { l: 'Total Max Uses', v: totalMax, s: setTotalMax, p: 'Unlimited' }, { l: 'Min Order (TSh)', v: minOrder, s: setMinOrder, p: '0' }].map(f => (
                        <div key={f.l}>
                          <label className="text-xs text-slate-400 block mb-1">{f.l}</label>
                          <Input value={f.v} onChange={e => f.s(e.target.value)} type="number" placeholder={f.p} className="bg-[#0a0a1a] border-white/[0.06] text-white" />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 pt-2">
                      <button onClick={() => setStackable(!stackable)} className={`w-10 h-5 rounded-full transition-colors relative ${stackable ? 'bg-violet-600' : 'bg-slate-600'}`}>
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${stackable ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                      <span className="text-sm text-slate-300">Stackable (can combine with other discounts)</span>
                    </div>
                  </div>
                )},
              ].map(card => (
                <Card key={card.title} className="bg-[#13131f] border-white/[0.06]">
                  <CardContent className="p-4 space-y-4">
                    <h3 className="text-sm font-semibold text-white mb-2">{card.title}</h3>
                    {card.content}
                  </CardContent>
                </Card>
              ))}
              <div className="flex gap-3">
                <Button className="bg-violet-600 hover:bg-violet-700 text-white px-6">Save Discount</Button>
                <Button variant="ghost" className="text-slate-400 hover:text-white">Cancel</Button>
              </div>
            </div>

            {/* Preview Panel */}
            <div>
              <Card className="bg-[#13131f] border-white/[0.06] sticky top-4">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Gift className="w-4 h-4 text-violet-400" /> Preview</h3>
                  <div className="bg-[#0a0a1a] rounded-lg p-4 border border-white/[0.06] space-y-3">
                    {[
                      ['Discount', discountName || '—'],
                      ['Type', discountType, 'text-violet-400'],
                      ['Value', previewSavings(), 'text-emerald-400'],
                    ].map(([label, val, cls]) => (
                      <div key={label} className="flex justify-between">
                        <span className="text-slate-400 text-xs">{label}</span>
                        <span className={`text-sm font-medium ${cls || 'text-white'}`}>{val}</span>
                      </div>
                    ))}
                    <div className="border-t border-white/[0.06] pt-3">
                      <p className="text-slate-500 text-xs mb-2">Customer Preview</p>
                      <div className="bg-white/[0.02] rounded p-3">
                        <p className="text-slate-300 text-sm">
                          {discountValue && discountName ? (
                            <>If customer buys <span className="text-white font-medium">items worth TSh 50,000</span>, they save <span className="text-emerald-400 font-bold">{previewSavings()}</span></>
                          ) : 'Fill in discount details to see preview'}
                        </p>
                      </div>
                    </div>
                    <div className="border-t border-white/[0.06] pt-3 space-y-2">
                      {[
                        ['Products', productScope === 'All' ? 'All Products' : productScope],
                        ['Customers', customerScope === 'All' ? 'All' : customerScope],
                        ['Stackable', stackable ? 'Yes' : 'No'],
                        ['Period', `${startDate || '—'} to ${endDate || '—'}`],
                      ].map(([label, val]) => (
                        <div key={label} className="flex justify-between">
                          <span className="text-slate-400 text-xs">{label}</span>
                          <span className="text-slate-300 text-xs">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Rule Dialog */}
      <Dialog open={showAddRule} onOpenChange={setShowAddRule}>
        <DialogContent className="bg-[#13131f] border-white/[0.06] text-white max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Plus className="w-5 h-5 text-violet-400" /> Add Discount Rule</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            {[{ l: 'Rule Name', p: 'e.g. Holiday Special' }, { l: 'Value', p: 'e.g. 15' }].map(f => (
              <div key={f.l}>
                <label className="text-xs text-slate-400 block mb-1">{f.l}</label>
                <Input placeholder={f.p} className="bg-[#0a0a1a] border-white/[0.06] text-white" />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Type</label>
                <Select defaultValue="Percentage">
                  <SelectTrigger className="bg-[#0a0a1a] border-white/[0.06] text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#1a1a2e] border-white/[0.06]">
                    {['Percentage', 'Fixed', 'BuyXGetY', 'Bundle'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Applies To</label>
                <Select defaultValue="All">
                  <SelectTrigger className="bg-[#0a0a1a] border-white/[0.06] text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#1a1a2e] border-white/[0.06]">
                    {['All Products', 'Electronics', 'Clothing', 'Food Items'].map(o => <SelectItem key={o} value={o.split(' ')[0]}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {['Start Date', 'End Date'].map(l => (
                <div key={l}>
                  <label className="text-xs text-slate-400 block mb-1">{l}</label>
                  <Input type="date" className="bg-[#0a0a1a] border-white/[0.06] text-white" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <Button className="bg-violet-600 hover:bg-violet-700 flex-1">Create Rule</Button>
              <Button variant="ghost" onClick={() => setShowAddRule(false)} className="text-slate-400">Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Campaign Dialog */}
      <Dialog open={showCreateCampaign} onOpenChange={setShowCreateCampaign}>
        <DialogContent className="bg-[#13131f] border-white/[0.06] text-white max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ShoppingBag className="w-5 h-5 text-violet-400" /> Create Campaign</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            {[{ l: 'Campaign Name', p: 'e.g. Summer Splash' }, { l: 'Description', p: 'Brief description...' }].map(f => (
              <div key={f.l}>
                <label className="text-xs text-slate-400 block mb-1">{f.l}</label>
                <Input placeholder={f.p} className="bg-[#0a0a1a] border-white/[0.06] text-white" />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-4">
              {['Start Date', 'End Date'].map(l => (
                <div key={l}>
                  <label className="text-xs text-slate-400 block mb-1">{l}</label>
                  <Input type="date" className="bg-[#0a0a1a] border-white/[0.06] text-white" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <Button className="bg-violet-600 hover:bg-violet-700 flex-1">Create Campaign</Button>
              <Button variant="ghost" onClick={() => setShowCreateCampaign(false)} className="text-slate-400">Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
