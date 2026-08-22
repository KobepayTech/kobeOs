import { useMemo, useState } from 'react';
import { Bell, Loader2, PackageSearch, Search, Wifi, WifiOff } from 'lucide-react';
import { useCargoParcels } from '@/hooks/useCargoParcels';

const statusTone: Record<string, string> = {
  REGISTERED: 'border-slate-600 text-slate-300',
  IN_TRANSIT: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  ARRIVED: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  DELIVERED: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  CANCELLED: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
};

export default function CargoOwner() {
  const { parcels, events, loading, connected } = useCargoParcels();
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return parcels.filter((row) => !q || `${row.parcelId} ${row.senderName} ${row.senderPhone} ${row.ownerName} ${row.ownerPhone} ${row.destination}`.toLowerCase().includes(q));
  }, [parcels, query]);
  const delivered = parcels.filter((row) => row.status === 'DELIVERED').length;
  const moving = parcels.filter((row) => ['IN_TRANSIT', 'ARRIVED'].includes(row.status)).length;

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-5 text-white">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-wrap items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-500/10 text-blue-300"><PackageSearch className="h-5 w-5" /></div>
          <div><h1 className="text-xl font-black">Cargo Owner Portal</h1><p className="text-xs text-slate-500">Your persisted parcel records and live status changes.</p></div>
          <div className={`ml-auto inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black ${connected ? 'border-emerald-500/30 text-emerald-300' : 'border-slate-700 text-slate-500'}`}>{connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}{connected ? 'Live' : 'Reconnecting'}</div>
        </header>
        <div className="grid grid-cols-3 gap-3"><Metric label="Parcels" value={parcels.length} /><Metric label="Moving / arrived" value={moving} /><Metric label="Delivered" value={delivered} /></div>
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tracking number, owner, sender or destination" className="h-11 w-full rounded-xl border border-white/10 bg-slate-900 pl-9 pr-3 text-sm" /></div>
        {loading ? <div className="grid place-items-center py-24"><Loader2 className="h-6 w-6 animate-spin text-blue-300" /></div> : <div className="grid gap-4 lg:grid-cols-[1fr_22rem]"><section className="rounded-2xl border border-white/10 bg-slate-900 px-4">{filtered.map((row) => <div key={row.id} className="border-b border-white/10 py-4"><div className="flex flex-wrap items-center gap-2"><b>{row.parcelId}</b><span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${statusTone[row.status] || 'border-slate-700 text-slate-400'}`}>{row.status.replace(/_/g, ' ')}</span><span className="ml-auto text-xs text-slate-500">{row.createdAt ? new Date(row.createdAt).toLocaleString() : ''}</span></div><div className="mt-2 grid gap-1 text-sm text-slate-300 sm:grid-cols-2"><span>Sender: {row.senderName} · {row.senderPhone}</span><span>Owner: {row.ownerName} · {row.ownerPhone}</span><span>Destination: {row.destination}</span><span>{Number(row.weight || 0).toLocaleString()} kg · {row.packageCount || 1} package(s)</span></div>{row.description && <p className="mt-2 text-xs text-slate-500">{row.description}</p>}</div>)}{!filtered.length && <Empty text="No matching parcel records." />}</section><section className="rounded-2xl border border-white/10 bg-slate-900 p-4"><div className="mb-3 flex items-center gap-2"><Bell className="h-4 w-4 text-amber-300" /><h2 className="font-black">Live changes</h2></div><div className="space-y-2">{events.map((event, index) => <div key={`${event.parcel.id}-${event.at}-${index}`} className="rounded-xl bg-black/20 p-3"><b className="text-xs">{event.parcel.parcelId}</b><p className="mt-1 text-xs text-slate-400">{event.kind === 'status' ? `Status changed${event.previousStatus ? ` from ${event.previousStatus}` : ''} to ${event.parcel.status}.` : event.kind === 'created' ? 'Parcel created.' : 'Assignment changed.'}</p><span className="mt-1 block text-[10px] text-slate-600">{new Date(event.at).toLocaleTimeString()}</span></div>)}{!events.length && <Empty text="No live parcel changes in this session." />}</div></section></div>}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl border border-white/10 bg-slate-900 p-4"><div className="text-xl font-black">{value.toLocaleString()}</div><div className="text-[11px] text-slate-500">{label}</div></div>; }
function Empty({ text }: { text: string }) { return <div className="py-10 text-center text-sm text-slate-500">{text}</div>; }
