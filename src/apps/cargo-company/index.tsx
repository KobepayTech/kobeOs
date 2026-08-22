import { useCallback, useEffect, useState } from 'react';
import { Building2, Loader2, Package, Plane, Plus, RefreshCw, Search, Truck, Wallet, X } from 'lucide-react';
import { api } from '@/lib/api';

type Tab = 'overview' | 'parcels' | 'shipments' | 'drivers' | 'flights' | 'payments';
type Driver = { id: string; name: string; phone: string; vehicle?: string; plateNumber?: string; status: 'AVAILABLE' | 'ON_TRIP' | 'OFF_DUTY'; rating?: number };
type Parcel = { id: string; parcelId: string; senderName: string; senderPhone: string; ownerName: string; ownerPhone: string; destination: string; weight: number; packageCount: number; status: string; createdAt?: string };
type Shipment = { id: string; shipmentId: string; origin: string; destination: string; weight?: number; etd?: string; eta?: string; carrier?: string; flightNumber?: string; status: string; driverId?: string | null; flightId?: string | null };
type Flight = { id: string; flightNumber: string; origin: string; destination: string; departureAt: string; arrivalAt: string; carrier?: string; capacityKg?: number; bookedKg?: number; status?: string };
type Payment = { id: string; customerName: string; supplierName?: string | null; amount: number | string; currency: string; purpose: string; method: string; status: string; createdAt: string };

