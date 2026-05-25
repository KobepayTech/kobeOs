import { useMemo, useState } from 'react';
import {
  Ship, Truck, Clock, CheckCircle, AlertTriangle, Plus, Search, Eye,
  Route, ArrowRight, Wifi, WifiOff,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCargoShipments, type ApiShipment } from './useCargoShipments';

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending',
  LOADING: 'Loading',
  IN_TRANSIT: 'In Transit',
  ARRIVED: 'Arrived',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

// Mirrors the server-side SHIPMENT_TRANSITIONS map.
const NEXT_STATUS: Record<string, string[]> = {
  PENDING: ['LOADING', 'CANCELLED'],
  LOADING: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['ARRIVED', 'CANCELLED'],
  ARRIVED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    PENDING: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    LOADING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    IN_TRANSIT: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    ARRIVED: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    DELIVERED: 'bg-green-500/10 text-green-400 border-green-500/20',
    CANCELLED: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return map[status] || 'bg-slate-500/10 text-slate-400';
};

const statusIcon = (group: string) => {
  if (group === 'Delivered') return CheckCircle;
  if (group === 'In Transit') return Truck;
  if (group === 'Pending') return Clock;
  return AlertTriangle;
};

const fmtDate = (d?: string | null) => (d ? new Date(d).toISOString().split('T')[0] : '—');

