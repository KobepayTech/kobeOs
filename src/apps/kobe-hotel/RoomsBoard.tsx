import { useMemo, useState } from 'react';
import { Bed, Lock, Unlock, Plus, Search, Eye, Brush, Wrench, LogOut, Clock } from 'lucide-react';

/**
 * Hotels check guests out at 10:00 on the check-out date. Given the check-out
 * date, compute whether checkout is due and a friendly countdown
 * ("2d 4h till checkout" / "Checkout due · 3h overdue").
 */
export function checkoutInfo(checkOut?: string): { due: boolean; label: string } | null {
  if (!checkOut) return null;
  const d = new Date(checkOut);
  if (isNaN(d.getTime())) return null;
  d.setHours(10, 0, 0, 0); // standard 10:00 checkout
  const diffMs = d.getTime() - Date.now();
  if (diffMs <= 0) {
    const overdueH = Math.floor(-diffMs / 3_600_000);
    return { due: true, label: overdueH > 0 ? `Checkout due · ${overdueH}h overdue` : 'Checkout due' };
  }
  const days = Math.floor(diffMs / 86_400_000);
  const hours = Math.floor((diffMs % 86_400_000) / 3_600_000);
  return { due: false, label: days > 0 ? `${days}d ${hours}h till checkout` : `${hours}h till checkout` };
}

/**
 * Blue/light themed Rooms tab — matches the Dashboard's aesthetic. Wraps
 * itself in a slate-50 panel so it visually escapes the dark KobeHotel
 * shell (same trick HotelBookersDashboard uses).
 */

export interface BoardRoom {
  id: string | number;
  number: string;
  type: string;
  status: 'available' | 'occupied' | 'cleaning' | 'maintenance';
  price: number;
  guest?: string;
  floor: number;
  beds: number;
  imageUrl?: string;
  /** Booking dates (YYYY-MM-DD) — drive the checkout countdown. */
  checkIn?: string;
  checkOut?: string;
}

interface Props {
  rooms: BoardRoom[];
  onSelect?: (room: BoardRoom) => void;
  onCheckOut?: (room: BoardRoom) => void;
}

type Filter = 'All' | 'Available' | 'Occupied' | 'Cleaning' | 'Maintenance';

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=600&h=360&fit=crop';
const TYPE_IMAGES: Record<string, string> = {
  Standard: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=600&h=360&fit=crop',
  Deluxe: 'https://images.unsplash.com/photo-1551776235-dde6d482980b?w=600&h=360&fit=crop',
  'VIP Suite': 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600&h=360&fit=crop',
};