export default function CargoCompany() {
  const [tab, setTab] = useState<Tab>('overview');
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createMode, setCreateMode] = useState<'driver' | 'flight' | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [parcelRows, shipmentRows, driverRows, flightRows, paymentRows] = await Promise.all([
        api<Parcel[]>('/cargo/parcels', { offlineFallback: false }), api<Shipment[]>('/cargo/shipments', { offlineFallback: false }),
        api<Driver[]>('/cargo/drivers', { offlineFallback: false }), api<Flight[]>('/cargo/flights', { offlineFallback: false }),
        api<Payment[]>('/cargo/payments', { offlineFallback: false }),
      ]);
      setParcels(Array.isArray(parcelRows) ? parcelRows : []); setShipments(Array.isArray(shipmentRows) ? shipmentRows : []);
      setDrivers(Array.isArray(driverRows) ? driverRows : []); setFlights(Array.isArray(flightRows) ? flightRows : []); setPayments(Array.isArray(paymentRows) ? paymentRows : []);
    } catch (cause) { setError((cause as Error).message || 'Cargo company data is unavailable.'); setParcels([]); setShipments([]); setDrivers([]); setFlights([]); setPayments([]); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const q = query.trim().toLowerCase();
  const filter = <T,>(rows: T[], render: (row: T) => string) => rows.filter((row) => !q || render(row).toLowerCase().includes(q));
  const completedPayments = payments.filter((row) => row.status === 'COMPLETED').reduce((sum, row) => sum + Number(row.amount || 0), 0);

  return <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-950 text-white">
    <header className="shrink-0 border-b border-white/10 bg-slate-900/90"><div className="flex h-16 items-center gap-3 px-4"><div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-300"><Building2 className="h-5 w-5" /></div><div><h1 className="font-black">Cargo Company Operations</h1><p className="text-[11px] text-slate-500">Persisted company-wide cargo records</p></div><button onClick={() => void load()} className="ml-auto grid h-9 w-9 place-items-center rounded-lg border border-white/10"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button></div><nav className="flex overflow-x-auto px-3">{(['overview','parcels','shipments','drivers','flights','payments'] as Tab[]).map((id) => <button key={id} onClick={() => setTab(id)} className={`h-11 border-b-2 px-3 text-xs font-black capitalize ${tab===id?'border-emerald-300 text-emerald-300':'border-transparent text-slate-500'}`}>{id}</button>)}</nav></header>
    <main className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">{error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div>}<div className="grid grid-cols-2 gap-3 lg:grid-cols-5"><Metric label="Parcels" value={parcels.length} /><Metric label="Shipments" value={shipments.length} /><Metric label="Available drivers" value={drivers.filter((r)=>r.status==='AVAILABLE').length} /><Metric label="Flights" value={flights.length} /><Metric label="Recorded payments" value={completedPayments.toLocaleString()} /></div>
      {tab!=='overview' && <div className="flex gap-2"><div className="relative max-w-xl flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search live records" className="h-10 w-full rounded-xl border border-white/10 bg-slate-900 pl-9 pr-3 text-sm" /></div>{tab==='drivers' && <Add onClick={()=>setCreateMode('driver')} label="Driver" />}{tab==='flights' && <Add onClick={()=>setCreateMode('flight')} label="Flight" />}</div>}
      {loading ? <div className="grid place-items-center py-24"><Loader2 className="h-6 w-6 animate-spin text-emerald-300" /></div> : tab==='overview' ? <div className="grid gap-4 lg:grid-cols-2"><Panel title="Recent shipments">{shipments.slice(0,8).map((r)=><Row key={r.id} icon={<Package className="h-4 w-4" />} title={r.shipmentId} sub={`${r.origin} → ${r.destination} · ${r.status}`} value={r.flightNumber||''} />)}{!shipments.length&&<Empty />}</Panel><Panel title="Recent payments">{payments.slice(0,8).map((r)=><Row key={r.id} icon={<Wallet className="h-4 w-4" />} title={r.customerName} sub={`${r.purpose} · ${r.method} · ${r.status}`} value={`${r.currency} ${Number(r.amount).toLocaleString()}`} />)}{!payments.length&&<Empty />}</Panel></div>
      : tab==='parcels' ? <List>{filter(parcels,(r)=>`${r.parcelId} ${r.senderName} ${r.ownerName} ${r.destination}`).map((r)=><Row key={r.id} icon={<Package className="h-4 w-4" />} title={r.parcelId} sub={`${r.senderName} → ${r.ownerName} · ${r.destination} · ${r.status}`} value={`${Number(r.weight||0)} kg`} />)}{!filter(parcels,(r)=>`${r.parcelId} ${r.senderName} ${r.ownerName} ${r.destination}`).length&&<Empty />}</List>
      : tab==='shipments' ? <List>{filter(shipments,(r)=>`${r.shipmentId} ${r.origin} ${r.destination} ${r.carrier??''}`).map((r)=><Row key={r.id} icon={<Package className="h-4 w-4" />} title={r.shipmentId} sub={`${r.origin} → ${r.destination} · ${r.status}`} value={r.flightNumber||''} />)}{!filter(shipments,(r)=>`${r.shipmentId} ${r.origin} ${r.destination}`).length&&<Empty />}</List>
      : tab==='drivers' ? <List>{filter(drivers,(r)=>`${r.name} ${r.phone} ${r.vehicle??''} ${r.plateNumber??''}`).map((r)=><Row key={r.id} icon={<Truck className="h-4 w-4" />} title={r.name} sub={`${r.phone} · ${r.vehicle||'No vehicle'} ${r.plateNumber?`· ${r.plateNumber}`:''}`} value={r.status} />)}{!filter(drivers,(r)=>`${r.name} ${r.phone}`).length&&<Empty />}</List>
      : tab==='flights' ? <List>{filter(flights,(r)=>`${r.flightNumber} ${r.origin} ${r.destination} ${r.carrier??''}`).map((r)=><Row key={r.id} icon={<Plane className="h-4 w-4" />} title={r.flightNumber} sub={`${r.origin} → ${r.destination} · ${r.carrier||'Carrier not set'}`} value={r.status||''} />)}{!filter(flights,(r)=>`${r.flightNumber} ${r.origin} ${r.destination}`).length&&<Empty />}</List>
      : <List>{filter(payments,(r)=>`${r.customerName} ${r.supplierName??''} ${r.purpose} ${r.method}`).map((r)=><Row key={r.id} icon={<Wallet className="h-4 w-4" />} title={r.customerName} sub={`${r.supplierName||'No supplier'} · ${r.purpose} · ${r.status}`} value={`${r.currency} ${Number(r.amount).toLocaleString()}`} />)}{!filter(payments,(r)=>`${r.customerName} ${r.purpose}`).length&&<Empty />}</List>}
    </main>{createMode && <CreateDialog mode={createMode} close={()=>setCreateMode(null)} saved={async()=>{setCreateMode(null);await load();}} />}
  </div>;
}

