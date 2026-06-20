import { useMemo } from 'react';
import { api } from '@/lib/api';
import {
  ArrowUpRight, ArrowDownRight, BedDouble, Wallet, TrendingUp,
  AlertTriangle, MapPin, BellRing, Wrench, ShieldAlert, Sparkles,
} from 'lucide-react';

/**
 * Group/portfolio dashboard — used when the owner selects "All Properties"
 * in the property switcher. Aggregates KPIs across every hotel in the
 * portfolio and lets the owner drill into any single property.
 *
 * Data is currently seeded (no `/hotel/portfolio` endpoint yet); replace
 * `DEMO_PORTFOLIO` with a fetch once the backend exposes it.
 */

export interface PortfolioHotel {
  id: string;
  name: string;
  city: string;
  country: string;
  category: 'Luxury' | 'Business' | 'Safari' | 'Resort' | 'Boutique';
  roomsTotal: number;
  occupied: number;
  revenueToday: number;   // TZS
  adr: number;            // average daily rate, TZS
  revPar: number;         // revenue per available room, TZS
  alerts: number;
  imageUrl: string;
}

const DEMO_PORTFOLIO: PortfolioHotel[] = [
  { id: 'znz-stone',  name: 'Kobe Resort Zanzibar',   city: 'Stone Town', country: 'Tanzania', category: 'Luxury',   roomsTotal: 80, occupied: 71, revenueToday:  9_840_000, adr: 138_000, revPar: 122_500, alerts: 2, imageUrl: 'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=600&h=360&fit=crop' },
  { id: 'dar-msasani',name: 'Kobe City Hotel Dar',    city: 'Dar es Salaam', country: 'Tanzania', category: 'Business', roomsTotal: 120, occupied: 88, revenueToday:  7_920_000, adr:  90_000, revPar:  66_000, alerts: 0, imageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&h=360&fit=crop' },
  { id: 'aru-highlands',name: 'Kobe Highlands Lodge', city: 'Arusha',     country: 'Tanzania', category: 'Safari',   roomsTotal: 40, occupied: 36, revenueToday:  6_480_000, adr: 180_000, revPar: 162_000, alerts: 1, imageUrl: 'https://images.unsplash.com/photo-1602002418082-a4443e081dd1?w=600&h=360&fit=crop' },
  { id: 'bag-coast',  name: 'Kobe Coast Bagamoyo',    city: 'Bagamoyo',   country: 'Tanzania', category: 'Resort',   roomsTotal: 55, occupied: 41, revenueToday:  5_125_000, adr: 125_000, revPar:  93_100, alerts: 0, imageUrl: 'https://images.unsplash.com/photo-1602002418082-a4443e081dd1?w=600&h=360&fit=crop' },
  { id: 'mwz-lake',   name: 'Kobe Lake View Mwanza',  city: 'Mwanza',     country: 'Tanzania', category: 'Business', roomsTotal: 60, occupied: 33, revenueToday:  2_640_000, adr:  80_000, revPar:  44_000, alerts: 3, imageUrl: 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=600&h=360&fit=crop' },
  { id: 'ser-camp',   name: 'Kobe Serengeti Camp',    city: 'Serengeti',  country: 'Tanzania', category: 'Safari',   roomsTotal: 24, occupied: 22, revenueToday:  7_700_000, adr: 350_000, revPar: 320_800, alerts: 0, imageUrl: 'https://images.unsplash.com/photo-1572798151264-7e5b7f1c0a8f?w=600&h=360&fit=crop' },
  { id: 'mos-kili',   name: 'Kobe Kilimanjaro Inn',   city: 'Moshi',      country: 'Tanzania', category: 'Boutique', roomsTotal: 30, occupied: 19, revenueToday:  1_900_000, adr: 100_000, revPar:  63_300, alerts: 1, imageUrl: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=600&h=360&fit=crop' },
  { id: 'dod-capital',name: 'Kobe Capital Dodoma',    city: 'Dodoma',     country: 'Tanzania', category: 'Business', roomsTotal: 70, occupied: 42, revenueToday:  3_360_000, adr:  80_000, revPar:  48_000, alerts: 0, imageUrl: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=600&h=360&fit=crop' },
  { id: 'maf-beach',  name: 'Kobe Beach Mafia',       city: 'Mafia Island', country: 'Tanzania', category: 'Resort', roomsTotal: 35, occupied: 28, revenueToday:  4_760_000, adr: 170_000, revPar: 136_000, alerts: 0, imageUrl: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=600&h=360&fit=crop' },
  { id: 'mtw-harbour',name: 'Kobe Harbour Mtwara',    city: 'Mtwara',     country: 'Tanzania', category: 'Boutique', roomsTotal: 28, occupied: 17, revenueToday:  1_530_000, adr:  90_000, revPar:  54_600, alerts: 2, imageUrl: 'https://images.unsplash.com/photo-1455587734955-081b22074882?w=600&h=360&fit=crop' },
];

export function getPortfolio(): PortfolioHotel[] {
  return DEMO_PORTFOLIO;
}

interface BackendPortfolioEntry {
  id: string;
  slug: string;
  name: string;
  brandColor: string | null;
  logoUrl: string | null;
  currency: string;
  roomsTotal: number;
  occupied: number;
  occupancyRate: number;
  todayCheckIn: number;
  todayCheckOut: number;
  revenueToday: number | string;
  adr: number | string;
  revPar: number | string;
  alerts: number;
}

const FALLBACK_THUMB = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&h=360&fit=crop';

/**
 * Fetches the multi-property portfolio from the backend. Returns null when
 * the caller is not authenticated or has no tenants configured yet — callers
 * should fall back to `getPortfolio()` for the demo dataset in that case.
 */
export async function fetchPortfolio(): Promise<PortfolioHotel[] | null> {
  try {
    const rows = await api<BackendPortfolioEntry[]>('/hotel/portfolio');
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      city: row.slug,
      country: 'Tanzania',
      category: 'Business',
      roomsTotal: row.roomsTotal,
      occupied: row.occupied,
      revenueToday: parseFloat(String(row.revenueToday)) || 0,
      adr: parseFloat(String(row.adr)) || 0,
      revPar: parseFloat(String(row.revPar)) || 0,
      alerts: row.alerts,
      imageUrl: row.logoUrl ?? FALLBACK_THUMB,
    }));
  } catch {
    return null;
  }
}

interface Props {
  hotels?: PortfolioHotel[];
  onSelectHotel: (id: string) => void;
}

export default function HotelPortfolioDashboard({ hotels = DEMO_PORTFOLIO, onSelectHotel }: Props) {
  const totals = useMemo(() => {
    const roomsTotal     = hotels.reduce((s, h) => s + h.roomsTotal, 0);
    const occupied       = hotels.reduce((s, h) => s + h.occupied, 0);
    const revenueToday   = hotels.reduce((s, h) => s + h.revenueToday, 0);
    const alerts         = hotels.reduce((s, h) => s + h.alerts, 0);
    const occupancyPct   = roomsTotal ? Math.round((occupied / roomsTotal) * 100) : 0;
    const groupAdr       = occupied ? Math.round(revenueToday / occupied) : 0;
    const groupRevPar    = roomsTotal ? Math.round(revenueToday / roomsTotal) : 0;
    return { roomsTotal, occupied, revenueToday, alerts, occupancyPct, groupAdr, groupRevPar };
  }, [hotels]);

  const ranked = useMemo(() => {
    return [...hotels].sort((a, b) => b.revPar - a.revPar);
  }, [hotels]);

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-xl font-extrabold text-slate-900">Portfolio Overview</h2>
        <p className="text-xs text-slate-500 mt-0.5">{hotels.length} properties · consolidated view</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <GroupKpi tone="emerald" icon={<Wallet className="w-4 h-4" />}     title="Revenue Today" value={formatTZS(totals.revenueToday)} delta="18%" dir="up" sub="vs yesterday" />
        <GroupKpi tone="sky"     icon={<BedDouble className="w-4 h-4" />}  title="Occupancy"     value={`${totals.occupancyPct}%`}        delta="6%"  dir="up" sub={`${totals.occupied} / ${totals.roomsTotal} rooms`} />
        <GroupKpi tone="amber"   icon={<TrendingUp className="w-4 h-4" />} title="Group RevPAR"  value={formatTZS(totals.groupRevPar)}    delta="9%"  dir="up" sub={`ADR ${formatTZS(totals.groupAdr)}`} />
        <GroupKpi tone="rose"    icon={<AlertTriangle className="w-4 h-4" />} title="Open Alerts" value={String(totals.alerts)}         delta="2"   dir="down" sub="across all hotels" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <section className="xl:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-extrabold text-slate-900">Properties</h3>
            <button className="text-xs font-semibold text-blue-600 hover:text-blue-500">+ Add Property</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {hotels.map((h) => (
              <PropertyCard key={h.id} hotel={h} onClick={() => onSelectHotel(h.id)} />
            ))}
          </div>
        </section>

        <section className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <h3 className="text-base font-extrabold text-slate-900 mb-1">Leaderboard</h3>
            <p className="text-[11px] text-slate-500 mb-4">Ranked by RevPAR today</p>
            <ol className="space-y-2">
              {ranked.map((h, i) => (
                <li key={h.id}>
                  <button
                    onClick={() => onSelectHotel(h.id)}
                    className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 text-left"
                  >
                    <span className={`w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-extrabold ${
                      i === 0 ? 'bg-amber-100 text-amber-700' :
                      i === 1 ? 'bg-slate-200 text-slate-700' :
                      i === 2 ? 'bg-orange-100 text-orange-700' :
                                'bg-slate-100 text-slate-500'
                    }`}>{i + 1}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs font-bold text-slate-800 truncate">{h.name}</span>
                      <span className="block text-[10px] text-slate-500 truncate">{h.city}</span>
                    </span>
                    <span className="text-xs font-extrabold text-slate-900">{formatTZS(h.revPar)}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>

          <AlertsFeedCard hotels={hotels} onSelectHotel={onSelectHotel} />
        </section>
      </div>
    </div>
  );
}

// ─── Alerts Feed ─────────────────────────────────────────────────────
// Synthesises per-hotel alerts (maintenance, low occupancy, low score) from
// the portfolio's `alerts` count and occupancy. Replace with /hotel/alerts
// when the backend ships real notifications.
function AlertsFeedCard({ hotels, onSelectHotel }: { hotels: PortfolioHotel[]; onSelectHotel: (id: string) => void }) {
  const items = useMemo(() => buildAlerts(hotels), [hotels]);
  const open = items.length;
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base font-extrabold text-slate-900 inline-flex items-center gap-1.5">
          <BellRing className="w-4 h-4 text-rose-500" />Alerts
        </h3>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 text-[10px] font-extrabold">
          {open} open
        </span>
      </div>
      <p className="text-[11px] text-slate-500 mb-4">Across all properties</p>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400 italic">No open alerts — all properties look healthy.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((a) => (
            <li key={a.id}>
              <button
                onClick={() => onSelectHotel(a.hotelId)}
                className="w-full flex items-start gap-2.5 px-2 py-2 rounded-lg hover:bg-slate-50 text-left"
              >
                <span className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${a.tone}`}>
                  <a.Icon className="w-3.5 h-3.5" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[11px] font-extrabold text-slate-800 leading-tight">{a.title}</span>
                  <span className="block text-[10px] text-slate-500 truncate">{a.hotelName} · {a.when}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface PortfolioAlert {
  id: string;
  hotelId: string;
  hotelName: string;
  title: string;
  when: string;
  tone: string;
  Icon: typeof Wrench;
}

function buildAlerts(hotels: PortfolioHotel[]): PortfolioAlert[] {
  const out: PortfolioAlert[] = [];
  for (const h of hotels) {
    if (h.alerts > 0) {
      out.push({
        id: `${h.id}-maint`,
        hotelId: h.id,
        hotelName: h.name,
        title: `${h.alerts} maintenance ${h.alerts === 1 ? 'issue' : 'issues'}`,
        when: 'pending action',
        tone: 'bg-rose-100 text-rose-600',
        Icon: Wrench,
      });
    }
    const occupancyPct = h.roomsTotal ? Math.round((h.occupied / h.roomsTotal) * 100) : 0;
    if (occupancyPct < 50) {
      out.push({
        id: `${h.id}-occ`,
        hotelId: h.id,
        hotelName: h.name,
        title: `Low occupancy ${occupancyPct}% — push promos`,
        when: 'today',
        tone: 'bg-amber-100 text-amber-700',
        Icon: ShieldAlert,
      });
    }
    if (h.revPar < 60_000) {
      out.push({
        id: `${h.id}-revpar`,
        hotelId: h.id,
        hotelName: h.name,
        title: `RevPAR underperforming peers`,
        when: 'this week',
        tone: 'bg-violet-100 text-violet-700',
        Icon: Sparkles,
      });
    }
  }
  return out.slice(0, 6);
}

function PropertyCard({ hotel, onClick }: { hotel: PortfolioHotel; onClick: () => void }) {
  const occupancyPct = hotel.roomsTotal ? Math.round((hotel.occupied / hotel.roomsTotal) * 100) : 0;
  const occTone =
    occupancyPct >= 80 ? 'text-emerald-600 bg-emerald-50' :
    occupancyPct >= 50 ? 'text-amber-600 bg-amber-50'   :
                         'text-rose-600 bg-rose-50';
  const catTone =
    hotel.category === 'Luxury'   ? 'bg-violet-100 text-violet-700'  :
    hotel.category === 'Business' ? 'bg-sky-100 text-sky-700'        :
    hotel.category === 'Safari'   ? 'bg-amber-100 text-amber-700'    :
    hotel.category === 'Resort'   ? 'bg-emerald-100 text-emerald-700':
                                    'bg-pink-100 text-pink-700';

  return (
    <button
      onClick={onClick}
      className="text-left bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md hover:border-blue-200 transition"
    >
      <div className="relative h-28 bg-slate-200">
        <img src={hotel.imageUrl} alt={hotel.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-transparent" />
        <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-extrabold ${catTone}`}>{hotel.category}</span>
        {hotel.alerts > 0 && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-500 text-white flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />{hotel.alerts}
          </span>
        )}
        <div className="absolute left-3 bottom-2 text-white">
          <div className="text-sm font-extrabold drop-shadow leading-tight">{hotel.name}</div>
          <div className="text-[10px] flex items-center gap-1 opacity-90"><MapPin className="w-3 h-3" />{hotel.city}</div>
        </div>
      </div>
      <div className="p-3">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Occ" value={`${occupancyPct}%`} tone={occTone} />
          <Stat label="Rooms" value={`${hotel.occupied}/${hotel.roomsTotal}`} tone="text-slate-700 bg-slate-50" />
          <Stat label="Today" value={formatTZSShort(hotel.revenueToday)} tone="text-blue-600 bg-blue-50" />
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px]">
          <span className="text-slate-500">ADR <span className="font-bold text-slate-800">{formatTZSShort(hotel.adr)}</span></span>
          <span className="text-slate-500">RevPAR <span className="font-bold text-slate-800">{formatTZSShort(hotel.revPar)}</span></span>
        </div>
      </div>
    </button>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`rounded-lg px-2 py-1.5 ${tone}`}>
      <div className="text-[9px] uppercase tracking-wide font-semibold opacity-70">{label}</div>
      <div className="text-xs font-extrabold">{value}</div>
    </div>
  );
}

