import { useState, useMemo } from 'react';
import {
  Plane, BarChart3, Package, ShieldCheck, Warehouse, PlaneTakeoff,
  Wallet, MapPin, Truck, Search, CheckCircle2, ArrowRight,
  CircleDot, Circle, DollarSign, QrCode, Phone, Calendar,
  Container, ScanLine, Weight, Ruler, Receipt, CreditCard,
  Banknote, Smartphone, Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { QRCodeSVG } from 'qrcode.react';

/* ─── TYPES ─── */
type SS = 'DRAFT'|'ORIGIN'|'EXPORT_CUSTOMS'|'IN_TRANSIT'|'ARRIVED'|'IMPORT_CUSTOMS'|'DESTINATION'|'OUT_FOR_DELIVERY'|'DELIVERED'|'CANCELLED';
type SP = 'STANDARD'|'EXPRESS'|'URGENT';
type CL = 'GREEN'|'YELLOW'|'RED';
type PS = 'RECEIVED'|'WEIGHED'|'IN_BIN'|'IN_ULD'|'ON_FLIGHT'|'ARRIVED'|'AT_DESTINATION'|'OUT_FOR_DELIVERY'|'DELIVERED';
type PM = 'Bank Transfer'|'Mobile Money'|'Cash'|'Card';

interface Shipment { id:string; number:string; status:SS; priority:SP; cargoType:string; masterAWB:string; houseAWB:string; declaredValue:number; currency:string; actualWeight:number; origin:string; destination:string; portCode:string; customer:string; supplier:string; createdAt:string; etd:string; eta:string; packages:number; value:number; }
interface CClear { jurisdiction:'CHINA_EXPORT'|'TANZANIA_IMPORT'; portCode:string; status:string; riskScore:number; dutiesEstimated:number; dutiesPaid:number; lane:CL; inspection:boolean; taxDispute:boolean; }
interface Pkg { id:string; qrCode:string; description:string; weight:number; status:PS; shipmentId:string; binNumber?:string; uldNumber?:string; dims:string; }
interface Bin { id:string; number:string; warehouse:string; status:string; weight:number; packages:number; }
interface ULD { id:string; number:string; uldType:string; flight:string; status:string; weight:number; capacity:number; }
interface Flight { id:string; number:string; airline:string; origin:string; destination:string; transit?:string; etd:string; eta:string; status:string; ulds:number; weight:number; capacity:number; }
interface TEvent { id:string; shipmentId:string; type:string; location:string; timestamp:string; }
interface Wallet { id:string; customer:string; balanceTZS:number; balanceUSD:number; held:number; }
interface Transaction { id:string; walletId:string; amount:number; type:'CREDIT'|'DEBIT'; method:PM; description:string; date:string; status:string; }
interface Delivery { id:string; shipmentId:string; driver:string; phone:string; vehicle:string; status:string; address:string; started:string; delivered?:string; recipient?:string; }

/* ─── DATA ─── */
const shipments:Shipment[]=[
  {id:'s1',number:'SHP-2025-001',status:'DELIVERED',priority:'STANDARD',cargoType:'Electronics',masterAWB:'607-12345678',houseAWB:'KBE001',declaredValue:45000,currency:'USD',actualWeight:1250,origin:'Guangzhou (CAN)',destination:'Dar es Salaam (DAR)',portCode:'CAN→DAR',customer:'KOBEPay Tech',supplier:'Shenzhen Electronics Ltd',createdAt:'Apr 1',etd:'Apr 5',eta:'Apr 12',packages:12,value:45000},
  {id:'s2',number:'SHP-2025-002',status:'IMPORT_CUSTOMS',priority:'EXPRESS',cargoType:'Textiles',masterAWB:'875-87654321',houseAWB:'KBE002',declaredValue:28000,currency:'USD',actualWeight:890,origin:'Guangzhou (CAN)',destination:'Dar es Salaam (DAR)',portCode:'CAN→DAR',customer:'Safari Logistics',supplier:'Guangzhou Textile Co',createdAt:'Apr 10',etd:'Apr 15',eta:'Apr 22',packages:8,value:28000},
  {id:'s3',number:'SHP-2025-003',status:'IN_TRANSIT',priority:'STANDARD',cargoType:'Machinery Parts',masterAWB:'607-55556666',houseAWB:'KBE003',declaredValue:62000,currency:'USD',actualWeight:2100,origin:'Hong Kong (HKG)',destination:'Zanzibar (ZNZ)',portCode:'HKG→ZNZ',customer:'Bongo Foods',supplier:'Dongguan Heavy Industry',createdAt:'Apr 20',etd:'Apr 25',eta:'May 3',packages:5,value:62000},
  {id:'s4',number:'SHP-2025-004',status:'EXPORT_CUSTOMS',priority:'URGENT',cargoType:'Pharmaceuticals',masterAWB:'875-11112222',houseAWB:'KBE004',declaredValue:85000,currency:'USD',actualWeight:340,origin:'Guangzhou (CAN)',destination:'Dar es Salaam (DAR)',portCode:'CAN→DAR',customer:'Nuru Enterprises',supplier:'Shanghai Pharma Inc',createdAt:'May 1',etd:'May 8',eta:'May 15',packages:3,value:85000},
  {id:'s5',number:'SHP-2025-005',status:'ORIGIN',priority:'STANDARD',cargoType:'Consumer Goods',masterAWB:'607-99998888',houseAWB:'KBE005',declaredValue:15000,currency:'USD',actualWeight:560,origin:'Shenzhen (SZX)',destination:'Dar es Salaam (DAR)',portCode:'SZX→DAR',customer:'Mwangala Traders',supplier:'Yiwu Wholesale Market',createdAt:'May 5',etd:'May 12',eta:'May 20',packages:15,value:15000},
  {id:'s6',number:'SHP-2025-006',status:'DESTINATION',priority:'EXPRESS',cargoType:'Auto Parts',masterAWB:'875-44447777',houseAWB:'KBE006',declaredValue:38000,currency:'USD',actualWeight:1780,origin:'Guangzhou (CAN)',destination:'Dar es Salaam (DAR)',portCode:'CAN→DAR',customer:'Diamond Imports TZ',supplier:'Foshan Auto Parts Ltd',createdAt:'Apr 18',etd:'Apr 22',eta:'Apr 30',packages:7,value:38000},
];
const customsData:Record<string,{export:CClear;import:CClear}>={
  s1:{export:{jurisdiction:'CHINA_EXPORT',portCode:'CAN',status:'CLEARED',riskScore:15,dutiesEstimated:0,dutiesPaid:0,lane:'GREEN',inspection:false,taxDispute:false},import:{jurisdiction:'TANZANIA_IMPORT',portCode:'DAR',status:'CLEARED',riskScore:22,dutiesEstimated:7200,dutiesPaid:7200,lane:'GREEN',inspection:false,taxDispute:false}},
  s2:{export:{jurisdiction:'CHINA_EXPORT',portCode:'CAN',status:'CLEARED',riskScore:25,dutiesEstimated:0,dutiesPaid:0,lane:'GREEN',inspection:false,taxDispute:false},import:{jurisdiction:'TANZANIA_IMPORT',portCode:'DAR',status:'INSPECTION_TRIGGERED',riskScore:68,dutiesEstimated:4200,dutiesPaid:0,lane:'YELLOW',inspection:true,taxDispute:false}},
  s3:{export:{jurisdiction:'CHINA_EXPORT',portCode:'HKG',status:'CLEARED',riskScore:30,dutiesEstimated:0,dutiesPaid:0,lane:'GREEN',inspection:false,taxDispute:false},import:{jurisdiction:'TANZANIA_IMPORT',portCode:'ZNZ',status:'PENDING_DOCS',riskScore:55,dutiesEstimated:8900,dutiesPaid:0,lane:'YELLOW',inspection:false,taxDispute:false}},
  s4:{export:{jurisdiction:'CHINA_EXPORT',portCode:'CAN',status:'INSPECTION_TRIGGERED',riskScore:78,dutiesEstimated:0,dutiesPaid:0,lane:'RED',inspection:true,taxDispute:false},import:{jurisdiction:'TANZANIA_IMPORT',portCode:'DAR',status:'PENDING_DOCS',riskScore:82,dutiesEstimated:15200,dutiesPaid:0,lane:'RED',inspection:false,taxDispute:true}},
  s5:{export:{jurisdiction:'CHINA_EXPORT',portCode:'SZX',status:'PENDING_DOCS',riskScore:35,dutiesEstimated:0,dutiesPaid:0,lane:'GREEN',inspection:false,taxDispute:false},import:{jurisdiction:'TANZANIA_IMPORT',portCode:'DAR',status:'PENDING_DOCS',riskScore:40,dutiesEstimated:2800,dutiesPaid:0,lane:'GREEN',inspection:false,taxDispute:false}},
  s6:{export:{jurisdiction:'CHINA_EXPORT',portCode:'CAN',status:'CLEARED',riskScore:28,dutiesEstimated:0,dutiesPaid:0,lane:'GREEN',inspection:false,taxDispute:false},import:{jurisdiction:'TANZANIA_IMPORT',portCode:'DAR',status:'CLEARED',riskScore:35,dutiesEstimated:6800,dutiesPaid:6800,lane:'GREEN',inspection:false,taxDispute:false}},
};
const packages:Pkg[]=[
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
const bins:Bin[]=[
  {id:'b1',number:'BIN-001',warehouse:'CAN-WH-01',status:'LOADED',weight:77,packages:2},
  {id:'b2',number:'BIN-002',warehouse:'CAN-WH-01',status:'LOADED',weight:18,packages:1},
  {id:'b3',number:'BIN-003',warehouse:'CAN-WH-02',status:'LOADED',weight:400,packages:2},
  {id:'b4',number:'BIN-004',warehouse:'HKG-WH-01',status:'ASSEMBLING',weight:1270,packages:2},
];
const ulds:ULD[]=[
  {id:'u1',number:'PMC001',uldType:'PMC',flight:'ET607',status:'IN_FLIGHT',weight:95,capacity:5000},
  {id:'u2',number:'AKE001',uldType:'AKE',flight:'QR875',status:'IN_FLIGHT',weight:400,capacity:1500},
  {id:'u3',number:'PAG001',uldType:'PAG',flight:'ET631',status:'WAITING',weight:0,capacity:3000},
];
const flights:Flight[]=[
  {id:'f1',number:'ET607',airline:'Ethiopian Airlines',origin:'CAN',destination:'DAR',transit:'ADD',etd:'Apr 5 14:30',eta:'Apr 12 06:45',status:'IN_FLIGHT',ulds:2,weight:3200,capacity:15000},
  {id:'f2',number:'QR875',airline:'Qatar Airways',origin:'CAN',destination:'DAR',transit:'DOH',etd:'Apr 15 22:15',eta:'Apr 22 08:30',status:'IN_FLIGHT',ulds:1,weight:800,capacity:12000},
  {id:'f3',number:'ET631',airline:'Ethiopian Airlines',origin:'HKG',destination:'ZNZ',transit:'ADD',etd:'Apr 25 09:00',eta:'May 3 14:20',status:'SCHEDULED',ulds:0,weight:0,capacity:10000},
  {id:'f4',number:'QR891',airline:'Qatar Airways',origin:'SZX',destination:'DAR',transit:'DOH',etd:'May 12 18:45',eta:'May 20 11:00',status:'DELAYED',ulds:0,weight:0,capacity:18000},
];
const trackingEvents:TEvent[]=[
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
const wallets:Wallet[]=[
  {id:'w1',customer:'KOBEPay Tech',balanceTZS:45200000,balanceUSD:17200,held:5000000},
  {id:'w2',customer:'Safari Logistics',balanceTZS:12800000,balanceUSD:4800,held:2000000},
  {id:'w3',customer:'Bongo Foods',balanceTZS:8500000,balanceUSD:3200,held:0},
  {id:'w4',customer:'Nuru Enterprises',balanceTZS:2100000,balanceUSD:800,held:1500000},
];
const transactions:Transaction[]=[
  {id:'tx1',walletId:'w1',amount:4500000,type:'DEBIT',method:'Bank Transfer',description:'Shipping SHP-2025-001',date:'Apr 2',status:'Paid'},
  {id:'tx2',walletId:'w1',amount:7200000,type:'CREDIT',method:'Bank Transfer',description:'Customs duty',date:'Apr 13',status:'Paid'},
  {id:'tx3',walletId:'w2',amount:2800000,type:'DEBIT',method:'Mobile Money',description:'Freight SHP-2025-002',date:'Apr 11',status:'Paid'},
  {id:'tx4',walletId:'w2',amount:4200000,type:'CREDIT',method:'Mobile Money',description:'Import duty DAR',date:'Apr 20',status:'Pending'},
  {id:'tx5',walletId:'w3',amount:6200000,type:'DEBIT',method:'Bank Transfer',description:'Freight SHP-2025-003',date:'Apr 22',status:'Paid'},
  {id:'tx6',walletId:'w3',amount:8900000,type:'CREDIT',method:'Bank Transfer',description:'Customs duty ZNZ',date:'Apr 28',status:'Pending'},
  {id:'tx7',walletId:'w4',amount:8500000,type:'DEBIT',method:'Card',description:'Express freight',date:'May 2',status:'Paid'},
  {id:'tx8',walletId:'w4',amount:15200000,type:'CREDIT',method:'Card',description:'Import duty + dispute',date:'May 8',status:'Overdue'},
  {id:'tx9',walletId:'w1',amount:3200000,type:'DEBIT',method:'Mobile Money',description:'Storage fees',date:'Apr 15',status:'Paid'},
  {id:'tx10',walletId:'w2',amount:1800000,type:'DEBIT',method:'Cash',description:'Last mile delivery',date:'Apr 18',status:'Paid'},
];
const deliveries:Delivery[]=[
  {id:'d1',shipmentId:'s1',driver:'Hassan Juma',phone:'+255 713 456 789',vehicle:'KBR 1234 (Isuzu)',status:'DELIVERED',address:'Plot 45, Kariakoo, Dar es Salaam',started:'Apr 14 08:00',delivered:'Apr 14 16:45',recipient:'James Mwakasege'},
  {id:'d2',shipmentId:'s6',driver:'Peter Omari',phone:'+255 714 567 890',vehicle:'KCR 5678 (Toyota)',status:'OUT_FOR_DELIVERY',address:'12 Masaki Road, Oysterbay',started:'May 1 09:30'},
  {id:'d3',shipmentId:'s3',driver:'David Kimaro',phone:'+255 715 678 901',vehicle:'KDR 9012 (Fuso)',status:'ASSIGNED',address:'Mikocheni Industrial Area',started:'Apr 28 10:00'},
  {id:'d4',shipmentId:'s2',driver:'Ali Hassan',phone:'+255 716 789 012',vehicle:'KER 3456 (Tata)',status:'FAILED',address:'Mzizima Towers, Upanga',started:'Apr 24 14:00',delivered:'Apr 24 18:00'},
];

/* ─── HELPERS ─── */
const tzs=(n:number)=>`TZS ${n.toLocaleString()}`;
const usd=(n:number)=>`$${n.toLocaleString()}`;
const sc:Record<string,string>={
  DRAFT:'bg-gray-500/15 text-gray-400',ORIGIN:'bg-blue-500/15 text-blue-400',
  EXPORT_CUSTOMS:'bg-amber-500/15 text-amber-400',IN_TRANSIT:'bg-indigo-500/15 text-indigo-400',
  ARRIVED:'bg-violet-500/15 text-violet-400',IMPORT_CUSTOMS:'bg-orange-500/15 text-orange-400',
  DESTINATION:'bg-cyan-500/15 text-cyan-400',OUT_FOR_DELIVERY:'bg-pink-500/15 text-pink-400',
  DELIVERED:'bg-emerald-500/15 text-emerald-400',CANCELLED:'bg-red-500/15 text-red-400',
  STANDARD:'bg-blue-500/15 text-blue-400',EXPRESS:'bg-amber-500/15 text-amber-400',URGENT:'bg-red-500/15 text-red-400',
  CLEARED:'bg-emerald-500/15 text-emerald-400',PENDING_DOCS:'bg-amber-500/15 text-amber-400',
  INSPECTION_TRIGGERED:'bg-orange-500/15 text-orange-400',HELD:'bg-red-500/15 text-red-400',
  'TAX_DISPUTE':'bg-red-500/20 text-red-400',
  Paid:'bg-emerald-500/15 text-emerald-400',Pending:'bg-amber-500/15 text-amber-400',Overdue:'bg-red-500/15 text-red-400',
  GREEN:'bg-emerald-500/15 text-emerald-400',YELLOW:'bg-amber-500/15 text-amber-400',RED:'bg-red-500/15 text-red-400',
  ASSIGNED:'bg-blue-500/15 text-blue-400',PICKED_UP:'bg-indigo-500/15 text-indigo-400',
  IN_TRANSIT_L:'bg-violet-500/15 text-violet-400',OUT_FOR_DELIVERY_L:'bg-pink-500/15 text-pink-400',
  DELIVERED_L:'bg-emerald-500/15 text-emerald-400',FAILED:'bg-red-500/15 text-red-400',
  SCHEDULED:'bg-blue-500/15 text-blue-400',BOARDING:'bg-amber-500/15 text-amber-400',
  IN_FLIGHT:'bg-indigo-500/15 text-indigo-400',ARRIVED_F:'bg-emerald-500/15 text-emerald-400',
  DELAYED:'bg-orange-500/15 text-orange-400',CANCELLED_F:'bg-red-500/15 text-red-400',
  'WAITING':'bg-blue-500/15 text-blue-400',LOADING:'bg-amber-500/15 text-amber-400',
  LOADED:'bg-emerald-500/15 text-emerald-400',UNLOADED:'bg-cyan-500/15 text-cyan-400',
  'ASSEMBLING':'bg-blue-500/15 text-blue-400',SEALED:'bg-emerald-500/15 text-emerald-400',
  RECEIVED:'bg-blue-500/15 text-blue-400',WEIGHED:'bg-amber-500/15 text-amber-400',
  IN_BIN:'bg-indigo-500/15 text-indigo-400',IN_ULD:'bg-violet-500/15 text-violet-400',
  ON_FLIGHT:'bg-pink-500/15 text-pink-400',AT_DESTINATION:'bg-cyan-500/15 text-cyan-400',
};
const SB=({s}:{s:string})=><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border border-white/[0.06] ${sc[s]||'bg-gray-500/15 text-gray-400'}`}>{s.replace(/_/g,' ')}</span>;
const KC=({t,v,su,i:I,c='blue'}:{t:string;v:string;su?:string;i:any;c?:string})=>{
  const m:Record<string,string>={blue:'text-blue-400',emerald:'text-emerald-400',amber:'text-amber-400',red:'text-red-400',indigo:'text-indigo-400',violet:'text-violet-400'};
  return<Card className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-3"><div className="flex items-start justify-between mb-2"><span className="text-[10px] text-white/40 font-medium">{t}</span><I className={`w-4 h-4 ${m[c]||'text-white/40'}`}/></div><div className="text-sm font-semibold text-white/90">{v}</div>{su&&<div className="text-[10px] text-white/30 mt-0.5">{su}</div>}</CardContent></Card>;
};

/* ─── DASHBOARD ─── */
function DashboardTab(){
  const active=shipments.filter(s=>s.status!=='DELIVERED'&&s.status!=='CANCELLED').length;
  const inTransit=shipments.filter(s=>s.status==='IN_TRANSIT'||s.status==='ARRIVED').length;
  const atCustoms=shipments.filter(s=>s.status==='EXPORT_CUSTOMS'||s.status==='IMPORT_CUSTOMS').length;
  const revenue=shipments.reduce((s,sh)=>s+sh.value,0);
  const pipeline=['ORIGIN','EXPORT_CUSTOMS','IN_TRANSIT','IMPORT_CUSTOMS','OUT_FOR_DELIVERY','DELIVERED'];
  const green=Object.values(customsData).filter(c=>c.import.lane==='GREEN').length;
  const yellow=Object.values(customsData).filter(c=>c.import.lane==='YELLOW').length;
  const red=Object.values(customsData).filter(c=>c.import.lane==='RED').length;
  const collected=transactions.filter(t=>t.status==='Paid').reduce((s,t)=>s+t.amount,0);
  const pendingAmt=transactions.filter(t=>t.status==='Pending').reduce((s,t)=>s+t.amount,0);
  const overdueAmt=transactions.filter(t=>t.status==='Overdue').reduce((s,t)=>s+t.amount,0);
  return<ScrollArea className="h-full"><div className="p-4 space-y-4">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <KC t="Active" v={active.toString()} su={`of ${shipments.length} total`} i={Package} c="blue"/>
      <KC t="In Transit" v={inTransit.toString()} su="en route" i={Plane} c="indigo"/>
      <KC t="At Customs" v={atCustoms.toString()} su="awaiting clearance" i={ShieldCheck} c="amber"/>
      <KC t="Revenue" v={usd(revenue)} su="2025 shipments" i={DollarSign} c="emerald"/>
    </div>
    <Card className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-4">
      <h3 className="text-xs font-medium text-white/70 mb-3">Shipment Pipeline</h3>
      <div className="flex items-center gap-1">
        {pipeline.map((stage,idx)=>{const c=shipments.filter(s=>s.status===stage).length;const colors=['bg-blue-500','bg-amber-500','bg-indigo-500','bg-orange-500','bg-pink-500','bg-emerald-500'];return<div key={stage} className="flex-1 flex flex-col items-center relative">
          <div className={`w-6 h-6 rounded-full ${colors[idx]} flex items-center justify-center text-[10px] font-bold text-white mb-1`}>{c}</div>
          <span className="text-[9px] text-white/40 text-center hidden sm:block">{stage.replace(/_/g,' ')}</span>
          {idx<pipeline.length-1&&<ArrowRight className="w-3 h-3 text-white/20 absolute -right-1.5 top-1.5"/>}
        </div>;})}
      </div>
    </CardContent></Card>
    <Card className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-4">
      <h3 className="text-xs font-medium text-white/70 mb-3">Recent Shipments</h3>
      <div className="space-y-2">{shipments.slice(0,5).map(s=><div key={s.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.02]">
        <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0"><Package className="w-4 h-4 text-white/40"/></div>
        <div className="flex-1 min-w-0"><div className="text-[11px] text-white/70 truncate">{s.number} &middot; {s.customer}</div><div className="text-[10px] text-white/30">{s.origin} → {s.destination}</div></div>
        <SB s={s.status}/><span className="text-[10px] text-white/40 shrink-0">{s.eta}</span>
      </div>)}</div>
    </CardContent></Card>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Card className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-4">
        <h3 className="text-xs font-medium text-white/70 mb-3">Customs Lanes</h3>
        <div className="space-y-2">
          {[{label:'Green',count:green,c:'emerald'},{label:'Yellow',count:yellow,c:'amber'},{label:'Red',count:red,c:'red'}].map(l=><div key={l.label}>
            <div className="flex items-center justify-between"><span className={`text-[11px] text-${l.c}-400`}>{l.label}</span><span className={`text-sm font-semibold text-${l.c}-400`}>{l.count}</span></div>
            <div className="h-2 rounded-full bg-white/[0.06]"><div className={`h-full rounded-full bg-${l.c}-500`} style={{width:`${(l.count/6)*100}%`}}/></div>
          </div>)}
        </div>
      </CardContent></Card>
      <Card className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-4">
        <h3 className="text-xs font-medium text-white/70 mb-3">Payments</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/[0.05]"><span className="text-[11px] text-emerald-400">Collected</span><span className="text-sm font-semibold text-emerald-400">{tzs(collected)}</span></div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-amber-500/[0.05]"><span className="text-[11px] text-amber-400">Pending</span><span className="text-sm font-semibold text-amber-400">{tzs(pendingAmt)}</span></div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-red-500/[0.05]"><span className="text-[11px] text-red-400">Overdue</span><span className="text-sm font-semibold text-red-400">{tzs(overdueAmt)}</span></div>
        </div>
      </CardContent></Card>
    </div>
  </div></ScrollArea>;
}

/* ─── SHIPMENTS ─── */
function ShipmentsTab({search}:{search:string}){
  const[f,setF]=useState('ALL');
  const[view,setView]=useState<Shipment|null>(null);
  const filtered=useMemo(()=>shipments.filter(s=>{const ms=!search||s.number.toLowerCase().includes(search.toLowerCase())||s.customer.toLowerCase().includes(search.toLowerCase());const mf=f==='ALL'||s.status===f;return ms&&mf;}),[search,f]);
  const filters=['ALL','ORIGIN','EXPORT_CUSTOMS','IN_TRANSIT','IMPORT_CUSTOMS','DESTINATION','DELIVERED'];
  return<ScrollArea className="h-full"><div className="p-4 space-y-3">
    <div className="flex gap-1 overflow-x-auto scrollbar-hide">{filters.map(fi=><button key={fi} onClick={()=>setF(fi)} className={`px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all ${f===fi?'bg-blue-500/15 text-blue-400 border border-blue-500/20':'text-white/35 hover:text-white/50 border border-transparent'}`}>{fi.replace(/_/g,' ')}</button>)}</div>
    {filtered.map(s=>{const cc=customsData[s.id];return<Card key={s.id} className="bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05] transition-all cursor-pointer" onClick={()=>setView(s)}><CardContent className="p-3">
      <div className="flex items-start justify-between mb-2"><div><div className="flex items-center gap-2"><span className="text-xs font-medium text-white/80">{s.number}</span><SB s={s.priority}/></div><div className="text-[10px] text-white/30 mt-0.5">{s.customer}</div></div><SB s={s.status}/></div>
      <div className="flex items-center gap-2 mb-2"><span className="text-[11px] text-white/50">{s.origin}</span><ArrowRight className="w-3 h-3 text-white/20"/><span className="text-[11px] text-white/50">{s.destination}</span></div>
      <div className="flex items-center gap-3 text-[10px] text-white/30"><span>{s.cargoType}</span><span>{s.packages} pkgs</span><span>{s.actualWeight}kg</span><span>ETA:{s.eta}</span></div>
      {cc&&<div className="flex gap-2 mt-2"><SB s={cc.export.lane}/><span className="text-[10px] text-white/30">Risk:{cc.export.riskScore}</span><span className="text-[10px] text-white/30 ml-auto">AWB:{s.masterAWB}</span></div>}
    </CardContent></Card>})}
    <Dialog open={!!view} onOpenChange={()=>setView(null)}><DialogContent className="bg-[#0f0f1a] border-white/[0.08] text-white max-w-lg max-h-[85vh] overflow-y-auto">
      {view&&(()=>{const cc=customsData[view.id];const sp=packages.filter(p=>p.shipmentId===view.id);return<>
        <DialogHeader><DialogTitle className="text-sm">Shipment {view.number}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-[11px]">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/[0.03] rounded-lg p-2"><div className="text-white/40">Customer</div><div className="text-white/80 font-medium">{view.customer}</div></div>
            <div className="bg-white/[0.03] rounded-lg p-2"><div className="text-white/40">Supplier</div><div className="text-white/80 font-medium">{view.supplier}</div></div>
            <div className="bg-white/[0.03] rounded-lg p-2"><div className="text-white/40">Route</div><div className="text-white/80">{view.origin}→{view.destination}</div></div>
            <div className="bg-white/[0.03] rounded-lg p-2"><div className="text-white/40">Weight</div><div className="text-white/80">{view.actualWeight}kg</div></div>
          </div>
          <h4 className="text-xs font-medium text-white/60">Packages ({sp.length})</h4>
          <div className="bg-white/[0.03] rounded-lg p-2 space-y-1">{sp.map(p=><div key={p.id} className="flex items-center gap-2"><Box className="w-3 h-3 text-blue-400"/><span className="text-white/60">{p.qrCode}</span><span className="text-white/30 ml-auto">{p.weight}kg</span></div>)}</div>
          {cc&&<><h4 className="text-xs font-medium text-white/60">Customs</h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/[0.03] rounded-lg p-2"><div className="text-white/40 mb-1">China Export</div><SB s={cc.export.lane}/><div className="mt-1 text-white/50">Risk:{cc.export.riskScore}%</div></div>
            <div className="bg-white/[0.03] rounded-lg p-2"><div className="text-white/40 mb-1">Tanzania Import</div><SB s={cc.import.lane}/><div className="mt-1 text-white/50">Risk:{cc.import.riskScore}%</div>{cc.import.taxDispute&&<div className="text-red-400 mt-1">Tax Dispute</div>}</div>
          </div></>}
        </div>
      </>})()}
    </DialogContent></Dialog>
  </div></ScrollArea>;
}

/* ─── CUSTOMS ─── */
function CustomsTab({search}:{search:string}){
  const[j,setJ]=useState<'EXPORT'|'IMPORT'>('EXPORT');
  const filtered=useMemo(()=>shipments.filter(s=>!search||s.number.toLowerCase().includes(search.toLowerCase())||s.customer.toLowerCase().includes(search.toLowerCase())),[search]);
  return<ScrollArea className="h-full"><div className="p-4 space-y-4">
    <div className="flex gap-1"><button onClick={()=>setJ('EXPORT')} className={`flex-1 py-2 rounded-lg text-[11px] font-medium transition-all ${j==='EXPORT'?'bg-blue-500/15 text-blue-400 border border-blue-500/20':'text-white/40 border border-transparent'}`}>China Export</button><button onClick={()=>setJ('IMPORT')} className={`flex-1 py-2 rounded-lg text-[11px] font-medium transition-all ${j==='IMPORT'?'bg-amber-500/15 text-amber-400 border border-amber-500/20':'text-white/40 border border-transparent'}`}>Tanzania Import</button></div>
    {filtered.map(s=>{const cc=customsData[s.id];if(!cc)return null;const c=j==='EXPORT'?cc.export:cc.import;return<Card key={s.id} className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-3 space-y-2">
      <div className="flex items-center justify-between"><div><div className="text-xs font-medium text-white/80">{s.number}</div><div className="text-[10px] text-white/30">{s.customer}&middot;Port:{c.portCode}</div></div><SB s={c.lane}/></div>
      <div><div className="flex items-center justify-between mb-1"><span className="text-[10px] text-white/40">Risk Score</span><span className={`text-[10px] font-medium ${c.riskScore>65?'text-red-400':c.riskScore>35?'text-amber-400':'text-emerald-400'}`}>{c.riskScore}/100</span></div><div className="h-2 rounded-full bg-white/[0.06] overflow-hidden"><div className={`h-full rounded-full ${c.riskScore>65?'bg-red-500':c.riskScore>35?'bg-amber-500':'bg-emerald-500'}`} style={{width:`${c.riskScore}%`}}/></div></div>
      <div className="flex items-center gap-2 flex-wrap"><SB s={c.status}/>{c.inspection&&<span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">Inspection</span>}{c.taxDispute&&<span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">Tax Dispute</span>}</div>
      <div className="grid grid-cols-2 gap-2 text-[10px]"><div className="bg-white/[0.03] rounded-lg p-2"><div className="text-white/30">Duties Est.</div><div className="text-white/60">{usd(c.dutiesEstimated)}</div></div><div className="bg-white/[0.03] rounded-lg p-2"><div className="text-white/30">Duties Paid</div><div className={c.dutiesPaid>=c.dutiesEstimated?'text-emerald-400':'text-amber-400'}>{usd(c.dutiesPaid)}</div></div></div>
    </CardContent></Card>})}
  </div></ScrollArea>;
}

/* ─── WAREHOUSE ─── */
function WarehouseTab({search:_s}:{search:string}){
  const[scan,setScan]=useState('');
  const[found,setFound]=useState<Pkg|null>(null);
  const handleScan=()=>{const p=packages.find(p=>p.qrCode===scan);setFound(p||null);};
  return<ScrollArea className="h-full"><div className="p-4 space-y-4">
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
  </div></ScrollArea>;
}

/* ─── FLIGHTS ─── */
function FlightsTab({search}:{search:string}){
  const[view,setView]=useState<Flight|null>(null);
  const filtered=useMemo(()=>flights.filter(f=>!search||f.number.toLowerCase().includes(search.toLowerCase())||f.airline.toLowerCase().includes(search.toLowerCase())),[search]);
  return<ScrollArea className="h-full"><div className="p-4 space-y-3">
    {filtered.map(f=><Card key={f.id} className="bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05] transition-all cursor-pointer" onClick={()=>setView(f)}><CardContent className="p-3">
      <div className="flex items-start justify-between mb-2"><div className="flex items-center gap-2"><Plane className="w-4 h-4 text-blue-400"/><div><div className="text-xs font-medium text-white/80">{f.number}&middot;{f.airline}</div><div className="text-[10px] text-white/30">{f.ulds} ULDs</div></div></div><SB s={f.status}/></div>
      <div className="flex items-center gap-2 mb-2"><span className="text-[11px] text-white/60 font-medium">{f.origin}</span>{f.transit&&<><ArrowRight className="w-3 h-3 text-white/20"/><span className="text-[10px] text-white/30">{f.transit}</span></>}<ArrowRight className="w-3 h-3 text-white/20"/><span className="text-[11px] text-white/60 font-medium">{f.destination}</span></div>
      <div className="flex items-center gap-3 text-[10px] text-white/30"><span>ETD:{f.etd}</span><span>ETA:{f.eta}</span></div>
      <div className="mt-2"><div className="flex items-center justify-between text-[10px] text-white/40 mb-1"><span>Cargo:{f.weight}kg/{f.capacity}kg</span><span>{f.capacity>0?Math.round((f.weight/f.capacity)*100):0}%</span></div><div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden"><div className="h-full rounded-full bg-indigo-500" style={{width:`${f.capacity>0?(f.weight/f.capacity)*100:0}%`}}/></div></div>
    </CardContent></Card>)}
    <Dialog open={!!view} onOpenChange={()=>setView(null)}><DialogContent className="bg-[#0f0f1a] border-white/[0.08] text-white max-w-sm">
      {view&&<><DialogHeader><DialogTitle className="text-sm">Flight {view.number}</DialogTitle></DialogHeader>
      <div className="space-y-3 text-[11px]">
        <div className="grid grid-cols-2 gap-2"><div className="bg-white/[0.03] rounded-lg p-2"><div className="text-white/30">Airline</div><div className="text-white/80">{view.airline}</div></div><div className="bg-white/[0.03] rounded-lg p-2"><div className="text-white/30">Status</div><SB s={view.status}/></div></div>
        <div className="bg-white/[0.03] rounded-lg p-2 text-center"><div className="text-white/80 text-sm font-medium">{view.origin}→{view.transit?`${view.transit}→`:''}{view.destination}</div><div className="text-white/30">{view.etd}→{view.eta}</div></div>
        <h4 className="text-xs font-medium text-white/60">ULDs</h4>
        {ulds.filter(u=>u.flight===view.number).map(u=><div key={u.id} className="flex items-center gap-2 p-2 bg-white/[0.03] rounded-lg"><Container className="w-4 h-4 text-indigo-400"/><span className="text-white/60">{u.number}</span><span className="text-white/30 ml-auto">{u.weight}kg</span></div>)}
        {ulds.filter(u=>u.flight===view.number).length===0&&<div className="text-center text-white/30 py-2">No ULDs</div>}
      </div></>}
    </DialogContent></Dialog>
  </div></ScrollArea>;
}

/* ─── PAYMENTS ─── */
function PaymentsTab({search}:{search:string}){
  const[txF,setTxF]=useState('ALL');
  const[qrW,setQrW]=useState<Wallet|null>(null);
  const filtered=useMemo(()=>transactions.filter(tx=>{const ms=!search||tx.description.toLowerCase().includes(search.toLowerCase());const mf=txF==='ALL'||tx.type===txF;return ms&&mf;}),[search,txF]);
  const totalCollected=transactions.filter(t=>t.status==='Paid').reduce((s,t)=>s+t.amount,0);
  const totalPending=transactions.filter(t=>t.status==='Pending').reduce((s,t)=>s+t.amount,0);
  const totalOverdue=transactions.filter(t=>t.status==='Overdue').reduce((s,t)=>s+t.amount,0);
  return<ScrollArea className="h-full"><div className="p-4 space-y-4">
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{wallets.map(w=><Card key={w.id} className="bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05] transition-all cursor-pointer" onClick={()=>setQrW(w)}><CardContent className="p-3">
      <div className="flex items-center gap-2 mb-2"><div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center"><Wallet className="w-4 h-4 text-white"/></div><span className="text-xs font-medium text-white/80">{w.customer}</span></div>
      <div className="grid grid-cols-2 gap-2"><div className="bg-emerald-500/[0.05] rounded-lg p-2"><div className="text-[10px] text-emerald-400/50">TZS</div><div className="text-sm font-semibold text-emerald-400">{tzs(w.balanceTZS)}</div></div><div className="bg-blue-500/[0.05] rounded-lg p-2"><div className="text-[10px] text-blue-400/50">USD</div><div className="text-sm font-semibold text-blue-400">{usd(w.balanceUSD)}</div></div></div>
      {w.held>0&&<div className="mt-2 text-[10px] text-amber-400/60">Held:{tzs(w.held)}</div>}
    </CardContent></Card>)}</div>
    <div className="grid grid-cols-3 gap-2">
      <div className="bg-emerald-500/[0.05] rounded-xl p-3 text-center"><div className="text-[10px] text-emerald-400/50">Collected</div><div className="text-sm font-semibold text-emerald-400">{tzs(totalCollected)}</div></div>
      <div className="bg-amber-500/[0.05] rounded-xl p-3 text-center"><div className="text-[10px] text-amber-400/50">Pending</div><div className="text-sm font-semibold text-amber-400">{tzs(totalPending)}</div></div>
      <div className="bg-red-500/[0.05] rounded-xl p-3 text-center"><div className="text-[10px] text-red-400/50">Overdue</div><div className="text-sm font-semibold text-red-400">{tzs(totalOverdue)}</div></div>
    </div>
    <div className="flex gap-1 overflow-x-auto scrollbar-hide">{['ALL','CREDIT','DEBIT'].map(f=><button key={f} onClick={()=>setTxF(f)} className={`px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all ${txF===f?'bg-blue-500/15 text-blue-400 border border-blue-500/20':'text-white/35 hover:text-white/50 border border-transparent'}`}>{f}</button>)}</div>
    <div className="space-y-2">{filtered.map(tx=><div key={tx.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tx.type==='CREDIT'?'bg-emerald-500/15':'bg-red-500/15'}`}>{tx.type==='CREDIT'?<ArrowRight className="w-4 h-4 text-emerald-400 rotate-[-45deg]"/>:<ArrowRight className="w-4 h-4 text-red-400 rotate-[135deg]"/>}</div>
      <div className="flex-1 min-w-0"><div className="text-[11px] text-white/70 truncate">{tx.description}</div><div className="text-[10px] text-white/30">{tx.date}&middot;{tx.method}</div></div>
      <div className="text-right shrink-0"><div className={`text-[11px] font-medium ${tx.type==='CREDIT'?'text-emerald-400':'text-red-400'}`}>{tx.type==='CREDIT'?'+':'-'}{tzs(tx.amount)}</div><SB s={tx.status}/></div>
    </div>)}</div>
    <Dialog open={!!qrW} onOpenChange={()=>setQrW(null)}><DialogContent className="bg-[#0f0f1a] border-white/[0.08] text-white max-w-xs">
      {qrW&&<><DialogHeader><DialogTitle className="text-sm">Payment QR</DialogTitle></DialogHeader>
      <div className="flex flex-col items-center gap-3"><div className="bg-white p-3 rounded-xl"><QRCodeSVG value={`KOBECARGO:PAY:${qrW.id}:${Date.now()}`} size={160}/></div><div className="text-center"><div className="text-sm font-medium text-white/80">{qrW.customer}</div><div className="text-[10px] text-white/40">Scan to pay</div></div></div></>}
    </DialogContent></Dialog>
  </div></ScrollArea>;
}

