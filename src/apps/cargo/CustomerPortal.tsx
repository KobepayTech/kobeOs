import { useState, useMemo, useCallback } from 'react';
import {
  Send, Package, MapPin, User, Weight, Ruler,
  CreditCard, Banknote, Smartphone, Receipt,
  CheckCircle2, ArrowRight, ArrowLeft, Search,
  Box, Clock, DollarSign, Shield, ChevronRight,
  Truck, Wifi, WifiOff, FileText, Upload, Download,
  ScanLine, Phone, Mail, Globe, Star, X, Navigation,
  ClipboardList, TrendingUp, CalendarDays, Loader2,
  ChevronDown,
} from 'lucide-react';
import { useCargoParcels, type ApiParcel } from '@/hooks/useCargoParcels';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { QRCodeSVG } from 'qrcode.react';

/* ------------------------------------------------------------------ */
/*  TYPES                                                              */
/* ------------------------------------------------------------------ */
interface SenderInfo {
  name: string; phone: string; email: string; address: string; country: string;
}
interface ReceiverInfo {
  name: string; phone: string; email: string; address: string; country: string;
}
interface PackageDetails {
  description: string; category: string; quantity: number;
  weight: number; length: number; width: number; height: number;
  declaredValue: number;
}
interface ShippingOptions {
  route: string; speed: string; insurance: boolean;
}
interface PaymentInfo {
  mode: string; method: string;
}

interface Shipment {
  id: string;
  senderPhone: string;
  senderName: string;
  receiverName: string;
  receiverCountry: string;
  status: 'REGISTERED' | 'IN_TRANSIT' | 'ARRIVED' | 'DELIVERED' | 'CANCELLED';
  date: string;
  weight: number;
  category: string;
  route: string;
  timeline: { status: string; date: string; location: string; completed: boolean }[];
}

interface TrackingEvent {
  id: string;
  type: string;
  location: string;
  timestamp: string;
  completed: boolean;
}

/* ------------------------------------------------------------------ */
/*  CONSTANTS                                                          */
/* ------------------------------------------------------------------ */
const COUNTRIES = ['China', 'Tanzania', 'Kenya', 'Uganda', 'Rwanda', 'Zambia', 'Nigeria', 'Ghana', 'South Africa', 'India', 'UAE', 'USA', 'UK'];
const CATEGORIES = ['Electronics', 'Textiles', 'Machinery', 'Food', 'Documents', 'Other'];
const ROUTES = [
  { label: 'Guangzhou \u2192 Dar es Salaam', from: 'China', to: 'Tanzania' },
  { label: 'Shanghai \u2192 Zanzibar', from: 'China', to: 'Tanzania' },
  { label: 'Shenzhen \u2192 Mombasa', from: 'China', to: 'Kenya' },
  { label: 'Yiwu \u2192 Kampala', from: 'China', to: 'Uganda' },
  { label: 'Beijing \u2192 Kigali', from: 'China', to: 'Rwanda' },
];
const SPEEDS = [
  { label: 'Standard', days: '15-20 days', factor: 1 },
  { label: 'Express', days: '10-14 days', factor: 1.6 },
  { label: 'Urgent', days: '5-8 days', factor: 2.5 },
];
const PAYMENT_METHODS = {
  PAY_NOW: [
    { key: 'bank', label: 'Bank Transfer', icon: CreditCard },
    { key: 'mobile', label: 'Mobile Money', icon: Smartphone },
    { key: 'card', label: 'Credit/Debit Card', icon: CreditCard },
    { key: 'cash', label: 'Cash Payment', icon: Banknote },
  ],
  PAY_ON_ARRIVAL: [{ key: 'cod', label: 'Pay on Arrival', icon: Receipt }],
};

const STATUS_COLORS: Record<string, string> = {
  REGISTERED: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  IN_TRANSIT: 'bg-blue-100 text-blue-700 border-blue-300',
  ARRIVED: 'bg-amber-100 text-amber-700 border-amber-300',
  DELIVERED: 'bg-slate-100 text-slate-600 border-slate-300',
  CANCELLED: 'bg-red-100 text-red-700 border-red-300',
};

