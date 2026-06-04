import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Plane, PlaneTakeoff, PlaneLanding, Globe, MapPin, Loader2, AlertCircle, RefreshCw, Link2 } from 'lucide-react';

type BoardTab = 'dar-dep' | 'dar-arr' | 'china-dep' | 'hubs' | 'assigned';

interface Fr24Flight {
  fr24Id?: string;
  callsign: string;
  flightNumber: string;
  airline?: string;
  aircraftType?: string;
  registration?: string;
  origin: string;
  destination: string;
  scheduledDeparture?: string;
  scheduledArrival?: string;
  estimatedArrival?: string;
  status?: string;
}

interface AirHub {
  id: string;
  code: string;
  name: string;
  country: string;
  city?: string;
  type?: string;
}

interface ShipmentRow {
  id: string;
  shipmentId: string;
  origin: string;
  destination: string;
  status: string;
  flightNumber?: string | null;
  carrier?: string | null;
  etd?: string | null;
  eta?: string | null;
}

const DAR_CODE = 'DAR';
const DEFAULT_CHINA_CODES = ['PVG', 'CAN', 'HKG'];

export default function FlightBoard() {
  const [tab, setTab] = useState<BoardTab>('dar-dep');
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    api<{ configured: boolean }>('/cargo/flights/fr24/status')
      .then((r) => setConfigured(r.configured))
      .catch(() => setConfigured(false));
  }, []);

  const tabs: Array<{ key: BoardTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { key: 'dar-dep', label: 'DAR Departures', icon: PlaneTakeoff },
    { key: 'dar-arr', label: 'DAR Arrivals', icon: PlaneLanding },
    { key: 'china-dep', label: 'China Departures', icon: Globe },
    { key: 'hubs', label: 'Transit Hubs', icon: MapPin },
    { key: 'assigned', label: 'Assigned Flights', icon: Link2 },
  ];

  return (
    <div className="h-full flex flex-col bg-[#0a0a1a] text-white/90">
      <div className="shrink-0 px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
            <Plane className="w-4 h-4 text-cyan-300" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Flight Board</h2>
            <p className="text-[11px] text-white/40">Powered by Flightradar24 — official API</p>
          </div>
        </div>
        {configured === false && (
          <div className="flex items-center gap-1.5 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-md">
            <AlertCircle className="w-3 h-3" /> FR24_API_KEY not set
          </div>
        )}
      </div>

      <div className="shrink-0 px-5 pt-3 border-b border-white/5 flex gap-1 flex-wrap">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] rounded-t-md border-b-2 transition-colors ${
                active
                  ? 'text-cyan-300 border-cyan-400 bg-cyan-500/5'
                  : 'text-white/60 border-transparent hover:text-white/90 hover:bg-white/[0.03]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {tab === 'dar-dep' && <AirportPanel code={DAR_CODE} direction="departures" />}
        {tab === 'dar-arr' && <AirportPanel code={DAR_CODE} direction="arrivals" />}
        {tab === 'china-dep' && <ChinaDeparturesPanel />}
        {tab === 'hubs' && <TransitHubsPanel />}
        {tab === 'assigned' && <AssignedFlightsPanel />}
      </div>
    </div>
  );
}

function AirportPanel({ code, direction }: { code: string; direction: 'departures' | 'arrivals' }) {
  const [flights, setFlights] = useState<Fr24Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await api<Fr24Flight[]>(`/cargo/flights/fr24/airport/${encodeURIComponent(code)}/${direction}`);
      setFlights(rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load flights');
    } finally {
      setLoading(false);
    }
  }, [code, direction]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-white/80">
          {code} {direction === 'departures' ? 'Departures' : 'Arrivals'}
        </h3>
        <Button size="sm" variant="ghost" onClick={load} disabled={loading} className="text-xs h-7">
          <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
      <FlightTable flights={flights} loading={loading} error={error} emptyMessage={`No live ${direction} for ${code}`} />
    </div>
  );
}

function ChinaDeparturesPanel() {
  const [codes, setCodes] = useState<string[]>(DEFAULT_CHINA_CODES);
  const [newCode, setNewCode] = useState('');

  const addCode = () => {
    const clean = newCode.trim().toUpperCase();
    if (clean && !codes.includes(clean)) setCodes([...codes, clean]);
    setNewCode('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Add airport code (e.g. SZX)"
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCode()}
          className="max-w-xs h-8 text-xs bg-white/5 border-white/10"
        />
        <Button size="sm" onClick={addCode} className="h-8 text-xs">Add</Button>
      </div>
      {codes.map((code) => (
        <div key={code} className="border border-white/[0.06] rounded-lg p-4 bg-white/[0.02]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-white/80">{code} Departures</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCodes(codes.filter((c) => c !== code))}
              className="text-[11px] h-6 text-white/40 hover:text-rose-300"
            >
              Remove
            </Button>
          </div>
          <AirportPanel code={code} direction="departures" />
        </div>
      ))}
    </div>
  );
}