function GroupKpi({
  tone, icon, title, value, delta, dir, sub,
}: {
  tone: 'emerald' | 'sky' | 'amber' | 'rose';
  icon: React.ReactNode; title: string; value: string;
  delta: string; dir: 'up' | 'down'; sub: string;
}) {
  const palette = {
    emerald: { card: 'bg-emerald-50 border-emerald-100', iconBg: 'bg-emerald-500', delta: 'text-emerald-600' },
    sky:     { card: 'bg-sky-50 border-sky-100',         iconBg: 'bg-sky-500',     delta: 'text-sky-600' },
    amber:   { card: 'bg-amber-50 border-amber-100',     iconBg: 'bg-amber-500',   delta: 'text-amber-600' },
    rose:    { card: 'bg-rose-50 border-rose-100',       iconBg: 'bg-rose-500',    delta: 'text-rose-600' },
  }[tone];
  const DeltaIcon = dir === 'up' ? ArrowUpRight : ArrowDownRight;
  return (
    <div className={`rounded-2xl border ${palette.card} p-3`}>
      <div className="flex items-center justify-between mb-2">
        <div className={`w-7 h-7 rounded-md ${palette.iconBg} text-white flex items-center justify-center`}>
          {icon}
        </div>
        <span className={`inline-flex items-center gap-0.5 text-[10px] font-extrabold ${palette.delta}`}>
          <DeltaIcon className="w-3 h-3" />{delta}
        </span>
      </div>
      <div className="text-[11px] font-semibold text-slate-700 leading-tight">{title}</div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <span className="text-2xl font-extrabold text-slate-900">{value}</span>
      </div>
      <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>
    </div>
  );
}

function formatTZS(n: number) {
  if (n >= 1_000_000) return `TZS ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `TZS ${(n / 1_000).toFixed(0)}K`;
  return `TZS ${n}`;
}
function formatTZSShort(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

