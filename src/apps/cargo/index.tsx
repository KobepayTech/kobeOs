import { useState, useMemo, useCallback, useEffect } from 'react';
import { useOSStore } from '@/os/store';
import {
  Plane, BarChart3, Package, ShieldCheck, Warehouse, PlaneTakeoff,
  Wallet, MapPin, Truck, Search, CheckCircle2, ArrowRight, ClipboardCheck, Ship, Anchor,
  CircleDot, Circle, DollarSign, Phone, Calendar,
  Container, ScanLine, Weight, Ruler,
  Box, AlertTriangle, Bell,
  TrendingUp, Minus, X, Route, Globe, Clock, AlertCircle,
  Zap, BrainCircuit, FileText, Calculator, Gauge,
  Activity, ArrowUpRight, ArrowDownRight,
  Sparkles,
  Download, Printer, Copy,
  Target, Receipt,
  Megaphone, Pause, Play, Eye, MousePointerClick, Users,
  Check, Navigation, Send, PackageSearch, Inbox, Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { QRCodeSVG } from 'qrcode.react';
import {
  BarChart, Bar, PieChart, Pie, Cell, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  RadarChart, Radar as RechartsRadar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ComposedChart,
} from 'recharts';
import CargoTZ from './cargo_tz';

/* ═══════════════════════════════════════════
   KOBECARGO — STATE OF THE ART EDITION
   Enterprise Cargo Management System
   ═══════════════════════════════════════════ */

/* ─── TYPES ─── */
type SS = 'DRAFT'|'ORIGIN'|'EXPORT_CUSTOMS'|'IN_TRANSIT'|'ARRIVED'|'IMPORT_CUSTOMS'|'DESTINATION'|'OUT_FOR_DELIVERY'|'DELIVERED'|'CANCELLED';
type SP = 'STANDARD'|'EXPRESS'|'URGENT';
type CL = 'GREEN'|'YELLOW'|'RED';
type PS = 'RECEIVED'|'WEIGHED'|'IN_BIN'|'IN_ULD'|'ON_FLIGHT'|'ARRIVED'|'AT_DESTINATION'|'OUT_FOR_DELIVERY'|'DELIVERED';
type PM = 'Bank Transfer'|'Mobile Money'|'Cash'|'Card';

interface Shipment { id:string; number:string; status:SS; priority:SP; cargoType:string; masterAWB:string; houseAWB:string; declaredValue:number; currency:string; actualWeight:number; origin:string; destination:string; portCode:string; customer:string; supplier:string; createdAt:string; etd:string; eta:string; packages:number; value:number; cost:number; }
interface CClear { jurisdiction:'CHINA_EXPORT'|'TANZANIA_IMPORT'; portCode:string; status:string; riskScore:number; dutiesEstimated:number; dutiesPaid:number; lane:CL; inspection:boolean; taxDispute:boolean; }
interface Pkg { id:string; qrCode:string; description:string; weight:number; status:PS; shipmentId:string; binNumber?:string; uldNumber?:string; dims:string; }
interface Bin { id:string; number:string; warehouse:string; status:string; weight:number; packages:number; }
interface ULD { id:string; number:string; uldType:string; flight:string; status:string; weight:number; capacity:number; }
interface Flight { id:string; number:string; airline:string; origin:string; destination:string; transit?:string; etd:string; eta:string; status:string; ulds:number; weight:number; capacity:number; costPerKg:number; }
interface TEvent { id:string; shipmentId:string; type:string; location:string; timestamp:string; }
interface Wallet { id:string; customer:string; balanceTZS:number; balanceUSD:number; held:number; creditLimit:number; }
interface Transaction { id:string; walletId:string; amount:number; type:'CREDIT'|'DEBIT'; method:PM; description:string; date:string; status:string; }
interface Delivery { id:string; shipmentId:string; driver:string; phone:string; vehicle:string; status:string; address:string; started:string; delivered?:string; recipient?:string; }

interface AlertItem {
  id: string;
  type: 'CUSTOMS_RISK' | 'PAYMENT_OVERDUE' | 'FLIGHT_DELAYED' | 'DELIVERY_FAILED' | 'TAX_DISPUTE' | 'INSPECTION' | 'ANOMALY' | 'AI_RECOMMENDATION';
  severity: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  entityId: string;
  entityType: string;
  timestamp: string;
  action?: string;
}

interface AIInsight {
  id: string;
  type: 'PREDICTION' | 'RISK' | 'RECOMMENDATION' | 'ANOMALY' | 'OPTIMIZATION';
  confidence: number;
  title: string;
  description: string;
  shipmentId?: string;
  severity: 'critical' | 'warning' | 'info';
}

/* ─── AD SERVER NETWORK TYPES ─── */
interface Advertiser {
  id: string; name: string; email: string; phone: string; company: string; logo: string;
  status: 'active' | 'pending' | 'suspended'; totalSpent: number; adCount: number; joined: string;
}
interface Ad {
  id: string; title: string; type: 'image' | 'video' | 'text' | 'carousel';
  mediaUrl: string; advertiserId: string; status: 'pending' | 'approved' | 'rejected' | 'running' | 'paused' | 'expired';
  targetLocations: string[]; targetDevices: string[]; startDate: string; endDate: string;
  priority: number; impressions: number; clicks: number; budget: number; spend: number;
  cpm: number; ctr: number;
}
interface Campaign {
  id: string; name: string; advertiserId: string; status: 'draft' | 'active' | 'paused' | 'ended';
  startDate: string; endDate: string; budget: number; spend: number; impressions: number;
  clicks: number; conversions: number; targetAudience: string; placement: string[];
}
interface AdPricingTier {
  id: string; name: string; location: string; cpm: number; minBudget: number; description: string;
}

/* ─── DATA ─── */
const shipments: Shipment[] = [
  {id:'s1',number:'SHP-2025-001',status:'DELIVERED',priority:'STANDARD',cargoType:'Electronics',masterAWB:'607-12345678',houseAWB:'KBE001',declaredValue:45000,currency:'USD',actualWeight:1250,origin:'Guangzhou (CAN)',destination:'Dar es Salaam (DAR)',portCode:'CAN→DAR',customer:'KOBEPay Tech',supplier:'Shenzhen Electronics Ltd',createdAt:'Apr 1',etd:'Apr 5',eta:'Apr 12',packages:12,value:45000,cost:32000},
  {id:'s2',number:'SHP-2025-002',status:'IMPORT_CUSTOMS',priority:'EXPRESS',cargoType:'Textiles',masterAWB:'875-87654321',houseAWB:'KBE002',declaredValue:28000,currency:'USD',actualWeight:890,origin:'Guangzhou (CAN)',destination:'Dar es Salaam (DAR)',portCode:'CAN→DAR',customer:'Safari Logistics',supplier:'Guangzhou Textile Co',createdAt:'Apr 10',etd:'Apr 15',eta:'Apr 22',packages:8,value:28000,cost:19500},
  {id:'s3',number:'SHP-2025-003',status:'IN_TRANSIT',priority:'STANDARD',cargoType:'Machinery Parts',masterAWB:'607-55556666',houseAWB:'KBE003',declaredValue:62000,currency:'USD',actualWeight:2100,origin:'Hong Kong (HKG)',destination:'Zanzibar (ZNZ)',portCode:'HKG→ZNZ',customer:'Bongo Foods',supplier:'Dongguan Heavy Industry',createdAt:'Apr 20',etd:'Apr 25',eta:'May 3',packages:5,value:62000,cost:48000},
  {id:'s4',number:'SHP-2025-004',status:'EXPORT_CUSTOMS',priority:'URGENT',cargoType:'Pharmaceuticals',masterAWB:'875-11112222',houseAWB:'KBE004',declaredValue:85000,currency:'USD',actualWeight:340,origin:'Guangzhou (CAN)',destination:'Dar es Salaam (DAR)',portCode:'CAN→DAR',customer:'Nuru Enterprises',supplier:'Shanghai Pharma Inc',createdAt:'May 1',etd:'May 8',eta:'May 15',packages:3,value:85000,cost:61000},
  {id:'s5',number:'SHP-2025-005',status:'ORIGIN',priority:'STANDARD',cargoType:'Consumer Goods',masterAWB:'607-99998888',houseAWB:'KBE005',declaredValue:15000,currency:'USD',actualWeight:560,origin:'Shenzhen (SZX)',destination:'Dar es Salaam (DAR)',portCode:'SZX→DAR',customer:'Mwangala Traders',supplier:'Yiwu Wholesale Market',createdAt:'May 5',etd:'May 12',eta:'May 20',packages:15,value:15000,cost:11200},
  {id:'s6',number:'SHP-2025-006',status:'DESTINATION',priority:'EXPRESS',cargoType:'Auto Parts',masterAWB:'875-44447777',houseAWB:'KBE006',declaredValue:38000,currency:'USD',actualWeight:1780,origin:'Guangzhou (CAN)',destination:'Dar es Salaam (DAR)',portCode:'CAN→DAR',customer:'Diamond Imports TZ',supplier:'Foshan Auto Parts Ltd',createdAt:'Apr 18',etd:'Apr 22',eta:'Apr 30',packages:7,value:38000,cost:27500},
];

const customsData: Record<string, { export: CClear; import: CClear }> = {
  s1: { export: { jurisdiction:'CHINA_EXPORT', portCode:'CAN', status:'CLEARED', riskScore:15, dutiesEstimated:0, dutiesPaid:0, lane:'GREEN', inspection:false, taxDispute:false }, import: { jurisdiction:'TANZANIA_IMPORT', portCode:'DAR', status:'CLEARED', riskScore:22, dutiesEstimated:7200, dutiesPaid:7200, lane:'GREEN', inspection:false, taxDispute:false }},
  s2: { export: { jurisdiction:'CHINA_EXPORT', portCode:'CAN', status:'CLEARED', riskScore:25, dutiesEstimated:0, dutiesPaid:0, lane:'GREEN', inspection:false, taxDispute:false }, import: { jurisdiction:'TANZANIA_IMPORT', portCode:'DAR', status:'INSPECTION_TRIGGERED', riskScore:68, dutiesEstimated:4200, dutiesPaid:0, lane:'YELLOW', inspection:true, taxDispute:false }},
  s3: { export: { jurisdiction:'CHINA_EXPORT', portCode:'HKG', status:'CLEARED', riskScore:30, dutiesEstimated:0, dutiesPaid:0, lane:'GREEN', inspection:false, taxDispute:false }, import: { jurisdiction:'TANZANIA_IMPORT', portCode:'ZNZ', status:'PENDING_DOCS', riskScore:55, dutiesEstimated:8900, dutiesPaid:0, lane:'YELLOW', inspection:false, taxDispute:false }},
  s4: { export: { jurisdiction:'CHINA_EXPORT', portCode:'CAN', status:'INSPECTION_TRIGGERED', riskScore:78, dutiesEstimated:0, dutiesPaid:0, lane:'RED', inspection:true, taxDispute:false }, import: { jurisdiction:'TANZANIA_IMPORT', portCode:'DAR', status:'PENDING_DOCS', riskScore:82, dutiesEstimated:15200, dutiesPaid:0, lane:'RED', inspection:false, taxDispute:true }},
  s5: { export: { jurisdiction:'CHINA_EXPORT', portCode:'SZX', status:'PENDING_DOCS', riskScore:35, dutiesEstimated:0, dutiesPaid:0, lane:'GREEN', inspection:false, taxDispute:false }, import: { jurisdiction:'TANZANIA_IMPORT', portCode:'DAR', status:'PENDING_DOCS', riskScore:40, dutiesEstimated:2800, dutiesPaid:0, lane:'GREEN', inspection:false, taxDispute:false }},
  s6: { export: { jurisdiction:'CHINA_EXPORT', portCode:'CAN', status:'CLEARED', riskScore:28, dutiesEstimated:0, dutiesPaid:0, lane:'GREEN', inspection:false, taxDispute:false }, import: { jurisdiction:'TANZANIA_IMPORT', portCode:'DAR', status:'CLEARED', riskScore:35, dutiesEstimated:6800, dutiesPaid:6800, lane:'GREEN', inspection:false, taxDispute:false }},
};

const packages: Pkg[] = [
  {id:'p1',qrCode:'PKG-2025-001',description:'Smartphone Cases (500x)',weight:45,status:'DELIVERED',shipmentId:'s1',binNumber:'BIN-001',uldNumber:'PMC001',dims:'120x80x60'},
  {id:'p2',qrCode:'PKG-2025-002',description:'Tablet Screens (200x)',weight:32,status:'DELIVERED',shipmentId:'s1',binNumber:'BIN-001',uldNumber:'PMC001',dims:'90x60x40'},
  {id:'p3',qrCode:'PKG-2025-003',description:'Bluetooth Earbuds (1000x)',weight:18,status:'DELIVERED',shipmentId:'s1',binNumber:'BIN-002',uldNumber:'PMC001',dims:'60x40x30'},
  {id:'p4',qrCode:'PKG-2025-004',description:'Cotton Fabric Rolls',weight:220,status:'ON_FLIGHT',shipmentId:'s2',binNumber:'BIN-003',uldNumber:'AKE001',dims:'200x100x80'},
  {id:'p5',qrCode:'PKG-2025-005',description:'Printed Textiles',weight:180,status:'ON_FLIGHT',shipmentId:'s2',binNumber:'BIN-003',uldNumber:'AKE001',dims:'180x90x70'},
  {id:'p6',qrCode:'PKG-2025-006',description:'Industrial Gearbox',weight:850,status:'IN_BIN',shipmentId:'s3',binNumber:'BIN-004',dims:'150x100x100'},
  {id:'p7',qrCode:'PKG-2025-007',description:'Hydraulic Pumps (4x)',weight:420,status:'IN_BIN',shipmentId:'s3',binNumber:'BIN-004',dims:'120x80x80'},
  {id:'p8',qrCode:'PKG-2025-008',description:'Vaccine Shipment Cold',weight:45,status:'RECEIVED',shipmentId:'s4',dims:'80x60x40'},
  {id:'p9',qrCode:'PKG-2025-009',description:'Medical Supplies',weight:68,status:'RECEIVED',shipmentId:'s4',dims:'100x70x50'},
  {id:'p10',qrCode:'PKG-2025-010',description:'Household Items Mixed',weight:35,status:'RECEIVED',shipmentId:'s5',dims:'80x60x50'},
];
const bins: Bin[] = [
  {id:'b1',number:'BIN-001',warehouse:'CAN-WH-01',status:'LOADED',weight:77,packages:2},
  {id:'b2',number:'BIN-002',warehouse:'CAN-WH-01',status:'LOADED',weight:18,packages:1},
  {id:'b3',number:'BIN-003',warehouse:'CAN-WH-02',status:'LOADED',weight:400,packages:2},
  {id:'b4',number:'BIN-004',warehouse:'HKG-WH-01',status:'ASSEMBLING',weight:1270,packages:2},
];
const ulds: ULD[] = [
  {id:'u1',number:'PMC001',uldType:'PMC',flight:'ET607',status:'IN_FLIGHT',weight:95,capacity:5000},
  {id:'u2',number:'AKE001',uldType:'AKE',flight:'QR875',status:'IN_FLIGHT',weight:400,capacity:1500},
  {id:'u3',number:'PAG001',uldType:'PAG',flight:'ET631',status:'WAITING',weight:0,capacity:3000},
];
const flights: Flight[] = [
  {id:'f1',number:'ET607',airline:'Ethiopian Airlines',origin:'CAN',destination:'DAR',transit:'ADD',etd:'Apr 5 14:30',eta:'Apr 12 06:45',status:'IN_FLIGHT',ulds:2,weight:3200,capacity:15000,costPerKg:8.5},
  {id:'f2',number:'QR875',airline:'Qatar Airways',origin:'CAN',destination:'DAR',transit:'DOH',etd:'Apr 15 22:15',eta:'Apr 22 08:30',status:'IN_FLIGHT',ulds:1,weight:800,capacity:12000,costPerKg:12.0},
  {id:'f3',number:'ET631',airline:'Ethiopian Airlines',origin:'HKG',destination:'ZNZ',transit:'ADD',etd:'Apr 25 09:00',eta:'May 3 14:20',status:'SCHEDULED',ulds:0,weight:0,capacity:10000,costPerKg:7.8},
  {id:'f4',number:'QR891',airline:'Qatar Airways',origin:'SZX',destination:'DAR',transit:'DOH',etd:'May 12 18:45',eta:'May 20 11:00',status:'DELAYED',ulds:0,weight:0,capacity:18000,costPerKg:11.2},
];
const trackingEvents: TEvent[] = [
  {id:'te1',shipmentId:'s1',type:'SHIPMENT_CREATED',location:'Guangzhou',timestamp:'Apr 1 09:00'},
  {id:'te2',shipmentId:'s1',type:'PACKAGE_RECEIVED',location:'CAN-WH-01',timestamp:'Apr 2 14:30'},
  {id:'te3',shipmentId:'s1',type:'EXPORT_CUSTOMS_CLEARED',location:'Guangzhou',timestamp:'Apr 4 10:15'},
  {id:'te4',shipmentId:'s1',type:'FLIGHT_DEPARTED',location:'CAN',timestamp:'Apr 5 14:30'},
  {id:'te5',shipmentId:'s1',type:'ARRIVED_TRANSIT',location:'ADD',timestamp:'Apr 6 02:00'},
  {id:'te6',shipmentId:'s1',type:'FLIGHT_ARRIVED',location:'DAR',timestamp:'Apr 12 06:45'},
  {id:'te7',shipmentId:'s1',type:'IMPORT_CUSTOMS_CLEARED',location:'DAR',timestamp:'Apr 13 11:30'},
  {id:'te8',shipmentId:'s1',type:'OUT_FOR_DELIVERY',location:'Dar es Salaam',timestamp:'Apr 14 08:00'},
  {id:'te9',shipmentId:'s1',type:'DELIVERY_COMPLETED',location:'Dar es Salaam',timestamp:'Apr 14 16:45'},
  {id:'te10',shipmentId:'s2',type:'SHIPMENT_CREATED',location:'Guangzhou',timestamp:'Apr 10 11:00'},
  {id:'te11',shipmentId:'s2',type:'IMPORT_CUSTOMS_INSPECTION',location:'DAR',timestamp:'Apr 23 09:00'},
  {id:'te12',shipmentId:'s4',type:'EXPORT_CUSTOMS_INSPECTION',location:'Guangzhou',timestamp:'May 7 08:30'},
];
const wallets: Wallet[] = [
  {id:'w1',customer:'KOBEPay Tech',balanceTZS:45200000,balanceUSD:17200,held:5000000,creditLimit:80000000},
  {id:'w2',customer:'Safari Logistics',balanceTZS:12800000,balanceUSD:4800,held:2000000,creditLimit:30000000},
  {id:'w3',customer:'Bongo Foods',balanceTZS:8500000,balanceUSD:3200,held:0,creditLimit:50000000},
  {id:'w4',customer:'Nuru Enterprises',balanceTZS:2100000,balanceUSD:800,held:1500000,creditLimit:25000000},
];
const transactions: Transaction[] = [
  {id:'tx1',walletId:'w1',amount:4500000,type:'DEBIT',method:'Bank Transfer',description:'Shipping SHP-2025-001',date:'Apr 2',status:'Paid'},
  {id:'tx2',walletId:'w1',amount:7200000,type:'CREDIT',method:'Bank Transfer',description:'Customs duty SHP-001',date:'Apr 13',status:'Paid'},
  {id:'tx3',walletId:'w2',amount:2800000,type:'DEBIT',method:'Mobile Money',description:'Freight SHP-2025-002',date:'Apr 11',status:'Paid'},
  {id:'tx4',walletId:'w2',amount:4200000,type:'CREDIT',method:'Mobile Money',description:'Import duty DAR',date:'Apr 20',status:'Pending'},
  {id:'tx5',walletId:'w3',amount:6200000,type:'DEBIT',method:'Bank Transfer',description:'Freight SHP-2025-003',date:'Apr 22',status:'Paid'},
  {id:'tx6',walletId:'w3',amount:8900000,type:'CREDIT',method:'Bank Transfer',description:'Customs duty ZNZ',date:'Apr 28',status:'Pending'},
  {id:'tx7',walletId:'w4',amount:8500000,type:'DEBIT',method:'Card',description:'Express freight SHP-004',date:'May 2',status:'Paid'},
  {id:'tx8',walletId:'w4',amount:15200000,type:'CREDIT',method:'Card',description:'Import duty + dispute SHP-004',date:'May 8',status:'Overdue'},
  {id:'tx9',walletId:'w1',amount:3200000,type:'DEBIT',method:'Mobile Money',description:'Storage fees Apr',date:'Apr 15',status:'Paid'},
  {id:'tx10',walletId:'w2',amount:1800000,type:'DEBIT',method:'Cash',description:'Last mile delivery',date:'Apr 18',status:'Paid'},
];
const deliveries: Delivery[] = [
  {id:'d1',shipmentId:'s1',driver:'Hassan Juma',phone:'+255 713 456 789',vehicle:'KBR 1234 (Isuzu)',status:'DELIVERED',address:'Plot 45, Kariakoo, Dar es Salaam',started:'Apr 14 08:00',delivered:'Apr 14 16:45',recipient:'James Mwakasege'},
  {id:'d2',shipmentId:'s6',driver:'Peter Omari',phone:'+255 714 567 890',vehicle:'KCR 5678 (Toyota)',status:'OUT_FOR_DELIVERY',address:'12 Masaki Road, Oysterbay',started:'May 1 09:30'},
  {id:'d3',shipmentId:'s3',driver:'David Kimaro',phone:'+255 715 678 901',vehicle:'KDR 9012 (Fuso)',status:'ASSIGNED',address:'Mikocheni Industrial Area',started:'Apr 28 10:00'},
  {id:'d4',shipmentId:'s2',driver:'Ali Hassan',phone:'+255 716 789 012',vehicle:'KER 3456 (Tata)',status:'FAILED',address:'Mzizima Towers, Upanga',started:'Apr 24 14:00',delivered:'Apr 24 18:00'},
];

/* ─── CHART DATA ─── */
const monthlyRevenue = [{month:'Jan',revenue:28000,cost:22000},{month:'Feb',revenue:35000,cost:27000},{month:'Mar',revenue:42000,cost:33000},{month:'Apr',revenue:148000,cost:105000},{month:'May',revenue:85000,cost:62000}];
const monthlyShipments = [{month:'Jan',volume:4,onTime:3},{month:'Feb',volume:5,onTime:4},{month:'Mar',volume:6,onTime:5},{month:'Apr',volume:8,onTime:6},{month:'May',volume:6,onTime:4}];
const statusDistribution = [{name:'Delivered',value:1,color:'#10b981'},{name:'In Transit',value:1,color:'#6366f1'},{name:'At Customs',value:2,color:'#f59e0b'},{name:'At Origin',value:1,color:'#3b82f6'},{name:'At Destination',value:1,color:'#06b6d4'}];
const topCustomers = [{name:'Nuru Enterprises',value:85000,cost:61000},{name:'Bongo Foods',value:62000,cost:48000},{name:'KOBEPay Tech',value:45000,cost:32000},{name:'Diamond Imports',value:38000,cost:27500},{name:'Safari Logistics',value:28000,cost:19500},{name:'Mwangala Traders',value:15000,cost:11200}];
const routeEfficiency = [{route:'CAN→DAR (ET)',ontime:78,cost:8.5,volume:3},{route:'CAN→DAR (QR)',ontime:85,cost:12.0,volume:2},{route:'HKG→ZNZ (ET)',ontime:72,cost:7.8,volume:1},{route:'SZX→DAR (QR)',ontime:65,cost:11.2,volume:1}];
const costBreakdown = [{category:'Freight',amount:85000},{category:'Customs Duty',amount:42100},{category:'Storage',amount:12500},{category:'Insurance',amount:8200},{category:'Documentation',amount:5400},{category:'Last Mile',amount:7300},{category:'Fuel Surcharge',amount:11200}];
const carrierPerformance = [{carrier:'Ethiopian Airlines',ontime:75,satisfaction:82,volume:3,costEfficiency:88},{carrier:'Qatar Airways',ontime:85,satisfaction:91,volume:2,costEfficiency:72}];

/* ─── HELPERS ─── */
const tzs = (n:number) => `TZS ${n.toLocaleString()}`;
const usd = (n:number) => `$${n.toLocaleString()}`;
const sc: Record<string, string> = {
  DRAFT:'bg-gray-500/15 text-gray-400',ORIGIN:'bg-blue-500/15 text-blue-400',EXPORT_CUSTOMS:'bg-amber-500/15 text-amber-400',IN_TRANSIT:'bg-indigo-500/15 text-indigo-400',ARRIVED:'bg-violet-500/15 text-violet-400',IMPORT_CUSTOMS:'bg-orange-500/15 text-orange-400',DESTINATION:'bg-cyan-500/15 text-cyan-400',OUT_FOR_DELIVERY:'bg-pink-500/15 text-pink-400',DELIVERED:'bg-emerald-500/15 text-emerald-400',CANCELLED:'bg-red-500/15 text-red-400',
  STANDARD:'bg-blue-500/15 text-blue-400',EXPRESS:'bg-amber-500/15 text-amber-400',URGENT:'bg-red-500/15 text-red-400',
  CLEARED:'bg-emerald-500/15 text-emerald-400',PENDING_DOCS:'bg-amber-500/15 text-amber-400',INSPECTION_TRIGGERED:'bg-orange-500/15 text-orange-400',HELD:'bg-red-500/15 text-red-400',
  'TAX_DISPUTE':'bg-red-500/20 text-red-400',
  Paid:'bg-emerald-500/15 text-emerald-400',Pending:'bg-amber-500/15 text-amber-400',Overdue:'bg-red-500/15 text-red-400',
  GREEN:'bg-emerald-500/15 text-emerald-400',YELLOW:'bg-amber-500/15 text-amber-400',RED:'bg-red-500/15 text-red-400',
  ASSIGNED:'bg-blue-500/15 text-blue-400',PICKED_UP:'bg-indigo-500/15 text-indigo-400','IN_TRANSIT_L':'bg-violet-500/15 text-violet-400',OUT_FOR_DELIVERY_L:'bg-pink-500/15 text-pink-400',DELIVERED_L:'bg-emerald-500/15 text-emerald-400',FAILED:'bg-red-500/15 text-red-400',
  SCHEDULED:'bg-blue-500/15 text-blue-400',BOARDING:'bg-amber-500/15 text-amber-400',IN_FLIGHT:'bg-indigo-500/15 text-indigo-400',ARRIVED_F:'bg-emerald-500/15 text-emerald-400',DELAYED:'bg-orange-500/15 text-orange-400',CANCELLED_F:'bg-red-500/15 text-red-400',
  WAITING:'bg-blue-500/15 text-blue-400',LOADING:'bg-amber-500/15 text-amber-400',LOADED:'bg-emerald-500/15 text-emerald-400',UNLOADED:'bg-cyan-500/15 text-cyan-400',ASSEMBLING:'bg-blue-500/15 text-blue-400',SEALED:'bg-emerald-500/15 text-emerald-400',
  RECEIVED:'bg-blue-500/15 text-blue-400',WEIGHED:'bg-amber-500/15 text-amber-400',IN_BIN:'bg-indigo-500/15 text-indigo-400',IN_ULD:'bg-violet-500/15 text-violet-400',ON_FLIGHT:'bg-pink-500/15 text-pink-400',AT_DESTINATION:'bg-cyan-500/15 text-cyan-400',
};
const SB = ({ s }: { s: string }) => <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border border-white/[0.06] ${sc[s] || 'bg-gray-500/15 text-gray-400'}`}>{s.replace(/_/g, ' ')}</span>;
const KC = ({ t, v, su, i: I, c = 'blue' }: { t: string; v: string; su?: string; i: any; c?: string }) => {
  const m: Record<string, string> = { blue: 'text-blue-400', emerald: 'text-emerald-400', amber: 'text-amber-400', red: 'text-red-400', indigo: 'text-indigo-400', violet: 'text-violet-400', cyan: 'text-cyan-400', pink: 'text-pink-400' };
  return <Card className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-3"><div className="flex items-start justify-between mb-2"><span className="text-[10px] text-white/40 font-medium">{t}</span><I className={`w-4 h-4 ${m[c] || 'text-white/40'}`} /></div><div className="text-sm font-semibold text-white/90">{v}</div>{su && <div className="text-[10px] text-white/30 mt-0.5">{su}</div>}</CardContent></Card>;
};
/* ─── SPARKLINE (tiny inline SVG) ─── */
function Sparkline({ data, color = '#10b981', height = 24 }: { data: number[]; color?: string; height?: number }) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 60;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${height - ((v - min) / range) * (height - 2) - 1}`).join(' ');
  const last = data[data.length - 1];
  const prev = data[data.length - 2] || last;
  const trend = last > prev ? 'up' : last < prev ? 'down' : 'flat';
  return (
    <div className="flex items-center gap-1.5">
      <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`} className="opacity-70">
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={w} cy={height - ((last - min) / range) * (height - 2) - 1} r="2" fill={color} />
      </svg>
      {trend === 'up' && <ArrowUpRight className="w-3 h-3 text-emerald-400" />}
      {trend === 'down' && <ArrowDownRight className="w-3 h-3 text-red-400" />}
      {trend === 'flat' && <Minus className="w-3 h-3 text-amber-400" />}
    </div>
  );
}

/* ─── CHART TOOLTIP ─── */
function CTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a2e] border border-white/[0.1] rounded-lg px-3 py-2 shadow-xl">
      <p className="text-[10px] text-white/50 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-[11px] font-medium" style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' && p.value > 1000 ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  );
}

/* ─── AI PREDICTION ENGINE ─── */
function predictETA(shipment: Shipment): { predicted: string; confidence: number; delayDays: number; risk: string } {
  const cc = customsData[shipment.id];
  let delayDays = 0;
  let risk = 'low';
  // Base risk from customs
  if (cc) {
    if (cc.import.riskScore > 65 || cc.export.riskScore > 65) { delayDays += 3; risk = 'high'; }
    else if (cc.import.riskScore > 35 || cc.export.riskScore > 35) { delayDays += 1; risk = 'medium'; }
    if (cc.import.inspection || cc.export.inspection) { delayDays += 2; risk = 'high'; }
    if (cc.import.taxDispute) { delayDays += 4; risk = 'critical'; }
  }
  // Priority factor
  if (shipment.priority === 'URGENT') delayDays = Math.max(0, delayDays - 1);
  if (shipment.priority === 'EXPRESS') delayDays = Math.max(0, delayDays - 0.5);
  // Weight factor (heavy = more inspection probability)
  if (shipment.actualWeight > 1000) delayDays += 0.5;
  const confidence = Math.max(40, 95 - delayDays * 8);
  const etaDate = new Date('2025-' + shipment.eta.replace('Apr ', '04-').replace('May ', '05-'));
  etaDate.setDate(etaDate.getDate() + Math.round(delayDays));
  const predicted = etaDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return { predicted, confidence: Math.round(confidence), delayDays: Math.round(delayDays * 10) / 10, risk };
}

/* ─── AD SERVER NETWORK DATA ─── */
const advertisers: Advertiser[] = [
  {id:'adv1',name:'Juma Transport Ltd',email:'juma@transport.co.tz',phone:'+255 713 111 222',company:'Juma Transport',logo:'JT',status:'active',totalSpent:2850000,adCount:3,joined:'Mar 2025'},
  {id:'adv2',name:'Mikocheni Cold Storage',email:'info@mikocheni.co.tz',phone:'+255 714 333 444',company:'Mikocheni Cold Storage',logo:'MC',status:'active',totalSpent:1200000,adCount:2,joined:'Apr 2025'},
  {id:'adv3',name:'Diamond Trust Insurance',email:'ads@dti.co.tz',phone:'+255 715 555 666',company:'Diamond Trust Insurance',logo:'DT',status:'active',totalSpent:4200000,adCount:4,joined:'Feb 2025'},
  {id:'adv4',name:'Kariakoo Electronics',email:'sales@kariakoo.co.tz',phone:'+255 716 777 888',company:'Kariakoo Electronics',logo:'KE',status:'pending',totalSpent:0,adCount:1,joined:'May 2025'},
  {id:'adv5',name:'FastLane Logistics',email:'biz@fastlane.co.tz',phone:'+255 717 999 000',company:'FastLane Logistics',logo:'FL',status:'active',totalSpent:1800000,adCount:2,joined:'Jan 2025'},
];
const ads: Ad[] = [
  {id:'ad1',title:'Fuel Discount — 10% Off',type:'image',mediaUrl:'/ads/fuel-discount.jpg',advertiserId:'adv1',status:'running',targetLocations:['DAR_WAREHOUSE','ZNZ_PORT'],targetDevices:['kiosk','dashboard'],startDate:'May 1',endDate:'May 31',priority:2,impressions:12450,clicks:342,budget:500000,spend:320000,cpm:25.7,ctr:2.75},
  {id:'ad2',title:'Cold Storage — Free First Month',type:'video',mediaUrl:'/ads/cold-storage.mp4',advertiserId:'adv2',status:'running',targetLocations:['DAR_WAREHOUSE','CUSTOMS_HALL'],targetDevices:['kiosk','idle_screen'],startDate:'May 5',endDate:'Jun 5',priority:1,impressions:8900,clicks:218,budget:800000,spend:280000,cpm:31.5,ctr:2.45},
  {id:'ad3',title:'Cargo Insurance — Full Coverage',type:'image',mediaUrl:'/ads/insurance.jpg',advertiserId:'adv3',status:'approved',targetLocations:['ALL_LOCATIONS'],targetDevices:['dashboard','mobile'],startDate:'May 10',endDate:'Jun 10',priority:3,impressions:0,clicks:0,budget:1200000,spend:0,cpm:35.0,ctr:0},
  {id:'ad4',title:'Samsung Galaxy — Wholesale Price',type:'carousel',mediaUrl:'/ads/samsung.jpg',advertiserId:'adv4',status:'pending',targetLocations:['DAR_WAREHOUSE'],targetDevices:['kiosk'],startDate:'May 15',endDate:'Jun 15',priority:1,impressions:0,clicks:0,budget:300000,spend:0,cpm:20.0,ctr:0},
  {id:'ad5',title:'Express Delivery — Same Day in DSM',type:'text',mediaUrl:'/ads/express-text.jpg',advertiserId:'adv5',status:'running',targetLocations:['DAR_WAREHOUSE','CUSTOMS_HALL'],targetDevices:['dashboard'],startDate:'May 1',endDate:'May 20',priority:2,impressions:15600,clicks:512,budget:600000,spend:450000,cpm:28.8,ctr:3.28},
  {id:'ad6',title:'Warehousing — Secure Storage',type:'image',mediaUrl:'/ads/warehouse.jpg',advertiserId:'adv1',status:'expired',targetLocations:['DAR_WAREHOUSE'],targetDevices:['idle_screen'],startDate:'Apr 1',endDate:'Apr 30',priority:1,impressions:22100,clicks:678,budget:700000,spend:700000,cpm:31.7,ctr:3.07},
  {id:'ad7',title:'Vehicle Tracking — GPS Solutions',type:'video',mediaUrl:'/ads/gps-tracking.mp4',advertiserId:'adv3',status:'rejected',targetLocations:['ALL_LOCATIONS'],targetDevices:['kiosk','dashboard'],startDate:'May 1',endDate:'May 30',priority:1,impressions:0,clicks:0,budget:900000,spend:0,cpm:0,ctr:0},
  {id:'ad8',title:'Last Mile — We Deliver Fast',type:'image',mediaUrl:'/ads/lastmile.jpg',advertiserId:'adv5',status:'paused',targetLocations:['ZNZ_PORT'],targetDevices:['kiosk'],startDate:'Apr 15',endDate:'May 15',priority:1,impressions:5400,clicks:89,budget:400000,spend:120000,cpm:22.2,ctr:1.65},
];
const campaigns: Campaign[] = [
  {id:'camp1',name:'May Warehouse Promo',advertiserId:'adv1',status:'active',startDate:'May 1',endDate:'May 31',budget:500000,spend:320000,impressions:12450,clicks:342,conversions:28,targetAudience:'warehouse_visitors',placement:['DAR_WAREHOUSE','ZNZ_PORT']},
  {id:'camp2',name:'Cold Storage Launch',advertiserId:'adv2',status:'active',startDate:'May 5',endDate:'Jun 5',budget:800000,spend:280000,impressions:8900,clicks:218,conversions:15,targetAudience:'importers',placement:['DAR_WAREHOUSE','CUSTOMS_HALL']},
  {id:'camp3',name:'Insurance Q2 Push',advertiserId:'adv3',status:'active',startDate:'May 10',endDate:'Jun 10',budget:1200000,spend:0,impressions:0,clicks:0,conversions:0,targetAudience:'all_shippers',placement:['ALL_LOCATIONS']},
  {id:'camp4',name:'Electronics Wholesale',advertiserId:'adv4',status:'draft',startDate:'May 15',endDate:'Jun 15',budget:300000,spend:0,impressions:0,clicks:0,conversions:0,targetAudience:'electronics_importers',placement:['DAR_WAREHOUSE']},
  {id:'camp5',name:'Express May Sprint',advertiserId:'adv5',status:'active',startDate:'May 1',endDate:'May 20',budget:600000,spend:450000,impressions:15600,clicks:512,conversions:41,targetAudience:'urgent_shippers',placement:['DAR_WAREHOUSE','CUSTOMS_HALL']},
  {id:'camp6',name:'April Storage Campaign',advertiserId:'adv1',status:'ended',startDate:'Apr 1',endDate:'Apr 30',budget:700000,spend:700000,impressions:22100,clicks:678,conversions:52,targetAudience:'warehouse_visitors',placement:['DAR_WAREHOUSE']},
];
const pricingTiers: AdPricingTier[] = [
  {id:'pt1',name:'Warehouse Premium',location:'DAR_WAREHOUSE',cpm:35,minBudget:200000,description:'Prime placement in warehouse kiosk screens'},
  {id:'pt2',name:'Customs Hall',location:'CUSTOMS_HALL',cpm:42,minBudget:300000,description:'High-visibility ads in customs clearance area'},
  {id:'pt3',name:'Port Standard',location:'ZNZ_PORT',cpm:28,minBudget:150000,description:'Standard rotation at Zanzibar port'},
  {id:'pt4',name:'Network Wide',location:'ALL_LOCATIONS',cpm:22,minBudget:500000,description:'Display across all KOBECARGO screens'},
  {id:'pt5',name:'Idle Screen Takeover',location:'ALL_LOCATIONS',cpm:55,minBudget:400000,description:'Full-screen ads during idle kiosk mode'},
  {id:'pt6',name:'Mobile Dashboard',location:'ALL_LOCATIONS',cpm:18,minBudget:100000,description:'Ads in user dashboard (mobile + desktop)'},
];
const adMonthlyImpressions = [
  {month:'Jan',impressions:8200,clicks:185,revenue:520000},
  {month:'Feb',impressions:11500,clicks:290,revenue:780000},
  {month:'Mar',impressions:9800,clicks:245,revenue:650000},
  {month:'Apr',impressions:22100,clicks:678,revenue:1400000},
  {month:'May',impressions:36950,clicks:1072,revenue:2200000},
];

function generateAIInsights(): AIInsight[] {
  const insights: AIInsight[] = [];
  shipments.forEach(s => {
    const pred = predictETA(s);
    const cc = customsData[s.id];
    if (pred.risk === 'high' || pred.risk === 'critical') {
      insights.push({ id: `ai-risk-${s.id}`, type: 'RISK', confidence: pred.confidence, title: `${s.number} — Delay Risk: ${pred.risk.toUpperCase()}`, description: `Predicted delay of ${pred.delayDays} days. ${cc?.import.taxDispute ? 'Tax dispute blocking clearance.' : cc?.import.inspection ? 'Customs inspection in progress.' : 'High risk score on customs lane.'}`, shipmentId: s.id, severity: 'critical' });
    }
    if (s.priority === 'URGENT' && s.status !== 'DELIVERED' && pred.delayDays > 0) {
      insights.push({ id: `ai-rec-${s.id}`, type: 'RECOMMENDATION', confidence: 82, title: `Reroute Recommendation: ${s.number}`, description: `Consider expedited clearance at ${s.destination}. Estimated cost: $${(pred.delayDays * 1200).toFixed(0)}`, shipmentId: s.id, severity: 'warning' });
    }
    // Cost anomaly detection
    const margin = ((s.value - s.cost) / s.value) * 100;
    if (margin < 25) {
      insights.push({ id: `ai-ano-${s.id}`, type: 'ANOMALY', confidence: 78, title: `Low Margin Alert: ${s.number}`, description: `Profit margin ${margin.toFixed(1)}% below 25% threshold. Review freight costs.`, shipmentId: s.id, severity: 'warning' });
    }
  });
  // Flight delay prediction
  flights.filter(f => f.status === 'DELAYED').forEach(f => {
    insights.push({ id: `ai-flt-${f.id}`, type: 'PREDICTION', confidence: 88, title: `${f.number} Delay Cascade Predicted`, description: `Estimated 2-3 day ripple effect on connected shipments. Consider ET alternative via ADD.`, severity: 'warning' });
  });
  // Optimization
  const avgMargin = shipments.reduce((s, sh) => s + ((sh.value - sh.cost) / sh.value) * 100, 0) / shipments.length;
  insights.push({ id: `ai-opt-1`, type: 'OPTIMIZATION', confidence: 91, title: 'Route Optimization Opportunity', description: `Switching CAN→DAR from QR to ET could reduce freight costs by 18% ($8,420/quarter).`, severity: 'info' });
  insights.push({ id: `ai-opt-2`, type: 'OPTIMIZATION', confidence: 85, title: `Portfolio Margin: ${avgMargin.toFixed(1)}%`, description: avgMargin > 30 ? 'Healthy margins. Consider volume expansion on profitable routes.' : 'Margins compressed. Renegotiate carrier rates or adjust pricing.', severity: avgMargin > 30 ? 'info' : 'warning' });
  return insights;
}

/* ─── HEALTH SCORE ─── */
function calculateHealthScore(): number {
  let score = 100;
  // Deduct for customs risks
  Object.values(customsData).forEach(c => {
    if (c.import.riskScore > 65 || c.export.riskScore > 65) score -= 8;
    else if (c.import.riskScore > 35 || c.export.riskScore > 35) score -= 3;
    if (c.import.inspection || c.export.inspection) score -= 5;
    if (c.import.taxDispute) score -= 10;
  });
  // Deduct for payment issues
  const overdueRate = transactions.filter(t => t.status === 'Overdue').length / transactions.length;
  score -= Math.round(overdueRate * 15);
  // Deduct for flight delays
  flights.filter(f => f.status === 'DELAYED').forEach(() => score -= 5);
  // Deduct for delivery failures
  deliveries.filter(d => d.status === 'FAILED').forEach(() => score -= 8);
  return Math.max(0, Math.min(100, score));
}

/* ─── ALERTS GENERATOR ─── */
function generateAlerts(): AlertItem[] {
  const alerts: AlertItem[] = [];
  Object.entries(customsData).forEach(([sid, c]) => {
    const s = shipments.find(sh => sh.id === sid);
    if (!s) return;
    if (c.export.riskScore > 65) alerts.push({ id: `a-exp-${sid}`, type: 'CUSTOMS_RISK', severity: 'critical', title: 'High Export Risk', message: `${s.number} flagged ${c.export.riskScore}% risk at ${c.export.portCode}`, entityId: sid, entityType: 'shipment', timestamp: '2h ago' });
    if (c.import.riskScore > 65) alerts.push({ id: `a-imp-${sid}`, type: 'CUSTOMS_RISK', severity: 'critical', title: 'High Import Risk', message: `${s.number} flagged ${c.import.riskScore}% risk at ${c.import.portCode}`, entityId: sid, entityType: 'shipment', timestamp: '1h ago' });
    if (c.export.inspection) alerts.push({ id: `a-insp-exp-${sid}`, type: 'INSPECTION', severity: 'warning', title: 'Export Inspection', message: `${s.number} inspection at ${c.export.portCode}`, entityId: sid, entityType: 'shipment', timestamp: '3h ago' });
    if (c.import.inspection) alerts.push({ id: `a-insp-imp-${sid}`, type: 'INSPECTION', severity: 'warning', title: 'Import Inspection', message: `${s.number} inspection at ${c.import.portCode}`, entityId: sid, entityType: 'shipment', timestamp: '5h ago' });
    if (c.import.taxDispute) alerts.push({ id: `a-tax-${sid}`, type: 'TAX_DISPUTE', severity: 'critical', title: 'Tax Dispute', message: `${s.number} unresolved — ${usd(c.import.dutiesEstimated)}`, entityId: sid, entityType: 'shipment', timestamp: '1d ago' });
  });
  transactions.filter(tx => tx.status === 'Overdue').forEach(tx => {
    const w = wallets.find(wa => wa.id === tx.walletId);
    alerts.push({ id: `a-pay-${tx.id}`, type: 'PAYMENT_OVERDUE', severity: 'warning', title: 'Overdue Payment', message: `${w?.customer || 'Unknown'} — ${tx.description}: ${tzs(tx.amount)}`, entityId: tx.walletId, entityType: 'wallet', timestamp: '2d ago' });
  });
  flights.filter(f => f.status === 'DELAYED').forEach(f => {
    alerts.push({ id: `a-flt-${f.id}`, type: 'FLIGHT_DELAYED', severity: 'warning', title: 'Flight Delayed', message: `${f.number} ${f.origin}→${f.destination} — rebooking needed`, entityId: f.id, entityType: 'flight', timestamp: '6h ago' });
  });
  deliveries.filter(d => d.status === 'FAILED').forEach(d => {
    const s = shipments.find(sh => sh.id === d.shipmentId);
    alerts.push({ id: `a-del-${d.id}`, type: 'DELIVERY_FAILED', severity: 'critical', title: 'Delivery Failed', message: `${s?.number || d.shipmentId} — ${d.driver} failed at ${d.address}`, entityId: d.id, entityType: 'delivery', timestamp: '3d ago' });
  });
  // AI-generated alerts
  const insights = generateAIInsights();
  insights.filter(i => i.type === 'RISK' && i.severity === 'critical').forEach(i => {
    alerts.push({ id: `a-ai-${i.id}`, type: 'ANOMALY', severity: 'critical', title: i.title, message: i.description, entityId: i.shipmentId || '', entityType: 'shipment', timestamp: 'Just now', action: 'Review' });
  });
  return alerts;
}

/* ─── ACTIVITY FEED GENERATOR ─── */
function generateActivityFeed() {
  return [
    { id: 'act1', type: 'customs', message: 'SHP-2025-004 export inspection triggered at CAN', time: '8 min ago', icon: ShieldCheck, color: 'text-amber-400' },
    { id: 'act2', type: 'flight', message: 'ET607 departed CAN — 2 ULDs, 3,200kg', time: '15 min ago', icon: Plane, color: 'text-indigo-400' },
    { id: 'act3', type: 'payment', message: 'Payment overdue: Nuru Enterprises — TZS 15,200,000', time: '32 min ago', icon: DollarSign, color: 'text-red-400' },
    { id: 'act4', type: 'delivery', message: 'SHP-2025-001 delivered — signed by James Mwakasege', time: '1 hr ago', icon: CheckCircle2, color: 'text-emerald-400' },
    { id: 'act5', type: 'ai', message: 'AI: Route optimization could save $8,420/quarter', time: '2 hr ago', icon: Sparkles, color: 'text-violet-400' },
    { id: 'act6', type: 'warehouse', message: 'BIN-004 assembled: 2 pkgs, 1,270kg → ET631', time: '3 hr ago', icon: Warehouse, color: 'text-blue-400' },
    { id: 'act7', type: 'customs', message: 'SHP-2025-002 import lane changed: GREEN → YELLOW', time: '4 hr ago', icon: AlertTriangle, color: 'text-orange-400' },
    { id: 'act8', type: 'tracking', message: 'QR875 arrived DOH transit hub — on schedule', time: '5 hr ago', icon: MapPin, color: 'text-cyan-400' },
  ];
}


/* ─── EXECUTIVE COMMAND DASHBOARD ─── */
function CommandDashboard() {
  const healthScore = calculateHealthScore();
  const active = shipments.filter(s => s.status !== 'DELIVERED' && s.status !== 'CANCELLED').length;
  const inTransit = shipments.filter(s => s.status === 'IN_TRANSIT' || s.status === 'ARRIVED').length;
  const revenue = shipments.reduce((s, sh) => s + sh.value, 0);
  const totalCost = shipments.reduce((s, sh) => s + sh.cost, 0);
  const margin = ((revenue - totalCost) / revenue * 100).toFixed(1);
  const activities = generateActivityFeed();
  const insights = generateAIInsights();
  const criticalInsights = insights.filter(i => i.severity === 'critical');

  // Sparkline data
  const revenueSpark = monthlyRevenue.map(m => m.revenue);
  const volumeSpark = monthlyShipments.map(m => m.volume);
  const onTimeSpark = monthlyShipments.map(m => (m.onTime / m.volume) * 100);

  return <div className="h-full overflow-y-auto"><div className="p-4 space-y-4">
    {/* Top Bar: Health Score + AI Insights Summary */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      {/* Health Score Gauge */}
      <Card className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="relative w-16 h-16 shrink-0">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={healthScore > 80 ? '#10b981' : healthScore > 50 ? '#f59e0b' : '#ef4444'} strokeWidth="3" strokeDasharray={`${healthScore}, 100`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-sm font-bold ${healthScore > 80 ? 'text-emerald-400' : healthScore > 50 ? 'text-amber-400' : 'text-red-400'}`}>{healthScore}</span>
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-white/80">System Health</div>
            <div className="text-[10px] text-white/40">{healthScore > 80 ? 'All systems operational' : healthScore > 50 ? `${criticalInsights.length} issues requiring attention` : 'Critical issues detected'}</div>
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/><span className="text-[9px] text-white/30">Live</span></div>
              <div className="text-[9px] text-white/20">6 shipments tracked</div>
            </div>
          </div>
        </div>
      </CardContent></Card>
      {/* AI Quick Insights */}
      <Card className="bg-gradient-to-br from-indigo-500/[0.08] to-violet-500/[0.05] border-indigo-500/15 lg:col-span-2"><CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2"><BrainCircuit className="w-4 h-4 text-indigo-400"/><span className="text-xs font-medium text-indigo-300">AI Insights</span><span className="text-[9px] text-white/20 ml-auto">{insights.length} active</span></div>
        <div className="space-y-1.5 max-h-[72px] overflow-hidden">
          {insights.slice(0, 3).map(i => (
            <div key={i.id} className="flex items-start gap-2 text-[10px]">
              {i.severity === 'critical' ? <AlertTriangle className="w-3 h-3 text-red-400 mt-0.5 shrink-0"/> : <Sparkles className="w-3 h-3 text-indigo-400 mt-0.5 shrink-0"/>}
              <span className="text-white/60">{i.title}</span>
              <span className="text-white/20 ml-auto shrink-0">{i.confidence}% conf</span>
            </div>
          ))}
        </div>
      </CardContent></Card>
    </div>

    {/* KPI Row with Sparklines */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Card className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-3">
        <div className="flex items-start justify-between mb-1"><span className="text-[10px] text-white/40">Active Shipments</span><Package className="w-4 h-4 text-blue-400"/></div>
        <div className="text-xl font-bold text-white/90">{active}</div>
        <div className="flex items-center justify-between mt-1"><Sparkline data={volumeSpark} color="#3b82f6"/><span className="text-[9px] text-white/25">of {shipments.length} total</span></div>
      </CardContent></Card>
      <Card className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-3">
        <div className="flex items-start justify-between mb-1"><span className="text-[10px] text-white/40">In Transit</span><Plane className="w-4 h-4 text-indigo-400"/></div>
        <div className="text-xl font-bold text-white/90">{inTransit}</div>
        <div className="flex items-center justify-between mt-1"><span className="text-[10px] text-indigo-400">en route</span><span className="text-[9px] text-white/25">{flights.filter(f => f.status === 'IN_FLIGHT').length} flights</span></div>
      </CardContent></Card>
      <Card className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-3">
        <div className="flex items-start justify-between mb-1"><span className="text-[10px] text-white/40">Revenue (YTD)</span><DollarSign className="w-4 h-4 text-emerald-400"/></div>
        <div className="text-xl font-bold text-emerald-400">{usd(revenue)}</div>
        <div className="flex items-center justify-between mt-1"><Sparkline data={revenueSpark} color="#10b981"/><span className="text-[9px] text-emerald-400/60">{margin}% margin</span></div>
      </CardContent></Card>
      <Card className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-3">
        <div className="flex items-start justify-between mb-1"><span className="text-[10px] text-white/40">On-Time %</span><Target className="w-4 h-4 text-amber-400"/></div>
        <div className="text-xl font-bold text-white/90">{Math.round(onTimeSpark[onTimeSpark.length - 1])}%</div>
        <div className="flex items-center justify-between mt-1"><Sparkline data={onTimeSpark} color="#f59e0b" height={20}/><span className="text-[9px] text-white/25">last 30d</span></div>
      </CardContent></Card>
    </div>

    {/* Charts Row */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <Card className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-4">
        <h3 className="text-xs font-medium text-white/70 mb-3 flex items-center gap-2"><TrendingUp className="w-3.5 h-3.5 text-emerald-400"/>Revenue vs Cost</h3>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={monthlyRevenue}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
            <XAxis dataKey="month" tick={{fill:'rgba(255,255,255,0.4)',fontSize:11}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:'rgba(255,255,255,0.4)',fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/>
            <Tooltip content={<CTooltip/>}/>
            <Legend iconType="circle" iconSize={8} formatter={(v:string)=><span className="text-[10px] text-white/50">{v}</span>}/>
            <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4,4,0,0]}/>
            <Bar dataKey="cost" name="Cost" fill="#ef4444" radius={[4,4,0,0]}/>
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent></Card>
      <Card className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-4">
        <h3 className="text-xs font-medium text-white/70 mb-3 flex items-center gap-2"><CircleDot className="w-3.5 h-3.5 text-indigo-400"/>Shipment Status</h3>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={statusDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
              {statusDistribution.map((entry,idx)=><Cell key={idx} fill={entry.color}/>)}
            </Pie>
            <Tooltip content={<CTooltip/>}/>
            <Legend iconType="circle" iconSize={8} formatter={(value:string)=><span className="text-[10px] text-white/50">{value}</span>}/>
          </PieChart>
        </ResponsiveContainer>
      </CardContent></Card>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <Card className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-4">
        <h3 className="text-xs font-medium text-white/70 mb-3 flex items-center gap-2"><BarChart3 className="w-3.5 h-3.5 text-blue-400"/>Volume vs On-Time Performance</h3>
        <ResponsiveContainer width="100%" height={180}>
          <ComposedChart data={monthlyShipments}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
            <XAxis dataKey="month" tick={{fill:'rgba(255,255,255,0.4)',fontSize:11}} axisLine={false} tickLine={false}/>
            <YAxis yAxisId="left" tick={{fill:'rgba(255,255,255,0.4)',fontSize:11}} axisLine={false} tickLine={false}/>
            <YAxis yAxisId="right" orientation="right" tick={{fill:'rgba(255,255,255,0.4)',fontSize:11}} axisLine={false} tickLine={false} domain={[0,100]} tickFormatter={v=>`${v}%`}/>
            <Tooltip content={<CTooltip/>}/>
            <Legend iconType="circle" iconSize={8} formatter={(v:string)=><span className="text-[10px] text-white/50">{v}</span>}/>
            <Bar yAxisId="left" dataKey="volume" name="Shipments" fill="#3b82f6" radius={[4,4,0,0]}/>
            <Line yAxisId="right" type="monotone" dataKey="onTime" name="On-Time %" stroke="#10b981" strokeWidth={2} dot={{r:3,fill:'#10b981'}}/>
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent></Card>
      <Card className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-4">
        <h3 className="text-xs font-medium text-white/70 mb-3 flex items-center gap-2"><DollarSign className="w-3.5 h-3.5 text-amber-400"/>Top Customers by Profit</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={topCustomers.map(c => ({...c, profit: c.value - c.cost}))} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false}/>
            <XAxis type="number" tick={{fill:'rgba(255,255,255,0.4)',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/>
            <YAxis dataKey="name" type="category" width={100} tick={{fill:'rgba(255,255,255,0.5)',fontSize:10}} axisLine={false} tickLine={false}/>
            <Tooltip content={<CTooltip/>}/>
            <Bar dataKey="value" name="Revenue" fill="rgba(245,158,11,0.3)" radius={[0,4,4,0]}/>
            <Bar dataKey="profit" name="Profit" fill="#f59e0b" radius={[0,4,4,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </CardContent></Card>
    </div>

    {/* Pipeline + Activity Feed */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <Card className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-4">
        <h3 className="text-xs font-medium text-white/70 mb-3">Shipment Pipeline</h3>
        <div className="flex items-center gap-1">
          {['ORIGIN','EXPORT_CUSTOMS','IN_TRANSIT','IMPORT_CUSTOMS','OUT_FOR_DELIVERY','DELIVERED'].map((stage,idx)=>{
            const c = shipments.filter(s => s.status === stage).length;
            const colors = ['bg-blue-500','bg-amber-500','bg-indigo-500','bg-orange-500','bg-pink-500','bg-emerald-500'];
            return <div key={stage} className="flex-1 flex flex-col items-center relative">
              <div className={`w-7 h-7 rounded-full ${colors[idx]} flex items-center justify-center text-[10px] font-bold text-white mb-1 shadow-lg shadow-${colors[idx].replace('bg-','')}/20`}>{c}</div>
              <span className="text-[8px] text-white/30 text-center hidden sm:block leading-tight">{stage.replace(/_/g,' ')}</span>
              {idx < 5 && <ArrowRight className="w-3 h-3 text-white/15 absolute -right-1.5 top-2"/>}
            </div>;
          })}
        </div>
      </CardContent></Card>
      <Card className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-4">
        <h3 className="text-xs font-medium text-white/70 mb-3 flex items-center gap-2"><Activity className="w-3.5 h-3.5 text-violet-400"/>Live Activity</h3>
        <div className="space-y-2 max-h-[120px] overflow-hidden">
          {activities.map(a => (
            <div key={a.id} className="flex items-center gap-2">
              <a.icon className={`w-3 h-3 ${a.color} shrink-0`}/>
              <span className="text-[10px] text-white/50 flex-1 truncate">{a.message}</span>
              <span className="text-[9px] text-white/20 shrink-0">{a.time}</span>
            </div>
          ))}
        </div>
      </CardContent></Card>
    </div>

    {/* Customs Lanes + Payments */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Card className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-4">
        <h3 className="text-xs font-medium text-white/70 mb-3">Customs Lanes</h3>
        <div className="space-y-2">
          {[{label:'Green',count:3,color:'#10b981'},{label:'Yellow',count:2,color:'#f59e0b'},{label:'Red',count:1,color:'#ef4444'}].map(l=><div key={l.label}>
            <div className="flex items-center justify-between"><span className="text-[11px]" style={{color:l.color}}>{l.label}</span><span className="text-sm font-semibold" style={{color:l.color}}>{l.count}</span></div>
            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden"><div className="h-full rounded-full transition-all" style={{width:`${(l.count/6)*100}%`,backgroundColor:l.color}}/></div>
          </div>)}
        </div>
      </CardContent></Card>
      <Card className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-4">
        <h3 className="text-xs font-medium text-white/70 mb-3">Payments Summary</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/[0.05]"><span className="text-[11px] text-emerald-400">Collected</span><span className="text-sm font-semibold text-emerald-400">{tzs(34200000)}</span></div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-amber-500/[0.05]"><span className="text-[11px] text-amber-400">Pending</span><span className="text-sm font-semibold text-amber-400">{tzs(13100000)}</span></div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-red-500/[0.05]"><span className="text-[11px] text-red-400">Overdue</span><span className="text-sm font-semibold text-red-400">{tzs(15200000)}</span></div>
        </div>
      </CardContent></Card>
    </div>
  </div></div>;
}


/* ─── AI INSIGHTS ENGINE ─── */
function AIInsightsTab() {
  const [filter, setFilter] = useState<string>('ALL');
  const insights = generateAIInsights();
  const filtered = filter === 'ALL' ? insights : insights.filter(i => i.type === filter);
  const typeColors: Record<string, string> = { PREDICTION: 'text-blue-400 bg-blue-500/10 border-blue-500/20', RISK: 'text-red-400 bg-red-500/10 border-red-500/20', RECOMMENDATION: 'text-amber-400 bg-amber-500/10 border-amber-500/20', ANOMALY: 'text-orange-400 bg-orange-500/10 border-orange-500/20', OPTIMIZATION: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
  const typeIcons: Record<string, any> = { PREDICTION: Target, RISK: AlertTriangle, RECOMMENDATION: Zap, ANOMALY: AlertCircle, OPTIMIZATION: TrendingUp };

  return <div className="h-full overflow-y-auto"><div className="p-4 space-y-4">
    <Card className="bg-gradient-to-br from-indigo-500/[0.1] via-violet-500/[0.05] to-transparent border-indigo-500/20"><CardContent className="p-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center"><BrainCircuit className="w-5 h-5 text-indigo-400"/></div>
        <div><h2 className="text-sm font-semibold text-white/90">KOBECARGO Intelligence Engine</h2><p className="text-[10px] text-white/40">AI-powered predictions, risk analysis, and operational recommendations</p></div>
        <div className="ml-auto text-right"><div className="text-lg font-bold text-indigo-400">{insights.length}</div><div className="text-[9px] text-white/30">active insights</div></div>
      </div>
    </CardContent></Card>

    <div className="flex gap-1 overflow-x-auto scrollbar-hide">{['ALL','PREDICTION','RISK','RECOMMENDATION','ANOMALY','OPTIMIZATION'].map(f=>
      <button key={f} onClick={()=>setFilter(f)} className={`px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all border ${filter===f?'bg-indigo-500/15 text-indigo-400 border-indigo-500/20':'text-white/35 hover:text-white/50 border-transparent'}`}>{f==='ALL'?'All':f}</button>
    )}</div>

    <div className="space-y-2">
      {filtered.map(i => {
        const Icon = typeIcons[i.type] || Sparkles;
        const shipment = shipments.find(s => s.id === i.shipmentId);
        return <Card key={i.id} className={`border ${i.severity==='critical'?'bg-red-500/[0.03] border-red-500/15':'bg-white/[0.03] border-white/[0.06]'}`}><CardContent className="p-3">
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${typeColors[i.type]}`}><Icon className="w-4 h-4"/></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-medium text-white/80">{i.title}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${typeColors[i.type]}`}>{i.type}</span>
              </div>
              <p className="text-[11px] text-white/50 mb-1.5">{i.description}</p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1"><Gauge className="w-3 h-3 text-white/30"/><span className="text-[10px] text-white/30">{i.confidence}% confidence</span></div>
                {shipment && <span className="text-[10px] text-white/20">{shipment.number}</span>}
                {i.type === 'RISK' && <button className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors">Mitigate →</button>}
                {i.type === 'RECOMMENDATION' && <button className="text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors">Apply →</button>}
              </div>
            </div>
          </div>
        </CardContent></Card>;
      })}
    </div>

    {filtered.length === 0 && <div className="text-center text-[11px] text-white/30 py-8">No insights in this category</div>}
  </div></div>;
}

/* ─── ADVANCED ANALYTICS ─── */
function AnalyticsTab() {
  const [chartType, setChartType] = useState<'cost' | 'carrier' | 'route'>('cost');

  return <div className="h-full overflow-y-auto"><div className="p-4 space-y-4">
    <div className="flex gap-1">
      {[{k:'cost' as const,l:'Cost Breakdown',i:DollarSign},{k:'carrier' as const,l:'Carrier Performance',i:Plane},{k:'route' as const,l:'Route Efficiency',i:Route}].map(t=>
        <button key={t.k} onClick={()=>setChartType(t.k)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all border ${chartType===t.k?'bg-indigo-500/15 text-indigo-400 border-indigo-500/20':'text-white/40 hover:text-white/60 border-transparent'}`}><t.i className="w-3.5 h-3.5"/>{t.l}</button>
      )}
    </div>

    {chartType === 'cost' && <>
      <Card className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-4">
        <h3 className="text-xs font-medium text-white/70 mb-3">Cost Breakdown by Category</h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={costBreakdown} cx="50%" cy="50%" outerRadius={80} dataKey="amount" nameKey="category" label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`}>
              {costBreakdown.map((_,i)=> <Cell key={i} fill={['#6366f1','#10b981','#f59e0b','#ef4444','#06b6d4','#8b5cf6','#ec4899'][i]} />)}
            </Pie>
            <Tooltip content={<CTooltip/>}/>
          </PieChart>
        </ResponsiveContainer>
      </CardContent></Card>
      <Card className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-4">
        <h3 className="text-xs font-medium text-white/70 mb-3">Profit Margin by Shipment</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={shipments.map(s=>({name:s.number,margin:((s.value-s.cost)/s.value*100),value:s.value,profit:s.value-s.cost}))}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
            <XAxis dataKey="name" tick={{fill:'rgba(255,255,255,0.4)',fontSize:9}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:'rgba(255,255,255,0.4)',fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`}/>
            <Tooltip content={<CTooltip/>}/>
            <Bar dataKey="margin" name="Margin %" fill="#10b981" radius={[4,4,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </CardContent></Card>
    </>}

    {chartType === 'carrier' && <>
      <Card className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-4">
        <h3 className="text-xs font-medium text-white/70 mb-3">Carrier Scorecard</h3>
        <ResponsiveContainer width="100%" height={250}>
          <RadarChart data={[
            {metric:'On-Time %',et:75,qr:85},
            {metric:'Satisfaction',et:82,qr:91},
            {metric:'Volume',et:80,qr:60},
            {metric:'Cost Eff.',et:88,qr:72},
            {metric:'Reliability',et:78,qr:88},
          ]}>
            <PolarGrid stroke="rgba(255,255,255,0.06)"/>
            <PolarAngleAxis dataKey="metric" tick={{fill:'rgba(255,255,255,0.5)',fontSize:10}}/>
            <PolarRadiusAxis tick={{fill:'rgba(255,255,255,0.3)',fontSize:9}} domain={[0,100]}/>
            <RechartsRadar name="Ethiopian Airlines" dataKey="et" stroke="#6366f1" fill="#6366f1" fillOpacity={0.15}/>
            <RechartsRadar name="Qatar Airways" dataKey="qr" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15}/>
            <Legend iconType="circle" iconSize={8} formatter={(v:string)=><span className="text-[10px] text-white/50">{v}</span>}/>
          </RadarChart>
        </ResponsiveContainer>
      </CardContent></Card>
      <div className="grid grid-cols-2 gap-2">
        {carrierPerformance.map(c => <Card key={c.carrier} className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-3">
          <div className="text-xs font-medium text-white/80 mb-2">{c.carrier}</div>
          <div className="space-y-1.5">
            {[{l:'On-Time',v:c.ontime},{l:'Satisfaction',v:c.satisfaction},{l:'Cost Eff.',v:c.costEfficiency}].map(m=><div key={m.l}><div className="flex items-center justify-between text-[10px]"><span className="text-white/40">{m.l}</span><span className="text-white/60">{m.v}%</span></div><div className="h-1.5 rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-indigo-500" style={{width:`${m.v}%`}}/></div></div>)}
          </div>
        </CardContent></Card>)}
      </div>
    </>}

    {chartType === 'route' && <>
      <Card className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-4">
        <h3 className="text-xs font-medium text-white/70 mb-3">Route Efficiency Comparison</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={routeEfficiency}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
            <XAxis dataKey="route" tick={{fill:'rgba(255,255,255,0.4)',fontSize:9}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:'rgba(255,255,255,0.4)',fontSize:11}} axisLine={false} tickLine={false} domain={[0,100]}/>
            <Tooltip content={<CTooltip/>}/>
            <Legend iconType="circle" iconSize={8} formatter={(v:string)=><span className="text-[10px] text-white/50">{v}</span>}/>
            <Bar dataKey="ontime" name="On-Time %" fill="#10b981" radius={[4,4,0,0]}/>
            <Bar dataKey="cost" name="Cost/kg ($)" fill="#6366f1" radius={[4,4,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </CardContent></Card>
      <div className="space-y-2">
        {routeEfficiency.map(r => <Card key={r.route} className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-3 flex items-center gap-3">
          <Route className="w-4 h-4 text-indigo-400 shrink-0"/>
          <div className="flex-1"><div className="text-xs font-medium text-white/80">{r.route}</div><div className="text-[10px] text-white/30">{r.volume} shipments &middot; ${r.cost}/kg</div></div>
          <div className="text-right"><div className={`text-sm font-semibold ${r.ontime>75?'text-emerald-400':'text-amber-400'}`}>{r.ontime}%</div><div className="text-[9px] text-white/30">on-time</div></div>
        </CardContent></Card>)}
      </div>
    </>}
  </div></div>;
}


/* ─── OPERATIONS TIMELINE (GANTT-STYLE) ─── */
function TimelineTab() {
  const pipeline = ['ORIGIN','EXPORT_CUSTOMS','IN_TRANSIT','ARRIVED','IMPORT_CUSTOMS','DESTINATION','OUT_FOR_DELIVERY','DELIVERED'];
  const [selectedShipment, setSelectedShipment] = useState<string | null>(null);

  return <div className="h-full overflow-y-auto"><div className="p-4 space-y-3">
    <Card className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-4">
      <h3 className="text-xs font-medium text-white/70 mb-3 flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-blue-400"/>Operations Timeline</h3>
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Header */}
          <div className="flex items-center gap-1 mb-2 pb-2 border-b border-white/[0.06]">
            <div className="w-32 shrink-0 text-[10px] text-white/40 font-medium pl-2">Shipment</div>
            {pipeline.map(stage => (
              <div key={stage} className="flex-1 text-center text-[9px] text-white/30 py-1">{stage.replace(/_/g,' ')}</div>
            ))}
          </div>
          {/* Rows */}
          {shipments.map(s => {
            const currentIdx = pipeline.indexOf(s.status);
            const isSelected = selectedShipment === s.id;
            return (
              <div key={s.id} className={`flex items-center gap-1 py-1.5 rounded-lg transition-all cursor-pointer ${isSelected ? 'bg-white/[0.06]' : 'hover:bg-white/[0.02]'}`} onClick={()=>setSelectedShipment(isSelected?null:s.id)}>
                <div className="w-32 shrink-0 pl-2">
                  <div className="text-[10px] font-medium text-white/80">{s.number}</div>
                  <div className="text-[9px] text-white/30 truncate">{s.customer}</div>
                </div>
                {pipeline.map((stage, idx) => (
                  <div key={stage} className="flex-1 flex items-center justify-center px-0.5">
                    {idx < currentIdx ? (
                      <div className="w-full h-4 rounded bg-emerald-500/40 flex items-center justify-center"><CheckCircle2 className="w-3 h-3 text-emerald-300"/></div>
                    ) : idx === currentIdx ? (
                      <div className="w-full h-4 rounded bg-blue-500/60 flex items-center justify-center animate-pulse"><CircleDot className="w-3 h-3 text-blue-200"/></div>
                    ) : (
                      <div className="w-full h-4 rounded bg-white/[0.04]"/>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-4 mt-3 pt-2 border-t border-white/[0.06]">
        <span className="flex items-center gap-1.5 text-[9px] text-white/30"><span className="w-3 h-3 rounded bg-emerald-500/40"/>Completed</span>
        <span className="flex items-center gap-1.5 text-[9px] text-white/30"><span className="w-3 h-3 rounded bg-blue-500/60"/>Current</span>
        <span className="flex items-center gap-1.5 text-[9px] text-white/30"><span className="w-3 h-3 rounded bg-white/[0.04]"/>Pending</span>
      </div>
    </CardContent></Card>

    {/* Selected Shipment Detail */}
    {selectedShipment && (()=>{
      const s = shipments.find(sh => sh.id === selectedShipment); if(!s)return null;
      const pred = predictETA(s);
      const cc = customsData[s.id];
      const events = trackingEvents.filter(e => e.shipmentId === s.id);
      return <Card className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between"><h3 className="text-xs font-medium text-white/80">{s.number} — Progress Detail</h3><SB s={s.status}/></div>
        {/* Progress bar */}
        <div><div className="flex items-center justify-between text-[10px] text-white/40 mb-1"><span>Progress</span><span>{Math.round((pipeline.indexOf(s.status)/(pipeline.length-1))*100)}%</span></div>
        <div className="h-2 rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all" style={{width:`${(pipeline.indexOf(s.status)/(pipeline.length-1))*100}%`}}/></div></div>
        {/* AI Prediction */}
        <div className="bg-indigo-500/[0.05] rounded-lg p-3 border border-indigo-500/10">
          <div className="flex items-center gap-2 mb-1"><BrainCircuit className="w-3.5 h-3.5 text-indigo-400"/><span className="text-[10px] font-medium text-indigo-300">AI Prediction</span></div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><div className="text-[9px] text-white/30">Predicted ETA</div><div className="text-sm font-semibold text-white/80">{pred.predicted}</div></div>
            <div><div className="text-[9px] text-white/30">Confidence</div><div className="text-sm font-semibold text-indigo-400">{pred.confidence}%</div></div>
            <div><div className="text-[9px] text-white/30">Delay</div><div className={`text-sm font-semibold ${pred.delayDays>0?'text-red-400':'text-emerald-400'}`}>{pred.delayDays}d</div></div>
          </div>
        </div>
        {/* Recent Events */}
        {events.length>0 && <><h4 className="text-[10px] font-medium text-white/40">Recent Events</h4>
        <div className="space-y-1">{events.slice(-4).map(ev=><div key={ev.id} className="flex items-center gap-2 text-[10px]"><CircleDot className="w-2.5 h-2.5 text-blue-400 shrink-0"/><span className="text-white/50">{ev.type.replace(/_/g,' ')}</span><span className="text-white/20 ml-auto">{ev.timestamp}</span></div>)}</div></>}
        {/* Customs */}
        {cc && <><h4 className="text-[10px] font-medium text-white/40">Customs Status</h4>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/[0.03] rounded-lg p-2"><div className="text-[9px] text-white/30">Export</div><SB s={cc.export.lane}/></div>
          <div className="bg-white/[0.03] rounded-lg p-2"><div className="text-[9px] text-white/30">Import</div><SB s={cc.import.lane}/></div>
        </div></>}
      </CardContent></Card>;
    })()}

    {/* Shipment Quick Cards */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {shipments.map(s => {
        const pred = predictETA(s);
        const progress = Math.round((pipeline.indexOf(s.status) / (pipeline.length - 1)) * 100);
        return <Card key={s.id} className={`bg-white/[0.03] border-white/[0.06] cursor-pointer transition-all ${selectedShipment===s.id?'ring-1 ring-blue-500/30':''}`} onClick={()=>setSelectedShipment(s.id)}><CardContent className="p-3">
          <div className="flex items-center justify-between mb-1"><span className="text-[11px] font-medium text-white/80">{s.number}</span><SB s={s.status}/></div>
          <div className="text-[10px] text-white/30 mb-2">{s.origin}→{s.destination}</div>
          <div className="h-1.5 rounded-full bg-white/[0.06] mb-1"><div className="h-full rounded-full bg-blue-500" style={{width:`${progress}%`}}/></div>
          <div className="flex items-center justify-between text-[9px] text-white/20"><span>{progress}% complete</span><span className={pred.delayDays>0?'text-red-400/60':'text-emerald-400/60'}>ETA:{pred.predicted}</span></div>
        </CardContent></Card>;
      })}
    </div>
  </div></div>;
}

/* ─── SMART RATE CALCULATOR ─── */
function RateCalculatorTab() {
  const [origin, setOrigin] = useState('CAN');
  const [destination, setDestination] = useState('DAR');
  const [weight, setWeight] = useState('');
  const [cargoType, setCargoType] = useState('General');
  const [priority, setPriority] = useState<SP>('STANDARD');
  const [quote, setQuote] = useState<{carrier:string;total:number;breakdown:Record<string,number>;transitDays:number}|null>(null);

  const origins = ['CAN','HKG','SZX'];
  const destinations = ['DAR','ZNZ'];
  const cargoTypes = ['General','Electronics','Pharma','Textiles','Machinery','Dangerous Goods'];
  const typeMultipliers: Record<string,number> = { General:1,Electronics:1.2,Pharma:1.8,Textiles:0.9,Machinery:1.5,'Dangerous Goods':2.2 };
  const priorityMultipliers: Record<string,number> = { STANDARD:1,EXPRESS:1.4,URGENT:1.9 };

  const calculateQuote = useCallback(() => {
    const w = parseFloat(weight) || 0;
    if(w<=0) return;
    const baseRate = origin==='HKG'?8.2:origin==='SZX'?9.5:8.5;
    const typeMult = typeMultipliers[cargoType]||1;
    const priMult = priorityMultipliers[priority]||1;
    const freight = Math.round(w*baseRate*typeMult*priMult);
    const fuel = Math.round(freight*0.18);
    const security = Math.round(freight*0.05);
    const handling = Math.round(w*1.2);
    const docFee = 85;
    const total = freight+fuel+security+handling+docFee;
    const transitDays = priority==='URGENT'?3:priority==='EXPRESS'?5:8;
    const carrier = origin==='HKG'?'Ethiopian Airlines':Math.random()>0.5?'Ethiopian Airlines':'Qatar Airways';
    setQuote({carrier,total,breakdown:{Freight:freight,'Fuel Surcharge':fuel,Security:security,Handling:handling,'Documentation':docFee},transitDays});
  }, [origin,destination,weight,cargoType,priority]);

  return <div className="h-full overflow-y-auto"><div className="p-4 space-y-4">
    <Card className="bg-gradient-to-br from-blue-500/[0.08] to-indigo-500/[0.05] border-blue-500/15"><CardContent className="p-4">
      <div className="flex items-center gap-2"><Calculator className="w-5 h-5 text-blue-400"/><h2 className="text-sm font-semibold text-white/90">Smart Rate Calculator</h2></div>
      <p className="text-[10px] text-white/40 mt-1">Instant freight quotes with AI-powered cost optimization</p>
    </CardContent></Card>

    <Card className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-[10px] text-white/40 mb-1 block">Origin</label><select value={origin} onChange={e=>setOrigin(e.target.value)} className="w-full h-9 px-3 text-xs bg-white/[0.04] border border-white/[0.06] rounded-lg text-white/80">{origins.map(o=><option key={o} value={o}>{o}</option>)}</select></div>
        <div><label className="text-[10px] text-white/40 mb-1 block">Destination</label><select value={destination} onChange={e=>setDestination(e.target.value)} className="w-full h-9 px-3 text-xs bg-white/[0.04] border border-white/[0.06] rounded-lg text-white/80">{destinations.map(d=><option key={d} value={d}>{d}</option>)}</select></div>
      </div>
      <div><label className="text-[10px] text-white/40 mb-1 block">Weight (kg)</label><Input type="number" value={weight} onChange={e=>setWeight(e.target.value)} placeholder="Enter chargeable weight" className="h-9 text-xs bg-white/[0.04] border-white/[0.06] text-white/80 placeholder:text-white/25 rounded-xl"/></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-[10px] text-white/40 mb-1 block">Cargo Type</label><select value={cargoType} onChange={e=>setCargoType(e.target.value)} className="w-full h-9 px-3 text-xs bg-white/[0.04] border border-white/[0.06] rounded-lg text-white/80">{cargoTypes.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
        <div><label className="text-[10px] text-white/40 mb-1 block">Priority</label><div className="flex gap-1">{(['STANDARD','EXPRESS','URGENT'] as SP[]).map(p=>
          <button key={p} onClick={()=>setPriority(p)} className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-all ${priority===p?'bg-blue-500/15 text-blue-400 border border-blue-500/20':'text-white/35 border border-transparent'}`}>{p[0]}</button>
        )}</div></div>
      </div>
      <Button onClick={calculateQuote} className="w-full h-9 bg-blue-500 hover:bg-blue-600 text-xs rounded-xl"><Calculator className="w-3.5 h-3.5 mr-1.5"/>Calculate Rate</Button>
    </CardContent></Card>

    {quote && <Card className="bg-gradient-to-br from-emerald-500/[0.08] to-transparent border-emerald-500/15"><CardContent className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div><div className="text-xs text-white/40">Estimated Total</div><div className="text-2xl font-bold text-emerald-400">{usd(quote.total)}</div></div>
        <div className="text-right"><div className="text-xs text-white/40">Carrier</div><div className="text-sm text-white/80">{quote.carrier}</div><div className="text-[10px] text-white/30">{quote.transitDays} days transit</div></div>
      </div>
      <div className="space-y-1.5">
        {Object.entries(quote.breakdown).map(([k,v])=><div key={k} className="flex items-center justify-between p-2 bg-white/[0.03] rounded-lg"><span className="text-[11px] text-white/50">{k}</span><span className="text-[11px] text-white/80">{usd(v)}</span></div>)}
      </div>
      <div className="bg-indigo-500/[0.05] rounded-lg p-2.5 border border-indigo-500/10">
        <div className="flex items-center gap-2"><Sparkles className="w-3 h-3 text-indigo-400"/><span className="text-[10px] text-indigo-300">AI Savings Tip</span></div>
        <p className="text-[10px] text-white/40 mt-1">Switch to Ethiopian Airlines via ADD to save ~{usd(Math.round(quote.total*0.12))} (12% cheaper)</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1 h-8 text-[10px] border-white/[0.1] text-white/60 hover:text-white hover:bg-white/[0.05] rounded-lg"><Printer className="w-3 h-3 mr-1"/>Print</Button>
        <Button variant="outline" className="flex-1 h-8 text-[10px] border-white/[0.1] text-white/60 hover:text-white hover:bg-white/[0.05] rounded-lg"><Download className="w-3 h-3 mr-1"/>Download</Button>
      </div>
    </CardContent></Card>}
  </div></div>;
}

/* ─── DOCUMENT INTELLIGENCE HUB ─── */
function DocumentsTab() {
  const [docType, setDocType] = useState<'awb' | 'invoice' | 'customs' | 'packing'>('awb');
  const [selectedShipment, setSelectedShipment] = useState<string>('s1');
  const [generated, setGenerated] = useState(false);

  const s = shipments.find(sh => sh.id === selectedShipment);

  const generateDoc = () => setGenerated(true);

  return <div className="h-full overflow-y-auto"><div className="p-4 space-y-4">
    <Card className="bg-gradient-to-br from-amber-500/[0.08] to-transparent border-amber-500/15"><CardContent className="p-4">
      <div className="flex items-center gap-2"><FileText className="w-5 h-5 text-amber-400"/><h2 className="text-sm font-semibold text-white/90">Document Intelligence Hub</h2></div>
      <p className="text-[10px] text-white/40 mt-1">Generate, preview, and export shipping documents</p>
    </CardContent></Card>

    <div className="flex gap-1 overflow-x-auto scrollbar-hide">
      {[{k:'awb' as const,l:'AWB',i:Plane},{k:'invoice' as const,l:'Invoice',i:Receipt},{k:'customs' as const,l:'Customs Decl',i:ShieldCheck},{k:'packing' as const,l:'Packing List',i:Package}].map(d=>
        <button key={d.k} onClick={()=>{setDocType(d.k);setGenerated(false);}} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all border whitespace-nowrap ${docType===d.k?'bg-amber-500/15 text-amber-400 border-amber-500/20':'text-white/40 hover:text-white/60 border-transparent'}`}><d.i className="w-3.5 h-3.5"/>{d.l}</button>
      )}
    </div>

    <div className="flex gap-2">
      <select value={selectedShipment} onChange={e=>{setSelectedShipment(e.target.value);setGenerated(false);}} className="flex-1 h-9 px-3 text-xs bg-white/[0.04] border border-white/[0.06] rounded-lg text-white/80">
        {shipments.map(sh=><option key={sh.id} value={sh.id}>{sh.number} — {sh.customer}</option>)}
      </select>
      <Button onClick={generateDoc} className="h-9 px-4 bg-amber-500 hover:bg-amber-600 text-xs rounded-xl"><FileText className="w-3.5 h-3.5 mr-1.5"/>Generate</Button>
    </div>

    {generated && s && <Card className="bg-white/[0.04] border-white/[0.1]"><CardContent className="p-4">
      {docType === 'awb' && <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-2"><span className="text-lg font-bold text-white/90">MASTER AWB</span><span className="text-sm text-amber-400 font-mono">{s.masterAWB}</span></div>
        <div className="grid grid-cols-2 gap-3 text-[11px]">
          <div><div className="text-white/30">Shipper</div><div className="text-white/80 font-medium">{s.supplier}</div><div className="text-white/30">{s.origin}</div></div>
          <div><div className="text-white/30">Consignee</div><div className="text-white/80 font-medium">{s.customer}</div><div className="text-white/30">{s.destination}</div></div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-[10px] border-t border-white/[0.06] pt-2">
          <div><div className="text-white/30">Pieces</div><div className="text-white/80">{s.packages}</div></div>
          <div><div className="text-white/30">Weight</div><div className="text-white/80">{s.actualWeight}kg</div></div>
          <div><div className="text-white/30">Value</div><div className="text-white/80">{usd(s.value)}</div></div>
        </div>
        <div className="flex justify-center pt-2"><QRCodeSVG value={`AWB:${s.masterAWB}:SHIP:${s.id}`} size={80} bgColor="transparent" fgColor="rgba(255,255,255,0.6)"/></div>
      </div>}
      {docType === 'invoice' && <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-2"><span className="text-lg font-bold text-white/90">COMMERCIAL INVOICE</span><span className="text-sm text-amber-400">{s.number}</span></div>
        <div className="text-[11px]"><div className="flex justify-between py-1"><span className="text-white/50">Freight Charges</span><span className="text-white/80">{usd(Math.round(s.actualWeight*9.5))}</span></div><div className="flex justify-between py-1"><span className="text-white/50">Fuel Surcharge (18%)</span><span className="text-white/80">{usd(Math.round(s.actualWeight*9.5*0.18))}</span></div><div className="flex justify-between py-1"><span className="text-white/50">Security Fee</span><span className="text-white/80">{usd(125)}</span></div><div className="flex justify-between py-1"><span className="text-white/50">Handling</span><span className="text-white/80">{usd(Math.round(s.actualWeight*1.2))}</span></div><div className="flex justify-between py-1 border-t border-white/[0.06] font-semibold"><span className="text-emerald-400">Total</span><span className="text-emerald-400">{usd(Math.round(s.actualWeight*9.5*1.18+125+s.actualWeight*1.2))}</span></div></div>
      </div>}
      {docType === 'customs' && <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-2"><span className="text-lg font-bold text-white/90">CUSTOMS DECLARATION</span><SB s={customsData[s.id]?.import.lane||'GREEN'}/></div>
        <div className="grid grid-cols-2 gap-3 text-[11px]">
          <div><div className="text-white/30">Origin Country</div><div className="text-white/80">China</div></div>
          <div><div className="text-white/30">Destination</div><div className="text-white/80">Tanzania</div></div>
          <div><div className="text-white/30">HS Code</div><div className="text-white/80 font-mono">8471.30.01</div></div>
          <div><div className="text-white/30">Cargo Type</div><div className="text-white/80">{s.cargoType}</div></div>
        </div>
        <div className="text-[11px] border-t border-white/[0.06] pt-2"><div className="flex justify-between"><span className="text-white/50">Declared Value</span><span className="text-white/80">{usd(s.declaredValue)}</span></div><div className="flex justify-between"><span className="text-white/50">Estimated Duty</span><span className="text-white/80">{usd(customsData[s.id]?.import.dutiesEstimated||0)}</span></div><div className="flex justify-between"><span className="text-white/50">Risk Score</span><span className={((customsData[s.id]?.import.riskScore||0)>65)?'text-red-400':'text-emerald-400'}>{customsData[s.id]?.import.riskScore||0}%</span></div></div>
      </div>}
      {docType === 'packing' && <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-2"><span className="text-lg font-bold text-white/90">PACKING LIST</span><span className="text-sm text-amber-400">{s.number}</span></div>
        <div className="space-y-1.5">{packages.filter(p=>p.shipmentId===s.id).map((p,i)=><div key={p.id} className="flex items-center gap-3 p-2 bg-white/[0.03] rounded-lg text-[11px]"><span className="text-white/30 w-4">{i+1}</span><span className="text-white/60 flex-1">{p.description}</span><span className="text-white/30">{p.weight}kg</span><span className="text-white/30">{p.dims}cm</span></div>)}</div>
        <div className="text-[11px] border-t border-white/[0.06] pt-2 flex justify-between font-medium"><span className="text-white/50">Total Packages</span><span className="text-white/80">{s.packages} &middot; {s.actualWeight}kg</span></div>
      </div>}
      <div className="flex gap-2 pt-2 border-t border-white/[0.06]">
        <Button variant="outline" className="flex-1 h-8 text-[10px] border-white/[0.1] text-white/60 hover:text-white hover:bg-white/[0.05] rounded-lg"><Printer className="w-3 h-3 mr-1"/>Print</Button>
        <Button variant="outline" className="flex-1 h-8 text-[10px] border-white/[0.1] text-white/60 hover:text-white hover:bg-white/[0.05] rounded-lg"><Download className="w-3 h-3 mr-1"/>PDF</Button>
        <Button variant="outline" className="flex-1 h-8 text-[10px] border-white/[0.1] text-white/60 hover:text-white hover:bg-white/[0.05] rounded-lg"><Copy className="w-3 h-3 mr-1"/>Copy</Button>
      </div>
    </CardContent></Card>}
  </div></div>;
}


/* ─── SHIPMENTS ─── */
/* ─── Shipment Flowchart Data ─── */
const SHIPMENT_STAGES = [
  { id: 1, name: 'Booked', icon: ClipboardCheck },
  { id: 2, name: 'Picked Up', icon: Package },
  { id: 3, name: 'Origin W/H', icon: Warehouse },
  { id: 4, name: 'In Customs', icon: ClipboardCheck },
  { id: 5, name: 'Cleared', icon: CheckCircle2 },
  { id: 6, name: 'In Transit', icon: Ship },
  { id: 7, name: 'Arrived', icon: Anchor },
  { id: 8, name: 'Dest. Customs', icon: ClipboardCheck },
  { id: 9, name: 'Out for Delivery', icon: Truck },
  { id: 10, name: 'Delivered', icon: CheckCircle2 },
];
function ShipmentFlowchart({ currentStage, compact }: { currentStage: number; compact?: boolean }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide pb-1">
      {SHIPMENT_STAGES.map((stage, i) => {
        const completed = i + 1 < currentStage;
        const current = i + 1 === currentStage;
        return (
          <div key={stage.id} className="flex items-center gap-1 shrink-0">
            <div className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg min-w-[${compact ? '52px' : '68px'}] transition-all ${
              completed ? 'bg-emerald-500/10 border border-emerald-500/20' :
              current ? 'bg-amber-500/15 border border-amber-500/30 animate-pulse' :
              'bg-white/[0.02] border border-white/[0.04]'
            }`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                completed ? 'bg-emerald-500/20 text-emerald-400' :
                current ? 'bg-amber-500/20 text-amber-400' :
                'bg-white/[0.05] text-white/20'
              }`}>
                {completed ? <CheckCircle2 className="w-3 h-3" /> : stage.id}
              </div>
              <span className={`text-[9px] font-medium whitespace-nowrap ${
                completed ? 'text-emerald-400' : current ? 'text-amber-400' : 'text-white/25'
              }`}>{stage.name}</span>
            </div>
            {i < SHIPMENT_STAGES.length - 1 && (
              <div className={`w-3 h-[2px] shrink-0 ${
                i + 1 < currentStage ? 'bg-emerald-500/40' : 'bg-white/[0.06]'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ShipmentsTab({search}:{search:string}){
  const[f,setF]=useState('ALL');
  const[view,setView]=useState<Shipment|null>(null);
  const[flowView,setFlowView]=useState<string|null>(null);
  const[shipmentStages,setShipmentStages]=useState<Record<string,number>>(()=>{
    const map:Record<string,number>={};
    shipments.forEach((s,i)=>{map[s.id]=[3,5,6,4,8][i%5]});
    return map;
  });
  const advanceStage=(sid:string)=>{
    setShipmentStages(prev=>{const cur=prev[sid]||1;const next=Math.min(cur+1,10);return{...prev,[sid]:next};});
  };
  const filtered=useMemo(()=>shipments.filter(s=>{const ms=!search||s.number.toLowerCase().includes(search.toLowerCase())||s.customer.toLowerCase().includes(search.toLowerCase());const mf=f==='ALL'||s.status===f;return ms&&mf;}),[search,f]);
  const filters=['ALL','ORIGIN','EXPORT_CUSTOMS','IN_TRANSIT','IMPORT_CUSTOMS','DESTINATION','DELIVERED'];
  return<div className="h-full overflow-y-auto"><div className="p-4 space-y-3">
    {/* Shipment Flowchart Overview */}
    <Card className="bg-gradient-to-br from-blue-500/[0.05] to-indigo-500/[0.05] border-blue-500/15"><CardContent className="p-3">
      <div className="flex items-center gap-2 mb-2"><Ship className="w-4 h-4 text-blue-400"/><span className="text-xs font-semibold text-white/80">Shipment Pipeline</span><span className="text-[10px] text-white/30 ml-auto">{shipments.length} active shipments</span></div>
      {flowView ? (
        <div className="space-y-2">
          {(()=>{const s=shipments.find(x=>x.id===flowView);if(!s)return null;return<>
            <div className="flex items-center justify-between"><span className="text-[11px] font-medium text-white/70">{s.number} — {s.customer}</span>
              <button onClick={()=>setFlowView(null)} className="text-[10px] text-white/30 hover:text-white/60">Hide</button>
            </div>
            <ShipmentFlowchart currentStage={shipmentStages[s.id]||1} />
            <div className="flex items-center gap-2">
              <Button onClick={()=>advanceStage(s.id)} size="sm" className="h-6 text-[10px] bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30">Advance Stage</Button>
              <span className="text-[10px] text-white/30">Stage {shipmentStages[s.id]||1} of 10</span>
            </div>
          </>;})()}
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-2">
          {shipments.slice(0,5).map(s=>(
            <button key={s.id} onClick={()=>setFlowView(s.id)} className="text-left p-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.04] hover:border-white/[0.08] transition-all">
              <div className="text-[10px] font-medium text-white/70 truncate">{s.number}</div>
              <div className="text-[9px] text-white/30">Stage {shipmentStages[s.id]||1}/10</div>
              <div className="mt-1 h-1 rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-blue-500/50 transition-all" style={{width:`${(shipmentStages[s.id]||1)*10}%`}} /></div>
            </button>
          ))}
        </div>
      )}
    </CardContent></Card>
    {/* Filter */}
    <div className="flex gap-1 overflow-x-auto scrollbar-hide">{filters.map(fi=><button key={fi} onClick={()=>setF(fi)} className={`px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all ${f===fi?'bg-blue-500/15 text-blue-400 border border-blue-500/20':'text-white/35 hover:text-white/50 border border-transparent'}`}>{fi.replace(/_/g,' ')}</button>)}</div>
    {filtered.map(s=>{const cc=customsData[s.id];const pred=predictETA(s);return<Card key={s.id} className="bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05] transition-all cursor-pointer" onClick={()=>setView(s)}><CardContent className="p-3">
      <div className="flex items-start justify-between mb-2"><div><div className="flex items-center gap-2"><span className="text-xs font-medium text-white/80">{s.number}</span><SB s={s.priority}/></div><div className="text-[10px] text-white/30 mt-0.5">{s.customer}</div></div><SB s={s.status}/></div>
      <div className="flex items-center gap-2 mb-2"><span className="text-[11px] text-white/50">{s.origin}</span><ArrowRight className="w-3 h-3 text-white/20"/><span className="text-[11px] text-white/50">{s.destination}</span></div>
      <div className="flex items-center gap-3 text-[10px] text-white/30"><span>{s.cargoType}</span><span>{s.packages} pkgs</span><span>{s.actualWeight}kg</span></div>
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {cc&&<><SB s={cc.export.lane}/><span className="text-[10px] text-white/30">Risk:{cc.export.riskScore}%</span></>}
        <span className="text-[10px] text-indigo-400 ml-auto flex items-center gap-1"><BrainCircuit className="w-3 h-3"/>ETA:{pred.predicted}</span>
      </div>
    </CardContent></Card>})}
    <Dialog open={!!view} onOpenChange={()=>setView(null)}><DialogContent className="bg-[#0f0f1a] border-white/[0.08] text-white max-w-lg max-h-[85vh] overflow-y-auto">
      {view&&(()=>{const cc=customsData[view.id];const sp=packages.filter(p=>p.shipmentId===view.id);const pred=predictETA(view);return<>
        <DialogHeader><DialogTitle className="text-sm">Shipment {view.number}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-[11px]">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/[0.03] rounded-lg p-2"><div className="text-white/40">Customer</div><div className="text-white/80 font-medium">{view.customer}</div></div>
            <div className="bg-white/[0.03] rounded-lg p-2"><div className="text-white/40">Supplier</div><div className="text-white/80 font-medium">{view.supplier}</div></div>
            <div className="bg-white/[0.03] rounded-lg p-2"><div className="text-white/40">Route</div><div className="text-white/80">{view.origin}→{view.destination}</div></div>
            <div className="bg-white/[0.03] rounded-lg p-2"><div className="text-white/40">Weight</div><div className="text-white/80">{view.actualWeight}kg</div></div>
          </div>
          {/* AI Prediction */}
          <div className="bg-indigo-500/[0.05] rounded-lg p-3 border border-indigo-500/10">
            <div className="flex items-center gap-2 mb-2"><BrainCircuit className="w-3.5 h-3.5 text-indigo-400"/><span className="text-[10px] font-medium text-indigo-300">AI Prediction</span></div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><div className="text-[9px] text-white/30">Predicted ETA</div><div className="text-sm font-semibold text-white/80">{pred.predicted}</div></div>
              <div><div className="text-[9px] text-white/30">Confidence</div><div className="text-sm font-semibold text-indigo-400">{pred.confidence}%</div></div>
              <div><div className="text-[9px] text-white/30">Risk</div><div className={`text-sm font-semibold ${pred.risk==='high'||pred.risk==='critical'?'text-red-400':'text-emerald-400'}`}>{pred.risk.toUpperCase()}</div></div>
            </div>
          </div>
          <h4 className="text-xs font-medium text-white/60">Packages ({sp.length})</h4>
          <div className="bg-white/[0.03] rounded-lg p-2 space-y-1">{sp.map(p=><div key={p.id} className="flex items-center gap-2"><Box className="w-3 h-3 text-blue-400"/><span className="text-white/60">{p.qrCode}</span><span className="text-white/30 ml-auto">{p.weight}kg</span></div>)}</div>
          {cc&&<><h4 className="text-xs font-medium text-white/60">Customs</h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/[0.03] rounded-lg p-2"><div className="text-white/40 mb-1">China Export</div><SB s={cc.export.lane}/><div className="mt-1 text-white/50">Risk:{cc.export.riskScore}%</div></div>
            <div className="bg-white/[0.03] rounded-lg p-2"><div className="text-white/40 mb-1">Tanzania Import</div><SB s={cc.import.lane}/><div className="mt-1 text-white/50">Risk:{cc.import.riskScore}%</div>{cc.import.taxDispute&&<div className="text-red-400 mt-1">Tax Dispute</div>}</div>
          </div></>}
          <h4 className="text-xs font-medium text-white/60">Financials</h4>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-white/[0.03] rounded-lg p-2"><div className="text-[9px] text-white/30">Value</div><div className="text-emerald-400 font-medium">{usd(view.value)}</div></div>
            <div className="bg-white/[0.03] rounded-lg p-2"><div className="text-[9px] text-white/30">Cost</div><div className="text-red-400 font-medium">{usd(view.cost)}</div></div>
            <div className="bg-white/[0.03] rounded-lg p-2"><div className="text-[9px] text-white/30">Margin</div><div className="text-blue-400 font-medium">{((view.value-view.cost)/view.value*100).toFixed(1)}%</div></div>
          </div>
        </div>
      </>})()}
    </DialogContent></Dialog>
  </div></div>;
}

/* ─── CUSTOMS ─── */
function CustomsTab({search}:{search:string}){
  const[j,setJ]=useState<'EXPORT'|'IMPORT'>('EXPORT');
  const filtered=useMemo(()=>shipments.filter(s=>!search||s.number.toLowerCase().includes(search.toLowerCase())||s.customer.toLowerCase().includes(search.toLowerCase())),[search]);
  return<div className="h-full overflow-y-auto"><div className="p-4 space-y-4">
    <div className="flex gap-1"><button onClick={()=>setJ('EXPORT')} className={`flex-1 py-2 rounded-lg text-[11px] font-medium transition-all ${j==='EXPORT'?'bg-blue-500/15 text-blue-400 border border-blue-500/20':'text-white/40 border border-transparent'}`}>China Export</button><button onClick={()=>setJ('IMPORT')} className={`flex-1 py-2 rounded-lg text-[11px] font-medium transition-all ${j==='IMPORT'?'bg-amber-500/15 text-amber-400 border border-amber-500/20':'text-white/40 border border-transparent'}`}>Tanzania Import</button></div>
    {filtered.map(s=>{const cc=customsData[s.id];if(!cc)return null;const c=j==='EXPORT'?cc.export:cc.import;const pred=predictETA(s);return<Card key={s.id} className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-3 space-y-2">
      <div className="flex items-center justify-between"><div><div className="text-xs font-medium text-white/80">{s.number}</div><div className="text-[10px] text-white/30">{s.customer}&middot;Port:{c.portCode}</div></div><SB s={c.lane}/></div>
      <div><div className="flex items-center justify-between mb-1"><span className="text-[10px] text-white/40">Risk Score</span><span className={`text-[10px] font-medium ${c.riskScore>65?'text-red-400':c.riskScore>35?'text-amber-400':'text-emerald-400'}`}>{c.riskScore}/100</span></div><div className="h-2 rounded-full bg-white/[0.06] overflow-hidden"><div className={`h-full rounded-full ${c.riskScore>65?'bg-red-500':c.riskScore>35?'bg-amber-500':'bg-emerald-500'}`} style={{width:`${c.riskScore}%`}}/></div></div>
      <div className="flex items-center gap-2 flex-wrap"><SB s={c.status}/>{c.inspection&&<span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">Inspection</span>}{c.taxDispute&&<span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">Tax Dispute</span>}</div>
      <div className="grid grid-cols-2 gap-2 text-[10px]"><div className="bg-white/[0.03] rounded-lg p-2"><div className="text-white/30">Duties Est.</div><div className="text-white/60">{usd(c.dutiesEstimated)}</div></div><div className="bg-white/[0.03] rounded-lg p-2"><div className="text-white/30">Duties Paid</div><div className={c.dutiesPaid>=c.dutiesEstimated?'text-emerald-400':'text-amber-400'}>{usd(c.dutiesPaid)}</div></div></div>
      {pred.delayDays>0 && <div className="flex items-center gap-1.5 bg-indigo-500/[0.05] rounded-lg p-2 border border-indigo-500/10"><BrainCircuit className="w-3 h-3 text-indigo-400"/><span className="text-[10px] text-indigo-300">AI: +{pred.delayDays}d predicted delay due to customs risk</span></div>}
    </CardContent></Card>})}
  </div></div>;
}

/* ─── WAREHOUSE ─── */
function WarehouseTab({search:_s}:{search:string}){
  const[scan,setScan]=useState('');
  const[found,setFound]=useState<Pkg|null>(null);
  const handleScan=()=>{const p=packages.find(p=>p.qrCode===scan);setFound(p||null);};
  return<div className="h-full overflow-y-auto"><div className="p-4 space-y-4">
    <Card className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-3 space-y-3">
      <h3 className="text-xs font-medium text-white/70 flex items-center gap-2"><ScanLine className="w-4 h-4"/>Package Scan</h3>
      <div className="flex gap-2"><Input value={scan} onChange={e=>setScan(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleScan()} placeholder="Scan QR code" className="h-9 text-xs bg-white/[0.04] border-white/[0.06] text-white/80 placeholder:text-white/20 rounded-xl flex-1"/><Button onClick={handleScan} className="h-9 px-3 text-xs bg-blue-500 hover:bg-blue-600 rounded-xl"><ScanLine className="w-3.5 h-3.5"/></Button></div>
      {found&&<div className="bg-blue-500/[0.05] rounded-lg p-3 space-y-2"><div className="text-xs font-medium text-white/80">{found.qrCode}</div><div className="text-[11px] text-white/50">{found.description}</div><div className="flex items-center gap-3 text-[10px] text-white/30"><span className="flex items-center gap-1"><Weight className="w-3 h-3"/>{found.weight}kg</span><span className="flex items-center gap-1"><Ruler className="w-3 h-3"/>{found.dims}cm</span></div><SB s={found.status}/></div>}
      {found===null&&scan&&<div className="text-center text-[11px] text-red-400 py-2">Not found</div>}
    </CardContent></Card>
    <Card className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-3 space-y-3">
      <h3 className="text-xs font-medium text-white/70 flex items-center gap-2"><Container className="w-4 h-4"/>Bins</h3>
      <div className="grid grid-cols-2 gap-2">{bins.map(b=><div key={b.id} className="bg-white/[0.03] rounded-lg p-2.5"><div className="text-[11px] font-medium text-white/70">{b.number}</div><div className="text-[10px] text-white/30">{b.warehouse}</div><div className="flex items-center gap-2 mt-1"><span className="text-[10px] text-white/40">{b.packages} pkgs</span><span className="text-[10px] text-white/40">{b.weight}kg</span></div><SB s={b.status}/></div>)}</div>
    </CardContent></Card>
    <Card className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-3 space-y-3">
      <h3 className="text-xs font-medium text-white/70 flex items-center gap-2"><Container className="w-4 h-4"/>ULDs</h3>
      <div className="space-y-2">{ulds.map(u=><div key={u.id} className="bg-white/[0.03] rounded-lg p-2.5">
        <div className="flex items-center justify-between"><div><div className="text-[11px] font-medium text-white/70">{u.number}<span className="text-white/30">({u.uldType})</span></div><div className="text-[10px] text-white/30">Flight:{u.flight}</div></div><SB s={u.status}/></div>
        <div className="mt-1"><div className="flex items-center justify-between text-[10px] text-white/40 mb-1"><span>{u.weight}kg/{u.capacity}kg</span><span>{Math.round((u.weight/u.capacity)*100)}%</span></div><div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden"><div className="h-full rounded-full bg-blue-500" style={{width:`${(u.weight/u.capacity)*100}%`}}/></div></div>
      </div>)}</div>
    </CardContent></Card>
  </div></div>;
}

/* ─── FLIGHTS ─── */
function FlightsTab({search}:{search:string}){
  const[view,setView]=useState<Flight|null>(null);
  const filtered=useMemo(()=>flights.filter(f=>!search||f.number.toLowerCase().includes(search.toLowerCase())||f.airline.toLowerCase().includes(search.toLowerCase())),[search]);
  return<div className="h-full overflow-y-auto"><div className="p-4 space-y-3">
    {filtered.map(f=><Card key={f.id} className="bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05] transition-all cursor-pointer" onClick={()=>setView(f)}><CardContent className="p-3">
      <div className="flex items-start justify-between mb-2"><div className="flex items-center gap-2"><Plane className="w-4 h-4 text-blue-400"/><div><div className="text-xs font-medium text-white/80">{f.number}&middot;{f.airline}</div><div className="text-[10px] text-white/30">{f.ulds} ULDs &middot; ${f.costPerKg}/kg</div></div></div><SB s={f.status}/></div>
      <div className="flex items-center gap-2 mb-2"><span className="text-[11px] text-white/60 font-medium">{f.origin}</span>{f.transit&&<><ArrowRight className="w-3 h-3 text-white/20"/><span className="text-[10px] text-white/30">{f.transit}</span></>}<ArrowRight className="w-3 h-3 text-white/20"/><span className="text-[11px] text-white/60 font-medium">{f.destination}</span></div>
      <div className="flex items-center gap-3 text-[10px] text-white/30"><span>ETD:{f.etd}</span><span>ETA:{f.eta}</span></div>
      <div className="mt-2"><div className="flex items-center justify-between text-[10px] text-white/40 mb-1"><span>Cargo:{f.weight}kg/{f.capacity}kg</span><span>{f.capacity>0?Math.round((f.weight/f.capacity)*100):0}%</span></div><div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden"><div className="h-full rounded-full bg-indigo-500" style={{width:`${f.capacity>0?(f.weight/f.capacity)*100:0}%`}}/></div></div>
    </CardContent></Card>)}
    <Dialog open={!!view} onOpenChange={()=>setView(null)}><DialogContent className="bg-[#0f0f1a] border-white/[0.08] text-white max-w-sm">
      {view&&<><DialogHeader><DialogTitle className="text-sm">Flight {view.number}</DialogTitle></DialogHeader>
      <div className="space-y-3 text-[11px]">
        <div className="grid grid-cols-2 gap-2"><div className="bg-white/[0.03] rounded-lg p-2"><div className="text-white/30">Airline</div><div className="text-white/80">{view.airline}</div></div><div className="bg-white/[0.03] rounded-lg p-2"><div className="text-white/30">Status</div><SB s={view.status}/></div></div>
        <div className="bg-white/[0.03] rounded-lg p-2 text-center"><div className="text-white/80 text-sm font-medium">{view.origin}→{view.transit?`${view.transit}→`:''}{view.destination}</div><div className="text-white/30">{view.etd}→{view.eta}</div></div>
        <div className="grid grid-cols-2 gap-2"><div className="bg-white/[0.03] rounded-lg p-2"><div className="text-white/30">Rate</div><div className="text-emerald-400 font-medium">${view.costPerKg}/kg</div></div><div className="bg-white/[0.03] rounded-lg p-2"><div className="text-white/30">Utilization</div><div className="text-white/80">{view.capacity>0?Math.round((view.weight/view.capacity)*100):0}%</div></div></div>
        <h4 className="text-xs font-medium text-white/60">ULDs</h4>
        {ulds.filter(u=>u.flight===view.number).map(u=><div key={u.id} className="flex items-center gap-2 p-2 bg-white/[0.03] rounded-lg"><Container className="w-4 h-4 text-indigo-400"/><span className="text-white/60">{u.number}</span><span className="text-white/30 ml-auto">{u.weight}kg</span></div>)}
        {ulds.filter(u=>u.flight===view.number).length===0&&<div className="text-center text-white/30 py-2">No ULDs</div>}
      </div></>}
    </DialogContent></Dialog>
  </div></div>;
}

/* ─── PAYMENTS ─── */
/* KOBE Pay Wallet & Payments */
function PaymentsTab() {
  const launchApp = useOSStore(s => s.launchApp);
  useEffect(() => { launchApp('kobe-pay'); }, [launchApp]);
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
      <div className="w-16 h-16 rounded-2xl bg-yellow-500/15 flex items-center justify-center mb-4">
        <Wallet className="w-8 h-8 text-yellow-400" />
      </div>
      <h3 className="text-sm font-medium text-white/50 mb-1">KobePay</h3>
      <p className="text-[11px] text-white/30 max-w-xs mb-4">Payments now open in the standalone KobePay app with full wallet, cashier, and payout features.</p>
      <Button onClick={() => launchApp('kobe-pay')} className="bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/30 text-xs">
        <Wallet className="w-4 h-4 mr-2" /> Open KobePay
      </Button>
    </div>
  );
}

/* ─── TRACKING ─── */
function TrackingTab({search}:{search:string}){
  const[awb,setAwb]=useState(search);
  const found=useMemo(()=>{if(!awb)return null;return shipments.find(s=>s.masterAWB===awb||s.number.toLowerCase()===awb.toLowerCase()||s.houseAWB===awb)||null;},[awb]);
  const events=found?trackingEvents.filter(e=>e.shipmentId===found.id):[];
  const evIcon=(type:string)=>{if(type.includes('CREATED'))return<CircleDot className="w-4 h-4 text-blue-400"/>;if(type.includes('CUSTOMS'))return<ShieldCheck className="w-4 h-4 text-amber-400"/>;if(type.includes('FLIGHT')||type.includes('TRANSIT'))return<Plane className="w-4 h-4 text-indigo-400"/>;if(type.includes('DELIVER')||type.includes('COMPLETED'))return<CheckCircle2 className="w-4 h-4 text-emerald-400"/>;return<Circle className="w-4 h-4 text-white/40"/>;};
  const pred = found ? predictETA(found) : null;
  return <div className="h-full overflow-y-auto"><div className="p-4 space-y-4">
    <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30"/><Input value={awb} onChange={e=>setAwb(e.target.value)} placeholder="Enter AWB or Shipment Number" className="h-10 pl-10 text-sm bg-white/[0.04] border-white/[0.06] text-white/80 placeholder:text-white/25 rounded-xl"/></div>
    {found&&<>
      <Card className="bg-blue-500/[0.05] border-blue-500/15"><CardContent className="p-3">
        <div className="flex items-center justify-between mb-2"><span className="text-xs font-medium text-white/80">{found.number}</span><SB s={found.status}/></div>
        <div className="text-[11px] text-white/50">{found.origin}→{found.destination}</div>
        <div className="text-[10px] text-white/30">{found.customer}&middot;{found.packages}pkgs&middot;ETA:{found.eta}</div>
      </CardContent></Card>
      {pred && <div className="bg-indigo-500/[0.05] rounded-lg p-3 border border-indigo-500/10">
        <div className="flex items-center gap-2 mb-1"><BrainCircuit className="w-3.5 h-3.5 text-indigo-400"/><span className="text-[10px] font-medium text-indigo-300">AI Predicted Delivery</span></div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-white/60">{pred.predicted}</span>
          <span className="text-white/30">({pred.confidence}% confidence)</span>
          {pred.delayDays>0 && <span className="text-red-400">+{pred.delayDays}d delay</span>}
        </div>
      </div>}
      <div className="relative pl-6"><div className="absolute left-[11px] top-0 bottom-0 w-0.5 bg-white/[0.08]"/>
        {events.map(ev=><div key={ev.id} className="relative mb-4"><div className="absolute -left-[17px] top-0 w-6 h-6 rounded-full bg-[#0a0a1a] border-2 border-white/[0.1] flex items-center justify-center z-10">{evIcon(ev.type)}</div><div className="bg-white/[0.03] rounded-lg p-2.5 ml-2"><div className="text-[11px] text-white/70">{ev.type.replace(/_/g,' ')}</div><div className="text-[10px] text-white/30">{ev.location}&middot;{ev.timestamp}</div></div></div>)}
        {events.length===0&&<div className="text-center text-[11px] text-white/30 py-4">No events</div>}
      </div>
    </>}
    {!found&&awb&&<div className="text-center text-[11px] text-red-400 py-4">No shipment found &quot;{awb}&quot;</div>}
    {!awb&&<div className="text-center text-[11px] text-white/30 py-8">Enter AWB to track</div>}
  </div></div>;
}

/* ─── DELIVERY ─── */
function DeliveryTab({search}:{search:string}){
  const filtered=useMemo(()=>deliveries.filter(d=>!search||d.driver.toLowerCase().includes(search.toLowerCase())),[search]);
  const steps=['ASSIGNED','PICKED_UP','IN_TRANSIT','OUT_FOR_DELIVERY','DELIVERED'];
  return<div className="h-full overflow-y-auto"><div className="p-4 space-y-3">
    {filtered.map(d=>{const s=shipments.find(sh=>sh.id===d.shipmentId);const idx=steps.indexOf(d.status);return<Card key={d.id} className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-3 space-y-3">
      <div className="flex items-start justify-between"><div className="flex items-center gap-2"><Truck className="w-5 h-5 text-blue-400"/><div><div className="text-xs font-medium text-white/80">{s?.number||d.shipmentId}</div><div className="text-[10px] text-white/30">{d.driver}&middot;{d.vehicle}</div></div></div><SB s={d.status}/></div>
      <div className="text-[11px] text-white/50">{d.address}</div>
      {d.recipient&&<div className="text-[10px] text-emerald-400">Received by:{d.recipient}</div>}
      <div className="flex items-center gap-1">{steps.map((step,si)=><div key={step} className="flex-1 flex flex-col items-center"><div className={`w-5 h-5 rounded-full flex items-center justify-center ${si<=idx?'bg-blue-500':'bg-white/[0.06]'}`}>{si<=idx?<CheckCircle2 className="w-3 h-3 text-white"/>:<Circle className="w-3 h-3 text-white/20"/>}</div><span className="text-[8px] text-white/30 mt-1 hidden sm:block">{step.replace(/_/g,' ')}</span></div>)}</div>
      <div className="flex items-center gap-3 text-[10px] text-white/30"><span className="flex items-center gap-1"><Phone className="w-3 h-3"/>{d.phone}</span><span className="flex items-center gap-1"><Calendar className="w-3 h-3"/>{d.started}</span>{d.delivered&&<span className="flex items-center gap-1 text-emerald-400"><CheckCircle2 className="w-3 h-3"/>{d.delivered}</span>}</div>
      {d.status==='FAILED'&&<div className="bg-red-500/10 rounded-lg p-2 text-[10px] text-red-400">Delivery failed — Recipient unavailable. AI suggests retry at 9:00 AM tomorrow.</div>}
    </CardContent></Card>})}
  </div></div>;
}

/* ─── NETWORK MAP ─── */
function NetworkMapTab() {
  const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null);
  const [hoveredPort, setHoveredPort] = useState<string | null>(null);
  const ports: Record<string, { x:number; y:number; label:string; country:string; code:string }> = {
    CAN:{x:78,y:38,label:'Guangzhou',country:'China',code:'CAN'},SZX:{x:77,y:40,label:'Shenzhen',country:'China',code:'SZX'},HKG:{x:78.5,y:39.5,label:'Hong Kong',country:'China',code:'HKG'},ADD:{x:54,y:50,label:'Addis Ababa',country:'Ethiopia',code:'ADD'},DOH:{x:56,y:38,label:'Doha',country:'Qatar',code:'DOH'},DAR:{x:57,y:62,label:'Dar es Salaam',country:'Tanzania',code:'DAR'},ZNZ:{x:58,y:61,label:'Zanzibar',country:'Tanzania',code:'ZNZ'},
  };
  const routes = flights.map(f => {
    const originPort = ports[f.origin]; const destPort = ports[f.destination]; const transitPort = f.transit?ports[f.transit]:null;
    const segments: {from:string;to:string;x1:number;y1:number;x2:number;y2:number}[] = [];
    if(originPort&&transitPort){segments.push({from:f.origin,to:f.transit!,x1:originPort.x,y1:originPort.y,x2:transitPort.x,y2:transitPort.y});segments.push({from:f.transit!,to:f.destination,x1:transitPort.x,y1:transitPort.y,x2:destPort.x,y2:destPort.y});}
    else if(originPort&&destPort){segments.push({from:f.origin,to:f.destination,x1:originPort.x,y1:originPort.y,x2:destPort.x,y2:destPort.y});}
    return {flight:f,segments};
  });
  const getStatusColor = (status:string)=>status==='IN_FLIGHT'?'#6366f1':status==='SCHEDULED'?'#3b82f6':'#f59e0b';
  return <div className="h-full overflow-y-auto"><div className="p-4 space-y-4">
    <Card className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium text-white/70 flex items-center gap-2"><Globe className="w-3.5 h-3.5 text-indigo-400"/>Route Network</h3>
        <div className="flex items-center gap-3 text-[10px]"><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#6366f1]"/>In Flight</span><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#3b82f6]"/>Scheduled</span><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#f59e0b]"/>Delayed</span></div>
      </div>
      <div className="relative w-full aspect-[16/9] bg-[#0d0d1a] rounded-xl border border-white/[0.06] overflow-hidden">
        <svg viewBox="0 0 100 70" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
          <defs><pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M 5 0 L 0 0 0 5" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.2"/></pattern></defs>
          <rect width="100" height="70" fill="url(#grid)"/>
          <path d="M45 25 L48 22 L52 24 L55 28 L58 32 L60 38 L58 45 L56 52 L54 60 L52 65 L50 68 L48 66 L46 60 L44 52 L42 45 L40 38 L42 32 Z" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.04)" strokeWidth="0.3"/>
          <path d="M60 10 L75 8 L85 12 L90 20 L92 30 L88 38 L82 42 L75 40 L68 35 L62 28 L58 20 L58 15 Z" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.04)" strokeWidth="0.3"/>
          <path d="M52 30 L58 28 L62 32 L60 38 L54 40 L50 36 Z" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.04)" strokeWidth="0.3"/>
          {routes.map(r=>r.segments.map((seg,si)=>(<g key={`${r.flight.id}-${si}`}>
            <line x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2} stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" strokeDasharray="1 1"/>
            <line x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2} stroke={getStatusColor(r.flight.status)} strokeWidth="0.5" opacity="0.6" style={{cursor:'pointer'}} onClick={()=>setSelectedFlight(r.flight)}/>
            {r.flight.status==='IN_FLIGHT'&&<circle r="0.8" fill={getStatusColor(r.flight.status)} opacity="0.9"><animateMotion dur="3s" repeatCount="indefinite" path={`M${seg.x1},${seg.y1} L${seg.x2},${seg.y2}`}/></circle>}
          </g>)))}
          {Object.entries(ports).map(([code,port])=>(<g key={code} onMouseEnter={()=>setHoveredPort(code)} onMouseLeave={()=>setHoveredPort(null)} style={{cursor:'pointer'}}>
            <circle cx={port.x} cy={port.y} r="1.5" fill={hoveredPort===code?'#6366f1':'#3b82f6'} opacity="0.8"/>
            <circle cx={port.x} cy={port.y} r="2.5" fill="none" stroke={hoveredPort===code?'#6366f1':'#3b82f6'} opacity="0.3" strokeWidth="0.4"><animate attributeName="r" values="2.5;3.5;2.5" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite"/></circle>
            <text x={port.x} y={port.y-3} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="2" fontWeight="500">{port.label}</text>
            <text x={port.x} y={port.y-1.2} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="1.5">{port.code}</text>
          </g>))}
          <text x="82" y="18" textAnchor="middle" fill="rgba(255,255,255,0.12)" fontSize="3" fontWeight="700" letterSpacing="0.5">CHINA</text>
          <text x="52" y="48" textAnchor="middle" fill="rgba(255,255,255,0.12)" fontSize="3" fontWeight="700" letterSpacing="0.5">AFRICA</text>
          <text x="56" y="34" textAnchor="middle" fill="rgba(255,255,255,0.1)" fontSize="2" fontWeight="500">MIDDLE EAST</text>
        </svg>
      </div>
    </CardContent></Card>
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-white/70">Active Routes</h3>
      {flights.map(f=>{const originPort=ports[f.origin];const destPort=ports[f.destination];return<Card key={f.id} className={`bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05] transition-all cursor-pointer ${selectedFlight?.id===f.id?'ring-1 ring-indigo-500/30':''}`} onClick={()=>setSelectedFlight(selectedFlight?.id===f.id?null:f)}><CardContent className="p-3">
        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Plane className="w-4 h-4 text-indigo-400"/><div><div className="text-xs font-medium text-white/80">{f.number} <span className="text-white/30">{f.airline}</span></div><div className="text-[10px] text-white/30">{originPort?.label}→{f.transit?ports[f.transit]?.label+'→':''}{destPort?.label}</div></div></div><div className="flex items-center gap-3"><div className="text-right"><div className="text-[10px] text-white/30">{f.weight}kg/{f.capacity}kg</div><div className="h-1 w-20 rounded-full bg-white/[0.06] mt-1"><div className="h-full rounded-full transition-all" style={{width:`${(f.weight/f.capacity)*100}%`,backgroundColor:getStatusColor(f.status)}}/></div></div><SB s={f.status}/></div></div>
        {selectedFlight?.id===f.id&&<div className="mt-3 pt-3 border-t border-white/[0.06] grid grid-cols-3 gap-2 text-[10px]"><div className="bg-white/[0.03] rounded-lg p-2"><div className="text-white/30">ETD</div><div className="text-white/60">{f.etd}</div></div><div className="bg-white/[0.03] rounded-lg p-2"><div className="text-white/30">ETA</div><div className="text-white/60">{f.eta}</div></div><div className="bg-white/[0.03] rounded-lg p-2"><div className="text-white/30">ULDs</div><div className="text-white/60">{f.ulds} loaded</div></div></div>}
      </CardContent></Card>})}
    </div>
  </div></div>;
}


/* ─── ALERTS PANEL ─── */
function AlertsPanel({ onClose }: { onClose: () => void }) {
  const alerts = useMemo(() => generateAlerts(), []);
  const [filter, setFilter] = useState<string>('ALL');
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const filtered = filter === 'ALL' ? alerts : alerts.filter(a => a.severity === filter);
  const severityIcon = (severity: string) => {
    if (severity === 'critical') return <AlertTriangle className="w-3.5 h-3.5 text-red-400"/>;
    if (severity === 'warning') return <AlertCircle className="w-3.5 h-3.5 text-amber-400"/>;
    if (severity === 'success') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400"/>;
    return <Bell className="w-3.5 h-3.5 text-blue-400"/>;
  };
  const typeIcon = (type: string) => {
    if (type.includes('CUSTOMS') || type === 'INSPECTION') return <ShieldCheck className="w-3 h-3 text-amber-400"/>;
    if (type === 'PAYMENT_OVERDUE') return <DollarSign className="w-3 h-3 text-red-400"/>;
    if (type === 'FLIGHT_DELAYED') return <Plane className="w-3 h-3 text-indigo-400"/>;
    if (type === 'DELIVERY_FAILED') return <Truck className="w-3 h-3 text-red-400"/>;
    if (type === 'ANOMALY') return <BrainCircuit className="w-3 h-3 text-violet-400"/>;
    return <AlertCircle className="w-3 h-3 text-blue-400"/>;
  };
  return (
    <div className="absolute top-full right-0 mt-2 w-80 sm:w-96 bg-[#0f0f1a] border border-white/[0.08] rounded-xl shadow-2xl z-50 overflow-hidden backdrop-blur-xl">
      <div className="flex items-center justify-between p-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2"><Bell className="w-4 h-4 text-indigo-400"/><span className="text-xs font-medium text-white/80">Alerts ({alerts.length})</span></div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/[0.06] transition-colors"><X className="w-3.5 h-3.5 text-white/40"/></button>
      </div>
      <div className="flex gap-1 p-2 border-b border-white/[0.06]">
        {['ALL','critical','warning','info'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)} className={`flex-1 py-1 rounded-lg text-[10px] font-medium transition-all ${filter===f?'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20':'text-white/35 hover:text-white/50 border border-transparent'}`}>{f==='ALL'?'All':f.charAt(0).toUpperCase()+f.slice(1)}</button>
        ))}
      </div>
      <div className="overflow-y-auto" style={{maxHeight:360}}>
        <div className="p-2 space-y-1">
          {filtered.length===0&&<div className="text-center text-[11px] text-white/30 py-8">No alerts</div>}
          {filtered.map(a=>(
            <div key={a.id} className={`p-2.5 rounded-lg cursor-pointer transition-all ${expandedAlert===a.id?'bg-white/[0.06]':'bg-white/[0.02] hover:bg-white/[0.04]'}`} onClick={()=>setExpandedAlert(expandedAlert===a.id?null:a.id)}>
              <div className="flex items-start gap-2">
                {severityIcon(a.severity)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {typeIcon(a.type)}
                    <span className="text-[11px] font-medium text-white/80 truncate">{a.title}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ml-auto shrink-0 ${a.severity==='critical'?'bg-red-500/15 text-red-400':a.severity==='warning'?'bg-amber-500/15 text-amber-400':'bg-blue-500/15 text-blue-400'}`}>{a.severity}</span>
                  </div>
                  <p className="text-[10px] text-white/40 mt-0.5">{a.message}</p>
                  {expandedAlert===a.id&&(
                    <div className="mt-2 pt-2 border-t border-white/[0.06]">
                      <div className="flex items-center gap-3 text-[10px] text-white/30 mb-2"><span className="flex items-center gap-1"><Clock className="w-3 h-3"/>{a.timestamp}</span><span>{a.entityType}:{a.entityId}</span></div>
                      {a.action&&<button className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium">{a.action} →</button>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── AD CAMPAIGNS TAB ─── */
function AdCampaignsTab() {
  const [filter, setFilter] = useState('ALL');
  const filtered = campaigns.filter(c => filter === 'ALL' || c.status === filter);
  const statusColors: Record<string, string> = { active: 'text-emerald-400 bg-emerald-500/10', draft: 'text-blue-400 bg-blue-500/10', paused: 'text-amber-400 bg-amber-500/10', ended: 'text-gray-400 bg-gray-500/10' };
  return <div className="h-full overflow-y-auto"><div className="p-4 space-y-4">
    <Card className="bg-gradient-to-br from-pink-500/[0.08] to-purple-500/[0.05] border-pink-500/15"><CardContent className="p-4">
      <div className="flex items-center gap-2"><Megaphone className="w-5 h-5 text-pink-400"/><h2 className="text-sm font-semibold text-white/90">Ad Campaigns</h2></div>
      <p className="text-[10px] text-white/40 mt-1">{campaigns.length} campaigns &middot; {campaigns.filter(c=>c.status==='active').length} active</p>
    </CardContent></Card>
    <div className="flex gap-1 overflow-x-auto scrollbar-hide">
      {['ALL','active','draft','paused','ended'].map(f => <button key={f} onClick={()=>setFilter(f)} className={`px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all border ${filter===f?'bg-pink-500/15 text-pink-400 border-pink-500/20':'text-white/35 hover:text-white/50 border-transparent'}`}>{f==='ALL'?'All':f[0].toUpperCase()+f.slice(1)}</button>)}
    </div>
    <div className="space-y-2">
      {filtered.map(c => {
        const adv = advertisers.find(a => a.id === c.advertiserId);
        return <Card key={c.id} className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between">
            <div><div className="text-xs font-medium text-white/80">{c.name}</div><div className="text-[10px] text-white/30">{adv?.name} &middot; {c.startDate} - {c.endDate}</div></div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusColors[c.status]}`}>{c.status}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-pink-500" style={{width:`${Math.min(100,(c.spend/c.budget)*100)}%`}}/></div>
          <div className="flex items-center justify-between text-[10px] text-white/40">
            <span>{tzs(c.spend)} / {tzs(c.budget)}</span>
            <span>{Math.round((c.spend/c.budget)*100)}% budget used</span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-white/[0.03] rounded-lg p-1.5"><div className="text-[10px] text-white/30">Impressions</div><div className="text-sm font-semibold text-white/80">{c.impressions.toLocaleString()}</div></div>
            <div className="bg-white/[0.03] rounded-lg p-1.5"><div className="text-[10px] text-white/30">Clicks</div><div className="text-sm font-semibold text-white/80">{c.clicks.toLocaleString()}</div></div>
            <div className="bg-white/[0.03] rounded-lg p-1.5"><div className="text-[10px] text-white/30">Conv.</div><div className="text-sm font-semibold text-white/80">{c.conversions}</div></div>
            <div className="bg-white/[0.03] rounded-lg p-1.5"><div className="text-[10px] text-white/30">CTR</div><div className="text-sm font-semibold text-pink-400">{c.impressions>0?((c.clicks/c.impressions)*100).toFixed(2):'0.00'}%</div></div>
          </div>
          <div className="flex gap-1 flex-wrap">
            {c.placement.map(p => <span key={p} className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-white/30">{p}</span>)}
          </div>
        </CardContent></Card>;
      })}
    </div>
  </div></div>;
}

/* ─── AD LIBRARY TAB ─── */
function AdLibraryTab() {
  const [filter, setFilter] = useState('ALL');
  const [previewAd, setPreviewAd] = useState<Ad | null>(null);
  const filtered = ads.filter(a => filter === 'ALL' || a.status === filter);
  const statusColors: Record<string, string> = { running: 'text-emerald-400 bg-emerald-500/10', approved: 'text-blue-400 bg-blue-500/10', pending: 'text-amber-400 bg-amber-500/10', rejected: 'text-red-400 bg-red-500/10', paused: 'text-orange-400 bg-orange-500/10', expired: 'text-gray-400 bg-gray-500/10' };
  const typeIcons: Record<string, string> = { image: 'Image', video: 'Video', text: 'Text', carousel: 'Carousel' };
  return <div className="h-full overflow-y-auto"><div className="p-4 space-y-4">
    <div className="flex gap-1 overflow-x-auto scrollbar-hide">
      {['ALL','running','approved','pending','rejected','paused','expired'].map(f => <button key={f} onClick={()=>setFilter(f)} className={`px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all border ${filter===f?'bg-pink-500/15 text-pink-400 border-pink-500/20':'text-white/35 hover:text-white/50 border-transparent'}`}>{f==='ALL'?'All':f[0].toUpperCase()+f.slice(1)}</button>)}
    </div>
    <div className="space-y-2">
      {filtered.map(a => {
        const adv = advertisers.find(ad => ad.id === a.advertiserId);
        return <Card key={a.id} className="bg-white/[0.03] border-white/[0.06] cursor-pointer hover:bg-white/[0.05] transition-all" onClick={()=>setPreviewAd(a)}><CardContent className="p-3">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center shrink-0 border border-white/[0.06]">
              <Eye className="w-5 h-5 text-pink-400"/>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5"><span className="text-xs font-medium text-white/80 truncate">{a.title}</span><span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${statusColors[a.status]}`}>{a.status}</span></div>
              <div className="text-[10px] text-white/30">{adv?.name} &middot; {typeIcons[a.type]} &middot; {a.targetLocations.join(', ')}</div>
              <div className="flex items-center gap-3 mt-1.5 text-[10px]">
                <span className="text-white/40">{a.impressions.toLocaleString()} impressions</span>
                <span className="text-white/40">{a.clicks.toLocaleString()} clicks</span>
                <span className="text-pink-400">{a.impressions>0?((a.clicks/a.impressions)*100).toFixed(2):'0.00'}% CTR</span>
                <span className="text-white/20 ml-auto">{a.startDate}-{a.endDate}</span>
              </div>
            </div>
          </div>
        </CardContent></Card>;
      })}
    </div>
    <Dialog open={!!previewAd} onOpenChange={()=>setPreviewAd(null)}><DialogContent className="bg-[#0f0f1a] border-white/[0.08] text-white max-w-sm">
      {previewAd && <>
        <DialogHeader><DialogTitle className="text-sm">{previewAd.title}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-[11px]">
          <div className="w-full h-32 rounded-lg bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center border border-white/[0.06]"><Eye className="w-8 h-8 text-white/20"/></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/[0.03] rounded-lg p-2"><div className="text-white/30">Status</div><span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${statusColors[previewAd.status]}`}>{previewAd.status}</span></div>
            <div className="bg-white/[0.03] rounded-lg p-2"><div className="text-white/30">Type</div><div className="text-white/80">{typeIcons[previewAd.type]}</div></div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-white/[0.03] rounded-lg p-2"><div className="text-[9px] text-white/30">Impressions</div><div className="text-sm font-semibold text-white/80">{previewAd.impressions.toLocaleString()}</div></div>
            <div className="bg-white/[0.03] rounded-lg p-2"><div className="text-[9px] text-white/30">Clicks</div><div className="text-sm font-semibold text-white/80">{previewAd.clicks.toLocaleString()}</div></div>
            <div className="bg-white/[0.03] rounded-lg p-2"><div className="text-[9px] text-white/30">CTR</div><div className="text-sm font-semibold text-pink-400">{previewAd.impressions>0?((previewAd.clicks/previewAd.impressions)*100).toFixed(2):'0.00'}%</div></div>
          </div>
          <div className="flex gap-2">
            {previewAd.status==='pending'&&<Button className="flex-1 h-8 text-[10px] bg-emerald-500 hover:bg-emerald-600 rounded-lg"><Check className="w-3 h-3 mr-1"/>Approve</Button>}
            {previewAd.status==='pending'&&<Button className="flex-1 h-8 text-[10px] bg-red-500 hover:bg-red-600 rounded-lg"><X className="w-3 h-3 mr-1"/>Reject</Button>}
            {(previewAd.status==='running'||previewAd.status==='approved')&&<Button className="flex-1 h-8 text-[10px] bg-amber-500 hover:bg-amber-600 rounded-lg"><Pause className="w-3 h-3 mr-1"/>Pause</Button>}
            {previewAd.status==='paused'&&<Button className="flex-1 h-8 text-[10px] bg-emerald-500 hover:bg-emerald-600 rounded-lg"><Play className="w-3 h-3 mr-1"/>Resume</Button>}
          </div>
        </div>
      </>}
    </DialogContent></Dialog>
  </div></div>;
}

/* ─── ADVERTISERS TAB ─── */
function AdvertisersTab() {
  const [filter, setFilter] = useState('ALL');
  const filtered = advertisers.filter(a => filter === 'ALL' || a.status === filter);
  return <div className="h-full overflow-y-auto"><div className="p-4 space-y-4">
    <Card className="bg-gradient-to-br from-cyan-500/[0.08] to-blue-500/[0.05] border-cyan-500/15"><CardContent className="p-4">
      <div className="flex items-center gap-2"><Users className="w-5 h-5 text-cyan-400"/><h2 className="text-sm font-semibold text-white/90">Advertiser Directory</h2></div>
      <p className="text-[10px] text-white/40 mt-1">{advertisers.length} advertisers &middot; {advertisers.filter(a=>a.status==='active').length} active</p>
    </CardContent></Card>
    <div className="flex gap-1 overflow-x-auto scrollbar-hide">
      {['ALL','active','pending','suspended'].map(f => <button key={f} onClick={()=>setFilter(f)} className={`px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all border ${filter===f?'bg-cyan-500/15 text-cyan-400 border-cyan-500/20':'text-white/35 hover:text-white/50 border-transparent'}`}>{f==='ALL'?'All':f[0].toUpperCase()+f.slice(1)}</button>)}
    </div>
    <div className="space-y-2">
      {filtered.map(a => (
        <Card key={a.id} className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center shrink-0 border border-white/[0.06]"><span className="text-sm font-bold text-cyan-400">{a.logo}</span></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5"><span className="text-xs font-medium text-white/80">{a.name}</span><span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${a.status==='active'?'text-emerald-400 bg-emerald-500/10':a.status==='pending'?'text-amber-400 bg-amber-500/10':'text-red-400 bg-red-500/10'}`}>{a.status}</span></div>
              <div className="text-[10px] text-white/30">{a.email} &middot; {a.phone}</div>
              <div className="flex items-center gap-3 mt-2">
                <div className="text-center"><div className="text-[9px] text-white/30">Ads</div><div className="text-sm font-semibold text-white/80">{a.adCount}</div></div>
                <div className="text-center"><div className="text-[9px] text-white/30">Spent</div><div className="text-sm font-semibold text-emerald-400">{tzs(a.totalSpent)}</div></div>
                <div className="text-center"><div className="text-[9px] text-white/30">Joined</div><div className="text-sm font-semibold text-white/60">{a.joined}</div></div>
              </div>
            </div>
          </div>
        </CardContent></Card>
      ))}
    </div>
  </div></div>;
}

/* ─── AD ANALYTICS TAB ─── */
function AdAnalyticsTab() {
  const totalImpressions = ads.reduce((s,a)=>s+a.impressions,0);
  const totalClicks = ads.reduce((s,a)=>s+a.clicks,0);
  const totalRevenue = ads.reduce((s,a)=>s+a.spend,0);
  const avgCTR = totalImpressions>0?(totalClicks/totalImpressions)*100:0;
  return <div className="h-full overflow-y-auto"><div className="p-4 space-y-4">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KC t="Total Impressions" v={totalImpressions.toLocaleString()} i={Eye} c="pink"/><KC t="Total Clicks" v={totalClicks.toLocaleString()} i={MousePointerClick} c="pink"/>
      <KC t="Ad Revenue" v={tzs(totalRevenue)} i={DollarSign} c="emerald"/><KC t="Avg CTR" v={`${avgCTR.toFixed(2)}%`} i={Target} c="amber"/>
    </div>
    <Card className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-4">
      <h3 className="text-xs font-medium text-white/70 mb-3">Monthly Ad Performance</h3>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={adMonthlyImpressions}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
          <XAxis dataKey="month" tick={{fill:'rgba(255,255,255,0.4)',fontSize:11}} axisLine={false} tickLine={false}/>
          <YAxis yAxisId="left" tick={{fill:'rgba(255,255,255,0.4)',fontSize:11}} axisLine={false} tickLine={false}/>
          <YAxis yAxisId="right" orientation="right" tick={{fill:'rgba(255,255,255,0.4)',fontSize:11}} axisLine={false} tickLine={false}/>
          <Tooltip content={<CTooltip/>}/>
          <Legend iconType="circle" iconSize={8} formatter={(v:string)=><span className="text-[10px] text-white/50">{v}</span>}/>
          <Bar yAxisId="left" dataKey="impressions" name="Impressions" fill="#ec4899" radius={[4,4,0,0]}/>
          <Line yAxisId="right" type="monotone" dataKey="clicks" name="Clicks" stroke="#06b6d4" strokeWidth={2} dot={{r:3,fill:'#06b6d4'}}/>
        </ComposedChart>
      </ResponsiveContainer>
    </CardContent></Card>
    <Card className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-4">
      <h3 className="text-xs font-medium text-white/70 mb-3">Revenue Trend</h3>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={adMonthlyImpressions}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
          <XAxis dataKey="month" tick={{fill:'rgba(255,255,255,0.4)',fontSize:11}} axisLine={false} tickLine={false}/>
          <YAxis tick={{fill:'rgba(255,255,255,0.4)',fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`TZS ${(v/1000000).toFixed(1)}M`}/>
          <Tooltip content={<CTooltip/>}/>
          <Bar dataKey="revenue" name="Revenue (TZS)" fill="#10b981" radius={[4,4,0,0]}/>
        </BarChart>
      </ResponsiveContainer>
    </CardContent></Card>
    <Card className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-4">
      <h3 className="text-xs font-medium text-white/70 mb-3">Top Performing Ads</h3>
      <div className="space-y-2">{ads.filter(a=>a.impressions>0).sort((a,b)=>(b.clicks/b.impressions)-(a.clicks/a.impressions)).map(a=>{
        const adv = advertisers.find(ad=>ad.id===a.advertiserId);
        const ctr = a.impressions>0?(a.clicks/a.impressions)*100:0;
        return <div key={a.id} className="flex items-center gap-3 p-2 bg-white/[0.03] rounded-lg">
          <div className="w-8 h-8 rounded bg-pink-500/10 flex items-center justify-center shrink-0"><Eye className="w-4 h-4 text-pink-400"/></div>
          <div className="flex-1 min-w-0"><div className="text-[11px] text-white/70 truncate">{a.title}</div><div className="text-[10px] text-white/30">{adv?.name}</div></div>
          <div className="text-right shrink-0"><div className="text-[11px] text-pink-400 font-medium">{ctr.toFixed(2)}% CTR</div><div className="text-[9px] text-white/30">{a.impressions.toLocaleString()} imp</div></div>
        </div>;
      })}</div>
    </CardContent></Card>
  </div></div>;
}

/* ─── AD SETTINGS / MONETIZATION TAB ─── */
function AdSettingsTab() {
  return <div className="h-full overflow-y-auto"><div className="p-4 space-y-4">
    <Card className="bg-gradient-to-br from-violet-500/[0.08] to-purple-500/[0.05] border-violet-500/15"><CardContent className="p-4">
      <div className="flex items-center gap-2"><DollarSign className="w-5 h-5 text-violet-400"/><h2 className="text-sm font-semibold text-white/90">Monetization Settings</h2></div>
      <p className="text-[10px] text-white/40 mt-1">Configure pricing tiers and ad serving rules</p>
    </CardContent></Card>
    <Card className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-4 space-y-3">
      <h3 className="text-xs font-medium text-white/70 mb-2">Pricing Tiers</h3>
      <div className="space-y-2">{pricingTiers.map(pt=>(
        <div key={pt.id} className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-lg">
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0"><DollarSign className="w-4 h-4 text-violet-400"/></div>
          <div className="flex-1 min-w-0"><div className="text-xs font-medium text-white/80">{pt.name}</div><div className="text-[10px] text-white/30">{pt.description}</div></div>
          <div className="text-right shrink-0"><div className="text-sm font-semibold text-violet-400">${pt.cpm}</div><div className="text-[9px] text-white/30">CPM</div></div>
          <div className="text-right shrink-0"><div className="text-sm font-semibold text-white/60">{tzs(pt.minBudget)}</div><div className="text-[9px] text-white/30">min</div></div>
        </div>
      ))}</div>
    </CardContent></Card>
    <Card className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-4 space-y-3">
      <h3 className="text-xs font-medium text-white/70 mb-2">Ad Serving Rules</h3>
      {[{label:'Admin approval required',desc:'All new ads must be approved before running',status:'Enabled'},{label:'Auto-pause on budget exceed',desc:'Campaigns pause when budget is reached',status:'Enabled'},{label:'Anti-spam protection',desc:'Block duplicate ad submissions',status:'Enabled'},{label:'Impression logging',desc:'Log every ad view for reporting',status:'Enabled'},{label:'Role-based access',desc:'Restrict ad management by user role',status:'Enabled'}].map(rule=>(
        <div key={rule.label} className="flex items-center justify-between p-2.5 bg-white/[0.03] rounded-lg">
          <div><div className="text-[11px] text-white/70">{rule.label}</div><div className="text-[10px] text-white/30">{rule.desc}</div></div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{rule.status}</span>
        </div>
      ))}
    </CardContent></Card>
    <Card className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-4 space-y-3">
      <h3 className="text-xs font-medium text-white/70 mb-2">Revenue Summary</h3>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-violet-500/[0.05] rounded-lg p-3 text-center"><div className="text-[10px] text-violet-400/50">This Month</div><div className="text-lg font-semibold text-violet-400">{tzs(2200000)}</div></div>
        <div className="bg-emerald-500/[0.05] rounded-lg p-3 text-center"><div className="text-[10px] text-emerald-400/50">Total Earned</div><div className="text-lg font-semibold text-emerald-400">{tzs(5650000)}</div></div>
        <div className="bg-blue-500/[0.05] rounded-lg p-3 text-center"><div className="text-[10px] text-blue-400/50">Active Ads</div><div className="text-lg font-semibold text-blue-400">{ads.filter(a=>a.status==='running').length}</div></div>
        <div className="bg-amber-500/[0.05] rounded-lg p-3 text-center"><div className="text-[10px] text-amber-400/50">Pending Review</div><div className="text-lg font-semibold text-amber-400">{ads.filter(a=>a.status==='pending').length}</div></div>
      </div>
    </CardContent></Card>
  </div></div>;
}

/* ─── PUBLIC PORTALS ─── */
function PortalsTab() {
  const launchApp = useOSStore(s => s.launchApp);
  const portals = [
    { id: 'cargo-welcome', label: 'KOBECARGO Welcome', desc: 'Public landing page', icon: Globe, color: 'from-emerald-500 to-teal-600', iconColor: 'text-emerald-400', bgColor: 'bg-emerald-500/10 hover:bg-emerald-500/20', borderColor: 'border-emerald-500/20 hover:border-emerald-500/40' },
    { id: 'cargo-sender', label: 'Cargo Sender', desc: 'Send parcels worldwide', icon: Send, color: 'from-blue-500 to-indigo-600', iconColor: 'text-blue-400', bgColor: 'bg-blue-500/10 hover:bg-blue-500/20', borderColor: 'border-blue-500/20 hover:border-blue-500/40' },
    { id: 'cargo-owner', label: 'Cargo Owner', desc: 'Track your shipments', icon: PackageSearch, color: 'from-violet-500 to-purple-600', iconColor: 'text-violet-400', bgColor: 'bg-violet-500/10 hover:bg-violet-500/20', borderColor: 'border-violet-500/20 hover:border-violet-500/40' },
    { id: 'cargo-driver', label: 'Cargo Driver', desc: 'Manage trips & earn', icon: Truck, color: 'from-amber-500 to-orange-600', iconColor: 'text-amber-400', bgColor: 'bg-amber-500/10 hover:bg-amber-500/20', borderColor: 'border-amber-500/20 hover:border-amber-500/40' },
    { id: 'cargo-receiver', label: 'Cargo Receiver', desc: 'Manage deliveries', icon: Inbox, color: 'from-pink-500 to-rose-600', iconColor: 'text-pink-400', bgColor: 'bg-pink-500/10 hover:bg-pink-500/20', borderColor: 'border-pink-500/20 hover:border-pink-500/40' },
    { id: 'cargo-company', label: 'Cargo Admin', desc: 'Company management', icon: Shield, color: 'from-rose-500 to-red-600', iconColor: 'text-rose-400', bgColor: 'bg-rose-500/10 hover:bg-rose-500/20', borderColor: 'border-rose-500/20 hover:border-rose-500/40' },
  ];
  return <div className="h-full overflow-y-auto"><div className="p-4 space-y-4">
    <Card className="bg-gradient-to-br from-emerald-500/[0.08] to-teal-500/[0.05] border-emerald-500/15"><CardContent className="p-4">
      <div className="flex items-center gap-2"><Globe className="w-5 h-5 text-emerald-400"/><h2 className="text-sm font-semibold text-white/90">Public Portals</h2></div>
      <p className="text-[10px] text-white/40 mt-1">Launch external-facing cargo apps — accessible to senders, owners, drivers, and receivers</p>
    </CardContent></Card>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {portals.map(p => (
        <button key={p.id} onClick={() => launchApp(p.id)} className={`group flex flex-col items-center gap-3 p-5 rounded-xl ${p.bgColor} border ${p.borderColor} transition-all text-left hover:scale-[1.02] active:scale-[0.98]`}>
          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${p.color} flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow`}>
            <p.icon className="w-7 h-7 text-white" />
          </div>
          <div className="text-center">
            <div className={`text-sm font-semibold text-white/90 group-hover:${p.iconColor} transition-colors`}>{p.label}</div>
            <div className="text-[11px] text-white/40 mt-0.5">{p.desc}</div>
          </div>
          <ArrowRight className={`w-4 h-4 ${p.iconColor} opacity-0 group-hover:opacity-100 transition-opacity mt-1`} />
        </button>
      ))}
    </div>
    <Card className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-4 space-y-3">
      <h3 className="text-xs font-medium text-white/70 mb-2">Portal Access Guide</h3>
      {[
        { role: 'Sender', access: 'Public — anyone can send parcels', icon: Send, color: 'text-blue-400' },
        { role: 'Owner', access: 'Public — track by phone or parcel ID', icon: PackageSearch, color: 'text-violet-400' },
        { role: 'Driver', access: 'Public — manage trips and earn rewards', icon: Truck, color: 'text-amber-400' },
        { role: 'Receiver', access: 'Admin-created accounts only', icon: Inbox, color: 'text-pink-400' },
      ].map(g => (
        <div key={g.role} className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-lg">
          <div className={`w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0`}><g.icon className={`w-4 h-4 ${g.color}`}/></div>
          <div className="flex-1 min-w-0"><div className="text-xs font-medium text-white/80">{g.role}</div><div className="text-[10px] text-white/35">{g.access}</div></div>
        </div>
      ))}
    </CardContent></Card>
  </div></div>;
}

/* ─── TILE DATA FOR SIDEBAR ─── */
const cargoSections = [
  {
    title: 'Overview',
    tiles: [
      { key: 'dashboard' as Tab, label: 'Command', desc: 'Central dashboard', icon: Gauge, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    ],
  },
  {
    title: 'Intelligence',
    tiles: [
      { key: 'insights' as Tab, label: 'AI Insights', desc: 'Predictive analytics', icon: BrainCircuit, color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
      { key: 'analytics' as Tab, label: 'Analytics', desc: 'Charts & reports', icon: BarChart3, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
      { key: 'timeline' as Tab, label: 'Timeline', desc: 'Activity history', icon: Clock, color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/20' },
    ],
  },
  {
    title: 'Operations',
    tiles: [
      { key: 'shipments' as Tab, label: 'Shipments', desc: 'Cargo management', icon: Package, color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20' },
      { key: 'customs' as Tab, label: 'Customs', desc: 'Clearance & duties', icon: ShieldCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
      { key: 'warehouse' as Tab, label: 'Warehouse', desc: 'Bins, ULDs & storage', icon: Warehouse, color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/20' },
      { key: 'flights' as Tab, label: 'Flights', desc: 'Air cargo scheduling', icon: PlaneTakeoff, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
      { key: 'network' as Tab, label: 'Network', desc: 'Route visualization', icon: Route, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
    ],
  },
  {
    title: 'Tracking & Delivery',
    tiles: [
      { key: 'tracking' as Tab, label: 'Tracking', desc: 'Real-time parcel track', icon: MapPin, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
      { key: 'delivery' as Tab, label: 'Delivery', desc: 'Last-mile logistics', icon: Truck, color: 'text-lime-400', bg: 'bg-lime-500/10', border: 'border-lime-500/20' },
      { key: 'payments' as Tab, label: 'Payments', desc: 'Wallets & transactions', icon: Wallet, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
    ],
  },
  {
    title: 'Tools',
    tiles: [
      { key: 'rates' as Tab, label: 'Rate Calc', desc: 'Pricing calculator', icon: Calculator, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
      { key: 'documents' as Tab, label: 'Documents', desc: 'BLs, AWBs & invoices', icon: FileText, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    ],
  },
  {
    title: 'Ad Network',
    tiles: [
      { key: 'campaigns' as Tab, label: 'Campaigns', desc: 'Ad campaign manager', icon: Megaphone, color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20' },
      { key: 'adlibrary' as Tab, label: 'Ad Library', desc: 'Browse all ads', icon: Eye, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
      { key: 'advertisers' as Tab, label: 'Advertisers', desc: 'Client management', icon: Users, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
      { key: 'adanalytics' as Tab, label: 'Ad Analytics', desc: 'Performance metrics', icon: BarChart3, color: 'text-red-300', bg: 'bg-red-400/10', border: 'border-red-400/20' },
      { key: 'adsettings' as Tab, label: 'Monetize', desc: 'Pricing & rules', icon: DollarSign, color: 'text-orange-300', bg: 'bg-orange-400/10', border: 'border-orange-400/20' },
    ],
  },
  {
    title: 'Domestic',
    tiles: [
      { key: 'cargo_tz' as Tab, label: 'Cargo TZ', desc: 'Tanzania local transport', icon: Navigation, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    ],
  },
  {
    title: 'Public Portals',
    tiles: [
      { key: 'portals' as Tab, label: 'Portals', desc: 'External-facing apps', icon: Globe, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    ],
  },
];

/* ─── SIDEBAR COMPONENT ─── */
function CargoSidebar({ activeTab, onTabChange }: { activeTab: Tab; onTabChange: (t: Tab) => void }) {
  return (
    <div className="w-64 h-full flex flex-col bg-[#0c0c1a] border-r border-white/[0.06]">
      {/* Header */}
      <div className="shrink-0 px-4 py-3.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Plane className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white/90">KOBECARGO</h1>
            <p className="text-[9px] text-white/30">Enterprise Cargo Intelligence</p>
          </div>
        </div>
      </div>

      {/* Tile Navigation */}
      <div className="flex-1 overflow-y-auto py-2">
        <div className="px-3 space-y-4">
          {cargoSections.map((section) => (
            <div key={section.title}>
              <div className="px-2 mb-1.5 text-[10px] font-semibold text-white/25 uppercase tracking-widest">
                {section.title}
              </div>
              <div className="grid grid-cols-1 gap-1">
                {section.tiles.map((tile) => {
                  const isActive = activeTab === tile.key;
                  return (
                    <button
                      key={tile.key}
                      onClick={() => onTabChange(tile.key)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all group ${
                        isActive
                          ? `${tile.bg} border ${tile.border} shadow-sm`
                          : 'bg-white/[0.02] border border-transparent hover:bg-white/[0.05] hover:border-white/[0.06]'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg ${tile.bg} flex items-center justify-center shrink-0 transition-transform group-hover:scale-105`}>
                        <tile.icon className={`w-[16px] h-[16px] ${tile.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-[11px] font-medium ${isActive ? 'text-white/90' : 'text-white/65 group-hover:text-white/85'}`}>
                          {tile.label}
                        </div>
                        <div className="text-[9px] text-white/25 truncate leading-tight">
                          {tile.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── MAIN SHELL ─── */
type Tab = 'dashboard' | 'shipments' | 'customs' | 'warehouse' | 'flights' | 'payments' | 'tracking' | 'delivery' | 'network' | 'insights' | 'analytics' | 'timeline' | 'rates' | 'documents' | 'campaigns' | 'adlibrary' | 'advertisers' | 'adanalytics' | 'adsettings' | 'cargo_tz' | 'portals';
export default function KOBECARGO() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [search, setSearch] = useState('');
  const [showAlerts, setShowAlerts] = useState(false);
  const alerts = useMemo(() => generateAlerts(), []);
  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const aiCount = generateAIInsights().length;

  const render = (t: Tab) => {
    switch (t) {
      case 'dashboard': return <CommandDashboard />;
      case 'insights': return <AIInsightsTab />;
      case 'analytics': return <AnalyticsTab />;
      case 'timeline': return <TimelineTab />;
      case 'shipments': return <ShipmentsTab search={search} />;
      case 'customs': return <CustomsTab search={search} />;
      case 'warehouse': return <WarehouseTab search={search} />;
      case 'flights': return <FlightsTab search={search} />;
      case 'payments': return <PaymentsTab />;
      case 'tracking': return <TrackingTab search={search} />;
      case 'delivery': return <DeliveryTab search={search} />;
      case 'network': return <NetworkMapTab />;
      case 'rates': return <RateCalculatorTab />;
      case 'documents': return <DocumentsTab />;
      case 'campaigns': return <AdCampaignsTab />;
      case 'adlibrary': return <AdLibraryTab />;
      case 'advertisers': return <AdvertisersTab />;
      case 'adanalytics': return <AdAnalyticsTab />;
      case 'adsettings': return <AdSettingsTab />;
      case 'cargo_tz': return <CargoTZ />;
      case 'portals': return <PortalsTab />;
    }
  };

  return (
    <div className="h-full flex bg-[#0a0a1a] text-white/90">
      {/* Left Sidebar - Tile Grid */}
      <CargoSidebar activeTab={tab} onTabChange={setTab} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <div className="shrink-0 px-4 pt-3 pb-2 flex items-center justify-between gap-3 border-b border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/[0.08] border border-indigo-500/15">
              <BrainCircuit className="w-3 h-3 text-indigo-400" />
              <span className="text-[10px] text-indigo-300">{aiCount} AI insights</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Alerts Bell */}
            <div className="relative">
              <button onClick={() => setShowAlerts(!showAlerts)} className={`relative p-2 rounded-xl transition-all ${showAlerts ? 'bg-indigo-500/15 text-indigo-400' : 'bg-white/[0.04] text-white/40 hover:text-white/60 hover:bg-white/[0.06]'}`}>
                <Bell className="w-4 h-4" />
                {criticalCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{criticalCount}</span>}
              </button>
              {showAlerts && <AlertsPanel onClose={() => setShowAlerts(false)} />}
            </div>
            {/* Search */}
            <div className="relative w-48 sm:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <Input placeholder="Search shipments, AWBs..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 pl-8 pr-3 text-xs bg-white/[0.04] border-white/[0.06] text-white/80 placeholder:text-white/25 rounded-xl w-full" />
            </div>
          </div>
        </div>
        {/* Content Area */}
        <div className="flex-1 min-h-0 overflow-hidden relative">
          {render(tab)}
          {showAlerts && <div className="absolute inset-0 z-40" onClick={() => setShowAlerts(false)} />}
        </div>
      </div>
    </div>
  );
}
