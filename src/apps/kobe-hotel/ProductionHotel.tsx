import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BedDouble, Building2, CalendarDays, CheckCircle2, ChefHat, ClipboardList,
  CreditCard, Globe2, Hotel, LayoutDashboard, Loader2, Package, Plus, RefreshCw,
  Save, ShoppingBag, Trash2, Users, Wallet, Wrench, X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useHotelLive, type HotelOrder, type HotelServiceRequest } from './useHotelLive';
import HotelOperationsBoard from './HotelOperationsBoard';
import LalaAndStatementsBoard from './LalaAndStatementsBoard';
import WalletTab from './WalletTab';
import BookingSiteTab from './BookingSiteTab';

type Tab = 'overview' | 'frontdesk' | 'rooms' | 'menu' | 'orders' | 'requests' | 'inventory' | 'staff' | 'operations' | 'lala' | 'wallet' | 'website';
type RoomStatus = 'available' | 'occupied' | 'reserved' | 'cleaning' | 'maintenance';
type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED';

interface PropertyRow { id: string; name: string; slug: string; location?: string; phone?: string; email?: string; currency?: string; }
interface RoomRow { id: string; roomNumber: string; type: string; rate: number | string; currency: string; capacity: number; status: RoomStatus; imageUrl?: string | null; hotelId?: string | null; }
interface GuestRow { id: string; name: string; phone: string; email?: string | null; nationality?: string | null; idType?: string | null; idNumber?: string | null; hotelId?: string | null; }
interface BookingRow { id: string; roomId: string; guestId: string; checkIn: string; checkOut: string; guestCount: number; status: BookingStatus; totalAmount: number | string; currency: string; hotelId?: string | null; createdAt?: string; }
interface MenuRow { id: string; name: string; category: string; price: number | string; currency: string; available: boolean; station: 'kitchen' | 'bar' | 'other'; imageUrl?: string | null; hotelId?: string | null; }
interface InventoryRow { id: string; name: string; category: string; quantity: number | string; unit: string; reorderLevel: number | string; costPerUnit?: number | string; currency?: string; hotelId?: string | null; }
interface StaffRow { id: string; name: string; role: string; phone: string; email?: string | null; status: 'active' | 'off' | 'suspended'; hotelId?: string | null; }
interface Folio { bookingId: string; total: number; paid: number; outstanding: number; currency: string; payments: Array<{ id: string; amount: number | string; description: string; createdAt: string }>; }

