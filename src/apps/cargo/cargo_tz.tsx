import { useState, useMemo } from 'react';
import {
  Package, QrCode, Truck, MapPin, CreditCard, UserCircle, ShieldAlert, ClipboardList,
  Container, LayoutDashboard, Search, Plus, CheckCircle2, CircleDot, Circle,
  ArrowRight, AlertTriangle, Clock, DollarSign, Phone, User, Box, ScanLine, Weight,
  FileText, ChevronRight, BarChart3, TrendingUp,
  Navigation, Award, Star, Zap, Eye,
  Route, Gauge, Activity, Target, Timer, Radio, Wifi,
  Lock, Send, Receipt, Wallet, Banknote,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { QRCodeSVG } from 'qrcode.react';

/* ------------------------------------------------------------------ */
/*  TYPES                                                               */
/* ------------------------------------------------------------------ */

interface TZParcel {
  id: string;
  parcelId: string;
  senderName: string;
  senderPhone: string;
  ownerName: string;
  ownerPhone: string;
  destination: string;
  packageCount: number;
  weight: number;
  description: string;
  paymentMode: 'PAY_NOW' | 'PAY_ON_ARRIVAL';
  status: 'REGISTERED' | 'VERIFIED' | 'PAID' | 'TRANSIT_PENDING' | 'IN_TRANSIT' | 'ARRIVED' | 'PAYMENT_REQUIRED' | 'RELEASED' | 'DELIVERED';
  qrStatus: 'BLACK' | 'YELLOW' | 'GREEN' | 'RED' | 'WHITE';
  transportFee: number;
  insurance: number;
  extraCharges: number;
  storageFees: number;
  totalPaid: number;
  registeredAt: string;
  cargoCompany: string;
  branch: string;
  tripId?: string;
}

interface TZTrip {
  id: string;
  vehiclePlate: string;
  driverName: string;
  driverPhone: string;
  route: string;
  checkpoints: { name: string; passed: boolean; timestamp?: string }[];
  status: 'SCHEDULED' | 'IN_TRANSIT' | 'ARRIVED' | 'COMPLETED';
  departureTime: string;
  arrivalTime?: string;
  parcelCount: number;
  parcels: string[];
  currentLocation: string;
}

interface TZDriver {
  id: string;
  name: string;
  phone: string;
  license: string;
  rating: number;
  trips: number;
  earnings: number;
  points: number;
  status: 'active' | 'on_trip' | 'off_duty';
  joined: string;
  rewards: { type: string; amount: number; date: string }[];
}

interface TZIncident {
  id: string;
  tripId: string;
  type: 'ACCIDENT' | 'THEFT' | 'BREAKDOWN' | 'POLICE_STOP' | 'DELAY' | 'OTHER';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location: string;
  timestamp: string;
  status: 'reported' | 'resolved' | 'escalated';
  reportedBy: string;
}

interface TZAuditLog {
  id: string;
  action: string;
  user: string;
  role: string;
  parcelId: string;
  timestamp: string;
  details: string;
}

/* ------------------------------------------------------------------ */
/*  DATA                                                                */
/* ------------------------------------------------------------------ */

const branches = ['Dar es Salaam', 'Morogoro', 'Dodoma', 'Singida', 'Shinyanga', 'Mwanza', 'Arusha', 'Tanga'];

const parcels: TZParcel[] = [
  { id:'p1', parcelId:'TZ-DSM-MWZ-000001', senderName:'Juma Hassan', senderPhone:'+255 713 111 222', ownerName:'Asha Mwangi', ownerPhone:'+255 714 333 444', destination:'Mwanza', packageCount:3, weight:45, description:'Electronics - TV, Radio, Phone charger', paymentMode:'PAY_NOW', status:'IN_TRANSIT', qrStatus:'GREEN', transportFee:45000, insurance:5000, extraCharges:0, storageFees:0, totalPaid:50000, registeredAt:'May 1, 2025 09:30', cargoCompany:'Kobe Transport', branch:'Dar es Salaam', tripId:'t1' },
  { id:'p2', parcelId:'TZ-DSM-DOD-000002', senderName:'Peter Omondi', senderPhone:'+255 715 555 666', ownerName:'Grace Wanjiru', ownerPhone:'+255 716 777 888', destination:'Dodoma', packageCount:2, weight:28, description:'Textiles - Fabric rolls', paymentMode:'PAY_ON_ARRIVAL', status:'IN_TRANSIT', qrStatus:'YELLOW', transportFee:32000, insurance:3000, extraCharges:0, storageFees:0, totalPaid:0, registeredAt:'May 2, 2025 14:15', cargoCompany:'Kobe Transport', branch:'Dar es Salaam', tripId:'t1' },
  { id:'p3', parcelId:'TZ-MOR-SHI-000003', senderName:'David Kimaro', senderPhone:'+255 717 999 000', ownerName:'Fatima Said', ownerPhone:'+255 718 111 222', destination:'Shinyanga', packageCount:5, weight:120, description:'Building materials - Cement bags', paymentMode:'PAY_NOW', status:'ARRIVED', qrStatus:'GREEN', transportFee:85000, insurance:12000, extraCharges:5000, storageFees:0, totalPaid:102000, registeredAt:'Apr 28, 2025 11:00', cargoCompany:'Kobe Transport', branch:'Morogoro', tripId:'t2' },
  { id:'p4', parcelId:'TZ-DOD-MWZ-000004', senderName:'John Mwansa', senderPhone:'+255 719 333 444', ownerName:'Mary Joseph', ownerPhone:'+255 720 555 666', destination:'Mwanza', packageCount:1, weight:8, description:'Documents and certificates', paymentMode:'PAY_ON_ARRIVAL', status:'ARRIVED', qrStatus:'RED', transportFee:15000, insurance:2000, extraCharges:0, storageFees:3000, totalPaid:0, registeredAt:'Apr 25, 2025 16:45', cargoCompany:'Kobe Transport', branch:'Dodoma', tripId:'t2' },
  { id:'p5', parcelId:'TZ-DSM-SIN-000005', senderName:'Ali Ibrahim', senderPhone:'+255 721 777 888', ownerName:'Rose Mwakasege', ownerPhone:'+255 722 999 000', destination:'Singida', packageCount:4, weight:65, description:'Furniture - Chairs and table', paymentMode:'PAY_NOW', status:'DELIVERED', qrStatus:'WHITE', transportFee:55000, insurance:8000, extraCharges:0, storageFees:0, totalPaid:63000, registeredAt:'Apr 20, 2025 08:30', cargoCompany:'Kobe Transport', branch:'Dar es Salaam', tripId:'t3' },
  { id:'p6', parcelId:'TZ-SHI-MWZ-000006', senderName:'Hassan Juma', senderPhone:'+255 723 111 333', ownerName:'Elizabeth Mcha', ownerPhone:'+255 724 444 555', destination:'Mwanza', packageCount:2, weight:35, description:'Pharma supplies - Medicines', paymentMode:'PAY_NOW', status:'IN_TRANSIT', qrStatus:'GREEN', transportFee:38000, insurance:6000, extraCharges:0, storageFees:0, totalPaid:44000, registeredAt:'May 3, 2025 10:00', cargoCompany:'Kobe Transport', branch:'Shinyanga', tripId:'t4' },
  { id:'p7', parcelId:'TZ-DSM-ARU-000007', senderName:'Omar Saidi', senderPhone:'+255 725 666 777', ownerName:'Sara Kimaro', ownerPhone:'+255 726 888 999', destination:'Arusha', packageCount:1, weight:12, description:'Laptop computer', paymentMode:'PAY_ON_ARRIVAL', status:'REGISTERED', qrStatus:'BLACK', transportFee:25000, insurance:15000, extraCharges:0, storageFees:0, totalPaid:0, registeredAt:'May 5, 2025 13:20', cargoCompany:'Kobe Transport', branch:'Dar es Salaam' },
  { id:'p8', parcelId:'TZ-MWZ-DAR-000008', senderName:'Patrick John', senderPhone:'+255 727 000 111', ownerName:'Joyce Leonard', ownerPhone:'+255 728 222 333', destination:'Dar es Salaam', packageCount:3, weight:55, description:'Fish products - Dried fish', paymentMode:'PAY_NOW', status:'DELIVERED', qrStatus:'WHITE', transportFee:42000, insurance:5000, extraCharges:2000, storageFees:0, totalPaid:49000, registeredAt:'Apr 15, 2025 07:45', cargoCompany:'Kobe Transport', branch:'Mwanza', tripId:'t5' },
];

const trips: TZTrip[] = [
  { id:'t1', vehiclePlate:'T 123 ABC', driverName:'Hassan Mwinyi', driverPhone:'+255 713 444 555', route:'Dar es Salaam → Morogoro → Dodoma → Singida → Shinyanga → Mwanza', checkpoints:[{name:'Dar es Salaam',passed:true,timestamp:'May 4 06:00'},{name:'Morogoro',passed:true,timestamp:'May 4 10:30'},{name:'Dodoma',passed:true,timestamp:'May 4 16:00'},{name:'Singida',passed:false},{name:'Shinyanga',passed:false},{name:'Mwanza',passed:false}], status:'IN_TRANSIT', departureTime:'May 4 06:00', parcelCount:4, parcels:['p1','p2','p6'], currentLocation:'Dodoma' },
  { id:'t2', vehiclePlate:'T 456 DEF', driverName:'James Kimaro', driverPhone:'+255 714 666 777', route:'Morogoro → Dodoma → Singida → Shinyanga → Mwanza', checkpoints:[{name:'Morogoro',passed:true,timestamp:'May 1 08:00'},{name:'Dodoma',passed:true,timestamp:'May 1 13:00'},{name:'Singida',passed:true,timestamp:'May 1 18:00'},{name:'Shinyanga',passed:true,timestamp:'May 2 02:00'},{name:'Mwanza',passed:true,timestamp:'May 2 08:00'}], status:'COMPLETED', departureTime:'May 1 08:00', arrivalTime:'May 2 08:00', parcelCount:3, parcels:['p3','p4'], currentLocation:'Mwanza' },
  { id:'t3', vehiclePlate:'T 789 GHI', driverName:'Peter Omari', driverPhone:'+255 715 888 999', route:'Dar es Salaam → Morogoro → Dodoma → Singida', checkpoints:[{name:'Dar es Salaam',passed:true,timestamp:'Apr 20 05:00'},{name:'Morogoro',passed:true,timestamp:'Apr 20 09:30'},{name:'Dodoma',passed:true,timestamp:'Apr 20 15:00'},{name:'Singida',passed:true,timestamp:'Apr 20 20:00'}], status:'COMPLETED', departureTime:'Apr 20 05:00', arrivalTime:'Apr 20 20:00', parcelCount:2, parcels:['p5'], currentLocation:'Singida' },
  { id:'t4', vehiclePlate:'T 321 JKL', driverName:'David Hassan', driverPhone:'+255 716 111 222', route:'Shinyanga → Mwanza', checkpoints:[{name:'Shinyanga',passed:true,timestamp:'May 3 14:00'},{name:'Mwanza',passed:false}], status:'IN_TRANSIT', departureTime:'May 3 14:00', parcelCount:1, parcels:['p6'], currentLocation:'Shinyanga' },
  { id:'t5', vehiclePlate:'T 654 MNO', driverName:'Abdul Rajab', driverPhone:'+255 717 333 444', route:'Mwanza → Shinyanga → Singida → Dodoma → Morogoro → Dar es Salaam', checkpoints:[{name:'Mwanza',passed:true,timestamp:'Apr 15 06:00'},{name:'Shinyanga',passed:true,timestamp:'Apr 15 10:00'},{name:'Singida',passed:true,timestamp:'Apr 15 15:00'},{name:'Dodoma',passed:true,timestamp:'Apr 15 19:00'},{name:'Morogoro',passed:true,timestamp:'Apr 16 00:30'},{name:'Dar es Salaam',passed:true,timestamp:'Apr 16 05:00'}], status:'COMPLETED', departureTime:'Apr 15 06:00', arrivalTime:'Apr 16 05:00', parcelCount:2, parcels:['p8'], currentLocation:'Dar es Salaam' },
];

const drivers: TZDriver[] = [
  { id:'d1', name:'Hassan Mwinyi', phone:'+255 713 444 555', license:'TL-2019-004512', rating:4.8, trips:142, earnings:2840000, points:2840, status:'on_trip', joined:'Jan 2019', rewards:[{type:'Fuel Bonus',amount:50000,date:'Apr 2025'},{type:'Perfect Route',amount:25000,date:'Mar 2025'}] },
  { id:'d2', name:'James Kimaro', phone:'+255 714 666 777', license:'TL-2020-008923', rating:4.6, trips:98, earnings:1960000, points:1960, status:'active', joined:'Mar 2020', rewards:[{type:'Speed Bonus',amount:30000,date:'Apr 2025'}] },
  { id:'d3', name:'Peter Omari', phone:'+255 715 888 999', license:'TL-2018-002341', rating:4.9, trips:201, earnings:4020000, points:4020, status:'active', joined:'Jun 2018', rewards:[{type:'Top Driver',amount:100000,date:'Apr 2025'},{type:'Fuel Bonus',amount:50000,date:'Mar 2025'}] },
  { id:'d4', name:'David Hassan', phone:'+255 716 111 222', license:'TL-2021-012345', rating:4.3, trips:45, earnings:720000, points:720, status:'on_trip', joined:'Aug 2021', rewards:[] },
  { id:'d5', name:'Abdul Rajab', phone:'+255 717 333 444', license:'TL-2017-001112', rating:4.7, trips:267, earnings:5340000, points:5340, status:'off_duty', joined:'Feb 2017', rewards:[{type:'Veteran Bonus',amount:150000,date:'Apr 2025'}] },
];

const incidents: TZIncident[] = [
  { id:'i1', tripId:'t1', type:'DELAY', severity:'low', description:'Traffic jam at Chalinze, 45min delay', location:'Chalinze', timestamp:'May 4 08:30', status:'resolved', reportedBy:'Hassan Mwinyi' },
  { id:'i2', tripId:'t4', type:'BREAKDOWN', severity:'high', description:'Tire burst on highway, replaced spare', location:'Shinyanga highway', timestamp:'May 3 15:30', status:'resolved', reportedBy:'David Hassan' },
  { id:'i3', tripId:'t2', type:'POLICE_STOP', severity:'low', description:'Routine traffic inspection, all clear', location:'Dodoma checkpoint', timestamp:'May 1 14:00', status:'resolved', reportedBy:'James Kimaro' },
  { id:'i4', tripId:'t1', type:'DELAY', severity:'medium', description:'Road construction near Dodoma, slow movement', location:'Dodoma approach', timestamp:'May 4 15:00', status:'reported', reportedBy:'Hassan Mwinyi' },
];

const auditLogs: TZAuditLog[] = [
  { id:'a1', action:'PARCEL_REGISTERED', user:'Juma Hassan', role:'sender', parcelId:'TZ-DSM-MWZ-000001', timestamp:'May 1 09:30', details:'Parcel registered at Dar es Salaam branch' },
  { id:'a2', action:'QR_SCANNED', user:'Receiver Agent', role:'receiver', parcelId:'TZ-DSM-MWZ-000001', timestamp:'May 1 10:00', details:'Black QR scanned, goods verified' },
  { id:'a3', action:'PAYMENT_RECEIVED', user:'Receiver Agent', role:'receiver', parcelId:'TZ-DSM-MWZ-000001', timestamp:'May 1 10:15', details:'TZS 50,000 paid via M-Pesa' },
  { id:'a4', action:'QR_GENERATED', user:'System', role:'system', parcelId:'TZ-DSM-MWZ-000001', timestamp:'May 1 10:15', details:'Green QR generated - PAID' },
  { id:'a5', action:'PARCEL_LOADED', user:'Loading Agent', role:'loader', parcelId:'TZ-DSM-MWZ-000001', timestamp:'May 3 18:00', details:'Loaded into vehicle T 123 ABC' },
  { id:'a6', action:'TRIP_STARTED', user:'Hassan Mwinyi', role:'driver', parcelId:'TZ-DSM-MWZ-000001', timestamp:'May 4 06:00', details:'Trip T1 started from Dar es Salaam' },
  { id:'a7', action:'CHECKPOINT_PASSED', user:'Hassan Mwinyi', role:'driver', parcelId:'TZ-DSM-MWZ-000001', timestamp:'May 4 10:30', details:'Checkpoint Morogoro passed' },
  { id:'a8', action:'CHECKPOINT_PASSED', user:'Hassan Mwinyi', role:'driver', parcelId:'TZ-DSM-MWZ-000001', timestamp:'May 4 16:00', details:'Checkpoint Dodoma passed' },
  { id:'a9', action:'PARCEL_REGISTERED', user:'David Kimaro', role:'sender', parcelId:'TZ-MOR-SHI-000003', timestamp:'Apr 28 11:00', details:'Parcel registered at Morogoro branch' },
  { id:'a10', action:'INCIDENT_REPORTED', user:'David Hassan', role:'driver', parcelId:'TZ-SHI-MWZ-000006', timestamp:'May 3 15:30', details:'Tire burst reported, spare replaced' },
];

/* ------------------------------------------------------------------ */
/*  HELPERS                                                             */
/* ------------------------------------------------------------------ */

const sidebarItems = [
  { key: 'overview', label: 'Overview', desc: 'Dashboard & analytics', icon: LayoutDashboard },
  { key: 'parcels', label: 'Parcels', desc: 'Manage shipments', icon: Package },
  { key: 'qr_hub', label: 'QR Hub', desc: 'Scan & verify codes', icon: QrCode },
  { key: 'loading', label: 'Loading', desc: 'Load parcels into trips', icon: Container },
  { key: 'trips', label: 'Trips', desc: 'Trip management', icon: Truck },
  { key: 'tracking', label: 'Tracking', desc: 'Live route tracking', icon: MapPin },
  { key: 'payments', label: 'Payments', desc: 'Fees & collections', icon: CreditCard },
  { key: 'drivers', label: 'Drivers', desc: 'Driver leaderboard', icon: UserCircle },
  { key: 'incidents', label: 'Incidents', desc: 'Safety & reports', icon: ShieldAlert },
  { key: 'audit', label: 'Audit', desc: 'Activity logs', icon: ClipboardList },
];

const qrSc: Record<string, string> = {
  BLACK: 'bg-gray-800 text-gray-200 border-gray-600',
  YELLOW: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  GREEN: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  RED: 'bg-red-500/15 text-red-400 border-red-500/30',
  WHITE: 'bg-white/10 text-white/80 border-white/20',
};

const statusLabels: Record<string, string> = {
  BLACK: 'Registered', YELLOW: 'Transit Pending', GREEN: 'Paid/Ready', RED: 'Payment Required', WHITE: 'Delivered'
};

const QSB = ({ qr }: { qr: string }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${qrSc[qr] || 'bg-gray-500/15 text-gray-400'}`}>
    <span className={`w-2 h-2 rounded-full mr-1 ${qr==='BLACK'?'bg-gray-500':qr==='YELLOW'?'bg-yellow-400':qr==='GREEN'?'bg-emerald-400':qr==='RED'?'bg-red-400':'bg-white'}`} />
    {statusLabels[qr] || qr}
  </span>
);

const PSB = ({ status }: { status: string }) => {
  const colors: Record<string, string> = {
    REGISTERED: 'bg-gray-500/15 text-gray-400', VERIFIED: 'bg-blue-500/15 text-blue-400',
    PAID: 'bg-emerald-500/15 text-emerald-400', TRANSIT_PENDING: 'bg-yellow-500/15 text-yellow-400',
    IN_TRANSIT: 'bg-indigo-500/15 text-indigo-400', ARRIVED: 'bg-cyan-500/15 text-cyan-400',
    PAYMENT_REQUIRED: 'bg-red-500/15 text-red-400', RELEASED: 'bg-violet-500/15 text-violet-400',
    DELIVERED: 'bg-white/10 text-white/80',
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border border-white/[0.06] ${colors[status] || ''}`}>{status.replace(/_/g, ' ')}</span>;
};

