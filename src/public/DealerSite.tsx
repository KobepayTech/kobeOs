import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, BadgeCheck, Banknote, CalendarDays, Car, CheckCircle2, ChevronLeft,
  ChevronRight, Clock3, Gauge, Loader2, MapPin, MessageCircle, Phone, Search,
  ShieldCheck, Sparkles, X,
} from 'lucide-react';
import { publicApi, publicAssetUrl } from './api';

interface DealerVehicle {
  id: string;
  make: string;
  model: string;
  trim: string;
  year: number;
  price: number | string;
  currency: string;
  mileage: number;
  transmission: string;
  fuel: string;
  color: string;
  interiorColor: string;
  engine: string;
  driveType: string;
  bodyType: string;
  condition: string;
  status: string;
  location: string;
  financingAvailable: boolean;
  negotiable: boolean;
  features: string[];
  description: string;
  aiSalesCopy: string;
  canBuy: boolean;
  canSchedule: boolean;
  modelGroupKey: string;
  media: Array<{ url: string; kind?: string }>;
  listing?: { highlights: string[]; socialCaption: string; verticalVideoUrl: string } | null;
}
interface DealerPayload {
  dealer: {
    id: string;
    businessId: string;
    name: string;
    publicSlug: string;
    phone: string;
    email: string;
    whatsapp: string;
    logoUrl: string;
    heroImageUrl: string;
    heroTitle: string;
    heroSubtitle: string;
    about: string;
    address: string;
    hours: Array<{ day?: string; open?: string; close?: string; label?: string }>;
    socials: Record<string, string>;
    primaryColor: string;
  };
  stats: { total: number; available: number; reserved: number; financing: number; makes: string[] };
  vehicles: DealerVehicle[];
}

type ActionMode = 'OUTRIGHT' | 'RESERVE' | 'FINANCE' | 'SHOWROOM' | 'TEST_DRIVE';

const money = (value: number | string, currency = 'TZS') => `${currency} ${Number(value).toLocaleString()}`;
const digits = (value: string) => String(value || '').replace(/\D/g, '');