/* ─── TRACKING ─── */
function TrackingTab({search}:{search:string}){
  const[awb,setAwb]=useState(search);
  const found=useMemo(()=>{if(!awb)return null;return shipments.find(s=>s.masterAWB===awb||s.number.toLowerCase()===awb.toLowerCase()||s.houseAWB===awb)||null;},[awb]);
  const events=found?trackingEvents.filter(e=>e.shipmentId===found.id):[];
  const evIcon=(type:string)=>{if(type.includes('CREATED'))return<CircleDot className="w-4 h-4 text-blue-400"/>;if(type.includes('CUSTOMS'))return<ShieldCheck className="w-4 h-4 text-amber-400"/>;if(type.includes('FLIGHT')||type.includes('TRANSIT'))return<Plane className="w-4 h-4 text-indigo-400"/>;if(type.includes('DELIVER')||type.includes('COMPLETED'))return<CheckCircle2 className="w-4 h-4 text-emerald-400"/>;return<Circle className="w-4 h-4 text-white/40"/>;};
  return<ScrollArea className="h-full"><div className="p-4 space-y-4">
    <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30"/><Input value={awb} onChange={e=>setAwb(e.target.value)} placeholder="Enter AWB or Shipment Number" className="h-10 pl-10 text-sm bg-white/[0.04] border-white/[0.06] text-white/80 placeholder:text-white/25 rounded-xl"/></div>
    {found&&<>
      <Card className="bg-blue-500/[0.05] border-blue-500/15"><CardContent className="p-3">
        <div className="flex items-center justify-between mb-2"><span className="text-xs font-medium text-white/80">{found.number}</span><SB s={found.status}/></div>
        <div className="text-[11px] text-white/50">{found.origin}→{found.destination}</div>
        <div className="text-[10px] text-white/30">{found.customer}&middot;{found.packages}pkgs&middot;ETA:{found.eta}</div>
      </CardContent></Card>
      <div className="relative pl-6"><div className="absolute left-[11px] top-0 bottom-0 w-0.5 bg-white/[0.08]"/>
        {events.map(ev=><div key={ev.id} className="relative mb-4"><div className="absolute -left-[17px] top-0 w-6 h-6 rounded-full bg-[#0a0a1a] border-2 border-white/[0.1] flex items-center justify-center z-10">{evIcon(ev.type)}</div><div className="bg-white/[0.03] rounded-lg p-2.5 ml-2"><div className="text-[11px] text-white/70">{ev.type.replace(/_/g,' ')}</div><div className="text-[10px] text-white/30">{ev.location}&middot;{ev.timestamp}</div></div></div>)}
        {events.length===0&&<div className="text-center text-[11px] text-white/30 py-4">No events</div>}
      </div>
    </>}
    {!found&&awb&&<div className="text-center text-[11px] text-red-400 py-4">No shipment found "{awb}"</div>}
    {!awb&&<div className="text-center text-[11px] text-white/30 py-8">Enter AWB to track</div>}
  </div></ScrollArea>;
}

