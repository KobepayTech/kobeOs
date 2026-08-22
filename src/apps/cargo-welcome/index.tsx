import { Building2, Inbox, PackageSearch, Send, Truck } from 'lucide-react';
import { useOSStore } from '@/os/store';

const portals = [
  { id: 'cargo-sender', label: 'Sender', body: 'Create and track outgoing parcels.', icon: Send },
  { id: 'cargo-owner', label: 'Cargo owner', body: 'Track shipments, status and delivery progress.', icon: PackageSearch },
  { id: 'cargo-driver', label: 'Driver', body: 'View assigned delivery work and update trip status.', icon: Truck },
  { id: 'cargo-receiver', label: 'Receiving agent', body: 'Receive, measure and process arriving cargo.', icon: Inbox },
  { id: 'cargo-company', label: 'Company operations', body: 'Manage cargo operations, shipments and staff workflows.', icon: Building2 },
] as const;

export default function CargoWelcome() {
  const launchApp = useOSStore((state) => state.launchApp);
  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-black">Kobe Cargo</h1>
          <p className="mt-1 text-sm text-slate-400">Choose the operational workspace for the job you are doing.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {portals.map(({ id, label, body, icon: Icon }) => (
            <button key={id} onClick={() => launchApp(id)} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-left transition hover:border-emerald-400/30 hover:bg-white/[0.07]">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500/10 text-emerald-300"><Icon className="h-5 w-5" /></div>
              <h2 className="mt-4 font-black">{label}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">{body}</p>
            </button>
          ))}
        </div>
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-slate-500">
          Every portal opens the persisted Kobe Cargo workflow. If the account has not installed or been entitled to a portal, KobeOS uses the normal module install flow instead of simulating it.
        </div>
      </div>
    </div>
  );
}
