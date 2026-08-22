import { useCallback, useEffect, useState } from 'react';
import { BusFront, Clock3, MapPin, RefreshCw, Route } from 'lucide-react';
import { api } from '@/lib/api';

interface BoardTrip {
  id: string; tripCode: string; busName: string; plateNumber: string; origin: string; destination: string;
  scheduledDeparture: string; actualDeparture?: string | null; eta?: string | null; status: string; gate: string; currentCheckpoint: string; delayMinutes: number;
}

const time = (value?: string | null) => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
const statusColor: Record<string, string> = { SCHEDULED: 'bg-slate-200 text-slate-700', BOARDING: 'bg-amber-300 text-amber-950', DEPARTED: 'bg-cyan-300 text-cyan-950', IN_TRANSIT: 'bg-emerald-300 text-emerald-950' };

export default function TransitBoard({ ownerId }: { ownerId: string }) {
  const [trips, setTrips] = useState<BoardTrip[]>([]); const [error, setError] = useState(''); const [updated, setUpdated] = useState<Date | null>(null);
  const load = useCallback(async () => { try { const rows = await api<BoardTrip[]>(`/transit-public/${encodeURIComponent(ownerId)}/board`, { auth: false, offlineFallback: false }); setTrips(Array.isArray(rows) ? rows : []); setUpdated(new Date()); setError(''); } catch (cause) { setError((cause as Error).message); } }, [ownerId]);
  useEffect(() => { const kickoff = window.setTimeout(() => void load(), 0); const timer = window.setInterval(() => void load(), 15_000); return () => { window.clearTimeout(kickoff); window.clearInterval(timer); }; }, [load]);
  return <div className="min-h-screen bg-[#061526] text-white p-3 sm:p-8">
    <header className="max-w-7xl mx-auto flex items-center justify-between gap-4 py-3 sm:py-6">
      <div className="flex items-center gap-3"><div className="h-12 w-12 rounded-2xl bg-cyan-300 text-[#061526] grid place-items-center"><BusFront className="h-6 w-6" /></div><div><h1 className="text-xl sm:text-3xl font-black tracking-tight">Kobe Transit Board</h1><p className="text-xs text-white/55">Live departures, checkpoints and estimated arrival</p></div></div>
      <button onClick={() => void load()} className="h-10 px-3 rounded-xl border border-white/15 inline-flex items-center gap-2 text-xs font-bold"><RefreshCw className="h-4 w-4" /><span className="hidden sm:inline">{updated ? `Updated ${time(updated.toISOString())}` : 'Refresh'}</span></button>
    </header>
    <main className="max-w-7xl mx-auto mt-3">
      {error && <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 text-rose-200 p-4 text-sm">{error}</div>}
      <div className="hidden md:grid grid-cols-[1.2fr_1.2fr_.7fr_.8fr_.9fr] gap-4 px-5 py-3 text-[11px] uppercase tracking-widest text-white/40"><span>Bus</span><span>Route / latest location</span><span>Scheduled</span><span>ETA</span><span>Status</span></div>
      <div className="space-y-3">{trips.map((trip) => <article key={trip.id} className="rounded-2xl bg-white/[.07] border border-white/10 p-4 sm:p-5 grid md:grid-cols-[1.2fr_1.2fr_.7fr_.8fr_.9fr] gap-4 items-center">
        <div><div className="font-black text-lg">{trip.busName}</div><div className="text-xs text-cyan-200 font-mono mt-0.5">{trip.plateNumber} · {trip.tripCode}</div></div>
        <div><div className="font-bold inline-flex items-center gap-1.5"><Route className="h-4 w-4 text-cyan-300" />{trip.origin} → {trip.destination}</div><div className="text-xs text-white/50 mt-1 inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{trip.currentCheckpoint || `Gate ${trip.gate || '—'}`}</div></div>
        <div><div className="md:hidden text-[10px] text-white/35 uppercase">Scheduled</div><b className="inline-flex items-center gap-1.5"><Clock3 className="h-4 w-4 text-white/40" />{time(trip.scheduledDeparture)}</b>{trip.delayMinutes > 0 && <div className="text-[10px] text-amber-300 mt-1">+{trip.delayMinutes} min</div>}</div>
        <div><div className="md:hidden text-[10px] text-white/35 uppercase">ETA</div><b>{time(trip.eta)}</b></div>
        <div><span className={`inline-flex rounded-full px-3 py-1.5 text-[10px] font-black ${statusColor[trip.status] || 'bg-white/15 text-white'}`}>{trip.status.replace('_', ' ')}</span></div>
      </article>)}{!trips.length && !error && <div className="rounded-3xl border border-dashed border-white/15 py-24 text-center"><BusFront className="h-10 w-10 text-white/20 mx-auto" /><h2 className="font-black mt-4">No active departures</h2><p className="text-sm text-white/40 mt-1">Scheduled and boarding trips will appear automatically.</p></div>}</div>
    </main>
  </div>;
}
