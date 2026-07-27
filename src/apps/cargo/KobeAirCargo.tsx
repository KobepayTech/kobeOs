import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bell,
  Box,
  Boxes,
  Building2,
  Calculator,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FileText,
  Gauge,
  Globe2,
  Headphones,
  History,
  LayoutDashboard,
  LockKeyhole,
  MapPin,
  Menu,
  MessageCircle,
  Navigation,
  Package,
  PackageCheck,
  Plane,
  Printer,
  QrCode,
  Radio,
  RefreshCw,
  Route,
  ScanLine,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Timer,
  Truck,
  UserCheck,
  Users,
  Wallet,
  Warehouse,
  Weight,
  X,
  XCircle,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

type View =
  | 'dashboard'
  | 'tracking'
  | 'warehouse'
  | 'consolidation'
  | 'control'
  | 'flights'
  | 'customs'
  | 'business'
  | 'delivery';

type NoticeTone = 'success' | 'warning' | 'info';

interface NavItem {
  id: View;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'My cargo',
    items: [
      { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
      { id: 'tracking', label: 'Live tracking', icon: Route, badge: 'LIVE' },
      { id: 'consolidation', label: 'Consolidation', icon: Boxes, badge: '3/4' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { id: 'warehouse', label: 'China warehouse', icon: Warehouse },
      { id: 'control', label: 'Control tower', icon: Gauge, badge: '4' },
      { id: 'flights', label: 'Flight KDS & AWB', icon: Plane },
      { id: 'customs', label: 'Customs & documents', icon: ShieldCheck },
      { id: 'delivery', label: 'Pickup & delivery', icon: Truck },
    ],
  },
  {
    label: 'Business',
    items: [{ id: 'business', label: 'Suppliers & costing', icon: ShoppingCart }],
  },
];

const VIEW_META: Record<View, { eyebrow: string; title: string; description: string }> = {
  dashboard: {
    eyebrow: 'Merchant command center',
    title: 'Good afternoon, Amina',
    description: 'Everything moving from China to Tanzania, in one calm view.',
  },
  tracking: {
    eyebrow: 'No login required',
    title: 'Track every handoff',
    description: 'A transparent chain of custody from supplier pickup to final collection.',
  },
  warehouse: {
    eyebrow: 'Guangzhou hub · CN-GZ-01',
    title: 'Receive, prove, place',
    description: 'Scan-led receiving with measurement evidence and precise shelf locations.',
  },
  consolidation: {
    eyebrow: 'Smart consolidation',
    title: 'Ship together, spend less',
    description: 'Wait for the right packages without losing sight of the next flight.',
  },
  control: {
    eyebrow: 'Operations control tower',
    title: 'Network health at a glance',
    description: 'Exceptions, capacity, customs and delivery queues across both countries.',
  },
  flights: {
    eyebrow: 'Flight operations KDS',
    title: 'Build the safest profitable load',
    description: 'Capacity, priority rules, MAWB and HAWB visibility for every departure.',
  },
  customs: {
    eyebrow: 'Compliance workspace',
    title: 'One shipment, one document vault',
    description: 'Restricted-goods checks, manifest validation and release reconciliation.',
  },
  business: {
    eyebrow: 'Merchant tools',
    title: 'Buy better and know your landed cost',
    description: 'Supplier records, procurement requests, quotes and pricing in one place.',
  },
  delivery: {
    eyebrow: 'Tanzania destination',
    title: 'Release cargo with confidence',
    description: 'QR pickup, OTP verification and last-mile proof of delivery.',
  },
};

const TRACKING_STEPS = [
  ['Pickup requested', 'Shenzhen · Supplier', 'Jul 22 · 09:12'],
  ['Courier assigned', 'Shenzhen · SF Express', 'Jul 22 · 09:18'],
  ['Picked up from supplier', 'Bao’an District', 'Jul 22 · 12:42'],
  ['Arrived at China gateway', 'Guangzhou hub', 'Jul 22 · 18:09'],
  ['Intake QR scanned', 'Dock 04 · CN-GZ-01', 'Jul 22 · 18:11'],
  ['Matched to Kobe Cargo ID', 'KOBE-CN-104852', 'Jul 22 · 18:12'],
  ['Package photographed', 'Evidence station 02', 'Jul 22 · 18:14'],
  ['Dimensions measured', '48 × 36 × 32 cm', 'Jul 22 · 18:16'],
  ['Actual weight captured', '12.4 kg', 'Jul 22 · 18:17'],
  ['Chargeable weight calculated', '13.8 kg volumetric', 'Jul 22 · 18:17'],
  ['Measurement accepted', 'Accepted by Amina', 'Jul 22 · 18:24'],
  ['Shelf location assigned', 'GZ-A03-R02-L04', 'Jul 22 · 18:26'],
  ['Consolidation suggested', '3 of 4 packages ready', 'Jul 23 · 08:02'],
  ['Consolidation approved', 'Bundle KBC-2607-118', 'Jul 23 · 08:19'],
  ['Freight payment confirmed', 'TZS 426,800', 'Jul 23 · 08:22'],
  ['Export documents checked', 'Invoice + packing list', 'Jul 23 · 11:34'],
  ['Security screening passed', 'CAN export terminal', 'Jul 23 · 13:10'],
  ['Cargo booked', 'KQ 887 · CAN–NBO', 'Jul 23 · 14:28'],
  ['HAWB issued', 'KBA-255-070126', 'Jul 23 · 14:32'],
  ['MAWB linked', '706-44892016', 'Jul 23 · 14:34'],
  ['ULD assigned', 'AKE 18426 KQ', 'Jul 24 · 03:06'],
  ['Loaded on aircraft', 'Boeing 787-8 · 5Y-KZA', 'Jul 24 · 04:28'],
  ['Departed Guangzhou', 'CAN · Gate 211', 'Jul 24 · 05:14'],
  ['In flight to Nairobi', 'Over Arabian Sea', 'Live · ETA 18:42'],
  ['Arrived Nairobi', 'NBO transfer hub', 'Estimated Jul 24'],
  ['Connected Nairobi to Dar', 'KQ 486 · NBO–DAR', 'Estimated Jul 25'],
  ['Arrived Dar es Salaam', 'DAR cargo terminal', 'Estimated Jul 25'],
  ['Customs assessed', 'Tanzania Customs', 'Pending'],
  ['Released / ready for pickup', 'Kobe TZ warehouse', 'Pending'],
  ['Collected or delivered', 'OTP + proof of delivery', 'Pending'],
] as const;

const CARGO_PACKAGES = [
  { id: 'KBP-104852-01', supplier: 'Shenzhen Nova Tech', item: 'POS terminals × 12', weight: '13.8 kg', status: 'Ready', shelf: 'A03-R02-L04' },
  { id: 'KBP-104852-02', supplier: 'Guangzhou Luma', item: 'LED strips × 48', weight: '8.2 kg', status: 'Ready', shelf: 'B01-R06-L02' },
  { id: 'KBP-104852-03', supplier: 'Yiwu Mobi', item: 'Phone cases × 200', weight: '17.1 kg', status: 'Ready', shelf: 'C04-R01-L06' },
  { id: 'KBP-104852-04', supplier: 'Dongguan Power', item: 'Power banks × 30', weight: '—', status: 'Expected', shelf: '—' },
] as const;

const FLIGHTS = [
  { flight: 'KQ 887', route: 'CAN → NBO', date: '24 Jul · 05:10', aircraft: 'B787-8', used: 82, weight: '12,450 / 15,200 kg', status: 'Boarding cargo' },
  { flight: 'ET 607', route: 'CAN → ADD', date: '24 Jul · 23:55', aircraft: 'B777F', used: 64, weight: '41,280 / 64,000 kg', status: 'Building load' },
  { flight: 'KQ 486', route: 'NBO → DAR', date: '25 Jul · 19:40', aircraft: 'B737-8', used: 71, weight: '2,980 / 4,200 kg', status: 'Connection ready' },
] as const;

const EXCEPTIONS = [
  { title: 'Restricted battery declaration missing', cargo: 'KBP-104852-04', owner: 'China compliance', age: '42 min', priority: 'Critical' },
  { title: 'Measurement dispute needs review', cargo: 'KBP-104611-02', owner: 'Warehouse lead', age: '1h 12m', priority: 'High' },
  { title: 'DAR customs assessment overdue', cargo: 'KBA-255-069884', owner: 'TZ clearing', age: '3h 08m', priority: 'High' },
  { title: 'Customer pickup appointment expired', cargo: 'KOBE-TZ-038921', owner: 'Customer care', age: '5h 44m', priority: 'Medium' },
] as const;

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function Button({
  children,
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'dark' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}) {
  const variants = {
    primary: 'bg-[#ff7616] text-white hover:bg-[#e96509] shadow-[0_8px_20px_rgba(255,118,22,0.2)]',
    secondary: 'border border-slate-200 bg-white text-[#0a1728] hover:border-slate-300 hover:bg-slate-50',
    dark: 'bg-[#0a1728] text-white hover:bg-[#14253b]',
    ghost: 'text-slate-600 hover:bg-slate-100 hover:text-[#0a1728]',
    danger: 'bg-red-50 text-red-700 hover:bg-red-100',
  };
  const sizes = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-5 text-sm',
  };
  return (
    <button
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(10,23,40,0.04)]', className)}>
      {children}
    </section>
  );
}

