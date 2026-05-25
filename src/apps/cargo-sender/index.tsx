import { useState, useMemo } from 'react';
import {
  Send, Package, MapPin, User, Weight,
  Ruler, CreditCard, Banknote, Smartphone, Receipt,
  CheckCircle2, ArrowRight, ArrowLeft, Search,
  Box, Clock, DollarSign, Shield, ChevronRight, Truck, Wifi, WifiOff
} from 'lucide-react';
import { useCargoParcels, type ApiParcel } from '@/hooks/useCargoParcels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { QRCodeSVG } from 'qrcode.react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/* ------------------------------------------------------------------ */
/*  TYPES                                                              */
/* ------------------------------------------------------------------ */
interface SenderInfo { name: string; phone: string; email: string; address: string; country: string; }
interface ReceiverInfo { name: string; phone: string; email: string; address: string; country: string; }
interface PackageDetails { description: string; category: string; quantity: number; weight: number; length: number; width: number; height: number; declaredValue: number; }
interface ShippingOptions { route: string; speed: string; insurance: boolean; }
interface PaymentInfo { mode: string; method: string; }

interface Shipment {
  id: string; senderPhone: string; senderName: string; receiverName: string;
  receiverCountry: string; status: 'REGISTERED' | 'IN_TRANSIT' | 'ARRIVED' | 'DELIVERED' | 'CANCELLED';
  date: string; weight: number; category: string; route: string;
  timeline: { status: string; date: string; location: string; completed: boolean }[];
}

/* ------------------------------------------------------------------ */
/*  CONSTANTS                                                          */
/* ------------------------------------------------------------------ */
const COUNTRIES = ['China', 'Tanzania', 'Kenya', 'Uganda', 'Rwanda', 'Zambia', 'Nigeria', 'Ghana', 'South Africa', 'India', 'UAE', 'USA', 'UK'];
const CATEGORIES = ['Electronics', 'Textiles', 'Machinery', 'Food', 'Documents', 'Other'];
const ROUTES = [
  { label: 'Guangzhou → Dar es Salaam', from: 'China', to: 'Tanzania' },
  { label: 'Shanghai → Zanzibar', from: 'China', to: 'Tanzania' },
  { label: 'Shenzhen → Mombasa', from: 'China', to: 'Kenya' },
  { label: 'Yiwu → Kampala', from: 'China', to: 'Uganda' },
  { label: 'Beijing → Kigali', from: 'China', to: 'Rwanda' },
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
  REGISTERED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  IN_TRANSIT: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  ARRIVED: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  DELIVERED: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  CANCELLED: 'bg-red-500/20 text-red-400 border-red-500/30',
};