/* ─── DELIVERY ─── */
function DeliveryTab({search}:{search:string}){
  const filtered=useMemo(()=>deliveries.filter(d=>!search||d.driver.toLowerCase().includes(search.toLowerCase())),[search]);
  const steps=['ASSIGNED','PICKED_UP','IN_TRANSIT','OUT_FOR_DELIVERY','DELIVERED'];
  return<ScrollArea className="h-full"><div className="p-4 space-y-3">
    {filtered.map(d=>{const s=shipments.find(sh=>sh.id===d.shipmentId);const idx=steps.indexOf(d.status);return<Card key={d.id} className="bg-white/[0.03] border-white/[0.06]"><CardContent className="p-3 space-y-3">
      <div className="flex items-start justify-between"><div className="flex items-center gap-2"><Truck className="w-5 h-5 text-blue-400"/><div><div className="text-xs font-medium text-white/80">{s?.number||d.shipmentId}</div><div className="text-[10px] text-white/30">{d.driver}&middot;{d.vehicle}</div></div></div><SB s={d.status}/></div>
      <div className="text-[11px] text-white/50">{d.address}</div>
      {d.recipient&&<div className="text-[10px] text-emerald-400">Received by:{d.recipient}</div>}
      <div className="flex items-center gap-1">{steps.map((step,si)=><div key={step} className="flex-1 flex flex-col items-center"><div className={`w-5 h-5 rounded-full flex items-center justify-center ${si<=idx?'bg-blue-500':'bg-white/[0.06]'}`}>{si<=idx?<CheckCircle2 className="w-3 h-3 text-white"/>:<Circle className="w-3 h-3 text-white/20"/>}</div><span className="text-[8px] text-white/30 mt-1 hidden sm:block">{step.replace(/_/g,' ')}</span></div>)}</div>
      <div className="flex items-center gap-3 text-[10px] text-white/30"><span className="flex items-center gap-1"><Phone className="w-3 h-3"/>{d.phone}</span><span className="flex items-center gap-1"><Calendar className="w-3 h-3"/>{d.started}</span>{d.delivered&&<span className="flex items-center gap-1 text-emerald-400"><CheckCircle2 className="w-3 h-3"/>{d.delivered}</span>}</div>
      {d.status==='FAILED'&&<div className="bg-red-500/10 rounded-lg p-2 text-[10px] text-red-400">Delivery failed - Recipient unavailable</div>}
    </CardContent></Card>})}
  </div></ScrollArea>;
}