export default function DealerSite({ slug }: { slug: string }) {
  const [data, setData] = useState<DealerPayload | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [make, setMake] = useState('');
  const [selected, setSelected] = useState<DealerVehicle | null>(null);
  const [modelFocus, setModelFocus] = useState('');
  const [action, setAction] = useState<ActionMode | null>(null);
  const [gallery, setGallery] = useState(0);

  useEffect(() => {
    let active = true;
    publicApi<DealerPayload>(`/commerce-public/dealers/${encodeURIComponent(slug)}`)
      .then((value) => { if (active) setData(value); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : String(reason)); });
    return () => { active = false; };
  }, [slug]);

  const modelGroups = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; count: number; min: number; max: number }>();
    for (const vehicle of data?.vehicles ?? []) {
      const existing = groups.get(vehicle.modelGroupKey);
      const price = Number(vehicle.price);
      if (existing) {
        existing.count += 1;
        existing.min = Math.min(existing.min, price);
        existing.max = Math.max(existing.max, price);
      } else {
        groups.set(vehicle.modelGroupKey, {
          key: vehicle.modelGroupKey,
          label: `${vehicle.make} ${vehicle.model}`,
          count: 1,
          min: price,
          max: price,
        });
      }
    }
    return [...groups.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [data]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (data?.vehicles ?? []).filter((vehicle) => {
      if (make && vehicle.make !== make) return false;
      if (modelFocus && vehicle.modelGroupKey !== modelFocus) return false;
      if (!needle) return true;
      return [
        vehicle.make, vehicle.model, vehicle.trim, vehicle.year, vehicle.transmission,
        vehicle.fuel, vehicle.engine, vehicle.driveType, vehicle.bodyType, vehicle.color,
        vehicle.location, vehicle.description,
      ].join(' ').toLowerCase().includes(needle);
    });
  }, [data, query, make, modelFocus]);

  if (!data && !error) {
    return <div className="min-h-screen bg-[#071d18] text-white grid place-items-center"><Loader2 className="h-8 w-8 animate-spin text-lime-300" /></div>;
  }
  if (!data) {
    return <div className="min-h-screen bg-[#071d18] text-white grid place-items-center p-6 text-center"><div><Car className="mx-auto h-12 w-12 text-lime-300" /><h1 className="mt-4 text-3xl font-black">Dealership unavailable</h1><p className="mt-2 text-white/55">{error}</p></div></div>;
  }

  const { dealer, stats } = data;
  const hero = publicAssetUrl(dealer.heroImageUrl || data.vehicles[0]?.media[0]?.url);
  const whatsapp = digits(dealer.whatsapp || dealer.phone);

  return <div className="min-h-screen bg-[#f4f6f1] text-[#10261f]" data-surface="light">
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#071d18]/95 text-white backdrop-blur-xl">
      <div className="mx-auto flex h-17 max-w-7xl items-center gap-3 px-4 sm:px-6">
        {dealer.logoUrl ? <img src={publicAssetUrl(dealer.logoUrl)} alt="" className="h-10 w-10 rounded-xl object-cover bg-white" /> : <div className="h-10 w-10 rounded-xl bg-[#d5ff4f] text-[#071d18] grid place-items-center font-black"><Car className="h-5 w-5" /></div>}
        <div className="min-w-0"><h1 className="truncate font-black">{dealer.name}</h1><p className="text-[10px] font-bold uppercase tracking-[.2em] text-white/45">KobeOS verified dealership</p></div>
        <div className="ml-auto flex items-center gap-2">
          {whatsapp && <a href={`https://wa.me/${whatsapp}`} className="hidden sm:inline-flex h-10 items-center gap-2 rounded-xl bg-white/10 px-3 text-xs font-black"><MessageCircle className="h-4 w-4" /> WhatsApp</a>}
          <a href={`tel:${dealer.phone}`} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#d5ff4f] px-3 text-xs font-black text-[#071d18]"><Phone className="h-4 w-4" /> Call</a>
        </div>
      </div>
    </header>

    <main>
      <section className="relative min-h-[520px] overflow-hidden bg-[#071d18] text-white">
        {hero && <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />}
        <div className="absolute inset-0 bg-gradient-to-r from-[#071d18] via-[#071d18]/90 to-[#071d18]/25" />
        <div className="relative mx-auto grid min-h-[520px] max-w-7xl items-end gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black text-[#d5ff4f]"><BadgeCheck className="h-4 w-4" /> LIVE DEALER INVENTORY</span>
            <h2 className="mt-5 text-4xl font-black leading-[.95] sm:text-6xl">{dealer.heroTitle}</h2>
            <p className="mt-5 max-w-2xl text-base text-white/65 sm:text-lg">{dealer.heroSubtitle}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#inventory" className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[#d5ff4f] px-5 font-black text-[#071d18]">Browse cars <ArrowRight className="h-4 w-4" /></a>
              {dealer.address && <span className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 text-sm font-bold"><MapPin className="h-4 w-4 text-[#d5ff4f]" /> {dealer.address}</span>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
            <HeroStat label="Live cars" value={stats.total} />
            <HeroStat label="Available now" value={stats.available} />
            <HeroStat label="Finance options" value={stats.financing} />
            <HeroStat label="Makes" value={stats.makes.length} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
        <div className="grid gap-3 md:grid-cols-3">
          <Feature icon={ShieldCheck} title="One source of truth" text="Inventory shown here is the same live stock the dealer manages in KobeOS." />
          <Feature icon={CalendarDays} title="Book before you travel" text="Schedule a showroom visit or test drive against the exact vehicle." />
          <Feature icon={Banknote} title="Reserve or finance" text="Send an offer, request financing, or hold an available car directly." />
        </div>
      </section>

      {modelGroups.length > 0 && <section className="mx-auto max-w-7xl px-4 pb-3 sm:px-6">
        <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.2em] text-emerald-700">Shop by model</p><h3 className="mt-1 text-2xl font-black">Compare every matching listing</h3></div>{modelFocus && <button onClick={() => setModelFocus('')} className="text-sm font-black text-emerald-800">Show all</button>}</div>
        <div className="mt-4 flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none]">
          {modelGroups.map((group) => <button key={group.key} onClick={() => setModelFocus(group.key === modelFocus ? '' : group.key)} className={`min-w-[220px] rounded-2xl border p-4 text-left transition ${modelFocus === group.key ? 'border-[#071d18] bg-[#071d18] text-white' : 'bg-white hover:border-emerald-300'}`}><b className="block text-lg">{group.label}</b><span className={`mt-1 block text-xs ${modelFocus === group.key ? 'text-white/55' : 'text-slate-500'}`}>{group.count} listing{group.count === 1 ? '' : 's'} · from {money(group.min)}</span></button>)}
        </div>
      </section>}

      <section id="inventory" className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="rounded-[2rem] bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <label className="relative block"><Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search Prado, Harrier, diesel, automatic, 2024…" className="h-12 w-full rounded-2xl bg-slate-100 pl-12 pr-4 text-sm outline-none ring-emerald-500 focus:ring-2" /></label>
            <select value={make} onChange={(e) => setMake(e.target.value)} className="h-12 rounded-2xl bg-slate-100 px-4 text-sm font-bold outline-none"><option value="">All makes</option>{stats.makes.map((item) => <option key={item}>{item}</option>)}</select>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[.2em] text-emerald-700">Inventory</p><h3 className="text-2xl font-black">{filtered.length} vehicle{filtered.length === 1 ? '' : 's'}</h3></div>{modelFocus && <span className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800">Comparing {modelGroups.find((g) => g.key === modelFocus)?.label}</span>}</div>

        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((vehicle) => <VehicleCard key={vehicle.id} vehicle={vehicle} onOpen={() => { setSelected(vehicle); setGallery(0); setAction(null); }} />)}
        </div>
        {!filtered.length && <div className="mt-5 rounded-[2rem] border border-dashed bg-white py-20 text-center text-slate-400"><Car className="mx-auto h-10 w-10" /><b className="mt-3 block">No matching vehicle</b><p className="mt-1 text-sm">Try another model, make or specification.</p></div>}
      </section>

      <section className="bg-[#071d18] text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:px-8 lg:grid-cols-2">
          <div><p className="text-xs font-black uppercase tracking-[.2em] text-[#d5ff4f]">About the dealer</p><h3 className="mt-3 text-3xl font-black">{dealer.name}</h3><p className="mt-4 max-w-xl text-white/60">{dealer.about || 'This dealership publishes its inventory directly from KobeOS, so customers see current vehicle status and can act on the same record used by the sales team.'}</p></div>
          <div className="grid gap-3 sm:grid-cols-2">{dealer.address && <FooterFact icon={MapPin} label="Showroom" value={dealer.address} />}<FooterFact icon={Phone} label="Phone" value={dealer.phone || 'Contact dealer'} />{dealer.email && <FooterFact icon={MessageCircle} label="Email" value={dealer.email} />}{dealer.hours?.length > 0 && <FooterFact icon={Clock3} label="Hours" value={dealer.hours[0]?.label || [dealer.hours[0]?.day, dealer.hours[0]?.open, dealer.hours[0]?.close].filter(Boolean).join(' ')} />}</div>
        </div>
      </section>
    </main>

    {selected && <VehicleModal vehicle={selected} gallery={gallery} setGallery={setGallery} dealer={dealer} action={action} setAction={setAction} onClose={() => { setSelected(null); setAction(null); }} />}
  </div>;
}

