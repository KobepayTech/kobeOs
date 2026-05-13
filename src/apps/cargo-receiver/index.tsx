import { useState, useEffect } from 'react';
import { ensureSession } from '@/lib/auth';
import {
  Inbox, Package, Clock, CheckCircle2, Truck, Calendar,
  MapPin, Phone, User, Lock, Star, Bell, Search,
  Download, Sun, Sunset, Moon, Home, MessageSquare, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/* ─── types ─── */
interface Parcel {
  id: string;
  sender: string;
  origin: string;
  status: 'IN_TRANSIT' | 'ARRIVED' | 'OUT_FOR_DELIVERY' | 'DELIVERED';
  expectedDate: string;
}

interface DeliveryRecord {
  id: string;
  parcelId: string;
  sender: string;
  origin: string;
  deliveredDate: string;
  rating: number;
}

interface Notification {
  id: string;
  message: string;
  time: string;
  read: boolean;
  type: 'arrival' | 'schedule' | 'tracking';
}

/* ─── mock data ─── */
const RECEIVER = {
  name: 'Juma Abdallah',
  company: 'KOBECARGO DAR',
  phone: '0711223344',
};

const INCOMING_PARCELS: Parcel[] = [
  { id: 'KBE-R-001', sender: 'Ali Enterprises', origin: 'Mwanza', status: 'ARRIVED', expectedDate: '2024-01-15' },
  { id: 'KBE-R-002', sender: 'Tanzania Traders', origin: 'Arusha', status: 'IN_TRANSIT', expectedDate: '2024-01-18' },
  { id: 'KBE-R-003', sender: 'Moshi Supplies', origin: 'Moshi', status: 'OUT_FOR_DELIVERY', expectedDate: '2024-01-16' },
  { id: 'KBE-R-004', sender: 'Dodoma Goods Ltd', origin: 'Dodoma', status: 'IN_TRANSIT', expectedDate: '2024-01-20' },
  { id: 'KBE-R-005', sender: 'Zanzibar Exports', origin: 'Zanzibar', status: 'ARRIVED', expectedDate: '2024-01-14' },
];

const DELIVERY_HISTORY: DeliveryRecord[] = [
  { id: 'D-001', parcelId: 'KBE-R-091', sender: 'Kariakoo Market', origin: 'Dar es Salaam', deliveredDate: '2024-01-10', rating: 4 },
  { id: 'D-002', parcelId: 'KBE-R-092', sender: 'Mikocheni Traders', origin: 'Dar es Salaam', deliveredDate: '2024-01-08', rating: 5 },
  { id: 'D-003', parcelId: 'KBE-R-093', sender: 'Arusha Logistics', origin: 'Arusha', deliveredDate: '2024-01-05', rating: 3 },
  { id: 'D-004', parcelId: 'KBE-R-094', sender: 'Mbeya Farms', origin: 'Mbeya', deliveredDate: '2024-01-03', rating: 5 },
  { id: 'D-005', parcelId: 'KBE-R-095', sender: 'Tanga Imports', origin: 'Tanga', deliveredDate: '2023-12-28', rating: 4 },
  { id: 'D-006', parcelId: 'KBE-R-096', sender: 'Mwanza Wholesale', origin: 'Mwanza', deliveredDate: '2023-12-20', rating: 4 },
  { id: 'D-007', parcelId: 'KBE-R-097', sender: 'Morogoro Goods', origin: 'Morogoro', deliveredDate: '2023-12-15', rating: 5 },
  { id: 'D-008', parcelId: 'KBE-R-098', sender: 'Dodoma Supplies', origin: 'Dodoma', deliveredDate: '2023-12-10', rating: 3 },
  { id: 'D-009', parcelId: 'KBE-R-099', sender: 'Kilimanjaro Traders', origin: 'Moshi', deliveredDate: '2023-12-05', rating: 4 },
  { id: 'D-010', parcelId: 'KBE-R-100', sender: 'Lindi Exports', origin: 'Lindi', deliveredDate: '2023-11-28', rating: 5 },
  { id: 'D-011', parcelId: 'KBE-R-101', sender: 'Singida Market', origin: 'Singida', deliveredDate: '2023-11-20', rating: 4 },
  { id: 'D-012', parcelId: 'KBE-R-102', sender: 'Pwani Distributors', origin: 'Bagamoyo', deliveredDate: '2023-11-15', rating: 5 },
];

const INITIAL_NOTIFICATIONS: Notification[] = [
  { id: 'N-001', message: 'Your parcel KBE-R-003 has arrived at the warehouse', time: '10 min ago', read: false, type: 'arrival' },
  { id: 'N-002', message: 'Delivery scheduled for tomorrow at 2PM', time: '1 hr ago', read: false, type: 'schedule' },
  { id: 'N-003', message: 'Driver is 10 minutes away with your parcel KBE-R-003', time: '30 min ago', read: false, type: 'tracking' },
  { id: 'N-004', message: 'Your parcel KBE-R-001 is ready for pickup', time: '2 hrs ago', read: true, type: 'arrival' },
  { id: 'N-005', message: 'Parcel KBE-R-005 has been dispatched from origin', time: '3 hrs ago', read: true, type: 'schedule' },
  { id: 'N-006', message: 'Delivery for KBE-R-091 completed successfully', time: '1 day ago', read: true, type: 'arrival' },
];

/* ─── helpers ─── */
const statusConfig = {
  IN_TRANSIT: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', label: 'In Transit' },
  ARRIVED: { color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', label: 'Ready for Pickup' },
  OUT_FOR_DELIVERY: { color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', label: 'Out for Delivery' },
  DELIVERED: { color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', label: 'Delivered' },
};

function getNext7Days() {
  const days = [];
  const today = new Date();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push({
      dayName: i === 0 ? 'Today' : dayNames[d.getDay()],
      date: d.getDate(),
      month: d.toLocaleString('default', { month: 'short' }),
      fullDate: d.toISOString().split('T')[0],
    });
  }
  return days;
}

/* ─── component ─── */
export default function CargoReceiver() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [activeTab, setActiveTab] = useState('incoming');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { void ensureSession().catch(() => undefined); }, []);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  /* schedule */
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [address, setAddress] = useState('45 Kariakoo Street, Dar es Salaam');
  const [instructions, setInstructions] = useState('');
  const [scheduleSuccess, setScheduleSuccess] = useState(false);

  /* history */
  const [historyRatings, setHistoryRatings] = useState<Record<string, number>>({});
  const [receiptOpen, setReceiptOpen] = useState<string | null>(null);

  /* notifications */
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);

  /* login */
  const handleLogin = () => {
    if (loginForm.username.trim() && loginForm.password.trim()) {
      setIsLoggedIn(true);
    }
  };

  /* derived counts */
  const totalIncoming = INCOMING_PARCELS.length;
  const readyForPickup = INCOMING_PARCELS.filter(p => p.status === 'ARRIVED').length;
  const inTransitCount = INCOMING_PARCELS.filter(p => p.status === 'IN_TRANSIT').length;
  const deliveredCount = DELIVERY_HISTORY.length;

  /* filtered parcels */
  const filteredParcels = INCOMING_PARCELS.filter(p => {
    const matchesSearch = searchQuery === '' || p.id.toLowerCase().includes(searchQuery.toLowerCase()) || p.sender.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  /* schedule */
  const days = getNext7Days();
  const timeSlots = [
    { id: 'morning', label: 'Morning', time: '8AM - 12PM', icon: Sun },
    { id: 'afternoon', label: 'Afternoon', time: '12PM - 4PM', icon: Sunset },
    { id: 'evening', label: 'Evening', time: '4PM - 8PM', icon: Moon },
  ];

  const handleScheduleSubmit = () => {
    if (selectedSlot !== null && address.trim()) {
      setScheduleSuccess(true);
      setTimeout(() => {
        setScheduleSuccess(false);
        setSelectedSlot(null);
        setInstructions('');
      }, 3000);
    }
  };

  /* history */
  const handleRate = (id: string, rating: number) => {
    setHistoryRatings(prev => ({ ...prev, [id]: rating }));
  };

  /* notifications */
  const unreadCount = notifications.filter(n => !n.read).length;
  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };
  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  /* ─── Login Screen ─── */
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          {/* Logo */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-3">
              <Package className="w-8 h-8 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">KOBECARGO</h1>
            <p className="text-slate-400 text-sm">Receiver Portal</p>
          </div>

          {/* Login Card */}
          <Card className="bg-white/5 backdrop-blur-md border-white/10">
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-slate-300">Username / Email</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Enter username or email"
                    className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                    value={loginForm.username}
                    onChange={e => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-300">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="password"
                    placeholder="Enter password"
                    className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                    value={loginForm.password}
                    onChange={e => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  />
                </div>
              </div>
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleLogin}
              >
                Sign In
              </Button>
            </CardContent>
          </Card>

          {/* Request Access */}
          <Card className="bg-white/5 backdrop-blur-md border-white/10">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-white font-medium text-sm">Request Access</h3>
                  <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                    Contact your cargo company admin to create a receiver account. Only authorized receivers can access this portal.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  /* ─── Main App ─── */
  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Package className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-white font-bold text-sm">KOBECARGO</h1>
              <p className="text-slate-400 text-xs">{RECEIVER.company}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 mr-2">
              <Phone className="w-3 h-3" />
              <span>{RECEIVER.phone}</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <User className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* Tab Navigation */}
          <TabsList className="bg-white/5 border border-white/10 p-1 flex-wrap h-auto gap-1">
            <TabsTrigger
              value="incoming"
              className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 text-xs px-3 py-1.5"
            >
              <Inbox className="w-3.5 h-3.5 mr-1" />
              Incoming
            </TabsTrigger>
            <TabsTrigger
              value="schedule"
              className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 text-xs px-3 py-1.5"
            >
              <Calendar className="w-3.5 h-3.5 mr-1" />
              Schedule
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 text-xs px-3 py-1.5"
            >
              <Clock className="w-3.5 h-3.5 mr-1" />
              History
            </TabsTrigger>
            <TabsTrigger
              value="notifications"
              className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 text-xs px-3 py-1.5 relative"
            >
              <Bell className="w-3.5 h-3.5 mr-1" />
              Notifications
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-bold">
                  {unreadCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ─── TAB: INCOMING PARCELS ─── */}
          <TabsContent value="incoming" className="space-y-6">
            {/* Welcome */}
            <div>
              <h2 className="text-xl font-bold text-white">
                Welcome back, <span className="text-emerald-400">{RECEIVER.name}</span>
              </h2>
              <p className="text-slate-400 text-sm mt-1">Here are your incoming parcels</p>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Total Incoming', value: totalIncoming, icon: Inbox, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
                { label: 'Ready for Pickup', value: readyForPickup, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
                { label: 'In Transit', value: inTransitCount, icon: Truck, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
                { label: 'Delivered', value: deliveredCount, icon: Package, color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20' },
              ].map((stat) => (
                <Card key={stat.label} className={`${stat.bg} border backdrop-blur-md`}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                    <div>
                      <p className="text-xs text-slate-400">{stat.label}</p>
                      <p className="text-xl font-bold text-white">{stat.value}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Search & Filter */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search by parcel ID or sender..."
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-1 flex-wrap">
                {['ALL', 'IN_TRANSIT', 'ARRIVED', 'OUT_FOR_DELIVERY'].map(s => (
                  <Button
                    key={s}
                    variant={statusFilter === s ? 'default' : 'outline'}
                    size="sm"
                    className={`text-xs ${
                      statusFilter === s
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                    onClick={() => setStatusFilter(s)}
                  >
                    {s === 'ALL' ? 'All' : statusConfig[s as keyof typeof statusConfig]?.label || s}
                  </Button>
                ))}
              </div>
            </div>

            {/* Parcel Cards */}
            <ScrollArea className="h-[500px]">
              <div className="grid gap-3">
                {filteredParcels.map(parcel => (
                  <Card key={parcel.id} className="bg-white/5 backdrop-blur-md border-white/10 hover:border-white/20 transition-all">
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white font-bold text-sm">{parcel.id}</span>
                            <Badge variant="outline" className={`text-[10px] ${statusConfig[parcel.status].color}`}>
                              {statusConfig[parcel.status].label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-400">
                            <User className="w-3 h-3" />
                            <span>{parcel.sender}</span>
                            <span className="mx-1">|</span>
                            <MapPin className="w-3 h-3" />
                            <span>{parcel.origin}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <Calendar className="w-3 h-3" />
                            <span>Expected: {parcel.expectedDate}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {parcel.status === 'ARRIVED' && (
                            <>
                              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs" onClick={() => alert(`Pickup confirmed for ${parcel.id}`)}>
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                Confirm Pickup
                              </Button>
                              <Button size="sm" variant="outline" className="border-white/10 text-slate-300 hover:text-white hover:bg-white/10 text-xs" onClick={() => setActiveTab('schedule')}>
                                Schedule Delivery
                              </Button>
                            </>
                          )}
                          {parcel.status === 'OUT_FOR_DELIVERY' && (
                            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white text-xs" onClick={() => alert(`Tracking driver for ${parcel.id}...\nDriver: John M.\nETA: 10 minutes`)}>
                              <Truck className="w-3.5 h-3.5 mr-1" />
                              Track Driver
                            </Button>
                          )}
                          {parcel.status === 'IN_TRANSIT' && (
                            <Button size="sm" variant="outline" className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 text-xs" disabled>
                              <Truck className="w-3.5 h-3.5 mr-1" />
                              In Transit
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {filteredParcels.length === 0 && (
                  <div className="text-center py-12 text-slate-500 text-sm">No parcels found matching your search.</div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* ─── TAB: SCHEDULE DELIVERY ─── */}
          <TabsContent value="schedule" className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">Schedule Delivery</h2>
              <p className="text-slate-400 text-sm mt-1">Pick a date and time slot for your delivery</p>
            </div>

            {scheduleSuccess ? (
              <Card className="bg-emerald-500/10 border-emerald-500/20">
                <CardContent className="p-6 text-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-white">Delivery Scheduled!</h3>
                  <p className="text-slate-400 text-sm mt-1">
                    Your delivery has been scheduled for {days[selectedDay].dayName}, {days[selectedDay].month} {days[selectedDay].date} during the {timeSlots.find(s => s.id === selectedSlot)?.label} slot.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Day Selector */}
                <div className="space-y-2">
                  <label className="text-sm text-slate-300 font-medium">Select Date</label>
                  <div className="grid grid-cols-7 gap-2">
                    {days.map((day, idx) => (
                      <button
                        key={day.fullDate}
                        onClick={() => setSelectedDay(idx)}
                        className={`p-2 rounded-xl border text-center transition-all ${
                          selectedDay === idx
                            ? 'bg-emerald-600 border-emerald-500 text-white'
                            : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <div className="text-[10px] uppercase tracking-wider opacity-80">{day.dayName}</div>
                        <div className="text-lg font-bold">{day.date}</div>
                        <div className="text-[10px] opacity-80">{day.month}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Time Slot Selector */}
                <div className="space-y-2">
                  <label className="text-sm text-slate-300 font-medium">Select Time Slot</label>
                  <div className="grid grid-cols-3 gap-3">
                    {timeSlots.map(slot => {
                      const Icon = slot.icon;
                      return (
                        <button
                          key={slot.id}
                          onClick={() => setSelectedSlot(slot.id)}
                          className={`p-4 rounded-xl border text-center transition-all space-y-1 ${
                            selectedSlot === slot.id
                              ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                              : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <Icon className="w-5 h-5 mx-auto" />
                          <div className="text-sm font-medium">{slot.label}</div>
                          <div className="text-xs opacity-80">{slot.time}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-2">
                  <label className="text-sm text-slate-300 font-medium">Delivery Address</label>
                  <div className="relative">
                    <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      className="pl-10 bg-white/5 border-white/10 text-white"
                    />
                  </div>
                </div>

                {/* Special Instructions */}
                <div className="space-y-2">
                  <label className="text-sm text-slate-300 font-medium">Special Instructions</label>
                  <textarea
                    value={instructions}
                    onChange={e => setInstructions(e.target.value)}
                    placeholder="Any special instructions for the driver..."
                    className="w-full h-20 rounded-lg bg-white/5 border border-white/10 text-white p-3 text-sm placeholder:text-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>

                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={!selectedSlot || !address.trim()}
                  onClick={handleScheduleSubmit}
                >
                  Confirm Scheduling
                </Button>
              </>
            )}
          </TabsContent>

          {/* ─── TAB: DELIVERY HISTORY ─── */}
          <TabsContent value="history" className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">Delivery History</h2>
              <p className="text-slate-400 text-sm mt-1">Your past deliveries and receipts</p>
            </div>

            <ScrollArea className="h-[520px]">
              <div className="grid gap-3">
                {DELIVERY_HISTORY.map(record => (
                  <Card key={record.id} className="bg-white/5 backdrop-blur-md border-white/10">
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row justify-between gap-3">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-bold text-sm">{record.parcelId}</span>
                            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                              Delivered
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-400">
                            <User className="w-3 h-3" />
                            <span>{record.sender}</span>
                            <span className="mx-1">|</span>
                            <MapPin className="w-3 h-3" />
                            <span>{record.origin}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <Calendar className="w-3 h-3" />
                            <span>Delivered: {record.deliveredDate}</span>
                          </div>
                          {/* Rating */}
                          <div className="flex items-center gap-1 pt-1">
                            <span className="text-xs text-slate-500 mr-1">Rate:</span>
                            {[1, 2, 3, 4, 5].map(star => (
                              <button
                                key={star}
                                onClick={() => handleRate(record.id, star)}
                                className="transition-colors"
                              >
                                <Star
                                  className={`w-4 h-4 ${
                                    star <= (historyRatings[record.id] ?? record.rating)
                                      ? 'text-amber-400 fill-amber-400'
                                      : 'text-slate-600'
                                  }`}
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex sm:flex-col gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-white/10 text-slate-300 hover:text-white hover:bg-white/10 text-xs"
                            onClick={() => setReceiptOpen(record.id)}
                          >
                            <Download className="w-3.5 h-3.5 mr-1" />
                            Receipt
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* ─── TAB: NOTIFICATIONS ─── */}
          <TabsContent value="notifications" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Notifications</h2>
                <p className="text-slate-400 text-sm mt-1">Stay updated on your deliveries</p>
              </div>
              {unreadCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/10 text-slate-300 hover:text-white hover:bg-white/10 text-xs"
                  onClick={markAllRead}
                >
                  Mark All Read
                </Button>
              )}
            </div>

            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {notifications.map(notif => (
                  <div
                    key={notif.id}
                    className={`p-4 rounded-xl border transition-all ${
                      notif.read
                        ? 'bg-white/5 border-white/5'
                        : 'bg-white/5 border-white/20'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        notif.type === 'arrival'
                          ? 'bg-emerald-500/10 border border-emerald-500/20'
                          : notif.type === 'schedule'
                          ? 'bg-blue-500/10 border border-blue-500/20'
                          : 'bg-amber-500/10 border border-amber-500/20'
                      }`}>
                        {notif.type === 'arrival' ? (
                          <Package className="w-4 h-4 text-emerald-400" />
                        ) : notif.type === 'schedule' ? (
                          <Calendar className="w-4 h-4 text-blue-400" />
                        ) : (
                          <Truck className="w-4 h-4 text-amber-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${notif.read ? 'text-slate-400' : 'text-white'}`}>
                          {notif.message}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">{notif.time}</p>
                      </div>
                      {!notif.read && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-slate-500 hover:text-white flex-shrink-0"
                          onClick={() => markAsRead(notif.id)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </main>

      {/* Receipt Dialog */}
      <Dialog open={!!receiptOpen} onOpenChange={() => setReceiptOpen(null)}>
        <DialogContent className="bg-slate-900 border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Download className="w-4 h-4 text-emerald-400" />
              Delivery Receipt
            </DialogTitle>
          </DialogHeader>
          {receiptOpen && (
            <div className="space-y-3 text-sm">
              {(() => {
                const record = DELIVERY_HISTORY.find(r => r.id === receiptOpen);
                if (!record) return null;
                return (
                  <>
                    <div className="text-center pb-3 border-b border-white/10">
                      <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-2">
                        <Package className="w-6 h-6 text-emerald-400" />
                      </div>
                      <h3 className="text-lg font-bold text-white">KOBECARGO</h3>
                      <p className="text-xs text-slate-400">Delivery Receipt</p>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>Parcel ID:</span>
                        <span className="text-white font-mono">{record.parcelId}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Sender:</span>
                        <span className="text-white">{record.sender}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Origin:</span>
                        <span className="text-white">{record.origin}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Delivered:</span>
                        <span className="text-white">{record.deliveredDate}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Receiver:</span>
                        <span className="text-white">{RECEIVER.name}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Company:</span>
                        <span className="text-white">{RECEIVER.company}</span>
                      </div>
                      <div className="pt-2 border-t border-white/10">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Rating:</span>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map(s => (
                              <Star
                                key={s}
                                className={`w-3 h-3 ${
                                  s <= (historyRatings[record.id] ?? record.rating)
                                    ? 'text-amber-400 fill-amber-400'
                                    : 'text-slate-600'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    <Button
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs mt-2"
                      onClick={() => alert('Receipt downloaded!')}
                    >
                      <Download className="w-3.5 h-3.5 mr-1" />
                      Download PDF
                    </Button>
                  </>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
