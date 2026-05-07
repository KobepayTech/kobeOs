import { useState } from 'react';
import {
  Ship, Truck, Clock, CheckCircle, AlertTriangle, Plus, Search, Eye,
  Route, Package, ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const tzs = (n: number) => `TZS ${n.toLocaleString()}`;

const initialShipments = [
  { id: 'SH-001', origin: 'Dar es Salaam', destination: 'Arusha', carrier: 'FastFreight TZ', status: 'In Transit', eta: '2026-05-10', cost: 180000, items: 12, weight: '45kg', timeline: [
    { event: 'Shipped', time: '2026-05-06 08:00', location: 'Dar es Salaam' },
    { event: 'In Transit', time: '2026-05-07 14:30', location: 'Dodoma Hub' },
  ]},
  { id: 'SH-002', origin: 'Dar es Salaam', destination: 'Mwanza', carrier: 'Lake Express', status: 'Pending', eta: '2026-05-12', cost: 220000, items: 8, weight: '32kg', timeline: [
    { event: 'Order Received', time: '2026-05-08 09:00', location: 'Dar es Salaam' },
  ]},
  { id: 'SH-003', origin: 'Nairobi', destination: 'Dar es Salaam', carrier: 'East African Cargo', status: 'Delivered', eta: '2026-05-05', cost: 350000, items: 25, weight: '120kg', timeline: [
    { event: 'Shipped', time: '2026-05-02 06:00', location: 'Nairobi' },
    { event: 'Customs Cleared', time: '2026-05-03 11:00', location: 'Namanga Border' },
    { event: 'In Transit', time: '2026-05-04 16:00', location: 'Arusha' },
    { event: 'Delivered', time: '2026-05-05 10:30', location: 'Dar es Salaam' },
  ]},
  { id: 'SH-004', origin: 'Dar es Salaam', destination: 'Mbeya', carrier: 'FastFreight TZ', status: 'Delayed', eta: '2026-05-09', cost: 160000, items: 5, weight: '18kg', timeline: [
    { event: 'Shipped', time: '2026-05-06 07:00', location: 'Dar es Salaam' },
    { event: 'Delayed', time: '2026-05-07 18:00', location: 'Iringa - Road Block' },
  ]},
  { id: 'SH-005', origin: 'Dubai', destination: 'Dar es Salaam', carrier: 'DHL Express', status: 'In Transit', eta: '2026-05-14', cost: 850000, items: 40, weight: '210kg', timeline: [
    { event: 'Shipped', time: '2026-05-05 22:00', location: 'Dubai' },
    { event: 'Arrived at Port', time: '2026-05-08 06:00', location: 'Dar Port' },
    { event: 'Customs Processing', time: '2026-05-08 14:00', location: 'Dar Port' },
  ]},
  { id: 'SH-006', origin: 'Dar es Salaam', destination: 'Zanzibar', carrier: 'Azam Marine', status: 'Delivered', eta: '2026-05-07', cost: 75000, items: 3, weight: '12kg', timeline: [
    { event: 'Shipped', time: '2026-05-07 07:00', location: 'Dar Port' },
    { event: 'Delivered', time: '2026-05-07 11:30', location: 'Zanzibar' },
  ]},
  { id: 'SH-007', origin: 'Dar es Salaam', destination: 'Dodoma', carrier: 'FastFreight TZ', status: 'In Transit', eta: '2026-05-09', cost: 95000, items: 6, weight: '22kg', timeline: [
    { event: 'Shipped', time: '2026-05-08 06:00', location: 'Dar es Salaam' },
    { event: 'In Transit', time: '2026-05-08 16:00', location: 'Morogoro' },
  ]},
  { id: 'SH-008', origin: 'Mumbai', destination: 'Dar es Salaam', carrier: 'Maersk Line', status: 'Pending', eta: '2026-05-20', cost: 1200000, items: 100, weight: '850kg', timeline: [
    { event: 'Booking Confirmed', time: '2026-05-08 10:00', location: 'Mumbai' },
  ]},
];

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    Delivered: 'bg-green-500/10 text-green-400 border-green-500/20',
    'In Transit': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    Pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    Delayed: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return map[status] || 'bg-slate-500/10 text-slate-400';
};

const statusIcon = (status: string) => {
  if (status === 'Delivered') return CheckCircle;
  if (status === 'In Transit') return Truck;
  if (status === 'Pending') return Clock;
  if (status === 'Delayed') return AlertTriangle;
  return Package;
};