/* ─── MAIN SHELL ─── */
type Tab='dashboard'|'shipments'|'customs'|'warehouse'|'flights'|'payments'|'tracking'|'delivery';
export default function KOBECARGO(){
  const[tab,setTab]=useState<Tab>('dashboard');
  const[search,setSearch]=useState('');
  const tabs=[{key:'dashboard' as Tab,label:'Dashboard',icon:BarChart3},{key:'shipments',label:'Shipments',icon:Package},{key:'customs',label:'Customs',icon:ShieldCheck},{key:'warehouse',label:'Warehouse',icon:Warehouse},{key:'flights',label:'Flights',icon:PlaneTakeoff},{key:'payments',label:'Payments',icon:Wallet},{key:'tracking',label:'Tracking',icon:MapPin},{key:'delivery',label:'Delivery',icon:Truck}];
  const render=(t:Tab)=>{switch(t){case'dashboard':return<DashboardTab/>;case'shipments':return<ShipmentsTab search={search}/>;case'customs':return<CustomsTab search={search}/>;case'warehouse':return<WarehouseTab search={search}/>;case'flights':return<FlightsTab search={search}/>;case'payments':return<PaymentsTab search={search}/>;case'tracking':return<TrackingTab search={search}/>;case'delivery':return<DeliveryTab search={search}/>}};
  return<div className="h-full flex flex-col bg-[#0a0a1a] text-white/90">
    <div className="shrink-0 px-4 pt-4 pb-2">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center"><Plane className="w-4 h-4 text-white"/></div><div><h1 className="text-sm font-semibold text-white/90">KOBECARGO</h1><p className="text-[10px] text-white/35">China↔Tanzania Air Cargo</p></div></div>
        <div className="relative w-full sm:w-56"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30"/><Input placeholder="Search shipments,AWBs..." value={search} onChange={e=>setSearch(e.target.value)} className="h-8 pl-8 pr-3 text-xs bg-white/[0.04] border-white/[0.06] text-white/80 placeholder:text-white/25 rounded-xl w-full"/></div>
      </div>
      <div className="flex gap-1 pb-1 overflow-x-auto scrollbar-hide">{tabs.map(t=><button key={t.key} onClick={()=>setTab(t.key)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap ${tab===t.key?'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20':'text-white/40 hover:text-white/60 hover:bg-white/[0.03] border border-transparent'}`}><t.icon className="w-3.5 h-3.5"/>{t.label}</button>)}</div>
    </div>
    <div className="flex-1 min-h-0 overflow-hidden">{render(tab)}</div>
  </div>;
}
