import { useMemo, useState } from 'react';
import { BedDouble, Building2, CreditCard, Plus, Save } from 'lucide-react';
import { api } from '@/lib/api';
import type { BookingRow, Folio, GuestRow, PropertyRow, RoomRow } from './production-types';
import { dateLabel, inputClass, money, primaryButton, today } from './production-types';
import { Empty, Field, Metric, Modal, Panel, SmallButton, Status, Td, Th } from './ProductionHotelUi';

export function PropertyOnboarding({ onCreated }: { onCreated: () => Promise<void> }) {
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
  return <div className="max-w-xl mx-auto mt-10 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><Building2 className="h-10 w-10 text-cyan-700" /><h1 className="mt-3 text-2xl font-black">Set up your hotel</h1><p className="mt-1 text-sm text-slate-500">Kobe Hotels starts empty. Add your real property; no sample rooms or guests are created.</p>{error && <p className="mt-3 text-xs text-red-600">{error}</p>}<div className="mt-5 grid sm:grid-cols-2 gap-3"><Field label="Hotel name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} /><Field label="Public slug" value={form.slug} onChange={(value) => setForm({ ...form, slug: value })} placeholder="my-hotel" /><Field label="Location" value={form.location} onChange={(value) => setForm({ ...form, location: value })} /><Field label="Phone" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} /><Field label="Email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} /></div><button disabled={busy} onClick={() => void create()} className={primaryButton}>{busy ? 'Creating…' : 'Create hotel'}</button></div>;
}

