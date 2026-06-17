import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import {
  BedDouble, CalendarCheck, LogOut, Bookmark, ChevronDown,
  Plus, Search,
} from 'lucide-react';

/**
 * Body-only Hotel Booker's-style dashboard. Mounts inside the legacy
 * KobeHotel shell as the contents of the "dashboard" tab; the outer
 * sidebar / topbar / activeTab routing stays in `index.tsx`.
 *
 * Wired to:
 *   GET /hotel/rooms     → KPI tile counts + room thumbnails + Room Clean table
 *   GET /hotel/bookings  → Guest List table + arrival / departure KPIs
 *
 * Falls back to demo fixtures so the screen renders cleanly on a fresh
 * install with no live data.
 */

interface ApiRoom    { id: string | number; number?: string; type?: string; status?: string; imageUrl?: string }
interface ApiBooking {
  id: string | number;
  status?: string;
  checkIn?: string;
  checkOut?: string;
  guestName?: string;
  roomNumber?: string;
  roomType?: string;
  amountDue?: number;
}

interface RoomThumb { id: string; number: string; type: string; imageUrl: string }
interface CleanRow  { room: string; task: 'Dirty' | 'Clean'; assignee: string | null }
interface GuestRow  { name: string; checkIn: string; checkOut: string; type: string; room: string; due: number | null }