export default function RoomsBoard({ rooms, onSelect, onCheckOut }: Props) {
  const [filter, setFilter] = useState<Filter>('All');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => rooms.filter((r) => {
    if (filter !== 'All' && r.status.toLowerCase() !== filter.toLowerCase()) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!`${r.number} ${r.type} ${r.guest ?? ''}`.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [rooms, filter, search]);

  const counts = useMemo(() => ({
    All: rooms.length,
    Available: rooms.filter((r) => r.status === 'available').length,
    Occupied: rooms.filter((r) => r.status === 'occupied').length,
    Cleaning: rooms.filter((r) => r.status === 'cleaning').length,
    Maintenance: rooms.filter((r) => r.status === 'maintenance').length,
  }), [rooms]);

  const floors = useMemo(() => {
    const set = new Set<number>();
    filtered.forEach((r) => set.add(r.floor));
    return Array.from(set).sort((a, b) => a - b);
  }, [filtered]);

  return (
    <div
      className="-mx-6 -my-6 px-6 py-6 bg-slate-50 text-slate-900 min-h-full"
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      <div className="flex items-center justify-between mb-5 gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Rooms</h2>
          <p className="text-xs text-slate-500 mt-0.5">Live availability by floor</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search room / guest…"
              className="pl-8 pr-3 py-2 rounded-md border border-slate-200 bg-white text-xs w-56 focus:outline-none focus:border-blue-400"
            />
          </div>
          <button className="inline-flex items-center gap-1 px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold">
            <Plus className="w-3.5 h-3.5" />Add Room
          </button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-3 mb-5">
        {(['All', 'Available', 'Occupied', 'Cleaning', 'Maintenance'] as Filter[]).map((f) => (
          <StatChip key={f} label={f} value={counts[f]} active={filter === f} onClick={() => setFilter(f)} />
        ))}
      </div>

      <div className="space-y-6">
        {floors.length === 0 && (
          <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center text-sm text-slate-400">
            No rooms match your filter.
          </div>
        )}
        {floors.map((floor) => (
          <div key={floor}>
            <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wide mb-3">Floor {floor}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filtered.filter((r) => r.floor === floor).map((room) => (
                <RoomCard key={room.id} room={room} onClick={() => onSelect?.(room)} onCheckOut={onCheckOut} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatChip({ label, value, active, onClick }: { label: Filter; value: number; active: boolean; onClick: () => void }) {
  const tone = TONE[label];
  return (
    <button
      onClick={onClick}
      className={`bg-white rounded-2xl border p-3 text-left transition ${active ? `${tone.activeBorder} shadow-md` : 'border-slate-100 hover:border-slate-200'}`}
    >
      <div className={`text-[10px] uppercase tracking-wide font-extrabold ${tone.label}`}>{label}</div>
      <div className="text-2xl font-extrabold text-slate-900 mt-1">{value}</div>
    </button>
  );
}

const TONE: Record<Filter, { label: string; activeBorder: string; cardBorder: string; chip: string; icon: string }> = {
  All:         { label: 'text-slate-500',   activeBorder: 'border-blue-400',    cardBorder: 'border-slate-200',   chip: 'bg-slate-100 text-slate-700',     icon: 'text-slate-400' },
  Available:   { label: 'text-emerald-600', activeBorder: 'border-emerald-400', cardBorder: 'border-emerald-200', chip: 'bg-emerald-100 text-emerald-700', icon: 'text-emerald-500' },
  Occupied:    { label: 'text-rose-600',    activeBorder: 'border-rose-400',    cardBorder: 'border-rose-200',    chip: 'bg-rose-100 text-rose-700',       icon: 'text-rose-500' },
  Cleaning:    { label: 'text-amber-600',   activeBorder: 'border-amber-400',   cardBorder: 'border-amber-200',   chip: 'bg-amber-100 text-amber-700',     icon: 'text-amber-500' },
  Maintenance: { label: 'text-slate-600',   activeBorder: 'border-slate-400',   cardBorder: 'border-slate-200',   chip: 'bg-slate-200 text-slate-700',     icon: 'text-slate-500' },
};

function RoomCard({ room, onClick, onCheckOut }: { room: BoardRoom; onClick: () => void; onCheckOut?: (room: BoardRoom) => void }) {
  const tone = TONE[(room.status.charAt(0).toUpperCase() + room.status.slice(1)) as Filter];
  const co = room.status === 'occupied' ? checkoutInfo(room.checkOut) : null;
  const img = room.imageUrl ?? TYPE_IMAGES[room.type] ?? FALLBACK_IMG;
  const Icon =
    room.status === 'cleaning'    ? Brush :
    room.status === 'maintenance' ? Wrench :
    room.status === 'occupied'    ? Lock :
                                    Unlock;
  return (
    <button
      onClick={onClick}
      className={`text-left bg-white rounded-2xl border overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition ${tone.cardBorder}`}
    >
      <div className="relative h-28 bg-slate-200">
        <img src={img} alt={room.type} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/0 to-transparent" />
        <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-extrabold ${tone.chip}`}>{cap(room.status)}</span>
        <span className="absolute top-2 right-2 w-7 h-7 rounded-md bg-white/95 flex items-center justify-center">
          <Icon className={`w-3.5 h-3.5 ${tone.icon}`} />
        </span>
        <div className="absolute left-3 bottom-2 text-white">
          <div className="text-base font-extrabold leading-none drop-shadow">#{room.number}</div>
          <div className="text-[10px] opacity-90">{room.type}</div>
        </div>
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-500 inline-flex items-center gap-1"><Bed className="w-3 h-3" />{room.beds}</span>
          <span className="font-extrabold text-slate-800">TZS {(room.price / 1000).toFixed(0)}K<span className="text-[9px] font-normal text-slate-400">/night</span></span>
        </div>
        {room.guest ? (
          <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-700">
            <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-300 to-blue-500 flex-shrink-0" />
            <span className="truncate">{room.guest}</span>
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-500">
            <Eye className="w-3 h-3" /> View details
          </div>
        )}
        {co && (
          <div className={`mt-2 flex items-center gap-1 text-[10px] font-bold rounded-md px-1.5 py-1 ${co.due ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>
            <Clock className="w-3 h-3" /> {co.label}
          </div>
        )}
        {room.status === 'occupied' && onCheckOut && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onCheckOut(room); }}
            className={`mt-2 flex items-center justify-center gap-1 text-[11px] font-bold rounded-md py-1.5 cursor-pointer ${co?.due ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            <LogOut className="w-3 h-3" /> Check out
          </span>
        )}
      </div>
    </button>
  );
}

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }
