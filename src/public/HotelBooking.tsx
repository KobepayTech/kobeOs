import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight, BedDouble, CalendarDays, CheckCircle2, ChevronDown, Clock, Loader2,
  MapPin, Minus, Phone, Plus, ShoppingBag, Sparkles, Truck, UtensilsCrossed, Users,
} from 'lucide-react';
import { Calendar as DateCalendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  publicApi, publicAssetUrl,
  type PublicMenuItem, type PublicOrder, type PublicTenant,
} from './api';

interface PublicRoom {
  id: string;
  roomNumber: string;
  type: string;
  rate: number;
  currency: string;
  capacity: number;
  available: boolean;
  imageUrl?: string;
}

interface Branding {
  logoUrl: string;
  tagline: string;
  primaryColor: string;
  accentColor: string;
  heroImageUrl: string;
  about: string;
  amenities: string[];
  phone: string;
  whatsapp: string;
  address: string;
}

type SiteView = 'rooms' | 'food';
type FoodDelivery = 'pickup' | 'room' | 'delivery';

function dateFromKey(value: string): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day, 12);
}

function dateKey(value?: Date): string {
  if (!value) return '';
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function nextDateKey(value: string): string {
  const date = dateFromKey(value);
  if (!date) return value;
  date.setDate(date.getDate() + 1);
  return dateKey(date);
}

function displayDate(value: string): string {
  const date = dateFromKey(value);
  return date
    ? date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : 'Select a date';
}

function DatePickerField({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: string;
  min: string;
  onChange: (value: string) => void;
}) {
  const minDate = dateFromKey(min);
  return (
    <div className="flex flex-col gap-1 text-[11px] font-semibold text-slate-500">
      <span className="inline-flex items-center gap-1"><CalendarDays className="w-3 h-3" /> {label}</span>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-left text-sm inline-flex items-center justify-between gap-2 hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 ${value ? 'text-slate-900' : 'text-slate-400'}`}
            aria-label={`Select ${label.toLowerCase()}`}
          >
            <span className="truncate">{displayDate(value)}</span>
            <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto bg-white border-slate-200 p-1 text-slate-900">
          <DateCalendar
            mode="single"
            selected={dateFromKey(value)}
            onSelect={(date) => onChange(dateKey(date))}
            disabled={minDate ? { before: minDate } : undefined}
            initialFocus
            className="bg-white text-slate-900"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function StepTitle({ number, children }: { number: number; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm font-extrabold text-slate-800">
      <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-900 text-[11px] text-white">{number}</span>
      {children}
    </div>
  );
}

export default function HotelBooking({ slug }: { slug: string }) {
  const [view, setView] = useState<SiteView>('rooms');
  const [hotelName, setHotelName] = useState('Hotel');
  const [tenant, setTenant] = useState<PublicTenant | null>(null);
  const [branding, setBranding] = useState<Branding | null>(null);
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [menu, setMenu] = useState<PublicMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<PublicRoom | null>(null);
  const [showBooking, setShowBooking] = useState(false);
  const bookingPanelRef = useRef<HTMLElement | null>(null);
  const [form, setForm] = useState({ guestName: '', guestPhone: '', checkIn: '', checkOut: '', guests: 1 });
  const [busy, setBusy] = useState(false);
  const [bookDone, setBookDone] = useState<{ room: string; nights: number; totalAmount: number; currency: string; payment?: { initiated: boolean; message: string } } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState('All');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [foodForm, setFoodForm] = useState({ guestName: '', guestPhone: '', delivery: 'pickup' as FoodDelivery, roomNumber: '', deliveryAddress: '', note: '' });
  const [orderBusy, setOrderBusy] = useState(false);
  const [orderDone, setOrderDone] = useState<PublicOrder | null>(null);
  const [foodError, setFoodError] = useState<string | null>(null);
  const today = dateKey(new Date());

  useEffect(() => {
    let active = true;
    (async () => {
      const [roomResult, tenantResult, menuResult] = await Promise.allSettled([
        publicApi<{ hotelName: string; rooms: PublicRoom[]; branding?: Branding }>(`/hotel/public/${encodeURIComponent(slug)}/rooms`),
        publicApi<PublicTenant>(`/public/hotel/${encodeURIComponent(slug)}`),
        publicApi<PublicMenuItem[]>(`/public/hotel/${encodeURIComponent(slug)}/menu-items`),
      ]);
      if (!active) return;
      if (roomResult.status === 'fulfilled') {
        setHotelName(roomResult.value.hotelName || 'Hotel');
        setBranding(roomResult.value.branding ?? null);
        setRooms(roomResult.value.rooms || []);
      }
      if (tenantResult.status === 'fulfilled') {
        setTenant(tenantResult.value);
        setHotelName(current => current === 'Hotel' ? tenantResult.value.name : current);
      }
      if (menuResult.status === 'fulfilled') setMenu(menuResult.value || []);
      if (roomResult.status === 'rejected' && tenantResult.status === 'rejected') setError('Could not load this hotel.');
      setLoading(false);
    })();
    return () => { active = false; };
  }, [slug]);

  const primary = branding?.primaryColor || tenant?.brandColor || '#4f46e5';
  const accent = branding?.accentColor || '#8b5cf6';
  const contactPhone = branding?.phone || tenant?.phone || '';
  const address = branding?.address || tenant?.location || '';
  const availableRooms = useMemo(() => rooms.filter(room => room.available), [rooms]);
  const roomTypeCount = useMemo(() => new Set(rooms.map(room => room.type)).size, [rooms]);
  const lowestAvailableRoom = useMemo(
    () => availableRooms.reduce<PublicRoom | null>((lowest, room) => !lowest || room.rate < lowest.rate ? room : lowest, null),
    [availableRooms],
  );

  const categories = useMemo(() => ['All', ...Array.from(new Set(menu.map(item => item.category))).sort()], [menu]);
  const visibleMenu = useMemo(() => category === 'All' ? menu : menu.filter(item => item.category === category), [category, menu]);
  const cartLines = useMemo(() => menu
    .filter(item => (cart[item.id] ?? 0) > 0)
    .map(item => ({ item, qty: cart[item.id] })), [cart, menu]);
  const cartCount = cartLines.reduce((sum, line) => sum + line.qty, 0);
  const cartTotal = cartLines.reduce((sum, line) => sum + Number(line.item.price || 0) * line.qty, 0);
  const foodCurrency = cartLines[0]?.item.currency || tenant?.currency || 'TZS';

  const setCartQty = (id: string, qty: number) => {
    setCart(current => {
      const next = { ...current };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  };

  const openBooking = () => {
    if (!sel) {
      setError('Select an available room first.');
      return;
    }
    setError(null);
    setShowBooking(true);
    window.setTimeout(() => bookingPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  const book = async () => {
    setError(null);
    if (!form.checkIn || !form.checkOut || !sel) {
      setError('Select your dates and room first.');
      return;
    }
    if (!form.guestName.trim() || !form.guestPhone.trim()) {
      setError('Enter your name and phone number in the final step.');
      return;
    }
    setBusy(true);
    try {
      const result = await publicApi<{ ok: boolean; room: string; nights: number; totalAmount: number; currency: string; payment?: { initiated: boolean; message: string } }>(`/hotel/public/${encodeURIComponent(slug)}/book`, {
        method: 'POST',
        body: JSON.stringify({ ...form, roomId: sel.id, roomType: sel.type }),
      });
      setBookDone(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Booking failed.');
    } finally {
      setBusy(false);
    }
  };

  const placeFoodOrder = async () => {
    setFoodError(null);
    if (cartLines.length === 0) {
      setFoodError('Add at least one item to your order.');
      return;
    }
    if (!foodForm.guestName.trim() || !foodForm.guestPhone.trim()) {
      setFoodError('Enter your name and phone number in the final step.');
      return;
    }
    if (foodForm.delivery === 'room' && !foodForm.roomNumber.trim()) {
      setFoodError('Enter the room number for room delivery.');
      return;
    }
    if (foodForm.delivery === 'delivery' && !foodForm.deliveryAddress.trim()) {
      setFoodError('Enter the outside delivery address.');
      return;
    }
    setOrderBusy(true);
    try {
      const order = await publicApi<PublicOrder>(`/public/hotel/${encodeURIComponent(slug)}/orders`, {
        method: 'POST',
        body: JSON.stringify({
          roomNumber: foodForm.delivery === 'room'
            ? foodForm.roomNumber.trim()
            : foodForm.delivery === 'delivery'
              ? foodForm.deliveryAddress.trim()
              : 'Online pickup',
          locationType: foodForm.delivery,
          guestName: foodForm.guestName.trim(),
          guestPhone: foodForm.guestPhone.trim(),
          note: foodForm.note.trim(),
          currency: foodCurrency,
          items: cartLines.map(({ item, qty }) => ({
            menuItemId: item.id,
            name: item.name,
            qty,
            price: Number(item.price || 0),
            station: item.station,
          })),
        }),
      });
      setOrderDone(order);
      setCart({});
    } catch (cause) {
      setFoodError(cause instanceof Error ? cause.message : 'Could not place the food order.');
    } finally {
      setOrderBusy(false);
    }
  };

  if (loading) return <div className="h-[100dvh] overflow-y-auto touch-pan-y grid place-items-center bg-slate-50"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  if (bookDone) return (
    <div className="h-[100dvh] overflow-y-auto touch-pan-y grid place-items-center bg-slate-50 p-6">
      <div className="max-w-sm w-full bg-white rounded-3xl border border-slate-200 p-7 text-center shadow-sm">
        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
        <h1 className="text-xl font-extrabold text-slate-900">Booking requested</h1>
        <p className="text-sm text-slate-500 mt-1">Room {bookDone.room} · {bookDone.nights} night(s)</p>
        <p className="text-2xl font-extrabold text-slate-900 mt-3">{bookDone.currency} {bookDone.totalAmount.toLocaleString()}</p>
        {bookDone.payment?.initiated ? (
          <p className="mt-4 text-sm font-semibold text-indigo-700 bg-indigo-50 rounded-xl px-3 py-3">{bookDone.payment.message}</p>
        ) : (
          <p className="text-xs text-slate-500 mt-4">{bookDone.payment?.message ?? 'The front desk will confirm your booking shortly.'}</p>
        )}
        <button onClick={() => { setBookDone(null); setView('food'); }} className="mt-5 w-full rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">Order food from the restaurant</button>
      </div>
    </div>
  );

  return (
    <div className="h-[100dvh] overflow-y-auto touch-pan-y bg-slate-50 text-slate-900">
      <header className="relative overflow-hidden text-white px-5 py-9" style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}>
        {branding?.heroImageUrl && <img src={publicAssetUrl(branding.heroImageUrl)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />}
        <div className="relative max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            {(branding?.logoUrl || tenant?.logoUrl) && <img src={publicAssetUrl(branding?.logoUrl || tenant?.logoUrl)} alt={hotelName} className="h-14 w-14 rounded-2xl object-cover ring-2 ring-white/40" />}
            <div>
              <h1 className="hotel-heading-animate text-2xl font-extrabold">{hotelName}</h1>
              <p className="hotel-tagline-animate text-sm text-white/80">{branding?.tagline || 'Stay, dine and order online'}</p>
            </div>
          </div>
          {(address || contactPhone) && (
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/80">
              {address && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{address}</span>}
              {contactPhone && <a href={`tel:${contactPhone}`} className="inline-flex items-center gap-1 hover:text-white"><Phone className="h-3.5 w-3.5" />{contactPhone}</a>}
            </div>
          )}
        </div>
      </header>

      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 backdrop-blur">
        <div className="mx-auto flex max-w-5xl gap-2 py-2">
          <button onClick={() => setView('rooms')} className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition ${view === 'rooms' ? 'text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`} style={view === 'rooms' ? { background: primary } : undefined}>
            <BedDouble className="mr-2 inline h-4 w-4" />Rooms & Booking
          </button>
          <button onClick={() => setView('food')} className={`relative flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition ${view === 'food' ? 'text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`} style={view === 'food' ? { background: primary } : undefined}>
            <UtensilsCrossed className="mr-2 inline h-4 w-4" />Food & Restaurant
            {cartCount > 0 && <span className="absolute right-2 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] text-white">{cartCount}</span>}
          </button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto p-4 pb-12">
        {view === 'rooms' ? (
          <div className="space-y-5">
            <section className="space-y-3">
              <div>
                <StepTitle number={1}>Choose your room</StepTitle>
                <p className="mt-1 pl-8 text-sm text-slate-500">Browse the hotel's live room list before entering any booking details.</p>
              </div>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-2xl font-extrabold text-slate-900">{availableRooms.length}</div>
                  <div className="text-xs font-semibold text-slate-500">Available rooms</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-2xl font-extrabold text-slate-900">{roomTypeCount}</div>
                  <div className="text-xs font-semibold text-slate-500">Room types</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="truncate text-base font-extrabold text-slate-900">{lowestAvailableRoom ? `${lowestAvailableRoom.currency} ${lowestAvailableRoom.rate.toLocaleString()}` : '—'}</div>
                  <div className="text-xs font-semibold text-slate-500">Lowest nightly rate</div>
                </div>
                <button type="button" onClick={() => setView('food')} className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-orange-300 hover:shadow-sm">
                  <div className="flex items-center justify-between"><UtensilsCrossed className="h-5 w-5 text-orange-500" /><ArrowRight className="h-4 w-4 text-slate-300" /></div>
                  <div className="mt-2 text-base font-extrabold text-slate-900">{menu.length > 0 ? `${menu.length} menu items` : 'Restaurant'}</div>
                  <div className="text-xs font-semibold text-slate-500">{menu.length > 0 ? 'Order food online' : 'Menu coming soon'}</div>
                </button>
              </div>

              {rooms.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No rooms have been published yet. Please contact the hotel.</div>}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rooms.map(room => (
                  <button key={room.id} type="button" disabled={!room.available} onClick={() => { setSel(room); setShowBooking(false); setError(null); }} className={`overflow-hidden rounded-2xl border bg-white text-left transition ${sel?.id === room.id ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-slate-200 hover:border-indigo-300 hover:shadow-md'} ${room.available ? '' : 'opacity-60'}`}>
                    <div className="relative h-44 bg-gradient-to-br from-indigo-100 via-violet-50 to-slate-100">
                      {room.imageUrl ? (
                        <img src={publicAssetUrl(room.imageUrl)} alt={`${room.type} room ${room.roomNumber}`} className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full place-items-center text-center text-indigo-400"><div><BedDouble className="mx-auto h-10 w-10" /><span className="mt-2 block text-xs font-semibold">Photo coming soon</span></div></div>
                      )}
                      <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold ${room.available ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-white'}`}>{room.available ? 'Available' : 'Not available'}</span>
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div><div className="font-extrabold text-slate-900">{room.type}</div><div className="text-xs text-slate-500">Room {room.roomNumber} · Sleeps {room.capacity}</div></div>
                        <div className="text-right text-sm font-extrabold text-slate-900">{room.currency} {room.rate.toLocaleString()}<span className="block text-[10px] font-normal text-slate-400">per night</span></div>
                      </div>
                      {sel?.id === room.id && <div className="mt-3 inline-flex items-center gap-1 text-xs font-bold" style={{ color: primary }}><CheckCircle2 className="h-3.5 w-3.5" />Selected for booking</div>}
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {(branding?.about || (branding?.amenities && branding.amenities.length > 0)) && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2 text-sm font-extrabold text-slate-800"><Sparkles className="h-4 w-4" style={{ color: primary }} />What this hotel offers</div>
                {branding?.about && <p className="mt-2 text-sm leading-relaxed text-slate-600 whitespace-pre-line">{branding.about}</p>}
                {branding?.amenities && branding.amenities.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{branding.amenities.map((amenity, index) => <span key={`${amenity}-${index}`} className="rounded-full bg-slate-50 border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">{amenity}</span>)}</div>}
              </section>
            )}

            <section className={`rounded-3xl border p-5 text-center ${sel ? 'border-indigo-200 bg-white shadow-sm' : 'border-slate-200 bg-slate-100'}`}>
              {sel ? <p className="mb-3 text-sm text-slate-600">Ready to book <strong className="text-slate-900">{sel.type}, room {sel.roomNumber}</strong>?</p> : <p className="mb-3 text-sm text-slate-500">Select an available room above to continue.</p>}
              <button type="button" onClick={openBooking} disabled={!sel} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-6 font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:min-w-64" style={{ background: primary }}>
                Book now <ArrowRight className="h-4 w-4" />
              </button>
              {!showBooking && error && <div className="mx-auto mt-3 max-w-md rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
            </section>

            {showBooking && sel && (
              <section ref={bookingPanelRef} className="scroll-mt-20 rounded-3xl border border-indigo-200 bg-white p-5 shadow-sm space-y-5">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">Complete your booking</h2>
                  <p className="text-sm text-slate-500">{sel.type}, room {sel.roomNumber} · {sel.currency} {sel.rate.toLocaleString()} per night</p>
                </div>
                <div className="space-y-3">
                  <StepTitle number={2}>Choose dates and guests</StepTitle>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <DatePickerField label="Check-in" value={form.checkIn} min={today} onChange={(checkIn) => setForm(current => ({ ...current, checkIn, checkOut: current.checkOut && current.checkOut <= checkIn ? '' : current.checkOut }))} />
                    <DatePickerField label="Check-out" value={form.checkOut} min={form.checkIn ? nextDateKey(form.checkIn) : today} onChange={(checkOut) => setForm(current => ({ ...current, checkOut }))} />
                    <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-500"><span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> Guests</span>
                      <input type="number" min={1} value={form.guests} onChange={(event) => setForm({ ...form, guests: Math.max(1, Number(event.target.value)) })} className="h-11 rounded-xl border border-slate-200 px-3 text-sm" />
                    </label>
                  </div>
                </div>
                <div className="space-y-3 border-t border-slate-100 pt-5">
                  <StepTitle number={3}>Your name and contact — final step</StepTitle>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input autoComplete="name" placeholder="Your full name" value={form.guestName} onChange={(event) => setForm({ ...form, guestName: event.target.value })} className="h-11 rounded-xl border border-slate-200 px-3 text-sm" />
                    <input autoComplete="tel" inputMode="tel" placeholder="Phone number" value={form.guestPhone} onChange={(event) => setForm({ ...form, guestPhone: event.target.value })} className="h-11 rounded-xl border border-slate-200 px-3 text-sm" />
                  </div>
                  {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
                  <button onClick={() => void book()} disabled={busy || !form.checkIn || !form.checkOut} style={{ background: primary }} className="w-full h-12 rounded-xl text-white font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Confirm booking request
                  </button>
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">Order from {hotelName} Restaurant</h2>
                <p className="mt-1 text-sm text-slate-500">Choose your food, then enter your name and phone only at checkout.</p>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {categories.map(itemCategory => <button key={itemCategory} onClick={() => setCategory(itemCategory)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold ${category === itemCategory ? 'text-white' : 'border border-slate-200 bg-white text-slate-600'}`} style={category === itemCategory ? { background: primary } : undefined}>{itemCategory}</button>)}
              </div>
              {menu.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><UtensilsCrossed className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-2 text-sm text-slate-500">The restaurant menu has not been published yet.</p></div>}
              <div className="grid gap-4 sm:grid-cols-2">
                {visibleMenu.map(item => {
                  const qty = cart[item.id] ?? 0;
                  return (
                    <article key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      <div className="h-40 bg-gradient-to-br from-amber-50 to-orange-100">
                        {item.imageUrl ? <img src={publicAssetUrl(item.imageUrl)} alt={item.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-orange-300"><UtensilsCrossed className="h-10 w-10" /></div>}
                      </div>
                      <div className="p-4">
                        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{item.category}</div>
                        <h3 className="mt-0.5 font-extrabold text-slate-900">{item.name}</h3>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <span className="text-sm font-extrabold text-slate-900">{item.currency} {Number(item.price).toLocaleString()}</span>
                          {qty === 0 ? (
                            <button onClick={() => setCartQty(item.id, 1)} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold text-white" style={{ background: primary }}><Plus className="h-3.5 w-3.5" />Add</button>
                          ) : (
                            <div className="flex items-center gap-2 rounded-lg bg-slate-100 p-1"><button onClick={() => setCartQty(item.id, qty - 1)} className="grid h-7 w-7 place-items-center rounded-md bg-white text-slate-700"><Minus className="h-3.5 w-3.5" /></button><span className="min-w-5 text-center text-sm font-bold">{qty}</span><button onClick={() => setCartQty(item.id, qty + 1)} className="grid h-7 w-7 place-items-center rounded-md text-white" style={{ background: primary }}><Plus className="h-3.5 w-3.5" /></button></div>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 lg:sticky lg:top-20">
              {orderDone ? (
                <div className="py-5 text-center">
                  <CheckCircle2 className="mx-auto h-11 w-11 text-emerald-500" />
                  <h3 className="mt-3 text-lg font-extrabold text-slate-900">Order received</h3>
                  <p className="mt-1 text-sm text-slate-500">Order #{orderDone.id.slice(0, 8)} is now {orderDone.status.toLowerCase()}.</p>
                  <p className="mt-3 text-xl font-extrabold">{orderDone.currency} {Number(orderDone.total).toLocaleString()}</p>
                  <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700"><Clock className="h-3.5 w-3.5" />The restaurant will prepare it shortly</div>
                  <button onClick={() => setOrderDone(null)} className="mt-5 w-full rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-700">Start another order</button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between"><h3 className="inline-flex items-center gap-2 font-extrabold text-slate-900"><ShoppingBag className="h-4 w-4" />Your order</h3><span className="text-xs font-bold text-slate-400">{cartCount} item(s)</span></div>
                  {cartLines.length === 0 ? <p className="rounded-xl bg-slate-50 py-6 text-center text-sm text-slate-400">Add food from the menu</p> : <div className="space-y-3">{cartLines.map(({ item, qty }) => <div key={item.id} className="flex items-center justify-between gap-3 text-sm"><div className="min-w-0"><div className="truncate font-semibold text-slate-800">{qty} × {item.name}</div><div className="text-[11px] text-slate-400">{item.currency} {Number(item.price).toLocaleString()} each</div></div><div className="font-bold text-slate-800">{item.currency} {(Number(item.price) * qty).toLocaleString()}</div></div>)}</div>}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-3"><span className="text-sm font-semibold text-slate-500">Total</span><span className="text-lg font-extrabold text-slate-900">{foodCurrency} {cartTotal.toLocaleString()}</span></div>

                  <div className="border-t border-slate-100 pt-4 space-y-3">
                    <StepTitle number={2}>Name and contact — final step</StepTitle>
                    <div className="grid grid-cols-3 gap-2">
                      <button onClick={() => setFoodForm(current => ({ ...current, delivery: 'pickup' }))} className={`rounded-xl border px-3 py-2 text-xs font-bold ${foodForm.delivery === 'pickup' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600'}`}>Pickup</button>
                      <button onClick={() => setFoodForm(current => ({ ...current, delivery: 'room' }))} className={`rounded-xl border px-3 py-2 text-xs font-bold ${foodForm.delivery === 'room' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600'}`}>Deliver to room</button>
                      <button onClick={() => setFoodForm(current => ({ ...current, delivery: 'delivery' }))} className={`rounded-xl border px-3 py-2 text-xs font-bold ${foodForm.delivery === 'delivery' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600'}`}>Outside delivery</button>
                    </div>
                    {foodForm.delivery === 'room' && <input placeholder="Room number" value={foodForm.roomNumber} onChange={event => setFoodForm({ ...foodForm, roomNumber: event.target.value })} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" />}
                    {foodForm.delivery === 'delivery' && (
                      <div className="space-y-1">
                        <div className="relative">
                          <Truck className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                          <input maxLength={160} autoComplete="street-address" placeholder="Delivery address or landmark" value={foodForm.deliveryAddress} onChange={event => setFoodForm({ ...foodForm, deliveryAddress: event.target.value })} className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm" />
                        </div>
                        <p className="text-[10px] text-slate-400">The hotel will confirm delivery availability and any delivery fee by phone.</p>
                      </div>
                    )}
                    <input autoComplete="name" placeholder="Your full name" value={foodForm.guestName} onChange={event => setFoodForm({ ...foodForm, guestName: event.target.value })} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" />
                    <input autoComplete="tel" inputMode="tel" placeholder="Phone number" value={foodForm.guestPhone} onChange={event => setFoodForm({ ...foodForm, guestPhone: event.target.value })} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" />
                    <textarea placeholder="Special instructions (optional)" value={foodForm.note} onChange={event => setFoodForm({ ...foodForm, note: event.target.value })} className="min-h-20 w-full resize-none rounded-xl border border-slate-200 p-3 text-sm" />
                    {foodError && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{foodError}</div>}
                    <button disabled={orderBusy || cartLines.length === 0} onClick={() => void placeFoodOrder()} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl font-bold text-white disabled:opacity-50" style={{ background: primary }}>
                      {orderBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />}Place restaurant order
                    </button>
                  </div>
                </div>
              )}
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