/* ------------------------------------------------------------------ */
/*  BACKEND → DISPLAY MAPPING                                          */
/* ------------------------------------------------------------------ */
const STATUS_ORDER = ['REGISTERED', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED'];
const TIMELINE_STEPS: { key: string; label: string }[] = [
  { key: 'REGISTERED', label: 'Parcel Registered' },
  { key: 'IN_TRANSIT', label: 'In Transit' },
  { key: 'ARRIVED', label: 'Arrived Destination' },
  { key: 'DELIVERED', label: 'Delivered' },
];

function buildTimeline(status: string, destination: string): Shipment['timeline'] {
  if (status === 'CANCELLED') {
    return [
      { status: 'Parcel Registered', date: '—', location: 'Origin Hub', completed: true },
      { status: 'Cancelled', date: '—', location: '—', completed: true },
    ];
  }
  const currentIdx = STATUS_ORDER.indexOf(status);
  return TIMELINE_STEPS.map((step, i) => ({
    status: step.label,
    date: '—',
    location: step.key === 'ARRIVED' || step.key === 'DELIVERED' ? (destination || '—') : '—',
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
    date: p.createdAt ? p.createdAt.slice(0, 10) : '—',
    weight: p.weight,
    category: p.description || '—',
    route: p.destination ? `→ ${p.destination}` : '',
    timeline: buildTimeline(p.status, p.destination),
  };
}

/* ------------------------------------------------------------------ */
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */
function calcQuote(weight: number, routeIdx: number, speedIdx: number, category: string, insurance: boolean) {
  const routePrices = [8, 9, 7, 8.5, 9.5];
  const catMultipliers: Record<string, number> = { Electronics: 1.3, Textiles: 0.8, Machinery: 1.5, Food: 1.1, Documents: 0.5, Other: 1 };
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
/*  MAIN COMPONENT                                                     */
/* ------------------------------------------------------------------ */
export default function CargoSender() {
  const [activeTab, setActiveTab] = useState('send');

  /* Wizard state */
  const [step, setStep] = useState(1);
  const [sender, setSender] = useState<SenderInfo>({ name: '', phone: '', email: '', address: '', country: 'China' });
  const [receiver, setReceiver] = useState<ReceiverInfo>({ name: '', phone: '', email: '', address: '', country: 'Tanzania' });
  const [pkg, setPkg] = useState<PackageDetails>({ description: '', category: 'Electronics', quantity: 1, weight: 1, length: 10, width: 10, height: 10, declaredValue: 0 });
  const [shipping, setShipping] = useState<ShippingOptions>({ route: ROUTES[0].label, speed: 'Standard', insurance: false });
  const [payment, setPayment] = useState<PaymentInfo>({ mode: 'PAY_NOW', method: 'bank' });
  const [submitted, setSubmitted] = useState(false);
  const [parcelId, setParcelId] = useState('');
  const [agreed, setAgreed] = useState(false);

  /* Shipments state (backed by /cargo/parcels + live socket) */
  const { parcels, connected, createParcel } = useCargoParcels();
  const shipments = useMemo(() => parcels.map(parcelToShipment), [parcels]);
  const [searchPhone, setSearchPhone] = useState('');
  const [searched, setSearched] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedShipment = useMemo(
    () => shipments.find(s => s.id === selectedId) ?? null,
    [shipments, selectedId],
  );

  /* Quote state */
  const [qOrigin, setQOrigin] = useState('China');
  const [qDest, setQDest] = useState('Tanzania');
  const [qWeight, setQWeight] = useState(10);
  const [qCategory, setQCategory] = useState('Electronics');
  const [qSpeed, setQSpeed] = useState(0);
  const [qInsurance, setQInsurance] = useState(false);

  /* Memo */
  const filteredShipments = useMemo(() => {
    if (!searched || !searchPhone) return [];
    return shipments.filter(s => s.senderPhone.includes(searchPhone));
  }, [shipments, searchPhone, searched]);

  const quote = useMemo(() => {
    const routeIdx = Math.max(0, ROUTES.findIndex(r => r.from === qOrigin && r.to === qDest));
    return calcQuote(qWeight, routeIdx, qSpeed, qCategory, qInsurance);
  }, [qWeight, qSpeed, qCategory, qInsurance, qOrigin, qDest]);

  const currentQuote = useMemo(() => {
    const routeIdx = Math.max(0, ROUTES.findIndex(r => r.label === shipping.route));
    const speedIdx = SPEEDS.findIndex(s => s.label === shipping.speed);
    return calcQuote(pkg.weight, routeIdx, speedIdx, pkg.category, shipping.insurance);
  }, [pkg.weight, pkg.category, shipping]);

  /* Wizard handlers */
  const nextStep = () => setStep(s => Math.min(s + 1, 6));
  const prevStep = () => { if (step > 1) setStep(s => s - 1); };

  const handleSubmit = async () => {
    const id = genParcelId(sender.name);
    setParcelId(id);
    setSubmitted(true);
    // Persist to /cargo/parcels — the hook updates the list and the socket
    // broadcasts the new parcel back to every connected client.
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
    } catch { /* offline — change is queued and will sync */ }
  };
  const resetWizard = () => {
    setStep(1); setSubmitted(false); setParcelId(''); setAgreed(false);
    setSender({ name: '', phone: '', email: '', address: '', country: 'China' });
    setReceiver({ name: '', phone: '', email: '', address: '', country: 'Tanzania' });
    setPkg({ description: '', category: 'Electronics', quantity: 1, weight: 1, length: 10, width: 10, height: 10, declaredValue: 0 });
    setShipping({ route: ROUTES[0].label, speed: 'Standard', insurance: false });
    setPayment({ mode: 'PAY_NOW', method: 'bank' });
  };

  /* ---------------------------------------------------------------- */
  /*  RENDERERS                                                        */
  /* ---------------------------------------------------------------- */
  const renderStepper = () => (
    <div className="flex items-center justify-between mb-6 px-2">
      {[1, 2, 3, 4, 5, 6].map((s, i) => (
        <div key={s} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= s ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'bg-white/10 text-gray-400 border border-white/10'}`}>
              {step > s ? <CheckCircle2 size={14} /> : s}
            </div>
            <span className={`text-[10px] hidden sm:block ${step >= s ? 'text-emerald-400' : 'text-gray-500'}`}>
              {['Sender', 'Receiver', 'Package', 'Shipping', 'Payment', 'Review'][i]}
            </span>
          </div>
          {i < 5 && <div className={`h-0.5 flex-1 mx-2 transition-all ${step > s ? 'bg-emerald-500' : 'bg-white/10'}`} />}
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2"><User size={18} className="text-emerald-400" /> Sender Information</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="text-xs text-gray-400 mb-1 block">Full Name *</label>
          <Input placeholder="Enter your full name" value={sender.name} onChange={e => setSender({ ...sender, name: e.target.value })} className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-emerald-500" />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Phone Number *</label>
          <Input placeholder="+255..." value={sender.phone} onChange={e => setSender({ ...sender, phone: e.target.value })} className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-emerald-500" />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Email</label>
          <Input placeholder="email@example.com" value={sender.email} onChange={e => setSender({ ...sender, email: e.target.value })} className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-emerald-500" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-gray-400 mb-1 block">Address *</label>
          <Input placeholder="Street address, city" value={sender.address} onChange={e => setSender({ ...sender, address: e.target.value })} className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-emerald-500" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-gray-400 mb-1 block">Country *</label>
          <select value={sender.country} onChange={e => setSender({ ...sender, country: e.target.value })} className="w-full rounded-md border border-white/10 bg-white/5 text-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none">
            {COUNTRIES.map(c => <option key={c} value={c} className="bg-slate-800">{c}</option>)}
          </select>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2"><MapPin size={18} className="text-emerald-400" /> Receiver Information</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="text-xs text-gray-400 mb-1 block">Full Name *</label>
          <Input placeholder="Receiver's full name" value={receiver.name} onChange={e => setReceiver({ ...receiver, name: e.target.value })} className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-emerald-500" />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Phone Number *</label>
          <Input placeholder="+255..." value={receiver.phone} onChange={e => setReceiver({ ...receiver, phone: e.target.value })} className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-emerald-500" />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Email</label>
          <Input placeholder="email@example.com" value={receiver.email} onChange={e => setReceiver({ ...receiver, email: e.target.value })} className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-emerald-500" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-gray-400 mb-1 block">Address *</label>
          <Input placeholder="Street address, city" value={receiver.address} onChange={e => setReceiver({ ...receiver, address: e.target.value })} className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-emerald-500" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-gray-400 mb-1 block">Country *</label>
          <select value={receiver.country} onChange={e => setReceiver({ ...receiver, country: e.target.value })} className="w-full rounded-md border border-white/10 bg-white/5 text-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none">
            {COUNTRIES.map(c => <option key={c} value={c} className="bg-slate-800">{c}</option>)}
          </select>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2"><Package size={18} className="text-emerald-400" /> Package Details</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="text-xs text-gray-400 mb-1 block">Description *</label>
          <Input placeholder="What's inside the package?" value={pkg.description} onChange={e => setPkg({ ...pkg, description: e.target.value })} className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-emerald-500" />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Category *</label>
          <select value={pkg.category} onChange={e => setPkg({ ...pkg, category: e.target.value })} className="w-full rounded-md border border-white/10 bg-white/5 text-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none">
            {CATEGORIES.map(c => <option key={c} value={c} className="bg-slate-800">{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Quantity *</label>
          <Input type="number" min={1} value={pkg.quantity} onChange={e => setPkg({ ...pkg, quantity: Number(e.target.value) })} className="bg-white/5 border-white/10 text-white focus:border-emerald-500" />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Weight size={12} /> Weight (kg) *</label>
          <Input type="number" min={0.1} step={0.1} value={pkg.weight} onChange={e => setPkg({ ...pkg, weight: Number(e.target.value) })} className="bg-white/5 border-white/10 text-white focus:border-emerald-500" />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Declared Value ($)</label>
          <Input type="number" min={0} value={pkg.declaredValue} onChange={e => setPkg({ ...pkg, declaredValue: Number(e.target.value) })} className="bg-white/5 border-white/10 text-white focus:border-emerald-500" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Ruler size={12} /> Dimensions (cm)</label>
          <div className="grid grid-cols-3 gap-2">
            <Input type="number" placeholder="Length" value={pkg.length} onChange={e => setPkg({ ...pkg, length: Number(e.target.value) })} className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-emerald-500" />
            <Input type="number" placeholder="Width" value={pkg.width} onChange={e => setPkg({ ...pkg, width: Number(e.target.value) })} className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-emerald-500" />
            <Input type="number" placeholder="Height" value={pkg.height} onChange={e => setPkg({ ...pkg, height: Number(e.target.value) })} className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-emerald-500" />
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2"><Truck size={18} className="text-emerald-400" /> Shipping Options</h3>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-gray-400 mb-2 block">Select Route *</label>
          <div className="grid grid-cols-1 gap-2">
            {ROUTES.map(r => (
              <button key={r.label} onClick={() => setShipping({ ...shipping, route: r.label })} className={`flex items-center justify-between p-3 rounded-lg border text-left transition-all ${shipping.route === r.label ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                <div className="flex items-center gap-2"><MapPin size={16} className={shipping.route === r.label ? 'text-emerald-400' : 'text-gray-400'} /><span className="text-sm text-white">{r.label}</span></div>
                {shipping.route === r.label && <CheckCircle2 size={16} className="text-emerald-400" />}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-2 block">Shipping Speed *</label>
          <div className="grid grid-cols-3 gap-2">
            {SPEEDS.map(s => (
              <button key={s.label} onClick={() => setShipping({ ...shipping, speed: s.label })} className={`p-3 rounded-lg border text-center transition-all ${shipping.speed === s.label ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                <div className="text-sm font-medium text-white">{s.label}</div>
                <div className="text-xs text-gray-400 mt-1 flex items-center justify-center gap-1"><Clock size={10} />{s.days}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg border border-white/10 bg-white/5">
          <Shield size={18} className="text-emerald-400" />
          <div className="flex-1"><div className="text-sm text-white">Insurance Coverage</div><div className="text-xs text-gray-400">3% of transport fee - covers loss & damage</div></div>
          <button onClick={() => setShipping({ ...shipping, insurance: !shipping.insurance })} className={`w-10 h-6 rounded-full transition-all ${shipping.insurance ? 'bg-emerald-500' : 'bg-white/20'}`}>
            <div className={`w-4 h-4 rounded-full bg-white transition-all ${shipping.insurance ? 'ml-5' : 'ml-1'}`} />
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2"><DollarSign size={18} className="text-emerald-400" /> Payment</h3>
      <div className="p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 mb-4">
        <h4 className="text-sm font-semibold text-emerald-400 mb-3">Instant Quote</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-400">Transport Fee</span><span className="text-white">{fmtMoney(currentQuote.transportFee)}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Insurance</span><span className="text-white">{fmtMoney(currentQuote.insuranceFee)}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Subtotal</span><span className="text-white">{fmtMoney(currentQuote.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">VAT (18%)</span><span className="text-white">{fmtMoney(currentQuote.vat)}</span></div>
          <div className="h-px bg-white/10 my-2" />
          <div className="flex justify-between text-lg font-bold"><span className="text-emerald-400">Total</span><span className="text-emerald-400">{fmtMoney(currentQuote.total)}</span></div>
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-400 mb-2 block">Payment Mode</label>
        <div className="flex gap-2 mb-3">
          {['PAY_NOW', 'PAY_ON_ARRIVAL'].map(m => (
            <button key={m} onClick={() => setPayment({ mode: m, method: m === 'PAY_NOW' ? 'bank' : 'cod' })} className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${payment.mode === m ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'}`}>
              {m === 'PAY_NOW' ? 'Pay Now' : 'Pay on Arrival'}
            </button>
          ))}
        </div>
        <label className="text-xs text-gray-400 mb-2 block">Payment Method</label>
        <div className="grid grid-cols-2 gap-2">
          {(payment.mode === 'PAY_NOW' ? PAYMENT_METHODS.PAY_NOW : PAYMENT_METHODS.PAY_ON_ARRIVAL).map(m => {
            const Icon = m.icon;
            return (
              <button key={m.key} onClick={() => setPayment({ ...payment, method: m.key })} className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-all ${payment.method === m.key ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                <Icon size={16} className={payment.method === m.key ? 'text-emerald-400' : 'text-gray-400'} />
                <span className="text-xs text-white">{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderStep6 = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2"><Receipt size={18} className="text-emerald-400" /> Review & Submit</h3>
      <div className="space-y-3">
        <Card className="bg-white/5 border-white/10"><CardContent className="p-3 space-y-2"><div className="flex items-center gap-2 text-sm font-semibold text-emerald-400"><User size={14} /> Sender</div><div className="text-xs text-gray-300">{sender.name} | {sender.phone}</div><div className="text-xs text-gray-400">{sender.address}, {sender.country}</div></CardContent></Card>
        <Card className="bg-white/5 border-white/10"><CardContent className="p-3 space-y-2"><div className="flex items-center gap-2 text-sm font-semibold text-emerald-400"><MapPin size={14} /> Receiver</div><div className="text-xs text-gray-300">{receiver.name} | {receiver.phone}</div><div className="text-xs text-gray-400">{receiver.address}, {receiver.country}</div></CardContent></Card>
        <Card className="bg-white/5 border-white/10"><CardContent className="p-3 space-y-2"><div className="flex items-center gap-2 text-sm font-semibold text-emerald-400"><Box size={14} /> Package</div><div className="text-xs text-gray-300">{pkg.category} - {pkg.description}</div><div className="text-xs text-gray-400">{pkg.quantity} pcs | {pkg.weight}kg | {pkg.length}x{pkg.width}x{pkg.height}cm | ${pkg.declaredValue}</div></CardContent></Card>
        <Card className="bg-white/5 border-white/10"><CardContent className="p-3 space-y-2"><div className="flex items-center gap-2 text-sm font-semibold text-emerald-400"><Truck size={14} /> Shipping</div><div className="text-xs text-gray-300">{shipping.route} - {shipping.speed}</div><div className="text-xs text-gray-400">Insurance: {shipping.insurance ? 'Yes' : 'No'} | Payment: {payment.mode === 'PAY_NOW' ? 'Pay Now' : 'Pay on Arrival'}</div></CardContent></Card>
        <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
          <div className="flex justify-between items-center"><span className="text-sm font-bold text-emerald-400">Total Amount</span><span className="text-lg font-bold text-emerald-400">{fmtMoney(currentQuote.total)}</span></div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="rounded border-white/10 bg-white/5 accent-emerald-500" />
          <span className="text-xs text-gray-400">I agree to the terms and conditions of KOBECARGO shipping services.</span>
        </label>
      </div>
    </div>
  );

  const renderSuccess = () => (
    <div className="flex flex-col items-center justify-center py-8 text-center space-y-6">
      <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center animate-pulse">
        <CheckCircle2 size={48} className="text-emerald-400" />
      </div>
      <div>
        <h3 className="text-2xl font-bold text-white mb-2">Shipment Created!</h3>
        <p className="text-gray-400 text-sm">Your parcel has been registered successfully.</p>
      </div>
      <Card className="bg-white/5 border-emerald-500/30 w-full max-w-sm">
        <CardContent className="p-4 flex flex-col items-center gap-3">
          <QRCodeSVG value={`https://kobecargo.com/track/${parcelId}`} size={128} bgColor="transparent" fgColor="#10b981" />
          <div className="text-center">
            <div className="text-xs text-gray-400">Parcel ID</div>
            <div className="text-lg font-bold text-emerald-400 font-mono">{parcelId}</div>
          </div>
        </CardContent>
      </Card>
      <div className="flex gap-3">
        <Button onClick={resetWizard} variant="outline" className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">Send Another</Button>
        <Button onClick={() => { setActiveTab('shipments'); resetWizard(); }} className="bg-emerald-600 hover:bg-emerald-700 text-white">Track Shipments</Button>
      </div>
    </div>
  );

  /* ---------------------------------------------------------------- */
  /*  TAB CONTENT                                                      */
  /* ---------------------------------------------------------------- */

  return (
    <div className="h-full flex flex-col bg-slate-950 text-white">
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-white/5 bg-slate-900/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Send size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Cargo Sender</h1>
            <p className="text-xs text-gray-400">Send parcels worldwide with KOBECARGO</p>
          </div>
          <Badge
            variant="outline"
            className={connected
              ? 'ml-auto gap-1 bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
              : 'ml-auto gap-1 bg-white/5 text-gray-400 border-white/10'}
          >
            {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {connected ? 'Live' : 'Offline'}
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="shrink-0 mx-4 mt-3 bg-white/5 border border-white/10 p-1 rounded-lg grid grid-cols-3 h-10">
          <TabsTrigger value="send" className="text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-gray-400 rounded-md flex items-center gap-1"><Send size={13} /> Send Parcel</TabsTrigger>
          <TabsTrigger value="shipments" className="text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-gray-400 rounded-md flex items-center gap-1"><Package size={13} /> My Shipments</TabsTrigger>
          <TabsTrigger value="quote" className="text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-gray-400 rounded-md flex items-center gap-1"><DollarSign size={13} /> Get Quote</TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 overflow-auto">
          {/* ========================= TAB 1 ========================= */}
          <TabsContent value="send" className="mt-0 h-full">
            <div className="p-4 max-w-2xl mx-auto">
              {submitted ? renderSuccess() : (
                <>
                  {renderStepper()}
                  <Card className="bg-white/5 backdrop-blur-md border-white/10">
                    <CardContent className="p-4 sm:p-6">
                      {step === 1 && renderStep1()}
                      {step === 2 && renderStep2()}
                      {step === 3 && renderStep3()}
                      {step === 4 && renderStep4()}
                      {step === 5 && renderStep5()}
                      {step === 6 && renderStep6()}
                      <div className="flex justify-between mt-6 pt-4 border-t border-white/10">
                        <Button variant="outline" onClick={prevStep} disabled={step === 1} className="border-white/10 text-gray-300 hover:bg-white/5 disabled:opacity-30">
                          <ArrowLeft size={16} className="mr-1" /> Back
                        </Button>
                        {step < 6 ? (
                          <Button onClick={nextStep} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            Next <ArrowRight size={16} className="ml-1" />
                          </Button>
                        ) : (
                          <Button onClick={handleSubmit} disabled={!agreed} className="bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-30">
                            <Send size={16} className="mr-1" /> Submit Shipment
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </TabsContent>

          {/* ========================= TAB 2 ========================= */}
          <TabsContent value="shipments" className="mt-0 h-full">
            <div className="p-4 max-w-2xl mx-auto space-y-4">
              <Card className="bg-white/5 backdrop-blur-md border-white/10">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Search size={14} className="text-emerald-400" /> Track Your Shipments</h3>
                  <div className="flex gap-2">
                    <Input placeholder="Enter sender phone number..." value={searchPhone} onChange={e => setSearchPhone(e.target.value)} className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-emerald-500" />
                    <Button onClick={() => setSearched(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"><Search size={16} /></Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Search by the sender phone used at registration.</p>
                </CardContent>
              </Card>

              {searched && filteredShipments.length === 0 && (
                <div className="text-center py-8 text-gray-500 text-sm">No shipments found for this phone number.</div>
              )}

              <div className="space-y-3">
                {(searched ? filteredShipments : shipments).map(s => (
                  <Card key={s.id} className="bg-white/5 backdrop-blur-md border-white/10 hover:border-emerald-500/30 transition-all cursor-pointer" onClick={() => setSelectedId(s.id)}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-emerald-400">{s.id}</span>
                            <Badge variant="outline" className={`${STATUS_COLORS[s.status]} text-xs`}>{s.status.replace('_', ' ')}</Badge>
                          </div>
                          <div className="text-sm text-white font-medium">{s.receiverName}</div>
                          <div className="flex items-center gap-3 text-xs text-gray-400">
                            <span className="flex items-center gap-1"><MapPin size={10} />{s.receiverCountry}</span>
                            <span className="flex items-center gap-1"><Weight size={10} />{s.weight}kg</span>
                            <span className="flex items-center gap-1"><Clock size={10} />{s.date}</span>
                          </div>
                          <div className="text-xs text-gray-500">{s.route}</div>
                        </div>
                        <ChevronRight size={16} className="text-gray-500 mt-1" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* ========================= TAB 3 ========================= */}
          <TabsContent value="quote" className="mt-0 h-full">
            <div className="p-4 max-w-lg mx-auto space-y-4">
              <Card className="bg-white/5 backdrop-blur-md border-white/10">
                <CardHeader className="pb-3"><CardTitle className="text-lg text-white flex items-center gap-2"><DollarSign size={18} className="text-emerald-400" /> Quick Quote Calculator</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Origin</label>
                      <select value={qOrigin} onChange={e => setQOrigin(e.target.value)} className="w-full rounded-md border border-white/10 bg-white/5 text-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none">
                        {COUNTRIES.map(c => <option key={c} value={c} className="bg-slate-800">{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Destination</label>
                      <select value={qDest} onChange={e => setQDest(e.target.value)} className="w-full rounded-md border border-white/10 bg-white/5 text-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none">
                        {COUNTRIES.map(c => <option key={c} value={c} className="bg-slate-800">{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Weight (kg)</label>
                      <Input type="number" min={0.1} step={0.1} value={qWeight} onChange={e => setQWeight(Number(e.target.value))} className="bg-white/5 border-white/10 text-white focus:border-emerald-500" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Category</label>
                      <select value={qCategory} onChange={e => setQCategory(e.target.value)} className="w-full rounded-md border border-white/10 bg-white/5 text-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none">
                        {CATEGORIES.map(c => <option key={c} value={c} className="bg-slate-800">{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-2 block">Shipping Speed</label>
                    <div className="grid grid-cols-3 gap-2">
                      {SPEEDS.map((s, i) => (
                        <button key={s.label} onClick={() => setQSpeed(i)} className={`p-2 rounded-lg border text-center transition-all ${qSpeed === i ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                          <div className="text-sm font-medium text-white">{s.label}</div>
                          <div className="text-[10px] text-gray-400">{s.days}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-white/10 bg-white/5">
                    <Shield size={16} className="text-emerald-400" />
                    <span className="text-sm text-white flex-1">Insurance</span>
                    <button onClick={() => setQInsurance(!qInsurance)} className={`w-10 h-6 rounded-full transition-all ${qInsurance ? 'bg-emerald-500' : 'bg-white/20'}`}>
                      <div className={`w-4 h-4 rounded-full bg-white transition-all ${qInsurance ? 'ml-5' : 'ml-1'}`} />
                    </button>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/5 backdrop-blur-md border-emerald-500/30">
                <CardContent className="p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-emerald-400 flex items-center gap-2"><Receipt size={14} /> Price Estimate</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-400">Transport Fee</span><span className="text-white">{fmtMoney(quote.transportFee)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Insurance</span><span className="text-white">{fmtMoney(quote.insuranceFee)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Subtotal</span><span className="text-white">{fmtMoney(quote.subtotal)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">VAT (18%)</span><span className="text-white">{fmtMoney(quote.vat)}</span></div>
                    <div className="h-px bg-white/10" />
                    <div className="flex justify-between text-lg font-bold"><span className="text-emerald-400">Total</span><span className="text-emerald-400">{fmtMoney(quote.total)}</span></div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400 pt-2 border-t border-white/10">
                    <Clock size={12} /> Estimated delivery: {SPEEDS[qSpeed].days}
                  </div>
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white mt-2" onClick={() => setActiveTab('send')}>
                    <Send size={14} className="mr-1" /> Proceed to Ship
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>

      {/* Timeline Dialog */}
      <Dialog open={!!selectedShipment} onOpenChange={(o) => { if (!o) setSelectedId(null); }}>
        <DialogContent className="bg-slate-900 border-white/10 text-white max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-white flex items-center gap-2"><Truck size={18} className="text-emerald-400" /> Shipment Timeline</DialogTitle></DialogHeader>
          {selectedShipment && (
            <div className="space-y-4 mt-2">
              <div>
                <div className="text-xs text-gray-400">Parcel ID</div>
                <div className="text-sm font-mono text-emerald-400">{selectedShipment.id}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`${STATUS_COLORS[selectedShipment.status]}`}>{selectedShipment.status.replace('_', ' ')}</Badge>
                <span className="text-xs text-gray-400">{selectedShipment.weight}kg | {selectedShipment.category}</span>
              </div>
              <div className="space-y-0">
                {selectedShipment.timeline.map((t, i) => (
                  <div key={i} className="flex gap-3 relative">
                    {i < selectedShipment.timeline.length - 1 && <div className={`absolute left-[7px] top-6 w-0.5 h-full ${t.completed ? 'bg-emerald-500' : 'bg-white/10'}`} />}
                    <div className={`w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 ${t.completed ? 'bg-emerald-500 border-emerald-500' : 'bg-transparent border-white/20'}`} />
                    <div className="pb-5">
                      <div className={`text-sm font-medium ${t.completed ? 'text-white' : 'text-gray-500'}`}>{t.status}</div>
                      <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><MapPin size={10} />{t.location}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{t.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