export default function ERPShipments() {
  const { shipments, loading, connected, createShipment, advanceStatus } = useCargoShipments();
  const [search, setSearch] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newForm, setNewForm] = useState({ shipmentId: '', origin: '', destination: '', carrier: '', weight: 0 });
  const [busy, setBusy] = useState(false);

  const detail = useMemo(
    () => shipments.find((s) => s.id === detailId) ?? null,
    [shipments, detailId],
  );

  const filtered = shipments.filter((s) =>
    s.shipmentId.toLowerCase().includes(search.toLowerCase()) ||
    s.origin.toLowerCase().includes(search.toLowerCase()) ||
    s.destination.toLowerCase().includes(search.toLowerCase())
  );

  const statusCounts = {
    Pending: shipments.filter((s) => ['PENDING', 'LOADING'].includes(s.status)).length,
    'In Transit': shipments.filter((s) => ['IN_TRANSIT', 'ARRIVED'].includes(s.status)).length,
    Delivered: shipments.filter((s) => s.status === 'DELIVERED').length,
    Cancelled: shipments.filter((s) => s.status === 'CANCELLED').length,
  };

  const handleCreate = async () => {
    if (!newForm.shipmentId.trim() || !newForm.origin.trim() || !newForm.destination.trim()) return;
    setBusy(true);
    try {
      await createShipment({
        shipmentId: newForm.shipmentId.trim(),
        origin: newForm.origin.trim(),
        destination: newForm.destination.trim(),
        carrier: newForm.carrier.trim() || undefined,
        weight: Number(newForm.weight) || undefined,
      });
      setNewForm({ shipmentId: '', origin: '', destination: '', carrier: '', weight: 0 });
      setNewOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const handleAdvance = async (s: ApiShipment, status: string) => {
    setBusy(true);
    try {
      await advanceStatus(s.id, status);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full bg-slate-950 text-slate-100 overflow-auto">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ship className="w-5 h-5 text-blue-400" />
            <h1 className="text-lg font-semibold">Shipments</h1>
            <Badge
              variant="outline"
              className={connected
                ? 'bg-green-500/10 text-green-400 border-green-500/20 gap-1'
                : 'bg-slate-500/10 text-slate-400 border-slate-500/20 gap-1'}
            >
              {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {connected ? 'Live' : 'Offline'}
            </Badge>
          </div>
          <Button size="sm" onClick={() => setNewOpen(true)} className="h-8 bg-blue-600 hover:bg-blue-500 text-white text-xs">
            <Plus className="w-3 h-3 mr-1" /> New Shipment
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(statusCounts).map(([group, count]) => {
            const Icon = statusIcon(group);
            return (
              <Card key={group} className="bg-slate-900/60 border-slate-800">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4" style={{ color: group === 'Delivered' ? '#22c55e' : group === 'In Transit' ? '#3b82f6' : group === 'Pending' ? '#eab308' : '#ef4444' }} />
                    <span className="text-xs text-slate-400">{group}</span>
                  </div>
                  <div className="text-xl font-bold">{count}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 bg-slate-900/60 border-slate-800">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Shipments</CardTitle>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="pl-8 h-8 w-56 bg-slate-900 border-slate-700 text-xs" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead className="text-slate-400 text-xs">ID</TableHead>
                      <TableHead className="text-slate-400 text-xs">Route</TableHead>
                      <TableHead className="text-slate-400 text-xs">Carrier</TableHead>
                      <TableHead className="text-slate-400 text-xs">Status</TableHead>
                      <TableHead className="text-slate-400 text-xs">ETA</TableHead>
                      <TableHead className="text-slate-400 text-xs">Weight</TableHead>
                      <TableHead className="text-slate-400 text-xs text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!loading && filtered.length === 0 && (
                      <TableRow className="border-slate-800 hover:bg-transparent">
                        <TableCell colSpan={7} className="text-center text-xs text-slate-500 py-8">
                          No shipments yet.
                        </TableCell>
                      </TableRow>
                    )}
                    {loading && (
                      <TableRow className="border-slate-800 hover:bg-transparent">
                        <TableCell colSpan={7} className="text-center text-xs text-slate-500 py-8">
                          Loading shipments…
                        </TableCell>
                      </TableRow>
                    )}
                    {filtered.map((s) => (
                      <TableRow key={s.id} className="border-slate-800 hover:bg-slate-800/40">
                        <TableCell className="text-xs font-mono text-slate-300">{s.shipmentId}</TableCell>
                        <TableCell className="text-xs text-slate-300">
                          <div className="flex items-center gap-1">
                            <span>{s.origin}</span>
                            <ArrowRight className="w-3 h-3 text-slate-500" />
                            <span>{s.destination}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-400">{s.carrier || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusBadge(s.status)}>
                            {STATUS_LABEL[s.status] ?? s.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-400">{fmtDate(s.eta)}</TableCell>
                        <TableCell className="text-xs font-medium">{s.weight ? `${s.weight}kg` : '—'}</TableCell>
                        <TableCell className="text-right">
                          <button onClick={() => { setDetailId(s.id); setDetailOpen(true); }} className="text-slate-400 hover:text-blue-400">
                            <Eye className="w-4 h-4" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Route className="w-4 h-4 text-blue-400" /> Route Map
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative h-[250px] rounded-lg bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 overflow-hidden">
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 250">
                  <rect width="400" height="250" fill="#0f172a" />
                  <circle cx="280" cy="180" r="4" fill="#3b82f6" />
                  <text x="285" y="183" fill="#94a3b8" fontSize="8">Dar</text>
                  <circle cx="120" cy="60" r="4" fill="#22c55e" />
                  <text x="125" y="63" fill="#94a3b8" fontSize="8">Arusha</text>
                  <circle cx="80" cy="120" r="4" fill="#eab308" />
                  <text x="50" y="123" fill="#94a3b8" fontSize="8">Mwanza</text>
                  <circle cx="200" cy="140" r="4" fill="#ef4444" />
                  <text x="205" y="143" fill="#94a3b8" fontSize="8">Dodoma</text>
                  <circle cx="320" cy="80" r="4" fill="#8b5cf6" />
                  <text x="325" y="83" fill="#94a3b8" fontSize="8">Zanzibar</text>
                  <line x1="280" y1="180" x2="120" y2="60" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="4 2" />
                  <line x1="280" y1="180" x2="80" y2="120" stroke="#eab308" strokeWidth="1.5" strokeDasharray="4 2" />
                  <line x1="280" y1="180" x2="200" y2="140" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="4 2" />
                  <line x1="280" y1="180" x2="320" y2="80" stroke="#22c55e" strokeWidth="1.5" strokeDasharray="4 2" />
                </svg>
                <div className="absolute bottom-2 left-2 text-[10px] text-slate-500">Simulated route map</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Shipment {detail?.shipmentId}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
                  <div className="text-slate-400">Origin</div>
                  <div className="font-medium">{detail.origin}</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
                  <div className="text-slate-400">Destination</div>
                  <div className="font-medium">{detail.destination}</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
                  <div className="text-slate-400">Carrier</div>
                  <div className="font-medium">{detail.carrier || '—'}</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
                  <div className="text-slate-400">Flight</div>
                  <div className="font-medium">{detail.flightNumber || '—'}</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
                  <div className="text-slate-400">Weight</div>
                  <div className="font-medium">{detail.weight ? `${detail.weight}kg` : '—'}</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
                  <div className="text-slate-400">ETA</div>
                  <div className="font-medium">{fmtDate(detail.eta)}</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-slate-300">Current Status</div>
                  <Badge variant="outline" className={statusBadge(detail.status)}>
                    {STATUS_LABEL[detail.status] ?? detail.status}
                  </Badge>
                </div>
                {(NEXT_STATUS[detail.status] ?? []).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {(NEXT_STATUS[detail.status] ?? []).map((next) => (
                      <Button
                        key={next}
                        size="sm"
                        disabled={busy}
                        onClick={() => handleAdvance(detail, next)}
                        className={next === 'CANCELLED'
                          ? 'h-7 text-xs bg-red-600/80 hover:bg-red-600 text-white'
                          : 'h-7 text-xs bg-blue-600 hover:bg-blue-500 text-white'}
                      >
                        Mark {STATUS_LABEL[next] ?? next}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-500">No further status changes available.</div>
                )}
              </div>

              <Button onClick={() => setDetailOpen(false)} className="w-full bg-slate-700 hover:bg-slate-600 text-white">Close</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">New Shipment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Shipment ID" value={newForm.shipmentId} onChange={(e) => setNewForm((f) => ({ ...f, shipmentId: e.target.value }))} className="bg-slate-800 border-slate-700 text-slate-100" />
            <Input placeholder="Origin" value={newForm.origin} onChange={(e) => setNewForm((f) => ({ ...f, origin: e.target.value }))} className="bg-slate-800 border-slate-700 text-slate-100" />
            <Input placeholder="Destination" value={newForm.destination} onChange={(e) => setNewForm((f) => ({ ...f, destination: e.target.value }))} className="bg-slate-800 border-slate-700 text-slate-100" />
            <Input placeholder="Carrier" value={newForm.carrier} onChange={(e) => setNewForm((f) => ({ ...f, carrier: e.target.value }))} className="bg-slate-800 border-slate-700 text-slate-100" />
            <Input type="number" placeholder="Weight (kg)" value={newForm.weight} onChange={(e) => setNewForm((f) => ({ ...f, weight: Number(e.target.value) }))} className="bg-slate-800 border-slate-700 text-slate-100" />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setNewOpen(false)} className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800">Cancel</Button>
              <Button onClick={handleCreate} disabled={busy || !newForm.shipmentId.trim() || !newForm.origin.trim() || !newForm.destination.trim()} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white">Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
