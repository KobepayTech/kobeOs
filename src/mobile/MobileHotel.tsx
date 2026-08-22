import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { BedDouble, LogOut, Clock, Bell, CheckCircle2, Loader2, RefreshCw, Play } from 'lucide-react';
import { checkoutInfo } from '@/apps/kobe-hotel/RoomsBoard';

/** Mobile hotel operations backed only by real /hotel APIs. */
interface Room { id: string; roomNumber: string; type: string; status: string }
interface Booking { id: string; roomId: string; checkIn: string; checkOut: string; status: string }
interface ServiceReq { id: string; roomNumber?: string; kind?: string; note?: string; status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' }

export default function MobileHotel() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reqs, setReqs] = useState<ServiceReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'rooms' | 'requests'>('rooms');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [r, b, s] = await Promise.all([
        api<Room[]>('/hotel/rooms?limit=200', { offlineFallback: false }),
        api<Booking[]>('/hotel/bookings?limit=200', { offlineFallback: false }),
        api<ServiceReq[]>('/hotel/service-requests', { offlineFallback: false }),
      ]);
      setRooms(Array.isArray(r) ? r : []);
      setBookings(Array.isArray(b) ? b : []);
      setReqs(Array.isArray(s) ? s : []);
    } catch (reason) {
      setRooms([]); setBookings([]); setReqs([]);
      setError(reason instanceof Error ? reason.message : 'Hotel data is unavailable.');
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const activeBooking = (roomId: string) => bookings.find((b) => b.roomId === roomId && b.status === 'CHECKED_IN');
  const coForRoom = (roomId: string) => {
    const booking = activeBooking(roomId);
    return booking ? checkoutInfo(booking.checkOut) : null;
  };

  const checkOut = async (room: Room) => {
    const booking = activeBooking(room.id);
    if (!booking) { setError(`Room ${room.roomNumber} has no checked-in booking.`); return; }
    setBusyId(room.id); setError('');
    try {
      await api(`/hotel/front-desk/bookings/${booking.id}/check-out`, { method: 'POST', body: '{}', offlineFallback: false });
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Checkout failed.'); }
    finally { setBusyId(''); }
  };

  const advanceReq = async (request: ServiceReq) => {
    const next = request.status === 'OPEN' ? 'IN_PROGRESS' : request.status === 'IN_PROGRESS' ? 'COMPLETED' : null;
    if (!next) return;
    setBusyId(request.id); setError('');
    try {
      await api(`/hotel/service-requests/${request.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: next }), offlineFallback: false });
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Request update failed.'); }
    finally { setBusyId(''); }
  };

  const occupied = rooms.filter((r) => r.status === 'occupied');
  const openReqs = reqs.filter((r) => r.status === 'OPEN' || r.status === 'IN_PROGRESS');

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button onClick={() => setTab('rooms')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${tab === 'rooms' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Rooms ({rooms.length})</button>
          <button onClick={() => setTab('requests')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${tab === 'requests' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Requests ({openReqs.length})</button>
        </div>
        <button onClick={() => void load()} className="p-2 rounded-lg bg-slate-100 text-slate-500"><RefreshCw className="w-4 h-4" /></button>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</div>}
      {loading && <div className="grid place-items-center py-10 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>}

      {!loading && tab === 'rooms' && (
        <div className="space-y-2">
          <div className="text-[11px] text-slate-500 font-semibold">{occupied.length} occupied · {rooms.filter((r) => r.status === 'available').length} available · {rooms.filter((r) => r.status === 'cleaning').length} cleaning</div>
          {rooms.map((room) => {
            const co = room.status === 'occupied' ? coForRoom(room.id) : null;
            return (
              <div key={room.id} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BedDouble className="w-4 h-4 text-indigo-500" />
                    <div>
                      <div className="text-sm font-extrabold text-slate-900">#{room.roomNumber} <span className="text-[11px] font-normal text-slate-400">{room.type}</span></div>
                      <div className={`text-[11px] font-bold ${room.status === 'occupied' ? 'text-amber-600' : room.status === 'available' ? 'text-emerald-600' : 'text-slate-500'}`}>{room.status}</div>
                    </div>
                  </div>
                  {room.status === 'occupied' && (
                    <button disabled={busyId === room.id} onClick={() => void checkOut(room)} className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold disabled:opacity-50 ${co?.due ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                      {busyId === room.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />} Check out
                    </button>
                  )}
                </div>
                {co && <div className={`mt-2 inline-flex items-center gap-1 text-[10px] font-bold rounded-md px-1.5 py-1 ${co.due ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}><Clock className="w-3 h-3" /> {co.label}</div>}
              </div>
            );
          })}
          {rooms.length === 0 && <div className="text-center text-slate-400 text-sm py-8">No rooms configured.</div>}
        </div>
      )}

      {!loading && tab === 'requests' && (
        <div className="space-y-2">
          {openReqs.map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Bell className="w-4 h-4 text-fuchsia-500 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900">{r.kind || 'Request'}{r.roomNumber ? ` · Room ${r.roomNumber}` : ''}</div>
                  <div className="text-[10px] font-bold text-slate-400">{r.status.replace('_', ' ')}</div>
                  {r.note && <div className="text-[11px] text-slate-500 truncate">{r.note}</div>}
                </div>
              </div>
              <button disabled={busyId === r.id} onClick={() => void advanceReq(r)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-600 text-white disabled:opacity-50">
                {busyId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : r.status === 'OPEN' ? <Play className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                {r.status === 'OPEN' ? 'Start' : 'Complete'}
              </button>
            </div>
          ))}
          {openReqs.length === 0 && <div className="text-center text-slate-400 text-sm py-8">No open requests.</div>}
        </div>
      )}
    </div>
  );
}
