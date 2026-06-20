import { useState, useMemo, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  Package, QrCode, Truck, MapPin, CreditCard, UserCircle, ShieldAlert, ClipboardList,
  Container, LayoutDashboard, Search, Plus, CheckCircle2, CircleDot, Circle,
  ArrowRight, AlertTriangle, Clock, DollarSign, Phone, User, Box, ScanLine, Weight,
  FileText, ChevronRight, BarChart3, TrendingUp,
  Navigation, Award, Star, Zap, Eye,
  Route, Gauge, Activity, Target, Timer, Radio, Wifi,
  Lock, Send, Receipt, Wallet, Banknote, Wrench, Calculator,
  NavigationIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
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

const parcelsData: TZParcel[] = [
  { id:'p1', parcelId:'TZ-DSM-MWZ-000001', senderName:'Juma Hassan', senderPhone:'+255 713 111 222', ownerName:'Asha Mwangi', ownerPhone:'+255 714 333 444', destination:'Mwanza', packageCount:3, weight:45, description:'Electronics - TV, Radio, Phone charger', paymentMode:'PAY_NOW', status:'IN_TRANSIT', qrStatus:'GREEN', transportFee:45000, insurance:5000, extraCharges:0, storageFees:0, totalPaid:50000, registeredAt:'May 1, 2025 09:30', cargoCompany:'Kobe Transport', branch:'Dar es Salaam', tripId:'t1' },
  { id:'p2', parcelId:'TZ-DSM-DOD-000002', senderName:'Peter Omondi', senderPhone:'+255 715 555 666', ownerName:'Grace Wanjiru', ownerPhone:'+255 716 777 888', destination:'Dodoma', packageCount:2, weight:28, description:'Textiles - Fabric rolls', paymentMode:'PAY_ON_ARRIVAL', status:'IN_TRANSIT', qrStatus:'YELLOW', transportFee:32000, insurance:3000, extraCharges:0, storageFees:0, totalPaid:0, registeredAt:'May 2, 2025 14:15', cargoCompany:'Kobe Transport', branch:'Dar es Salaam', tripId:'t1' },
  { id:'p3', parcelId:'TZ-MOR-SHI-000003', senderName:'David Kimaro', senderPhone:'+255 717 999 000', ownerName:'Fatima Said', ownerPhone:'+255 718 111 222', destination:'Shinyanga', packageCount:5, weight:120, description:'Building materials - Cement bags', paymentMode:'PAY_NOW', status:'ARRIVED', qrStatus:'GREEN', transportFee:85000, insurance:12000, extraCharges:5000, storageFees:0, totalPaid:102000, registeredAt:'Apr 28, 2025 11:00', cargoCompany:'Kobe Transport', branch:'Morogoro', tripId:'t2' },
  { id:'p4', parcelId:'TZ-DOD-MWZ-000004', senderName:'John Mwansa', senderPhone:'+255 719 333 444', ownerName:'Mary Joseph', ownerPhone:'+255 720 555 666', destination:'Mwanza', packageCount:1, weight:8, description:'Documents and certificates', paymentMode:'PAY_ON_ARRIVAL', status:'ARRIVED', qrStatus:'RED', transportFee:15000, insurance:2000, extraCharges:0, storageFees:3000, totalPaid:0, registeredAt:'Apr 25, 2025 16:45', cargoCompany:'Kobe Transport', branch:'Dodoma', tripId:'t2' },
  { id:'p5', parcelId:'TZ-DSM-SIN-000005', senderName:'Ali Ibrahim', senderPhone:'+255 721 777 888', ownerName:'Rose Mwakasege', ownerPhone:'+255 722 999 000', destination:'Singida', packageCount:4, weight:65, description:'Furniture - Chairs and table', paymentMode:'PAY_NOW', status:'DELIVERED', qrStatus:'WHITE', transportFee:55000, insurance:8000, extraCharges:0, storageFees:0, totalPaid:63000, registeredAt:'Apr 20, 2025 08:30', cargoCompany:'Kobe Transport', branch:'Dar es Salaam', tripId:'t3' },
  { id:'p6', parcelId:'TZ-SHI-MWZ-000006', senderName:'Hassan Juma', senderPhone:'+255 723 111 333', ownerName:'Elizabeth Mcha', ownerPhone:'+255 724 444 555', destination:'Mwanza', packageCount:2, weight:35, description:'Pharma supplies - Medicines', paymentMode:'PAY_NOW', status:'IN_TRANSIT', qrStatus:'GREEN', transportFee:38000, insurance:6000, extraCharges:0, storageFees:0, totalPaid:44000, registeredAt:'May 3, 2025 10:00', cargoCompany:'Kobe Transport', branch:'Shinyanga', tripId:'t4' },
  { id:'p7', parcelId:'TZ-DSM-ARU-000007', senderName:'Omar Saidi', senderPhone:'+255 725 666 777', ownerName:'Sara Kimaro', ownerPhone:'+255 726 888 999', destination:'Arusha', packageCount:1, weight:12, description:'Laptop computer', paymentMode:'PAY_ON_ARRIVAL', status:'REGISTERED', qrStatus:'BLACK', transportFee:25000, insurance:15000, extraCharges:0, storageFees:0, totalPaid:0, registeredAt:'May 5, 2025 13:20', cargoCompany:'Kobe Transport', branch:'Dar es Salaam' },
  { id:'p8', parcelId:'TZ-MWZ-DAR-000008', senderName:'Patrick John', senderPhone:'+255 727 000 111', ownerName:'Joyce Leonard', ownerPhone:'+255 728 222 333', destination:'Dar es Salaam', packageCount:3, weight:55, description:'Fish products - Dried fish', paymentMode:'PAY_NOW', status:'DELIVERED', qrStatus:'WHITE', transportFee:42000, insurance:5000, extraCharges:2000, storageFees:0, totalPaid:49000, registeredAt:'Apr 15, 2025 07:45', cargoCompany:'Kobe Transport', branch:'Mwanza', tripId:'t5' },
];

const tripsData: TZTrip[] = [
  { id:'t1', vehiclePlate:'T 123 ABC', driverName:'Hassan Mwinyi', driverPhone:'+255 713 444 555', route:'Dar es Salaam → Morogoro → Dodoma → Singida → Shinyanga → Mwanza', checkpoints:[{name:'Dar es Salaam',passed:true,timestamp:'May 4 06:00'},{name:'Morogoro',passed:true,timestamp:'May 4 10:30'},{name:'Dodoma',passed:true,timestamp:'May 4 16:00'},{name:'Singida',passed:false},{name:'Shinyanga',passed:false},{name:'Mwanza',passed:false}], status:'IN_TRANSIT', departureTime:'May 4 06:00', parcelCount:4, parcels:['p1','p2','p6'], currentLocation:'Dodoma' },
  { id:'t2', vehiclePlate:'T 456 DEF', driverName:'James Kimaro', driverPhone:'+255 714 666 777', route:'Morogoro → Dodoma → Singida → Shinyanga → Mwanza', checkpoints:[{name:'Morogoro',passed:true,timestamp:'May 1 08:00'},{name:'Dodoma',passed:true,timestamp:'May 1 13:00'},{name:'Singida',passed:true,timestamp:'May 1 18:00'},{name:'Shinyanga',passed:true,timestamp:'May 2 02:00'},{name:'Mwanza',passed:true,timestamp:'May 2 08:00'}], status:'COMPLETED', departureTime:'May 1 08:00', arrivalTime:'May 2 08:00', parcelCount:3, parcels:['p3','p4'], currentLocation:'Mwanza' },
  { id:'t3', vehiclePlate:'T 789 GHI', driverName:'Peter Omari', driverPhone:'+255 715 888 999', route:'Dar es Salaam → Morogoro → Dodoma → Singida', checkpoints:[{name:'Dar es Salaam',passed:true,timestamp:'Apr 20 05:00'},{name:'Morogoro',passed:true,timestamp:'Apr 20 09:30'},{name:'Dodoma',passed:true,timestamp:'Apr 20 15:00'},{name:'Singida',passed:true,timestamp:'Apr 20 20:00'}], status:'COMPLETED', departureTime:'Apr 20 05:00', arrivalTime:'Apr 20 20:00', parcelCount:2, parcels:['p5'], currentLocation:'Singida' },
  { id:'t4', vehiclePlate:'T 321 JKL', driverName:'David Hassan', driverPhone:'+255 716 111 222', route:'Shinyanga → Mwanza', checkpoints:[{name:'Shinyanga',passed:true,timestamp:'May 3 14:00'},{name:'Mwanza',passed:false}], status:'IN_TRANSIT', departureTime:'May 3 14:00', parcelCount:1, parcels:['p6'], currentLocation:'Shinyanga' },
  { id:'t5', vehiclePlate:'T 654 MNO', driverName:'Abdul Rajab', driverPhone:'+255 717 333 444', route:'Mwanza → Shinyanga → Singida → Dodoma → Morogoro → Dar es Salaam', checkpoints:[{name:'Mwanza',passed:true,timestamp:'Apr 15 06:00'},{name:'Shinyanga',passed:true,timestamp:'Apr 15 10:00'},{name:'Singida',passed:true,timestamp:'Apr 15 15:00'},{name:'Dodoma',passed:true,timestamp:'Apr 15 19:00'},{name:'Morogoro',passed:true,timestamp:'Apr 16 00:30'},{name:'Dar es Salaam',passed:true,timestamp:'Apr 16 05:00'}], status:'COMPLETED', departureTime:'Apr 15 06:00', arrivalTime:'Apr 16 05:00', parcelCount:2, parcels:['p8'], currentLocation:'Dar es Salaam' },
];

const driversData: TZDriver[] = [
  { id:'d1', name:'Hassan Mwinyi', phone:'+255 713 444 555', license:'TL-2019-004512', rating:4.8, trips:142, earnings:2840000, points:2840, status:'on_trip', joined:'Jan 2019', rewards:[{type:'Fuel Bonus',amount:50000,date:'Apr 2025'},{type:'Perfect Route',amount:25000,date:'Mar 2025'}] },
  { id:'d2', name:'James Kimaro', phone:'+255 714 666 777', license:'TL-2020-008923', rating:4.6, trips:98, earnings:1960000, points:1960, status:'active', joined:'Mar 2020', rewards:[{type:'Speed Bonus',amount:30000,date:'Apr 2025'}] },
  { id:'d3', name:'Peter Omari', phone:'+255 715 888 999', license:'TL-2018-002341', rating:4.9, trips:201, earnings:4020000, points:4020, status:'active', joined:'Jun 2018', rewards:[{type:'Top Driver',amount:100000,date:'Apr 2025'},{type:'Fuel Bonus',amount:50000,date:'Mar 2025'}] },
  { id:'d4', name:'David Hassan', phone:'+255 716 111 222', license:'TL-2021-012345', rating:4.3, trips:45, earnings:720000, points:720, status:'on_trip', joined:'Aug 2021', rewards:[] },
  { id:'d5', name:'Abdul Rajab', phone:'+255 717 333 444', license:'TL-2017-001112', rating:4.7, trips:267, earnings:5340000, points:5340, status:'off_duty', joined:'Feb 2017', rewards:[{type:'Veteran Bonus',amount:150000,date:'Apr 2025'}] },
];

const incidentsData: TZIncident[] = [
  { id:'i1', tripId:'t1', type:'DELAY', severity:'low', description:'Traffic jam at Chalinze, 45min delay', location:'Chalinze', timestamp:'May 4 08:30', status:'resolved', reportedBy:'Hassan Mwinyi' },
  { id:'i2', tripId:'t4', type:'BREAKDOWN', severity:'high', description:'Tire burst on highway, replaced spare', location:'Shinyanga highway', timestamp:'May 3 15:30', status:'resolved', reportedBy:'David Hassan' },
  { id:'i3', tripId:'t2', type:'POLICE_STOP', severity:'low', description:'Routine traffic inspection, all clear', location:'Dodoma checkpoint', timestamp:'May 1 14:00', status:'resolved', reportedBy:'James Kimaro' },
  { id:'i4', tripId:'t1', type:'DELAY', severity:'medium', description:'Road construction near Dodoma, slow movement', location:'Dodoma approach', timestamp:'May 4 15:00', status:'reported', reportedBy:'Hassan Mwinyi' },
];

const auditLogsData: TZAuditLog[] = [
  { id:'a1', action:'PARCEL_REGISTERED', user:'Juma Hassan', role:'sender', parcelId:'TZ-DSM-MWZ-000001', timestamp:'May 1 09:30', details:'Parcel registered at Dar es Salaam branch' },
  { id:'a2', action:'QR_SCANNED', user:'Receiver Agent', role:'receiver', parcelId:'TZ-DSM-MWZ-000001', timestamp:'May 1 10:00', details:'Black QR scanned, goods verified' },
  { id:'a3', action:'PAYMENT_RECEIVED', user:'Receiver Agent', role:'receiver', parcelId:'TZ-DSM-MWZ-000001', timestamp:'May 1 10:15', details:'TZS 50,000 paid via M-Pesa' },
  { id:'a4', action:'QR_GENERATED', user:'System', role:'system', parcelId:'TZ-DSM-MWZ-000001', timestamp:'May 1 10:15', details:'Green QR generated - PAID' },
  { id:'a5', action:'PARCEL_LOADED', user:'Loading Agent', role:'loader', parcelId:'TZ-DSM-MWZ-000001', timestamp:'May 3 18:00', details:'Loaded into vehicle T 123 ABC' },
  { id:'a6', action:'TRIP_STARTED', user:'Hassan Mwinyi', role:'driver', parcelId:'TZ-DSM-MWZ-000001', timestamp:'May 4 06:00', details:'Trip T1 started from Dar es Salaam' },
  { id:'a7', action:'CHECKPOINT_PASSED', user:'Hassan Mwinyi', role:'driver', parcelId:'TZ-DSM-MWZ-000001', timestamp:'May 4 10:30', details:'Checkpoint Morogoro passed' },
  { id:'a8', action:'CHECKPOINT_PASSED', user:'Hassan Mwinyi', role:'driver', parcelId:'TZ-DSM-MWZ-000001', timestamp:'May 4 16:00', details:'Checkpoint Dodoma passed' },
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
  BLACK: 'bg-slate-600 text-white border-slate-500',
  YELLOW: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  GREEN: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  RED: 'bg-red-100 text-red-700 border-red-300',
  WHITE: 'bg-white text-slate-600 border-slate-300',
};

const statusLabels: Record<string, string> = {
  BLACK: 'Registered', YELLOW: 'Transit Pending', GREEN: 'Paid/Ready', RED: 'Payment Required', WHITE: 'Delivered'
};

const QSB = ({ qr }: { qr: string }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${qrSc[qr] || 'bg-gray-100 text-gray-600'}`}>
    <span className={`w-2 h-2 rounded-full mr-1 ${qr==='BLACK'?'bg-slate-400':qr==='YELLOW'?'bg-yellow-500':qr==='GREEN'?'bg-emerald-500':qr==='RED'?'bg-red-500':'bg-slate-300'}`} />
    {statusLabels[qr] || qr}
  </span>
);

const PSB = ({ status }: { status: string }) => {
  const colors: Record<string, string> = {
    REGISTERED: 'bg-gray-100 text-gray-600', VERIFIED: 'bg-blue-100 text-blue-600',
    PAID: 'bg-emerald-100 text-emerald-600', TRANSIT_PENDING: 'bg-yellow-100 text-yellow-600',
    IN_TRANSIT: 'bg-indigo-100 text-indigo-600', ARRIVED: 'bg-cyan-100 text-cyan-600',
    PAYMENT_REQUIRED: 'bg-red-100 text-red-600', RELEASED: 'bg-violet-100 text-violet-600',
    DELIVERED: 'bg-slate-100 text-slate-500',
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border border-white/[0.20] ${colors[status] || ''}`}>{status.replace(/_/g, ' ')}</span>;
};