const DEMO_ROOM_THUMBS: RoomThumb[] = [
  { id: 'b17', number: '#B17', type: 'Double Bed',  imageUrl: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=400&h=240&fit=crop' },
  { id: 'b18', number: '#B18', type: 'Luxury Queen', imageUrl: 'https://images.unsplash.com/photo-1551776235-dde6d482980b?w=400&h=240&fit=crop' },
  { id: 'b19', number: '#B19', type: 'Double Bed',   imageUrl: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=400&h=240&fit=crop' },
];

const DEMO_CLEAN: CleanRow[] = [
  { room: '#B25', task: 'Dirty', assignee: 'Kristin Watson' },
  { room: '#H29', task: 'Clean', assignee: 'Cameron Will' },
  { room: '#B45', task: 'Dirty', assignee: null },
  { room: '#B08', task: 'Clean', assignee: null },
];

const DEMO_GUESTS: GuestRow[] = [
  { name: 'Theresa Webb',     checkIn: 'Aug 23; 21:15:33', checkOut: '—',                 type: 'Single Bed', room: '#B25', due: 256 },
  { name: 'Jerome Bell',      checkIn: 'Aug 24; 18:47',    checkOut: 'Aug 25; 14:14:38',  type: 'Single Bed', room: '#H29', due: null },
  { name: 'Ralph Edwards',    checkIn: 'Aug 26; 07:41:13', checkOut: '—',                 type: 'Double Bed', room: '#C41', due: 458 },
  { name: 'Albert Flores',    checkIn: 'Aug 26; 21:45:00', checkOut: '—',                 type: 'Luxury King', room: '#A54', due: 974 },
  { name: 'Bessie Cooper',    checkIn: 'Aug 28; 04:17:26', checkOut: '—',                 type: 'Queen Bed',  room: '#B26', due: 415 },
  { name: 'Cameron Williams', checkIn: 'Aug 28; 04:31:54', checkOut: '—',                 type: 'Queen Bed',  room: '#B27', due: 865 },
];

const PLACEHOLDER_ROOM = 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=400&h=240&fit=crop';

export default function HotelBookersDashboard() {
  const [period, setPeriod] = useState<'Daily' | 'Weekly' | 'Monthly'>('Daily');
  const [periodOpen, setPeriodOpen] = useState(false);

  const [todayCheckIn, setTodayCheckIn]   = useState(23);
  const [todayCheckOut, setTodayCheckOut] = useState(21);
  const [available, setAvailable]         = useState(25);
  const [reserved, setReserved]           = useState(12);

  const [thumbs, setThumbs]   = useState<RoomThumb[]>(DEMO_ROOM_THUMBS);
  const [cleanRows, setCleanRows] = useState<CleanRow[]>(DEMO_CLEAN);
  const [guests, setGuests]   = useState<GuestRow[]>(DEMO_GUESTS);

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
          setAvailable(r.filter((x) => x.status === 'available').length);
          setReserved(r.filter((x) => x.status === 'reserved' || x.status === 'occupied').length);
          setThumbs(
            r.slice(0, 3).map((row) => ({
              id: String(row.id),
              number: `#${row.number ?? row.id}`,
              type: row.type ?? 'Room',
              imageUrl: row.imageUrl ?? PLACEHOLDER_ROOM,
            })),
          );
          setCleanRows(
            r.slice(0, 4).map((row) => ({
              room: `#${row.number ?? row.id}`,
              task: row.status === 'cleaning' ? 'Dirty' : 'Clean',
              assignee: null,
            })),
          );
        }
        const today = new Date().toISOString().slice(0, 10);
        if (b.length) {
          setTodayCheckIn(b.filter((x) => (x.checkIn ?? '').slice(0, 10) === today).length);
          setTodayCheckOut(b.filter((x) => (x.checkOut ?? '').slice(0, 10) === today).length);
          setGuests(
            b.slice(0, 6).map((x) => ({
              name: x.guestName ?? 'Guest',
              checkIn: (x.checkIn ?? '').replace('T', '; ').slice(0, 19) || '—',
              checkOut: x.checkOut ? x.checkOut.replace('T', '; ').slice(0, 19) : '—',
              type: x.roomType ?? '—',
              room: x.roomNumber ? `#${x.roomNumber}` : '—',
              due: typeof x.amountDue === 'number' ? x.amountDue : null,
            })),
          );
        }
      } catch { /* keep demo */ }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div
      className="-mx-6 -my-6 px-6 py-6 bg-slate-50 text-slate-900 min-h-full"
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <section className="xl:col-span-2 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold text-slate-900">Overview</h2>
            <div className="relative">
              <button
                onClick={() => setPeriodOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-700"
              >
                {period} <ChevronDown className="w-3 h-3" />
              </button>
              {periodOpen && (
                <div className="absolute right-0 mt-1 w-28 bg-white border border-slate-200 rounded-md shadow-lg overflow-hidden z-10">
                  {(['Daily', 'Weekly', 'Monthly'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => { setPeriod(p); setPeriodOpen(false); }}
                      className={`w-full px-3 py-1.5 text-left text-xs ${period === p ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi tone="emerald" icon={<CalendarCheck className="w-4 h-4" />} title="Today's Check in"  value={todayCheckIn}  delta="24%"  deltaDir="up"   sub="Last 7 Days" />
            <Kpi tone="rose"    icon={<LogOut className="w-4 h-4" />}        title="Today's Check out" value={todayCheckOut} delta="11%"  deltaDir="down" sub="Last 7 Days" />
            <Kpi tone="amber"   icon={<Bookmark className="w-4 h-4" />}      title="Room's Reserved"   value={reserved}      delta="59%"  deltaDir="up"   sub="Last 7 Days" />
            <Kpi tone="sky"     icon={<BedDouble className="w-4 h-4" />}     title="Room's Available"  value={available}     delta="41%"  deltaDir="down" sub="Last 7 Days" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {thumbs.map((t) => (
              <div key={t.id} className="relative rounded-2xl overflow-hidden aspect-[16/10] bg-slate-200">
                <img src={t.imageUrl} alt={t.type} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-transparent" />
                <div className="absolute left-3 bottom-2 text-white text-xs font-bold drop-shadow">
                  {t.number} - {t.type}
                </div>
              </div>
            ))}
          </div>
        </section>

        <RoomCleanCard rows={cleanRows} />

        <section className="xl:col-span-2">
          <GuestListCard guests={guests} />
        </section>

        <QuickActionCard />
      </div>
    </div>
  );
}

function Kpi({
  tone, icon, title, value, delta, deltaDir, sub,
}: {
  tone: 'emerald' | 'rose' | 'amber' | 'sky';
  icon: React.ReactNode; title: string; value: number;
  delta: string; deltaDir: 'up' | 'down'; sub: string;
}) {
  const palette = {
    emerald: { card: 'bg-emerald-50 border-emerald-100', iconBg: 'bg-emerald-500', delta: 'text-emerald-600' },
    rose:    { card: 'bg-rose-50 border-rose-100',       iconBg: 'bg-rose-500',    delta: 'text-rose-600' },
    amber:   { card: 'bg-amber-50 border-amber-100',     iconBg: 'bg-amber-500',   delta: 'text-amber-600' },
    sky:     { card: 'bg-sky-50 border-sky-100',         iconBg: 'bg-sky-500',     delta: 'text-sky-600' },
  }[tone];
  return (
    <div className={`rounded-2xl border ${palette.card} p-3`}>
      <div className={`w-7 h-7 rounded-md ${palette.iconBg} text-white flex items-center justify-center mb-2`}>
        {icon}
      </div>
      <div className="text-[11px] font-semibold text-slate-700 leading-tight">{title}</div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <div className="text-[10px] text-slate-500">
          <span className={`font-bold ${palette.delta}`}>{delta} {deltaDir === 'up' ? '↗' : '↘'}</span>
          <div>{sub}</div>
        </div>
        <span className="text-2xl font-extrabold text-slate-900">{value}</span>
      </div>
    </div>
  );
}

function RoomCleanCard({ rows }: { rows: CleanRow[] }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
      <h3 className="text-base font-extrabold text-slate-900 mb-4">Room Clean</h3>
      <div className="grid grid-cols-[1fr_1fr_1.4fr] text-[11px] font-semibold text-slate-500 pb-2 border-b border-slate-100">
        <div>Room</div>
        <div>Task</div>
        <div>Assignee</div>
      </div>
      <div className="divide-y divide-slate-50">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_1.4fr] items-center py-2.5 text-xs">
            <div className="font-semibold text-slate-700">{r.room}</div>
            <div>
              <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                r.task === 'Dirty' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
              }`}>
                {r.task}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-700">
              {r.assignee ? (
                <>
                  <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-300 to-blue-500" />
                  <span className="truncate">{r.assignee}</span>
                </>
              ) : (
                <span className="text-slate-400">None</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GuestListCard({ guests }: { guests: GuestRow[] }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-extrabold text-slate-900">Guest List</h3>
        <button className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold">
          <Plus className="w-3.5 h-3.5" />
          New Guest
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-slate-500 font-semibold border-b border-slate-100">
              <th className="py-2 pr-3 font-semibold">Guest Name</th>
              <th className="py-2 pr-3 font-semibold">Check in</th>
              <th className="py-2 pr-3 font-semibold">Check out</th>
              <th className="py-2 pr-3 font-semibold">Room Type</th>
              <th className="py-2 pr-3 font-semibold">Allocated Room</th>
              <th className="py-2 font-semibold text-right">Due Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {guests.map((g, i) => (
              <tr key={i} className="text-slate-700">
                <td className="py-2.5 pr-3 font-semibold text-slate-800">{g.name}</td>
                <td className="py-2.5 pr-3">{g.checkIn}</td>
                <td className="py-2.5 pr-3 text-slate-500">{g.checkOut}</td>
                <td className="py-2.5 pr-3">
                  <RoomTypeChip kind={g.type} />
                </td>
                <td className="py-2.5 pr-3 font-semibold">{g.room}</td>
                <td className="py-2.5 text-right font-bold">{g.due == null ? '—' : `$${g.due}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RoomTypeChip({ kind }: { kind: string }) {
  const tone =
    /single/i.test(kind)  ? 'bg-emerald-100 text-emerald-700' :
    /double/i.test(kind)  ? 'bg-violet-100 text-violet-700'   :
    /luxury/i.test(kind)  ? 'bg-orange-100 text-orange-700'   :
    /queen/i.test(kind)   ? 'bg-amber-100 text-amber-700'     :
    /suite/i.test(kind)   ? 'bg-pink-100 text-pink-700'       :
                            'bg-slate-100 text-slate-700';
  return <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${tone}`}>{kind}</span>;
}

function QuickActionCard() {
  const [tab, setTab] = useState<'in' | 'out'>('in');
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
      <h3 className="text-base font-extrabold text-slate-900 mb-4">Quick Action</h3>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <button
          onClick={() => setTab('in')}
          className={`py-2 rounded-lg text-xs font-bold ${tab === 'in' ? 'bg-blue-600 text-white shadow' : 'bg-slate-100 text-slate-600'}`}
        >
          Check in
        </button>
        <button
          onClick={() => setTab('out')}
          className={`py-2 rounded-lg text-xs font-bold ${tab === 'out' ? 'bg-blue-600 text-white shadow' : 'bg-slate-100 text-slate-600'}`}
        >
          Check out
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <Field label="Room No.">
          <select className="w-full px-2.5 py-1.5 rounded-md border border-slate-200 text-xs bg-white font-semibold text-emerald-600">
            <option>#B24</option><option>#B25</option><option>#B26</option>
          </select>
        </Field>
        <Field label="Room Type">
          <select className="w-full px-2.5 py-1.5 rounded-md border border-slate-200 text-xs bg-white font-semibold text-emerald-600">
            <option>Single Bed</option><option>Double Bed</option><option>Suite</option>
          </select>
        </Field>
      </div>

      <Field label="Guest Name">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
          <input
            placeholder="Search guest…"
            className="w-full pl-7 pr-2 py-1.5 rounded-md border border-slate-200 text-xs"
            defaultValue="Jerome Bell"
          />
        </div>
      </Field>

      <details className="mt-3 border-t border-slate-100 pt-3">
        <summary className="text-xs font-semibold text-slate-700 cursor-pointer flex items-center justify-between">
          Service list <ChevronDown className="w-3 h-3" />
        </summary>
        <div className="mt-2 space-y-1 text-[11px] text-slate-600">
          <label className="flex items-center justify-between"><span><input type="checkbox" defaultChecked className="mr-2" />Breakfast</span><span className="font-semibold">$12</span></label>
          <label className="flex items-center justify-between"><span><input type="checkbox" className="mr-2" />Laundry</span><span className="font-semibold">$8</span></label>
          <label className="flex items-center justify-between"><span><input type="checkbox" className="mr-2" />Spa</span><span className="font-semibold">$45</span></label>
        </div>
      </details>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
        <span className="text-xs font-semibold text-slate-500">Total Charge</span>
        <span className="text-lg font-extrabold text-slate-900">$545.25</span>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4">
        <button className="py-2 rounded-md border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50">Print Summary</button>
        <button className="py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold">Proceed</button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold text-slate-500 mb-1 block">{label}</span>
      {children}
    </label>
  );
}
