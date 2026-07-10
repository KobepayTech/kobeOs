import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { BedDouble, LogOut, Clock, Bell, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { checkoutInfo } from '@/apps/kobe-hotel/RoomsBoard';

/**
 * Hotel front-desk on mobile — rooms with checkout countdown + one-tap
 * check-out, and the live service-request queue. Reuses the /hotel/* endpoints.
 */
interface Room { id: string; roomNumber: string; type: string; status: string }
interface Booking { id: string; roomId: string; checkIn: string; checkOut: string; status: string }
interface ServiceReq { id: string; roomNumber?: string; kind?: string; message?: string; status: string }

export default function MobileHotel() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reqs, setReqs] = useState<ServiceReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'rooms' | 'requests'>('rooms');

  const load = async () => {
    setLoading(true);
    try {
      const [r, b, s] = await Promise.all([
        api<Room[]>('/hotel/rooms?limit=200').catch(() => [] as Room[]),
        api<Booking[]>('/hotel/bookings?limit=200').catch(() => [] as Booking[]),
        api<ServiceReq[]>('/hotel/service-requests').catch(() => [] as ServiceReq[]),
      ]);
      setRooms(Array.isArray(r) ? r : []);
      setBookings(Array.isArray(b) ? b : []);
      setReqs(Array.isArray(s) ? s : []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const coForRoom = (roomId: string) => {
    const bk = bookings.find((b) => b.roomId === roomId && b.status === 'CHECKED_IN');
    return bk ? checkoutInfo(bk.checkOut) : null;
  };
  const checkOut = async (room: Room) => {
    try { await api(`/hotel/rooms/${room.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'available' }) }); } catch { /* offline */ }
    setRooms((prev) => prev.map((x) => (x.id === room.id ? { ...x, status: 'available' } : x)));
  };
  const resolveReq = async (id: string) => {
    try { await api(`/hotel/service-requests/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'done' }) }); } catch { /* offline */ }
    setReqs((prev) => prev.filter((x) => x.id !== id));
  };

  const occupied = rooms.filter((r) => r.status === 'occupied');
  const openReqs = reqs.filter((r) => r.status !== 'done' && r.status !== 'resolved');

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button onClick={() => setTab('rooms')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${tab === 'rooms' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Rooms ({rooms.length})</button>
          <button onClick={() => setTab('requests')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${tab === 'requests' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Requests ({openReqs.length})</button>
        </div>
        <button onClick={load} className="p-2 rounded-lg bg-slate-100 text-slate-500"><RefreshCw className="w-4 h-4" /></button>
      </div>

      {loading && <div className="grid place-items-center py-10 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>}

      {!loading && tab === 'rooms' && (
        <div className="space-y-2">
          <div className="text-[11px] text-slate-500 font-semibold">{occupied.length} occupied · {rooms.length - occupied.length} free</div>
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
                    <button onClick={() => checkOut(room)} className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold ${co?.due ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                      <LogOut className="w-3 h-3" /> Check out
                    </button>
                  )}
                </div>
                {co && (
                  <div className={`mt-2 inline-flex items-center gap-1 text-[10px] font-bold rounded-md px-1.5 py-1 ${co.due ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>
                    <Clock className="w-3 h-3" /> {co.label}
                  </div>
                )}
              </div>
            );
          })}
          {rooms.length === 0 && <div className="text-center text-slate-400 text-sm py-8">No rooms yet.</div>}
        </div>
      )}

      {!loading && tab === 'requests' && (
        <div className="space-y-2">
          {openReqs.map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-fuchsia-500" />
                <div>
                  <div className="text-sm font-bold text-slate-900">{r.kind || 'Request'}{r.roomNumber ? ` · Room ${r.roomNumber}` : ''}</div>
                  {r.message && <div className="text-[11px] text-slate-500">{r.message}</div>}
                </div>
              </div>
              <button onClick={() => resolveReq(r.id)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-600 text-white"><CheckCircle2 className="w-3 h-3" /> Done</button>
            </div>
          ))}
          {openReqs.length === 0 && <div className="text-center text-slate-400 text-sm py-8">No open requests. 🎉</div>}
        </div>
      )}
    </div>
  );
}
