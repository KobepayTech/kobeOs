import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import {
  Truck, MapPin, Phone, CheckCircle2, X, ArrowLeft,
  Package, Clock, TrendingUp, Star, ChevronRight,
  Navigation, CircleDot, Camera, PenLine, AlertTriangle,
  LogOut, User, Wifi, WifiOff, Sun, Moon, Zap,
  Smartphone, Signature, Send, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/* ------------------------------------------------------------------ */
/*  TYPES                                                              */
/* ------------------------------------------------------------------ */
interface Driver {
  id: string;
  name: string;
  phone: string;
  rating: number;
  tripsToday: number;
  tripsTotal: number;
  onTimeRate: number;
}

interface Delivery {
  id: string;
  parcelId: string;
  recipientName: string;
  recipientPhone: string;
  address: string;
  city: string;
  status: 'ASSIGNED' | 'IN_PROGRESS' | 'ARRIVED' | 'DELIVERED' | 'FAILED';
  createdAt: string;
  notes?: string;
  podPhoto?: string;
  signature?: string;
  actualRecipient?: string;
}

/* ------------------------------------------------------------------ */
/*  MOCK DATA                                                          */
/* ------------------------------------------------------------------ */
const MOCK_DRIVERS: Driver[] = [
  { id: 'd1', name: 'Rajab M.', phone: '+255 712 345 678', rating: 4.8, tripsToday: 4, tripsTotal: 156, onTimeRate: 94 },
  { id: 'd2', name: 'Hassan Mwinyi', phone: '+255 713 444 555', rating: 4.7, tripsToday: 3, tripsTotal: 142, onTimeRate: 91 },
  { id: 'd3', name: 'James Kimaro', phone: '+255 714 666 777', rating: 4.6, tripsToday: 5, tripsTotal: 98, onTimeRate: 88 },
  { id: 'd4', name: 'Peter Omari', phone: '+255 715 888 999', rating: 4.9, tripsToday: 6, tripsTotal: 201, onTimeRate: 97 },
];

const MOCK_DELIVERIES: Delivery[] = [
  { id: 'dlv-001', parcelId: 'KBE-ABC-20250115-001', recipientName: 'Asha Mwangi', recipientPhone: '+255 714 333 444', address: '123 Kariakoo Street, Building 4', city: 'Dar es Salaam', status: 'DELIVERED', createdAt: '2025-01-15T08:00:00Z', notes: 'Handed to recipient directly' },
  { id: 'dlv-002', parcelId: 'KBE-XYZ-20250115-002', recipientName: 'Juma Abdallah', recipientPhone: '+255 711 222 333', address: '45 Uhuru Road, Block C', city: 'Dar es Salaam', status: 'IN_PROGRESS', createdAt: '2025-01-15T09:30:00Z' },
  { id: 'dlv-003', parcelId: 'KBE-DEF-20250115-003', recipientName: 'Grace Wanjiru', recipientPhone: '+255 716 777 888', address: '78 Nyerere Avenue, Floor 2', city: 'Dar es Salaam', status: 'ASSIGNED', createdAt: '2025-01-15T10:00:00Z' },
  { id: 'dlv-004', parcelId: 'KBE-GHI-20250115-004', recipientName: 'Fatima Said', recipientPhone: '+255 718 111 222', address: '91 Morocco Road, Shop 12', city: 'Dar es Salaam', status: 'FAILED', createdAt: '2025-01-15T07:00:00Z', notes: 'Recipient not available' },
  { id: 'dlv-005', parcelId: 'KBE-JKL-20250115-005', recipientName: 'Mary Joseph', recipientPhone: '+255 720 555 666', address: '34 Mikocheni, Plot 22', city: 'Dar es Salaam', status: 'ASSIGNED', createdAt: '2025-01-15T11:00:00Z' },
  { id: 'dlv-006', parcelId: 'KBE-MNO-20250115-006', recipientName: 'Rose Mwakasege', recipientPhone: '+255 722 999 000', address: '67 Sinza, Block D', city: 'Dar es Salaam', status: 'DELIVERED', createdAt: '2025-01-15T06:00:00Z', notes: 'Left with security guard' },
];

/* ------------------------------------------------------------------ */
/*  STATUS CONFIG                                                      */
/* ------------------------------------------------------------------ */
const STATUS_COLORS: Record<string, string> = {
  ASSIGNED: 'bg-blue-100 text-blue-700 border-blue-300',
  IN_PROGRESS: 'bg-amber-100 text-amber-700 border-amber-300',
  ARRIVED: 'bg-cyan-100 text-cyan-700 border-cyan-300',
  DELIVERED: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  FAILED: 'bg-red-100 text-red-700 border-red-300',
};

const STATUS_LABELS: Record<string, string> = {
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  ARRIVED: 'Arrived',
  DELIVERED: 'Delivered',
  FAILED: 'Failed',
};

const STATUS_FLOW = ['ASSIGNED', 'IN_PROGRESS', 'ARRIVED', 'DELIVERED'] as const;

/* ------------------------------------------------------------------ */
/*  GLASS CARD                                                         */
/* ------------------------------------------------------------------ */
function GlassCard({ children, className = '', onClick }: {
  children: React.ReactNode; className?: string; onClick?: () => void;
}) {
  return (
    <Card onClick={onClick}
      className={`bg-white/[0.30] backdrop-blur-xl border border-white/[0.40] rounded-2xl shadow-sm ${
        onClick ? 'cursor-pointer active:scale-[0.99] transition-transform' : ''
      } ${className}`}>
      {children}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  INTERFACE                                                          */
/* ------------------------------------------------------------------ */
interface DriverModeProps {
  onClose: () => void;
}

/* ------------------------------------------------------------------ */
/*  MAIN COMPONENT                                                     */
/* ------------------------------------------------------------------ */
export default function DriverMode({ onClose }: DriverModeProps) {
  const [view, setView] = useState<'login' | 'list' | 'detail' | 'performance'>('login');
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [activeDelivery, setActiveDelivery] = useState<Delivery | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>(MOCK_DELIVERIES);
  const [drivers, setDrivers] = useState<Driver[]>(MOCK_DRIVERS);
  const [connected, setConnected] = useState(true);

  /* Photo / POD state */
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [signatureCaptured, setSignatureCaptured] = useState(false);
  const [actualRecipient, setActualRecipient] = useState('');
  const [failReason, setFailReason] = useState('');
  const [showFailDialog, setShowFailDialog] = useState(false);

  /* Load real drivers from API */
  useEffect(() => {
    (async () => {
      try {
        const data = await api<Array<{ id: string; name: string; phone?: string; rating?: number }>>('/cargo/drivers');
        if (data && data.length > 0) {
          setDrivers(data.map(d => ({
            id: d.id,
            name: d.name,
            phone: d.phone || '',
            rating: d.rating ?? 4.5,
            tripsToday: Math.floor(Math.random() * 6) + 1,
            tripsTotal: Math.floor(Math.random() * 200) + 50,
            onTimeRate: Math.floor(Math.random() * 15) + 85,
          })));
        }
      } catch { /* use mock */ }
    })();
  }, []);

  /* ---------- Actions ---------- */
  const handleLogin = (driver: Driver) => {
    setSelectedDriver(driver);
    setView('list');
  };

  const handleStatusChange = useCallback((deliveryId: string, newStatus: Delivery['status']) => {
    setDeliveries(prev => prev.map(d =>
      d.id === deliveryId ? { ...d, status: newStatus } : d
    ));
    if (activeDelivery && activeDelivery.id === deliveryId) {
      setActiveDelivery(prev => prev ? { ...prev, status: newStatus } : null);
    }
  }, [activeDelivery]);

  const handleDeliver = useCallback(() => {
    if (!activeDelivery) return;
    handleStatusChange(activeDelivery.id, 'DELIVERED');
    setPhotoPreview(null);
    setSignatureCaptured(false);
    setActualRecipient('');
    setView('list');
  }, [activeDelivery, handleStatusChange]);

  const handleFail = useCallback(() => {
    if (!activeDelivery) return;
    handleStatusChange(activeDelivery.id, 'FAILED');
    setPhotoPreview(null);
    setSignatureCaptured(false);
    setFailReason('');
    setShowFailDialog(false);
    setView('list');
  }, [activeDelivery, handleStatusChange]);

  /* ---------- Derived ---------- */
  const myDeliveries = useMemo(() =>
    deliveries.filter(d => d.status !== 'DELIVERED' && d.status !== 'FAILED'),
    [deliveries]
  );
  const completedToday = useMemo(() =>
    deliveries.filter(d => d.status === 'DELIVERED'),
    [deliveries]
  );
  const failedToday = useMemo(() =>
    deliveries.filter(d => d.status === 'FAILED'),
    [deliveries]
  );

  const getNextStatus = (current: Delivery['status']): Delivery['status'] | null => {
    // STATUS_FLOW only covers the happy path (FAILED is a terminal
    // off-ramp), so the indexOf type intentionally excludes FAILED —
    // cast to keep callers strongly typed.
    const idx = STATUS_FLOW.indexOf(current as Exclude<Delivery['status'], 'FAILED'>);
    return idx >= 0 && idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null;
  };

  const getStatusButtonLabel = (status: Delivery['status']): string => {
    switch (status) {
      case 'ASSIGNED': return 'Start Delivery';
      case 'IN_PROGRESS': return 'Arrived';
      case 'ARRIVED': return 'Mark Delivered';
      default: return 'Update';
    }
  };

  /* ========== LOGIN VIEW ========== */
  if (view === 'login') {
    return (
      <div className="h-full flex flex-col" style={{ backgroundColor: '#E8E4F0' }}>
        <div className="shrink-0 p-4 border-b border-white/30 bg-white/20 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center shadow-lg">
                <Truck size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-700 leading-tight">Driver Mode</h1>
                <p className="text-xs text-slate-700">KOBECARGO Delivery</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-700 rounded-xl">
              <X size={18} />
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-4 max-w-md mx-auto space-y-4">
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                <User size={32} className="text-emerald-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-700">Select Driver</h2>
              <p className="text-xs text-slate-700 mt-1">Choose your profile to continue</p>
            </div>

            {drivers.map(driver => (
              <GlassCard key={driver.id} onClick={() => handleLogin(driver)}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-lg font-bold text-emerald-700 shrink-0">
                      {driver.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-semibold text-slate-700">{driver.name}</div>
                      <div className="flex items-center gap-2 text-xs text-slate-700">
                        <Phone size={10} /> {driver.phone}
                        <span className="flex items-center gap-0.5">
                          <Star size={10} className="text-amber-500 fill-amber-500" /> {driver.rating}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-slate-600" />
                  </div>
                </CardContent>
              </GlassCard>
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  }

  /* ========== DETAIL VIEW ========== */
  if (view === 'detail' && activeDelivery) {
    const nextStatus = getNextStatus(activeDelivery.status);
    const isAtArrived = activeDelivery.status === 'ARRIVED';

    return (
      <div className="h-full flex flex-col" style={{ backgroundColor: '#E8E4F0' }}>
        {/* Header */}
        <div className="shrink-0 p-3 border-b border-white/30 bg-white/20 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setView('list')}
              className="text-slate-600 h-9 w-9 p-0 rounded-xl">
              <ArrowLeft size={20} />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-slate-700 truncate">{activeDelivery.parcelId}</h1>
              <p className="text-xs text-slate-700 truncate">{activeDelivery.recipientName}</p>
            </div>
            <Badge variant="outline" className={`${STATUS_COLORS[activeDelivery.status]} text-xs`}>
              {STATUS_LABELS[activeDelivery.status]}
            </Badge>
          </div>
        </div>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-3 space-y-3">
            {/* Address Card - LARGE for readability */}
            <GlassCard>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                    <MapPin size={24} className="text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-slate-700 mb-0.5">Delivery Address</div>
                    <div className="text-xl font-bold text-slate-800 leading-tight">{activeDelivery.address}</div>
                    <div className="text-sm text-slate-600 mt-0.5">{activeDelivery.city}</div>
                  </div>
                </div>
              </CardContent>
            </GlassCard>

            {/* Contact Card */}
            <GlassCard>
              <CardContent className="p-4">
                <div className="text-xs text-slate-700 mb-2">Recipient Contact</div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-semibold text-slate-700">{activeDelivery.recipientName}</div>
                    <div className="flex items-center gap-1 text-sm text-emerald-700 font-medium mt-1">
                      <Phone size={14} /> {activeDelivery.recipientPhone}
                    </div>
                  </div>
                  <a href={`tel:${activeDelivery.recipientPhone}`}
                    className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center shadow-lg active:bg-emerald-700 transition-colors">
                    <Phone size={22} className="text-white" />
                  </a>
                </div>
              </CardContent>
            </GlassCard>

            {/* Progress Steps */}
            <GlassCard>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  {STATUS_FLOW.map((s, i) => {
                    const currentIdx = STATUS_FLOW.indexOf(activeDelivery.status as Exclude<Delivery['status'], 'FAILED'>);
                    const isCompleted = i <= currentIdx;
                    const isCurrent = i === currentIdx;
                    return (
                      <div key={s} className="flex flex-col items-center gap-1.5 flex-1 relative">
                        {i < STATUS_FLOW.length - 1 && (
                          <div className={`absolute top-3 left-1/2 w-full h-0.5 ${
                            i < currentIdx ? 'bg-emerald-400' : 'bg-white/40'
                          }`} style={{ left: '50%', width: 'calc(100% - 1.5rem)', marginLeft: '0.75rem' }} />
                        )}
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 z-10 ${
                          isCompleted ? 'bg-emerald-500 border-emerald-500 text-white'
                          : isCurrent ? 'bg-amber-400 border-amber-400 text-white'
                          : 'bg-white/50 border-slate-300 text-slate-600'
                        }`}>
                          {isCompleted ? <CheckCircle2 size={14} /> : <CircleDot size={14} />}
                        </div>
                        <span className={`text-[10px] font-medium ${
                          isCurrent ? 'text-amber-700' : isCompleted ? 'text-emerald-700' : 'text-slate-600'
                        }`}>{STATUS_LABELS[s]}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </GlassCard>

            {/* POD Section - only when ARRIVED */}
            {isAtArrived && (
              <div className="space-y-3">
                {/* Recipient Name Input */}
                <GlassCard>
                  <CardContent className="p-4 space-y-3">
                    <div className="text-xs text-slate-700 font-medium flex items-center gap-1">
                      <User size={12} /> Actual Recipient Name
                    </div>
                    <input
                      type="text"
                      placeholder="Enter name of person who received"
                      value={actualRecipient}
                      onChange={e => setActualRecipient(e.target.value)}
                      className="w-full rounded-xl border border-white/50 bg-white/40 text-slate-700 px-3 py-3 text-base placeholder:text-slate-600 focus:border-emerald-400 focus:outline-none"
                    />
                  </CardContent>
                </GlassCard>

                {/* Photo Upload */}
                <GlassCard>
                  <CardContent className="p-4 space-y-3">
                    <div className="text-xs text-slate-700 font-medium flex items-center gap-1">
                      <Camera size={12} /> Photo Proof of Delivery
                    </div>
                    {photoPreview ? (
                      <div className="relative">
                        <img src={photoPreview} alt="POD" className="w-full h-40 object-cover rounded-xl" />
                        <button onClick={() => setPhotoPreview(null)}
                          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => {
                        // Simulated camera capture
                        setPhotoPreview('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YxZjFmMSIvPjx0ZXh0IHg9IjIwMCIgeT0iMTAwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTk5IiBmb250LXNpemU9IjE0Ij5QaG90byBQcmV2aWV3PC90ZXh0Pjwvc3ZnPg==');
                      }}
                        className="w-full h-32 rounded-xl border-2 border-dashed border-white/50 bg-white/20 flex flex-col items-center justify-center gap-2 active:bg-white/30 transition-colors">
                        <Camera size={28} className="text-slate-600" />
                        <span className="text-xs text-slate-700">Tap to capture photo</span>
                      </button>
                    )}
                  </CardContent>
                </GlassCard>

                {/* Signature Capture */}
                <GlassCard>
                  <CardContent className="p-4 space-y-3">
                    <div className="text-xs text-slate-700 font-medium flex items-center gap-1">
                      <PenLine size={12} /> Signature
                    </div>
                    {signatureCaptured ? (
                      <div className="relative p-3 bg-white/40 rounded-xl border border-emerald-300">
                        <div className="flex items-center gap-2 text-emerald-700 text-sm font-medium">
                          <Signature size={16} /> Signature captured
                        </div>
                        <button onClick={() => setSignatureCaptured(false)}
                          className="absolute top-2 right-2 text-xs text-slate-700 underline">Clear</button>
                      </div>
                    ) : (
                      <button onClick={() => setSignatureCaptured(true)}
                        className="w-full h-24 rounded-xl border-2 border-dashed border-white/50 bg-white/20 flex flex-col items-center justify-center gap-2 active:bg-white/30 transition-colors">
                        <PenLine size={28} className="text-slate-600" />
                        <span className="text-xs text-slate-700">Tap to capture signature</span>
                      </button>
                    )}
                  </CardContent>
                </GlassCard>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Bottom Action Bar */}
        <div className="shrink-0 p-3 border-t border-white/30 bg-white/20 backdrop-blur-xl">
          {isAtArrived ? (
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline"
                onClick={() => setShowFailDialog(true)}
                className="h-12 rounded-xl border-red-300 text-red-600 hover:bg-red-50 text-sm font-semibold">
                <X size={16} className="mr-1" /> Failed
              </Button>
              <Button onClick={handleDeliver}
                disabled={!signatureCaptured}
                className="h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-40">
                <CheckCircle2 size={16} className="mr-1" /> Delivered
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {nextStatus && (
                <Button onClick={() => handleStatusChange(activeDelivery.id, nextStatus)}
                  className="h-14 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-base font-semibold shadow-lg">
                  {getStatusButtonLabel(activeDelivery.status)}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Fail Reason Dialog */}
        <Dialog open={showFailDialog} onOpenChange={setShowFailDialog}>
          <DialogContent className="bg-white/[0.95] backdrop-blur-xl border border-white/40 rounded-2xl max-w-sm">
            <DialogHeader><DialogTitle className="text-slate-700 flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-500" /> Delivery Failed
            </DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <p className="text-sm text-slate-700">Why could this delivery not be completed?</p>
              {[
                'Recipient not available',
                'Wrong address',
                'Refused by recipient',
                'Access denied',
                'Other',
              ].map(reason => (
                <button key={reason}
                  onClick={() => setFailReason(reason)}
                  className={`w-full p-3 rounded-xl border text-left text-sm transition-all ${
                    failReason === reason
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                      : 'border-white/50 bg-white/20 text-slate-600 hover:bg-white/30'
                  }`}>
                  {reason}
                </button>
              ))}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowFailDialog(false)}
                  className="flex-1 rounded-xl border-white/50">Cancel</Button>
                <Button onClick={handleFail} disabled={!failReason}
                  className="flex-1 rounded-xl bg-red-500 hover:bg-red-600 text-white disabled:opacity-40">
                  Confirm
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  /* ========== PERFORMANCE VIEW ========== */
  if (view === 'performance' && selectedDriver) {
    return (
      <div className="h-full flex flex-col" style={{ backgroundColor: '#E8E4F0' }}>
        <div className="shrink-0 p-3 border-b border-white/30 bg-white/20 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setView('list')}
              className="text-slate-600 h-9 w-9 p-0 rounded-xl">
              <ArrowLeft size={20} />
            </Button>
            <h1 className="text-base font-bold text-slate-700">Performance</h1>
          </div>
        </div>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-3 space-y-3">
            {/* Today Stats */}
            <div className="grid grid-cols-2 gap-3">
              <GlassCard>
                <CardContent className="p-4 text-center">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-2">
                    <CheckCircle2 size={20} className="text-emerald-600" />
                  </div>
                  <div className="text-2xl font-bold text-slate-700">{completedToday.length}</div>
                  <div className="text-xs text-slate-700">Delivered Today</div>
                </CardContent>
              </GlassCard>
              <GlassCard>
                <CardContent className="p-4 text-center">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-2">
                    <Clock size={20} className="text-amber-600" />
                  </div>
                  <div className="text-2xl font-bold text-slate-700">{myDeliveries.length}</div>
                  <div className="text-xs text-slate-700">Pending</div>
                </CardContent>
              </GlassCard>
            </div>

            {/* On-time % */}
            <GlassCard>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <TrendingUp size={14} className="text-emerald-600" /> On-Time Rate
                  </div>
                  <span className="text-lg font-bold text-emerald-700">{selectedDriver.onTimeRate}%</span>
                </div>
                <div className="w-full h-3 bg-white/40 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all"
                    style={{ width: `${selectedDriver.onTimeRate}%` }} />
                </div>
              </CardContent>
            </GlassCard>

            {/* Rating */}
            <GlassCard>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Star size={14} className="text-amber-500" /> Driver Rating
                  </div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(i => (
                      <Star key={i} size={16}
                        className={i <= Math.round(selectedDriver.rating) ? 'text-amber-500 fill-amber-500' : 'text-slate-300'} />
                    ))}
                    <span className="text-sm font-bold text-slate-700 ml-1">{selectedDriver.rating}</span>
                  </div>
                </div>
              </CardContent>
            </GlassCard>

            {/* Total Trips */}
            <GlassCard>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Truck size={14} className="text-emerald-600" /> Total Trips
                  </div>
                  <span className="text-lg font-bold text-slate-700">{selectedDriver.tripsTotal}</span>
                </div>
              </CardContent>
            </GlassCard>

            {/* Today's History */}
            <div className="text-sm font-semibold text-slate-700 px-1">Today's Deliveries</div>
            {deliveries.map(d => (
              <GlassCard key={d.id}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-mono text-slate-700">{d.parcelId}</div>
                      <div className="text-sm font-medium text-slate-700">{d.recipientName}</div>
                      {d.notes && <div className="text-xs text-slate-700">{d.notes}</div>}
                    </div>
                    <Badge variant="outline" className={`${STATUS_COLORS[d.status]} text-xs`}>
                      {STATUS_LABELS[d.status]}
                    </Badge>
                  </div>
                </CardContent>
              </GlassCard>
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  }

  /* ========== LIST VIEW (default after login) ========== */
  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: '#E8E4F0' }}>
      {/* Header */}
      <div className="shrink-0 p-3 border-b border-white/30 bg-white/20 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          {selectedDriver && (
            <Button variant="ghost" size="sm" onClick={() => { setSelectedDriver(null); setView('login'); }}
              className="text-slate-600 h-9 w-9 p-0 rounded-xl">
              <LogOut size={18} />
            </Button>
          )}
          <div className="flex-1">
            <h1 className="text-base font-bold text-slate-700 leading-tight">
              {selectedDriver ? `Hi, ${selectedDriver.name}` : 'My Deliveries'}
            </h1>
            <p className="text-xs text-slate-700">
              {completedToday.length} done &middot; {myDeliveries.length} pending &middot; {failedToday.length} failed
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setView('performance')}
            className="text-slate-600 h-9 w-9 p-0 rounded-xl">
            <TrendingUp size={18} />
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}
            className="text-slate-600 h-9 w-9 p-0 rounded-xl">
            <X size={18} />
          </Button>
        </div>
      </div>

      {/* Delivery List */}
      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="p-3 space-y-3">
          {myDeliveries.length === 0 && (
            <div className="text-center py-12">
              <CheckCircle2 size={48} className="text-emerald-300 mx-auto mb-3" />
              <p className="text-slate-700 font-medium">All caught up!</p>
              <p className="text-xs text-slate-600 mt-1">No pending deliveries</p>
            </div>
          )}

          {myDeliveries.map(delivery => (
            <GlassCard key={delivery.id}
              onClick={() => { setActiveDelivery(delivery); setView('detail'); }}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-emerald-700">{delivery.parcelId}</span>
                      <Badge variant="outline" className={`${STATUS_COLORS[delivery.status]} text-[10px]`}>
                        {STATUS_LABELS[delivery.status]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <User size={12} className="text-slate-600" />
                      <span className="text-sm font-semibold text-slate-700">{delivery.recipientName}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-700">
                      <MapPin size={10} />
                      <span className="truncate">{delivery.address}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-600">
                      <span className="flex items-center gap-1">
                        <Phone size={10} /> {delivery.recipientPhone}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <a href={`tel:${delivery.recipientPhone}`}
                      onClick={e => e.stopPropagation()}
                      className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center shadow-md active:bg-emerald-700 transition-colors">
                      <Phone size={16} className="text-white" />
                    </a>
                  </div>
                </div>

                {/* Status Action Button */}
                {delivery.status !== 'DELIVERED' && delivery.status !== 'FAILED' && (
                  <div className="mt-3 pt-3 border-t border-white/30">
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        const next = getNextStatus(delivery.status);
                        if (next === 'ARRIVED') {
                          setActiveDelivery(delivery);
                          handleStatusChange(delivery.id, next);
                          setView('detail');
                        } else if (next) {
                          handleStatusChange(delivery.id, next);
                        }
                      }}
                      className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold h-10">
                      {getStatusButtonLabel(delivery.status)}
                    </Button>
                  </div>
                )}
              </CardContent>
            </GlassCard>
          ))}

          {/* Completed Today Section */}
          {completedToday.length > 0 && (
            <>
              <div className="text-xs font-semibold text-slate-700 px-1 pt-2 uppercase tracking-wider">
                Completed Today
              </div>
              {completedToday.map(d => (
                <GlassCard key={d.id} onClick={() => { setActiveDelivery(d); setView('detail'); }}>
                  <CardContent className="p-3 opacity-60">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-mono text-slate-700">{d.parcelId}</div>
                        <div className="text-sm text-slate-600">{d.recipientName}</div>
                      </div>
                      <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300 text-[10px]">
                        Done
                      </Badge>
                    </div>
                  </CardContent>
                </GlassCard>
              ))}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
