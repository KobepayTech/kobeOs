import { useState, useMemo } from 'react';
import {
  PackageSearch, Search, MapPin, Phone, User, Weight,
  Clock, CheckCircle2, Truck, Box,
  Bell, Check, ChevronRight, Navigation,
  AlertCircle, ArrowRight, X, DollarSign, Ruler, Package
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { QRCodeSVG } from 'qrcode.react';
import { ScrollArea } from '@/components/ui/scroll-area';

// ─── Types ───────────────────────────────────────────────────────────────────
type ParcelStatus = 'REGISTERED' | 'VERIFIED' | 'PAID' | 'IN_TRANSIT' | 'ARRIVED' | 'DELIVERED';

interface TimelineEvent {
  status: ParcelStatus;
  label: string;
  date: string;
  time: string;
  location: string;
  description: string;
}

interface Parcel {
  id: string;
  senderName: string;
  senderPhone: string;
  receiverName: string;
  receiverPhone: string;
  origin: string;
  destination: string;
  status: ParcelStatus;
  weight: number;
  dimensions: string;
  description: string;
  transportFee: number;
  insurance: number;
  registeredDate: string;
  timeline: TimelineEvent[];
}

interface Notification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  parcelId: string;
}

// ─── Mock Data ───────────────────────────────────────────────────────────────
const PARCELS: Parcel[] = [
  {
    id: 'KBE-001', senderName: 'John Doe', senderPhone: '0712345678',
    receiverName: 'Jane Smith', receiverPhone: '0755123456',
    origin: 'Guangzhou', destination: 'Dar es Salaam',
    status: 'IN_TRANSIT', weight: 15, dimensions: '60x40x35 cm',
    description: 'Electronics - LED displays and accessories',
    transportFee: 450, insurance: 25, registeredDate: '2024-01-15',
    timeline: [
      { status: 'REGISTERED', label: 'Parcel Registered', date: '2024-01-15', time: '09:30', location: 'Guangzhou', description: 'Parcel registered at origin facility' },
      { status: 'VERIFIED', label: 'Parcel Verified', date: '2024-01-15', time: '14:20', location: 'Guangzhou', description: 'Contents verified and approved' },
      { status: 'PAID', label: 'Payment Received', date: '2024-01-15', time: '16:45', location: 'Guangzhou', description: 'Transport fee and insurance paid' },
      { status: 'IN_TRANSIT', label: 'In Transit', date: '2024-01-16', time: '08:00', location: 'Indian Ocean', description: 'Shipped via sea freight - Est. arrival Jan 28' },
    ],
  },
  {
    id: 'KBE-002', senderName: 'John Doe', senderPhone: '0712345678',
    receiverName: 'Mike Brown', receiverPhone: '0755987654',
    origin: 'Shanghai', destination: 'Zanzibar',
    status: 'ARRIVED', weight: 8, dimensions: '45x30x25 cm',
    description: 'Fashion items - Clothing and accessories',
    transportFee: 280, insurance: 15, registeredDate: '2024-01-10',
    timeline: [
      { status: 'REGISTERED', label: 'Parcel Registered', date: '2024-01-10', time: '10:00', location: 'Shanghai', description: 'Parcel registered at origin facility' },
      { status: 'VERIFIED', label: 'Parcel Verified', date: '2024-01-10', time: '15:30', location: 'Shanghai', description: 'Contents verified and approved' },
      { status: 'PAID', label: 'Payment Received', date: '2024-01-10', time: '17:00', location: 'Shanghai', description: 'Transport fee and insurance paid' },
      { status: 'IN_TRANSIT', label: 'In Transit', date: '2024-01-11', time: '06:00', location: 'Indian Ocean', description: 'Shipped via sea freight' },
      { status: 'ARRIVED', label: 'Arrived at Destination', date: '2024-01-22', time: '11:30', location: 'Zanzibar', description: 'Parcel arrived at Zanzibar port - Ready for pickup' },
    ],
  },
  {
    id: 'KBE-003', senderName: 'Sarah Lee', senderPhone: '0788765432',
    receiverName: 'Tom Wilson', receiverPhone: '0755112233',
    origin: 'Beijing', destination: 'Arusha',
    status: 'DELIVERED', weight: 25, dimensions: '80x50x45 cm',
    description: 'Industrial machinery parts',
    transportFee: 750, insurance: 50, registeredDate: '2024-01-05',
    timeline: [
      { status: 'REGISTERED', label: 'Parcel Registered', date: '2024-01-05', time: '08:15', location: 'Beijing', description: 'Parcel registered at origin facility' },
      { status: 'VERIFIED', label: 'Parcel Verified', date: '2024-01-05', time: '12:00', location: 'Beijing', description: 'Contents verified and approved' },
      { status: 'PAID', label: 'Payment Received', date: '2024-01-05', time: '14:30', location: 'Beijing', description: 'Transport fee and insurance paid' },
      { status: 'IN_TRANSIT', label: 'In Transit', date: '2024-01-06', time: '04:00', location: 'Indian Ocean', description: 'Shipped via sea freight' },
      { status: 'ARRIVED', label: 'Arrived at Destination', date: '2024-01-18', time: '09:45', location: 'Arusha', description: 'Parcel arrived at Arusha logistics hub' },
      { status: 'DELIVERED', label: 'Delivered', date: '2024-01-19', time: '14:00', location: 'Arusha', description: 'Parcel delivered to receiver - Signed by Tom Wilson' },
    ],
  },
  {
    id: 'KBE-004', senderName: 'John Doe', senderPhone: '0712345678',
    receiverName: 'Lisa Chen', receiverPhone: '0755778899',
    origin: 'Guangzhou', destination: 'Dar es Salaam',
    status: 'VERIFIED', weight: 5, dimensions: '30x20x15 cm',
    description: 'Mobile phone accessories',
    transportFee: 150, insurance: 10, registeredDate: '2024-01-20',
    timeline: [
      { status: 'REGISTERED', label: 'Parcel Registered', date: '2024-01-20', time: '11:00', location: 'Guangzhou', description: 'Parcel registered at origin facility' },
      { status: 'VERIFIED', label: 'Parcel Verified', date: '2024-01-20', time: '16:30', location: 'Guangzhou', description: 'Contents verified and approved - Awaiting payment' },
    ],
  },
  {
    id: 'KBE-005', senderName: 'Sarah Lee', senderPhone: '0788765432',
    receiverName: 'David Park', receiverPhone: '0755443322',
    origin: 'Shenzhen', destination: 'Mwanza',
    status: 'PAID', weight: 12, dimensions: '55x35x30 cm',
    description: 'Solar panels and components',
    transportFee: 380, insurance: 30, registeredDate: '2024-01-18',
    timeline: [
      { status: 'REGISTERED', label: 'Parcel Registered', date: '2024-01-18', time: '09:00', location: 'Shenzhen', description: 'Parcel registered at origin facility' },
      { status: 'VERIFIED', label: 'Parcel Verified', date: '2024-01-18', time: '13:30', location: 'Shenzhen', description: 'Contents verified and approved' },
      { status: 'PAID', label: 'Payment Received', date: '2024-01-18', time: '15:45', location: 'Shenzhen', description: 'Transport fee and insurance paid - Awaiting shipment' },
    ],
  },
];