function StatusPill({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'orange';
}) {
  const tones = {
    success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10',
    warning: 'bg-amber-50 text-amber-800 ring-amber-600/10',
    danger: 'bg-red-50 text-red-700 ring-red-600/10',
    info: 'bg-blue-50 text-blue-700 ring-blue-600/10',
    neutral: 'bg-slate-100 text-slate-600 ring-slate-600/10',
    orange: 'bg-orange-50 text-[#d95a00] ring-orange-600/10',
  };
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset', tones[tone])}>
      {children}
    </span>
  );
}

function SectionTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#ff7616]">{eyebrow}</p>}
        <h2 className="text-lg font-black tracking-[-0.02em] text-[#0a1728]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function MiniProgress({ value, orange = false }: { value: number; orange?: boolean }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
      <div className={cn('h-full rounded-full', orange ? 'bg-[#ff7616]' : 'bg-[#0a1728]')} style={{ width: `${value}%` }} />
    </div>
  );
}

function DashboardView({
  navigate,
  onTrack,
}: {
  navigate: (view: View) => void;
  onTrack: (value: string) => void;
}) {
  const [query, setQuery] = useState('KBA-255-070126');
  const stats = [
    { label: 'Packages in China', value: '3', sub: '1 arriving tomorrow', icon: Warehouse, tone: 'bg-blue-50 text-blue-700' },
    { label: 'Flying now', value: '2', sub: 'Next ETA 18:42', icon: Plane, tone: 'bg-orange-50 text-[#e46308]' },
    { label: 'In customs', value: '1', sub: 'Assessment in progress', icon: ShieldCheck, tone: 'bg-violet-50 text-violet-700' },
    { label: 'Ready in Tanzania', value: '4', sub: 'Pickup before 18:00', icon: PackageCheck, tone: 'bg-emerald-50 text-emerald-700' },
  ];

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[26px] bg-[#081524] px-5 py-6 text-white shadow-[0_20px_50px_rgba(6,18,32,0.22)] md:px-7 md:py-7">
        <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[#ff7616]/20 blur-3xl" />
        <div className="relative grid gap-6 xl:grid-cols-[1.25fr_.75fr] xl:items-end">
          <div>
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <StatusPill tone="orange"><Radio className="h-3 w-3" /> Network live</StatusPill>
              <span className="text-xs font-medium text-slate-400">Guangzhou · Nairobi · Dar es Salaam</span>
            </div>
            <p className="text-sm font-semibold text-slate-300">Your permanent China cargo ID</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-black tracking-tight md:text-3xl">KOBE-CN-104852</h2>
              <button className="rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-white/15">
                Copy ID
              </button>
            </div>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
              Put this ID on every supplier order. We automatically match each package to your account when it reaches China.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 backdrop-blur">
            <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Track cargo or supplier parcel</label>
            <div className="flex gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-white px-3 text-[#0a1728]">
                <Search className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && onTrack(query)}
                  className="h-11 min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400"
                  placeholder="Tracking, HAWB or cargo ID"
                />
              </div>
              <Button onClick={() => onTrack(query)} size="lg">Track <ArrowRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500">{stat.label}</p>
                  <p className="mt-1 text-3xl font-black tracking-[-0.04em] text-[#0a1728]">{stat.value}</p>
                </div>
                <div className={cn('rounded-xl p-2.5', stat.tone)}><Icon className="h-5 w-5" /></div>
              </div>
              <p className="mt-3 text-[11px] font-medium text-slate-400">{stat.sub}</p>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 p-5">
            <SectionTitle
              eyebrow="Active air shipment"
              title="Guangzhou → Dar es Salaam"
              action={<StatusPill tone="orange"><Plane className="h-3 w-3" /> In flight</StatusPill>}
            />
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
              <span className="font-bold text-[#0a1728]">KBA-255-070126</span>
              <span>MAWB 706-44892016</span>
              <span>41.3 kg chargeable</span>
              <span>KQ 887 / KQ 486</span>
            </div>
          </div>
          <div className="p-5">
            <div className="relative mb-5 pt-2">
              <div className="absolute left-[5%] right-[5%] top-[17px] h-1 rounded-full bg-slate-100" />
              <div className="absolute left-[5%] right-[38%] top-[17px] h-1 rounded-full bg-[#ff7616]" />
              <div className="relative grid grid-cols-4 text-center">
                {[
                  ['China hub', 'Complete'],
                  ['CAN departure', 'Complete'],
                  ['Nairobi transfer', 'Live'],
                  ['Dar warehouse', 'Next'],
                ].map(([label, status], index) => (
                  <div key={label}>
                    <span className={cn(
                      'mx-auto flex h-5 w-5 items-center justify-center rounded-full border-4 border-white',
                      index < 2 ? 'bg-[#ff7616]' : index === 2 ? 'bg-[#0a1728] ring-4 ring-orange-100' : 'bg-slate-200',
                    )}>
                      {index < 2 && <Check className="h-2.5 w-2.5 text-white" />}
                    </span>
                    <p className="mt-2 text-[11px] font-bold text-[#0a1728]">{label}</p>
                    <p className={cn('mt-0.5 text-[10px] font-semibold', index === 2 ? 'text-[#ff7616]' : 'text-slate-400')}>{status}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Current position</p>
                <p className="mt-1 text-sm font-bold text-[#0a1728]">Over Arabian Sea</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Next milestone</p>
                <p className="mt-1 text-sm font-bold text-[#0a1728]">Arrive NBO · 18:42</p>
              </div>
              <div className="flex items-end sm:justify-end">
                <Button variant="dark" size="sm" onClick={() => navigate('tracking')}>Open live journey <ChevronRight className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle eyebrow="Smart recommendation" title="Consolidate and save" />
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-4xl font-black tracking-[-0.05em] text-[#0a1728]">3<span className="text-lg text-slate-300"> / 4</span></p>
              <p className="text-xs font-semibold text-slate-500">packages at Guangzhou hub</p>
            </div>
            <div className="rounded-xl bg-emerald-50 px-3 py-2 text-right">
              <p className="text-[10px] font-bold text-emerald-700">Estimated saving</p>
              <p className="text-lg font-black text-emerald-700">TZS 86,400</p>
            </div>
          </div>
          <MiniProgress value={75} orange />
          <p className="mt-4 text-xs leading-5 text-slate-500">
            Dongguan Power is expected tomorrow at 11:30. The recommended flight still closes in 38 hours.
          </p>
          <Button className="mt-5 w-full" onClick={() => navigate('consolidation')}>Review consolidation <Boxes className="h-4 w-4" /></Button>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <SectionTitle
            eyebrow="Measurement transparency"
            title="Every kilogram has evidence"
            action={<Button variant="ghost" size="sm" onClick={() => navigate('warehouse')}>View package evidence <ArrowRight className="h-3.5 w-3.5" /></Button>}
          />
          <div className="grid gap-4 md:grid-cols-[160px_1fr]">
            <div className="relative flex min-h-32 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900">
              <Camera className="h-8 w-8 text-white/70" />
              <span className="absolute bottom-2 left-2 rounded-md bg-black/50 px-2 py-1 text-[9px] font-bold text-white">INTAKE · 18:14 CST</span>
            </div>
            <div>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-[#0a1728]">KBP-104852-01 · POS terminals</p>
                  <p className="mt-1 text-xs text-slate-500">Shenzhen Nova Tech · Shelf GZ-A03-R02-L04</p>
                </div>
                <StatusPill tone="success"><BadgeCheck className="h-3 w-3" /> Accepted</StatusPill>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['Actual', '12.4 kg'],
                  ['Volumetric', '13.8 kg'],
                  ['Chargeable', '13.8 kg'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                    <p className="mt-1 text-sm font-black text-[#0a1728]">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle eyebrow="Built for merchants" title="Quick actions" />
          <div className="space-y-2">
            {[
              [QrCode, 'Show my China cargo ID', 'Send to a supplier', 'warehouse'],
              [Calculator, 'Calculate landed cost', 'Know margin before buying', 'business'],
              [MessageCircle, 'Ask Kobe AI', 'Resolve a cargo question', 'tracking'],
              [Headphones, 'Open support case', 'Human help with full context', 'customs'],
            ].map(([Icon, title, sub, view]) => {
              const ItemIcon = Icon as LucideIcon;
              return (
                <button key={String(title)} onClick={() => navigate(view as View)} className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition hover:bg-slate-50">
                  <span className="rounded-lg bg-slate-100 p-2 text-slate-600"><ItemIcon className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold text-[#0a1728]">{String(title)}</span>
                    <span className="mt-0.5 block text-[10px] text-slate-400">{String(sub)}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </button>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

function TrackingView({ initialQuery }: { initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery || 'KBA-255-070126');
  const [activeQuery, setActiveQuery] = useState(initialQuery || 'KBA-255-070126');
  const currentStep = 23;

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <div className="bg-[#081524] p-5 text-white md:p-7">
          <div className="mx-auto max-w-4xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-[#ff8a3a]">Public tracking</p>
                <h2 className="mt-1 text-2xl font-black">Where is your cargo?</h2>
              </div>
              <StatusPill tone="success"><Radio className="h-3 w-3" /> Live events</StatusPill>
            </div>
            <p className="mb-5 text-sm text-slate-400">Enter a Kobe tracking number, HAWB, supplier parcel number or permanent cargo ID.</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-xl bg-white px-4 text-[#0a1728]">
                <Search className="h-5 w-5 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && setActiveQuery(query)}
                  className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none"
                  aria-label="Cargo tracking number"
                />
              </div>
              <Button size="lg" onClick={() => setActiveQuery(query)}>Track cargo <ArrowRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
        <div className="grid gap-5 border-b border-slate-100 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-black text-[#0a1728]">{activeQuery}</h3>
              <StatusPill tone="orange"><Plane className="h-3 w-3" /> In flight</StatusPill>
            </div>
            <p className="mt-1 text-xs text-slate-500">HAWB KBA-255-070126 · MAWB 706-44892016 · 4 packages · 41.3 kg</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm"><Bell className="h-3.5 w-3.5" /> Get updates</Button>
            <Button variant="secondary" size="sm"><FileText className="h-3.5 w-3.5" /> Documents</Button>
          </div>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-4">
          {[
            ['CAN', 'Guangzhou', 'Departed 05:14'],
            ['✈', 'KQ 887', 'Live · 7h 12m'],
            ['NBO', 'Nairobi', 'ETA 18:42'],
            ['DAR', 'Dar es Salaam', 'ETA Jul 25'],
          ].map(([code, city, time], index) => (
            <div key={city} className={cn('relative rounded-2xl p-4', index === 1 ? 'bg-orange-50 ring-1 ring-orange-100' : 'bg-slate-50')}>
              <p className={cn('text-xl font-black', index === 1 ? 'text-[#ff7616]' : 'text-[#0a1728]')}>{code}</p>
              <p className="mt-1 text-xs font-bold text-[#0a1728]">{city}</p>
              <p className="mt-1 text-[10px] text-slate-400">{time}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ff7616]">30-step event trail</p>
              <h3 className="mt-1 text-base font-black text-[#0a1728]">Complete chain of custody</h3>
            </div>
            <span className="text-xs font-bold text-slate-400">{currentStep + 1} of {TRACKING_STEPS.length}</span>
          </div>
          <div className="max-h-[610px] overflow-y-auto p-5">
            {TRACKING_STEPS.map(([title, place, time], index) => {
              const complete = index < currentStep;
              const active = index === currentStep;
              return (
                <div key={title} className="relative flex gap-4 pb-5 last:pb-0">
                  {index < TRACKING_STEPS.length - 1 && (
                    <span className={cn('absolute left-[11px] top-6 h-full w-0.5', complete ? 'bg-[#ff7616]' : 'bg-slate-200')} />
                  )}
                  <span className={cn(
                    'relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
                    complete ? 'border-[#ff7616] bg-[#ff7616] text-white' :
                      active ? 'border-[#0a1728] bg-[#0a1728] text-white ring-4 ring-orange-100' :
                        'border-slate-200 bg-white text-slate-300',
                  )}>
                    {complete ? <Check className="h-3 w-3" /> : active ? <Plane className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                  </span>
                  <div className={cn('min-w-0 flex-1', !complete && !active && 'opacity-55')}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-[#0a1728]">{title}</p>
                        <p className="mt-1 text-[10px] text-slate-500">{place}</p>
                      </div>
                      <span className={cn('text-[10px] font-semibold', active ? 'text-[#ff7616]' : 'text-slate-400')}>{time}</span>
                    </div>
                    {(title.includes('photographed') || title.includes('measured') || title.includes('HAWB')) && (
                      <button className="mt-2 inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-600 hover:bg-slate-200">
                        <Camera className="h-3 w-3" /> View evidence
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="relative h-44 overflow-hidden bg-[#10253b]">
              <div className="absolute inset-0 opacity-50" style={{ backgroundImage: 'radial-gradient(circle at 20% 70%, #ff7616 0 2px, transparent 3px), radial-gradient(circle at 75% 35%, #60a5fa 0 2px, transparent 3px), linear-gradient(125deg, transparent 45%, rgba(255,255,255,.16) 46%, transparent 47%)' }} />
              <div className="absolute left-[22%] top-[58%] h-2.5 w-2.5 rounded-full bg-[#ff7616] ring-4 ring-orange-400/20" />
              <Plane className="absolute left-[58%] top-[36%] h-7 w-7 rotate-[18deg] text-white" />
              <div className="absolute bottom-3 left-3 rounded-xl border border-white/10 bg-[#081524]/80 px-3 py-2 text-white backdrop-blur">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Live aircraft</p>
                <p className="mt-1 text-xs font-black">KQ 887 · 5Y-KZA</p>
              </div>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['Altitude', '38,000 ft'],
                  ['Ground speed', '908 km/h'],
                  ['ETA NBO', '18:42 EAT'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-[9px] font-bold uppercase text-slate-400">{label}</p>
                    <p className="mt-1 text-xs font-black text-[#0a1728]">{value}</p>
                  </div>
                ))}
              </div>
              <Button variant="secondary" className="mt-4 w-full" size="sm"><Globe2 className="h-3.5 w-3.5" /> Open FlightRadar24</Button>
            </div>
          </Card>
          <Card className="p-5">
            <SectionTitle eyebrow="Package proof" title="Measurement evidence" />
            <div className="grid grid-cols-3 gap-2">
              {[Camera, Weight, Box].map((Icon, index) => (
                <div key={index} className="flex aspect-square items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                  <Icon className="h-6 w-6" />
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-slate-400">Actual</p><p className="mt-1 font-black">41.3 kg</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-slate-400">Volume</p><p className="mt-1 font-black">0.246 m³</p></div>
            </div>
          </Card>
          <Card className="p-5">
            <SectionTitle eyebrow="Need help?" title="Ask in context" />
            <p className="text-xs leading-5 text-slate-500">Kobe AI already knows this shipment, its documents and current exception state.</p>
            <Button className="mt-4 w-full"><Sparkles className="h-4 w-4" /> Ask Kobe AI</Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

function WarehouseView({ notify }: { notify: (message: string, tone?: NoticeTone) => void }) {
  const [decision, setDecision] = useState<'pending' | 'accepted' | 'disputed'>('pending');
  const [scan, setScan] = useState('');
  const [lastScan, setLastScan] = useState('KBP-104852-01');

  const submitScan = () => {
    if (!scan.trim()) return;
    setLastScan(scan.trim().toUpperCase());
    setScan('');
    notify('Package matched and intake record opened.');
  };

  return (
    <div className="space-y-5">
      <section className="grid gap-5 rounded-[26px] bg-[#081524] p-5 text-white xl:grid-cols-[1fr_auto] xl:items-center">
        <div>
          <div className="mb-3 flex items-center gap-2 text-[#ff8a3a]">
            <ScanLine className="h-5 w-5" />
            <span className="text-xs font-black uppercase tracking-[0.16em]">Scan-led receiving</span>
          </div>
          <h2 className="text-2xl font-black">Scan supplier parcel or Kobe QR</h2>
          <p className="mt-2 text-sm text-slate-400">A single scan opens the customer match, photo, measurement, label and shelf workflow.</p>
        </div>
        <div className="flex min-w-0 gap-2 xl:w-[430px]">
          <div className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-xl bg-white px-3 text-[#0a1728]">
            <QrCode className="h-5 w-5 text-slate-400" />
            <input
              value={scan}
              onChange={(event) => setScan(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && submitScan()}
              placeholder="Scan or type parcel ID"
              className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none"
            />
          </div>
          <Button size="lg" onClick={submitScan}>Receive</Button>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-[#0a1728]">{lastScan}</h3>
                <StatusPill tone="success"><BadgeCheck className="h-3 w-3" /> Customer matched</StatusPill>
              </div>
              <p className="mt-1 text-xs text-slate-500">Amina Joseph · Shenzhen Nova Tech · POS terminals × 12</p>
            </div>
            <Button variant="secondary" size="sm"><Printer className="h-3.5 w-3.5" /> Print QR label</Button>
          </div>
          <div className="p-5">
            <div className="grid gap-3 md:grid-cols-3">
              {[
                ['Intake photo', Camera, 'Dock 04 · 18:14:22'],
                ['Scale evidence', Weight, 'WS-04 · calibrated'],
                ['Dimension proof', Box, 'DIM-02 · laser'],
              ].map(([label, Icon, sub], index) => {
                const EvidenceIcon = Icon as LucideIcon;
                return (
                  <div key={String(label)} className="group relative flex min-h-40 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-slate-700 to-slate-950 text-white">
                    <EvidenceIcon className="h-9 w-9 text-white/60 transition group-hover:scale-110" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 p-3 pt-8">
                      <p className="text-xs font-bold">{String(label)}</p>
                      <p className="mt-1 text-[9px] text-slate-300">{String(sub)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ['Actual weight', '12.40 kg', 'Scale WS-04'],
                ['Dimensions', '48 × 36 × 32', 'cm · laser measured'],
                ['Volumetric', '13.82 kg', '÷ 4,000 air factor'],
                ['Chargeable', '13.82 kg', 'Higher of actual/volume'],
              ].map(([label, value, sub], index) => (
                <div key={label} className={cn('rounded-2xl border p-4', index === 3 ? 'border-orange-200 bg-orange-50' : 'border-slate-100 bg-slate-50')}>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
                  <p className={cn('mt-2 text-xl font-black', index === 3 ? 'text-[#d95a00]' : 'text-[#0a1728]')}>{value}</p>
                  <p className="mt-1 text-[9px] text-slate-400">{sub}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4">
              <div>
                <p className="text-xs font-black text-[#0a1728]">Customer measurement approval</p>
                <p className="mt-1 text-[10px] text-slate-500">Disputes pause billing and create a supervisor review with all evidence attached.</p>
              </div>
              {decision === 'pending' ? (
                <div className="flex gap-2">
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      setDecision('disputed');
                      notify('Measurement dispute opened for supervisor review.', 'warning');
                    }}
                  >
                    <AlertTriangle className="h-3.5 w-3.5" /> Dispute
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setDecision('accepted');
                      notify('Measurement evidence accepted and billing unlocked.');
                    }}
                  >
                    <Check className="h-3.5 w-3.5" /> Accept measurement
                  </Button>
                </div>
              ) : (
                <StatusPill tone={decision === 'accepted' ? 'success' : 'warning'}>
                  {decision === 'accepted' ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                  {decision === 'accepted' ? 'Accepted' : 'Supervisor review open'}
                </StatusPill>
              )}
            </div>
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <SectionTitle eyebrow="Put-away" title="Exact shelf location" />
            <div className="rounded-2xl bg-[#081524] p-5 text-white">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Assigned bin</p>
              <p className="mt-2 text-3xl font-black tracking-tight">A03-R02-L04</p>
              <p className="mt-2 text-xs text-slate-400">Zone A · Rack 03 · Row 02 · Level 04</p>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {['Scan', 'Photo', 'Measure', 'Place'].map((step, index) => (
                <div key={step} className="text-center">
                  <span className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <p className="mt-1.5 text-[9px] font-bold text-slate-500">{step}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <SectionTitle eyebrow="Hub pulse" title="Today at Guangzhou" />
            <div className="space-y-3">
              {[
                ['Packages received', '128', '18 waiting for match'],
                ['Measured within SLA', '96.8%', 'Target 95%'],
                ['Average dock to shelf', '14m', '2m faster today'],
                ['Open disputes', '7', 'Oldest 1h 12m'],
              ].map(([label, value, sub]) => (
                <div key={label} className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                  <div><p className="text-xs font-bold text-[#0a1728]">{label}</p><p className="mt-1 text-[9px] text-slate-400">{sub}</p></div>
                  <p className="text-lg font-black text-[#0a1728]">{value}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ConsolidationView({ notify }: { notify: (message: string, tone?: NoticeTone) => void }) {
  const [approved, setApproved] = useState(false);
  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 p-5">
            <SectionTitle
              eyebrow="Bundle KBC-2607-118"
              title="3 of 4 packages ready"
              action={<StatusPill tone={approved ? 'success' : 'orange'}>{approved ? <CheckCircle2 className="h-3 w-3" /> : <Timer className="h-3 w-3" />}{approved ? 'Approved' : 'Decision needed'}</StatusPill>}
            />
            <MiniProgress value={75} orange />
            <div className="mt-3 flex flex-wrap justify-between gap-2 text-[10px] font-semibold text-slate-400">
              <span>Received 39.1 kg</span>
              <span>Expected final 7.8 kg</span>
              <span>Flight cutoff in 38h 24m</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left">
              <thead className="bg-slate-50 text-[9px] font-black uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-3">Package</th>
                  <th className="px-4 py-3">Supplier / contents</th>
                  <th className="px-4 py-3">Chargeable</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-5 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {CARGO_PACKAGES.map((pkg) => (
                  <tr key={pkg.id} className="border-t border-slate-100 text-xs">
                    <td className="px-5 py-4 font-black text-[#0a1728]">{pkg.id}</td>
                    <td className="px-4 py-4"><p className="font-bold text-[#0a1728]">{pkg.supplier}</p><p className="mt-1 text-[10px] text-slate-400">{pkg.item}</p></td>
                    <td className="px-4 py-4 font-bold text-slate-600">{pkg.weight}</td>
                    <td className="px-4 py-4 font-mono text-[10px] text-slate-500">{pkg.shelf}</td>
                    <td className="px-5 py-4 text-right"><StatusPill tone={pkg.status === 'Ready' ? 'success' : 'warning'}>{pkg.status}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <SectionTitle eyebrow="Cost intelligence" title="Recommended plan" />
            <div className="rounded-2xl bg-emerald-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-xs font-black text-emerald-800">Wait until tomorrow</p><p className="mt-1 text-[10px] leading-4 text-emerald-700/70">All 4 packages can still make KQ 887.</p></div>
                <Sparkles className="h-5 w-5 text-emerald-700" />
              </div>
            </div>
            <div className="mt-4 space-y-3 text-xs">
              <div className="flex justify-between"><span className="text-slate-500">Ship separately</span><span className="font-bold">TZS 591,200</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Consolidated</span><span className="font-bold">TZS 504,800</span></div>
              <div className="border-t border-dashed border-slate-200 pt-3">
                <div className="flex justify-between text-emerald-700"><span className="font-bold">You save</span><span className="text-lg font-black">TZS 86,400</span></div>
              </div>
            </div>
            <Button
              className="mt-5 w-full"
              disabled={approved}
              onClick={() => {
                setApproved(true);
                notify('Consolidation approved. Flight booking is now reserved.');
              }}
            >
              {approved ? <CheckCircle2 className="h-4 w-4" /> : <Boxes className="h-4 w-4" />}
              {approved ? 'Consolidation approved' : 'Approve recommended plan'}
            </Button>
          </Card>
          <Card className="p-5">
            <SectionTitle eyebrow="Decision guardrails" title="What we check" />
            <div className="space-y-3">
              {[
                ['Flight cutoff protected', true],
                ['Restricted goods compatible', true],
                ['Chargeable weight optimized', true],
                ['Supplier parcel still moving', false],
              ].map(([label, good]) => (
                <div key={String(label)} className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                  {good ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Clock3 className="h-4 w-4 text-amber-600" />}
                  {String(label)}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ControlTowerView() {
  const [filter, setFilter] = useState<'All' | 'Critical' | 'High'>('All');
  const visibleExceptions = EXCEPTIONS.filter((item) => filter === 'All' || item.priority === filter);
  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[26px] bg-[#071321] text-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
            </span>
            <div><p className="text-xs font-black">China → Tanzania network</p><p className="text-[9px] text-slate-400">Updated 12 seconds ago</p></div>
          </div>
          <Button variant="secondary" size="sm"><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
        </div>
        <div className="grid gap-px bg-white/10 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Today received', '128', '+14%', Package],
            ['Departing 24h', '2.8 t', '3 flights', Plane],
            ['Customs queue', '19', '3 overdue', ShieldCheck],
            ['Open exceptions', '4', '1 critical', AlertTriangle],
          ].map(([label, value, sub, Icon]) => {
            const MetricIcon = Icon as LucideIcon;
            return (
              <div key={String(label)} className="bg-[#071321] p-5">
                <div className="flex items-start justify-between"><p className="text-xs font-semibold text-slate-400">{String(label)}</p><MetricIcon className="h-4 w-4 text-slate-500" /></div>
                <p className="mt-2 text-3xl font-black tracking-[-0.04em]">{String(value)}</p>
                <p className="mt-1 text-[10px] font-bold text-[#ff8a3a]">{String(sub)}</p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.3fr_.7fr]">
        <Card className="p-5">
          <SectionTitle eyebrow="Live departures" title="Flight capacity" action={<StatusPill tone="info"><Radio className="h-3 w-3" /> KDS live</StatusPill>} />
          <div className="space-y-3">
            {FLIGHTS.map((flight) => (
              <div key={flight.flight} className="rounded-2xl border border-slate-100 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0a1728] text-xs font-black text-white">{flight.flight.split(' ')[0]}</span>
                    <div><p className="text-sm font-black text-[#0a1728]">{flight.flight} · {flight.route}</p><p className="mt-1 text-[10px] text-slate-400">{flight.date} · {flight.aircraft}</p></div>
                  </div>
                  <StatusPill tone={flight.used > 80 ? 'warning' : 'info'}>{flight.status}</StatusPill>
                </div>
                <MiniProgress value={flight.used} orange={flight.used > 75} />
                <div className="mt-2 flex justify-between text-[9px] font-semibold text-slate-400"><span>{flight.weight}</span><span>{flight.used}% used</span></div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle eyebrow="Destination funnel" title="Tanzania today" />
          <div className="space-y-3">
            {[
              ['Arrived DAR', 48, '100%', 'bg-[#0a1728]'],
              ['Under assessment', 31, '65%', 'bg-violet-500'],
              ['Released', 24, '50%', 'bg-[#ff7616]'],
              ['Ready for pickup', 17, '35%', 'bg-emerald-500'],
              ['Delivered', 12, '25%', 'bg-blue-500'],
            ].map(([label, count, width, color]) => (
              <div key={String(label)}>
                <div className="mb-1.5 flex justify-between text-xs"><span className="font-semibold text-slate-600">{String(label)}</span><span className="font-black text-[#0a1728]">{String(count)}</span></div>
                <div className="h-2 rounded-full bg-slate-100"><div className={cn('h-full rounded-full', String(color))} style={{ width: String(width) }} /></div>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-xl bg-amber-50 p-3 text-[10px] leading-4 text-amber-800">
            <strong>Watch:</strong> Tanzania Customs is 18 minutes above the weekday median. Three files need owner action.
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
          <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ff7616]">Exceptions inbox</p><h3 className="mt-1 text-lg font-black text-[#0a1728]">Work what needs attention</h3></div>
          <div className="flex rounded-xl bg-slate-100 p-1">
            {(['All', 'Critical', 'High'] as const).map((item) => (
              <button key={item} onClick={() => setFilter(item)} className={cn('rounded-lg px-3 py-1.5 text-[10px] font-bold', filter === item ? 'bg-white text-[#0a1728] shadow-sm' : 'text-slate-500')}>{item}</button>
            ))}
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {visibleExceptions.map((item) => (
            <div key={item.cargo} className="grid gap-3 px-5 py-4 hover:bg-slate-50 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
              <div className="flex items-start gap-3">
                <span className={cn('mt-0.5 rounded-lg p-2', item.priority === 'Critical' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600')}><AlertTriangle className="h-4 w-4" /></span>
                <div><p className="text-xs font-black text-[#0a1728]">{item.title}</p><p className="mt-1 font-mono text-[9px] text-slate-400">{item.cargo}</p></div>
              </div>
              <p className="text-[10px] font-semibold text-slate-500">{item.owner}</p>
              <p className="text-[10px] font-bold text-slate-400">{item.age}</p>
              <Button variant="secondary" size="sm">Open <ChevronRight className="h-3.5 w-3.5" /></Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function FlightsView({ notify }: { notify: (message: string, tone?: NoticeTone) => void }) {
  const [selectedFlight, setSelectedFlight] = useState('KQ 887');
  const flight = FLIGHTS.find((item) => item.flight === selectedFlight) ?? FLIGHTS[0];
  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
            <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ff7616]">Departure load board</p><h3 className="mt-1 text-lg font-black text-[#0a1728]">{flight.flight} · {flight.route}</h3></div>
            <select value={selectedFlight} onChange={(event) => setSelectedFlight(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-[#0a1728] outline-none">
              {FLIGHTS.map((item) => <option key={item.flight}>{item.flight}</option>)}
            </select>
          </div>
          <div className="bg-[#081524] p-5 text-white">
            <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <div className="mb-3 flex items-center justify-between text-xs"><span className="font-bold text-slate-300">Aircraft weight capacity</span><span className="font-black">{flight.weight}</span></div>
                <div className="h-4 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#ff7616]" style={{ width: `${flight.used}%` }} /></div>
                <div className="mt-2 flex justify-between text-[9px] text-slate-400"><span>{flight.used}% assigned</span><span>{100 - flight.used}% available</span></div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-right"><p className="text-[9px] uppercase text-slate-400">Cargo cutoff</p><p className="mt-1 text-xl font-black">03:40:18</p></div>
            </div>
          </div>
          <div className="grid gap-px bg-slate-100 sm:grid-cols-4">
            {[
              ['Booked', '186', '2,840 kg'],
              ['Screened', '142', '2,104 kg'],
              ['ULD assigned', '118', '1,890 kg'],
              ['Loaded', '74', '1,206 kg'],
            ].map(([label, count, weight]) => (
              <div key={label} className="bg-white p-4"><p className="text-[9px] font-black uppercase text-slate-400">{label}</p><p className="mt-1 text-2xl font-black text-[#0a1728]">{count}</p><p className="text-[10px] text-slate-400">{weight}</p></div>
            ))}
          </div>
          <div className="p-5">
            <SectionTitle eyebrow="Load recommendation" title="Next cargo to assign" action={<Button size="sm" onClick={() => notify('Suggested cargo assigned to AKE 18426 KQ.')}>Auto-assign eligible</Button>} />
            <div className="space-y-2">
              {[
                ['KBC-2607-118', 'DAR · Standard', '46.9 kg', 'Paid · screened', 'High'],
                ['KBC-2607-120', 'DAR · Express', '18.4 kg', 'Paid · screened', 'Urgent'],
                ['KBC-2607-097', 'ZNZ · Standard', '72.1 kg', 'Paid · docs ready', 'Normal'],
              ].map(([id, route, weight, state, priority]) => (
                <div key={id} className="grid gap-2 rounded-xl border border-slate-100 p-3 text-xs sm:grid-cols-[1fr_1fr_auto_auto] sm:items-center">
                  <div><p className="font-black text-[#0a1728]">{id}</p><p className="mt-1 text-[9px] text-slate-400">{route}</p></div>
                  <p className="font-semibold text-slate-500">{state}</p>
                  <p className="font-black text-[#0a1728]">{weight}</p>
                  <StatusPill tone={priority === 'Urgent' ? 'danger' : priority === 'High' ? 'orange' : 'neutral'}>{priority}</StatusPill>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <SectionTitle eyebrow="ULD plan" title="AKE 18426 KQ" action={<StatusPill tone="success">Balanced</StatusPill>} />
            <div className="flex h-40 items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50">
              <div className="text-center"><Archive className="mx-auto h-9 w-9 text-slate-400" /><p className="mt-2 text-sm font-black text-[#0a1728]">14 bundles</p><p className="text-[10px] text-slate-400">1,482 / 1,588 kg</p></div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-slate-400">CG position</p><p className="mt-1 font-black">Within limit</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-slate-400">Volume</p><p className="mt-1 font-black">91% used</p></div>
            </div>
          </Card>
          <Card className="p-5">
            <SectionTitle eyebrow="Aircraft telemetry" title="Flight KQ 887" />
            <div className="flex items-center gap-3 rounded-xl bg-blue-50 p-3">
              <Radio className="h-5 w-5 text-blue-700" />
              <div><p className="text-xs font-black text-blue-900">FlightRadar24 ready</p><p className="mt-1 text-[9px] text-blue-700">Live departure and aircraft position link</p></div>
            </div>
            <Button variant="secondary" className="mt-3 w-full" size="sm"><Globe2 className="h-3.5 w-3.5" /> Open aircraft view</Button>
          </Card>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 p-5"><SectionTitle eyebrow="Air waybills" title="MAWB / HAWB register" action={<Button variant="secondary" size="sm"><Printer className="h-3.5 w-3.5" /> Print manifest</Button>} /></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="bg-slate-50 text-[9px] font-black uppercase tracking-wide text-slate-400"><tr><th className="px-5 py-3">HAWB</th><th className="px-4 py-3">MAWB</th><th className="px-4 py-3">Consignee</th><th className="px-4 py-3">Pieces / weight</th><th className="px-4 py-3">Customs</th><th className="px-5 py-3 text-right">Status</th></tr></thead>
            <tbody>
              {[
                ['KBA-255-070126', '706-44892016', 'Amina Joseph', '4 · 41.3 kg', 'Docs ready', 'Loaded'],
                ['KBA-255-070119', '706-44892016', 'MobiTech Ltd', '2 · 18.4 kg', 'Docs ready', 'ULD assigned'],
                ['KBA-255-070102', '706-44892016', 'Zanzibar Glow', '7 · 72.1 kg', 'Review', 'Screened'],
              ].map((row) => (
                <tr key={row[0]} className="border-t border-slate-100">
                  {row.slice(0, 5).map((cell, index) => <td key={cell} className={cn('px-4 py-4', index === 0 && 'pl-5 font-black text-[#0a1728]')}>{cell}</td>)}
                  <td className="px-5 py-4 text-right"><StatusPill tone={row[5] === 'Loaded' ? 'success' : 'info'}>{row[5]}</StatusPill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function CustomsView({ notify }: { notify: (message: string, tone?: NoticeTone) => void }) {
  const [released, setReleased] = useState(false);
  const documents = [
    ['Commercial invoice', 'Verified', 'invoice-104852.pdf'],
    ['Packing list', 'Verified', 'packing-list-104852.pdf'],
    ['HAWB', 'Verified', 'KBA-255-070126.pdf'],
    ['Battery declaration', 'Action needed', 'Not uploaded'],
    ['Certificate of origin', 'Optional', 'Not required'],
  ];
  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <Card className="p-5">
          <SectionTitle eyebrow="Shipment compliance" title="KBA-255-070126 · document vault" action={<StatusPill tone="warning"><ShieldCheck className="h-3 w-3" /> 1 action needed</StatusPill>} />
          <div className="space-y-2">
            {documents.map(([name, status, file]) => (
              <div key={name} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3">
                <div className="flex items-center gap-3">
                  <span className={cn('rounded-lg p-2', status === 'Action needed' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500')}><FileText className="h-4 w-4" /></span>
                  <div><p className="text-xs font-black text-[#0a1728]">{name}</p><p className="mt-1 text-[9px] text-slate-400">{file}</p></div>
                </div>
                <StatusPill tone={status === 'Verified' ? 'success' : status === 'Action needed' ? 'danger' : 'neutral'}>{status}</StatusPill>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end"><Button onClick={() => notify('Battery declaration request sent to the supplier.', 'info')}><MessageCircle className="h-4 w-4" /> Request missing document</Button></div>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <SectionTitle eyebrow="Restricted goods" title="Compliance screen" />
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600" />
                <div><p className="text-xs font-black text-red-800">Lithium battery declaration required</p><p className="mt-1 text-[10px] leading-4 text-red-700">Power banks in KBP-104852-04 require Wh rating, UN38.3 confirmation and approved packing declaration.</p></div>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-xs">
              {[
                ['Commodity classification', '8507.60 · Review'],
                ['Dangerous goods', 'PI 965 Section IA'],
                ['Screening owner', 'Li Wei · China compliance'],
              ].map(([label, value]) => <div key={label} className="flex justify-between border-b border-slate-100 py-2 last:border-0"><span className="text-slate-500">{label}</span><span className="font-bold text-[#0a1728]">{value}</span></div>)}
            </div>
          </Card>
          <Card className="p-5">
            <SectionTitle eyebrow="Access control" title="Sensitive files protected" />
            <div className="flex items-center gap-3"><span className="rounded-xl bg-blue-50 p-3 text-blue-700"><LockKeyhole className="h-5 w-5" /></span><p className="text-xs leading-5 text-slate-500">Customer, broker and customs roles only see documents needed for their workflow. Every view and change is audited.</p></div>
          </Card>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 p-5"><SectionTitle eyebrow="Tanzania clearance" title="Assessment to release reconciliation" /></div>
        <div className="grid gap-px bg-slate-100 md:grid-cols-4">
          {[
            ['Manifest submitted', 'Jul 25 · 08:12', 'complete'],
            ['Assessment received', 'TZS 184,600', 'complete'],
            ['Payment reconciled', 'TRA-8849201', 'complete'],
            ['Cargo released', released ? 'Release confirmed' : 'Awaiting customs', released ? 'complete' : 'pending'],
          ].map(([label, detail, status], index) => (
            <div key={label} className="bg-white p-5">
              <span className={cn('flex h-8 w-8 items-center justify-center rounded-full', status === 'complete' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400')}>
                {status === 'complete' ? <Check className="h-4 w-4" /> : <span className="text-xs font-black">{index + 1}</span>}
              </span>
              <p className="mt-3 text-xs font-black text-[#0a1728]">{label}</p><p className="mt-1 text-[10px] text-slate-400">{detail}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div><p className="text-xs font-black text-[#0a1728]">Customs reference: TANSAD 2026/07/88492</p><p className="mt-1 text-[10px] text-slate-400">Broker: E. Mushi · Last synced 3 minutes ago</p></div>
          <Button
            disabled={released}
            onClick={() => {
              setReleased(true);
              notify('Release reconciled. Cargo is ready for destination receiving.');
            }}
          >
            <RefreshCw className="h-4 w-4" /> {released ? 'Release reconciled' : 'Reconcile release'}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function BusinessView({ notify }: { notify: (message: string, tone?: NoticeTone) => void }) {
  const [productCost, setProductCost] = useState(2_400_000);
  const [weight, setWeight] = useState(41.3);
  const [quantity, setQuantity] = useState(120);
  const freight = weight * 10_200;
  const insurance = productCost * 0.012;
  const duty = productCost * 0.18;
  const handling = 68_000;
  const total = productCost + freight + insurance + duty + handling;
  const unit = total / Math.max(quantity, 1);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
        <Card className="p-5">
          <SectionTitle eyebrow="Supplier workspace" title="China supplier book" action={<Button size="sm"><Users className="h-3.5 w-3.5" /> Add supplier</Button>} />
          <div className="space-y-2">
            {[
              ['Shenzhen Nova Tech', 'Electronics · Shenzhen', '12 orders', '98%', 'Verified'],
              ['Guangzhou Luma', 'Lighting · Guangzhou', '8 orders', '96%', 'Verified'],
              ['Yiwu Mobi', 'Accessories · Yiwu', '21 orders', '94%', 'Verified'],
              ['Dongguan Power', 'Batteries · Dongguan', '3 orders', '82%', 'Review'],
            ].map(([name, category, orders, score, status]) => (
              <div key={name} className="grid gap-2 rounded-xl border border-slate-100 p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Building2 className="h-4 w-4" /></span><div><p className="text-xs font-black text-[#0a1728]">{name}</p><p className="mt-1 text-[9px] text-slate-400">{category} · {orders}</p></div></div>
                <div className="text-right"><p className="text-xs font-black text-[#0a1728]">{score}</p><p className="text-[9px] text-slate-400">on-time</p></div>
                <StatusPill tone={status === 'Verified' ? 'success' : 'warning'}>{status}</StatusPill>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-2xl bg-[#081524] p-5 text-white">
            <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ff8a3a]">Procurement request</p><h3 className="mt-2 text-lg font-black">Source Android POS terminals</h3><p className="mt-1 text-xs text-slate-400">120 units · delivery to Guangzhou hub · target USD 42/unit</p></div><ShoppingCart className="h-6 w-6 text-slate-500" /></div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                ['Quotes', '6'],
                ['Best price', '$39.80'],
                ['Lead time', '8 days'],
              ].map(([label, value]) => <div key={label} className="rounded-xl bg-white/[0.06] p-3"><p className="text-[9px] text-slate-400">{label}</p><p className="mt-1 text-sm font-black">{value}</p></div>)}
            </div>
            <Button className="mt-4 w-full" onClick={() => notify('Best three procurement quotes opened for comparison.', 'info')}>Compare supplier quotes <ArrowRight className="h-4 w-4" /></Button>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 p-5"><SectionTitle eyebrow="Landed-cost calculator" title="Know the true cost before buying" /></div>
          <div className="p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">Product value (TZS)
                <input type="number" value={productCost} onChange={(event) => setProductCost(Number(event.target.value))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-[#0a1728] outline-none focus:border-[#ff7616]" />
              </label>
              <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">Chargeable weight (kg)
                <input type="number" value={weight} onChange={(event) => setWeight(Number(event.target.value))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-[#0a1728] outline-none focus:border-[#ff7616]" />
              </label>
              <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">Product quantity
                <input type="number" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-[#0a1728] outline-none focus:border-[#ff7616]" />
              </label>
              <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">Air rate
                <div className="mt-2 flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-[#0a1728]">TZS 10,200 / kg</div>
              </label>
            </div>
            <div className="mt-5 rounded-2xl bg-slate-50 p-4">
              <div className="space-y-2 text-xs">
                {[
                  ['Product cost', productCost],
                  ['Air freight', freight],
                  ['Insurance', insurance],
                  ['Estimated duty & taxes', duty],
                  ['Handling and last mile', handling],
                ].map(([label, value]) => <div key={String(label)} className="flex justify-between"><span className="text-slate-500">{String(label)}</span><span className="font-bold text-[#0a1728]">TZS {Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span></div>)}
              </div>
              <div className="mt-4 border-t border-dashed border-slate-300 pt-4">
                <div className="flex items-end justify-between gap-4"><div><p className="text-[10px] font-black uppercase text-slate-400">Estimated landed total</p><p className="mt-1 text-2xl font-black tracking-tight text-[#0a1728]">TZS {total.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p></div><div className="text-right"><p className="text-[10px] text-slate-400">Per unit</p><p className="mt-1 text-lg font-black text-[#ff7616]">TZS {unit.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p></div></div>
              </div>
            </div>
            <Button variant="dark" className="mt-4 w-full"><CircleDollarSign className="h-4 w-4" /> Save cost scenario</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function DeliveryView({ notify }: { notify: (message: string, tone?: NoticeTone) => void }) {
  const [verified, setVerified] = useState(false);
  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[.7fr_1.3fr]">
        <Card className="p-5">
          <SectionTitle eyebrow="Secure customer pickup" title="Scan cargo release QR" />
          <div className="mx-auto flex max-w-[250px] justify-center rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <QRCodeSVG value="KOBE-TZ-104852|KBA-255-070126|PICKUP" size={180} level="H" fgColor="#081524" />
          </div>
          <div className="mt-4 text-center"><p className="text-sm font-black text-[#0a1728]">KOBE-TZ-104852</p><p className="mt-1 text-[10px] text-slate-400">Amina Joseph · 4 pieces · 41.3 kg</p></div>
          <Button
            className="mt-5 w-full"
            disabled={verified}
            onClick={() => {
              setVerified(true);
              notify('Pickup identity and one-time code verified.');
            }}
          >
            {verified ? <CheckCircle2 className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
            {verified ? 'Identity verified' : 'Verify ID + OTP'}
          </Button>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 p-5"><SectionTitle eyebrow="Destination warehouse" title="Ready for pickup and dispatch" action={<StatusPill tone="success">17 ready</StatusPill>} /></div>
          <div className="divide-y divide-slate-100">
            {[
              ['KOBE-TZ-104852', 'Amina Joseph', '4 pcs · 41.3 kg', 'Pickup · 15:30', 'Ready'],
              ['KOBE-TZ-104611', 'MobiTech Ltd', '2 pcs · 18.4 kg', 'Delivery · Kinondoni', 'Assigned'],
              ['KOBE-TZ-104392', 'Zanzibar Glow', '7 pcs · 72.1 kg', 'Transfer · ZNZ', 'Staged'],
              ['KOBE-TZ-104208', 'Raha Retail', '1 pc · 9.8 kg', 'Delivery · Masaki', 'Out for delivery'],
            ].map(([id, customer, cargo, mode, status]) => (
              <div key={id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                <div className="flex items-center gap-3"><span className="rounded-xl bg-slate-100 p-2.5 text-slate-600"><Package className="h-4 w-4" /></span><div><p className="text-xs font-black text-[#0a1728]">{id}</p><p className="mt-1 text-[9px] text-slate-400">{customer} · {cargo}</p></div></div>
                <p className="text-[10px] font-semibold text-slate-500">{mode}</p>
                <StatusPill tone={status === 'Ready' ? 'success' : status === 'Out for delivery' ? 'orange' : 'info'}>{status}</StatusPill>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.3fr_.7fr]">
        <Card className="p-5">
          <SectionTitle eyebrow="Last-mile control" title="Driver routes" />
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ['Juma M.', 'DAR-NORTH-04', '7 stops', '82%', 'On route'],
              ['Neema S.', 'DAR-CENTRAL-02', '5 stops', '40%', 'On route'],
              ['Hassan K.', 'DAR-SOUTH-01', '6 stops', '100%', 'Complete'],
            ].map(([driver, routeCode, stops, progress, status]) => (
              <div key={driver} className="rounded-2xl border border-slate-100 p-4">
                <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0a1728] text-xs font-black text-white">{driver.charAt(0)}</span><div><p className="text-xs font-black text-[#0a1728]">{driver}</p><p className="mt-1 text-[9px] text-slate-400">{routeCode}</p></div></div>
                <div className="mt-4"><MiniProgress value={Number(progress.replace('%', ''))} orange={status !== 'Complete'} /></div>
                <div className="mt-2 flex justify-between text-[9px] font-semibold text-slate-400"><span>{stops}</span><span>{status}</span></div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <SectionTitle eyebrow="Proof of delivery" title="Trusted handoff" />
          <div className="space-y-3">
            {[
              [QrCode, 'QR / OTP release'],
              [Camera, 'Package and recipient photo'],
              [Navigation, 'GPS and timestamp capture'],
              [FileCheck2, 'Digital signature and receipt'],
            ].map(([Icon, label]) => {
              const ProofIcon = Icon as LucideIcon;
              return <div key={String(label)} className="flex items-center gap-3 text-xs font-semibold text-slate-600"><span className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><ProofIcon className="h-4 w-4" /></span>{String(label)}</div>;
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Sidebar({
  view,
  onView,
}: {
  view: View;
  onView: (view: View) => void;
}) {
  return (
    <aside className="hidden h-full w-[238px] shrink-0 flex-col border-r border-white/[0.06] bg-[#071321] text-white lg:flex">
      <div className="flex h-[76px] items-center gap-3 border-b border-white/[0.07] px-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ff7616] shadow-[0_10px_25px_rgba(255,118,22,.25)]"><Plane className="h-5 w-5 -rotate-12" /></span>
        <div><p className="text-sm font-black tracking-tight">KOBE AIR</p><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">Cargo OS</p></div>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group, groupIndex) => (
          <div key={group.label} className={cn(groupIndex > 0 && 'mt-5')}>
            <p className="mb-2 px-3 text-[9px] font-black uppercase tracking-[0.18em] text-slate-600">{group.label}</p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = view === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onView(item.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-bold transition',
                      active ? 'bg-white/[0.09] text-white shadow-inner' : 'text-slate-400 hover:bg-white/[0.05] hover:text-white',
                    )}
                  >
                    <Icon className={cn('h-4 w-4 shrink-0', active && 'text-[#ff8a3a]')} />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.badge && <span className={cn('rounded-md px-1.5 py-0.5 text-[8px] font-black', item.badge === 'LIVE' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-[#ff7616]/15 text-[#ff9a55]')}>{item.badge}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/[0.07] p-4">
        <div className="rounded-2xl bg-white/[0.04] p-3">
          <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400" /><p className="text-[10px] font-bold">All core services online</p></div>
          <p className="mt-2 text-[9px] leading-4 text-slate-500">CAN · NBO · DAR synced moments ago</p>
        </div>
        <button className="mt-3 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-bold text-slate-400 hover:bg-white/[0.05] hover:text-white"><Settings className="h-4 w-4" /> Settings</button>
      </div>
    </aside>
  );
}

function MobileNavigation({
  view,
  onView,
}: {
  view: View;
  onView: (view: View) => void;
}) {
  const items = NAV_GROUPS.flatMap((group) => group.items);
  return (
    <div className="border-b border-slate-200 bg-white px-3 py-2 lg:hidden">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} onClick={() => onView(item.id)} className={cn('flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-[10px] font-bold', view === item.id ? 'bg-[#0a1728] text-white' : 'bg-slate-100 text-slate-600')}>
              <Icon className="h-3.5 w-3.5" /> {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Notice({
  message,
  tone,
  onClose,
}: {
  message: string;
  tone: NoticeTone;
  onClose: () => void;
}) {
  const toneClasses = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    info: 'border-blue-200 bg-blue-50 text-blue-800',
  };
  return (
    <div className={cn('fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl', toneClasses[tone])}>
      {tone === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : tone === 'warning' ? <AlertTriangle className="h-5 w-5 shrink-0" /> : <Bell className="h-5 w-5 shrink-0" />}
      <p className="text-xs font-bold">{message}</p>
      <button onClick={onClose} className="rounded-lg p-1 hover:bg-black/5"><X className="h-4 w-4" /></button>
    </div>
  );
}

export default function KobeAirCargo() {
  const [view, setView] = useState<View>('dashboard');
  const [trackingQuery, setTrackingQuery] = useState('KBA-255-070126');
  const [notice, setNotice] = useState<{ message: string; tone: NoticeTone } | null>(null);
  const meta = VIEW_META[view];

  const notify = (message: string, tone: NoticeTone = 'success') => {
    setNotice({ message, tone });
    window.setTimeout(() => setNotice((current) => current?.message === message ? null : current), 4200);
  };

  const navigate = (nextView: View) => {
    setView(nextView);
    window.requestAnimationFrame(() => {
      let node = document.querySelector('[data-module="kobe-air-cargo"]')?.parentElement;
      while (node && node !== document.body) {
        const overflowY = window.getComputedStyle(node).overflowY;
        if (overflowY === 'auto' || overflowY === 'scroll') {
          node.scrollTop = 0;
          break;
        }
        node = node.parentElement;
      }
    });
  };

  const onTrack = (value: string) => {
    setTrackingQuery(value || 'KBA-255-070126');
    navigate('tracking');
  };

  const content = useMemo(() => {
    switch (view) {
      case 'dashboard':
        return <DashboardView navigate={navigate} onTrack={onTrack} />;
      case 'tracking':
        return <TrackingView initialQuery={trackingQuery} />;
      case 'warehouse':
        return <WarehouseView notify={notify} />;
      case 'consolidation':
        return <ConsolidationView notify={notify} />;
      case 'control':
        return <ControlTowerView />;
      case 'flights':
        return <FlightsView notify={notify} />;
      case 'customs':
        return <CustomsView notify={notify} />;
      case 'business':
        return <BusinessView notify={notify} />;
      case 'delivery':
        return <DeliveryView notify={notify} />;
      default:
        return null;
    }
  // The view switch intentionally owns the interactive demo state for each workspace.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, trackingQuery]);

  return (
    <div
      className="flex h-full min-h-0 overflow-hidden bg-[#eef1f6] font-sans text-[#0a1728]"
      data-module="kobe-air-cargo"
      style={{
        '--bg-input': '#ffffff',
        '--border-secondary': '#cbd5e1',
        '--border-focus': '#ff7616',
        '--text-primary': '#0a1728',
        '--text-placeholder': '#94a3b8',
      } as React.CSSProperties}
    >
      <Sidebar view={view} onView={navigate} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[76px] shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 md:px-6">
          <div className="min-w-0">
            <p className="truncate text-[9px] font-black uppercase tracking-[0.18em] text-[#ff7616]">{meta.eyebrow}</p>
            <h1 className="mt-1 truncate text-lg font-black tracking-[-0.025em] text-[#0a1728]">{meta.title}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 md:flex">
              <QrCode className="h-4 w-4 text-[#ff7616]" />
              <div><p className="text-[8px] font-bold uppercase text-slate-400">China cargo ID</p><p className="text-[10px] font-black text-[#0a1728]">KOBE-CN-104852</p></div>
            </div>
            <button className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"><Bell className="h-4 w-4" /><span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#ff7616] ring-2 ring-white" /></button>
            <button className="flex h-10 items-center gap-2 rounded-xl bg-[#0a1728] px-2 text-white">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ff7616] text-[10px] font-black">AJ</span>
              <span className="hidden pr-1 text-[10px] font-bold sm:block">Amina</span>
            </button>
          </div>
        </header>
        <MobileNavigation view={view} onView={navigate} />
        <main key={view} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1540px] p-4 md:p-6">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <p className="max-w-2xl text-xs leading-5 text-slate-500">{meta.description}</p>
              <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Real-time operations · Last sync now
              </div>
            </div>
            {content}
          </div>
        </main>
      </div>
      {notice && <Notice message={notice.message} tone={notice.tone} onClose={() => setNotice(null)} />}
    </div>
  );
}
