import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import './air-cargo-desktop.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Plane, PlaneTakeoff, PlaneLanding, Globe, Radio, MapPin, Loader2, AlertCircle, RefreshCw, Link2 } from 'lucide-react';

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
const DEFAULT_CHINA_CODES = ['CAN', 'HKG'];

export default function FlightBoard() {
  const [tab, setTab] = useState<BoardTab>('dar-dep');
  const [configured, setConfigured] = useState<boolean | null>(null);

  const [connectionError, setConnectionError] = useState(false);
  const checkConnection = useCallback(() => {
    setConfigured(null);
    setConnectionError(false);
    return api<{ configured: boolean }>('/cargo/flights/fr24/status', { offlineFallback: false })
      .then(r => { if (typeof r?.configured !== 'boolean') throw new Error('Invalid flight connection response'); setConfigured(r.configured); })
      .catch(() => { setConnectionError(true); setConfigured(null); });
  }, []);
  useEffect(() => { void checkConnection(); }, [checkConnection]);

  const tabs: Array<{ key: BoardTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { key: 'dar-dep', label: 'DAR Departures', icon: PlaneTakeoff },
    { key: 'dar-arr', label: 'DAR Arrivals', icon: PlaneLanding },
    { key: 'china-dep', label: 'China Departures', icon: Globe },
    { key: 'hubs', label: 'Transit Hubs', icon: MapPin },
    { key: 'assigned', label: 'Assigned Flights', icon: Link2 },
  ];

  return (
    <section className="ad-flight-board">
      <div className="ad-page-heading">
        <div><div className="ad-overline">FLIGHT OPERATIONS / FLIGHTRADAR24</div><h1>Eyes on the sky.</h1><p>Live airport traffic. Linked to your cargo.</p></div>
        <span className="ad-provider-status"><Radio size={15} />{connectionError ? 'Connection unavailable' : configured === null ? 'Checking connection' : configured ? 'Provider configured' : 'Flight feed not configured'}</span>
      </div>
      <div className="ad-board-tabs">{tabs.map(t => { const Icon = t.icon; return <button type="button" key={t.key} className="cursor-interaction" aria-pressed={tab === t.key} onClick={() => setTab(t.key)}><Icon className="h-4 w-4" />{t.label}</button>; })}</div>
      {connectionError && <div className="ad-load-state" role="alert">The flight connection could not be checked.<button type="button" className="ad-text-button cursor-interaction" onClick={checkConnection}>Retry connection</button></div>}
      {configured === false && !connectionError && <div className="ad-feed-notice"><Radio size={20} /><div><h3>The connector is installed. Activate the feed.</h3><p>Configure FlightRadar24 on the server to receive real aircraft positions.</p></div><button type="button" className="ad-text-button cursor-interaction" onClick={checkConnection}>Check again</button></div>}
      <div className="ad-flight-body">
        {tab === 'assigned' ? <AssignedFlightsPanel /> : configured === true ? <>
          {tab === 'dar-dep' && <AirportPanel code="DAR" direction="departures" />}
          {tab === 'dar-arr' && <AirportPanel code="DAR" direction="arrivals" />}
          {tab === 'china-dep' && <ChinaDeparturesPanel />}
          {tab === 'hubs' && <TransitHubsPanel />}
        </> : <div className="ad-board-empty"><Plane size={32} strokeWidth={1} /><h2>{configured === null && !connectionError ? 'Checking the flight desk.' : 'No live aircraft data loaded.'}</h2><p>Your assigned cargo flights remain available in the Assigned Flights workspace.</p></div>}
      </div>
      <div className="ad-board-footnote"><span>Source: FlightRadar24 · live aircraft coverage, not a full schedule</span><span>Aircraft movement ≠ cargo receipt</span></div>
    </section>
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
      const rows = await api<Fr24Flight[]>(`/cargo/flights/fr24/airport/${encodeURIComponent(code)}/${direction}`, { offlineFallback: false });
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
        <h3 className="text-sm font-medium text-slate-600">
          {code} {direction === 'departures' ? 'Departures' : 'Arrivals'}
        </h3>
        <Button size="sm" variant="ghost" onClick={load} disabled={loading} className="text-xs h-7 text-slate-600 hover:bg-white/30">
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
          className="max-w-xs h-8 text-xs bg-white/50 border-white/[0.40] rounded-xl text-slate-700 placeholder:text-slate-600"
        />
        <Button size="sm" onClick={addCode} className="h-8 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-xl">Add</Button>
      </div>
      {codes.map((code) => (
        <div key={code} className="border border-white/[0.40] rounded-2xl p-4 bg-white/[0.30] backdrop-blur-xl shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-600">{code} Departures</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCodes(codes.filter((c) => c !== code))}
              className="text-[11px] h-6 text-slate-600 hover:text-red-500"
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
    api<AirHub[]>('/cargo/air/hubs', { offlineFallback: false })
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
        <div key={hub.id} className="border border-white/[0.40] rounded-2xl p-4 bg-white/[0.30] backdrop-blur-xl shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-medium text-slate-700">
                {hub.code} — {hub.name}
              </div>
              <div className="text-[11px] text-slate-600">
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
      const rows = await api<ShipmentRow[]>('/cargo/shipments?limit=100', { offlineFallback: false });
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
          className="max-w-xs h-8 text-xs bg-white/50 border-white/[0.40] rounded-xl text-slate-700 placeholder:text-slate-600"
        />
        <Button size="sm" variant="ghost" onClick={load} disabled={loading} className="text-xs h-7 text-slate-600 hover:bg-white/30">
          <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
      {loading && <Loading />}
      {!loading && error && <ErrorMsg msg={error} />}
      {!loading && !error && (
        <Card className="bg-white/[0.30] backdrop-blur-xl border-white/[0.40] rounded-2xl shadow-lg">
          <CardContent className="p-0">
            <div className="ad-flight-table-scroll"><table className="w-full text-[12px] ad-flight-table">
              <thead className="text-slate-600 text-[10px] uppercase tracking-wider border-b border-white/[0.30]">
                <tr>
                  <th className="px-4 py-2.5 text-left text-slate-700">Shipment</th>
                  <th className="px-4 py-2.5 text-left text-slate-700">Flight</th>
                  <th className="px-4 py-2.5 text-left text-slate-700">Carrier</th>
                  <th className="px-4 py-2.5 text-left text-slate-700">Route</th>
                  <th className="px-4 py-2.5 text-left text-slate-700">ETD</th>
                  <th className="px-4 py-2.5 text-left text-slate-700">ETA</th>
                  <th className="px-4 py-2.5 text-left text-slate-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-white/[0.20] hover:bg-white/[0.20]">
                    <td className="px-4 py-2.5 font-mono text-slate-700">{s.shipmentId}</td>
                    <td className="px-4 py-2.5 font-mono text-blue-600">{s.flightNumber}</td>
                    <td className="px-4 py-2.5 text-slate-600">{s.carrier ?? '—'}</td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {s.origin} → {s.destination}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">{fmtDate(s.etd)}</td>
                    <td className="px-4 py-2.5 text-slate-700">{fmtDate(s.eta)}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-500/10 text-slate-600 border border-slate-500/20">
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-slate-600 text-[12px]">
                      No assigned flights match the filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table></div>
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
  const [assignmentMessage, setAssignmentMessage] = useState('');
  const [pendingFlight, setPendingFlight] = useState<string | null>(null);

  const assign = async (flightNumber: string) => {
    if (!shipmentId.trim()) {
      setAssignmentMessage('Enter the internal shipment ID before linking a flight.');
      return;
    }
    if (assigning) return;
    setAssignmentMessage('');
    setAssigning(flightNumber);
    try {
      await api(`/cargo/shipments/${encodeURIComponent(shipmentId.trim())}/assign-fr24-flight`, {
        method: 'POST',
        body: JSON.stringify({ flightNumber }),
        offlineFallback: false,
      });
      setAssignmentMessage(`Assigned ${flightNumber} to ${shipmentId}`);
      setPendingFlight(null);
      setShipmentId('');
    } catch (e) {
      setAssignmentMessage(e instanceof Error ? e.message : 'Assignment failed.');
    } finally {
      setAssigning(null);
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorMsg msg={error} />;
  if (!flights.length) return <EmptyState msg={emptyMessage} />;

  return (
    <div>
      {assignmentMessage && <div className="ad-load-state" role="status">{assignmentMessage}</div>}
      {pendingFlight && <div className="ad-assignment"><div><span className="ad-overline">CONFIRM FLIGHT LINK</span><h3>{pendingFlight} / {shipmentId}</h3><p>Verify the booked service and departure date. An aircraft position is not proof that cargo was loaded.</p></div><button type="button" className="ad-primary cursor-interaction" disabled={!!assigning} onClick={() => void assign(pendingFlight)}>{assigning ? 'Linking…' : 'Confirm assignment'}</button><button type="button" className="ad-text-button cursor-interaction" disabled={!!assigning} onClick={() => setPendingFlight(null)}>Cancel</button></div>}
      <div className="flex items-center gap-2 mb-3 text-[11px]">
        <span className="text-slate-700">Assign to shipment:</span>
        <Input
          placeholder="shipment id"
          value={shipmentId}
          onChange={(e) => setShipmentId(e.target.value)}
          className="max-w-xs h-7 text-xs bg-white/50 border-white/[0.40] rounded-xl text-slate-700 placeholder:text-slate-600"
        />
      </div>
      <Card className="bg-white/[0.30] backdrop-blur-xl border-white/[0.40] rounded-2xl shadow-lg">
        <CardContent className="p-0">
          <div className="ad-flight-table-scroll"><table className="w-full text-[12px] ad-flight-table">
            <thead className="text-slate-600 text-[10px] uppercase tracking-wider border-b border-white/[0.30]">
              <tr>
                <th className="px-4 py-2.5 text-left text-slate-700">Flight</th>
                <th className="px-4 py-2.5 text-left text-slate-700">Airline</th>
                <th className="px-4 py-2.5 text-left text-slate-700">Aircraft</th>
                <th className="px-4 py-2.5 text-left text-slate-700">Route</th>
                <th className="px-4 py-2.5 text-left text-slate-700">Scheduled Dep</th>
                <th className="px-4 py-2.5 text-left text-slate-700">Scheduled Arr</th>
                <th className="px-4 py-2.5 text-left text-slate-700">Status</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {flights.map((f) => (
                <tr key={(f.fr24Id ?? f.callsign) + f.flightNumber} className="border-b border-white/[0.20] hover:bg-white/[0.20]">
                  <td className="px-4 py-2.5 font-mono text-blue-600">{f.flightNumber || f.callsign}</td>
                  <td className="px-4 py-2.5 text-slate-700">{f.airline ?? '—'}</td>
                  <td className="px-4 py-2.5 text-slate-700">{f.aircraftType ?? '—'}</td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {f.origin} → {f.destination}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{fmtDate(f.scheduledDeparture)}</td>
                  <td className="px-4 py-2.5 text-slate-700">{fmtDate(f.scheduledArrival ?? f.estimatedArrival)}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-500/10 text-slate-600 border border-slate-500/20">
                      {f.status ?? 'Position reported'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] border-blue-500/20 text-blue-600 hover:bg-blue-500/10 rounded-lg"
                      onClick={() => { if (!shipmentId.trim()) setAssignmentMessage('Enter the internal shipment ID before linking a flight.'); else { setPendingFlight(f.flightNumber || f.callsign); setAssignmentMessage(''); } }}
                      disabled={!!assigning}
                    >
                      {assigning === (f.flightNumber || f.callsign) ? 'Assigning...' : 'Assign'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </CardContent>
      </Card>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-12 text-slate-600 text-sm">
      <Loader2 className="w-4 h-4 animate-spin mr-2" />
      Loading...
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-600 text-[12px]">
      <AlertCircle className="w-4 h-4" />
      {msg}
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return <div className="text-center py-12 text-slate-600 text-sm">{msg}</div>;
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}
