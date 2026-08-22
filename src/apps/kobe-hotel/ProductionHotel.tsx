import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BedDouble, CalendarDays, ClipboardList, Globe2, Hotel, LayoutDashboard,
  Loader2, Package, RefreshCw, ShoppingBag, Users, Wallet, Wrench,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useHotelLive, type HotelOrder, type HotelServiceRequest } from './useHotelLive';
import HotelOperationsBoard from './HotelOperationsBoard';
import LalaAndStatementsBoard from './LalaAndStatementsBoard';
import WalletTab from './WalletTab';
import BookingSiteTab from './BookingSiteTab';
import type { BookingRow, GuestRow, InventoryRow, MenuRow, PropertyRow, RoomRow, StaffRow } from './production-types';
import { today } from './production-types';
import { FrontDesk, PropertyOnboarding, Rooms } from './ProductionHotelFrontDesk';
import { InventoryBoard, MenuManager, OrdersBoard, RequestsBoard, StaffBoard } from './ProductionHotelOperations';
import { Metric, Panel } from './ProductionHotelUi';

type Tab = 'overview' | 'frontdesk' | 'rooms' | 'menu' | 'orders' | 'requests' | 'inventory' | 'staff' | 'operations' | 'lala' | 'wallet' | 'website';

const NAV: Array<{ id: Tab; label: string; icon: typeof Hotel }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'frontdesk', label: 'Front desk', icon: CalendarDays },
  { id: 'rooms', label: 'Rooms', icon: BedDouble },
  { id: 'menu', label: 'Menu', icon: Hotel },
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

  const property = properties.find((row) => row.id === propertyId) ?? properties[0];
  const effectivePropertyId = property?.id ?? '';

  const loadPropertyData = useCallback(async (hotelId: string) => {
    const query = `?hotelId=${encodeURIComponent(hotelId)}&limit=100`;
    const [roomRows, guestRows, bookingRows, menuRows, inventoryRows, staffRows] = await Promise.all([
      api<RoomRow[]>(`/hotel/rooms${query}`, { offlineFallback: false }),
      api<GuestRow[]>(`/hotel/guests${query}`, { offlineFallback: false }),
      api<BookingRow[]>(`/hotel/bookings${query}`, { offlineFallback: false }),
      api<MenuRow[]>(`/hotel/menu-items${query}`, { offlineFallback: false }),
      api<InventoryRow[]>('/hotel/inventory', { offlineFallback: false }),
      api<StaffRow[]>('/hotel/staff', { offlineFallback: false }),
    ]);
    setRooms((Array.isArray(roomRows) ? roomRows : []).filter((row) => !row.hotelId || row.hotelId === hotelId));
    setGuests((Array.isArray(guestRows) ? guestRows : []).filter((row) => !row.hotelId || row.hotelId === hotelId));
    setBookings((Array.isArray(bookingRows) ? bookingRows : []).filter((row) => !row.hotelId || row.hotelId === hotelId));
    setMenu((Array.isArray(menuRows) ? menuRows : []).filter((row) => !row.hotelId || row.hotelId === hotelId));
    setInventory((Array.isArray(inventoryRows) ? inventoryRows : []).filter((row) => !row.hotelId || row.hotelId === hotelId));
    setStaff((Array.isArray(staffRows) ? staffRows : []).filter((row) => !row.hotelId || row.hotelId === hotelId));
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const propertyRows = await api<PropertyRow[]>('/hotel/properties', { offlineFallback: false });
      const nextProperties = Array.isArray(propertyRows) ? propertyRows : [];
      setProperties(nextProperties);
      const chosenId = nextProperties.some((row) => row.id === propertyId) ? propertyId : nextProperties[0]?.id ?? '';
      if (chosenId !== propertyId) setPropertyId(chosenId);
      if (!chosenId) {
        setRooms([]); setGuests([]); setBookings([]); setMenu([]); setInventory([]); setStaff([]);
        return;
      }
      await loadPropertyData(chosenId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Kobe Hotels could not load live data.');
    } finally {
      setLoading(false);
    }
  }, [loadPropertyData, propertyId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const chooseProperty = async (hotelId: string) => {
    setPropertyId(hotelId);
    setLoading(true);
    setError('');
    try { await loadPropertyData(hotelId); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load this hotel.'); }
    finally { setLoading(false); }
  };

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice((current) => current === message ? '' : current), 3500);
  };

  const orders = useMemo(() => live.orders.filter((order) => {
    const scoped = order as HotelOrder & { hotelId?: string | null };
    return !effectivePropertyId || !scoped.hotelId || scoped.hotelId === effectivePropertyId;
  }), [effectivePropertyId, live.orders]);

  const requests = useMemo(() => live.requests.filter((request) => {
    const scoped = request as HotelServiceRequest & { hotelId?: string | null };
    return !effectivePropertyId || !scoped.hotelId || scoped.hotelId === effectivePropertyId;
  }), [effectivePropertyId, live.requests]);

  if (loading && properties.length === 0) {
    return <div className="h-full grid place-items-center bg-slate-50"><Loader2 className="h-7 w-7 animate-spin text-slate-400" /></div>;
  }

  return <div className="h-full min-h-0 flex bg-slate-50 text-slate-900" data-surface="light">
    <aside className="w-56 shrink-0 border-r border-slate-200 bg-[#0d2135] text-white flex flex-col">
      <div className="p-4 border-b border-white/10"><div className="flex items-center gap-2"><div className="h-9 w-9 rounded-xl bg-cyan-300 text-[#0d2135] grid place-items-center"><Hotel className="h-5 w-5" /></div><div><div className="text-sm font-black">Kobe Hotels</div><div className="text-[10px] text-white/50">LIVE OPERATIONS</div></div></div></div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">{NAV.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} className={`w-full h-10 px-3 rounded-lg flex items-center gap-2 text-xs font-bold ${tab === id ? 'bg-white text-[#0d2135]' : 'text-white/70 hover:bg-white/10'}`}><Icon className="h-4 w-4" />{label}</button>)}</nav>
      <div className="p-3 border-t border-white/10 text-[10px] leading-4 text-white/45">Production rule: real data or no feature. Demo, seeded OTA connections and fake inboxes are not shown.</div>
    </aside>

    <section className="min-w-0 flex-1 flex flex-col">
      <header className="h-16 shrink-0 border-b border-slate-200 bg-white px-4 flex items-center gap-3">
        <div className="min-w-0 flex-1"><div className="text-xs font-black">{property?.name ?? 'Set up your first hotel'}</div><div className="text-[10px] text-slate-400">{property?.location || property?.slug || 'No property configured'}</div></div>
        {properties.length > 0 && <select value={effectivePropertyId} onChange={(event) => void chooseProperty(event.target.value)} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold">{properties.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>}
        <div className={`hidden sm:flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black ${live.connected ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}><span className={`h-2 w-2 rounded-full ${live.connected ? 'bg-emerald-500' : 'bg-amber-500'}`} />{live.connected ? 'LIVE' : 'RECONNECTING'}</div>
        <button onClick={() => void refresh()} className="h-9 w-9 rounded-xl border border-slate-200 grid place-items-center"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </header>

      {(error || notice) && <div className={`mx-4 mt-3 rounded-xl px-4 py-2 text-xs font-semibold ${error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{error || notice}</div>}

      <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        {properties.length === 0 ? <PropertyOnboarding onCreated={async () => { await refresh(); flash('Hotel created.'); }} /> : property && <>
          {tab === 'overview' && <Overview rooms={rooms} bookings={bookings} orders={orders} requests={requests} inventory={inventory} staff={staff} onNavigate={setTab} />}
          {tab === 'frontdesk' && <FrontDesk rooms={rooms} guests={guests} bookings={bookings} onChanged={refresh} flash={flash} />}
          {tab === 'rooms' && <Rooms property={property} rooms={rooms} onChanged={refresh} flash={flash} />}
          {tab === 'menu' && <MenuManager property={property} rows={menu} onChanged={refresh} flash={flash} />}
          {tab === 'orders' && <OrdersBoard property={property} menu={menu} orders={orders} advance={live.advanceOrder} flash={flash} />}
          {tab === 'requests' && <RequestsBoard requests={requests} advance={live.advanceRequest} flash={flash} />}
          {tab === 'inventory' && <InventoryBoard property={property} rows={inventory} onChanged={refresh} flash={flash} />}
          {tab === 'staff' && <StaffBoard property={property} rows={staff} onChanged={refresh} flash={flash} />}
          {tab === 'operations' && <div className="min-h-[720px]"><HotelOperationsBoard darkMode={false} /></div>}
          {tab === 'lala' && <div className="min-h-[720px]"><LalaAndStatementsBoard /></div>}
          {tab === 'wallet' && <div className="min-h-[650px] rounded-2xl overflow-hidden bg-[#0a0a1a] text-white"><WalletTab /></div>}
          {tab === 'website' && <div className="h-[760px] rounded-2xl overflow-hidden border border-slate-200 bg-white"><BookingSiteTab /></div>}
        </>}
      </main>
    </section>
  </div>;
}

function Overview({ rooms, bookings, orders, requests, inventory, staff, onNavigate }: { rooms: RoomRow[]; bookings: BookingRow[]; orders: HotelOrder[]; requests: HotelServiceRequest[]; inventory: InventoryRow[]; staff: StaffRow[]; onNavigate: (tab: Tab) => void }) {
  const occupied = rooms.filter((room) => room.status === 'occupied').length;
  const arrivals = bookings.filter((booking) => String(booking.checkIn).slice(0, 10) === today() && ['PENDING', 'CONFIRMED'].includes(booking.status)).length;
  const departures = bookings.filter((booking) => String(booking.checkOut).slice(0, 10) === today() && booking.status === 'CHECKED_IN').length;
  const openOrders = orders.filter((order) => !['DELIVERED', 'CANCELLED'].includes(order.status)).length;
  const openRequests = requests.filter((request) => !['COMPLETED', 'CANCELLED'].includes(request.status)).length;
  const lowStock = inventory.filter((row) => Number(row.quantity) <= Number(row.reorderLevel)).length;
  const cards: Array<[string, string | number, Tab]> = [
    ['Rooms occupied', `${occupied}/${rooms.length}`, 'rooms'], ['Arrivals today', arrivals, 'frontdesk'], ['Departures today', departures, 'frontdesk'],
    ['Open orders', openOrders, 'orders'], ['Guest requests', openRequests, 'requests'], ['Low stock', lowStock, 'inventory'], ['Active staff', staff.filter((row) => row.status === 'active').length, 'staff'],
  ];
  return <div className="space-y-5"><div><h1 className="text-2xl font-black">Hotel overview</h1><p className="text-sm text-slate-500">Live operational status from the hotel database.</p></div><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">{cards.map(([label, value, target]) => <button key={label} onClick={() => onNavigate(target)} className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm"><div className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</div><div className="mt-2 text-3xl font-black">{value}</div></button>)}</div><div className="grid lg:grid-cols-2 gap-4"><Panel title="Room state"><div className="grid grid-cols-2 gap-2">{(['available', 'occupied', 'reserved', 'cleaning', 'maintenance'] as const).map((status) => <Metric key={status} label={status} value={rooms.filter((room) => room.status === status).length} />)}</div></Panel><Panel title="Today"><div className="space-y-2 text-sm">{[['Confirmed arrivals', arrivals], ['Guests due to depart', departures], ['Orders requiring action', openOrders], ['Requests requiring action', openRequests]].map(([label, value]) => <div key={String(label)} className="flex justify-between rounded-xl bg-slate-50 p-3"><span>{label}</span><b>{value}</b></div>)}</div></Panel></div></div>;
}