const STATUS_ORDER = ['REGISTERED', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED'];
const TIMELINE_STEPS: { key: string; label: string }[] = [
  { key: 'REGISTERED', label: 'Parcel Registered' },
  { key: 'IN_TRANSIT', label: 'In Transit' },
  { key: 'ARRIVED', label: 'Arrived Destination' },
  { key: 'DELIVERED', label: 'Delivered' },
];

/* ------------------------------------------------------------------ */
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */
function buildTimeline(status: string, destination: string): Shipment['timeline'] {
  if (status === 'CANCELLED') {
    return [
      { status: 'Parcel Registered', date: '\u2014', location: 'Origin Hub', completed: true },
      { status: 'Cancelled', date: '\u2014', location: '\u2014', completed: true },
    ];
  }
  const currentIdx = STATUS_ORDER.indexOf(status);
  return TIMELINE_STEPS.map((step, i) => ({
    status: step.label,
    date: '\u2014',
    location: step.key === 'ARRIVED' || step.key === 'DELIVERED' ? (destination || '\u2014') : '\u2014',
    completed: i <= currentIdx,
  }));
}

function parcelToShipment(p: ApiParcel): Shipment {
  const allowed = ['REGISTERED', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED', 'CANCELLED'];
  const status = (allowed.includes(p.status) ? p.status : 'REGISTERED') as Shipment['status'];
  return {
    id: p.parcelId,
    senderPhone: p.senderPhone,
    senderName: p.senderName,
    receiverName: p.ownerName,
    receiverCountry: p.destination,
    status,
    date: p.createdAt ? p.createdAt.slice(0, 10) : '\u2014',
    weight: p.weight,
    category: p.description || '\u2014',
    route: p.destination ? `\u2192 ${p.destination}` : '',
    timeline: buildTimeline(p.status, p.destination),
  };
}

function calcQuote(weight: number, routeIdx: number, speedIdx: number, category: string, insurance: boolean) {
  const routePrices = [8, 9, 7, 8.5, 9.5];
  const catMultipliers: Record<string, number> = {
    Electronics: 1.3, Textiles: 0.8, Machinery: 1.5, Food: 1.1, Documents: 0.5, Other: 1,
  };
  const baseRate = routePrices[routeIdx] ?? 8;
  const catMul = catMultipliers[category] ?? 1;
  const speedMul = SPEEDS[speedIdx]?.factor ?? 1;
  const transportFee = weight * baseRate * catMul * speedMul;
  const insuranceFee = insurance ? transportFee * 0.03 : 0;
  const subtotal = transportFee + insuranceFee;
  const vat = subtotal * 0.18;
  const total = subtotal + vat;
  return { transportFee, insuranceFee, subtotal, vat, total };
}

function genParcelId(name: string) {
  const clean = name.replace(/\s+/g, '').slice(0, 8) || 'Sender';
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const seq = String(Math.floor(Math.random() * 900) + 100);
  return `KBE-${clean}-${date}-${seq}`;
}

function fmtMoney(n: number) {
  return '$' + n.toFixed(2);
}

/* ------------------------------------------------------------------ */
/*  GLASS CARD  — reusable wrapper for consistent styling              */
/* ------------------------------------------------------------------ */
function GlassCard({ children, className = '', onClick }: {
  children: React.ReactNode; className?: string; onClick?: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      className={`bg-white/[0.30] backdrop-blur-xl border border-white/[0.40] rounded-2xl shadow-sm ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} ${className}`}
    >
      {children}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  MAIN COMPONENT                                                     */
/* ------------------------------------------------------------------ */
export default function CustomerPortal() {
  const [activeTab, setActiveTab] = useState<'book' | 'shipments' | 'track' | 'documents'>('book');

  /* ---------- Wizard state ---------- */
  const [step, setStep] = useState(1);
  const [sender, setSender] = useState<SenderInfo>({
    name: '', phone: '', email: '', address: '', country: 'China',
  });
  const [receiver, setReceiver] = useState<ReceiverInfo>({
    name: '', phone: '', email: '', address: '', country: 'Tanzania',
  });
  const [pkg, setPkg] = useState<PackageDetails>({
    description: '', category: 'Electronics', quantity: 1,
    weight: 1, length: 10, width: 10, height: 10, declaredValue: 0,
  });
  const [shipping, setShipping] = useState<ShippingOptions>({
    route: ROUTES[0].label, speed: 'Standard', insurance: false,
  });
  const [payment, setPayment] = useState<PaymentInfo>({ mode: 'PAY_NOW', method: 'bank' });
  const [submitted, setSubmitted] = useState(false);
  const [parcelId, setParcelId] = useState('');
  const [agreed, setAgreed] = useState(false);

  /* ---------- Shipments state ---------- */
  const { parcels, connected, createParcel } = useCargoParcels();
  const shipments = useMemo(() => parcels.map(parcelToShipment), [parcels]);
  const [searchPhone, setSearchPhone] = useState('');
  const [searched, setSearched] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedShipment = useMemo(
    () => shipments.find(s => s.id === selectedId) ?? null,
    [shipments, selectedId],
  );

  /* ---------- Track & Trace state ---------- */
  const [trackId, setTrackId] = useState('');
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackResult, setTrackResult] = useState<{ shipment: Shipment; events: TrackingEvent[] } | null>(null);

  /* ---------- Documents state ---------- */
  const [uploadOpen, setUploadOpen] = useState(false);
  const [docType, setDocType] = useState('');

  /* ---------- Memos ---------- */
  const filteredShipments = useMemo(() => {
    if (!searched || !searchPhone) return shipments;
    return shipments.filter(s => s.senderPhone.includes(searchPhone));
  }, [shipments, searchPhone, searched]);

  const currentQuote = useMemo(() => {
    const routeIdx = Math.max(0, ROUTES.findIndex(r => r.label === shipping.route));
    const speedIdx = SPEEDS.findIndex(s => s.label === shipping.speed);
    return calcQuote(pkg.weight, routeIdx, speedIdx, pkg.category, shipping.insurance);
  }, [pkg.weight, pkg.category, shipping]);

  /* ---------- Wizard handlers ---------- */
  const nextStep = () => setStep(s => Math.min(s + 1, 6));
  const prevStep = () => { if (step > 1) setStep(s => s - 1); };

  const handleSubmit = async () => {
    const id = genParcelId(sender.name);
    setParcelId(id);
    setSubmitted(true);
    try {
      await createParcel({
        parcelId: id,
        senderName: sender.name, senderPhone: sender.phone,
        ownerName: receiver.name, ownerPhone: receiver.phone,
        destination: receiver.country,
        weight: pkg.weight,
        description: pkg.description,
        paymentMode: payment.mode === 'PAY_NOW' ? 'PAY_NOW' : 'PAY_ON_ARRIVAL',
      });
    } catch { /* offline \u2014 queued */ }
  };

  const resetWizard = () => {
    setStep(1); setSubmitted(false); setParcelId(''); setAgreed(false);
    setSender({ name: '', phone: '', email: '', address: '', country: 'China' });
    setReceiver({ name: '', phone: '', email: '', address: '', country: 'Tanzania' });
    setPkg({ description: '', category: 'Electronics', quantity: 1, weight: 1, length: 10, width: 10, height: 10, declaredValue: 0 });
    setShipping({ route: ROUTES[0].label, speed: 'Standard', insurance: false });
    setPayment({ mode: 'PAY_NOW', method: 'bank' });
  };

  /* ---------- Tracking handler ---------- */
  const handleTrack = useCallback(async () => {
    if (!trackId.trim()) return;
    setTrackLoading(true);
    // Try to find in local shipments first
    const found = shipments.find(s => s.id === trackId || s.id.toLowerCase().includes(trackId.toLowerCase()));
    if (found) {
      setTrackResult({ shipment: found, events: found.timeline.map((t, i) => ({
        id: `e-${i}`, type: t.status, location: t.location, timestamp: t.date, completed: t.completed,
      })) });
      setTrackLoading(false);
      return;
    }
    // Fall back to API
    try {
      const data = await api<TrackingEvent[]>(`/cargo/air/events?shipmentId=${encodeURIComponent(trackId)}`);
      if (data && data.length > 0) {
        setTrackResult({
          shipment: { ...found!, id: trackId, senderPhone: '', senderName: '', receiverName: '', receiverCountry: '', status: 'IN_TRANSIT', date: '', weight: 0, category: '', route: '', timeline: [] },
          events: data,
        });
      }
    } catch {
      // Show empty result if not found
      setTrackResult(null);
    } finally {
      setTrackLoading(false);
    }
  }, [trackId, shipments]);

  /* ---------------------------------------------------------------- */
  /*  STEP RENDERERS                                                   */
  /* ---------------------------------------------------------------- */
  const renderStepper = () => (
    <div className="flex items-center justify-between mb-6 px-2">
      {[1, 2, 3, 4, 5, 6].map((s, i) => (
        <div key={s} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              step >= s ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'bg-white/40 text-slate-600 border border-white/50'
            }`}>
              {step > s ? <CheckCircle2 size={14} /> : s}
            </div>
            <span className={`text-[10px] hidden sm:block ${step >= s ? 'text-emerald-600' : 'text-slate-600'}`}>
              {['Sender', 'Receiver', 'Package', 'Shipping', 'Payment', 'Review'][i]}
            </span>
          </div>
          {i < 5 && <div className={`h-0.5 flex-1 mx-2 transition-all ${step > s ? 'bg-emerald-500' : 'bg-white/30'}`} />}
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
        <User size={18} className="text-emerald-600" /> Sender Information
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="text-xs text-slate-700 mb-1 block">Full Name *</label>
          <Input placeholder="Enter your full name" value={sender.name}
            onChange={e => setSender({ ...sender, name: e.target.value })}
            className="bg-white/40 border-white/50 text-slate-700 placeholder:text-slate-600 focus:border-emerald-400 rounded-xl" />
        </div>
        <div>
          <label className="text-xs text-slate-700 mb-1 block">Phone Number *</label>
          <Input placeholder="+255..." value={sender.phone}
            onChange={e => setSender({ ...sender, phone: e.target.value })}
            className="bg-white/40 border-white/50 text-slate-700 placeholder:text-slate-600 focus:border-emerald-400 rounded-xl" />
        </div>
        <div>
          <label className="text-xs text-slate-700 mb-1 block">Email</label>
          <Input placeholder="email@example.com" value={sender.email}
            onChange={e => setSender({ ...sender, email: e.target.value })}
            className="bg-white/40 border-white/50 text-slate-700 placeholder:text-slate-600 focus:border-emerald-400 rounded-xl" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-slate-700 mb-1 block">Address *</label>
          <Input placeholder="Street address, city" value={sender.address}
            onChange={e => setSender({ ...sender, address: e.target.value })}
            className="bg-white/40 border-white/50 text-slate-700 placeholder:text-slate-600 focus:border-emerald-400 rounded-xl" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-slate-700 mb-1 block">Country *</label>
          <select value={sender.country}
            onChange={e => setSender({ ...sender, country: e.target.value })}
            className="w-full rounded-xl border border-white/50 bg-white/40 text-slate-700 px-3 py-2.5 text-sm focus:border-emerald-400 focus:outline-none">
            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
        <MapPin size={18} className="text-emerald-600" /> Receiver Information
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="text-xs text-slate-700 mb-1 block">Full Name *</label>
          <Input placeholder="Receiver's full name" value={receiver.name}
            onChange={e => setReceiver({ ...receiver, name: e.target.value })}
            className="bg-white/40 border-white/50 text-slate-700 placeholder:text-slate-600 focus:border-emerald-400 rounded-xl" />
        </div>
        <div>
          <label className="text-xs text-slate-700 mb-1 block">Phone Number *</label>
          <Input placeholder="+255..." value={receiver.phone}
            onChange={e => setReceiver({ ...receiver, phone: e.target.value })}
            className="bg-white/40 border-white/50 text-slate-700 placeholder:text-slate-600 focus:border-emerald-400 rounded-xl" />
        </div>
        <div>
          <label className="text-xs text-slate-700 mb-1 block">Email</label>
          <Input placeholder="email@example.com" value={receiver.email}
            onChange={e => setReceiver({ ...receiver, email: e.target.value })}
            className="bg-white/40 border-white/50 text-slate-700 placeholder:text-slate-600 focus:border-emerald-400 rounded-xl" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-slate-700 mb-1 block">Address *</label>
          <Input placeholder="Street address, city" value={receiver.address}
            onChange={e => setReceiver({ ...receiver, address: e.target.value })}
            className="bg-white/40 border-white/50 text-slate-700 placeholder:text-slate-600 focus:border-emerald-400 rounded-xl" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-slate-700 mb-1 block">Country *</label>
          <select value={receiver.country}
            onChange={e => setReceiver({ ...receiver, country: e.target.value })}
            className="w-full rounded-xl border border-white/50 bg-white/40 text-slate-700 px-3 py-2.5 text-sm focus:border-emerald-400 focus:outline-none">
            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
        <Package size={18} className="text-emerald-600" /> Package Details
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="text-xs text-slate-700 mb-1 block">Description *</label>
          <Input placeholder="What's inside the package?" value={pkg.description}
            onChange={e => setPkg({ ...pkg, description: e.target.value })}
            className="bg-white/40 border-white/50 text-slate-700 placeholder:text-slate-600 focus:border-emerald-400 rounded-xl" />
        </div>
        <div>
          <label className="text-xs text-slate-700 mb-1 block">Category *</label>
          <select value={pkg.category}
            onChange={e => setPkg({ ...pkg, category: e.target.value })}
            className="w-full rounded-xl border border-white/50 bg-white/40 text-slate-700 px-3 py-2.5 text-sm focus:border-emerald-400 focus:outline-none">
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-700 mb-1 block">Quantity *</label>
          <Input type="number" min={1} value={pkg.quantity}
            onChange={e => setPkg({ ...pkg, quantity: Number(e.target.value) })}
            className="bg-white/40 border-white/50 text-slate-700 focus:border-emerald-400 rounded-xl" />
        </div>
        <div>
          <label className="text-xs text-slate-700 mb-1 flex items-center gap-1">
            <Weight size={12} /> Weight (kg) *
          </label>
          <Input type="number" min={0.1} step={0.1} value={pkg.weight}
            onChange={e => setPkg({ ...pkg, weight: Number(e.target.value) })}
            className="bg-white/40 border-white/50 text-slate-700 focus:border-emerald-400 rounded-xl" />
        </div>
        <div>
          <label className="text-xs text-slate-700 mb-1 block">Declared Value ($)</label>
          <Input type="number" min={0} value={pkg.declaredValue}
            onChange={e => setPkg({ ...pkg, declaredValue: Number(e.target.value) })}
            className="bg-white/40 border-white/50 text-slate-700 focus:border-emerald-400 rounded-xl" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-slate-700 mb-1 flex items-center gap-1">
            <Ruler size={12} /> Dimensions (cm)
          </label>
          <div className="grid grid-cols-3 gap-2">
            <Input type="number" placeholder="Length" value={pkg.length}
              onChange={e => setPkg({ ...pkg, length: Number(e.target.value) })}
              className="bg-white/40 border-white/50 text-slate-700 placeholder:text-slate-600 focus:border-emerald-400 rounded-xl" />
            <Input type="number" placeholder="Width" value={pkg.width}
              onChange={e => setPkg({ ...pkg, width: Number(e.target.value) })}
              className="bg-white/40 border-white/50 text-slate-700 placeholder:text-slate-600 focus:border-emerald-400 rounded-xl" />
            <Input type="number" placeholder="Height" value={pkg.height}
              onChange={e => setPkg({ ...pkg, height: Number(e.target.value) })}
              className="bg-white/40 border-white/50 text-slate-700 placeholder:text-slate-600 focus:border-emerald-400 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
        <Truck size={18} className="text-emerald-600" /> Shipping Options
      </h3>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-slate-700 mb-2 block">Select Route *</label>
          <div className="grid grid-cols-1 gap-2">
            {ROUTES.map(r => (
              <button key={r.label}
                onClick={() => setShipping({ ...shipping, route: r.label })}
                className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                  shipping.route === r.label
                    ? 'border-emerald-400 bg-emerald-50/50'
                    : 'border-white/50 bg-white/20 hover:bg-white/30'
                }`}>
                <div className="flex items-center gap-2">
                  <MapPin size={16} className={shipping.route === r.label ? 'text-emerald-600' : 'text-slate-600'} />
                  <span className="text-sm text-slate-700">{r.label}</span>
                </div>
                {shipping.route === r.label && <CheckCircle2 size={16} className="text-emerald-600" />}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-700 mb-2 block">Shipping Speed *</label>
          <div className="grid grid-cols-3 gap-2">
            {SPEEDS.map(s => (
              <button key={s.label}
                onClick={() => setShipping({ ...shipping, speed: s.label })}
                className={`p-3 rounded-xl border text-center transition-all ${
                  shipping.speed === s.label
                    ? 'border-emerald-400 bg-emerald-50/50'
                    : 'border-white/50 bg-white/20 hover:bg-white/30'
                }`}>
                <div className="text-sm font-medium text-slate-700">{s.label}</div>
                <div className="text-xs text-slate-700 mt-1 flex items-center justify-center gap-1">
                  <Clock size={10} />{s.days}
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl border border-white/50 bg-white/20">
          <Shield size={18} className="text-emerald-600" />
          <div className="flex-1">
            <div className="text-sm text-slate-700">Insurance Coverage</div>
            <div className="text-xs text-slate-700">3% of transport fee - covers loss &amp; damage</div>
          </div>
          <button onClick={() => setShipping({ ...shipping, insurance: !shipping.insurance })}
            className={`w-10 h-6 rounded-full transition-all ${shipping.insurance ? 'bg-emerald-500' : 'bg-slate-300'}`}>
            <div className={`w-4 h-4 rounded-full bg-white transition-all ${shipping.insurance ? 'ml-5' : 'ml-1'}`} />
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
        <DollarSign size={18} className="text-emerald-600" /> Payment
      </h3>
      <GlassCard>
        <CardContent className="p-4">
          <h4 className="text-sm font-semibold text-emerald-700 mb-3">Instant Quote</h4>
          <div className="space-y-2 text-sm text-slate-600">
            <div className="flex justify-between"><span>Transport Fee</span><span className="font-medium">{fmtMoney(currentQuote.transportFee)}</span></div>
            <div className="flex justify-between"><span>Insurance</span><span className="font-medium">{fmtMoney(currentQuote.insuranceFee)}</span></div>
            <div className="flex justify-between"><span>Subtotal</span><span className="font-medium">{fmtMoney(currentQuote.subtotal)}</span></div>
            <div className="flex justify-between"><span>VAT (18%)</span><span className="font-medium">{fmtMoney(currentQuote.vat)}</span></div>
            <div className="h-px bg-white/40 my-2" />
            <div className="flex justify-between text-lg font-bold text-emerald-700">
              <span>Total</span><span>{fmtMoney(currentQuote.total)}</span>
            </div>
          </div>
        </CardContent>
      </GlassCard>
      <div>
        <label className="text-xs text-slate-700 mb-2 block">Payment Mode</label>
        <div className="flex gap-2 mb-3">
          {['PAY_NOW', 'PAY_ON_ARRIVAL'].map(m => (
            <button key={m}
              onClick={() => setPayment({ mode: m, method: m === 'PAY_NOW' ? 'bank' : 'cod' })}
              className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                payment.mode === m
                  ? 'border-emerald-400 bg-emerald-50/50 text-emerald-700'
                  : 'border-white/50 bg-white/20 text-slate-700 hover:bg-white/30'
              }`}>
              {m === 'PAY_NOW' ? 'Pay Now' : 'Pay on Arrival'}
            </button>
          ))}
        </div>
        <label className="text-xs text-slate-700 mb-2 block">Payment Method</label>
        <div className="grid grid-cols-2 gap-2">
          {(payment.mode === 'PAY_NOW' ? PAYMENT_METHODS.PAY_NOW : PAYMENT_METHODS.PAY_ON_ARRIVAL).map(m => {
            const Icon = m.icon;
            return (
              <button key={m.key}
                onClick={() => setPayment({ ...payment, method: m.key })}
                className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all ${
                  payment.method === m.key
                    ? 'border-emerald-400 bg-emerald-50/50'
                    : 'border-white/50 bg-white/20 hover:bg-white/30'
                }`}>
                <Icon size={16} className={payment.method === m.key ? 'text-emerald-600' : 'text-slate-600'} />
                <span className="text-xs text-slate-700">{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderStep6 = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
        <Receipt size={18} className="text-emerald-600" /> Review &amp; Submit
      </h3>
      <div className="space-y-3">
        <GlassCard><CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><User size={14} /> Sender</div>
          <div className="text-xs text-slate-600">{sender.name} | {sender.phone}</div>
          <div className="text-xs text-slate-700">{sender.address}, {sender.country}</div>
        </CardContent></GlassCard>
        <GlassCard><CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><MapPin size={14} /> Receiver</div>
          <div className="text-xs text-slate-600">{receiver.name} | {receiver.phone}</div>
          <div className="text-xs text-slate-700">{receiver.address}, {receiver.country}</div>
        </CardContent></GlassCard>
        <GlassCard><CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><Box size={14} /> Package</div>
          <div className="text-xs text-slate-600">{pkg.category} - {pkg.description}</div>
          <div className="text-xs text-slate-700">{pkg.quantity} pcs | {pkg.weight}kg | {pkg.length}x{pkg.width}x{pkg.height}cm | ${pkg.declaredValue}</div>
        </CardContent></GlassCard>
        <GlassCard><CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><Truck size={14} /> Shipping</div>
          <div className="text-xs text-slate-600">{shipping.route} - {shipping.speed}</div>
          <div className="text-xs text-slate-700">Insurance: {shipping.insurance ? 'Yes' : 'No'} | Payment: {payment.mode === 'PAY_NOW' ? 'Pay Now' : 'Pay on Arrival'}</div>
        </CardContent></GlassCard>
        <div className="p-3 rounded-xl border border-emerald-300 bg-emerald-50/50">
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-emerald-700">Total Amount</span>
            <span className="text-lg font-bold text-emerald-700">{fmtMoney(currentQuote.total)}</span>
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={agreed}
            onChange={e => setAgreed(e.target.checked)}
            className="rounded border-white/40 bg-white/30 accent-emerald-500" />
          <span className="text-xs text-slate-700">I agree to the terms and conditions of KOBECARGO shipping services.</span>
        </label>
      </div>
    </div>
  );

  const renderSuccess = () => (
    <div className="flex flex-col items-center justify-center py-8 text-center space-y-6">
      <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center animate-pulse">
        <CheckCircle2 size={48} className="text-emerald-600" />
      </div>
      <div>
        <h3 className="text-2xl font-bold text-slate-700 mb-2">Shipment Created!</h3>
        <p className="text-slate-700 text-sm">Your parcel has been registered successfully.</p>
      </div>
      <GlassCard className="w-full max-w-sm">
        <CardContent className="p-4 flex flex-col items-center gap-3">
          <QRCodeSVG value={`https://kobecargo.com/track/${parcelId}`} size={128} bgColor="transparent" fgColor="#059669" />
          <div className="text-center">
            <div className="text-xs text-slate-700">Parcel ID</div>
            <div className="text-lg font-bold text-emerald-700 font-mono">{parcelId}</div>
          </div>
        </CardContent>
      </GlassCard>
      <div className="flex gap-3">
        <Button onClick={resetWizard} variant="outline"
          className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded-xl">Send Another</Button>
        <Button onClick={() => { setActiveTab('shipments'); resetWizard(); }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl">Track Shipments</Button>
      </div>
    </div>
  );

  /* ---------------------------------------------------------------- */
  /*  MY SHIPMENTS TAB                                                 */
  /* ---------------------------------------------------------------- */
  const renderShipments = () => (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <GlassCard>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Search size={14} className="text-emerald-600" /> Find Your Shipments
          </h3>
          <div className="flex gap-2">
            <Input placeholder="Enter sender phone number..." value={searchPhone}
              onChange={e => setSearchPhone(e.target.value)}
              className="bg-white/40 border-white/50 text-slate-700 placeholder:text-slate-600 focus:border-emerald-400 rounded-xl" />
            <Button onClick={() => setSearched(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 rounded-xl">
              <Search size={16} />
            </Button>
          </div>
          <p className="text-xs text-slate-700 mt-2">Search by the sender phone used at registration.</p>
        </CardContent>
      </GlassCard>

      {searched && filteredShipments.length === 0 && (
        <div className="text-center py-8 text-slate-600 text-sm">No shipments found for this phone number.</div>
      )}

      <div className="space-y-3">
        {(searched ? filteredShipments : shipments).map(s => (
          <GlassCard key={s.id} onClick={() => setSelectedId(s.id)}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-emerald-700">{s.id}</span>
                    <Badge variant="outline" className={`${STATUS_COLORS[s.status]} text-xs`}>
                      {s.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="text-sm text-slate-700 font-medium">{s.receiverName}</div>
                  <div className="flex items-center gap-3 text-xs text-slate-700">
                    <span className="flex items-center gap-1"><MapPin size={10} />{s.receiverCountry}</span>
                    <span className="flex items-center gap-1"><Weight size={10} />{s.weight}kg</span>
                    <span className="flex items-center gap-1"><Clock size={10} />{s.date}</span>
                  </div>
                  <div className="text-xs text-slate-600">{s.route}</div>
                </div>
                <ChevronRight size={16} className="text-slate-600 mt-1" />
              </div>
            </CardContent>
          </GlassCard>
        ))}
      </div>
    </div>
  );

  /* ---------------------------------------------------------------- */
  /*  TRACK & TRACE TAB                                                */
  /* ---------------------------------------------------------------- */
  const renderTrack = () => (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <GlassCard>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <ScanLine size={14} className="text-emerald-600" /> Track Your Shipment
          </h3>
          <div className="flex gap-2">
            <Input placeholder="Enter AWB / Parcel ID / Tracking number..." value={trackId}
              onChange={e => setTrackId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleTrack()}
              className="bg-white/40 border-white/50 text-slate-700 placeholder:text-slate-600 focus:border-emerald-400 rounded-xl" />
            <Button onClick={handleTrack} disabled={trackLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 rounded-xl min-w-[80px]">
              {trackLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            </Button>
          </div>
          <p className="text-xs text-slate-700 mt-2">Enter your parcel ID or AWB number to track.</p>
        </CardContent>
      </GlassCard>

      {/* Tracking Result */}
      {trackResult && (
        <div className="space-y-4">
          <GlassCard>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Package size={20} className="text-emerald-600" />
                </div>
                <div>
                  <div className="text-sm font-mono font-bold text-slate-700">{trackResult.shipment.id}</div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`${STATUS_COLORS[trackResult.shipment.status]} text-xs`}>
                      {trackResult.shipment.status.replace('_', ' ')}
                    </Badge>
                    <span className="text-xs text-slate-700">{trackResult.shipment.weight}kg | {trackResult.shipment.category}</span>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-0">
                {trackResult.shipment.timeline.map((t, i) => (
                  <div key={i} className="flex gap-3 relative">
                    {i < trackResult.shipment.timeline.length - 1 && (
                      <div className={`absolute left-[7px] top-6 w-0.5 h-full ${t.completed ? 'bg-emerald-400' : 'bg-white/40'}`} />
                    )}
                    <div className={`w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 ${
                      t.completed ? 'bg-emerald-500 border-emerald-500' : 'bg-white/40 border-white/60'
                    }`} />
                    <div className="pb-5">
                      <div className={`text-sm font-medium ${t.completed ? 'text-slate-700' : 'text-slate-600'}`}>{t.status}</div>
                      <div className="text-xs text-slate-700 flex items-center gap-1 mt-0.5">
                        <MapPin size={10} />{t.location}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </GlassCard>
        </div>
      )}

      {!trackResult && !trackLoading && trackId && (
        <div className="text-center py-8 text-slate-600 text-sm">
          No results found for &quot;{trackId}&quot;. Try a different tracking number.
        </div>
      )}
    </div>
  );

  /* ---------------------------------------------------------------- */
  /*  DOCUMENTS TAB                                                    */
  /* ---------------------------------------------------------------- */
  const renderDocuments = () => (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <GlassCard>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <FileText size={14} className="text-emerald-600" /> Documents
          </h3>
          <div className="space-y-3">
            {[
              { label: 'Bill of Lading (BL)', type: 'BL', icon: ClipboardList },
              { label: 'Air Waybill (AWB)', type: 'AWB', icon: Send },
              { label: 'Commercial Invoice', type: 'INVOICE', icon: Receipt },
              { label: 'Packing List', type: 'PACKING', icon: Package },
            ].map(doc => (
              <div key={doc.type}
                className="flex items-center justify-between p-3 rounded-xl border border-white/50 bg-white/20 hover:bg-white/30 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <doc.icon size={18} className="text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-sm text-slate-700 font-medium">{doc.label}</div>
                    <div className="text-xs text-slate-700">PDF \u2022 Available for download</div>
                  </div>
                </div>
                <Button size="sm" variant="outline"
                  className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded-lg text-xs"
                  onClick={() => alert(`Downloading ${doc.label}...`)}>
                  <Download size={14} className="mr-1" /> Download
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </GlassCard>

      <GlassCard>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Upload size={14} className="text-emerald-600" /> Upload Customs Documents
          </h3>
          <div
            className="border-2 border-dashed border-white/50 rounded-2xl p-6 text-center hover:bg-white/10 transition-all cursor-pointer"
            onClick={() => setUploadOpen(true)}>
            <Upload size={32} className="text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-600 font-medium">Click to upload documents</p>
            <p className="text-xs text-slate-600 mt-1">Supports PDF, JPG, PNG (max 10MB)</p>
          </div>
          <div className="mt-4 space-y-2">
            {[
              { name: 'Proforma Invoice.pdf', size: '1.2 MB', status: 'verified' },
              { name: 'Certificate of Origin.pdf', size: '856 KB', status: 'pending' },
            ].map((f, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white/20 border border-white/30">
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-slate-700" />
                  <span className="text-xs text-slate-700">{f.name}</span>
                  <span className="text-[10px] text-slate-600">{f.size}</span>
                </div>
                <Badge variant="outline" className={f.status === 'verified'
                  ? 'bg-emerald-100 text-emerald-700 border-emerald-300 text-[10px]'
                  : 'bg-amber-100 text-amber-700 border-amber-300 text-[10px]'}>
                  {f.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </GlassCard>
    </div>
  );

  /* ---------------------------------------------------------------- */
  /*  SHIPMENT DETAIL DIALOG                                           */
  /* ---------------------------------------------------------------- */
  const renderDetailDialog = () => (
    <Dialog open={!!selectedShipment} onOpenChange={(o) => { if (!o) setSelectedId(null); }}>
      <DialogContent className="bg-white/[0.95] backdrop-blur-xl border border-white/40 text-slate-700 max-w-md max-h-[80vh] overflow-y-auto rounded-2xl shadow-2xl">
        <DialogHeader><DialogTitle className="text-slate-700 flex items-center gap-2">
          <Truck size={18} className="text-emerald-600" /> Shipment Timeline
        </DialogTitle></DialogHeader>
        {selectedShipment && (
          <div className="space-y-4 mt-2">
            <div>
              <div className="text-xs text-slate-700">Parcel ID</div>
              <div className="text-sm font-mono text-emerald-700">{selectedShipment.id}</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`${STATUS_COLORS[selectedShipment.status]}`}>
                {selectedShipment.status.replace('_', ' ')}
              </Badge>
              <span className="text-xs text-slate-700">{selectedShipment.weight}kg | {selectedShipment.category}</span>
            </div>
            <div className="space-y-0">
              {selectedShipment.timeline.map((t, i) => (
                <div key={i} className="flex gap-3 relative">
                  {i < selectedShipment.timeline.length - 1 && (
                    <div className={`absolute left-[7px] top-6 w-0.5 h-full ${t.completed ? 'bg-emerald-400' : 'bg-white/50'}`} />
                  )}
                  <div className={`w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 ${
                    t.completed ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300'
                  }`} />
                  <div className="pb-5">
                    <div className={`text-sm font-medium ${t.completed ? 'text-slate-700' : 'text-slate-600'}`}>{t.status}</div>
                    <div className="text-xs text-slate-700 flex items-center gap-1 mt-0.5">
                      <MapPin size={10} />{t.location}
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5">{t.date}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

  /* ---------------------------------------------------------------- */
  /*  MAIN RENDER                                                      */
  /* ---------------------------------------------------------------- */
  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: '#E8E4F0' }}>
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-white/30 bg-white/20 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg">
            <Package size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-700 tracking-tight">Customer Portal</h1>
            <p className="text-xs text-slate-700">Book, track &amp; manage your shipments</p>
          </div>
          <Badge variant="outline"
            className={connected
              ? 'ml-auto gap-1 bg-emerald-100 text-emerald-700 border-emerald-300'
              : 'ml-auto gap-1 bg-white/40 text-slate-700 border-white/50'}>
            {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {connected ? 'Live' : 'Offline'}
          </Badge>
        </div>
      </div>

      {/* Top Tab Bar — mobile-first */}
      <div className="shrink-0 px-4 pt-3 pb-0">
        <div className="flex bg-white/30 backdrop-blur-xl border border-white/40 rounded-2xl p-1 gap-1 overflow-x-auto">
          {[
            { key: 'book' as const, label: 'Book', icon: Send },
            { key: 'shipments' as const, label: 'My Shipments', icon: Package },
            { key: 'track' as const, label: 'Track', icon: ScanLine },
            { key: 'documents' as const, label: 'Documents', icon: FileText },
          ].map(tab => (
            <button key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap min-w-0 ${
                activeTab === tab.key
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-700 hover:bg-white/30'
              }`}>
              <tab.icon size={14} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <ScrollArea className="flex-1 overflow-y-auto mt-3">
        {activeTab === 'book' && (
          <div className="p-4 max-w-2xl mx-auto">
            {submitted ? renderSuccess() : (
              <>
                {renderStepper()}
                <GlassCard>
                  <CardContent className="p-4 sm:p-6">
                    {step === 1 && renderStep1()}
                    {step === 2 && renderStep2()}
                    {step === 3 && renderStep3()}
                    {step === 4 && renderStep4()}
                    {step === 5 && renderStep5()}
                    {step === 6 && renderStep6()}
                    <div className="flex justify-between mt-6 pt-4 border-t border-white/30">
                      <Button variant="outline" onClick={prevStep} disabled={step === 1}
                        className="border-white/50 text-slate-600 hover:bg-white/30 rounded-xl disabled:opacity-30">
                        <ArrowLeft size={16} className="mr-1" /> Back
                      </Button>
                      {step < 6 ? (
                        <Button onClick={nextStep}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl">
                          Next <ArrowRight size={16} className="ml-1" />
                        </Button>
                      ) : (
                        <Button onClick={handleSubmit} disabled={!agreed}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl disabled:opacity-30">
                          <Send size={16} className="mr-1" /> Submit Shipment
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </GlassCard>
              </>
            )}
          </div>
        )}

        {activeTab === 'shipments' && renderShipments()}
        {activeTab === 'track' && renderTrack()}
        {activeTab === 'documents' && renderDocuments()}
      </ScrollArea>

      {renderDetailDialog()}
    </div>
  );
}