/* ------------------------------------------------------------------ */
/*  1. OVERVIEW TAB                                                     */
/* ------------------------------------------------------------------ */

function OverviewTab() {
  const stats = useMemo(() => {
    const totalParcels = parcels.length;
    const inTransit = parcels.filter(p => p.status === 'IN_TRANSIT').length;
    const delivered = parcels.filter(p => p.status === 'DELIVERED').length;
    const revenue = parcels.reduce((s, p) => s + p.totalPaid, 0);
    const activeTrips = trips.filter(t => t.status === 'IN_TRANSIT').length;
    const activeDrivers = drivers.filter(d => d.status === 'on_trip').length;
    const qrBreakdown = {
      BLACK: parcels.filter(p => p.qrStatus === 'BLACK').length,
      YELLOW: parcels.filter(p => p.qrStatus === 'YELLOW').length,
      GREEN: parcels.filter(p => p.qrStatus === 'GREEN').length,
      RED: parcels.filter(p => p.qrStatus === 'RED').length,
      WHITE: parcels.filter(p => p.qrStatus === 'WHITE').length,
    };
    const transportFees = parcels.reduce((s, p) => s + p.transportFee, 0);
    const insurance = parcels.reduce((s, p) => s + p.insurance, 0);
    const extra = parcels.reduce((s, p) => s + p.extraCharges, 0);
    return { totalParcels, inTransit, delivered, revenue, activeTrips, activeDrivers, qrBreakdown, transportFees, insurance, extra };
  }, []);

  return (
    <div className="h-[calc(100vh-80px)] overflow-y-auto">
      <div className="space-y-6 p-1">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {[
            { label: 'Total Parcels', value: stats.totalParcels, icon: Package, color: 'text-amber-400' },
            { label: 'In Transit', value: stats.inTransit, icon: Truck, color: 'text-indigo-400' },
            { label: 'Delivered', value: stats.delivered, icon: CheckCircle2, color: 'text-emerald-400' },
            { label: 'Revenue (TZS)', value: stats.revenue.toLocaleString(), icon: DollarSign, color: 'text-green-400' },
            { label: 'Active Trips', value: stats.activeTrips, icon: Route, color: 'text-cyan-400' },
            { label: 'Active Drivers', value: stats.activeDrivers, icon: UserCircle, color: 'text-violet-400' },
          ].map((kpi) => (
            <Card key={kpi.label} className="bg-white/[0.03] border-white/[0.06]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                  <TrendingUp className="w-3.5 h-3.5 text-white/30" />
                </div>
                <div className="text-2xl font-bold text-white/90">{kpi.value}</div>
                <div className="text-xs text-white/50 mt-1">{kpi.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* QR Status Breakdown */}
        <Card className="bg-white/[0.03] border-white/[0.06]">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-white/90 mb-4 flex items-center gap-2">
              <QrCode className="w-4 h-4 text-amber-400" /> Parcels by QR Status
            </h3>
            <div className="flex flex-wrap gap-3">
              {(['BLACK','YELLOW','GREEN','RED','WHITE'] as const).map(qr => (
                <div key={qr} className="flex items-center gap-2 bg-white/[0.03] rounded-lg px-3 py-2 border border-white/[0.06]">
                  <QSB qr={qr} />
                  <span className="text-lg font-bold text-white/90">{stats.qrBreakdown[qr]}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Trips */}
        <Card className="bg-white/[0.03] border-white/[0.06]">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-white/90 mb-4 flex items-center gap-2">
              <Route className="w-4 h-4 text-amber-400" /> Recent Trips
            </h3>
            <div className="space-y-2">
              {trips.map(trip => (
                <div key={trip.id} className="flex items-center justify-between p-3 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <Truck className="w-5 h-5 text-indigo-400" />
                    <div>
                      <div className="text-sm font-medium text-white/90">{trip.vehiclePlate} — {trip.driverName}</div>
                      <div className="text-xs text-white/50">{trip.route}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-xs text-white/50">Current</div>
                      <div className="text-sm text-white/80 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-amber-400" /> {trip.currentLocation}
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${trip.status === 'IN_TRANSIT' ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30' : trip.status === 'COMPLETED' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-gray-500/15 text-gray-400'}`}>
                      {trip.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Revenue Breakdown */}
        <Card className="bg-white/[0.03] border-white/[0.06]">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-white/90 mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-400" /> Revenue Breakdown
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { label: 'Transport Fees', value: stats.transportFees, icon: Truck, color: 'text-indigo-400' },
                { label: 'Insurance', value: stats.insurance, icon: ShieldAlert, color: 'text-cyan-400' },
                { label: 'Extra Charges', value: stats.extra, icon: Zap, color: 'text-amber-400' },
              ].map(item => (
                <div key={item.label} className="p-3 bg-white/[0.03] rounded-lg border border-white/[0.06] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <item.icon className={`w-4 h-4 ${item.color}`} />
                    <span className="text-sm text-white/70">{item.label}</span>
                  </div>
                  <span className="text-sm font-bold text-white/90">TZS {item.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Audit Logs */}
        <Card className="bg-white/[0.03] border-white/[0.06]">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-white/90 mb-4 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-amber-400" /> Recent Audit Activity
            </h3>
            <div className="space-y-2">
              {auditLogs.slice(0, 5).map(log => (
                <div key={log.id} className="flex items-center gap-3 p-2 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                  <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
                    <Activity className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-white/90 truncate">{log.action}</div>
                    <div className="text-xs text-white/50">{log.user} • {log.parcelId}</div>
                  </div>
                  <div className="text-xs text-white/40 shrink-0">{log.timestamp}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  2. PARCELS TAB                                                      */
/* ------------------------------------------------------------------ */

function ParcelsTab() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [selectedParcel, setSelectedParcel] = useState<TZParcel | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [newParcel, setNewParcel] = useState<{ senderName: string; senderPhone: string; ownerName: string; ownerPhone: string; destination: string; packageCount: number; weight: number; description: string; paymentMode: 'PAY_NOW' | 'PAY_ON_ARRIVAL' }>({ senderName:'', senderPhone:'', ownerName:'', ownerPhone:'', destination:'', packageCount:1, weight:0, description:'', paymentMode:'PAY_NOW' });

  const statuses = ['ALL','REGISTERED','VERIFIED','PAID','TRANSIT_PENDING','IN_TRANSIT','ARRIVED','PAYMENT_REQUIRED','DELIVERED'];

  const filtered = useMemo(() => {
    return parcels.filter(p => {
      const matchesSearch = !search || p.parcelId.toLowerCase().includes(search.toLowerCase()) || p.senderName.toLowerCase().includes(search.toLowerCase()) || p.ownerName.toLowerCase().includes(search.toLowerCase()) || p.senderPhone.includes(search) || p.ownerPhone.includes(search);
      const matchesStatus = filterStatus === 'ALL' || p.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [search, filterStatus]);

  const handleRegister = () => {
    setRegisterOpen(false);
    setNewParcel({ senderName:'', senderPhone:'', ownerName:'', ownerPhone:'', destination:'', packageCount:1, weight:0, description:'', paymentMode:'PAY_NOW' });
  };

  return (
    <div className="h-[calc(100vh-80px)] overflow-y-auto">
      <div className="space-y-4 p-1">
        {/* Search & Filter */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input placeholder="Search by parcel ID, sender, owner, phone..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-10 bg-white/[0.03] border-white/[0.06] text-white/90 placeholder:text-white/30" />
          </div>
          <Button onClick={() => setRegisterOpen(true)} className="bg-amber-500 hover:bg-amber-600 text-black font-medium">
            <Plus className="w-4 h-4 mr-1" /> Register New Parcel
          </Button>
        </div>

        {/* Status Filters */}
        <div className="flex flex-wrap gap-2">
          {statuses.map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${filterStatus === s ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'bg-white/[0.03] text-white/50 border-white/[0.06] hover:text-white/80'}`}>
              {s === 'ALL' ? 'All' : s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        {/* Parcel Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(p => (
            <div key={p.id} onClick={() => { setSelectedParcel(p); setDetailOpen(true); }}
              className="p-4 bg-white/[0.03] rounded-xl border border-white/[0.06] cursor-pointer hover:bg-white/[0.06] transition-colors">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-mono font-semibold text-amber-400">{p.parcelId}</span>
                <div className="flex gap-2">
                  <QSB qr={p.qrStatus} />
                  <PSB status={p.status} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div><span className="text-white/40">Sender:</span> <span className="text-white/80">{p.senderName}</span></div>
                <div><span className="text-white/40">Owner:</span> <span className="text-white/80">{p.ownerName}</span></div>
                <div><span className="text-white/40">Destination:</span> <span className="text-white/80">{p.destination}</span></div>
                <div><span className="text-white/40">Branch:</span> <span className="text-white/80">{p.branch}</span></div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex gap-3">
                  <span className="flex items-center gap-1 text-white/50"><Box className="w-3 h-3" /> {p.packageCount} pkgs</span>
                  <span className="flex items-center gap-1 text-white/50"><Weight className="w-3 h-3" /> {p.weight} kg</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${p.paymentMode === 'PAY_NOW' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'}`}>
                  {p.paymentMode === 'PAY_NOW' ? 'Pay Now' : 'Pay on Arrival'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="bg-[#0f0f2a] border-white/[0.08] text-white max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedParcel && (
            <>
              <DialogHeader><DialogTitle className="text-white/90 flex items-center gap-2"><Package className="w-5 h-5 text-amber-400" /> {selectedParcel.parcelId}</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="flex items-center gap-3">
                  <QSB qr={selectedParcel.qrStatus} />
                  <PSB status={selectedParcel.status} />
                </div>

                {/* QR Code */}
                <div className="flex justify-center p-4 bg-white rounded-lg">
                  <QRCodeSVG value={selectedParcel.parcelId} size={160} />
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                    <div className="text-white/40 text-xs mb-1">Sender</div>
                    <div className="text-white/90 font-medium">{selectedParcel.senderName}</div>
                    <div className="text-white/50 text-xs flex items-center gap-1 mt-1"><Phone className="w-3 h-3" />{selectedParcel.senderPhone}</div>
                  </div>
                  <div className="p-3 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                    <div className="text-white/40 text-xs mb-1">Owner</div>
                    <div className="text-white/90 font-medium">{selectedParcel.ownerName}</div>
                    <div className="text-white/50 text-xs flex items-center gap-1 mt-1"><Phone className="w-3 h-3" />{selectedParcel.ownerPhone}</div>
                  </div>
                  <div className="p-3 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                    <div className="text-white/40 text-xs mb-1">Destination</div>
                    <div className="text-white/90">{selectedParcel.destination}</div>
                    <div className="text-white/50 text-xs mt-1">Branch: {selectedParcel.branch}</div>
                  </div>
                  <div className="p-3 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                    <div className="text-white/40 text-xs mb-1">Packages</div>
                    <div className="text-white/90">{selectedParcel.packageCount} pkgs • {selectedParcel.weight} kg</div>
                    <div className="text-white/50 text-xs mt-1">{selectedParcel.description}</div>
                  </div>
                </div>

                {/* Financial */}
                <div className="p-3 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                  <div className="text-white/40 text-xs mb-2">Financial Details</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between"><span className="text-white/60">Transport Fee:</span><span className="text-white/90">TZS {selectedParcel.transportFee.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-white/60">Insurance:</span><span className="text-white/90">TZS {selectedParcel.insurance.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-white/60">Extra Charges:</span><span className="text-white/90">TZS {selectedParcel.extraCharges.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-white/60">Storage Fees:</span><span className="text-white/90">TZS {selectedParcel.storageFees.toLocaleString()}</span></div>
                    <div className="flex justify-between border-t border-white/[0.06] pt-2 mt-1"><span className="text-white/80 font-medium">Total Paid:</span><span className="text-emerald-400 font-medium">TZS {selectedParcel.totalPaid.toLocaleString()}</span></div>
                    <div className="flex justify-between border-t border-white/[0.06] pt-2 mt-1"><span className="text-white/80 font-medium">Balance:</span><span className="text-red-400 font-medium">TZS {(selectedParcel.transportFee + selectedParcel.insurance + selectedParcel.extraCharges + selectedParcel.storageFees - selectedParcel.totalPaid).toLocaleString()}</span></div>
                  </div>
                </div>

                {/* Audit Trail for this parcel */}
                <div className="p-3 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                  <div className="text-white/40 text-xs mb-2">Audit Trail</div>
                  <div className="space-y-2">
                    {auditLogs.filter(l => l.parcelId === selectedParcel.parcelId).map(log => (
                      <div key={log.id} className="flex items-start gap-2 text-xs">
                        <Clock className="w-3 h-3 text-white/30 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-white/70">{log.action}</span>
                          <span className="text-white/40"> — {log.details}</span>
                          <div className="text-white/30">{log.timestamp} by {log.user}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Register Dialog */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="bg-[#0f0f2a] border-white/[0.08] text-white max-w-lg">
          <DialogHeader><DialogTitle className="text-white/90 flex items-center gap-2"><Plus className="w-5 h-5 text-amber-400" /> Register New Parcel</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-white/50">Sender Name</label><Input value={newParcel.senderName} onChange={e => setNewParcel({...newParcel, senderName:e.target.value})} className="bg-white/[0.03] border-white/[0.06] text-white/90" /></div>
              <div><label className="text-xs text-white/50">Sender Phone</label><Input value={newParcel.senderPhone} onChange={e => setNewParcel({...newParcel, senderPhone:e.target.value})} className="bg-white/[0.03] border-white/[0.06] text-white/90" /></div>
              <div><label className="text-xs text-white/50">Owner Name</label><Input value={newParcel.ownerName} onChange={e => setNewParcel({...newParcel, ownerName:e.target.value})} className="bg-white/[0.03] border-white/[0.06] text-white/90" /></div>
              <div><label className="text-xs text-white/50">Owner Phone</label><Input value={newParcel.ownerPhone} onChange={e => setNewParcel({...newParcel, ownerPhone:e.target.value})} className="bg-white/[0.03] border-white/[0.06] text-white/90" /></div>
            </div>
            <div><label className="text-xs text-white/50">Destination</label>
              <select value={newParcel.destination} onChange={e => setNewParcel({...newParcel, destination:e.target.value})} className="w-full h-10 rounded-md bg-white/[0.03] border border-white/[0.06] text-white/90 px-3 text-sm">
                <option value="">Select destination</option>
                {branches.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-white/50">Package Count</label><Input type="number" value={newParcel.packageCount} onChange={e => setNewParcel({...newParcel, packageCount:parseInt(e.target.value)||0})} className="bg-white/[0.03] border-white/[0.06] text-white/90" /></div>
              <div><label className="text-xs text-white/50">Weight (kg)</label><Input type="number" value={newParcel.weight} onChange={e => setNewParcel({...newParcel, weight:parseInt(e.target.value)||0})} className="bg-white/[0.03] border-white/[0.06] text-white/90" /></div>
            </div>
            <div><label className="text-xs text-white/50">Description</label><Input value={newParcel.description} onChange={e => setNewParcel({...newParcel, description:e.target.value})} className="bg-white/[0.03] border-white/[0.06] text-white/90" /></div>
            <div><label className="text-xs text-white/50">Payment Mode</label>
              <select value={newParcel.paymentMode} onChange={e => setNewParcel({...newParcel, paymentMode:e.target.value as 'PAY_NOW'|'PAY_ON_ARRIVAL'})} className="w-full h-10 rounded-md bg-white/[0.03] border border-white/[0.06] text-white/90 px-3 text-sm">
                <option value="PAY_NOW">Pay Now</option>
                <option value="PAY_ON_ARRIVAL">Pay on Arrival</option>
              </select>
            </div>
            <Button onClick={handleRegister} className="w-full bg-amber-500 hover:bg-amber-600 text-black font-medium">Register Parcel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  3. QR HUB TAB                                                       */
/* ------------------------------------------------------------------ */

function QRHubTab() {
  const [scanInput, setScanInput] = useState('');
  const [scannedParcel, setScannedParcel] = useState<TZParcel | null>(null);
  const [filterQR, setFilterQR] = useState<string>('ALL');
  const [selectedParcel, setSelectedParcel] = useState<TZParcel | null>(null);
  const [parcelDetailOpen, setParcelDetailOpen] = useState(false);

  const handleScan = () => {
    const found = parcels.find(p => p.parcelId === scanInput || p.id === scanInput);
    setScannedParcel(found || null);
  };

  const qrFiltered = useMemo(() => {
    return filterQR === 'ALL' ? parcels : parcels.filter(p => p.qrStatus === filterQR);
  }, [filterQR]);

  const lifecycle = [
    { from: 'BLACK', to: 'YELLOW', label: 'Verified & Pending', arrow: '→' },
    { from: 'YELLOW', to: 'GREEN', label: 'Paid & Ready', arrow: '→' },
    { from: 'GREEN', to: 'WHITE', label: 'Delivered', arrow: '→' },
    { from: 'BLACK', to: 'RED', label: 'Pay on Arrival', arrow: '⇢' },
    { from: 'RED', to: 'WHITE', label: 'Paid at Destination', arrow: '→' },
  ];

  return (
    <div className="h-[calc(100vh-80px)] overflow-y-auto">
      <div className="space-y-6 p-1">
        {/* QR Lifecycle Diagram */}
        <Card className="bg-white/[0.03] border-white/[0.06]">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-white/90 mb-4 flex items-center gap-2">
              <Route className="w-4 h-4 text-amber-400" /> QR Code Lifecycle
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {lifecycle.map((step, i) => (
                <div key={i} className="flex items-center gap-2 p-3 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                  <QSB qr={step.from} />
                  <ArrowRight className="w-4 h-4 text-white/30" />
                  <QSB qr={step.to} />
                  <span className="text-xs text-white/50 ml-1">{step.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Scanner Input */}
        <Card className="bg-white/[0.03] border-white/[0.06]">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-white/90 mb-3 flex items-center gap-2">
              <ScanLine className="w-4 h-4 text-amber-400" /> QR Scanner (Simulated)
            </h3>
            <div className="flex gap-2">
              <Input placeholder="Enter Parcel ID to scan..." value={scanInput} onChange={e => setScanInput(e.target.value)}
                className="flex-1 bg-white/[0.03] border-white/[0.06] text-white/90 placeholder:text-white/30" />
              <Button onClick={handleScan} className="bg-amber-500 hover:bg-amber-600 text-black font-medium">
                <ScanLine className="w-4 h-4 mr-1" /> Scan
              </Button>
            </div>
            {scannedParcel && (
              <div className="mt-4 p-4 bg-white/[0.05] rounded-lg border border-amber-500/20">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-mono font-semibold text-amber-400">{scannedParcel.parcelId}</span>
                  <QSB qr={scannedParcel.qrStatus} />
                </div>
                <div className="flex justify-center p-3 bg-white rounded-lg mb-3">
                  <QRCodeSVG value={scannedParcel.parcelId} size={140} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-white/40">Sender:</span> <span className="text-white/80">{scannedParcel.senderName}</span></div>
                  <div><span className="text-white/40">Owner:</span> <span className="text-white/80">{scannedParcel.ownerName}</span></div>
                  <div><span className="text-white/40">Status:</span> <span className="text-white/80">{scannedParcel.status.replace(/_/g,' ')}</span></div>
                  <div><span className="text-white/40">Destination:</span> <span className="text-white/80">{scannedParcel.destination}</span></div>
                </div>
              </div>
            )}
            {scanInput && !scannedParcel && (
              <div className="mt-4 p-3 bg-red-500/10 rounded-lg border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Parcel not found
              </div>
            )}
          </CardContent>
        </Card>

        {/* QR Color Legend & Filter */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilterQR('ALL')} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${filterQR === 'ALL' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'bg-white/[0.03] text-white/50 border-white/[0.06]'}`}>All</button>
          {(['BLACK','YELLOW','GREEN','RED','WHITE'] as const).map(qr => (
            <button key={qr} onClick={() => setFilterQR(qr)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${filterQR === qr ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'bg-white/[0.03] text-white/50 border-white/[0.06]'}`}>
              <span className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${qr==='BLACK'?'bg-gray-500':qr==='YELLOW'?'bg-yellow-400':qr==='GREEN'?'bg-emerald-400':qr==='RED'?'bg-red-400':'bg-white'}`} /> {statusLabels[qr]}</span>
            </button>
          ))}
        </div>

        {/* Parcel QR Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {qrFiltered.map(p => (
            <div key={p.id} onClick={() => { setSelectedParcel(p); setParcelDetailOpen(true); }}
              className="p-4 bg-white/[0.03] rounded-xl border border-white/[0.06] cursor-pointer hover:bg-white/[0.06] transition-colors">
              <div className="flex justify-center p-2 bg-white rounded-lg mb-3">
                <QRCodeSVG value={p.parcelId} size={120} />
              </div>
              <div className="text-xs font-mono text-amber-400 text-center mb-2">{p.parcelId}</div>
              <div className="flex items-center justify-between mb-1">
                <QSB qr={p.qrStatus} />
                <PSB status={p.status} />
              </div>
              <div className="text-xs text-white/50 mt-2">{p.senderName} → {p.destination}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Parcel Detail with QR Status Change */}
      <Dialog open={parcelDetailOpen} onOpenChange={setParcelDetailOpen}>
        <DialogContent className="bg-[#0f0f2a] border-white/[0.08] text-white max-w-md">
          {selectedParcel && (
            <>
              <DialogHeader><DialogTitle className="text-white/90">{selectedParcel.parcelId}</DialogTitle></DialogHeader>
              <div className="flex justify-center p-4 bg-white rounded-lg mt-2">
                <QRCodeSVG value={selectedParcel.parcelId} size={180} />
              </div>
              <div className="text-center text-sm text-white/70 mt-2">{selectedParcel.senderName} → {selectedParcel.destination}</div>
              <div className="flex items-center justify-center gap-2 mt-1"><QSB qr={selectedParcel.qrStatus} /></div>
              <div className="mt-4">
                <div className="text-xs text-white/50 mb-2">Change QR Status</div>
                <div className="flex flex-wrap gap-2">
                  {(['BLACK','YELLOW','GREEN','RED','WHITE'] as const).map(qr => (
                    <button key={qr} disabled={qr === selectedParcel.qrStatus}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${qr === selectedParcel.qrStatus ? 'opacity-40 cursor-not-allowed bg-white/[0.03] text-white/30' : 'bg-white/[0.03] hover:bg-amber-500/15 hover:text-amber-400 hover:border-amber-500/30 text-white/60 border-white/[0.06]'}`}>
                      {statusLabels[qr]}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


/* ------------------------------------------------------------------ */
/*  4. LOADING TAB                                                      */
/* ------------------------------------------------------------------ */

function LoadingTab() {
  const [selectedTripId, setSelectedTripId] = useState<string>('t1');
  const [loadedParcels, setLoadedParcels] = useState<Record<string, boolean>>({
    'p1': true, 'p2': false, 'p6': false,
  });

  const activeTrips = trips.filter(t => t.status === 'IN_TRANSIT' || t.status === 'SCHEDULED');
  const selectedTrip = activeTrips.find(t => t.id === selectedTripId) || activeTrips[0];
  const tripParcels = selectedTrip ? parcels.filter(p => selectedTrip.parcels.includes(p.id)) : [];
  const loadedCount = tripParcels.filter(p => loadedParcels[p.id]).length;
  const totalCount = tripParcels.length;
  const progress = totalCount > 0 ? (loadedCount / totalCount) * 100 : 0;

  const toggleLoaded = (parcelId: string) => {
    setLoadedParcels(prev => ({ ...prev, [parcelId]: !prev[parcelId] }));
  };

  return (
    <div className="h-[calc(100vh-80px)] overflow-y-auto">
      <div className="space-y-4 p-1">
        {/* Active Trips Selector */}
        <div className="flex flex-wrap gap-2">
          {activeTrips.map(t => (
            <button key={t.id} onClick={() => setSelectedTripId(t.id)}
              className={`px-4 py-2 rounded-lg text-xs font-medium border transition-colors ${selectedTripId === t.id ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'bg-white/[0.03] text-white/50 border-white/[0.06] hover:text-white/80'}`}>
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4" />
                <span>{t.vehiclePlate}</span>
                <span className="text-white/30">|</span>
                <span>{t.driverName}</span>
              </div>
            </button>
          ))}
        </div>

        {selectedTrip && (
          <>
            {/* Trip Info */}
            <Card className="bg-white/[0.03] border-white/[0.06]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-500/15 flex items-center justify-center">
                      <Truck className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white/90">{selectedTrip.vehiclePlate} — {selectedTrip.driverName}</div>
                      <div className="text-xs text-white/50 flex items-center gap-1"><Route className="w-3 h-3" /> {selectedTrip.route}</div>
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded-full text-[10px] font-medium border bg-indigo-500/15 text-indigo-400 border-indigo-500/30">
                    {selectedTrip.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="text-xs text-white/50 mb-3">Departure: {selectedTrip.departureTime}</div>

                {/* Progress Bar */}
                <div className="mb-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-white/60">Loading Progress</span>
                    <span className="text-amber-400 font-medium">{loadedCount}/{totalCount} loaded</span>
                  </div>
                  <div className="w-full h-3 bg-white/[0.06] rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Loading Manifest */}
            <Card className="bg-white/[0.03] border-white/[0.06]">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-white/90 mb-4 flex items-center gap-2">
                  <Container className="w-4 h-4 text-amber-400" /> Loading Manifest
                </h3>
                <div className="space-y-2">
                  {tripParcels.map(p => (
                    <div key={p.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${loadedParcels[p.id] ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-white/[0.03] border-white/[0.06]'}`}>
                      <button onClick={() => toggleLoaded(p.id)}
                        className={`w-6 h-6 rounded-md border flex items-center justify-center transition-colors ${loadedParcels[p.id] ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-white/20 hover:border-white/40'}`}>
                        {loadedParcels[p.id] && <CheckCircle2 className="w-4 h-4" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono text-amber-400">{p.parcelId}</span>
                          <QSB qr={p.qrStatus} />
                        </div>
                        <div className="flex items-center gap-3 text-xs text-white/50 mt-1">
                          <span className="flex items-center gap-1"><User className="w-3 h-3" /> {p.senderName}</span>
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {p.destination}</span>
                          <span className="flex items-center gap-1"><Weight className="w-3 h-3" /> {p.weight} kg</span>
                          <span className="flex items-center gap-1"><Box className="w-3 h-3" /> {p.packageCount} pkgs</span>
                        </div>
                      </div>
                      {loadedParcels[p.id] ? (
                        <span className="text-[10px] text-emerald-400 font-medium">Loaded</span>
                      ) : (
                        <span className="text-[10px] text-white/30">Pending</span>
                      )}
                    </div>
                  ))}
                </div>

                {progress === 100 ? (
                  <div className="mt-4 p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> All parcels loaded. Ready for departure.
                  </div>
                ) : (
                  <div className="mt-4 text-xs text-white/40">{totalCount - loadedCount} parcel(s) remaining to load</div>
                )}

                <Button className="w-full mt-4 bg-amber-500 hover:bg-amber-600 text-black font-medium" disabled={progress < 100}>
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Confirm Loading Complete
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  5. TRIPS TAB                                                        */
/* ------------------------------------------------------------------ */

function TripsTab() {
  const [expandedTrip, setExpandedTrip] = useState<string | null>('t1');

  const toggleExpand = (tripId: string) => {
    setExpandedTrip(expandedTrip === tripId ? null : tripId);
  };

  return (
    <div className="h-[calc(100vh-80px)] overflow-y-auto">
      <div className="space-y-3 p-1">
        {trips.map(trip => (
          <Card key={trip.id} className="bg-white/[0.03] border-white/[0.06]">
            <CardContent className="p-4">
              {/* Trip Header */}
              <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleExpand(trip.id)}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-500/15 flex items-center justify-center">
                    <Truck className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white/90">{trip.vehiclePlate}</div>
                    <div className="text-xs text-white/50">{trip.driverName}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${trip.status === 'IN_TRANSIT' ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30' : trip.status === 'COMPLETED' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : trip.status === 'ARRIVED' ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' : 'bg-gray-500/15 text-gray-400'}`}>
                      {trip.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-white/30 transition-transform ${expandedTrip === trip.id ? 'rotate-90' : ''}`} />
                </div>
              </div>

              {/* Route Summary */}
              <div className="mt-3 flex items-center gap-1 text-xs text-white/40 flex-wrap">
                {trip.route.split(' → ').map((city, i, arr) => (
                  <span key={i} className="flex items-center gap-1">
                    <span className={trip.checkpoints.find(c => c.name === city)?.passed ? 'text-emerald-400' : trip.currentLocation === city ? 'text-amber-400' : ''}>{city}</span>
                    {i < arr.length - 1 && <ArrowRight className="w-3 h-3 text-white/20" />}
                  </span>
                ))}
              </div>

              {/* Expanded Details */}
              {expandedTrip === trip.id && (
                <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-4">
                  {/* Checkpoint Timeline */}
                  <div>
                    <div className="text-xs text-white/50 mb-3 flex items-center gap-1"><Route className="w-3 h-3" /> Checkpoint Timeline</div>
                    <div className="flex items-start justify-between">
                      {trip.checkpoints.map((cp, i) => {
                        const isCurrent = !cp.passed && (i === 0 || trip.checkpoints[i-1]?.passed);
                        return (
                          <div key={cp.name} className="flex flex-col items-center flex-1 relative">
                            {/* Connector line */}
                            {i < trip.checkpoints.length - 1 && (
                              <div className={`absolute top-3 left-1/2 w-full h-0.5 ${cp.passed ? 'bg-emerald-500' : 'bg-white/[0.06]'}`} style={{ left: '50%', width: '100%' }} />
                            )}
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center z-10 ${cp.passed ? 'bg-emerald-500 text-black' : isCurrent ? 'bg-amber-500 text-black animate-pulse' : 'bg-white/[0.08] text-white/30 border border-white/[0.1]'}`}>
                              {cp.passed ? <CheckCircle2 className="w-4 h-4" /> : isCurrent ? <CircleDot className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                            </div>
                            <div className="text-[10px] text-center mt-1.5">
                              <div className={`${cp.passed ? 'text-emerald-400' : isCurrent ? 'text-amber-400' : 'text-white/30'}`}>{cp.name}</div>
                              {cp.timestamp && <div className="text-white/30 mt-0.5">{cp.timestamp}</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Trip Info */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-2 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                      <div className="text-[10px] text-white/40">Departure</div>
                      <div className="text-xs text-white/80">{trip.departureTime}</div>
                    </div>
                    <div className="p-2 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                      <div className="text-[10px] text-white/40">{trip.arrivalTime ? 'Arrival' : 'Current Location'}</div>
                      <div className="text-xs text-white/80">{trip.arrivalTime || trip.currentLocation}</div>
                    </div>
                    <div className="p-2 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                      <div className="text-[10px] text-white/40">Parcels</div>
                      <div className="text-xs text-white/80">{trip.parcelCount} parcels</div>
                    </div>
                    <div className="p-2 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                      <div className="text-[10px] text-white/40">Driver</div>
                      <div className="text-xs text-white/80 flex items-center gap-1"><Phone className="w-3 h-3" /> {trip.driverPhone}</div>
                    </div>
                  </div>

                  {/* Parcel List */}
                  <div>
                    <div className="text-xs text-white/50 mb-2">Parcels on this trip</div>
                    <div className="space-y-1.5">
                      {trip.parcels.map(pid => {
                        const p = parcels.find(x => x.id === pid);
                        if (!p) return null;
                        return (
                          <div key={pid} className="flex items-center gap-2 p-2 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                            <Package className="w-4 h-4 text-amber-400" />
                            <span className="text-xs font-mono text-amber-400">{p.parcelId}</span>
                            <span className="text-xs text-white/60">{p.senderName} → {p.destination}</span>
                            <span className="ml-auto"><QSB qr={p.qrStatus} /></span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {trip.status === 'SCHEDULED' && (
                      <Button className="bg-emerald-500 hover:bg-emerald-600 text-white"><Send className="w-4 h-4 mr-1" /> Start Trip</Button>
                    )}
                    {trip.status === 'IN_TRANSIT' && (
                      <Button className="bg-cyan-500 hover:bg-cyan-600 text-white"><CheckCircle2 className="w-4 h-4 mr-1" /> Mark Arrived</Button>
                    )}
                    {trip.status === 'ARRIVED' && (
                      <Button className="bg-emerald-500 hover:bg-emerald-600 text-white"><CheckCircle2 className="w-4 h-4 mr-1" /> Complete Trip</Button>
                    )}
                    <Button variant="outline" className="border-white/[0.06] text-white/70 hover:bg-white/[0.06]"><Eye className="w-4 h-4 mr-1" /> View Details</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  6. TRACKING TAB                                                     */
/* ------------------------------------------------------------------ */

function TrackingTab() {
  const activeTrips = trips.filter(t => t.status === 'IN_TRANSIT');
  const allCheckpoints = ['Dar es Salaam', 'Morogoro', 'Dodoma', 'Singida', 'Shinyanga', 'Mwanza'];

  return (
    <div className="h-[calc(100vh-80px)] overflow-y-auto">
      <div className="space-y-6 p-1">
        {/* Map-like Checkpoint Flow */}
        <Card className="bg-white/[0.03] border-white/[0.06]">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-white/90 mb-4 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-amber-400" /> Northern Corridor Route
            </h3>
            <div className="flex items-center justify-between overflow-x-auto pb-2">
              {allCheckpoints.map((cp, i) => (
                <div key={cp} className="flex items-center flex-shrink-0">
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${i <= 2 ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400' : i === 3 ? 'bg-amber-500/15 border-amber-500 text-amber-400' : 'bg-white/[0.05] border-white/[0.1] text-white/30'}`}>
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div className={`text-[10px] mt-1.5 font-medium ${i <= 2 ? 'text-emerald-400' : i === 3 ? 'text-amber-400' : 'text-white/30'}`}>{cp}</div>
                    <div className="text-[9px] text-white/30 mt-0.5">
                      {i === 0 ? 'Start' : i === 5 ? 'End' : `+${i * 110} km`}
                    </div>
                  </div>
                  {i < allCheckpoints.length - 1 && (
                    <div className={`w-12 md:w-20 h-0.5 mx-1 ${i < 2 ? 'bg-emerald-500' : i === 2 ? 'bg-amber-500' : 'bg-white/[0.06]'}`} />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Active Trips on Route */}
        <Card className="bg-white/[0.03] border-white/[0.06]">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-white/90 mb-4 flex items-center gap-2">
              <Radio className="w-4 h-4 text-amber-400" /> Active Trips Tracking
            </h3>
            {activeTrips.length === 0 ? (
              <div className="text-center text-white/40 py-8">No active trips currently</div>
            ) : (
              <div className="space-y-4">
                {activeTrips.map(trip => {
                  const passedCount = trip.checkpoints.filter(c => c.passed).length;
                  const totalCp = trip.checkpoints.length;
                  const pct = (passedCount / totalCp) * 100;
                  return (
                    <div key={trip.id} className="p-4 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Truck className="w-6 h-6 text-indigo-400" />
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-white/90">{trip.vehiclePlate} — {trip.driverName}</div>
                            <div className="text-xs text-white/50 flex items-center gap-1">
                              <Navigation className="w-3 h-3 text-amber-400" /> Currently at: <span className="text-amber-400">{trip.currentLocation}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Wifi className="w-4 h-4 text-emerald-400" />
                          <span className="text-[10px] text-emerald-400">Live</span>
                        </div>
                      </div>

                      {/* Mini checkpoint bar */}
                      <div className="flex items-center gap-1 mb-2">
                        {trip.checkpoints.map((cp, i) => (
                          <div key={cp.name} className="flex items-center flex-1">
                            <div className={`w-2 h-2 rounded-full ${cp.passed ? 'bg-emerald-500' : trip.currentLocation === cp.name ? 'bg-amber-500 animate-pulse' : 'bg-white/[0.1]'}`} />
                            {i < trip.checkpoints.length - 1 && (
                              <div className={`flex-1 h-0.5 mx-0.5 ${cp.passed && trip.checkpoints[i+1]?.passed ? 'bg-emerald-500' : 'bg-white/[0.06]'}`} />
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white/50">{passedCount}/{totalCp} checkpoints passed</span>
                        <div className="flex gap-3">
                          <span className="flex items-center gap-1 text-white/40"><Timer className="w-3 h-3" /> ~{Math.round((100 - pct) * 2)} min ETA</span>
                          <span className="flex items-center gap-1 text-white/40"><Package className="w-3 h-3" /> {trip.parcelCount} parcels</span>
                          <span className="flex items-center gap-1 text-white/40"><Gauge className="w-3 h-3" /> 65 km/h avg</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tracking Methods */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { icon: Radio, label: 'GPS Tracking', desc: 'Real-time satellite positioning', status: 'Active', color: 'text-emerald-400' },
            { icon: QrCode, label: 'QR Scan Points', desc: 'Automated checkpoint scans', status: 'Active', color: 'text-emerald-400' },
            { icon: Wifi, label: 'Cell Tower Triangulation', desc: 'Backup location method', status: 'Standby', color: 'text-yellow-400' },
          ].map(method => (
            <div key={method.label} className="p-4 bg-white/[0.03] rounded-lg border border-white/[0.06] flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/[0.05] flex items-center justify-center">
                <method.icon className={`w-5 h-5 ${method.color}`} />
              </div>
              <div className="flex-1">
                <div className="text-sm text-white/90">{method.label}</div>
                <div className="text-xs text-white/50">{method.desc}</div>
              </div>
              <span className={`text-[10px] font-medium ${method.color}`}>{method.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


/* ------------------------------------------------------------------ */
/*  7. PAYMENTS TAB                                                     */
/* ------------------------------------------------------------------ */

function PaymentsTab() {
  const [storageDays, setStorageDays] = useState(3);
  const [dailyRate, setDailyRate] = useState(5000);
  const [daysDelayed, setDaysDelayed] = useState(2);

  const summary = useMemo(() => {
    const totalCollected = parcels.reduce((s, p) => s + p.totalPaid, 0);
    const pending = parcels.filter(p => p.paymentMode === 'PAY_ON_ARRIVAL' && p.totalPaid === 0);
    const pendingAmount = pending.reduce((s, p) => s + p.transportFee + p.insurance, 0);
    const storageFees = parcels.reduce((s, p) => s + p.storageFees, 0);
    const overdue = parcels.filter(p => p.qrStatus === 'RED');
    const overdueAmount = overdue.reduce((s, p) => s + p.transportFee + p.insurance + p.storageFees - p.totalPaid, 0);
    return { totalCollected, pendingAmount, pendingCount: pending.length, storageFees, overdueCount: overdue.length, overdueAmount };
  }, []);

  const payNowCount = parcels.filter(p => p.paymentMode === 'PAY_NOW').length;
  const payLaterCount = parcels.filter(p => p.paymentMode === 'PAY_ON_ARRIVAL').length;
  const redParcels = parcels.filter(p => p.qrStatus === 'RED');

  return (
    <div className="h-[calc(100vh-80px)] overflow-y-auto">
      <div className="space-y-6 p-1">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total Collected', value: `TZS ${summary.totalCollected.toLocaleString()}`, icon: Banknote, color: 'text-emerald-400' },
            { label: 'Pending (Pay on Arrival)', value: `TZS ${summary.pendingAmount.toLocaleString()}`, sub: `${summary.pendingCount} parcels`, icon: Clock, color: 'text-yellow-400' },
            { label: 'Storage Fees', value: `TZS ${summary.storageFees.toLocaleString()}`, icon: Container, color: 'text-cyan-400' },
            { label: 'Overdue', value: `TZS ${summary.overdueAmount.toLocaleString()}`, sub: `${summary.overdueCount} parcels`, icon: AlertTriangle, color: 'text-red-400' },
          ].map(card => (
            <Card key={card.label} className="bg-white/[0.03] border-white/[0.06]">
              <CardContent className="p-4">
                <card.icon className={`w-5 h-5 ${card.color} mb-2`} />
                <div className="text-lg font-bold text-white/90">{card.value}</div>
                <div className="text-xs text-white/50">{card.label}</div>
                {card.sub && <div className="text-[10px] text-white/30 mt-0.5">{card.sub}</div>}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Payment Mode Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="bg-white/[0.03] border-white/[0.06]">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-white/90 mb-3 flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-amber-400" /> Payment Mode Breakdown
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-white/70">Pay Now</span>
                      <span className="text-emerald-400 font-medium">{payNowCount} parcels ({Math.round((payNowCount/parcels.length)*100)}%)</span>
                    </div>
                    <div className="w-full h-2.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(payNowCount/parcels.length)*100}%` }} />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-white/70">Pay on Arrival</span>
                      <span className="text-yellow-400 font-medium">{payLaterCount} parcels ({Math.round((payLaterCount/parcels.length)*100)}%)</span>
                    </div>
                    <div className="w-full h-2.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${(payLaterCount/parcels.length)*100}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Storage Fee Calculator */}
          <Card className="bg-white/[0.03] border-white/[0.06]">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-white/90 mb-3 flex items-center gap-2">
                <CalculatorIcon className="w-4 h-4 text-amber-400" /> Storage Fee Calculator
              </h3>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="text-[10px] text-white/50">Free Days</label>
                  <Input type="number" value={storageDays} onChange={e => setStorageDays(parseInt(e.target.value)||0)} className="bg-white/[0.03] border-white/[0.06] text-white/90 h-8 text-xs" />
                </div>
                <div>
                  <label className="text-[10px] text-white/50">Daily Rate (TZS)</label>
                  <Input type="number" value={dailyRate} onChange={e => setDailyRate(parseInt(e.target.value)||0)} className="bg-white/[0.03] border-white/[0.06] text-white/90 h-8 text-xs" />
                </div>
                <div>
                  <label className="text-[10px] text-white/50">Days Delayed</label>
                  <Input type="number" value={daysDelayed} onChange={e => setDaysDelayed(parseInt(e.target.value)||0)} className="bg-white/[0.03] border-white/[0.06] text-white/90 h-8 text-xs" />
                </div>
              </div>
              <div className="p-2 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/60">Storage Fee:</span>
                  <span className="text-amber-400 font-bold">TZS {Math.max(0, (daysDelayed - storageDays) * dailyRate).toLocaleString()}</span>
                </div>
                <div className="text-[10px] text-white/30 mt-1">
                  {daysDelayed <= storageDays ? 'Within free period' : `Charged for ${daysDelayed - storageDays} days @ TZS ${dailyRate}/day`}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment Methods */}
        <Card className="bg-white/[0.03] border-white/[0.06]">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-white/90 mb-3 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-amber-400" /> Accepted Payment Methods
            </h3>
            <div className="flex flex-wrap gap-2">
              {['M-Pesa', 'Airtel Money', 'Tigo Pesa', 'HaloPesa', 'Cash', 'Bank Transfer'].map(method => (
                <span key={method} className="px-3 py-1.5 bg-white/[0.05] rounded-lg text-xs text-white/70 border border-white/[0.06] flex items-center gap-1.5">
                  {method === 'M-Pesa' && <Phone className="w-3 h-3 text-emerald-400" />}
                  {method === 'Airtel Money' && <Phone className="w-3 h-3 text-red-400" />}
                  {method === 'Tigo Pesa' && <Phone className="w-3 h-3 text-blue-400" />}
                  {method === 'HaloPesa' && <Phone className="w-3 h-3 text-purple-400" />}
                  {method === 'Cash' && <Banknote className="w-3 h-3 text-green-400" />}
                  {method === 'Bank Transfer' && <Receipt className="w-3 h-3 text-cyan-400" />}
                  {method}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* RED QR Parcels - Payment Required */}
        {redParcels.length > 0 && (
          <Card className="bg-white/[0.03] border-red-500/20">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Payment Required (RED QR)
              </h3>
              <div className="space-y-2">
                {redParcels.map(p => {
                  const amountDue = p.transportFee + p.insurance + p.storageFees - p.totalPaid;
                  return (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-red-500/5 rounded-lg border border-red-500/10">
                      <div className="flex items-center gap-3">
                        <QSB qr={p.qrStatus} />
                        <div>
                          <div className="text-sm font-mono text-white/90">{p.parcelId}</div>
                          <div className="text-xs text-white/50">{p.ownerName} • {p.destination}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-sm font-bold text-red-400">TZS {amountDue.toLocaleString()}</div>
                          <div className="text-[10px] text-white/40">Transport: {p.transportFee.toLocaleString()} + Insurance: {p.insurance.toLocaleString()} + Storage: {p.storageFees.toLocaleString()}</div>
                        </div>
                        <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs">
                          <DollarSign className="w-3 h-3 mr-1" /> Collect
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Parcel Payment List */}
        <Card className="bg-white/[0.03] border-white/[0.06]">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-white/90 mb-3 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-amber-400" /> Parcel Payment Status
            </h3>
            <div className="space-y-2">
              {parcels.map(p => {
                const totalDue = p.transportFee + p.insurance + p.extraCharges + p.storageFees;
                const balance = totalDue - p.totalPaid;
                return (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                    <div className="flex items-center gap-3">
                      <Package className="w-4 h-4 text-amber-400" />
                      <div>
                        <div className="text-xs font-mono text-white/90">{p.parcelId}</div>
                        <div className="text-xs text-white/50">{p.ownerName}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <div className="text-right">
                        <div className="text-white/60">Amount Due: <span className="text-white/90">TZS {totalDue.toLocaleString()}</span></div>
                        <div className="text-white/60">Paid: <span className="text-emerald-400">TZS {p.totalPaid.toLocaleString()}</span></div>
                      </div>
                      <div className={`text-right font-medium ${balance <= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {balance <= 0 ? 'Paid' : `TZS ${balance.toLocaleString()}`}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${p.paymentMode === 'PAY_NOW' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'}`}>
                        {p.paymentMode === 'PAY_NOW' ? 'Pay Now' : 'Pay on Arrival'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Small icon components for Payments tab
function PieIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>
    </svg>
  );
}

function CalculatorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="8" y2="10.01"/><line x1="12" y1="10" x2="12" y2="10.01"/><line x1="16" y1="10" x2="16" y2="10.01"/><line x1="8" y1="14" x2="8" y2="14.01"/><line x1="12" y1="14" x2="12" y2="14.01"/><line x1="16" y1="14" x2="16" y2="14.01"/><line x1="8" y1="18" x2="8" y2="18.01"/><line x1="12" y1="18" x2="12" y2="18.01"/><line x1="16" y1="18" x2="16" y2="18.01"/>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  8. DRIVERS TAB                                                      */
/* ------------------------------------------------------------------ */

function DriversTab() {
  const [sortBy, setSortBy] = useState<'points' | 'earnings' | 'trips'>('points');
  const [selectedDriver, setSelectedDriver] = useState<TZDriver | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const sorted = useMemo(() => [...drivers].sort((a, b) => b[sortBy] - a[sortBy]), [sortBy]);

  const statusColors: Record<string, string> = {
    active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    on_trip: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    off_duty: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1,2,3,4,5].map(i => (
          <Star key={i} className={`w-3 h-3 ${i <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-white/20'}`} />
        ))}
        <span className="text-xs text-white/60 ml-1">{rating}</span>
      </div>
    );
  };

  return (
    <div className="h-[calc(100vh-80px)] overflow-y-auto">
      <div className="space-y-4 p-1">
        {/* Leaderboard Sort */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/50">Sort by:</span>
          {[
            { key: 'points' as const, label: 'Points', icon: Award },
            { key: 'earnings' as const, label: 'Earnings', icon: DollarSign },
            { key: 'trips' as const, label: 'Trips', icon: Truck },
          ].map(opt => (
            <button key={opt.key} onClick={() => setSortBy(opt.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1 ${sortBy === opt.key ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'bg-white/[0.03] text-white/50 border-white/[0.06] hover:text-white/80'}`}>
              <opt.icon className="w-3 h-3" /> {opt.label}
            </button>
          ))}
        </div>

        {/* Driver Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sorted.map((driver, idx) => (
            <div key={driver.id} onClick={() => { setSelectedDriver(driver); setDetailOpen(true); }}
              className="p-4 bg-white/[0.03] rounded-xl border border-white/[0.06] cursor-pointer hover:bg-white/[0.06] transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-amber-500/15 flex items-center justify-center text-lg font-bold text-amber-400">
                    {driver.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white/90 flex items-center gap-2">
                      {driver.name}
                      {idx === 0 && <Award className="w-4 h-4 text-amber-400" />}
                    </div>
                    <div className="text-xs text-white/50 flex items-center gap-1"><Phone className="w-3 h-3" /> {driver.phone}</div>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusColors[driver.status]}`}>
                  {driver.status.replace(/_/g, ' ')}
                </span>
              </div>

              {renderStars(driver.rating)}

              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="p-2 bg-white/[0.03] rounded-lg border border-white/[0.06] text-center">
                  <div className="text-sm font-bold text-white/90">{driver.trips}</div>
                  <div className="text-[10px] text-white/40">Trips</div>
                </div>
                <div className="p-2 bg-white/[0.03] rounded-lg border border-white/[0.06] text-center">
                  <div className="text-sm font-bold text-emerald-400">TZS {(driver.earnings/1000000).toFixed(1)}M</div>
                  <div className="text-[10px] text-white/40">Earnings</div>
                </div>
                <div className="p-2 bg-white/[0.03] rounded-lg border border-white/[0.06] text-center">
                  <div className="text-sm font-bold text-amber-400">{driver.points.toLocaleString()}</div>
                  <div className="text-[10px] text-white/40">Points</div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 text-[10px] text-white/30">
                <span>License: {driver.license}</span>
                <span>|</span>
                <span>Joined: {driver.joined}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Driver Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="bg-[#0f0f2a] border-white/[0.08] text-white max-w-lg">
          {selectedDriver && (
            <>
              <DialogHeader>
                <DialogTitle className="text-white/90 flex items-center gap-2">
                  <UserCircle className="w-5 h-5 text-amber-400" /> {selectedDriver.name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-amber-500/15 flex items-center justify-center text-2xl font-bold text-amber-400">
                    {selectedDriver.name.charAt(0)}
                  </div>
                  <div>
                    {renderStars(selectedDriver.rating)}
                    <div className="text-xs text-white/50 mt-1">{selectedDriver.license} • Joined {selectedDriver.joined}</div>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusColors[selectedDriver.status]}`}>
                      {selectedDriver.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-white/[0.03] rounded-lg border border-white/[0.06] text-center">
                    <Truck className="w-4 h-4 text-indigo-400 mx-auto mb-1" />
                    <div className="text-lg font-bold text-white/90">{selectedDriver.trips}</div>
                    <div className="text-[10px] text-white/40">Total Trips</div>
                  </div>
                  <div className="p-3 bg-white/[0.03] rounded-lg border border-white/[0.06] text-center">
                    <DollarSign className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                    <div className="text-lg font-bold text-emerald-400">TZS {(selectedDriver.earnings/1000000).toFixed(2)}M</div>
                    <div className="text-[10px] text-white/40">Earnings</div>
                  </div>
                  <div className="p-3 bg-white/[0.03] rounded-lg border border-white/[0.06] text-center">
                    <Award className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                    <div className="text-lg font-bold text-amber-400">{selectedDriver.points.toLocaleString()}</div>
                    <div className="text-[10px] text-white/40">Points</div>
                  </div>
                </div>

                {/* Reward Calculation */}
                <div className="p-3 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                  <div className="text-xs text-white/50 mb-2 flex items-center gap-1"><Target className="w-3 h-3 text-amber-400" /> Reward Calculation</div>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-white/60 flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-400" /> Checkpoint Compliance</span>
                      <span className="text-emerald-400">+50 pts/trip</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/60 flex items-center gap-1"><Timer className="w-3 h-3 text-indigo-400" /> Delivery Speed</span>
                      <span className="text-indigo-400">+100 pts/early</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/60 flex items-center gap-1"><Route className="w-3 h-3 text-amber-400" /> Route Accuracy</span>
                      <span className="text-amber-400">+25 pts/checkpoint</span>
                    </div>
                  </div>
                </div>

                {/* Rewards History */}
                {selectedDriver.rewards.length > 0 && (
                  <div className="p-3 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                    <div className="text-xs text-white/50 mb-2 flex items-center gap-1"><Award className="w-3 h-3 text-amber-400" /> Rewards History</div>
                    <div className="space-y-2">
                      {selectedDriver.rewards.map((reward, i) => (
                        <div key={i} className="flex items-center justify-between text-xs p-2 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                          <div className="flex items-center gap-2">
                            <Zap className="w-3 h-3 text-amber-400" />
                            <span className="text-white/80">{reward.type}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-emerald-400 font-medium">TZS {reward.amount.toLocaleString()}</span>
                            <span className="text-white/30">{reward.date}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


/* ------------------------------------------------------------------ */
/*  9. INCIDENTS TAB                                                    */
/* ------------------------------------------------------------------ */

function IncidentsTab() {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [selectedIncident, setSelectedIncident] = useState<TZIncident | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [newIncident, setNewIncident] = useState({ type: 'DELAY' as TZIncident['type'], severity: 'low' as TZIncident['severity'], description: '', location: '', tripId: '' });

  const incidentTypes = ['ALL', 'ACCIDENT', 'THEFT', 'BREAKDOWN', 'POLICE_STOP', 'DELAY', 'OTHER'];
  const severities = ['ALL', 'low', 'medium', 'high', 'critical'];

  const filtered = useMemo(() => {
    return incidents.filter(i => {
      const matchType = filterType === 'ALL' || i.type === filterType;
      const matchSev = filterSeverity === 'ALL' || i.severity === filterSeverity;
      return matchType && matchSev;
    });
  }, [filterType, filterSeverity]);

  const typeIcons: Record<string, React.ReactNode> = {
    ACCIDENT: <AlertTriangle className="w-4 h-4" />,
    THEFT: <Lock className="w-4 h-4" />,
    BREAKDOWN: <WrenchIcon className="w-4 h-4" />,
    POLICE_STOP: <ShieldAlert className="w-4 h-4" />,
    DELAY: <Clock className="w-4 h-4" />,
    OTHER: <FileText className="w-4 h-4" />,
  };

  const typeColors: Record<string, string> = {
    ACCIDENT: 'bg-red-500/15 text-red-400 border-red-500/30',
    THEFT: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    BREAKDOWN: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    POLICE_STOP: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    DELAY: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    OTHER: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
  };

  const severityColors: Record<string, string> = {
    low: 'text-emerald-400',
    medium: 'text-yellow-400',
    high: 'text-orange-400',
    critical: 'text-red-400',
  };

  const incidentStatusColors: Record<string, string> = {
    reported: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    resolved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    escalated: 'bg-red-500/15 text-red-400 border-red-500/30',
  };

  return (
    <div className="h-[calc(100vh-80px)] overflow-y-auto">
      <div className="space-y-4 p-1">
        {/* Report Button */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <div className="flex flex-wrap gap-2">
            {/* Type filter */}
            <div className="flex flex-wrap gap-1">
              {incidentTypes.map(t => (
                <button key={t} onClick={() => setFilterType(t)}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium border transition-colors ${filterType === t ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'bg-white/[0.03] text-white/50 border-white/[0.06] hover:text-white/80'}`}>
                  {t === 'ALL' ? 'All Types' : t.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={() => setReportOpen(true)} className="bg-red-500 hover:bg-red-600 text-white text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" /> Report Incident
          </Button>
        </div>

        {/* Severity filter */}
        <div className="flex flex-wrap gap-1">
          {severities.map(s => (
            <button key={s} onClick={() => setFilterSeverity(s)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium border transition-colors ${filterSeverity === s ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'bg-white/[0.03] text-white/50 border-white/[0.06] hover:text-white/80'}`}>
              {s === 'ALL' ? 'All Severities' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Incident Cards */}
        <div className="space-y-2">
          {filtered.map(incident => (
            <div key={incident.id} onClick={() => { setSelectedIncident(incident); setDetailOpen(true); }}
              className="p-4 bg-white/[0.03] rounded-xl border border-white/[0.06] cursor-pointer hover:bg-white/[0.06] transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center border ${typeColors[incident.type]}`}>
                    {typeIcons[incident.type]}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white/90 flex items-center gap-2">
                      {incident.type.replace(/_/g, ' ')}
                      <span className={`text-[10px] font-medium ${severityColors[incident.severity]}`}>
                        {incident.severity.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs text-white/50 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {incident.location} • Trip {incident.tripId}
                    </div>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${incidentStatusColors[incident.status]}`}>
                  {incident.status}
                </span>
              </div>
              <div className="text-xs text-white/70 ml-12">{incident.description}</div>
              <div className="flex items-center justify-between mt-3 ml-12">
                <div className="text-[10px] text-white/40 flex items-center gap-1">
                  <User className="w-3 h-3" /> Reported by: {incident.reportedBy}
                </div>
                <div className="text-[10px] text-white/40 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {incident.timestamp}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="bg-[#0f0f2a] border-white/[0.08] text-white max-w-lg">
          {selectedIncident && (
            <>
              <DialogHeader>
                <DialogTitle className="text-white/90 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-amber-400" /> Incident {selectedIncident.id.toUpperCase()}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${typeColors[selectedIncident.type]}`}>
                    {selectedIncident.type.replace(/_/g, ' ')}
                  </span>
                  <span className={`text-xs font-bold ${severityColors[selectedIncident.severity]}`}>
                    {selectedIncident.severity.toUpperCase()} SEVERITY
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${incidentStatusColors[selectedIncident.status]}`}>
                    {selectedIncident.status}
                  </span>
                </div>
                <div className="p-4 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                  <div className="text-xs text-white/50 mb-1">Description</div>
                  <div className="text-sm text-white/90">{selectedIncident.description}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                    <div className="text-[10px] text-white/50">Location</div>
                    <div className="text-sm text-white/90 flex items-center gap-1"><MapPin className="w-3 h-3 text-amber-400" /> {selectedIncident.location}</div>
                  </div>
                  <div className="p-3 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                    <div className="text-[10px] text-white/50">Trip ID</div>
                    <div className="text-sm text-white/90">{selectedIncident.tripId.toUpperCase()}</div>
                  </div>
                  <div className="p-3 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                    <div className="text-[10px] text-white/50">Reported By</div>
                    <div className="text-sm text-white/90 flex items-center gap-1"><User className="w-3 h-3" /> {selectedIncident.reportedBy}</div>
                  </div>
                  <div className="p-3 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                    <div className="text-[10px] text-white/50">Timestamp</div>
                    <div className="text-sm text-white/90 flex items-center gap-1"><Clock className="w-3 h-3" /> {selectedIncident.timestamp}</div>
                  </div>
                </div>
                {/* Resolution notes */}
                {selectedIncident.status === 'resolved' && (
                  <div className="p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/20">
                    <div className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Resolution Notes</div>
                    <div className="text-xs text-white/60 mt-1">Incident has been resolved and documented.</div>
                  </div>
                )}
                {selectedIncident.status === 'reported' && (
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white"><CheckCircle2 className="w-4 h-4 mr-1" /> Mark Resolved</Button>
                    <Button size="sm" variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10"><AlertTriangle className="w-4 h-4 mr-1" /> Escalate</Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Report Dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="bg-[#0f0f2a] border-white/[0.08] text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white/90 flex items-center gap-2">
              <Plus className="w-5 h-5 text-red-400" /> Report New Incident
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/50">Incident Type</label>
                <select value={newIncident.type} onChange={e => setNewIncident({...newIncident, type: e.target.value as TZIncident['type']})} className="w-full h-10 rounded-md bg-white/[0.03] border border-white/[0.06] text-white/90 px-3 text-sm">
                  {incidentTypes.filter(t => t !== 'ALL').map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/50">Severity</label>
                <select value={newIncident.severity} onChange={e => setNewIncident({...newIncident, severity: e.target.value as TZIncident['severity']})} className="w-full h-10 rounded-md bg-white/[0.03] border border-white/[0.06] text-white/90 px-3 text-sm">
                  {severities.filter(s => s !== 'ALL').map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-white/50">Trip ID</label>
              <Input value={newIncident.tripId} onChange={e => setNewIncident({...newIncident, tripId: e.target.value})} placeholder="e.g. t1" className="bg-white/[0.03] border-white/[0.06] text-white/90" />
            </div>
            <div>
              <label className="text-xs text-white/50">Location</label>
              <Input value={newIncident.location} onChange={e => setNewIncident({...newIncident, location: e.target.value})} placeholder="Incident location" className="bg-white/[0.03] border-white/[0.06] text-white/90" />
            </div>
            <div>
              <label className="text-xs text-white/50">Description</label>
              <textarea value={newIncident.description} onChange={e => setNewIncident({...newIncident, description: e.target.value})} placeholder="Describe the incident..."
                className="w-full h-20 rounded-md bg-white/[0.03] border border-white/[0.06] text-white/90 px-3 py-2 text-sm placeholder:text-white/30 resize-none" />
            </div>
            <Button onClick={() => setReportOpen(false)} className="w-full bg-red-500 hover:bg-red-600 text-white">Submit Report</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WrenchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  10. AUDIT TAB                                                       */
/* ------------------------------------------------------------------ */

function AuditTab() {
  const [filterAction, setFilterAction] = useState('ALL');
  const [filterRole, setFilterRole] = useState('ALL');
  const [searchParcel, setSearchParcel] = useState('');

  const actions = useMemo(() => {
    const set = new Set(auditLogs.map(l => l.action));
    return ['ALL', ...Array.from(set)];
  }, []);

  const roles = useMemo(() => {
    const set = new Set(auditLogs.map(l => l.role));
    return ['ALL', ...Array.from(set)];
  }, []);

  const filtered = useMemo(() => {
    return auditLogs.filter(l => {
      const matchAction = filterAction === 'ALL' || l.action === filterAction;
      const matchRole = filterRole === 'ALL' || l.role === filterRole;
      const matchParcel = !searchParcel || l.parcelId.toLowerCase().includes(searchParcel.toLowerCase());
      return matchAction && matchRole && matchParcel;
    });
  }, [filterAction, filterRole, searchParcel]);

  // Fraud detection
  const fraudAlerts = useMemo(() => {
    const alerts: { type: string; detail: string; severity: 'low' | 'high' }[] = [];
    // Check for duplicate QR scans
    const qrScans = auditLogs.filter(l => l.action === 'QR_SCANNED');
    if (qrScans.length > 3) {
      alerts.push({ type: 'Multiple QR Scans', detail: `${qrScans.length} QR scan events detected for single parcel flow`, severity: 'low' });
    }
    // Check for payment without prior scan
    const payments = auditLogs.filter(l => l.action === 'PAYMENT_RECEIVED');
    const scans = auditLogs.filter(l => l.action === 'QR_SCANNED');
    if (payments.length > scans.length) {
      alerts.push({ type: 'Payment Without Verification', detail: 'More payments than QR verifications detected', severity: 'high' });
    }
    return alerts;
  }, []);

  const uniqueUsers = useMemo(() => new Set(auditLogs.map(l => l.user)).size, []);

  const actionIcons: Record<string, React.ReactNode> = {
    PARCEL_REGISTERED: <Package className="w-4 h-4 text-blue-400" />,
    QR_SCANNED: <ScanLine className="w-4 h-4 text-amber-400" />,
    PAYMENT_RECEIVED: <DollarSign className="w-4 h-4 text-emerald-400" />,
    QR_GENERATED: <QrCode className="w-4 h-4 text-violet-400" />,
    PARCEL_LOADED: <Container className="w-4 h-4 text-indigo-400" />,
    TRIP_STARTED: <Send className="w-4 h-4 text-cyan-400" />,
    CHECKPOINT_PASSED: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
    INCIDENT_REPORTED: <ShieldAlert className="w-4 h-4 text-red-400" />,
  };

  return (
    <div className="h-[calc(100vh-80px)] overflow-y-auto">
      <div className="space-y-4 p-1">
        {/* Security Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total Actions', value: auditLogs.length, icon: Activity, color: 'text-blue-400' },
            { label: 'Unique Users', value: uniqueUsers, icon: User, color: 'text-violet-400' },
            { label: 'Fraud Alerts', value: fraudAlerts.length, icon: AlertTriangle, color: fraudAlerts.length > 0 ? 'text-red-400' : 'text-emerald-400' },
            { label: 'Security Score', value: fraudAlerts.length > 0 ? '92%' : '100%', icon: ShieldAlert, color: 'text-emerald-400' },
          ].map(card => (
            <Card key={card.label} className="bg-white/[0.03] border-white/[0.06]">
              <CardContent className="p-4">
                <card.icon className={`w-5 h-5 ${card.color} mb-2`} />
                <div className="text-2xl font-bold text-white/90">{card.value}</div>
                <div className="text-xs text-white/50">{card.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Fraud Alerts */}
        {fraudAlerts.length > 0 && (
          <Card className="bg-white/[0.03] border-red-500/20">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Fraud Detection Alerts
              </h3>
              <div className="space-y-2">
                {fraudAlerts.map((alert, i) => (
                  <div key={i} className={`p-3 rounded-lg border flex items-center gap-3 ${alert.severity === 'high' ? 'bg-red-500/5 border-red-500/20' : 'bg-yellow-500/5 border-yellow-500/20'}`}>
                    <AlertTriangle className={`w-4 h-4 ${alert.severity === 'high' ? 'text-red-400' : 'text-yellow-400'}`} />
                    <div className="flex-1">
                      <div className={`text-xs font-medium ${alert.severity === 'high' ? 'text-red-400' : 'text-yellow-400'}`}>{alert.type}</div>
                      <div className="text-xs text-white/60">{alert.detail}</div>
                    </div>
                    <span className={`text-[10px] font-medium ${alert.severity === 'high' ? 'text-red-400' : 'text-yellow-400'}`}>{alert.severity.toUpperCase()}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input placeholder="Search by parcel ID..." value={searchParcel} onChange={e => setSearchParcel(e.target.value)}
              className="pl-10 bg-white/[0.03] border-white/[0.06] text-white/90 placeholder:text-white/30" />
          </div>
          <div className="flex flex-wrap gap-1">
            {actions.map(a => (
              <button key={a} onClick={() => setFilterAction(a)}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium border transition-colors ${filterAction === a ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'bg-white/[0.03] text-white/50 border-white/[0.06] hover:text-white/80'}`}>
                {a === 'ALL' ? 'All' : a.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {roles.map(r => (
              <button key={r} onClick={() => setFilterRole(r)}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium border transition-colors ${filterRole === r ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'bg-white/[0.03] text-white/50 border-white/[0.06] hover:text-white/80'}`}>
                {r === 'ALL' ? 'All Roles' : r}
              </button>
            ))}
          </div>
        </div>

        {/* Audit Log Table */}
        <Card className="bg-white/[0.03] border-white/[0.06]">
          <CardContent className="p-4">
            <div className="space-y-2">
              {filtered.map(log => (
                <div key={log.id} className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-lg border border-white/[0.06] hover:bg-white/[0.05] transition-colors">
                  <div className="w-8 h-8 rounded-full bg-white/[0.05] flex items-center justify-center shrink-0">
                    {actionIcons[log.action] || <Activity className="w-4 h-4 text-white/40" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white/90">{log.action.replace(/_/g, ' ')}</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-white/[0.05] text-white/40 border border-white/[0.06]">{log.role}</span>
                    </div>
                    <div className="text-[11px] text-white/50 mt-0.5">{log.details}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] font-mono text-amber-400">{log.parcelId}</div>
                    <div className="text-[10px] text-white/30">{log.timestamp}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MAIN COMPONENT                                                      */
/* ------------------------------------------------------------------ */

export default function CargoTZ() {
  const [activeTab, setActiveTab] = useState('overview');

  const renderTab = () => {
    switch (activeTab) {
      case 'overview': return <OverviewTab />;
      case 'parcels': return <ParcelsTab />;
      case 'qr_hub': return <QRHubTab />;
      case 'loading': return <LoadingTab />;
      case 'trips': return <TripsTab />;
      case 'tracking': return <TrackingTab />;
      case 'payments': return <PaymentsTab />;
      case 'drivers': return <DriversTab />;
      case 'incidents': return <IncidentsTab />;
      case 'audit': return <AuditTab />;
      default: return <OverviewTab />;
    }
  };

  return (
    <div className="h-full flex bg-[#0a0a1a] text-white/90">
      {/* LEFT SIDEBAR — Tile Navigation */}
      <div className="w-60 h-full flex flex-col bg-[#0c0c1a] border-r border-white/[0.06] shrink-0">
        {/* Header */}
        <div className="shrink-0 px-4 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
              <Navigation className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-white/90">Cargo TZ</div>
              <div className="text-[10px] text-white/30">Tanzania Cargo System</div>
            </div>
          </div>
        </div>

        {/* Tile Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <div className="space-y-1.5">
            {sidebarItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setActiveTab(item.key)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all text-left ${
                    isActive
                      ? 'bg-amber-500/10 border-amber-500/20'
                      : 'bg-white/[0.02] border-transparent hover:bg-white/[0.05]'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isActive ? 'bg-amber-500/15' : 'bg-white/[0.04]'}`}>
                    <Icon className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <div className={`text-[11px] font-medium ${isActive ? 'text-amber-400' : 'text-white/70'}`}>{item.label}</div>
                    <div className="text-[9px] text-white/25 truncate">{item.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="shrink-0 px-4 py-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-emerald-400">System Online</span>
          </div>
          <div className="text-[9px] text-white/30 mt-1">
            {parcels.length} parcels • {trips.length} trips • {drivers.length} drivers
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tab Content */}
        <div className="flex-1 overflow-hidden p-6">
          {renderTab()}
        </div>
      </div>
    </div>
  );
}