const INITIAL_NOTIFICATIONS: Notification[] = [
  { id: 'n1', title: 'Parcel In Transit', message: 'Your parcel KBE-001 is now in transit to Dar es Salaam.', timestamp: '2 hours ago', read: false, parcelId: 'KBE-001' },
  { id: 'n2', title: 'Parcel Arrived', message: 'Parcel KBE-002 has arrived at Zanzibar port. Ready for pickup!', timestamp: '1 day ago', read: false, parcelId: 'KBE-002' },
  { id: 'n3', title: 'Delivery Completed', message: 'Parcel KBE-003 has been delivered to Tom Wilson in Arusha.', timestamp: '3 days ago', read: true, parcelId: 'KBE-003' },
  { id: 'n4', title: 'Payment Confirmation', message: 'Payment received for parcel KBE-005. Your shipment will depart soon.', timestamp: '2 days ago', read: false, parcelId: 'KBE-005' },
  { id: 'n5', title: 'Verification Complete', message: 'Parcel KBE-004 has been verified and is awaiting payment.', timestamp: '5 hours ago', read: true, parcelId: 'KBE-004' },
  { id: 'n6', title: 'Delivery Scheduled', message: 'Delivery for parcel KBE-002 is scheduled for tomorrow between 9AM - 12PM.', timestamp: '5 hours ago', read: false, parcelId: 'KBE-002' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<ParcelStatus, { color: string; bg: string; icon: React.ReactNode }> = {
  REGISTERED: { color: 'text-slate-400', bg: 'bg-slate-500/20 border-slate-500/40', icon: <Box className="w-3.5 h-3.5" /> },
  VERIFIED:   { color: 'text-blue-400', bg: 'bg-blue-500/20 border-blue-500/40', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  PAID:       { color: 'text-emerald-400', bg: 'bg-emerald-500/20 border-emerald-500/40', icon: <DollarSign className="w-3.5 h-3.5" /> },
  IN_TRANSIT: { color: 'text-amber-400', bg: 'bg-amber-500/20 border-amber-500/40', icon: <Truck className="w-3.5 h-3.5" /> },
  ARRIVED:    { color: 'text-purple-400', bg: 'bg-purple-500/20 border-purple-500/40', icon: <MapPin className="w-3.5 h-3.5" /> },
  DELIVERED:  { color: 'text-emerald-400', bg: 'bg-emerald-500/20 border-emerald-500/40', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
};

function statusLabel(s: ParcelStatus) {
  return s.replace('_', ' ');
}

function formatCurrency(n: number) {
  return `$${n.toFixed(2)}`;
}

// ─── Sub-Components ──────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: ParcelStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={`${cfg.bg} ${cfg.color} border font-medium text-xs gap-1`}>
      {cfg.icon}
      {statusLabel(status)}
    </Badge>
  );
}

function ParcelTimeline({ parcel }: { parcel: Parcel }) {
  const timelineSteps: ParcelStatus[] = ['REGISTERED', 'VERIFIED', 'PAID', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED'];
  const currentIdx = timelineSteps.indexOf(parcel.status);

  const stepBg = (idx: number) => {
    if (idx < currentIdx) return 'bg-emerald-500 border-emerald-500';
    if (idx === currentIdx) return 'bg-blue-500 border-blue-500';
    return 'bg-slate-800 border-slate-600';
  };

  const lineColor = (idx: number) => {
    if (idx < currentIdx) return 'bg-emerald-500/50';
    return 'bg-slate-700';
  };

  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
        <Clock className="w-4 h-4 text-emerald-400" /> Tracking Timeline
      </h4>
      <div className="relative pl-2">
        {timelineSteps.map((step, idx) => {
          const event = parcel.timeline.find(e => e.status === step);
          const isCompleted = idx <= currentIdx;
          return (
            <div key={step} className="relative flex gap-4 pb-5 last:pb-0">
              {/* Connecting line */}
              {idx < timelineSteps.length - 1 && (
                <div className={`absolute left-[11px] top-7 w-0.5 h-[calc(100%-12px)] ${lineColor(idx)}`} />
              )}
              {/* Dot */}
              <div className={`relative z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${stepBg(idx)}`}>
                {idx < currentIdx && <Check className="w-3 h-3 text-white" />}
                {idx === currentIdx && <div className="w-2 h-2 bg-white rounded-full" />}
              </div>
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${isCompleted ? 'text-slate-200' : 'text-slate-500'}`}>
                    {step.replace('_', ' ')}
                  </span>
                  {idx === currentIdx && (
                    <Badge variant="outline" className="bg-blue-500/10 border-blue-500/30 text-blue-400 text-[10px] px-1.5 py-0">Current</Badge>
                  )}
                </div>
                {event && (
                  <>
                    <p className="text-xs text-slate-400 mt-0.5">{event.description}</p>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {event.date} {event.time}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {event.location}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ParcelDetailCard({ parcel, onClose }: { parcel: Parcel; onClose: () => void }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
            <PackageSearch className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{parcel.id}</h3>
            <p className="text-xs text-slate-400">Registered {parcel.registeredDate}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={parcel.status} />
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* QR Code */}
      <div className="flex justify-center mb-5">
        <div className="bg-white p-3 rounded-xl shadow-lg">
          <QRCodeSVG value={parcel.id} size={120} level="M" />
        </div>
      </div>

      {/* Route */}
      <Card className="bg-white/5 backdrop-blur-md border-white/10 mb-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-center">
              <MapPin className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
              <p className="text-sm font-semibold text-white">{parcel.origin}</p>
              <p className="text-[10px] text-slate-400">Origin</p>
            </div>
            <div className="flex-1 mx-4 relative">
              <div className="h-0.5 bg-emerald-500/30 rounded-full" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900 px-2">
                <ArrowRight className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            <div className="text-center">
              <Navigation className="w-5 h-5 text-blue-400 mx-auto mb-1" />
              <p className="text-sm font-semibold text-white">{parcel.destination}</p>
              <p className="text-[10px] text-slate-400">Destination</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Sender */}
        <Card className="bg-white/5 backdrop-blur-md border-white/10">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <User className="w-3 h-3" /> Sender
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-1">
            <p className="text-sm font-medium text-white">{parcel.senderName}</p>
            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
              <Phone className="w-3 h-3" /> {parcel.senderPhone}
            </p>
          </CardContent>
        </Card>

        {/* Receiver */}
        <Card className="bg-white/5 backdrop-blur-md border-white/10">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <User className="w-3 h-3" /> Receiver
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-1">
            <p className="text-sm font-medium text-white">{parcel.receiverName}</p>
            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
              <Phone className="w-3 h-3" /> {parcel.receiverPhone}
            </p>
          </CardContent>
        </Card>

        {/* Package Details */}
        <Card className="bg-white/5 backdrop-blur-md border-white/10 col-span-2">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <Package className="w-3 h-3" /> Package Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-1">
            <p className="text-sm text-slate-200">{parcel.description}</p>
            <div className="flex gap-4 mt-2 text-xs text-slate-400">
              <span className="flex items-center gap-1"><Weight className="w-3 h-3" /> {parcel.weight} kg</span>
              <span className="flex items-center gap-1"><Ruler className="w-3 h-3" /> {parcel.dimensions}</span>
            </div>
          </CardContent>
        </Card>

        {/* Payment Summary */}
        <Card className="bg-white/5 backdrop-blur-md border-white/10 col-span-2">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <DollarSign className="w-3 h-3" /> Payment Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-1">
            <div className="flex justify-between text-sm text-slate-300 mb-1">
              <span>Transport Fee</span>
              <span>{formatCurrency(parcel.transportFee)}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-300 mb-1">
              <span>Insurance</span>
              <span>{formatCurrency(parcel.insurance)}</span>
            </div>
            <div className="h-px bg-white/10 my-2" />
            <div className="flex justify-between text-base font-bold text-emerald-400">
              <span>Total</span>
              <span>{formatCurrency(parcel.transportFee + parcel.insurance)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <ParcelTimeline parcel={parcel} />
    </div>
  );
}

function ParcelCard({ parcel, onClick }: { parcel: Parcel; onClick: () => void }) {
  return (
    <Card
      className="bg-white/5 backdrop-blur-md border-white/10 hover:bg-white/10 hover:border-emerald-500/30 transition-all duration-200 cursor-pointer group"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h4 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">{parcel.id}</h4>
            <p className="text-[10px] text-slate-400 mt-0.5">{parcel.registeredDate}</p>
          </div>
          <StatusBadge status={parcel.status} />
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-300 mb-2">
          <span>{parcel.origin}</span>
          <ArrowRight className="w-3 h-3 text-emerald-400" />
          <span>{parcel.destination}</span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1"><Weight className="w-3 h-3" /> {parcel.weight} kg</span>
          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function CargoOwner() {
  const [activeTab, setActiveTab] = useState('track');
  const [searchQuery, setSearchQuery] = useState('');
  const [phoneQuery, setPhoneQuery] = useState('');
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);
  const [myParcelsFilter, setMyParcelsFilter] = useState<'ALL' | ParcelStatus>('ALL');

  // Track tab search
  const trackResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.trim().toLowerCase();
    return PARCELS.filter(p =>
      p.id.toLowerCase().includes(q) ||
      p.senderPhone.includes(q) ||
      p.receiverPhone.includes(q)
    );
  }, [searchQuery]);

  // My Parcels lookup
  const myParcels = useMemo(() => {
    if (!phoneQuery.trim()) return [];
    return PARCELS.filter(p => p.senderPhone === phoneQuery.trim() || p.receiverPhone === phoneQuery.trim());
  }, [phoneQuery]);

  const filteredMyParcels = useMemo(() => {
    if (myParcelsFilter === 'ALL') return myParcels;
    return myParcels.filter(p => p.status === myParcelsFilter);
  }, [myParcels, myParcelsFilter]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-slate-900/80 backdrop-blur-md flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
            <PackageSearch className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">KOBECARGO</h1>
            <p className="text-[10px] text-slate-400">Public Parcel Tracking</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Bell className="w-5 h-5 text-slate-400" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="px-4 pt-3 pb-1 border-b border-white/5 flex-shrink-0">
          <TabsList className="w-full bg-white/5 border border-white/10 p-1 h-10">
            <TabsTrigger value="track" className="flex-1 data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 text-slate-400 text-xs gap-1.5">
              <Search className="w-3.5 h-3.5" /> Track Parcel
            </TabsTrigger>
            <TabsTrigger value="myparcels" className="flex-1 data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 text-slate-400 text-xs gap-1.5">
              <Box className="w-3.5 h-3.5" /> My Parcels
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex-1 data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 text-slate-400 text-xs gap-1.5">
              <Bell className="w-3.5 h-3.5" /> Notifications
              {unreadCount > 0 && (
                <span className="ml-0.5 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold flex items-center justify-center text-white">{unreadCount}</span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          {/* ── Track Parcel Tab ── */}
          <TabsContent value="track" className="m-0 p-5 space-y-4">
            {selectedParcel ? (
              <ParcelDetailCard parcel={selectedParcel} onClose={() => setSelectedParcel(null)} />
            ) : (
              <>
                {/* Hero Search */}
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold text-white mb-1">Track Your Parcel</h2>
                  <p className="text-sm text-slate-400">Enter your Parcel ID or phone number</p>
                </div>

                <div className="flex gap-2 max-w-lg mx-auto mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      placeholder="e.g. KBE-001 or 0712345678"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && trackResults.length > 0 && setSelectedParcel(trackResults[0])}
                      className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-emerald-500/20 h-11"
                    />
                  </div>
                  <Button
                    className="bg-emerald-500 hover:bg-emerald-600 text-white h-11 px-6"
                    onClick={() => trackResults.length > 0 && setSelectedParcel(trackResults[0])}
                  >
                    Track
                  </Button>
                </div>

                {/* Quick search hints */}
                {!searchQuery && (
                  <div className="flex flex-wrap gap-2 justify-center mb-4">
                    {['KBE-001', 'KBE-002', '0712345678', '0788765432'].map(hint => (
                      <button
                        key={hint}
                        onClick={() => setSearchQuery(hint)}
                        className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-slate-400 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/30 transition-all"
                      >
                        {hint}
                      </button>
                    ))}
                  </div>
                )}

                {/* Results */}
                {searchQuery && (
                  <div>
                    <p className="text-xs text-slate-500 mb-3">
                      {trackResults.length} result{trackResults.length !== 1 ? 's' : ''} found
                    </p>
                    {trackResults.length > 0 ? (
                      <div className="space-y-3 max-w-lg mx-auto">
                        {trackResults.map(parcel => (
                          <ParcelCard
                            key={parcel.id}
                            parcel={parcel}
                            onClick={() => setSelectedParcel(parcel)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-10 max-w-lg mx-auto">
                        <AlertCircle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                        <p className="text-sm text-slate-400">No parcels found matching &quot;{searchQuery}&quot;</p>
                        <p className="text-xs text-slate-500 mt-1">Try a different Parcel ID or phone number</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Empty state illustration */}
                {!searchQuery && (
                  <div className="text-center py-8 opacity-40">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
                      <Truck className="w-10 h-10 text-emerald-500" />
                    </div>
                    <p className="text-sm text-slate-400">Enter a Parcel ID or phone number to start tracking</p>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* ── My Parcels Tab ── */}
          <TabsContent value="myparcels" className="m-0 p-5 space-y-4">
            {selectedParcel ? (
              <ParcelDetailCard parcel={selectedParcel} onClose={() => setSelectedParcel(null)} />
            ) : (
              <>
                <div className="max-w-lg mx-auto">
                  <h2 className="text-lg font-bold text-white mb-1">My Parcels</h2>
                  <p className="text-xs text-slate-400 mb-4">Enter your phone number to see all your parcels</p>

                  <div className="flex gap-2 mb-5">
                    <div className="relative flex-1">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <Input
                        placeholder="Enter phone number e.g. 0712345678"
                        value={phoneQuery}
                        onChange={e => setPhoneQuery(e.target.value)}
                        className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-emerald-500/20 h-10"
                      />
                    </div>
                    <Button
                      className="bg-emerald-500 hover:bg-emerald-600 text-white h-10 px-5"
                      onClick={() => {}}
                    >
                      Lookup
                    </Button>
                  </div>

                  {/* Quick phone hints */}
                  {!phoneQuery && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {['0712345678', '0788765432'].map(hint => (
                        <button
                          key={hint}
                          onClick={() => setPhoneQuery(hint)}
                          className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-slate-400 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/30 transition-all"
                        >
                          {hint}
                        </button>
                      ))}
                    </div>
                  )}

                  {phoneQuery && myParcels.length > 0 && (
                    <>
                      {/* Filter tabs */}
                      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
                        {(['ALL', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED', 'VERIFIED', 'PAID', 'REGISTERED'] as const).map(f => (
                          <button
                            key={f}
                            onClick={() => setMyParcelsFilter(f)}
                            className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-all ${
                              myParcelsFilter === f
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                            }`}
                          >
                            {f === 'ALL' ? `All (${myParcels.length})` : statusLabel(f)}
                          </button>
                        ))}
                      </div>

                      <p className="text-xs text-slate-500 mb-3">
                        {filteredMyParcels.length} parcel{filteredMyParcels.length !== 1 ? 's' : ''} found
                      </p>

                      <div className="space-y-3">
                        {filteredMyParcels.map(parcel => (
                          <ParcelCard
                            key={parcel.id}
                            parcel={parcel}
                            onClick={() => setSelectedParcel(parcel)}
                          />
                        ))}
                      </div>
                    </>
                  )}

                  {phoneQuery && myParcels.length === 0 && (
                    <div className="text-center py-10">
                      <AlertCircle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                      <p className="text-sm text-slate-400">No parcels found for {phoneQuery}</p>
                      <p className="text-xs text-slate-500 mt-1">Try a different phone number</p>
                    </div>
                  )}
                </div>

                {!phoneQuery && (
                  <div className="text-center py-8 opacity-40">
                    <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-blue-500/10 flex items-center justify-center">
                      <Box className="w-8 h-8 text-blue-500" />
                    </div>
                    <p className="text-sm text-slate-400">Enter your phone number to view your parcels</p>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* ── Notifications Tab ── */}
          <TabsContent value="notifications" className="m-0 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">Notifications</h2>
                <p className="text-xs text-slate-400">
                  {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                </p>
              </div>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={markAllRead} className="text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10">
                  <Check className="w-3.5 h-3.5 mr-1" /> Mark all read
                </Button>
              )}
            </div>

            <div className="space-y-2">
              {notifications.map(n => (
                <Card
                  key={n.id}
                  className={`border transition-all cursor-pointer ${
                    n.read
                      ? 'bg-white/[0.02] border-white/5 opacity-60'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                  onClick={() => markAsRead(n.id)}
                >
                  <CardContent className="p-3.5">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        n.read ? 'bg-slate-800' : 'bg-emerald-500/20 border border-emerald-500/30'
                      }`}>
                        {n.title.includes('Transit') ? <Truck className="w-4 h-4 text-amber-400" /> :
                         n.title.includes('Arrived') ? <MapPin className="w-4 h-4 text-purple-400" /> :
                         n.title.includes('Delivered') ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> :
                         n.title.includes('Payment') ? <DollarSign className="w-4 h-4 text-emerald-400" /> :
                         <Bell className="w-4 h-4 text-blue-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className={`text-sm font-medium ${n.read ? 'text-slate-400' : 'text-white'}`}>
                            {n.title}
                          </h4>
                          {!n.read && <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{n.message}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {n.timestamp}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedParcel(PARCELS.find(p => p.id === n.parcelId) || null);
                              setActiveTab('track');
                            }}
                            className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5"
                          >
                            View Parcel <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