function TransitHubsPanel() {
  const [hubs, setHubs] = useState<AirHub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<AirHub[]>('/cargo/air/hubs')
      .then((rows) => setHubs(rows ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load hubs'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (error) return <ErrorMsg msg={error} />;
  if (!hubs.length) return <EmptyState msg="No transit hubs configured. Add hubs in the Air Cargo module." />;

  return (
    <div className="space-y-6">
      {hubs.map((hub) => (
        <div key={hub.id} className="border border-white/[0.06] rounded-lg p-4 bg-white/[0.02]">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-medium text-white/85">
                {hub.code} — {hub.name}
              </div>
              <div className="text-[11px] text-white/40">
                {hub.city ? `${hub.city}, ` : ''}{hub.country} · {hub.type ?? 'PRIMARY'}
              </div>
            </div>
          </div>
          <AirportPanel code={hub.code} direction="arrivals" />
        </div>
      ))}
    </div>
  );
}

function AssignedFlightsPanel() {
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await api<ShipmentRow[]>('/cargo/shipments');
      setShipments((rows ?? []).filter((r) => r.flightNumber));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load shipments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return shipments;
    return shipments.filter(
      (s) =>
        s.shipmentId.toLowerCase().includes(q) ||
        (s.flightNumber ?? '').toLowerCase().includes(q) ||
        (s.carrier ?? '').toLowerCase().includes(q),
    );
  }, [shipments, filter]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-2">
        <Input
          placeholder="Filter by shipment, flight or carrier"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-xs h-8 text-xs bg-white/5 border-white/10"
        />
        <Button size="sm" variant="ghost" onClick={load} disabled={loading} className="text-xs h-7">
          <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
      {loading && <Loading />}
      {!loading && error && <ErrorMsg msg={error} />}
      {!loading && !error && (
        <Card className="bg-white/[0.02] border-white/[0.06]">
          <CardContent className="p-0">
            <table className="w-full text-[12px]">
              <thead className="text-white/40 text-[10px] uppercase tracking-wider border-b border-white/5">
                <tr>
                  <th className="px-4 py-2.5 text-left">Shipment</th>
                  <th className="px-4 py-2.5 text-left">Flight</th>
                  <th className="px-4 py-2.5 text-left">Carrier</th>
                  <th className="px-4 py-2.5 text-left">Route</th>
                  <th className="px-4 py-2.5 text-left">ETD</th>
                  <th className="px-4 py-2.5 text-left">ETA</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-white/[0.04] hover:bg-white/[0.03]">
                    <td className="px-4 py-2.5 font-mono">{s.shipmentId}</td>
                    <td className="px-4 py-2.5 font-mono text-cyan-300">{s.flightNumber}</td>
                    <td className="px-4 py-2.5">{s.carrier ?? '—'}</td>
                    <td className="px-4 py-2.5 text-white/60">
                      {s.origin} → {s.destination}
                    </td>
                    <td className="px-4 py-2.5 text-white/60">{fmtDate(s.etd)}</td>
                    <td className="px-4 py-2.5 text-white/60">{fmtDate(s.eta)}</td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-white/[0.05]">{s.status}</span>
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-white/40 text-[12px]">
                      No assigned flights match the filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FlightTable({
  flights,
  loading,
  error,
  emptyMessage,
}: {
  flights: Fr24Flight[];
  loading: boolean;
  error: string | null;
  emptyMessage: string;
}) {
  const [assigning, setAssigning] = useState<string | null>(null);
  const [shipmentId, setShipmentId] = useState('');

  const assign = async (flightNumber: string) => {
    if (!shipmentId.trim()) {
      window.alert('Enter a shipment id to assign this flight to');
      return;
    }
    setAssigning(flightNumber);
    try {
      await api(`/cargo/shipments/${encodeURIComponent(shipmentId.trim())}/assign-fr24-flight`, {
        method: 'POST',
        body: JSON.stringify({ flightNumber }),
      });
      window.alert(`Assigned ${flightNumber} to ${shipmentId}`);
      setShipmentId('');
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Assign failed');
    } finally {
      setAssigning(null);
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorMsg msg={error} />;
  if (!flights.length) return <EmptyState msg={emptyMessage} />;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 text-[11px]">
        <span className="text-white/50">Assign to shipment:</span>
        <Input
          placeholder="shipment id"
          value={shipmentId}
          onChange={(e) => setShipmentId(e.target.value)}
          className="max-w-xs h-7 text-xs bg-white/5 border-white/10"
        />
      </div>
      <Card className="bg-white/[0.02] border-white/[0.06]">
        <CardContent className="p-0">
          <table className="w-full text-[12px]">
            <thead className="text-white/40 text-[10px] uppercase tracking-wider border-b border-white/5">
              <tr>
                <th className="px-4 py-2.5 text-left">Flight</th>
                <th className="px-4 py-2.5 text-left">Airline</th>
                <th className="px-4 py-2.5 text-left">Aircraft</th>
                <th className="px-4 py-2.5 text-left">Route</th>
                <th className="px-4 py-2.5 text-left">Scheduled Dep</th>
                <th className="px-4 py-2.5 text-left">Scheduled Arr</th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {flights.map((f) => (
                <tr key={(f.fr24Id ?? f.callsign) + f.flightNumber} className="border-b border-white/[0.04] hover:bg-white/[0.03]">
                  <td className="px-4 py-2.5 font-mono text-cyan-300">{f.flightNumber || f.callsign}</td>
                  <td className="px-4 py-2.5">{f.airline ?? '—'}</td>
                  <td className="px-4 py-2.5 text-white/60">{f.aircraftType ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    {f.origin} → {f.destination}
                  </td>
                  <td className="px-4 py-2.5 text-white/60">{fmtDate(f.scheduledDeparture)}</td>
                  <td className="px-4 py-2.5 text-white/60">{fmtDate(f.scheduledArrival ?? f.estimatedArrival)}</td>
                  <td className="px-4 py-2.5">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-white/[0.05]">{f.status ?? 'LIVE'}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10"
                      onClick={() => assign(f.flightNumber || f.callsign)}
                      disabled={assigning === (f.flightNumber || f.callsign)}
                    >
                      {assigning === (f.flightNumber || f.callsign) ? 'Assigning...' : 'Assign'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-12 text-white/40 text-sm">
      <Loader2 className="w-4 h-4 animate-spin mr-2" />
      Loading…
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-200 text-[12px]">
      <AlertCircle className="w-4 h-4" />
      {msg}
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return <div className="text-center py-12 text-white/40 text-sm">{msg}</div>;
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}