const money = (value: number | string, currency = 'TZS') => `${currency} ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const date = (value: string) => value ? new Date(value).toLocaleDateString() : '—';
const today = () => new Date().toISOString().slice(0, 10);

const NAV: Array<{ id: Tab; label: string; icon: typeof Hotel }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'frontdesk', label: 'Front desk', icon: CalendarDays },
  { id: 'rooms', label: 'Rooms', icon: BedDouble },
  { id: 'menu', label: 'Menu', icon: ChefHat },
  { id: 'orders', label: 'Orders / KDS', icon: ShoppingBag },
  { id: 'requests', label: 'Guest requests', icon: ClipboardList },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'staff', label: 'Staff', icon: Users },
  { id: 'operations', label: 'HR & operations', icon: Wrench },
  { id: 'lala', label: 'Lala & books', icon: Globe2 },
  { id: 'wallet', label: 'Wallet', icon: Wallet },
  { id: 'website', label: 'Booking website', icon: Globe2 },
];

export default function ProductionHotel() {
  const [tab, setTab] = useState<Tab>('overview');
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [menu, setMenu] = useState<MenuRow[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const live = useHotelLive();

  const property = properties.find((item) => item.id === propertyId) ?? properties[0];
  const effectivePropertyId = property?.id ?? '';

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const p = await api<PropertyRow[]>('/hotel/properties', { offlineFallback: false });
      const propertyRows = Array.isArray(p) ? p : [];
      setProperties(propertyRows);
      const chosen = propertyRows.some((item) => item.id === propertyId) ? propertyId : propertyRows[0]?.id ?? '';
      setPropertyId(chosen);
      if (!chosen) {
        setRooms([]); setGuests([]); setBookings([]); setMenu([]); setInventory([]); setStaff([]);
        return;
      }
      const query = `?hotelId=${encodeURIComponent(chosen)}&limit=100`;
      const [r, g, b, m, inv, s] = await Promise.all([
        api<RoomRow[]>(`/hotel/rooms${query}`, { offlineFallback: false }),
        api<GuestRow[]>(`/hotel/guests${query}`, { offlineFallback: false }),
        api<BookingRow[]>(`/hotel/bookings${query}`, { offlineFallback: false }),
        api<MenuRow[]>(`/hotel/menu-items${query}`, { offlineFallback: false }),
        api<InventoryRow[]>('/hotel/inventory', { offlineFallback: false }),
        api<StaffRow[]>('/hotel/staff', { offlineFallback: false }),
      ]);
      setRooms((Array.isArray(r) ? r : []).filter((x) => !x.hotelId || x.hotelId === chosen));
      setGuests((Array.isArray(g) ? g : []).filter((x) => !x.hotelId || x.hotelId === chosen));
      setBookings((Array.isArray(b) ? b : []).filter((x) => !x.hotelId || x.hotelId === chosen));
      setMenu((Array.isArray(m) ? m : []).filter((x) => !x.hotelId || x.hotelId === chosen));
      setInventory((Array.isArray(inv) ? inv : []).filter((x) => !x.hotelId || x.hotelId === chosen));
      setStaff((Array.isArray(s) ? s : []).filter((x) => !x.hotelId || x.hotelId === chosen));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Kobe Hotel could not load live data.');
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice((current) => current === message ? '' : current), 3500);
  };

  const filteredOrders = useMemo(() => live.orders.filter((order) => {
    const scoped = order as HotelOrder & { hotelId?: string | null };
    return !effectivePropertyId || !scoped.hotelId || scoped.hotelId === effectivePropertyId;
  }), [live.orders, effectivePropertyId]);
  const filteredRequests = useMemo(() => live.requests.filter((request) => {
    const scoped = request as HotelServiceRequest & { hotelId?: string | null };
    return !effectivePropertyId || !scoped.hotelId || scoped.hotelId === effectivePropertyId;
  }), [live.requests, effectivePropertyId]);

  if (loading && properties.length === 0) {
    return <div className="h-full grid place-items-center bg-slate-50"><Loader2 className="h-7 w-7 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="h-full min-h-0 flex bg-slate-50 text-slate-900" data-surface="light">
      <aside className="w-56 shrink-0 border-r border-slate-200 bg-[#0d2135] text-white flex flex-col">
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-2"><div className="h-9 w-9 rounded-xl bg-cyan-300 text-[#0d2135] grid place-items-center"><Hotel className="h-5 w-5" /></div><div><div className="text-sm font-black">Kobe Hotels</div><div className="text-[10px] text-white/50">LIVE OPERATIONS</div></div></div>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {NAV.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} className={`w-full h-10 px-3 rounded-lg flex items-center gap-2 text-xs font-bold ${tab === id ? 'bg-white text-[#0d2135]' : 'text-white/70 hover:bg-white/10'}`}><Icon className="h-4 w-4" />{label}</button>)}
        </nav>
        <div className="p-3 border-t border-white/10 text-[10px] text-white/45">No demo data. Every record on this screen comes from KobeOS APIs.</div>
      </aside>

      <section className="min-w-0 flex-1 flex flex-col">
        <header className="h-16 shrink-0 border-b border-slate-200 bg-white px-4 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-black">{property?.name ?? 'Set up your first hotel'}</div>
            <div className="text-[10px] text-slate-400">{property?.location || property?.slug || 'No property configured'}</div>
          </div>
          {properties.length > 0 && <select value={effectivePropertyId} onChange={(e) => setPropertyId(e.target.value)} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold">{properties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}
          <div className={`hidden sm:flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black ${live.connected ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}><span className={`h-2 w-2 rounded-full ${live.connected ? 'bg-emerald-500' : 'bg-amber-500'}`} />{live.connected ? 'LIVE' : 'RECONNECTING'}</div>
          <button onClick={() => void refresh()} className="h-9 w-9 rounded-xl border border-slate-200 grid place-items-center"><RefreshCw className="h-4 w-4" /></button>
        </header>

        {(error || notice) && <div className={`mx-4 mt-3 rounded-xl px-4 py-2 text-xs font-semibold ${error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{error || notice}</div>}

        <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {properties.length === 0 ? <PropertyOnboarding onCreated={async () => { await refresh(); flash('Hotel created.'); }} /> : (
            <>
              {tab === 'overview' && <Overview property={property!} rooms={rooms} bookings={bookings} orders={filteredOrders} requests={filteredRequests} inventory={inventory} staff={staff} onNavigate={setTab} />}
              {tab === 'frontdesk' && <FrontDesk property={property!} rooms={rooms} guests={guests} bookings={bookings} onChanged={refresh} flash={flash} />}
              {tab === 'rooms' && <Rooms property={property!} rooms={rooms} onChanged={refresh} flash={flash} />}
              {tab === 'menu' && <Menu property={property!} rows={menu} onChanged={refresh} flash={flash} />}
              {tab === 'orders' && <Orders property={property!} menu={menu} orders={filteredOrders} advance={live.advanceOrder} flash={flash} />}
              {tab === 'requests' && <Requests requests={filteredRequests} advance={live.advanceRequest} flash={flash} />}
              {tab === 'inventory' && <Inventory property={property!} rows={inventory} onChanged={refresh} flash={flash} />}
              {tab === 'staff' && <Staff property={property!} rows={staff} onChanged={refresh} flash={flash} />}
              {tab === 'operations' && <div className="min-h-[720px]"><HotelOperationsBoard /></div>}
              {tab === 'lala' && <div className="min-h-[720px]"><LalaAndStatementsBoard /></div>}
              {tab === 'wallet' && <div className="min-h-[650px] rounded-2xl overflow-hidden bg-[#0a0a1a] text-white"><WalletTab /></div>}
              {tab === 'website' && <div className="h-[760px] rounded-2xl overflow-hidden border border-slate-200 bg-white"><BookingSiteTab /></div>}
            </>
          )}
        </main>
      </section>
    </div>
  );
}

function PropertyOnboarding({ onCreated }: { onCreated: () => Promise<void> }) {
  const [form, setForm] = useState({ name: '', slug: '', location: '', phone: '', email: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const create = async () => {
    setError('');
    const slug = (form.slug || form.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    if (form.name.trim().length < 2 || slug.length < 3) { setError('Enter a hotel name and a valid slug.'); return; }
    setBusy(true);
    try {
      await api('/hotel/properties', { method: 'POST', body: JSON.stringify({ ...form, name: form.name.trim(), slug }), offlineFallback: false });
      await onCreated();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create hotel.'); }
    finally { setBusy(false); }
  };
  return <div className="max-w-xl mx-auto mt-10 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><Building2 className="h-10 w-10 text-cyan-700" /><h1 className="mt-3 text-2xl font-black">Set up your hotel</h1><p className="mt-1 text-sm text-slate-500">Kobe Hotels starts empty. Add your real property; no sample rooms or guests are created.</p>{error && <p className="mt-3 text-xs text-red-600">{error}</p>}<div className="mt-5 grid sm:grid-cols-2 gap-3"><Field label="Hotel name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} /><Field label="Public slug" value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} placeholder="my-hotel" /><Field label="Location" value={form.location} onChange={(v) => setForm({ ...form, location: v })} /><Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} /><Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} /></div><button disabled={busy} onClick={() => void create()} className="mt-5 h-11 rounded-xl bg-[#0d2135] px-5 text-sm font-black text-white disabled:opacity-50">{busy ? 'Creating…' : 'Create hotel'}</button></div>;
}

function Overview({ property, rooms, bookings, orders, requests, inventory, staff, onNavigate }: { property: PropertyRow; rooms: RoomRow[]; bookings: BookingRow[]; orders: HotelOrder[]; requests: HotelServiceRequest[]; inventory: InventoryRow[]; staff: StaffRow[]; onNavigate: (tab: Tab) => void; }) {
  const occupied = rooms.filter((room) => room.status === 'occupied').length;
  const arrivals = bookings.filter((b) => String(b.checkIn).slice(0, 10) === today() && ['PENDING', 'CONFIRMED'].includes(b.status)).length;
  const departures = bookings.filter((b) => String(b.checkOut).slice(0, 10) === today() && b.status === 'CHECKED_IN').length;
  const openOrders = orders.filter((o) => !['DELIVERED', 'CANCELLED'].includes(o.status)).length;
  const openRequests = requests.filter((r) => !['COMPLETED', 'CANCELLED'].includes(r.status)).length;
  const lowStock = inventory.filter((row) => Number(row.quantity) <= Number(row.reorderLevel)).length;
  const cards = [
    ['Rooms occupied', `${occupied}/${rooms.length}`, 'rooms' as Tab], ['Arrivals today', arrivals, 'frontdesk' as Tab], ['Departures today', departures, 'frontdesk' as Tab],
    ['Open orders', openOrders, 'orders' as Tab], ['Guest requests', openRequests, 'requests' as Tab], ['Low stock', lowStock, 'inventory' as Tab], ['Active staff', staff.filter((s) => s.status === 'active').length, 'staff' as Tab],
  ];
  return <div className="space-y-5"><div><h1 className="text-2xl font-black">{property.name}</h1><p className="text-sm text-slate-500">Live operational status from your hotel database.</p></div><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">{cards.map(([label, value, target]) => <button key={String(label)} onClick={() => onNavigate(target as Tab)} className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm"><div className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</div><div className="mt-2 text-3xl font-black">{value}</div></button>)}</div><div className="grid lg:grid-cols-2 gap-4"><Panel title="Room state"><div className="grid grid-cols-2 gap-2">{(['available','occupied','reserved','cleaning','maintenance'] as RoomStatus[]).map((status) => <Metric key={status} label={status} value={rooms.filter((r) => r.status === status).length} />)}</div></Panel><Panel title="Today"><div className="space-y-2 text-sm"><Row label="Confirmed arrivals" value={arrivals} /><Row label="Guests due to depart" value={departures} /><Row label="Orders requiring action" value={openOrders} /><Row label="Requests requiring action" value={openRequests} /></div></Panel></div></div>;
}

function FrontDesk({ property, rooms, guests, bookings, onChanged, flash }: { property: PropertyRow; rooms: RoomRow[]; guests: GuestRow[]; bookings: BookingRow[]; onChanged: () => Promise<void>; flash: (s: string) => void; }) {
  const [showNew, setShowNew] = useState(false);
  const [paymentFor, setPaymentFor] = useState<BookingRow | null>(null);
  const [folio, setFolio] = useState<Folio | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ roomId: '', guestName: '', guestPhone: '', guestEmail: '', guestNationality: '', guestIdNumber: '', checkIn: today(), checkOut: '', guestCount: '1', totalAmount: '' });
  const [pay, setPay] = useState({ amount: '', method: 'CASH', reference: '' });
  const roomMap = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);
  const guestMap = useMemo(() => new Map(guests.map((g) => [g.id, g])), [guests]);
  const active = bookings.filter((b) => !['CHECKED_OUT', 'CANCELLED'].includes(b.status)).sort((a, b) => String(a.checkIn).localeCompare(String(b.checkIn)));

  const reserve = async () => {
    if (!form.roomId || !form.guestName.trim() || !form.guestPhone.trim() || !form.checkOut) return;
    setBusy(true);
    try {
      await api('/hotel/front-desk/reservations', { method: 'POST', body: JSON.stringify({ roomId: form.roomId, guestName: form.guestName, guestPhone: form.guestPhone, guestEmail: form.guestEmail || undefined, guestNationality: form.guestNationality || undefined, guestIdNumber: form.guestIdNumber || undefined, guestIdType: form.guestIdNumber ? 'passport_or_id' : undefined, checkIn: form.checkIn, checkOut: form.checkOut, guestCount: Number(form.guestCount) || 1, ...(form.totalAmount ? { totalAmount: Number(form.totalAmount) } : {}) }), offlineFallback: false });
      setShowNew(false); setForm({ roomId: '', guestName: '', guestPhone: '', guestEmail: '', guestNationality: '', guestIdNumber: '', checkIn: today(), checkOut: '', guestCount: '1', totalAmount: '' }); await onChanged(); flash('Reservation created.');
    } catch (reason) { window.alert(reason instanceof Error ? reason.message : 'Reservation failed.'); }
    finally { setBusy(false); }
  };
  const action = async (booking: BookingRow, kind: 'check-in' | 'check-out' | 'cancel') => {
    setBusy(true); try { await api(`/hotel/front-desk/bookings/${booking.id}/${kind}`, { method: 'POST', body: '{}', offlineFallback: false }); await onChanged(); flash(kind === 'check-in' ? 'Guest checked in.' : kind === 'check-out' ? 'Guest checked out. Room sent to housekeeping.' : 'Reservation cancelled.'); } catch (reason) { window.alert(reason instanceof Error ? reason.message : 'Action failed.'); } finally { setBusy(false); }
  };
  const openPayment = async (booking: BookingRow) => { setPaymentFor(booking); setPay({ amount: '', method: 'CASH', reference: '' }); try { setFolio(await api<Folio>(`/hotel/front-desk/bookings/${booking.id}/folio`, { offlineFallback: false })); } catch { setFolio(null); } };
  const recordPayment = async () => { if (!paymentFor || !pay.amount) return; setBusy(true); try { const response = await api<{ folio: Folio }>(`/hotel/front-desk/bookings/${paymentFor.id}/payments`, { method: 'POST', body: JSON.stringify({ amount: Number(pay.amount), method: pay.method, reference: pay.reference || undefined }), offlineFallback: false }); setFolio(response.folio); setPay({ ...pay, amount: '', reference: '' }); flash('Payment recorded and sent to Hotel financials/Kobe Accountant.'); } catch (reason) { window.alert(reason instanceof Error ? reason.message : 'Payment failed.'); } finally { setBusy(false); } };

  return <div className="space-y-4"><div className="flex items-center justify-between"><div><h1 className="text-2xl font-black">Front desk</h1><p className="text-sm text-slate-500">Reservations, check-in, folios and checkout.</p></div><button onClick={() => setShowNew(true)} className="h-10 px-4 rounded-xl bg-[#0d2135] text-white text-xs font-black inline-flex items-center gap-2"><Plus className="h-4 w-4" />New reservation</button></div><Panel title="Active reservations & stays"><div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-left text-slate-400"><Th>Guest</Th><Th>Room</Th><Th>Stay</Th><Th>Status</Th><Th>Total</Th><Th>Actions</Th></tr></thead><tbody>{active.map((b) => { const room = roomMap.get(b.roomId); const guest = guestMap.get(b.guestId); return <tr key={b.id} className="border-t border-slate-100"><Td><b>{guest?.name || b.guestId}</b><div className="text-slate-400">{guest?.phone}</div></Td><Td>#{room?.roomNumber || b.roomId}</Td><Td>{date(String(b.checkIn))} → {date(String(b.checkOut))}</Td><Td><Status value={b.status} /></Td><Td>{money(b.totalAmount, b.currency)}</Td><Td><div className="flex flex-wrap gap-1"><Small onClick={() => void openPayment(b)}>Folio</Small>{['PENDING','CONFIRMED'].includes(b.status) && <Small onClick={() => void action(b,'check-in')}>Check in</Small>}{b.status === 'CHECKED_IN' && <Small onClick={() => void action(b,'check-out')}>Check out</Small>}{['PENDING','CONFIRMED'].includes(b.status) && <Small tone="danger" onClick={() => void action(b,'cancel')}>Cancel</Small>}</div></Td></tr>; })}{active.length === 0 && <tr><Td colSpan={6}><Empty text="No active reservations." /></Td></tr>}</tbody></table></div></Panel>{showNew && <Modal title="New reservation" onClose={() => setShowNew(false)}><div className="grid sm:grid-cols-2 gap-3"><label className="text-xs font-bold">Room<select value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })} className={inputClass}><option value="">Choose room</option>{rooms.filter((r) => !['maintenance','occupied','cleaning'].includes(r.status)).map((r) => <option key={r.id} value={r.id}>#{r.roomNumber} · {r.type} · {money(r.rate,r.currency)}</option>)}</select></label><Field label="Guest name" value={form.guestName} onChange={(v) => setForm({ ...form, guestName: v })} /><Field label="Phone" value={form.guestPhone} onChange={(v) => setForm({ ...form, guestPhone: v })} /><Field label="Email" value={form.guestEmail} onChange={(v) => setForm({ ...form, guestEmail: v })} /><Field label="Nationality" value={form.guestNationality} onChange={(v) => setForm({ ...form, guestNationality: v })} /><Field label="ID / passport" value={form.guestIdNumber} onChange={(v) => setForm({ ...form, guestIdNumber: v })} /><Field label="Check in" type="date" value={form.checkIn} onChange={(v) => setForm({ ...form, checkIn: v })} /><Field label="Check out" type="date" value={form.checkOut} onChange={(v) => setForm({ ...form, checkOut: v })} /><Field label="Guests" type="number" value={form.guestCount} onChange={(v) => setForm({ ...form, guestCount: v })} /><Field label="Override total (optional)" type="number" value={form.totalAmount} onChange={(v) => setForm({ ...form, totalAmount: v })} /></div><button disabled={busy} onClick={() => void reserve()} className={primaryButton}><Save className="h-4 w-4" />Save reservation</button></Modal>}{paymentFor && <Modal title="Booking folio" onClose={() => { setPaymentFor(null); setFolio(null); }}><div className="grid grid-cols-3 gap-2"><Metric label="Total" value={folio ? money(folio.total,folio.currency) : '…'} /><Metric label="Paid" value={folio ? money(folio.paid,folio.currency) : '…'} /><Metric label="Outstanding" value={folio ? money(folio.outstanding,folio.currency) : '…'} /></div><div className="mt-4 grid sm:grid-cols-3 gap-2"><Field label="Payment amount" type="number" value={pay.amount} onChange={(v) => setPay({ ...pay, amount: v })} /><label className="text-xs font-bold">Method<select className={inputClass} value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>{['CASH','MOBILE_MONEY','CARD','BANK'].map((x) => <option key={x}>{x}</option>)}</select></label><Field label="Reference" value={pay.reference} onChange={(v) => setPay({ ...pay, reference: v })} /></div><button disabled={busy || !pay.amount || !folio?.outstanding} onClick={() => void recordPayment()} className={primaryButton}><CreditCard className="h-4 w-4" />Record payment</button>{folio?.payments?.length ? <div className="mt-4 space-y-2">{folio.payments.map((p) => <div key={p.id} className="rounded-xl bg-slate-50 p-3 text-xs flex justify-between"><span>{p.description}<small className="block text-slate-400">{new Date(p.createdAt).toLocaleString()}</small></span><b>{money(p.amount,folio.currency)}</b></div>)}</div> : null}</Modal>}</div>;
}

function Rooms({ property, rooms, onChanged, flash }: { property: PropertyRow; rooms: RoomRow[]; onChanged: () => Promise<void>; flash: (s: string) => void; }) {
  const [showNew, setShowNew] = useState(false); const [busy, setBusy] = useState(false); const [form, setForm] = useState({ roomNumber: '', type: 'Standard', rate: '', capacity: '2', imageUrl: '' });
  const add = async () => { if (!form.roomNumber || !form.rate) return; setBusy(true); try { await api('/hotel/rooms',{method:'POST',body:JSON.stringify({hotelId:property.id,roomNumber:form.roomNumber,type:form.type,rate:Number(form.rate),capacity:Number(form.capacity)||2,currency:property.currency||'TZS',imageUrl:form.imageUrl||undefined}),offlineFallback:false}); setShowNew(false); setForm({roomNumber:'',type:'Standard',rate:'',capacity:'2',imageUrl:''}); await onChanged(); flash('Room added.'); } catch (reason) { window.alert(reason instanceof Error ? reason.message : 'Could not add room.'); } finally { setBusy(false); } };
  const setStatus = async (room: RoomRow, status: 'available'|'cleaning'|'maintenance') => { try { await api(`/hotel/front-desk/rooms/${room.id}/status`,{method:'PATCH',body:JSON.stringify({status}),offlineFallback:false}); await onChanged(); flash(`Room ${room.roomNumber} → ${status}.`); } catch (reason) { window.alert(reason instanceof Error ? reason.message : 'Could not update room.'); } };
  return <div className="space-y-4"><div className="flex justify-between items-center"><div><h1 className="text-2xl font-black">Rooms</h1><p className="text-sm text-slate-500">Physical room state. Checkout sends a room to Cleaning; housekeeping marks it Available.</p></div><button onClick={() => setShowNew(true)} className="h-10 px-4 rounded-xl bg-[#0d2135] text-white text-xs font-black inline-flex items-center gap-2"><Plus className="h-4 w-4" />Add room</button></div><div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">{rooms.map((room) => <div key={room.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden"><div className="h-28 bg-slate-100">{room.imageUrl ? <img src={room.imageUrl} alt="" className="h-full w-full object-cover" /> : <div className="h-full grid place-items-center"><BedDouble className="h-8 w-8 text-slate-300" /></div>}</div><div className="p-4"><div className="flex justify-between"><div><b>Room {room.roomNumber}</b><div className="text-xs text-slate-400">{room.type} · {room.capacity} guests</div></div><Status value={room.status} /></div><div className="mt-2 font-black">{money(room.rate,room.currency)}<small className="font-normal text-slate-400"> / night</small></div><div className="mt-3 flex flex-wrap gap-1">{room.status === 'cleaning' && <Small onClick={() => void setStatus(room,'available')}>Mark ready</Small>}{room.status === 'available' && <Small onClick={() => void setStatus(room,'maintenance')}>Maintenance</Small>}{room.status === 'maintenance' && <Small onClick={() => void setStatus(room,'available')}>Return to service</Small>}</div></div></div>)}</div>{rooms.length === 0 && <Empty text="No rooms yet. Add the real rooms for this property." />}{showNew && <Modal title="Add room" onClose={() => setShowNew(false)}><div className="grid sm:grid-cols-2 gap-3"><Field label="Room number" value={form.roomNumber} onChange={(v)=>setForm({...form,roomNumber:v})}/><Field label="Room type" value={form.type} onChange={(v)=>setForm({...form,type:v})}/><Field label="Nightly rate" type="number" value={form.rate} onChange={(v)=>setForm({...form,rate:v})}/><Field label="Capacity" type="number" value={form.capacity} onChange={(v)=>setForm({...form,capacity:v})}/><Field label="Photo URL (optional)" value={form.imageUrl} onChange={(v)=>setForm({...form,imageUrl:v})}/></div><button disabled={busy} onClick={() => void add()} className={primaryButton}><Save className="h-4 w-4" />Save room</button></Modal>}</div>;
}

function Menu({ property, rows, onChanged, flash }: { property: PropertyRow; rows: MenuRow[]; onChanged: () => Promise<void>; flash: (s:string)=>void; }) {
  const blank = { name:'',category:'',price:'',station:'kitchen',imageUrl:'' }; const [form,setForm]=useState(blank); const [editing,setEditing]=useState<MenuRow|null>(null); const [busy,setBusy]=useState(false);
  const save=async()=>{const source=editing?{name:editing.name,category:editing.category,price:String(editing.price),station:editing.station,imageUrl:editing.imageUrl||''}:form;if(!source.name||!source.category||!source.price)return;setBusy(true);try{await api(editing?`/hotel/menu-items/${editing.id}`:'/hotel/menu-items',{method:editing?'PATCH':'POST',body:JSON.stringify({name:source.name,category:source.category,price:Number(source.price),currency:property.currency||'TZS',station:source.station,available:editing?.available??true,imageUrl:source.imageUrl||undefined,hotelId:property.id}),offlineFallback:false});setForm(blank);setEditing(null);await onChanged();flash('Menu saved.');}catch(reason){window.alert(reason instanceof Error?reason.message:'Could not save menu.');}finally{setBusy(false);}};
  const remove=async(row:MenuRow)=>{if(!window.confirm(`Delete ${row.name}?`))return;await api(`/hotel/menu-items/${row.id}`,{method:'DELETE',offlineFallback:false});await onChanged();};
  const toggle=async(row:MenuRow)=>{await api(`/hotel/menu-items/${row.id}`,{method:'PATCH',body:JSON.stringify({available:!row.available}),offlineFallback:false});await onChanged();};
  const value=editing?{name:editing.name,category:editing.category,price:String(editing.price),station:editing.station,imageUrl:editing.imageUrl||''}:form; const set=(patch:Partial<typeof form>)=>editing?setEditing({...editing,...patch,price:patch.price??editing.price,station:(patch.station as MenuRow['station'])??editing.station}):setForm({...form,...patch});
  return <div className="space-y-4"><div><h1 className="text-2xl font-black">Food & beverage menu</h1><p className="text-sm text-slate-500">One live catalogue feeds guest ordering and staff orders.</p></div><Panel title={editing?'Edit menu item':'Add menu item'}><div className="grid sm:grid-cols-5 gap-2"><Field label="Name" value={String(value.name)} onChange={(v)=>set({name:v})}/><Field label="Category" value={String(value.category)} onChange={(v)=>set({category:v})}/><Field label="Price" type="number" value={String(value.price)} onChange={(v)=>set({price:v})}/><label className="text-xs font-bold">Station<select className={inputClass} value={String(value.station)} onChange={(e)=>set({station:e.target.value})}><option value="kitchen">Kitchen</option><option value="bar">Bar</option><option value="other">Other</option></select></label><Field label="Image URL" value={String(value.imageUrl)} onChange={(v)=>set({imageUrl:v})}/></div><div className="flex gap-2"><button disabled={busy} onClick={()=>void save()} className={primaryButton}><Save className="h-4 w-4" />{editing?'Update':'Add item'}</button>{editing&&<button onClick={()=>setEditing(null)} className={secondaryButton}>Cancel</button>}</div></Panel><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{rows.map((row)=><div key={row.id} className="rounded-2xl border bg-white p-4 flex gap-3">{row.imageUrl?<img src={row.imageUrl} className="h-16 w-16 rounded-xl object-cover" alt=""/>:<div className="h-16 w-16 rounded-xl bg-slate-100 grid place-items-center"><ChefHat className="h-6 w-6 text-slate-300"/></div>}<div className="min-w-0 flex-1"><div className="font-black truncate">{row.name}</div><div className="text-xs text-slate-400">{row.category} · {row.station}</div><div className="mt-1 font-bold">{money(row.price,row.currency)}</div><div className="mt-2 flex gap-1"><Small onClick={()=>setEditing(row)}>Edit</Small><Small onClick={()=>void toggle(row)}>{row.available?'Disable':'Enable'}</Small><Small tone="danger" onClick={()=>void remove(row)}><Trash2 className="h-3 w-3"/></Small></div></div></div>)}</div>{rows.length===0&&<Empty text="No menu items yet."/>}</div>;
}

function Orders({ property, menu, orders, advance, flash }: { property:PropertyRow; menu:MenuRow[]; orders:HotelOrder[]; advance:(id:string,status:HotelOrder['status'])=>Promise<void>; flash:(s:string)=>void; }) {
  const [showNew,setShowNew]=useState(false); const [location,setLocation]=useState({type:'table',number:'',guestName:''}); const [cart,setCart]=useState<Record<string,number>>({}); const [busy,setBusy]=useState(false);
  const next:Record<HotelOrder['status'],HotelOrder['status']|null>={PENDING:'ACCEPTED',ACCEPTED:'PREPARING',PREPARING:'READY',READY:'DELIVERED',DELIVERED:null,CANCELLED:null};
  const create=async()=>{const selected=menu.filter((m)=>cart[m.id]>0);if(!location.number||selected.length===0)return;setBusy(true);try{await api('/hotel/orders',{method:'POST',body:JSON.stringify({hotelId:property.id,locationType:location.type,roomNumber:location.number,guestName:location.guestName||undefined,items:selected.map((m)=>({menuItemId:m.id,name:m.name,qty:cart[m.id],price:Number(m.price),station:m.station})),currency:property.currency||'TZS'}),offlineFallback:false});setCart({});setLocation({type:'table',number:'',guestName:''});setShowNew(false);flash('Order sent to KDS.');}catch(reason){window.alert(reason instanceof Error?reason.message:'Order failed.');}finally{setBusy(false);}};
  const move=async(order:HotelOrder,status:HotelOrder['status'])=>{try{await advance(order.id,status);flash(`Order → ${status}.`);}catch(reason){window.alert(reason instanceof Error?reason.message:'Could not update order.');}};
  return <div className="space-y-4"><div className="flex justify-between"><div><h1 className="text-2xl font-black">Orders / KDS</h1><p className="text-sm text-slate-500">Guest and staff orders share the same live queue.</p></div><button onClick={()=>setShowNew(true)} className="h-10 px-4 rounded-xl bg-[#0d2135] text-white text-xs font-black inline-flex items-center gap-2"><Plus className="h-4 w-4"/>New staff order</button></div><div className="grid lg:grid-cols-2 gap-3">{orders.filter((o)=>!['DELIVERED','CANCELLED'].includes(o.status)).map((order)=><div key={order.id} className="rounded-2xl border bg-white p-4"><div className="flex justify-between"><div><b>{order.locationType} {order.roomNumber}</b><div className="text-xs text-slate-400">{order.guestName||'Guest'} · {order.items.length} items</div></div><Status value={order.status}/></div><div className="my-3 space-y-1">{order.items.map((item,i)=><div key={`${order.id}-${i}`} className="flex justify-between text-xs"><span>{item.qty} × {item.name} <small className="text-slate-400">· {item.station}</small></span><b>{money(Number(item.price)*item.qty,order.currency)}</b></div>)}</div><div className="flex items-center justify-between"><b>{money(order.total,order.currency)}</b><div className="flex gap-1">{next[order.status]&&<Small onClick={()=>void move(order,next[order.status]!)}>{next[order.status]}</Small>}{['PENDING','ACCEPTED','PREPARING'].includes(order.status)&&<Small tone="danger" onClick={()=>void move(order,'CANCELLED')}>Cancel</Small>}</div></div></div>)}</div>{orders.filter((o)=>!['DELIVERED','CANCELLED'].includes(o.status)).length===0&&<Empty text="No active orders."/>}{showNew&&<Modal title="New staff order" onClose={()=>setShowNew(false)}><div className="grid sm:grid-cols-3 gap-2"><label className="text-xs font-bold">Location<select className={inputClass} value={location.type} onChange={(e)=>setLocation({...location,type:e.target.value})}><option value="table">Table</option><option value="room">Room</option><option value="pickup">Pickup</option><option value="delivery">Delivery</option></select></label><Field label="Table / room / name" value={location.number} onChange={(v)=>setLocation({...location,number:v})}/><Field label="Guest name" value={location.guestName} onChange={(v)=>setLocation({...location,guestName:v})}/></div><div className="mt-4 max-h-72 overflow-auto divide-y">{menu.filter((m)=>m.available).map((m)=><div key={m.id} className="py-2 flex items-center gap-2"><div className="flex-1"><b className="text-sm">{m.name}</b><div className="text-[10px] text-slate-400">{m.station} · {money(m.price,m.currency)}</div></div><button onClick={()=>setCart({...cart,[m.id]:Math.max(0,(cart[m.id]||0)-1)})} className="h-8 w-8 rounded-lg bg-slate-100">−</button><span className="w-6 text-center text-sm font-black">{cart[m.id]||0}</span><button onClick={()=>setCart({...cart,[m.id]:(cart[m.id]||0)+1})} className="h-8 w-8 rounded-lg bg-slate-100">+</button></div>)}</div><button disabled={busy} onClick={()=>void create()} className={primaryButton}>Send to KDS</button></Modal>}</div>;
}

function Requests({ requests, advance, flash }: { requests:HotelServiceRequest[]; advance:(id:string,status:HotelServiceRequest['status'])=>Promise<void>; flash:(s:string)=>void; }) {
  const next:Record<HotelServiceRequest['status'],HotelServiceRequest['status']|null>={OPEN:'IN_PROGRESS',IN_PROGRESS:'COMPLETED',COMPLETED:null,CANCELLED:null};
  return <div className="space-y-4"><div><h1 className="text-2xl font-black">Guest requests</h1><p className="text-sm text-slate-500">Live requests from room QR and staff channels.</p></div><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{requests.filter((r)=>!['COMPLETED','CANCELLED'].includes(r.status)).map((r)=><div key={r.id} className="rounded-2xl border bg-white p-4"><div className="flex justify-between"><b>Room {r.roomNumber}</b><Status value={r.status}/></div><div className="mt-2 text-lg font-black">{r.kind.replace(/_/g,' ')}</div>{r.note&&<p className="mt-1 text-xs text-slate-500">{r.note}</p>}<div className="mt-3 flex gap-1">{next[r.status]&&<Small onClick={()=>void advance(r.id,next[r.status]!).then(()=>flash(`Request → ${next[r.status]}.`))}>{next[r.status]}</Small>}{['OPEN','IN_PROGRESS'].includes(r.status)&&<Small tone="danger" onClick={()=>void advance(r.id,'CANCELLED')}>Cancel</Small>}</div></div>)}</div>{requests.filter((r)=>!['COMPLETED','CANCELLED'].includes(r.status)).length===0&&<Empty text="No open guest requests."/>}</div>;
}

function Inventory({ property, rows, onChanged, flash }: { property:PropertyRow; rows:InventoryRow[]; onChanged:()=>Promise<void>; flash:(s:string)=>void; }) {
  const [form,setForm]=useState({name:'',category:'',quantity:'',unit:'unit',reorderLevel:'0',costPerUnit:''}); const [busy,setBusy]=useState(false);
  const add=async()=>{if(!form.name)return;setBusy(true);try{await api('/hotel/inventory',{method:'POST',body:JSON.stringify({hotelId:property.id,name:form.name,category:form.category,quantity:Number(form.quantity)||0,unit:form.unit,reorderLevel:Number(form.reorderLevel)||0,costPerUnit:Number(form.costPerUnit)||0,currency:property.currency||'TZS'}),offlineFallback:false});setForm({name:'',category:'',quantity:'',unit:'unit',reorderLevel:'0',costPerUnit:''});await onChanged();flash('Inventory item added.');}finally{setBusy(false);}};
  const qty=async(row:InventoryRow,value:number)=>{await api(`/hotel/inventory/${row.id}`,{method:'PATCH',body:JSON.stringify({quantity:Math.max(0,value)}),offlineFallback:false});await onChanged();}; const remove=async(row:InventoryRow)=>{if(!window.confirm(`Delete ${row.name}?`))return;await api(`/hotel/inventory/${row.id}`,{method:'DELETE',offlineFallback:false});await onChanged();};
  return <div className="space-y-4"><div><h1 className="text-2xl font-black">Inventory</h1><p className="text-sm text-slate-500">Actual stock records and reorder levels.</p></div><Panel title="Add inventory item"><div className="grid sm:grid-cols-6 gap-2"><Field label="Item" value={form.name} onChange={(v)=>setForm({...form,name:v})}/><Field label="Category" value={form.category} onChange={(v)=>setForm({...form,category:v})}/><Field label="Quantity" type="number" value={form.quantity} onChange={(v)=>setForm({...form,quantity:v})}/><Field label="Unit" value={form.unit} onChange={(v)=>setForm({...form,unit:v})}/><Field label="Reorder at" type="number" value={form.reorderLevel} onChange={(v)=>setForm({...form,reorderLevel:v})}/><Field label="Cost/unit" type="number" value={form.costPerUnit} onChange={(v)=>setForm({...form,costPerUnit:v})}/></div><button disabled={busy} onClick={()=>void add()} className={primaryButton}><Plus className="h-4 w-4"/>Add item</button></Panel><Panel title="Stock"><div className="divide-y">{rows.map((r)=><div key={r.id} className="py-3 flex items-center gap-3"><div className="flex-1"><b className="text-sm">{r.name}</b><div className="text-[10px] text-slate-400">{r.category} · reorder {Number(r.reorderLevel)} {r.unit}</div></div><span className={`text-xs font-black ${Number(r.quantity)<=Number(r.reorderLevel)?'text-red-600':'text-emerald-600'}`}>{Number(r.quantity)} {r.unit}</span><Small onClick={()=>void qty(r,Number(r.quantity)-1)}>−1</Small><Small onClick={()=>void qty(r,Number(r.quantity)+1)}>+1</Small><Small tone="danger" onClick={()=>void remove(r)}><Trash2 className="h-3 w-3"/></Small></div>)}</div>{rows.length===0&&<Empty text="No inventory records."/>}</Panel></div>;
}

function Staff({ property, rows, onChanged, flash }: { property:PropertyRow; rows:StaffRow[]; onChanged:()=>Promise<void>; flash:(s:string)=>void; }) {
  const [form,setForm]=useState({name:'',role:'receptionist',phone:'',email:''}); const add=async()=>{if(!form.name)return;await api('/hotel/staff',{method:'POST',body:JSON.stringify({...form,hotelId:property.id,status:'active'}),offlineFallback:false});setForm({name:'',role:'receptionist',phone:'',email:''});await onChanged();flash('Staff member added.');}; const status=async(r:StaffRow)=>{await api(`/hotel/staff/${r.id}`,{method:'PATCH',body:JSON.stringify({status:r.status==='active'?'off':'active'}),offlineFallback:false});await onChanged();}; const remove=async(r:StaffRow)=>{if(!window.confirm(`Remove ${r.name}?`))return;await api(`/hotel/staff/${r.id}`,{method:'DELETE',offlineFallback:false});await onChanged();};
  return <div className="space-y-4"><div><h1 className="text-2xl font-black">Staff</h1><p className="text-sm text-slate-500">Hotel staff directory and duty state.</p></div><Panel title="Add staff"><div className="grid sm:grid-cols-4 gap-2"><Field label="Name" value={form.name} onChange={(v)=>setForm({...form,name:v})}/><Field label="Role" value={form.role} onChange={(v)=>setForm({...form,role:v})}/><Field label="Phone" value={form.phone} onChange={(v)=>setForm({...form,phone:v})}/><Field label="Email" value={form.email} onChange={(v)=>setForm({...form,email:v})}/></div><button onClick={()=>void add()} className={primaryButton}><Plus className="h-4 w-4"/>Add staff</button></Panel><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{rows.map((r)=><div key={r.id} className="rounded-2xl border bg-white p-4"><div className="flex justify-between"><div><b>{r.name}</b><div className="text-xs text-slate-400">{r.role} · {r.phone}</div></div><Status value={r.status}/></div><div className="mt-3 flex gap-1"><Small onClick={()=>void status(r)}>{r.status==='active'?'Off duty':'On duty'}</Small><Small tone="danger" onClick={()=>void remove(r)}>Remove</Small></div></div>)}</div>{rows.length===0&&<Empty text="No staff records."/>}</div>;
}

function Panel({ title, children }: { title:string; children:ReactNode }) { return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="mb-3 text-sm font-black">{title}</h2>{children}</section>; }
function Field({ label, value, onChange, type='text', placeholder='' }: { label:string; value:string; onChange:(v:string)=>void; type?:string; placeholder?:string }) { return <label className="text-xs font-bold text-slate-700">{label}<input type={type} value={value} placeholder={placeholder} onChange={(e)=>onChange(e.target.value)} className={inputClass}/></label>; }
function Metric({ label, value }: { label:string; value:ReactNode }) { return <div className="rounded-xl bg-slate-50 p-3"><div className="text-[10px] font-black uppercase text-slate-400">{label}</div><div className="mt-1 text-lg font-black capitalize">{value}</div></div>; }
function Row({ label, value }: { label:string; value:ReactNode }) { return <div className="flex justify-between rounded-xl bg-slate-50 p-3"><span>{label}</span><b>{value}</b></div>; }
function Empty({ text }: { text:string }) { return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">{text}</div>; }
function Status({ value }: { value:string }) { const key=value.toLowerCase(); const tone=key.includes('cancel')||key==='maintenance'?'bg-red-50 text-red-700':key.includes('check_in')||key==='occupied'||key==='active'||key==='completed'||key==='delivered'?'bg-emerald-50 text-emerald-700':key==='cleaning'||key==='reserved'||key==='pending'||key==='open'?'bg-amber-50 text-amber-700':'bg-slate-100 text-slate-600'; return <span className={`inline-flex rounded-full px-2 py-1 text-[9px] font-black ${tone}`}>{value.replace(/_/g,' ')}</span>; }
function Small({ children, onClick, tone='normal' }: { children:ReactNode; onClick:()=>void; tone?:'normal'|'danger' }) { return <button onClick={onClick} className={`h-7 rounded-lg px-2.5 text-[10px] font-black inline-flex items-center justify-center ${tone==='danger'?'bg-red-50 text-red-700 hover:bg-red-100':'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{children}</button>; }
function Th({ children }: { children:ReactNode }) { return <th className="px-2 py-2 font-black">{children}</th>; }
function Td({ children, colSpan }: { children:ReactNode; colSpan?:number }) { return <td colSpan={colSpan} className="px-2 py-3 align-top">{children}</td>; }
function Modal({ title, onClose, children }: { title:string; onClose:()=>void; children:ReactNode }) { return <div className="fixed inset-0 z-[9999] grid place-items-center p-4"><button className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Close"/><div className="relative w-full max-w-3xl max-h-[90dvh] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-black">{title}</h2><button onClick={onClose} className="h-8 w-8 rounded-lg bg-slate-100 grid place-items-center"><X className="h-4 w-4"/></button></div>{children}</div></div>; }

const inputClass='mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-cyan-600';
const primaryButton='mt-4 h-10 rounded-xl bg-[#0d2135] px-4 text-xs font-black text-white inline-flex items-center gap-2 disabled:opacity-50';
const secondaryButton='mt-4 h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black';