export default function ERPShipments() {
  const [shipments] = useState(initialShipments);
  const [search, setSearch] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<typeof initialShipments[0] | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newForm, setNewForm] = useState({ id: '', origin: '', destination: '', carrier: '', cost: 0 });

  const filtered = shipments.filter((s) =>
    s.id.toLowerCase().includes(search.toLowerCase()) ||
    s.origin.toLowerCase().includes(search.toLowerCase()) ||
    s.destination.toLowerCase().includes(search.toLowerCase())
  );

  const statusCounts = {
    Pending: shipments.filter((s) => s.status === 'Pending').length,
    'In Transit': shipments.filter((s) => s.status === 'In Transit').length,
    Delivered: shipments.filter((s) => s.status === 'Delivered').length,
    Delayed: shipments.filter((s) => s.status === 'Delayed').length,
  };

  return (
    <div className="h-full bg-slate-950 text-slate-100 overflow-auto">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ship className="w-5 h-5 text-blue-400" />
            <h1 className="text-lg font-semibold">Shipments</h1>
          </div>
          <Button size="sm" onClick={() => setNewOpen(true)} className="h-8 bg-blue-600 hover:bg-blue-500 text-white text-xs">
            <Plus className="w-3 h-3 mr-1" /> New Shipment
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(statusCounts).map(([status, count]) => {
            const Icon = statusIcon(status);
            return (
              <Card key={status} className="bg-slate-900/60 border-slate-800">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4" style={{ color: status === 'Delivered' ? '#22c55e' : status === 'In Transit' ? '#3b82f6' : status === 'Pending' ? '#eab308' : '#ef4444' }} />
                    <span className="text-xs text-slate-400">{status}</span>
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
                      <TableHead className="text-slate-400 text-xs">Cost</TableHead>
                      <TableHead className="text-slate-400 text-xs text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((s) => (
                      <TableRow key={s.id} className="border-slate-800 hover:bg-slate-800/40">
                        <TableCell className="text-xs font-mono text-slate-300">{s.id}</TableCell>
                        <TableCell className="text-xs text-slate-300">
                          <div className="flex items-center gap-1">
                            <span>{s.origin}</span>
                            <ArrowRight className="w-3 h-3 text-slate-500" />
                            <span>{s.destination}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-400">{s.carrier}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusBadge(s.status)}>
                            {s.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-400">{s.eta}</TableCell>
                        <TableCell className="text-xs font-medium">{tzs(s.cost)}</TableCell>
                        <TableCell className="text-right">
                          <button onClick={() => { setDetail(s); setDetailOpen(true); }} className="text-slate-400 hover:text-blue-400">
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
            <DialogTitle className="text-sm">Shipment {detail?.id}</DialogTitle>
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
                  <div className="font-medium">{detail.carrier}</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
                  <div className="text-slate-400">Cost</div>
                  <div className="font-medium">{tzs(detail.cost)}</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
                  <div className="text-slate-400">Items</div>
                  <div className="font-medium">{detail.items}</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
                  <div className="text-slate-400">Weight</div>
                  <div className="font-medium">{detail.weight}</div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-slate-300">Tracking Timeline</div>
                {detail.timeline.map((t, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-blue-400" />
                      {i < detail.timeline.length - 1 && <div className="w-px flex-1 bg-slate-700" />}
                    </div>
                    <div className="pb-3">
                      <div className="text-xs font-medium">{t.event}</div>
                      <div className="text-[10px] text-slate-400">{t.time} &middot; {t.location}</div>
                    </div>
                  </div>
                ))}
              </div>
              <Button onClick={() => setDetailOpen(false)} className="w-full bg-blue-600 hover:bg-blue-500 text-white">Close</Button>
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
            <Input placeholder="Shipment ID" value={newForm.id} onChange={(e) => setNewForm((f) => ({ ...f, id: e.target.value }))} className="bg-slate-800 border-slate-700 text-slate-100" />
            <Input placeholder="Origin" value={newForm.origin} onChange={(e) => setNewForm((f) => ({ ...f, origin: e.target.value }))} className="bg-slate-800 border-slate-700 text-slate-100" />
            <Input placeholder="Destination" value={newForm.destination} onChange={(e) => setNewForm((f) => ({ ...f, destination: e.target.value }))} className="bg-slate-800 border-slate-700 text-slate-100" />
            <Input placeholder="Carrier" value={newForm.carrier} onChange={(e) => setNewForm((f) => ({ ...f, carrier: e.target.value }))} className="bg-slate-800 border-slate-700 text-slate-100" />
            <Input type="number" placeholder="Cost (TZS)" value={newForm.cost} onChange={(e) => setNewForm((f) => ({ ...f, cost: Number(e.target.value) }))} className="bg-slate-800 border-slate-700 text-slate-100" />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setNewOpen(false)} className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800">Cancel</Button>
              <Button onClick={() => setNewOpen(false)} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white">Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