function HeroStat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur"><b className="text-3xl font-black text-[#d5ff4f]">{value}</b><span className="mt-1 block text-xs font-bold text-white/50">{label}</span></div>;
}
function Feature({ icon: Icon, title, text }: { icon: typeof ShieldCheck; title: string; text: string }) {
  return <div className="rounded-3xl border bg-white p-5"><div className="h-11 w-11 rounded-2xl bg-emerald-50 text-emerald-800 grid place-items-center"><Icon className="h-5 w-5" /></div><b className="mt-4 block text-lg">{title}</b><p className="mt-1 text-sm leading-6 text-slate-500">{text}</p></div>;
}
function FooterFact({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: string }) {
  return <div className="rounded-2xl bg-white/7 p-4"><Icon className="h-5 w-5 text-[#d5ff4f]" /><small className="mt-3 block text-white/40">{label}</small><b className="mt-1 block text-sm">{value}</b></div>;
}

function VehicleCard({ vehicle, onOpen }: { vehicle: DealerVehicle; onOpen: () => void }) {
  const cover = publicAssetUrl(vehicle.media.find((m) => m.kind !== 'VIDEO')?.url || vehicle.media[0]?.url);
  return <article className="overflow-hidden rounded-[2rem] border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
    <button onClick={onOpen} className="block w-full text-left">
      <div className="relative h-60 bg-slate-100">{cover ? <img src={cover} alt={`${vehicle.make} ${vehicle.model}`} className="h-full w-full object-cover" /> : <div className="h-full grid place-items-center"><Car className="h-10 w-10 text-slate-300" /></div>}<span className={`absolute left-4 top-4 rounded-full px-3 py-1 text-[10px] font-black ${vehicle.status === 'AVAILABLE' ? 'bg-[#d5ff4f] text-[#071d18]' : 'bg-black/70 text-white'}`}>{vehicle.status.replace(/_/g, ' ')}</span></div>
      <div className="p-5">
        <p className="text-xs font-black text-emerald-700">{vehicle.year} · {vehicle.condition}{vehicle.location ? ` · ${vehicle.location}` : ''}</p>
        <h4 className="mt-1 text-2xl font-black">{vehicle.make} {vehicle.model}{vehicle.trim ? ` ${vehicle.trim}` : ''}</h4>
        <p className="mt-1 text-xl font-black">{money(vehicle.price, vehicle.currency)}</p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-xs"><Spec icon={Gauge} value={vehicle.mileage ? `${vehicle.mileage.toLocaleString()} km` : 'Mileage n/a'} /><Spec icon={Sparkles} value={vehicle.transmission || 'Transmission'} /><Spec icon={Car} value={vehicle.fuel || vehicle.bodyType || 'Vehicle'} /></div>
        <div className="mt-5 flex items-center justify-between border-t pt-4"><span className="text-xs font-bold text-slate-500">{vehicle.financingAvailable ? 'Financing available' : vehicle.negotiable ? 'Negotiable' : 'Dealer listing'}</span><span className="inline-flex items-center gap-1 text-xs font-black text-emerald-800">View details <ArrowRight className="h-3.5 w-3.5" /></span></div>
      </div>
    </button>
  </article>;
}
function Spec({ icon: Icon, value }: { icon: typeof Gauge; value: string }) {
  return <span className="min-w-0 rounded-xl bg-slate-50 px-2 py-2 text-center text-slate-600"><Icon className="mx-auto mb-1 h-3.5 w-3.5" /><span className="block truncate">{value}</span></span>;
}