export function FrontDesk({ rooms, guests, bookings, onChanged, flash }: { rooms: RoomRow[]; guests: GuestRow[]; bookings: BookingRow[]; onChanged: () => Promise<void>; flash: (message: string) => void }) {
  const [showNew, setShowNew] = useState(false);
  const [paymentFor, setPaymentFor] = useState<BookingRow | null>(null);
  const [folio, setFolio] = useState<Folio | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ roomId: '', guestName: '', guestPhone: '', guestEmail: '', guestNationality: '', guestIdNumber: '', checkIn: today(), checkOut: '', guestCount: '1', totalAmount: '' });
  const [payment, setPayment] = useState({ amount: '', method: 'CASH', reference: '' });
  const roomMap = useMemo(() => new Map(rooms.map((room) => [room.id, room])), [rooms]);
  const guestMap = useMemo(() => new Map(guests.map((guest) => [guest.id, guest])), [guests]);
  const active = bookings.filter((booking) => !['CHECKED_OUT', 'CANCELLED'].includes(booking.status)).sort((a, b) => String(a.checkIn).localeCompare(String(b.checkIn)));

  const reserve = async () => {
    if (!form.roomId || !form.guestName.trim() || !form.guestPhone.trim() || !form.checkOut) return;
    setBusy(true);
    try {
      await api('/hotel/front-desk/reservations', { method: 'POST', body: JSON.stringify({ roomId: form.roomId, guestName: form.guestName, guestPhone: form.guestPhone, guestEmail: form.guestEmail || undefined, guestNationality: form.guestNationality || undefined, guestIdNumber: form.guestIdNumber || undefined, guestIdType: form.guestIdNumber ? 'passport_or_id' : undefined, checkIn: form.checkIn, checkOut: form.checkOut, guestCount: Number(form.guestCount) || 1, ...(form.totalAmount ? { totalAmount: Number(form.totalAmount) } : {}) }), offlineFallback: false });
      setShowNew(false);
      setForm({ roomId: '', guestName: '', guestPhone: '', guestEmail: '', guestNationality: '', guestIdNumber: '', checkIn: today(), checkOut: '', guestCount: '1', totalAmount: '' });
      await onChanged(); flash('Reservation created.');
    } catch (reason) { window.alert(reason instanceof Error ? reason.message : 'Reservation failed.'); }
    finally { setBusy(false); }
  };

  const bookingAction = async (booking: BookingRow, action: 'check-in' | 'check-out' | 'cancel') => {
    setBusy(true);
    try {
      await api(`/hotel/front-desk/bookings/${booking.id}/${action}`, { method: 'POST', body: '{}', offlineFallback: false });
      await onChanged();
      flash(action === 'check-in' ? 'Guest checked in.' : action === 'check-out' ? 'Guest checked out. Room sent to cleaning.' : 'Reservation cancelled.');
    } catch (reason) { window.alert(reason instanceof Error ? reason.message : 'Action failed.'); }
    finally { setBusy(false); }
  };

  const openFolio = async (booking: BookingRow) => {
    setPaymentFor(booking); setPayment({ amount: '', method: 'CASH', reference: '' });
    try { setFolio(await api<Folio>(`/hotel/front-desk/bookings/${booking.id}/folio`, { offlineFallback: false })); }
    catch { setFolio(null); }
  };
  const recordPayment = async () => {
    if (!paymentFor || !payment.amount) return;
    setBusy(true);
    try {
      const response = await api<{ folio: Folio }>(`/hotel/front-desk/bookings/${paymentFor.id}/payments`, { method: 'POST', body: JSON.stringify({ amount: Number(payment.amount), method: payment.method, reference: payment.reference || undefined }), offlineFallback: false });
      setFolio(response.folio); setPayment({ ...payment, amount: '', reference: '' }); flash('Payment recorded in Hotel financials and Kobe Accountant.');
    } catch (reason) { window.alert(reason instanceof Error ? reason.message : 'Payment failed.'); }
    finally { setBusy(false); }
  };

  return <div className="space-y-4"><div className="flex items-center justify-between"><div><h1 className="text-2xl font-black">Front desk</h1><p className="text-sm text-slate-500">Reservations, check-in, folios and checkout.</p></div><button onClick={() => setShowNew(true)} className="h-10 px-4 rounded-xl bg-[#0d2135] text-white text-xs font-black inline-flex items-center gap-2"><Plus className="h-4 w-4" />New reservation</button></div><Panel title="Active reservations & stays"><div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-left text-slate-400"><Th>Guest</Th><Th>Room</Th><Th>Stay</Th><Th>Status</Th><Th>Total</Th><Th>Actions</Th></tr></thead><tbody>{active.map((booking) => { const room = roomMap.get(booking.roomId); const guest = guestMap.get(booking.guestId); return <tr key={booking.id} className="border-t border-slate-100"><Td><b>{guest?.name || booking.guestId}</b><div className="text-slate-400">{guest?.phone}</div></Td><Td>#{room?.roomNumber || booking.roomId}</Td><Td>{dateLabel(String(booking.checkIn))} → {dateLabel(String(booking.checkOut))}</Td><Td><Status value={booking.status} /></Td><Td>{money(booking.totalAmount, booking.currency)}</Td><Td><div className="flex flex-wrap gap-1"><SmallButton onClick={() => void openFolio(booking)}>Folio</SmallButton>{['PENDING', 'CONFIRMED'].includes(booking.status) && <SmallButton onClick={() => void bookingAction(booking, 'check-in')}>Check in</SmallButton>}{booking.status === 'CHECKED_IN' && <SmallButton onClick={() => void bookingAction(booking, 'check-out')}>Check out</SmallButton>}{['PENDING', 'CONFIRMED'].includes(booking.status) && <SmallButton danger onClick={() => void bookingAction(booking, 'cancel')}>Cancel</SmallButton>}</div></Td></tr>; })}{active.length === 0 && <tr><Td colSpan={6}><Empty text="No active reservations." /></Td></tr>}</tbody></table></div></Panel>
  {showNew && <Modal title="New reservation" onClose={() => setShowNew(false)}><div className="grid sm:grid-cols-2 gap-3"><label className="text-xs font-bold">Room<select value={form.roomId} onChange={(event) => setForm({ ...form, roomId: event.target.value })} className={inputClass}><option value="">Choose room</option>{rooms.filter((room) => !['maintenance', 'occupied', 'cleaning'].includes(room.status)).map((room) => <option key={room.id} value={room.id}>#{room.roomNumber} · {room.type} · {money(room.rate, room.currency)}</option>)}</select></label><Field label="Guest name" value={form.guestName} onChange={(value) => setForm({ ...form, guestName: value })} /><Field label="Phone" value={form.guestPhone} onChange={(value) => setForm({ ...form, guestPhone: value })} /><Field label="Email" value={form.guestEmail} onChange={(value) => setForm({ ...form, guestEmail: value })} /><Field label="Nationality" value={form.guestNationality} onChange={(value) => setForm({ ...form, guestNationality: value })} /><Field label="ID / passport" value={form.guestIdNumber} onChange={(value) => setForm({ ...form, guestIdNumber: value })} /><Field label="Check in" type="date" value={form.checkIn} onChange={(value) => setForm({ ...form, checkIn: value })} /><Field label="Check out" type="date" value={form.checkOut} onChange={(value) => setForm({ ...form, checkOut: value })} /><Field label="Guests" type="number" value={form.guestCount} onChange={(value) => setForm({ ...form, guestCount: value })} /><Field label="Override total (optional)" type="number" value={form.totalAmount} onChange={(value) => setForm({ ...form, totalAmount: value })} /></div><button disabled={busy} onClick={() => void reserve()} className={primaryButton}><Save className="h-4 w-4" />Save reservation</button></Modal>}
  {paymentFor && <Modal title="Booking folio" onClose={() => { setPaymentFor(null); setFolio(null); }}><div className="grid grid-cols-3 gap-2"><Metric label="Total" value={folio ? money(folio.total, folio.currency) : '…'} /><Metric label="Paid" value={folio ? money(folio.paid, folio.currency) : '…'} /><Metric label="Outstanding" value={folio ? money(folio.outstanding, folio.currency) : '…'} /></div><div className="mt-4 grid sm:grid-cols-3 gap-2"><Field label="Payment amount" type="number" value={payment.amount} onChange={(value) => setPayment({ ...payment, amount: value })} /><label className="text-xs font-bold">Method<select className={inputClass} value={payment.method} onChange={(event) => setPayment({ ...payment, method: event.target.value })}>{['CASH', 'MOBILE_MONEY', 'CARD', 'BANK'].map((method) => <option key={method}>{method}</option>)}</select></label><Field label="Reference" value={payment.reference} onChange={(value) => setPayment({ ...payment, reference: value })} /></div><button disabled={busy || !payment.amount || !folio?.outstanding} onClick={() => void recordPayment()} className={primaryButton}><CreditCard className="h-4 w-4" />Record payment</button>{folio?.payments.length ? <div className="mt-4 space-y-2">{folio.payments.map((row) => <div key={row.id} className="rounded-xl bg-slate-50 p-3 text-xs flex justify-between"><span>{row.description}<small className="block text-slate-400">{new Date(row.createdAt).toLocaleString()}</small></span><b>{money(row.amount, folio.currency)}</b></div>)}</div> : null}</Modal>}
  </div>;
}

export function Rooms({ property, rooms, onChanged, flash }: { property: PropertyRow; rooms: RoomRow[]; onChanged: () => Promise<void>; flash: (message: string) => void }) {
  const [showNew, setShowNew] = useState(false); const [busy, setBusy] = useState(false); const [form, setForm] = useState({ roomNumber: '', type: 'Standard', rate: '', capacity: '2', imageUrl: '' });
  const add = async () => { if (!form.roomNumber || !form.rate) return; setBusy(true); try { await api('/hotel/rooms', { method: 'POST', body: JSON.stringify({ hotelId: property.id, roomNumber: form.roomNumber, type: form.type, rate: Number(form.rate), capacity: Number(form.capacity) || 2, currency: property.currency || 'TZS', imageUrl: form.imageUrl || undefined }), offlineFallback: false }); setShowNew(false); setForm({ roomNumber: '', type: 'Standard', rate: '', capacity: '2', imageUrl: '' }); await onChanged(); flash('Room added.'); } catch (reason) { window.alert(reason instanceof Error ? reason.message : 'Could not add room.'); } finally { setBusy(false); } };
  const setStatus = async (room: RoomRow, status: 'available' | 'cleaning' | 'maintenance') => { try { await api(`/hotel/front-desk/rooms/${room.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }), offlineFallback: false }); await onChanged(); flash(`Room ${room.roomNumber} → ${status}.`); } catch (reason) { window.alert(reason instanceof Error ? reason.message : 'Could not update room.'); } };
  return <div className="space-y-4"><div className="flex justify-between items-center"><div><h1 className="text-2xl font-black">Rooms</h1><p className="text-sm text-slate-500">Checkout sends rooms to Cleaning; housekeeping marks them Available.</p></div><button onClick={() => setShowNew(true)} className="h-10 px-4 rounded-xl bg-[#0d2135] text-white text-xs font-black inline-flex items-center gap-2"><Plus className="h-4 w-4" />Add room</button></div><div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">{rooms.map((room) => <div key={room.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden"><div className="h-28 bg-slate-100">{room.imageUrl ? <img src={room.imageUrl} alt="" className="h-full w-full object-cover" /> : <div className="h-full grid place-items-center"><BedDouble className="h-8 w-8 text-slate-300" /></div>}</div><div className="p-4"><div className="flex justify-between"><div><b>Room {room.roomNumber}</b><div className="text-xs text-slate-400">{room.type} · {room.capacity} guests</div></div><Status value={room.status} /></div><div className="mt-2 font-black">{money(room.rate, room.currency)}<small className="font-normal text-slate-400"> / night</small></div><div className="mt-3 flex flex-wrap gap-1">{room.status === 'cleaning' && <SmallButton onClick={() => void setStatus(room, 'available')}>Mark ready</SmallButton>}{room.status === 'available' && <SmallButton onClick={() => void setStatus(room, 'maintenance')}>Maintenance</SmallButton>}{room.status === 'maintenance' && <SmallButton onClick={() => void setStatus(room, 'available')}>Return to service</SmallButton>}</div></div></div>)}</div>{rooms.length === 0 && <Empty text="No rooms yet. Add the real rooms for this property." />}{showNew && <Modal title="Add room" onClose={() => setShowNew(false)}><div className="grid sm:grid-cols-2 gap-3"><Field label="Room number" value={form.roomNumber} onChange={(value) => setForm({ ...form, roomNumber: value })} /><Field label="Room type" value={form.type} onChange={(value) => setForm({ ...form, type: value })} /><Field label="Nightly rate" type="number" value={form.rate} onChange={(value) => setForm({ ...form, rate: value })} /><Field label="Capacity" type="number" value={form.capacity} onChange={(value) => setForm({ ...form, capacity: value })} /><Field label="Photo URL (optional)" value={form.imageUrl} onChange={(value) => setForm({ ...form, imageUrl: value })} /></div><button disabled={busy} onClick={() => void add()} className={primaryButton}><Save className="h-4 w-4" />Save room</button></Modal>}</div>;
}