function CreateDialog({mode,close,saved}:{mode:'driver'|'flight';close:()=>void;saved:()=>Promise<void>}){const [f,setF]=useState<Record<string,string>>({status:'AVAILABLE'});const [busy,setBusy]=useState(false);const [error,setError]=useState('');const set=(k:string,v:string)=>setF((c)=>({...c,[k]:v}));const save=async()=>{setBusy(true);setError('');try{if(mode==='driver')await api('/cargo/drivers',{method:'POST',offlineFallback:false,body:JSON.stringify({name:f.name,phone:f.phone,vehicle:f.vehicle||undefined,plateNumber:f.plateNumber||undefined,status:f.status||'AVAILABLE'})});else await api('/cargo/flights',{method:'POST',offlineFallback:false,body:JSON.stringify({flightNumber:f.flightNumber,origin:f.origin,destination:f.destination,departureAt:new Date(f.departureAt).toISOString(),arrivalAt:new Date(f.arrivalAt).toISOString(),carrier:f.carrier||undefined,capacityKg:f.capacityKg?Number(f.capacityKg):undefined,status:f.status||undefined})});await saved();}catch(cause){setError((cause as Error).message||'Could not save record.');}finally{setBusy(false);}};return <div className="fixed inset-0 z-[10000] grid place-items-center bg-black/70 p-4"><div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-4"><div className="flex items-center"><h2 className="font-black">Add {mode}</h2><button onClick={close} className="ml-auto"><X className="h-4 w-4" /></button></div><div className="mt-4 space-y-3">{mode==='driver'?<><Field l="Name" v={f.name} s={(v)=>set('name',v)} /><Field l="Phone" v={f.phone} s={(v)=>set('phone',v)} /><Field l="Vehicle" v={f.vehicle} s={(v)=>set('vehicle',v)} /><Field l="Plate number" v={f.plateNumber} s={(v)=>set('plateNumber',v)} /></>:<><Field l="Flight number" v={f.flightNumber} s={(v)=>set('flightNumber',v)} /><Field l="Origin" v={f.origin} s={(v)=>set('origin',v)} /><Field l="Destination" v={f.destination} s={(v)=>set('destination',v)} /><Field l="Departure" t="datetime-local" v={f.departureAt} s={(v)=>set('departureAt',v)} /><Field l="Arrival" t="datetime-local" v={f.arrivalAt} s={(v)=>set('arrivalAt',v)} /><Field l="Carrier" v={f.carrier} s={(v)=>set('carrier',v)} /></>}{error&&<p className="text-sm text-rose-300">{error}</p>}<button onClick={()=>void save()} disabled={busy} className="h-11 w-full rounded-xl bg-emerald-600 font-black disabled:opacity-50">{busy?'Saving…':'Save live record'}</button></div></div></div>}
function Field({l,v,s,t='text'}:{l:string;v?:string;s:(v:string)=>void;t?:string}){return <label className="grid gap-1 text-xs text-slate-400">{l}<input type={t} value={v||''} onChange={(e)=>s(e.target.value)} className="h-10 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white" /></label>}
function Add({onClick,label}:{onClick:()=>void;label:string}){return <button onClick={onClick} className="inline-flex h-10 items-center gap-1 rounded-xl bg-emerald-600 px-3 text-xs font-black"><Plus className="h-4 w-4" />{label}</button>}
function Metric({label,value}:{label:string;value:number|string}){return <div className="rounded-2xl border border-white/10 bg-slate-900 p-4"><div className="text-lg font-black">{value}</div><div className="text-[11px] text-slate-500">{label}</div></div>}
function Panel({title,children}:{title:string;children:React.ReactNode}){return <section className="rounded-2xl border border-white/10 bg-slate-900 p-4"><h2 className="font-black">{title}</h2><div className="mt-3 divide-y divide-white/10">{children}</div></section>}
function List({children}:{children:React.ReactNode}){return <section className="rounded-2xl border border-white/10 bg-slate-900 px-4">{children}</section>}
function Row({icon,title,sub,value}:{icon:React.ReactNode;title:string;sub:string;value:string}){return <div className="flex items-center gap-3 py-3">{icon}<div className="min-w-0 flex-1"><b className="block truncate text-sm">{title}</b><span className="block truncate text-xs text-slate-500">{sub}</span></div><span className="text-xs font-black text-slate-300">{value}</span></div>}
function Empty(){return <div className="py-10 text-center text-sm text-slate-500">No live records.</div>}