function VehicleModal({ vehicle, dealer, gallery, setGallery, action, setAction, onClose }: {
  vehicle: DealerVehicle;
  dealer: DealerPayload['dealer'];
  gallery: number;
  setGallery: (value: number) => void;
  action: ActionMode | null;
  setAction: (value: ActionMode | null) => void;
  onClose: () => void;
}) {
  const images = vehicle.media.filter((m) => m.kind !== 'VIDEO').map((m) => publicAssetUrl(m.url)).filter(Boolean);
  const image = images[gallery] || images[0];
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-3 sm:p-6" onMouseDown={onClose}>
    <div className="mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
      <div className="grid lg:grid-cols-[1.08fr_.92fr]">
        <div className="relative min-h-[360px] bg-[#071d18]">{image ? <img src={image} alt="" className="h-full min-h-[360px] w-full object-cover lg:min-h-[680px]" /> : <div className="min-h-[500px] grid place-items-center"><Car className="h-14 w-14 text-white/20" /></div>}{images.length > 1 && <><button onClick={() => setGallery((gallery - 1 + images.length) % images.length)} className="absolute left-4 top-1/2 h-11 w-11 rounded-full bg-black/50 text-white grid place-items-center"><ChevronLeft /></button><button onClick={() => setGallery((gallery + 1) % images.length)} className="absolute right-4 top-1/2 h-11 w-11 rounded-full bg-black/50 text-white grid place-items-center"><ChevronRight /></button><span className="absolute bottom-4 right-4 rounded-full bg-black/60 px-3 py-1 text-xs font-black text-white">{gallery + 1}/{images.length}</span></>}</div>
        <div className="max-h-[90vh] overflow-y-auto p-5 sm:p-7">
          <button onClick={onClose} className="float-right h-9 w-9 rounded-xl bg-slate-100 grid place-items-center"><X className="h-4 w-4" /></button>
          <p className="text-xs font-black uppercase tracking-[.15em] text-emerald-700">{vehicle.status.replace(/_/g, ' ')} · {vehicle.condition}</p>
          <h2 className="mt-2 pr-12 text-3xl font-black">{vehicle.year} {vehicle.make} {vehicle.model}{vehicle.trim ? ` ${vehicle.trim}` : ''}</h2>
          <p className="mt-2 text-2xl font-black">{money(vehicle.price, vehicle.currency)}</p>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">{[
            ['Mileage', vehicle.mileage ? `${vehicle.mileage.toLocaleString()} km` : '—'],
            ['Transmission', vehicle.transmission || '—'],
            ['Fuel', vehicle.fuel || '—'],
            ['Engine', vehicle.engine || '—'],
            ['Drive', vehicle.driveType || '—'],
            ['Body', vehicle.bodyType || '—'],
            ['Color', vehicle.color || '—'],
            ['Interior', vehicle.interiorColor || '—'],
            ['Location', vehicle.location || dealer.address || '—'],
          ].map(([label, value]) => <div key={label} className="rounded-2xl bg-slate-50 p-3"><small className="text-slate-400">{label}</small><b className="mt-1 block text-sm">{value}</b></div>)}</div>
          {(vehicle.listing?.highlights?.length || vehicle.features?.length) ? <div className="mt-5 flex flex-wrap gap-2">{[...(vehicle.listing?.highlights ?? []), ...(vehicle.features ?? [])].slice(0, 12).map((item, index) => <span key={`${item}-${index}`} className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">{item}</span>)}</div> : null}
          <p className="mt-5 text-sm leading-6 text-slate-600">{vehicle.description || vehicle.listing?.socialCaption || vehicle.aiSalesCopy || 'Contact the dealer for more information about this vehicle.'}</p>

          {!action ? <div className="mt-6 space-y-2">
            <button disabled={!vehicle.canBuy} onClick={() => setAction('OUTRIGHT')} className="h-12 w-full rounded-2xl bg-[#071d18] font-black text-white disabled:opacity-35">Buy / send offer</button>
            <div className="grid grid-cols-2 gap-2">
              <button disabled={!vehicle.canBuy} onClick={() => setAction('RESERVE')} className="h-11 rounded-2xl bg-[#d5ff4f] text-sm font-black disabled:opacity-35">Reserve</button>
              <button disabled={!vehicle.financingAvailable || !vehicle.canBuy} onClick={() => setAction('FINANCE')} className="h-11 rounded-2xl bg-emerald-50 text-sm font-black text-emerald-800 disabled:opacity-35">Request finance</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button disabled={!vehicle.canSchedule} onClick={() => setAction('SHOWROOM')} className="h-11 rounded-2xl border text-sm font-black disabled:opacity-35">Showroom visit</button>
              <button disabled={!vehicle.canSchedule} onClick={() => setAction('TEST_DRIVE')} className="h-11 rounded-2xl border text-sm font-black disabled:opacity-35">Test drive</button>
            </div>
          </div> : <ActionForm vehicle={vehicle} dealer={dealer} mode={action} onBack={() => setAction(null)} />}
        </div>
      </div>
    </div>
  </div>;
}

function ActionForm({ vehicle, dealer, mode, onBack }: { vehicle: DealerVehicle; dealer: DealerPayload['dealer']; mode: ActionMode; onBack: () => void }) {
  const [form, setForm] = useState({ name: '', phone: '', whatsapp: '', email: '', offer: '', message: '', scheduledFor: '' });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState('');
  const [error, setError] = useState('');
  const appointment = mode === 'SHOWROOM' || mode === 'TEST_DRIVE';
  const submit = async () => {
    setSending(true); setError(''); setDone('');
    try {
      if (appointment) {
        const result = await publicApi<{ appointment: { id: string; status: string } }>(`/commerce-public/cars/${vehicle.id}/appointments`, {
          method: 'POST',
          body: JSON.stringify({
            customerName: form.name,
            customerPhone: form.phone,
            customerWhatsapp: form.whatsapp,
            customerEmail: form.email || undefined,
            appointmentType: mode,
            scheduledFor: form.scheduledFor,
            showroomLocation: dealer.address,
            message: form.message,
          }),
        });
        setDone(`${mode === 'TEST_DRIVE' ? 'Test drive' : 'Showroom visit'} request sent. Reference: ${result.appointment.id.slice(0, 8).toUpperCase()}`);
      } else {
        const result = await publicApi<{ reservation?: { reservationCode: string } | null }>(`/commerce-public/cars/${vehicle.id}/request`, {
          method: 'POST',
          body: JSON.stringify({
            customerName: form.name,
            customerPhone: form.phone,
            customerWhatsapp: form.whatsapp,
            customerEmail: form.email || undefined,
            requestType: mode,
            offerAmount: form.offer ? Number(form.offer) : undefined,
            preferredContact: 'WHATSAPP',
            message: form.message,
          }),
        });
        setDone(result.reservation ? `Vehicle held for 30 minutes. Reservation: ${result.reservation.reservationCode}` : 'Request sent to the dealer and added to their ERP CRM.');
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally { setSending(false); }
  };
  return <div className="mt-6 rounded-3xl bg-slate-50 p-4">
    <div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[.15em] text-emerald-700">{appointment ? 'Appointment' : 'Purchase request'}</p><b className="text-lg">{mode === 'OUTRIGHT' ? 'Buy / make an offer' : mode === 'RESERVE' ? 'Reserve this car' : mode === 'FINANCE' ? 'Finance request' : mode === 'SHOWROOM' ? 'Book showroom visit' : 'Schedule test drive'}</b></div><button onClick={onBack} className="text-xs font-black text-slate-500">Back</button></div>
    {done ? <div className="mt-4 rounded-2xl bg-emerald-100 p-4 text-sm font-bold text-emerald-900"><CheckCircle2 className="mr-2 inline h-5 w-5" />{done}</div> : <>
      <div className="mt-4 grid grid-cols-2 gap-2"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" className="col-span-2 h-11 rounded-xl border bg-white px-3 text-sm" /><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className="h-11 rounded-xl border bg-white px-3 text-sm" /><input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="WhatsApp" className="h-11 rounded-xl border bg-white px-3 text-sm" /><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email (optional)" className="col-span-2 h-11 rounded-xl border bg-white px-3 text-sm" />{appointment && <input type="datetime-local" value={form.scheduledFor} onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })} className="col-span-2 h-11 rounded-xl border bg-white px-3 text-sm" />}{!appointment && <input type="number" value={form.offer} onChange={(e) => setForm({ ...form, offer: e.target.value })} placeholder="Your offer (optional)" className="col-span-2 h-11 rounded-xl border bg-white px-3 text-sm" />}<textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Message (optional)" className="col-span-2 min-h-20 rounded-xl border bg-white p-3 text-sm" /></div>
      {error && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p>}
      <button disabled={sending || !form.name || !form.phone || (appointment && !form.scheduledFor)} onClick={() => void submit()} className="mt-3 h-12 w-full rounded-2xl bg-[#071d18] font-black text-white disabled:opacity-40">{sending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Send to dealer'}</button>
    </>}
  </div>;
}
