import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import {
  Home, BedDouble, Calendar, Tag, FileText, Settings,
  Bell, Mail, ArrowUp, MessageCircle, Phone, ChevronLeft, ChevronRight,
  LogIn, LogOut, BookCheck, Brush,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

/**
 * HotelBookers — Hotel Booker's-style dashboard for KobeOS's KobeHotel
 * module. Blue + white theme, big KPI tiles, room-status grid, right
 * rail with customer satisfaction donut + staff schedule.
 *
 * Wired to the existing backend:
 *   GET /hotel/rooms      → room status grid + Available Rooms KPI
 *   GET /hotel/bookings   → Today Arrival / Departure / Total Booked KPIs
 *
 * Falls back to demo fixtures when those endpoints are empty so the
 * screen renders cleanly on a fresh install.
 */

type View = 'home' | 'rooms' | 'schedule' | 'offers' | 'document' | 'setting';
type RoomKind  = 'Single Room' | 'Twin Room' | 'Studio Room' | 'Deluxe Room' | 'Suite' | 'President Suite' | 'Connecting room';
type RoomState = 'confirmed' | 'available' | 'cleaning';

interface RoomCell { id: string; number: string; kind: RoomKind; state: RoomState }

interface ApiRoom    { id: string | number; number?: string; type?: string; status?: string }
interface ApiBooking { id: string | number; status?: string; checkIn?: string; checkOut?: string }

const ROOM_KINDS: RoomKind[] = [
  'Single Room', 'Twin Room', 'Studio Room', 'Deluxe Room', 'Suite', 'President Suite', 'Connecting room',
];

/* ─────────────────────────── Demo fixtures ─────────────────────────── */

function buildDemoRooms(): RoomCell[] {
  const out: RoomCell[] = [];
  ROOM_KINDS.forEach((kind, ki) => {
    for (let i = 0; i < 30; i++) {
      const state: RoomState = (ki + i) % 4 === 0 ? 'confirmed' : (ki + i) % 7 === 0 ? 'cleaning' : 'available';
      out.push({ id: `${kind}-${i}`, number: `${100 + ki * 100 + i}`, kind, state });
    }
  });
  return out;
}

const DEMO_STAFF = [
  { id: 's1', name: 'Jacob Ryan', role: 'Chef',  available: true, avatar: 'https://i.pravatar.cc/64?img=12' },
  { id: 's2', name: 'Mara Vega',  role: 'Front Desk', available: true, avatar: 'https://i.pravatar.cc/64?img=45' },
  { id: 's3', name: 'Owen Cole',  role: 'Concierge',  available: false, avatar: 'https://i.pravatar.cc/64?img=33' },
];

/* ════════════════════════════════════════════════════════════════════
   Main shell
   ══════════════════════════════════════════════════════════════════ */

export default function HotelBookers() {
  const [view, setView] = useState<View>('home');

  const [rooms, setRooms] = useState<RoomCell[]>(() => buildDemoRooms());
  const [todayArrival, setTodayArrival]   = useState(360);
  const [todayDeparture, setTodayDeparture] = useState(380);
  const [totalBooked, setTotalBooked]     = useState(436);
  const [available, setAvailable]         = useState(64);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [r, b] = await Promise.all([
          api<ApiRoom[]>('/hotel/rooms').catch(() => [] as ApiRoom[]),
          api<ApiBooking[]>('/hotel/bookings').catch(() => [] as ApiBooking[]),
        ]);
        if (cancelled) return;
        if (r.length) {
          const mapped: RoomCell[] = r.map((row) => ({
            id: String(row.id),
            number: row.number ?? String(row.id),
            kind: (ROOM_KINDS.includes(row.type as RoomKind) ? row.type : 'Single Room') as RoomKind,
            state: row.status === 'cleaning' ? 'cleaning'
                 : row.status === 'occupied' || row.status === 'confirmed' ? 'confirmed'
                 : 'available',
          }));
          setRooms(mapped);
          setAvailable(mapped.filter((m) => m.state === 'available').length);
        }
        const today = new Date().toISOString().slice(0, 10);
        if (b.length) {
          setTodayArrival(b.filter((x) => (x.checkIn ?? '').slice(0, 10) === today).length);
          setTodayDeparture(b.filter((x) => (x.checkOut ?? '').slice(0, 10) === today).length);
          setTotalBooked(b.filter((x) => x.status !== 'CANCELLED').length);
        }
      } catch { /* keep demo */ }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex h-full w-full bg-slate-50 text-slate-900" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <Sidebar view={view} onChange={setView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar view={view} />
        <div className="flex-1 overflow-y-auto p-6">
          {view === 'home'     && (
            <HomeView
              rooms={rooms}
              todayArrival={todayArrival}
              todayDeparture={todayDeparture}
              totalBooked={totalBooked}
              available={available}
            />
          )}
          {view === 'rooms'    && <RoomsView rooms={rooms} />}
          {view === 'schedule' && <EmptyState title="Schedule" subtitle="Front-desk rota and shift coverage." />}
          {view === 'offers'   && <EmptyState title="Offers" subtitle="Seasonal rate cards and promo codes." />}
          {view === 'document' && <EmptyState title="Document" subtitle="Guest IDs, registration cards, invoices." />}
          {view === 'setting'  && <EmptyState title="Setting" subtitle="Hotel-wide preferences and integrations." />}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Sidebar ─────────────────────────── */

function Sidebar({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const items: Array<{ id: View; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'home',     label: 'Home',     icon: Home },
    { id: 'rooms',    label: 'Rooms',    icon: BedDouble },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'offers',   label: 'Offers',   icon: Tag },
    { id: 'document', label: 'Document', icon: FileText },
    { id: 'setting',  label: 'Setting',  icon: Settings },
  ];
  return (
    <aside className="w-44 shrink-0 bg-blue-600 text-white p-5 flex flex-col rounded-r-3xl">
      <div className="mb-10 leading-tight">
        <div className="text-xl font-extrabold tracking-wide">HOTEL</div>
        <div className="text-[11px] font-semibold tracking-[0.25em] mt-0.5 px-2 py-0.5 inline-block border border-white/40 rounded">
          BOOKER'S
        </div>
      </div>
      <nav className="flex flex-col gap-1.5 flex-1">
        {items.map(({ id, label, icon: Icon }) => {
          const active = view === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm font-semibold transition-colors
                ${active ? 'bg-white text-blue-600' : 'text-white/80 hover:bg-white/10'}`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

/* ─────────────────────────── Topbar ─────────────────────────── */

function TopBar({ view }: { view: View }) {
  const title = view === 'home' ? 'Overview'
              : view === 'rooms' ? 'Rooms'
              : view === 'schedule' ? 'Schedule'
              : view === 'offers' ? 'Offers'
              : view === 'document' ? 'Document'
              : 'Setting';
  return (
    <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500">Whole data about Business</p>
      </div>
      <div className="flex items-center gap-3">
        <button className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500"><Bell className="w-4 h-4" /></button>
        <button className="relative w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500">
          <Mail className="w-4 h-4" />
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">3</span>
        </button>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-rose-500 ring-2 ring-white" />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   Home view (the mockup)
   ══════════════════════════════════════════════════════════════════ */

function HomeView({
  rooms, todayArrival, todayDeparture, totalBooked, available,
}: { rooms: RoomCell[]; todayArrival: number; todayDeparture: number; totalBooked: number; available: number }) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
      <div className="space-y-4">
        {/* KPI tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi tone="orange"  icon={<LogIn className="w-5 h-5 text-white" />}     title="Today Arrival"   value={String(todayArrival)}   pct="4.5%" sub="Last 4 Days" />
          <Kpi tone="sky"     icon={<LogOut className="w-5 h-5 text-white" />}    title="Today Departure" value={String(todayDeparture)} pct="4.5%" sub="Last 4 Days" />
          <Kpi tone="blue"    icon={<BookCheck className="w-5 h-5 text-white" />} title="Total Booked"    value={String(totalBooked)}    pct="4.5%" sub="On time" />
          <Kpi tone="emerald" icon={<BedDouble className="w-5 h-5 text-white" />} title="Available Rooms" value={String(available).padStart(3, '0')} pct="4.5%" sub="On time" />
        </div>

        {/* Room status grid */}
        <RoomStatusBoard rooms={rooms} />
      </div>

      {/* Right rail */}
      <div className="space-y-4">
        <SatisfactionCard score={4.5} />
        <StaffScheduleCard />
      </div>
    </div>
  );
}

/* ─────────────────────────── KPI card ─────────────────────────── */

function Kpi({ tone, icon, title, value, pct, sub }: { tone: 'orange' | 'sky' | 'blue' | 'emerald'; icon: React.ReactNode; title: string; value: string; pct: string; sub: string }) {
  const bg =
    tone === 'orange'  ? 'bg-orange-500'  :
    tone === 'sky'     ? 'bg-sky-400'     :
    tone === 'blue'    ? 'bg-blue-600'    :
                         'bg-emerald-500';
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
      <div className={`w-11 h-11 rounded-full ${bg} flex items-center justify-center mb-3`}>{icon}</div>
      <div className="text-sm font-semibold text-slate-700">{title}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-3xl font-extrabold">{value}</span>
        <span className="text-[11px] font-bold text-emerald-500 inline-flex items-center gap-0.5">
          <ArrowUp className="w-3 h-3" />{pct}
        </span>
      </div>
      <div className="text-[11px] text-slate-400 mt-1">{sub}</div>
    </div>
  );
}

/* ─────────────────────────── Room status board ─────────────────────────── */

function RoomStatusBoard({ rooms }: { rooms: RoomCell[] }) {
  const [kind, setKind] = useState<RoomKind>('Suite');
  const visible = useMemo(() => rooms.filter((r) => r.kind === kind), [rooms, kind]);

  return (
    <div className="bg-slate-100/70 rounded-2xl p-5">
      <div className="grid grid-cols-[180px_1fr] gap-5">
        {/* Room-kind picker */}
        <div className="space-y-2">
          {ROOM_KINDS.map((rk) => (
            <button
              key={rk}
              onClick={() => setKind(rk)}
              className={`w-full px-4 py-2 rounded-full text-xs font-bold transition-colors text-center
                ${kind === rk ? 'bg-blue-600 text-white shadow' : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'}`}
            >
              {rk}
            </button>
          ))}
        </div>

        {/* Legend + grid */}
        <div>
          <div className="flex items-center gap-5 text-[11px] text-slate-600 mb-4">
            <Legend dot="white" label="Confirmed Rooms" />
            <Legend dot="green" label="Available Rooms" />
            <Legend dot="red"   label="Cleaning Room" />
          </div>
          <div className="grid grid-cols-6 gap-3">
            {visible.length === 0
              ? <div className="col-span-6 text-center text-xs text-slate-400 py-8">No {kind.toLowerCase()}s configured yet.</div>
              : visible.slice(0, 30).map((r) => <RoomTile key={r.id} cell={r} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function Legend({ dot, label }: { dot: 'white' | 'green' | 'red'; label: string }) {
  const cls = dot === 'green' ? 'bg-emerald-500' : dot === 'red' ? 'bg-rose-500' : 'bg-white border border-slate-300';
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block w-2.5 h-2.5 rounded-full ${cls}`} />
      {label}
    </span>
  );
}

function RoomTile({ cell }: { cell: RoomCell }) {
  if (cell.state === 'confirmed') {
    return (
      <div className="aspect-square rounded-xl bg-emerald-500 text-white flex items-center justify-center" title={`Room ${cell.number} · Confirmed`}>
        <BedDouble className="w-6 h-6" />
      </div>
    );
  }
  if (cell.state === 'cleaning') {
    return (
      <div className="aspect-square rounded-xl bg-rose-500 text-white flex items-center justify-center" title={`Room ${cell.number} · Cleaning`}>
        <Brush className="w-5 h-5 rotate-12" />
      </div>
    );
  }
  return (
    <div className="aspect-square rounded-xl bg-white border border-slate-200 text-blue-300 flex items-center justify-center" title={`Room ${cell.number} · Available`}>
      <Home className="w-5 h-5" />
    </div>
  );
}

/* ─────────────────────────── Right rail ─────────────────────────── */

function SatisfactionCard({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score * 20));   // 0..5 → 0..100
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
      <h3 className="text-base font-extrabold text-center mb-3">Customers Satisfaction</h3>
      <div className="relative w-44 h-44 mx-auto">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={[{ v: pct }, { v: 100 - pct }]} dataKey="v" innerRadius={56} outerRadius={70} startAngle={90} endAngle={-270} stroke="none">
              <Cell fill="#3b82f6" />
              <Cell fill="#dbeafe" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center text-3xl font-extrabold text-blue-600">{score.toFixed(1)}</div>
      </div>
      <p className="text-[11px] text-slate-500 text-center mt-3 leading-relaxed">
        Aggregate rating from confirmed bookings in the last 30 days.
      </p>
      <button className="mt-4 w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold">
        Customers Review
      </button>
    </div>
  );
}

function StaffScheduleCard() {
  const [idx, setIdx] = useState(0);
  const carousel = DEMO_STAFF;
  const center = carousel[idx % carousel.length];
  const left   = carousel[(idx + carousel.length - 1) % carousel.length];
  const right  = carousel[(idx + 1) % carousel.length];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
      <h3 className="text-base font-extrabold text-center mb-4">Staff Schedule</h3>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setIdx(idx + carousel.length - 1)} className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <div className="flex items-center gap-2">
          <img src={left.avatar}   alt="" className="w-12 h-12 rounded-xl object-cover opacity-60 -mr-2" />
          <img src={center.avatar} alt="" className="w-16 h-16 rounded-xl object-cover ring-4 ring-blue-600" />
          <img src={right.avatar}  alt="" className="w-12 h-12 rounded-xl object-cover opacity-60 -ml-2" />
        </div>
        <button onClick={() => setIdx(idx + 1)} className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="space-y-2.5">
        {carousel.filter((s) => s.available).slice(0, 3).map((s) => (
          <div key={s.id} className="flex items-center gap-3">
            <img src={s.avatar} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{s.name}</div>
              <div className="text-[11px] text-emerald-500 font-semibold">Available</div>
            </div>
            <button className="w-8 h-8 rounded-md bg-blue-600 text-white flex items-center justify-center"><MessageCircle className="w-3.5 h-3.5" /></button>
            <button className="w-8 h-8 rounded-md bg-blue-600 text-white flex items-center justify-center"><Phone className="w-3.5 h-3.5" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────── Rooms full view ─────────────────────────── */

function RoomsView({ rooms }: { rooms: RoomCell[] }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <h2 className="text-lg font-extrabold mb-1">All Rooms</h2>
      <p className="text-xs text-slate-500 mb-4">Status across every type. Filter via the Home tab to drill into a single kind.</p>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {rooms.map((r) => (
          <div key={r.id} className="flex flex-col items-center gap-1.5">
            <RoomTile cell={r} />
            <span className="text-[10px] text-slate-500 font-semibold">#{r.number}</span>
            <span className="text-[9px] text-slate-400 capitalize">{r.state}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────── Empty state ─────────────────────────── */

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
      <h2 className="text-base font-bold mb-1">{title}</h2>
      <p className="text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}
