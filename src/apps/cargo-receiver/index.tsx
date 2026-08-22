import { useMemo, useState } from 'react';
import { CheckCircle2, Inbox, Loader2, Search, Truck, Wifi, WifiOff } from 'lucide-react';
import { useCargoParcels } from '@/hooks/useCargoParcels';

export default function CargoReceiver() {
  const { parcels, events, loading, connected, updateParcelStatus } = useCargoParcels();
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return parcels.filter((row) => !q || `${row.parcelId} ${row.senderName} ${row.ownerName} ${row.ownerPhone} ${row.destination}`.toLowerCase().includes(q));
  }, [parcels, query]);

  const transition = async (id: string, status: 'ARRIVED' | 'DELIVERED') => {
    setBusyId(id); setError('');
    try { await updateParcelStatus(id, status); }
    catch (cause) { setError((cause as Error).message || 'Could not update parcel status.'); }
    finally { setBusyId(''); }
  };

  const arrived = parcels.filter((row) => row.status === 'ARRIVED').length;
  const inTransit = parcels.filter((row) => row.status === 'IN_TRANSIT').length;
  const delivered = parcels.filter((row) => row.status === 'DELIVERED').length;

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-5 text-white">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-wrap items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-violet-500/10 text-violet-300"><Inbox className="h-5 w-5" /></div>
          <div><h1 className="text-xl font-black">Cargo Receiving</h1><p className="text-xs text-slate-500">Live inbound parcel queue. Status updates are persisted and broadcast to connected users.</p></div>
          <div className={`ml-auto inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black ${connected ? 'border-emerald-500/30 text-emerald-300' : 'border-slate-700 text-slate-500'}`}>{connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}{connected ? 'Live' : 'Reconnecting'}</div>
        </header>
        {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div>}
        <div className="grid grid-cols-3 gap-3"><Metric label="In transit" value={inTransit} /><Metric label="Arrived" value={arrived} /><Metric label="Delivered" value={delivered} /></div>
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Scan or search parcel number, sender, owner or destination" className="h-11 w-full rounded-xl border border-white/10 bg-slate-900 pl-9 pr-3 text-sm" /></div>
        {loading ? <div className="grid place-items-center py-24"><Loader2 className="h-6 w-6 animate-spin text-violet-300" /></div> : <div className="grid gap-4 lg:grid-cols-[1fr_22rem]"><section className="rounded-2xl border border-white/10 bg-slate-900 px-4">{filtered.map((row) => <div key={row.id} className="flex flex-col gap-3 border-b border-white/10 py-4 lg:flex-row lg:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><b>{row.parcelId}</b><Status value={row.status} /></div><div className="mt-2 grid gap-1 text-sm text-slate-300 sm:grid-cols-2"><span>Sender: {row.senderName}</span><span>Owner: {row.ownerName} · {row.ownerPhone}</span><span>Destination: {row.destination}</span><span>{Number(row.weight || 0).toLocaleString()} kg · {row.packageCount || 1} package(s)</span></div>{row.description && <p className="mt-2 text-xs text-slate-500">{row.description}</p>}</div><div className="flex gap-2">{row.status === 'IN_TRANSIT' && <Action disabled={busyId === row.id} label="Mark arrived" onClick={() => void transition(row.id, 'ARRIVED')} icon={<Truck className="h-3.5 w-3.5" />} />}{row.status === 'ARRIVED' && <Action disabled={busyId === row.id} label="Confirm delivered" onClick={() => void transition(row.id, 'DELIVERED')} icon={<CheckCircle2 className="h-3.5 w-3.5" />} />}</div></div>)}{!filtered.length && <Empty text="No matching inbound parcels." />}</section><section className="rounded-2xl border border-white/10 bg-slate-900 p-4"><h2 className="font-black">Recent live events</h2><div className="mt-3 space-y-2">{events.slice(0, 15).map((event, index) => <div key={`${event.parcel.id}-${event.at}-${index}`} className="rounded-xl bg-black/20 p-3"><b className="text-xs">{event.parcel.parcelId}</b><p className="mt-1 text-xs text-slate-400">{event.kind === 'status' ? `Status: ${event.parcel.status.replace(/_/g, ' ')}` : event.kind === 'created' ? 'New parcel registered' : 'Assignment updated'}</p><span className="mt-1 block text-[10px] text-slate-600">{new Date(event.at).toLocaleTimeString()}</span></div>)}{!events.length && <Empty text="No live parcel events in this session." />}</div></section></div>}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl border border-white/10 bg-slate-900 p-4"><div className="text-xl font-black">{value.toLocaleString()}</div><div className="text-[11px] text-slate-500">{label}</div></div>; }
function Status({ value }: { value: string }) { return <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-black text-slate-300">{value.replace(/_/g, ' ')}</span>; }
function Action({ label, onClick, disabled, icon }: { label: string; onClick: () => void; disabled: boolean; icon: React.ReactNode }) { return <button onClick={onClick} disabled={disabled} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-violet-600 px-3 text-xs font-black disabled:opacity-50">{disabled ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}{label}</button>; }
function Empty({ text }: { text: string }) { return <div className="py-10 text-center text-sm text-slate-500">{text}</div>; }