/* Glass card wrapper */
const GC = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <Card className={`bg-white/[0.30] backdrop-blur-xl border border-white/[0.40] rounded-2xl shadow-sm ${className}`}>
    {children}
  </Card>
);

/* ------------------------------------------------------------------ */
/*  1. OVERVIEW TAB                                                     */
/* ------------------------------------------------------------------ */

function OverviewTab({ parcels, trips, drivers, auditLogs }: { parcels: TZParcel[]; trips: TZTrip[]; drivers: TZDriver[]; auditLogs: TZAuditLog[] }) {
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
  }, [parcels, trips, drivers]);

  return (
    <div className="space-y-6 p-1">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: 'Total Parcels', value: stats.totalParcels, icon: Package, color: 'text-amber-600' },
          { label: 'In Transit', value: stats.inTransit, icon: Truck, color: 'text-indigo-600' },
          { label: 'Delivered', value: stats.delivered, icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'Revenue (TZS)', value: stats.revenue.toLocaleString(), icon: DollarSign, color: 'text-green-600' },
          { label: 'Active Trips', value: stats.activeTrips, icon: Route, color: 'text-cyan-600' },
          { label: 'Active Drivers', value: stats.activeDrivers, icon: UserCircle, color: 'text-violet-600' },
        ].map((kpi) => (
          <GC key={kpi.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <div className="text-2xl font-bold text-slate-700">{kpi.value}</div>
              <div className="text-xs text-slate-500 mt-1">{kpi.label}</div>
            </CardContent>
          </GC>
        ))}
      </div>

      {/* QR Status Breakdown */}
      <GC>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <QrCode className="w-4 h-4 text-amber-600" /> Parcels by QR Status
          </h3>
          <div className="flex flex-wrap gap-3">
            {(['BLACK','YELLOW','GREEN','RED','WHITE'] as const).map(qr => (
              <div key={qr} className="flex items-center gap-2 bg-white/[0.30] rounded-lg px-3 py-2 border border-white/[0.40]">
                <QSB qr={qr} />
                <span className="text-lg font-bold text-slate-700">{stats.qrBreakdown[qr]}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </GC>

      {/* Recent Trips */}
      <GC>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Route className="w-4 h-4 text-amber-600" /> Recent Trips
          </h3>
          <div className="space-y-2">
            {trips.map(trip => (
              <div key={trip.id} className="flex items-center justify-between p-3 bg-white/[0.20] rounded-lg border border-white/[0.30]">
                <div className="flex items-center gap-3">
                  <Truck className="w-5 h-5 text-indigo-600" />
                  <div>
                    <div className="text-sm font-medium text-slate-700">{trip.vehiclePlate} &mdash; {trip.driverName}</div>
                    <div className="text-xs text-slate-500">{trip.route}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Current</div>
                    <div className="text-sm text-slate-600 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-amber-600" /> {trip.currentLocation}
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${trip.status === 'IN_TRANSIT' ? 'bg-indigo-100 text-indigo-600 border-indigo-300' : trip.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-600 border-emerald-300' : 'bg-gray-100 text-gray-600'}`}>
                    {trip.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </GC>

      {/* Revenue Breakdown */}
      <GC>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-600" /> Revenue Breakdown
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { label: 'Transport Fees', value: stats.transportFees, icon: Truck, color: 'text-indigo-600' },
              { label: 'Insurance', value: stats.insurance, icon: ShieldAlert, color: 'text-cyan-600' },
              { label: 'Extra Charges', value: stats.extra, icon: Zap, color: 'text-amber-600' },
            ].map(item => (
              <div key={item.label} className="p-3 bg-white/[0.20] rounded-lg border border-white/[0.30] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <item.icon className={`w-4 h-4 ${item.color}`} />
                  <span className="text-sm text-slate-600">{item.label}</span>
                </div>
                <span className="text-sm font-bold text-slate-700">TZS {item.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </GC>

      {/* Recent Audit Logs */}
      <GC>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-amber-600" /> Recent Audit Activity
          </h3>
          <div className="space-y-2">
            {auditLogs.slice(0, 5).map(log => (
              <div key={log.id} className="flex items-center gap-3 p-2 bg-white/[0.20] rounded-lg border border-white/[0.30]">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <Activity className="w-4 h-4 text-amber-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-slate-700 truncate">{log.action}</div>
                  <div className="text-xs text-slate-500">{log.user} &bull; {log.parcelId}</div>
                </div>
                <div className="text-xs text-slate-400 shrink-0">{log.timestamp}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </GC>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  2. PARCELS TAB                                                      */
/* ------------------------------------------------------------------ */

function ParcelsTab({ parcels, auditLogs }: { parcels: TZParcel[]; auditLogs: TZAuditLog[] }) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [selectedParcel, setSelectedParcel] = useState<TZParcel | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [newParcel, setNewParcel] = useState<{ senderName: string; senderPhone: string; ownerName: string; ownerPhone: string; destination: string; packageCount: number; weight: number; description: string; paymentMode: 'PAY_NOW' | 'PAY_ON_ARRIVAL' }>({ senderName:'', senderPhone:'', ownerName:'', ownerPhone:'', destination:'', packageCount:1, weight:0, description:'', paymentMode:'PAY_NOW' });

  const statuses = ['ALL','REGISTERED','VERIFIED','PAID','TRANSIT_PENDING','IN_TRANSIT','ARRIVED','PAYMENT_REQUIRED','DELIVERED'];

  const filtered = parcels.filter(p => {
    const matchesSearch = !search || p.parcelId.toLowerCase().includes(search.toLowerCase()) || p.senderName.toLowerCase().includes(search.toLowerCase()) || p.ownerName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'ALL' || p.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleRegister = () => {
    setRegisterOpen(false);
    setNewParcel({ senderName:'', senderPhone:'', ownerName:'', ownerPhone:'', destination:'', packageCount:1, weight:0, description:'', paymentMode:'PAY_NOW' });
  };

  return (
    <div className="space-y-4 p-1">
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search by parcel ID, sender, owner..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 bg-white/40 border-white/50 text-slate-700 placeholder:text-slate-400 rounded-xl" />
        </div>
        <Button onClick={() => setRegisterOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl">
          <Plus className="w-4 h-4 mr-1" /> Register New Parcel
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {statuses.map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${filterStatus === s ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-white/30 text-slate-500 border-white/40 hover:text-slate-700'}`}>
            {s === 'ALL' ? 'All' : s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map(p => (
          <div key={p.id} onClick={() => { setSelectedParcel(p); setDetailOpen(true); }}
            className="p-4 bg-white/[0.30] rounded-xl border border-white/[0.40] cursor-pointer hover:bg-white/[0.40] transition-colors shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-mono font-semibold text-emerald-700">{p.parcelId}</span>
              <div className="flex gap-2">
                <QSB qr={p.qrStatus} />
                <PSB status={p.status} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
              <div><span className="text-slate-400">Sender:</span> <span className="text-slate-700">{p.senderName}</span></div>
              <div><span className="text-slate-400">Owner:</span> <span className="text-slate-700">{p.ownerName}</span></div>
              <div><span className="text-slate-400">Destination:</span> <span className="text-slate-700">{p.destination}</span></div>
              <div><span className="text-slate-400">Branch:</span> <span className="text-slate-700">{p.branch}</span></div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex gap-3">
                <span className="flex items-center gap-1 text-slate-400"><Box className="w-3 h-3" /> {p.packageCount} pkgs</span>
                <span className="flex items-center gap-1 text-slate-400"><Weight className="w-3 h-3" /> {p.weight} kg</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${p.paymentMode === 'PAY_NOW' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-yellow-100 text-yellow-700 border-yellow-300'}`}>
                {p.paymentMode === 'PAY_NOW' ? 'Pay Now' : 'Pay on Arrival'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="bg-white/[0.95] backdrop-blur-xl border border-white/40 text-slate-700 max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl">
          {selectedParcel && (
            <>
              <DialogHeader><DialogTitle className="text-slate-700 flex items-center gap-2"><Package className="w-5 h-5 text-emerald-600" /> {selectedParcel.parcelId}</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="flex items-center gap-3">
                  <QSB qr={selectedParcel.qrStatus} />
                  <PSB status={selectedParcel.status} />
                </div>
                <div className="flex justify-center p-4 bg-white rounded-lg border border-slate-200">
                  <QRCodeSVG value={selectedParcel.parcelId} size={160} />
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { label: 'Sender', value: selectedParcel.senderName, phone: selectedParcel.senderPhone },
                    { label: 'Owner', value: selectedParcel.ownerName, phone: selectedParcel.ownerPhone },
                    { label: 'Destination', value: selectedParcel.destination, extra: `Branch: ${selectedParcel.branch}` },
                    { label: 'Packages', value: `${selectedParcel.packageCount} pkgs \u2022 ${selectedParcel.weight} kg`, extra: selectedParcel.description },
                  ].map(field => (
                    <div key={field.label} className="p-3 bg-white/[0.30] rounded-lg border border-white/[0.40]">
                      <div className="text-slate-400 text-xs mb-1">{field.label}</div>
                      <div className="text-slate-700 font-medium">{field.value}</div>
                      {field.phone && <div className="text-slate-500 text-xs flex items-center gap-1 mt-1"><Phone className="w-3 h-3" />{field.phone}</div>}
                      {field.extra && <div className="text-slate-500 text-xs mt-1">{field.extra}</div>}
                    </div>
                  ))}
                </div>
                <div className="p-3 bg-white/[0.30] rounded-lg border border-white/[0.40]">
                  <div className="text-slate-400 text-xs mb-2">Financial Details</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between"><span className="text-slate-600">Transport Fee:</span><span className="text-slate-700">TZS {selectedParcel.transportFee.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">Insurance:</span><span className="text-slate-700">TZS {selectedParcel.insurance.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">Extra Charges:</span><span className="text-slate-700">TZS {selectedParcel.extraCharges.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">Storage Fees:</span><span className="text-slate-700">TZS {selectedParcel.storageFees.toLocaleString()}</span></div>
                    <div className="flex justify-between border-t border-white/30 pt-2 mt-1"><span className="text-slate-600 font-medium">Total Paid:</span><span className="text-emerald-600 font-medium">TZS {selectedParcel.totalPaid.toLocaleString()}</span></div>
                    <div className="flex justify-between border-t border-white/30 pt-2 mt-1"><span className="text-slate-600 font-medium">Balance:</span><span className="text-red-500 font-medium">TZS {(selectedParcel.transportFee + selectedParcel.insurance + selectedParcel.extraCharges + selectedParcel.storageFees - selectedParcel.totalPaid).toLocaleString()}</span></div>
                  </div>
                </div>
                <div className="p-3 bg-white/[0.30] rounded-lg border border-white/[0.40]">
                  <div className="text-slate-400 text-xs mb-2">Audit Trail</div>
                  <div className="space-y-2">
                    {auditLogs.filter(l => l.parcelId === selectedParcel.parcelId).map(log => (
                      <div key={log.id} className="flex items-start gap-2 text-xs">
                        <Clock className="w-3 h-3 text-slate-400 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-slate-600">{log.action}</span>
                          <span className="text-slate-400"> &mdash; {log.details}</span>
                          <div className="text-slate-400">{log.timestamp} by {log.user}</div>
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
        <DialogContent className="bg-white/[0.95] backdrop-blur-xl border border-white/40 text-slate-700 max-w-lg rounded-2xl">
          <DialogHeader><DialogTitle className="text-slate-700 flex items-center gap-2"><Plus className="w-5 h-5 text-emerald-600" /> Register New Parcel</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              {['senderName','senderPhone','ownerName','ownerPhone'].map(field => (
                <div key={field}><label className="text-xs text-slate-500">{field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</label>
                  <Input value={newParcel[field as keyof typeof newParcel] as string} onChange={e => setNewParcel({...newParcel, [field]:e.target.value})} className="bg-white/40 border-white/50 text-slate-700 rounded-xl" /></div>
              ))}
            </div>
            <div><label className="text-xs text-slate-500">Destination</label>
              <select value={newParcel.destination} onChange={e => setNewParcel({...newParcel, destination:e.target.value})} className="w-full h-10 rounded-xl bg-white/40 border border-white/50 text-slate-700 px-3 text-sm">
                <option value="">Select destination</option>
                {branches.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-slate-500">Package Count</label><Input type="number" value={newParcel.packageCount} onChange={e => setNewParcel({...newParcel, packageCount:parseInt(e.target.value)||0})} className="bg-white/40 border-white/50 text-slate-700 rounded-xl" /></div>
              <div><label className="text-xs text-slate-500">Weight (kg)</label><Input type="number" value={newParcel.weight} onChange={e => setNewParcel({...newParcel, weight:parseInt(e.target.value)||0})} className="bg-white/40 border-white/50 text-slate-700 rounded-xl" /></div>
            </div>
            <div><label className="text-xs text-slate-500">Description</label><Input value={newParcel.description} onChange={e => setNewParcel({...newParcel, description:e.target.value})} className="bg-white/40 border-white/50 text-slate-700 rounded-xl" /></div>
            <div><label className="text-xs text-slate-500">Payment Mode</label>
              <select value={newParcel.paymentMode} onChange={e => setNewParcel({...newParcel, paymentMode:e.target.value as 'PAY_NOW'|'PAY_ON_ARRIVAL'})} className="w-full h-10 rounded-xl bg-white/40 border border-white/50 text-slate-700 px-3 text-sm">
                <option value="PAY_NOW">Pay Now</option>
                <option value="PAY_ON_ARRIVAL">Pay on Arrival</option>
              </select>
            </div>
            <Button onClick={handleRegister} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl">Register Parcel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  3. QR HUB TAB                                                       */
/* ------------------------------------------------------------------ */

function QRHubTab({ parcels }: { parcels: TZParcel[] }) {
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
  }, [filterQR, parcels]);

  const lifecycle = [
    { from: 'BLACK', to: 'YELLOW', label: 'Verified & Pending' },
    { from: 'YELLOW', to: 'GREEN', label: 'Paid & Ready' },
    { from: 'GREEN', to: 'WHITE', label: 'Delivered' },
    { from: 'BLACK', to: 'RED', label: 'Pay on Arrival' },
    { from: 'RED', to: 'WHITE', label: 'Paid at Destination' },
  ];

  return (
    <div className="space-y-6 p-1">
      <GC>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Route className="w-4 h-4 text-emerald-600" /> QR Code Lifecycle
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lifecycle.map((step, i) => (
              <div key={i} className="flex items-center gap-2 p-3 bg-white/[0.20] rounded-lg border border-white/[0.30]">
                <QSB qr={step.from} />
                <ArrowRight className="w-4 h-4 text-slate-400" />
                <QSB qr={step.to} />
                <span className="text-xs text-slate-500 ml-1">{step.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </GC>

      <GC>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <ScanLine className="w-4 h-4 text-emerald-600" /> QR Scanner (Simulated)
          </h3>
          <div className="flex gap-2">
            <Input placeholder="Enter Parcel ID to scan..." value={scanInput} onChange={e => setScanInput(e.target.value)}
              className="flex-1 bg-white/40 border-white/50 text-slate-700 placeholder:text-slate-400 rounded-xl" />
            <Button onClick={handleScan} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl">
              <ScanLine className="w-4 h-4 mr-1" /> Scan
            </Button>
          </div>
          {scannedParcel && (
            <div className="mt-4 p-4 bg-white/[0.40] rounded-lg border border-emerald-300">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-mono font-semibold text-emerald-700">{scannedParcel.parcelId}</span>
                <QSB qr={scannedParcel.qrStatus} />
              </div>
              <div className="flex justify-center p-3 bg-white rounded-lg mb-3">
                <QRCodeSVG value={scannedParcel.parcelId} size={140} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-slate-400">Sender:</span> <span className="text-slate-700">{scannedParcel.senderName}</span></div>
                <div><span className="text-slate-400">Owner:</span> <span className="text-slate-700">{scannedParcel.ownerName}</span></div>
                <div><span className="text-slate-400">Status:</span> <span className="text-slate-700">{scannedParcel.status.replace(/_/g,' ')}</span></div>
                <div><span className="text-slate-400">Destination:</span> <span className="text-slate-700">{scannedParcel.destination}</span></div>
              </div>
            </div>
          )}
          {scanInput && !scannedParcel && (
            <div className="mt-4 p-3 bg-red-100 rounded-lg border border-red-300 text-red-600 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Parcel not found
            </div>
          )}
        </CardContent>
      </GC>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilterQR('ALL')} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${filterQR === 'ALL' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-white/30 text-slate-500 border-white/40'}`}>All</button>
        {(['BLACK','YELLOW','GREEN','RED','WHITE'] as const).map(qr => (
          <button key={qr} onClick={() => setFilterQR(qr)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${filterQR === qr ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-white/30 text-slate-500 border-white/40'}`}>
            <span className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${qr==='BLACK'?'bg-slate-400':qr==='YELLOW'?'bg-yellow-500':qr==='GREEN'?'bg-emerald-500':qr==='RED'?'bg-red-500':'bg-slate-300'}`} /> {statusLabels[qr]}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {qrFiltered.map(p => (
          <div key={p.id} onClick={() => { setSelectedParcel(p); setParcelDetailOpen(true); }}
            className="p-4 bg-white/[0.30] rounded-xl border border-white/[0.40] cursor-pointer hover:bg-white/[0.40] transition-colors shadow-sm">
            <div className="flex justify-center p-2 bg-white rounded-lg mb-3 border border-slate-100">
              <QRCodeSVG value={p.parcelId} size={120} />
            </div>
            <div className="text-xs font-mono text-emerald-700 text-center mb-2">{p.parcelId}</div>
            <div className="flex items-center justify-between mb-1">
              <QSB qr={p.qrStatus} />
              <PSB status={p.status} />
            </div>
            <div className="text-xs text-slate-500 mt-2">{p.senderName} &rarr; {p.destination}</div>
          </div>
        ))}
      </div>

      <Dialog open={parcelDetailOpen} onOpenChange={setParcelDetailOpen}>
        <DialogContent className="bg-white/[0.95] backdrop-blur-xl border border-white/40 text-slate-700 max-w-md rounded-2xl">
          {selectedParcel && (
            <>
              <DialogHeader><DialogTitle className="text-slate-700">{selectedParcel.parcelId}</DialogTitle></DialogHeader>
              <div className="flex justify-center p-4 bg-white rounded-lg mt-2 border border-slate-200">
                <QRCodeSVG value={selectedParcel.parcelId} size={180} />
              </div>
              <div className="text-center text-sm text-slate-600 mt-2">{selectedParcel.senderName} &rarr; {selectedParcel.destination}</div>
              <div className="flex items-center justify-center gap-2 mt-1"><QSB qr={selectedParcel.qrStatus} /></div>
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

function LoadingTab({ parcels, trips }: { parcels: TZParcel[]; trips: TZTrip[] }) {
  const [selectedTripId, setSelectedTripId] = useState<string>('t1');
  const [loadedParcels, setLoadedParcels] = useState<Record<string, boolean>>({ 'p1': true, 'p2': false, 'p6': false });

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
    <div className="space-y-4 p-1">
      <div className="flex flex-wrap gap-2">
        {activeTrips.map(t => (
          <button key={t.id} onClick={() => setSelectedTripId(t.id)}
            className={`px-4 py-2 rounded-lg text-xs font-medium border transition-colors ${selectedTripId === t.id ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-white/30 text-slate-500 border-white/40 hover:text-slate-700'}`}>
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4" />
              <span>{t.vehiclePlate}</span>
              <span className="text-slate-400">|</span>
              <span>{t.driverName}</span>
            </div>
          </button>
        ))}
      </div>

      {selectedTrip && (
        <>
          <GC>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                    <Truck className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-700">{selectedTrip.vehiclePlate} &mdash; {selectedTrip.driverName}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-1"><Route className="w-3 h-3" /> {selectedTrip.route}</div>
                  </div>
                </div>
                <span className="px-2 py-1 rounded-full text-[10px] font-medium border bg-indigo-100 text-indigo-600 border-indigo-300">
                  {selectedTrip.status.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="mb-2">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-600">Loading Progress</span>
                  <span className="text-emerald-600 font-medium">{loadedCount}/{totalCount} loaded</span>
                </div>
                <div className="w-full h-3 bg-white/40 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            </CardContent>
          </GC>

          <GC>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <Container className="w-4 h-4 text-emerald-600" /> Loading Manifest
              </h3>
              <div className="space-y-2">
                {tripParcels.map(p => (
                  <div key={p.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${loadedParcels[p.id] ? 'bg-emerald-50 border-emerald-300' : 'bg-white/[0.20] border-white/[0.30]'}`}>
                    <button onClick={() => toggleLoaded(p.id)}
                      className={`w-6 h-6 rounded-md border flex items-center justify-center transition-colors ${loadedParcels[p.id] ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 hover:border-emerald-400'}`}>
                      {loadedParcels[p.id] && <CheckCircle2 className="w-4 h-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-emerald-700">{p.parcelId}</span>
                        <QSB qr={p.qrStatus} />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1"><User className="w-3 h-3" /> {p.senderName}</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {p.destination}</span>
                        <span className="flex items-center gap-1"><Weight className="w-3 h-3" /> {p.weight} kg</span>
                        <span className="flex items-center gap-1"><Box className="w-3 h-3" /> {p.packageCount} pkgs</span>
                      </div>
                    </div>
                    {loadedParcels[p.id] ? (
                      <span className="text-[10px] text-emerald-600 font-medium">Loaded</span>
                    ) : (
                      <span className="text-[10px] text-slate-400">Pending</span>
                    )}
                  </div>
                ))}
              </div>

              {progress === 100 ? (
                <div className="mt-4 p-3 bg-emerald-100 rounded-lg border border-emerald-300 text-emerald-700 text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> All parcels loaded. Ready for departure.
                </div>
              ) : (
                <div className="mt-4 text-xs text-slate-400">{totalCount - loadedCount} parcel(s) remaining to load</div>
              )}

              <Button className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl" disabled={progress < 100}>
                <CheckCircle2 className="w-4 h-4 mr-1" /> Confirm Loading Complete
              </Button>
            </CardContent>
          </GC>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  5. TRIPS TAB                                                        */
/* ------------------------------------------------------------------ */

function TripsTab({ parcels, trips }: { parcels: TZParcel[]; trips: TZTrip[] }) {
  const [expandedTrip, setExpandedTrip] = useState<string | null>('t1');
  const toggleExpand = (tripId: string) => setExpandedTrip(expandedTrip === tripId ? null : tripId);

  return (
    <div className="space-y-3 p-1">
      {trips.map(trip => (
        <GC key={trip.id}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleExpand(trip.id)}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                  <Truck className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-700">{trip.vehiclePlate}</div>
                  <div className="text-xs text-slate-500">{trip.driverName}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${trip.status === 'IN_TRANSIT' ? 'bg-indigo-100 text-indigo-600 border-indigo-300' : trip.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-600 border-emerald-300' : trip.status === 'ARRIVED' ? 'bg-cyan-100 text-cyan-600 border-cyan-300' : 'bg-gray-100 text-gray-600'}`}>
                    {trip.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${expandedTrip === trip.id ? 'rotate-90' : ''}`} />
              </div>
            </div>

            <div className="mt-3 flex items-center gap-1 text-xs text-slate-400 flex-wrap">
              {trip.route.split(' \u2192 ').map((city, i, arr) => (
                <span key={i} className="flex items-center gap-1">
                  <span className={trip.checkpoints.find(c => c.name === city)?.passed ? 'text-emerald-600' : trip.currentLocation === city ? 'text-amber-600' : ''}>{city}</span>
                  {i < arr.length - 1 && <ArrowRight className="w-3 h-3 text-slate-300" />}
                </span>
              ))}
            </div>

            {expandedTrip === trip.id && (
              <div className="mt-4 pt-4 border-t border-white/30 space-y-4">
                <div>
                  <div className="text-xs text-slate-500 mb-3 flex items-center gap-1"><Route className="w-3 h-3" /> Checkpoint Timeline</div>
                  <div className="flex items-start justify-between overflow-x-auto">
                    {trip.checkpoints.map((cp, i) => {
                      const isCurrent = !cp.passed && (i === 0 || trip.checkpoints[i-1]?.passed);
                      return (
                        <div key={cp.name} className="flex flex-col items-center flex-1 relative min-w-[60px]">
                          {i < trip.checkpoints.length - 1 && (
                            <div className={`absolute top-3 left-1/2 w-full h-0.5 ${cp.passed ? 'bg-emerald-400' : 'bg-white/40'}`} style={{ left: '50%', width: '100%' }} />
                          )}
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center z-10 text-xs ${cp.passed ? 'bg-emerald-500 text-white' : isCurrent ? 'bg-amber-400 text-white' : 'bg-white border border-slate-300 text-slate-400'}`}>
                            {cp.passed ? <CheckCircle2 className="w-3.5 h-3.5" /> : isCurrent ? <CircleDot className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                          </div>
                          <div className="text-[10px] text-center mt-1.5">
                            <div className={`${cp.passed ? 'text-emerald-600' : isCurrent ? 'text-amber-600' : 'text-slate-400'}`}>{cp.name}</div>
                            {cp.timestamp && <div className="text-slate-400 mt-0.5">{cp.timestamp}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-2 bg-white/[0.20] rounded-lg border border-white/[0.30]">
                    <div className="text-[10px] text-slate-400">Departure</div>
                    <div className="text-xs text-slate-700">{trip.departureTime}</div>
                  </div>
                  <div className="p-2 bg-white/[0.20] rounded-lg border border-white/[0.30]">
                    <div className="text-[10px] text-slate-400">{trip.arrivalTime ? 'Arrival' : 'Current Location'}</div>
                    <div className="text-xs text-slate-700">{trip.arrivalTime || trip.currentLocation}</div>
                  </div>
                  <div className="p-2 bg-white/[0.20] rounded-lg border border-white/[0.30]">
                    <div className="text-[10px] text-slate-400">Parcels</div>
                    <div className="text-xs text-slate-700">{trip.parcelCount} parcels</div>
                  </div>
                  <div className="p-2 bg-white/[0.20] rounded-lg border border-white/[0.30]">
                    <div className="text-[10px] text-slate-400">Driver</div>
                    <div className="text-xs text-slate-700 flex items-center gap-1"><Phone className="w-3 h-3" /> {trip.driverPhone}</div>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500 mb-2">Parcels on this trip</div>
                  <div className="space-y-1.5">
                    {trip.parcels.map(pid => {
                      const p = parcels.find(x => x.id === pid);
                      if (!p) return null;
                      return (
                        <div key={pid} className="flex items-center gap-2 p-2 bg-white/[0.20] rounded-lg border border-white/[0.30]">
                          <Package className="w-4 h-4 text-emerald-600" />
                          <span className="text-xs font-mono text-emerald-700">{p.parcelId}</span>
                          <span className="text-xs text-slate-600">{p.senderName} &rarr; {p.destination}</span>
                          <span className="ml-auto"><QSB qr={p.qrStatus} /></span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2">
                  {trip.status === 'SCHEDULED' && <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"><Send className="w-4 h-4 mr-1" /> Start Trip</Button>}
                  {trip.status === 'IN_TRANSIT' && <Button className="bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl"><CheckCircle2 className="w-4 h-4 mr-1" /> Mark Arrived</Button>}
                  {trip.status === 'ARRIVED' && <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"><CheckCircle2 className="w-4 h-4 mr-1" /> Complete Trip</Button>}
                  <Button variant="outline" className="border-white/50 text-slate-600 hover:bg-white/30 rounded-xl"><Eye className="w-4 h-4 mr-1" /> View Details</Button>
                </div>
              </div>
            )}
          </CardContent>
        </GC>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  6. TRACKING TAB                                                     */
/* ------------------------------------------------------------------ */

function TrackingTab({ trips }: { trips: TZTrip[] }) {
  const activeTrips = trips.filter(t => t.status === 'IN_TRANSIT');
  const allCheckpoints = ['Dar es Salaam', 'Morogoro', 'Dodoma', 'Singida', 'Shinyanga', 'Mwanza'];

  return (
    <div className="space-y-6 p-1">
      <GC>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-600" /> Northern Corridor Route
          </h3>
          <div className="flex items-center justify-between overflow-x-auto pb-2">
            {allCheckpoints.map((cp, i) => (
              <div key={cp} className="flex items-center flex-shrink-0">
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${i <= 2 ? 'bg-emerald-100 border-emerald-400 text-emerald-600' : i === 3 ? 'bg-amber-100 border-amber-400 text-amber-600' : 'bg-white/30 border-white/50 text-slate-400'}`}>
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div className={`text-[10px] mt-1.5 font-medium ${i <= 2 ? 'text-emerald-600' : i === 3 ? 'text-amber-600' : 'text-slate-400'}`}>{cp}</div>
                  <div className="text-[9px] text-slate-400 mt-0.5">{i === 0 ? 'Start' : i === 5 ? 'End' : `+${i * 110} km`}</div>
                </div>
                {i < allCheckpoints.length - 1 && (
                  <div className={`w-12 md:w-20 h-0.5 mx-1 ${i < 2 ? 'bg-emerald-400' : i === 2 ? 'bg-amber-400' : 'bg-white/40'}`} />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </GC>

      <GC>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-600" /> Active Trips Tracking
          </h3>
          {activeTrips.length === 0 ? (
            <div className="text-center text-slate-400 py-8">No active trips currently</div>
          ) : (
            <div className="space-y-4">
              {activeTrips.map(trip => {
                const passedCount = trip.checkpoints.filter(c => c.passed).length;
                const totalCp = trip.checkpoints.length;
                const pct = (passedCount / totalCp) * 100;
                return (
                  <div key={trip.id} className="p-4 bg-white/[0.20] rounded-lg border border-white/[0.30]">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Truck className="w-6 h-6 text-indigo-600" />
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-700">{trip.vehiclePlate} &mdash; {trip.driverName}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-1">
                            <Navigation className="w-3 h-3 text-amber-600" /> Currently at: <span className="text-amber-600">{trip.currentLocation}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Wifi className="w-4 h-4 text-emerald-600" />
                        <span className="text-[10px] text-emerald-600">Live</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 mb-2">
                      {trip.checkpoints.map((cp, i) => (
                        <div key={cp.name} className="flex items-center flex-1">
                          <div className={`w-2 h-2 rounded-full ${cp.passed ? 'bg-emerald-500' : trip.currentLocation === cp.name ? 'bg-amber-500 animate-pulse' : 'bg-white/50'}`} />
                          {i < trip.checkpoints.length - 1 && (
                            <div className={`flex-1 h-0.5 mx-0.5 ${cp.passed && trip.checkpoints[i+1]?.passed ? 'bg-emerald-400' : 'bg-white/40'}`} />
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">{passedCount}/{totalCp} checkpoints passed</span>
                      <div className="flex gap-3">
                        <span className="flex items-center gap-1 text-slate-400"><Timer className="w-3 h-3" /> ~{Math.round((100 - pct) * 2)} min ETA</span>
                        <span className="flex items-center gap-1 text-slate-400"><Package className="w-3 h-3" /> {trip.parcelCount} parcels</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </GC>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { icon: Radio, label: 'GPS Tracking', desc: 'Real-time satellite positioning', status: 'Active', color: 'text-emerald-600' },
          { icon: QrCode, label: 'QR Scan Points', desc: 'Automated checkpoint scans', status: 'Active', color: 'text-emerald-600' },
          { icon: Wifi, label: 'Cell Tower Triangulation', desc: 'Backup location method', status: 'Standby', color: 'text-yellow-600' },
        ].map(method => (
          <div key={method.label} className="p-4 bg-white/[0.30] rounded-lg border border-white/[0.40] flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-white/40 flex items-center justify-center">
              <method.icon className={`w-5 h-5 ${method.color}`} />
            </div>
            <div className="flex-1">
              <div className="text-sm text-slate-700">{method.label}</div>
              <div className="text-xs text-slate-500">{method.desc}</div>
            </div>
            <span className={`text-[10px] font-medium ${method.color}`}>{method.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  7. PAYMENTS TAB                                                     */
/* ------------------------------------------------------------------ */

function PaymentsTab({ parcels }: { parcels: TZParcel[] }) {
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
  }, [parcels]);

  const payNowCount = parcels.filter(p => p.paymentMode === 'PAY_NOW').length;
  const payLaterCount = parcels.filter(p => p.paymentMode === 'PAY_ON_ARRIVAL').length;
  const redParcels = parcels.filter(p => p.qrStatus === 'RED');

  return (
    <div className="space-y-6 p-1">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Collected', value: `TZS ${summary.totalCollected.toLocaleString()}`, icon: Banknote, color: 'text-emerald-600' },
          { label: 'Pending (Pay on Arrival)', value: `TZS ${summary.pendingAmount.toLocaleString()}`, sub: `${summary.pendingCount} parcels`, icon: Clock, color: 'text-yellow-600' },
          { label: 'Storage Fees', value: `TZS ${summary.storageFees.toLocaleString()}`, icon: Container, color: 'text-cyan-600' },
          { label: 'Overdue', value: `TZS ${summary.overdueAmount.toLocaleString()}`, sub: `${summary.overdueCount} parcels`, icon: AlertTriangle, color: 'text-red-600' },
        ].map(card => (
          <GC key={card.label}>
            <CardContent className="p-4">
              <card.icon className={`w-5 h-5 ${card.color} mb-2`} />
              <div className="text-lg font-bold text-slate-700">{card.value}</div>
              <div className="text-xs text-slate-500">{card.label}</div>
              {card.sub && <div className="text-[10px] text-slate-400 mt-0.5">{card.sub}</div>}
            </CardContent>
          </GC>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GC>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-600" /> Payment Mode Breakdown
            </h3>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-600">Pay Now</span>
                  <span className="text-emerald-600 font-medium">{payNowCount} parcels ({Math.round((payNowCount/parcels.length)*100)}%)</span>
                </div>
                <div className="w-full h-2.5 bg-white/40 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(payNowCount/parcels.length)*100}%` }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-600">Pay on Arrival</span>
                  <span className="text-yellow-600 font-medium">{payLaterCount} parcels ({Math.round((payLaterCount/parcels.length)*100)}%)</span>
                </div>
                <div className="w-full h-2.5 bg-white/40 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${(payLaterCount/parcels.length)*100}%` }} />
                </div>
              </div>
            </div>
          </CardContent>
        </GC>

        <GC>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-emerald-600" /> Storage Fee Calculator
            </h3>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div><label className="text-[10px] text-slate-500">Free Days</label><Input type="number" value={storageDays} onChange={e => setStorageDays(parseInt(e.target.value)||0)} className="bg-white/40 border-white/50 text-slate-700 h-8 text-xs rounded-xl" /></div>
              <div><label className="text-[10px] text-slate-500">Daily Rate (TZS)</label><Input type="number" value={dailyRate} onChange={e => setDailyRate(parseInt(e.target.value)||0)} className="bg-white/40 border-white/50 text-slate-700 h-8 text-xs rounded-xl" /></div>
              <div><label className="text-[10px] text-slate-500">Days Delayed</label><Input type="number" value={daysDelayed} onChange={e => setDaysDelayed(parseInt(e.target.value)||0)} className="bg-white/40 border-white/50 text-slate-700 h-8 text-xs rounded-xl" /></div>
            </div>
            <div className="p-2 bg-white/[0.20] rounded-lg border border-white/[0.30]">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Storage Fee:</span>
                <span className="text-emerald-600 font-bold">TZS {Math.max(0, (daysDelayed - storageDays) * dailyRate).toLocaleString()}</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {daysDelayed <= storageDays ? 'Within free period' : `Charged for ${daysDelayed - storageDays} days @ TZS ${dailyRate}/day`}
              </div>
            </div>
          </CardContent>
        </GC>
      </div>

      <GC>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-600" /> Accepted Payment Methods
          </h3>
          <div className="flex flex-wrap gap-2">
            {['M-Pesa', 'Airtel Money', 'Tigo Pesa', 'HaloPesa', 'Cash', 'Bank Transfer'].map(method => (
              <span key={method} className="px-3 py-1.5 bg-white/30 rounded-lg text-xs text-slate-600 border border-white/40 flex items-center gap-1.5">
                {method === 'M-Pesa' && <Phone className="w-3 h-3 text-emerald-600" />}
                {method === 'Airtel Money' && <Phone className="w-3 h-3 text-red-600" />}
                {method === 'Tigo Pesa' && <Phone className="w-3 h-3 text-blue-600" />}
                {method === 'HaloPesa' && <Phone className="w-3 h-3 text-purple-600" />}
                {method === 'Cash' && <Banknote className="w-3 h-3 text-green-600" />}
                {method === 'Bank Transfer' && <Receipt className="w-3 h-3 text-cyan-600" />}
                {method}
              </span>
            ))}
          </div>
        </CardContent>
      </GC>

      {redParcels.length > 0 && (
        <GC className="border-red-300">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-red-600 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Payment Required (RED QR)
            </h3>
            <div className="space-y-2">
              {redParcels.map(p => {
                const amountDue = p.transportFee + p.insurance + p.storageFees - p.totalPaid;
                return (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-center gap-3">
                      <QSB qr={p.qrStatus} />
                      <div>
                        <div className="text-sm font-mono text-slate-700">{p.parcelId}</div>
                        <div className="text-xs text-slate-500">{p.ownerName} &bull; {p.destination}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-bold text-red-600">TZS {amountDue.toLocaleString()}</div>
                      </div>
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-lg">
                        <DollarSign className="w-3 h-3 mr-1" /> Collect
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </GC>
      )}

      <GC>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-600" /> Parcel Payment Status
          </h3>
          <div className="space-y-2">
            {parcels.map(p => {
              const totalDue = p.transportFee + p.insurance + p.extraCharges + p.storageFees;
              const balance = totalDue - p.totalPaid;
              return (
                <div key={p.id} className="flex items-center justify-between p-3 bg-white/[0.20] rounded-lg border border-white/[0.30]">
                  <div className="flex items-center gap-3">
                    <Package className="w-4 h-4 text-emerald-600" />
                    <div>
                      <div className="text-xs font-mono text-slate-700">{p.parcelId}</div>
                      <div className="text-xs text-slate-500">{p.ownerName}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="text-right">
                      <div className="text-slate-600">Due: <span className="text-slate-700">TZS {totalDue.toLocaleString()}</span></div>
                      <div className="text-slate-600">Paid: <span className="text-emerald-600">TZS {p.totalPaid.toLocaleString()}</span></div>
                    </div>
                    <div className={`text-right font-medium ${balance <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {balance <= 0 ? 'Paid' : `TZS ${balance.toLocaleString()}`}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${p.paymentMode === 'PAY_NOW' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-yellow-100 text-yellow-700 border-yellow-300'}`}>
                      {p.paymentMode === 'PAY_NOW' ? 'Pay Now' : 'Pay on Arrival'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </GC>
    </div>
  );
}


/* ------------------------------------------------------------------ */
/*  8. DRIVERS TAB                                                      */
/* ------------------------------------------------------------------ */

function DriversTab({ drivers }: { drivers: TZDriver[] }) {
  const [sortBy, setSortBy] = useState<'points' | 'earnings' | 'trips'>('points');
  const [selectedDriver, setSelectedDriver] = useState<TZDriver | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const sorted = useMemo(() => [...drivers].sort((a, b) => b[sortBy] - a[sortBy]), [drivers, sortBy]);

  const statusColors: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    on_trip: 'bg-indigo-100 text-indigo-700 border-indigo-300',
    off_duty: 'bg-gray-100 text-gray-600 border-gray-300',
  };

  const renderStars = (rating: number) => (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`w-3 h-3 ${i <= Math.round(rating) ? 'text-amber-500 fill-amber-500' : 'text-slate-200'}`} />
      ))}
      <span className="text-xs text-slate-500 ml-1">{rating}</span>
    </div>
  );

  return (
    <div className="space-y-4 p-1">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500">Sort by:</span>
        {[
          { key: 'points' as const, label: 'Points', icon: Award },
          { key: 'earnings' as const, label: 'Earnings', icon: DollarSign },
          { key: 'trips' as const, label: 'Trips', icon: Truck },
        ].map(opt => (
          <button key={opt.key} onClick={() => setSortBy(opt.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1 ${sortBy === opt.key ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-white/30 text-slate-500 border-white/40 hover:text-slate-700'}`}>
            <opt.icon className="w-3 h-3" /> {opt.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sorted.map((driver, idx) => (
          <div key={driver.id} onClick={() => { setSelectedDriver(driver); setDetailOpen(true); }}
            className="p-4 bg-white/[0.30] rounded-xl border border-white/[0.40] cursor-pointer hover:bg-white/[0.40] transition-colors shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-lg font-bold text-emerald-700">
                  {driver.name.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    {driver.name}
                    {idx === 0 && <Award className="w-4 h-4 text-amber-500" />}
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3" /> {driver.phone}</div>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusColors[driver.status]}`}>
                {driver.status.replace(/_/g, ' ')}
              </span>
            </div>
            {renderStars(driver.rating)}
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="p-2 bg-white/[0.20] rounded-lg border border-white/[0.30] text-center">
                <div className="text-sm font-bold text-slate-700">{driver.trips}</div>
                <div className="text-[10px] text-slate-400">Trips</div>
              </div>
              <div className="p-2 bg-white/[0.20] rounded-lg border border-white/[0.30] text-center">
                <div className="text-sm font-bold text-emerald-600">TZS {(driver.earnings/1000000).toFixed(1)}M</div>
                <div className="text-[10px] text-slate-400">Earnings</div>
              </div>
              <div className="p-2 bg-white/[0.20] rounded-lg border border-white/[0.30] text-center">
                <div className="text-sm font-bold text-amber-600">{driver.points.toLocaleString()}</div>
                <div className="text-[10px] text-slate-400">Points</div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-400">
              <span>License: {driver.license}</span><span>|</span><span>Joined: {driver.joined}</span>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="bg-white/[0.95] backdrop-blur-xl border border-white/40 text-slate-700 max-w-lg rounded-2xl">
          {selectedDriver && (
            <>
              <DialogHeader><DialogTitle className="text-slate-700 flex items-center gap-2">
                <UserCircle className="w-5 h-5 text-emerald-600" /> {selectedDriver.name}
              </DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-2xl font-bold text-emerald-700">
                    {selectedDriver.name.charAt(0)}
                  </div>
                  <div>
                    {renderStars(selectedDriver.rating)}
                    <div className="text-xs text-slate-500 mt-1">{selectedDriver.license} &bull; Joined {selectedDriver.joined}</div>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusColors[selectedDriver.status]}`}>
                      {selectedDriver.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-white/[0.30] rounded-lg border border-white/[0.40] text-center">
                    <Truck className="w-4 h-4 text-indigo-600 mx-auto mb-1" />
                    <div className="text-lg font-bold text-slate-700">{selectedDriver.trips}</div>
                    <div className="text-[10px] text-slate-400">Total Trips</div>
                  </div>
                  <div className="p-3 bg-white/[0.30] rounded-lg border border-white/[0.40] text-center">
                    <DollarSign className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
                    <div className="text-lg font-bold text-emerald-600">TZS {(selectedDriver.earnings/1000000).toFixed(2)}M</div>
                    <div className="text-[10px] text-slate-400">Earnings</div>
                  </div>
                  <div className="p-3 bg-white/[0.30] rounded-lg border border-white/[0.40] text-center">
                    <Award className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                    <div className="text-lg font-bold text-amber-600">{selectedDriver.points.toLocaleString()}</div>
                    <div className="text-[10px] text-slate-400">Points</div>
                  </div>
                </div>
                {selectedDriver.rewards.length > 0 && (
                  <div className="p-3 bg-white/[0.30] rounded-lg border border-white/[0.40]">
                    <div className="text-xs text-slate-500 mb-2 flex items-center gap-1"><Award className="w-3 h-3 text-amber-500" /> Rewards History</div>
                    <div className="space-y-2">
                      {selectedDriver.rewards.map((reward, i) => (
                        <div key={i} className="flex items-center justify-between text-xs p-2 bg-white/[0.20] rounded-lg border border-white/[0.30]">
                          <div className="flex items-center gap-2">
                            <Zap className="w-3 h-3 text-amber-500" />
                            <span className="text-slate-700">{reward.type}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-emerald-600 font-medium">TZS {reward.amount.toLocaleString()}</span>
                            <span className="text-slate-400">{reward.date}</span>
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

function IncidentsTab({ incidents: initial }: { incidents: TZIncident[] }) {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [selectedIncident, setSelectedIncident] = useState<TZIncident | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [incidentList, setIncidentList] = useState<TZIncident[]>(initial);
  const [newIncident, setNewIncident] = useState({ type: 'DELAY' as TZIncident['type'], severity: 'low' as TZIncident['severity'], description: '', location: '', tripId: '' });

  const incidentTypes = ['ALL', 'ACCIDENT', 'THEFT', 'BREAKDOWN', 'POLICE_STOP', 'DELAY', 'OTHER'];
  const severities = ['ALL', 'low', 'medium', 'high', 'critical'];

  const filtered = useMemo(() => {
    return incidentList.filter(i => {
      const matchType = filterType === 'ALL' || i.type === filterType;
      const matchSev = filterSeverity === 'ALL' || i.severity === filterSeverity;
      return matchType && matchSev;
    });
  }, [incidentList, filterType, filterSeverity]);

  const typeIcons: Record<string, React.ReactNode> = {
    ACCIDENT: <AlertTriangle className="w-4 h-4" />,
    THEFT: <Lock className="w-4 h-4" />,
    BREAKDOWN: <Wrench className="w-4 h-4" />,
    POLICE_STOP: <ShieldAlert className="w-4 h-4" />,
    DELAY: <Clock className="w-4 h-4" />,
    OTHER: <FileText className="w-4 h-4" />,
  };

  const typeColors: Record<string, string> = {
    ACCIDENT: 'bg-red-100 text-red-700 border-red-300',
    THEFT: 'bg-purple-100 text-purple-700 border-purple-300',
    BREAKDOWN: 'bg-orange-100 text-orange-700 border-orange-300',
    POLICE_STOP: 'bg-blue-100 text-blue-700 border-blue-300',
    DELAY: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    OTHER: 'bg-gray-100 text-gray-600 border-gray-300',
  };

  const severityColors: Record<string, string> = {
    low: 'text-emerald-600', medium: 'text-yellow-600', high: 'text-orange-600', critical: 'text-red-600',
  };

  const incidentStatusColors: Record<string, string> = {
    reported: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    resolved: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    escalated: 'bg-red-100 text-red-700 border-red-300',
  };

  const handleSubmit = () => {
    const inc: TZIncident = {
      id: `i${incidentList.length + 1}`, tripId: newIncident.tripId || 't1',
      type: newIncident.type, severity: newIncident.severity,
      description: newIncident.description, location: newIncident.location,
      timestamp: new Date().toLocaleString(), status: 'reported', reportedBy: 'Current User',
    };
    setIncidentList([inc, ...incidentList]);
    setNewIncident({ type: 'DELAY', severity: 'low', description: '', location: '', tripId: '' });
    setReportOpen(false);
  };

  return (
    <div className="space-y-4 p-1">
      <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <div className="flex flex-wrap gap-1">
          {incidentTypes.map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium border transition-colors ${filterType === t ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-white/30 text-slate-500 border-white/40 hover:text-slate-700'}`}>
              {t === 'ALL' ? 'All Types' : t.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
        <Button onClick={() => setReportOpen(true)} className="bg-red-500 hover:bg-red-600 text-white text-xs rounded-xl">
          <Plus className="w-3.5 h-3.5 mr-1" /> Report Incident
        </Button>
      </div>
      <div className="flex flex-wrap gap-1">
        {severities.map(s => (
          <button key={s} onClick={() => setFilterSeverity(s)}
            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium border transition-colors ${filterSeverity === s ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-white/30 text-slate-500 border-white/40 hover:text-slate-700'}`}>
            {s === 'ALL' ? 'All Severities' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map(incident => (
          <div key={incident.id} onClick={() => { setSelectedIncident(incident); setDetailOpen(true); }}
            className="p-4 bg-white/[0.30] rounded-xl border border-white/[0.40] cursor-pointer hover:bg-white/[0.40] transition-colors shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center border ${typeColors[incident.type]}`}>
                  {typeIcons[incident.type]}
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    {incident.type.replace(/_/g, ' ')}
                    <span className={`text-[10px] font-medium ${severityColors[incident.severity]}`}>{incident.severity.toUpperCase()}</span>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> {incident.location} &bull; Trip {incident.tripId}</div>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${incidentStatusColors[incident.status]}`}>
                {incident.status}
              </span>
            </div>
            <div className="text-xs text-slate-600 ml-12">{incident.description}</div>
            <div className="flex items-center justify-between mt-3 ml-12">
              <div className="text-[10px] text-slate-400 flex items-center gap-1"><User className="w-3 h-3" /> Reported by: {incident.reportedBy}</div>
              <div className="text-[10px] text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" /> {incident.timestamp}</div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="bg-white/[0.95] backdrop-blur-xl border border-white/40 text-slate-700 max-w-lg rounded-2xl">
          {selectedIncident && (
            <>
              <DialogHeader><DialogTitle className="text-slate-700 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-emerald-600" /> Incident {selectedIncident.id.toUpperCase()}
              </DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${typeColors[selectedIncident.type]}`}>{selectedIncident.type.replace(/_/g, ' ')}</span>
                  <span className={`text-xs font-bold ${severityColors[selectedIncident.severity]}`}>{selectedIncident.severity.toUpperCase()} SEVERITY</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${incidentStatusColors[selectedIncident.status]}`}>{selectedIncident.status}</span>
                </div>
                <div className="p-4 bg-white/[0.30] rounded-lg border border-white/[0.40]">
                  <div className="text-xs text-slate-500 mb-1">Description</div>
                  <div className="text-sm text-slate-700">{selectedIncident.description}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-white/[0.30] rounded-lg border border-white/[0.40]"><div className="text-[10px] text-slate-500">Location</div><div className="text-sm text-slate-700 flex items-center gap-1"><MapPin className="w-3 h-3 text-emerald-600" /> {selectedIncident.location}</div></div>
                  <div className="p-3 bg-white/[0.30] rounded-lg border border-white/[0.40]"><div className="text-[10px] text-slate-500">Trip ID</div><div className="text-sm text-slate-700">{selectedIncident.tripId.toUpperCase()}</div></div>
                  <div className="p-3 bg-white/[0.30] rounded-lg border border-white/[0.40]"><div className="text-[10px] text-slate-500">Reported By</div><div className="text-sm text-slate-700 flex items-center gap-1"><User className="w-3 h-3" /> {selectedIncident.reportedBy}</div></div>
                  <div className="p-3 bg-white/[0.30] rounded-lg border border-white/[0.40]"><div className="text-[10px] text-slate-500">Timestamp</div><div className="text-sm text-slate-700 flex items-center gap-1"><Clock className="w-3 h-3" /> {selectedIncident.timestamp}</div></div>
                </div>
                {selectedIncident.status === 'resolved' && (
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                    <div className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Resolution Notes</div>
                    <div className="text-xs text-slate-600 mt-1">Incident has been resolved and documented.</div>
                  </div>
                )}
                {selectedIncident.status === 'reported' && (
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"><CheckCircle2 className="w-4 h-4 mr-1" /> Mark Resolved</Button>
                    <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50 rounded-lg"><AlertTriangle className="w-4 h-4 mr-1" /> Escalate</Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="bg-white/[0.95] backdrop-blur-xl border border-white/40 text-slate-700 max-w-lg rounded-2xl">
          <DialogHeader><DialogTitle className="text-slate-700 flex items-center gap-2">
            <Plus className="w-5 h-5 text-red-500" /> Report New Incident
          </DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-slate-500">Incident Type</label>
                <select value={newIncident.type} onChange={e => setNewIncident({...newIncident, type: e.target.value as TZIncident['type']})} className="w-full h-10 rounded-xl bg-white/40 border border-white/50 text-slate-700 px-3 text-sm">
                  {incidentTypes.filter(t => t !== 'ALL').map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select></div>
              <div><label className="text-xs text-slate-500">Severity</label>
                <select value={newIncident.severity} onChange={e => setNewIncident({...newIncident, severity: e.target.value as TZIncident['severity']})} className="w-full h-10 rounded-xl bg-white/40 border border-white/50 text-slate-700 px-3 text-sm">
                  {severities.filter(s => s !== 'ALL').map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select></div>
            </div>
            <div><label className="text-xs text-slate-500">Trip ID</label><Input value={newIncident.tripId} onChange={e => setNewIncident({...newIncident, tripId: e.target.value})} placeholder="e.g. t1" className="bg-white/40 border-white/50 text-slate-700 rounded-xl" /></div>
            <div><label className="text-xs text-slate-500">Location</label><Input value={newIncident.location} onChange={e => setNewIncident({...newIncident, location: e.target.value})} placeholder="Incident location" className="bg-white/40 border-white/50 text-slate-700 rounded-xl" /></div>
            <div><label className="text-xs text-slate-500">Description</label><textarea value={newIncident.description} onChange={e => setNewIncident({...newIncident, description: e.target.value})} placeholder="Describe the incident..." rows={3} className="w-full h-20 rounded-xl bg-white/40 border border-white/50 text-slate-700 px-3 py-2 text-sm placeholder:text-slate-400 resize-none focus:border-emerald-400 focus:outline-none" /></div>
            <Button onClick={handleSubmit} className="w-full bg-red-500 hover:bg-red-600 text-white rounded-xl">Submit Report</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  10. AUDIT TAB                                                       */
/* ------------------------------------------------------------------ */

function AuditTab({ auditLogs }: { auditLogs: TZAuditLog[] }) {
  const [filterAction, setFilterAction] = useState('ALL');
  const [filterRole, setFilterRole] = useState('ALL');
  const [searchParcel, setSearchParcel] = useState('');

  const actions = useMemo(() => ['ALL', ...Array.from(new Set(auditLogs.map(l => l.action)))], [auditLogs]);
  const roles = useMemo(() => ['ALL', ...Array.from(new Set(auditLogs.map(l => l.role)))], [auditLogs]);

  const filtered = useMemo(() => {
    return auditLogs.filter(l => {
      const matchAction = filterAction === 'ALL' || l.action === filterAction;
      const matchRole = filterRole === 'ALL' || l.role === filterRole;
      const matchParcel = !searchParcel || l.parcelId.toLowerCase().includes(searchParcel.toLowerCase());
      return matchAction && matchRole && matchParcel;
    });
  }, [auditLogs, filterAction, filterRole, searchParcel]);

  const fraudAlerts = useMemo(() => {
    const alerts: { type: string; detail: string; severity: 'low' | 'high' }[] = [];
    const qrScans = auditLogs.filter(l => l.action === 'QR_SCANNED');
    if (qrScans.length > 3) alerts.push({ type: 'Multiple QR Scans', detail: `${qrScans.length} QR scan events detected`, severity: 'low' });
    const payments = auditLogs.filter(l => l.action === 'PAYMENT_RECEIVED');
    if (payments.length > qrScans.length) alerts.push({ type: 'Payment Without Verification', detail: 'More payments than QR verifications detected', severity: 'high' });
    return alerts;
  }, [auditLogs]);

  const uniqueUsers = useMemo(() => new Set(auditLogs.map(l => l.user)).size, [auditLogs]);

  const actionIcons: Record<string, React.ReactNode> = {
    PARCEL_REGISTERED: <Package className="w-4 h-4 text-blue-600" />,
    QR_SCANNED: <ScanLine className="w-4 h-4 text-amber-600" />,
    PAYMENT_RECEIVED: <DollarSign className="w-4 h-4 text-emerald-600" />,
    QR_GENERATED: <QrCode className="w-4 h-4 text-violet-600" />,
    PARCEL_LOADED: <Container className="w-4 h-4 text-indigo-600" />,
    TRIP_STARTED: <Send className="w-4 h-4 text-cyan-600" />,
    CHECKPOINT_PASSED: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
    INCIDENT_REPORTED: <ShieldAlert className="w-4 h-4 text-red-600" />,
  };

  return (
    <div className="space-y-4 p-1">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Actions', value: auditLogs.length, icon: Activity, color: 'text-blue-600' },
          { label: 'Unique Users', value: uniqueUsers, icon: User, color: 'text-violet-600' },
          { label: 'Fraud Alerts', value: fraudAlerts.length, icon: AlertTriangle, color: fraudAlerts.length > 0 ? 'text-red-600' : 'text-emerald-600' },
          { label: 'Security Score', value: fraudAlerts.length > 0 ? '92%' : '100%', icon: ShieldAlert, color: 'text-emerald-600' },
        ].map(card => (
          <GC key={card.label}>
            <CardContent className="p-4">
              <card.icon className={`w-5 h-5 ${card.color} mb-2`} />
              <div className="text-2xl font-bold text-slate-700">{card.value}</div>
              <div className="text-xs text-slate-500">{card.label}</div>
            </CardContent>
          </GC>
        ))}
      </div>

      {fraudAlerts.length > 0 && (
        <GC className="border-red-300">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-red-600 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Fraud Detection Alerts
            </h3>
            <div className="space-y-2">
              {fraudAlerts.map((alert, i) => (
                <div key={i} className={`p-3 rounded-lg border flex items-center gap-3 ${alert.severity === 'high' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
                  <AlertTriangle className={`w-4 h-4 ${alert.severity === 'high' ? 'text-red-600' : 'text-yellow-600'}`} />
                  <div className="flex-1">
                    <div className={`text-xs font-medium ${alert.severity === 'high' ? 'text-red-600' : 'text-yellow-600'}`}>{alert.type}</div>
                    <div className="text-xs text-slate-600">{alert.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </GC>
      )}

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search by parcel ID..." value={searchParcel} onChange={e => setSearchParcel(e.target.value)}
            className="pl-10 bg-white/40 border-white/50 text-slate-700 placeholder:text-slate-400 rounded-xl" />
        </div>
        <div className="flex flex-wrap gap-1">
          {actions.map(a => (
            <button key={a} onClick={() => setFilterAction(a)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium border transition-colors ${filterAction === a ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-white/30 text-slate-500 border-white/40 hover:text-slate-700'}`}>{a === 'ALL' ? 'All' : a.replace(/_/g, ' ')}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {roles.map(r => (
            <button key={r} onClick={() => setFilterRole(r)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium border transition-colors ${filterRole === r ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-white/30 text-slate-500 border-white/40 hover:text-slate-700'}`}>{r === 'ALL' ? 'All Roles' : r}</button>
          ))}
        </div>
      </div>

      <GC>
        <CardContent className="p-4">
          <div className="space-y-2">
            {filtered.map(log => (
              <div key={log.id} className="flex items-center gap-3 p-3 bg-white/[0.20] rounded-lg border border-white/[0.30] hover:bg-white/[0.30] transition-colors">
                <div className="w-8 h-8 rounded-full bg-white/40 flex items-center justify-center shrink-0">
                  {actionIcons[log.action] || <Activity className="w-4 h-4 text-slate-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-700">{log.action.replace(/_/g, ' ')}</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-white/40 text-slate-500 border border-white/40">{log.role}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{log.details}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] font-mono text-emerald-700">{log.parcelId}</div>
                  <div className="text-[10px] text-slate-400">{log.timestamp}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </GC>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MAIN COMPONENT                                                      */
/* ------------------------------------------------------------------ */

export default function CargoTZApp() {
  const [activeTab, setActiveTab] = useState('overview');
  const [parcels, setParcels] = useState<TZParcel[]>(parcelsData);
  const [trips, setTrips] = useState<TZTrip[]>(tripsData);
  const [drivers, setDrivers] = useState<TZDriver[]>(driversData);
  const [incidents, setIncidents] = useState<TZIncident[]>(incidentsData);
  const [auditLogs, setAuditLogs] = useState<TZAuditLog[]>(auditLogsData);

  /* Attempt to load real data from API */
  useEffect(() => {
    (async () => {
      try {
        const apiParcels = await api<TZParcel[]>('/cargo/parcels');
        if (apiParcels && apiParcels.length > 0) setParcels(apiParcels);
      } catch { /* keep mock */ }
      try {
        const apiTrips = await api<TZTrip[]>('/cargo/trips');
        if (apiTrips && apiTrips.length > 0) setTrips(apiTrips);
      } catch { /* keep mock */ }
      try {
        const apiDrivers = await api<TZDriver[]>('/cargo/drivers');
        if (apiDrivers && apiDrivers.length > 0) setDrivers(apiDrivers);
      } catch { /* keep mock */ }
    })();
  }, []);

  const renderTab = () => {
    switch (activeTab) {
      case 'overview': return <OverviewTab parcels={parcels} trips={trips} drivers={drivers} auditLogs={auditLogs} />;
      case 'parcels': return <ParcelsTab parcels={parcels} auditLogs={auditLogs} />;
      case 'qr_hub': return <QRHubTab parcels={parcels} />;
      case 'loading': return <LoadingTab parcels={parcels} trips={trips} />;
      case 'trips': return <TripsTab parcels={parcels} trips={trips} />;
      case 'tracking': return <TrackingTab trips={trips} />;
      case 'payments': return <PaymentsTab parcels={parcels} />;
      case 'drivers': return <DriversTab drivers={drivers} />;
      case 'incidents': return <IncidentsTab incidents={incidents} />;
      case 'audit': return <AuditTab auditLogs={auditLogs} />;
      default: return <OverviewTab parcels={parcels} trips={trips} drivers={drivers} auditLogs={auditLogs} />;
    }
  };

  return (
    <div className="h-full flex" style={{ backgroundColor: '#E8E4F0' }}>
      {/* LEFT SIDEBAR */}
      <div className="w-60 h-full flex flex-col shrink-0 border-r border-white/30 bg-white/20 backdrop-blur-xl">
        {/* Header */}
        <div className="shrink-0 px-4 py-4 border-b border-white/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
              <Navigation className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-700">Cargo TZ</div>
              <div className="text-[10px] text-slate-500">Domestic Transport</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <div className="space-y-1.5">
            {sidebarItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.key;
              return (
                <button key={item.key} onClick={() => setActiveTab(item.key)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all text-left ${
                    isActive ? 'bg-emerald-100 border-emerald-300' : 'bg-white/[0.20] border-transparent hover:bg-white/[0.30]'
                  }`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isActive ? 'bg-emerald-200' : 'bg-white/40'}`}>
                    <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-700' : 'text-slate-500'}`} />
                  </div>
                  <div className="min-w-0">
                    <div className={`text-[11px] font-medium ${isActive ? 'text-emerald-700' : 'text-slate-600'}`}>{item.label}</div>
                    <div className="text-[9px] text-slate-400 truncate">{item.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="shrink-0 px-4 py-3 border-t border-white/30">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-emerald-600">System Online</span>
          </div>
          <div className="text-[9px] text-slate-400 mt-1">
            {parcels.length} parcels &bull; {trips.length} trips &bull; {drivers.length} drivers
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 overflow-y-auto p-6">
          {renderTab()}
        </ScrollArea>
      </div>
    </div>
  );
}
