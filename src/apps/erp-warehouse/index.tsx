import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { ensureSession } from '@/lib/auth';
import {
  Warehouse, Package, ScanLine, QrCode, Printer, CheckSquare, Square,
  Clock, User, AlertCircle, Play, Box, TrendingUp, BarChart2, RefreshCw,
  PlusCircle, ChevronRight, Layers,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const initialQueue = [
  { id: 'FL-1021', orderId: 'ORD-1040', items: 4, priority: 'High', status: 'Picking', assignee: 'John D.', location: 'A-12, B-03, C-07, D-01' },
  { id: 'FL-1022', orderId: 'ORD-1039', items: 12, priority: 'Normal', status: 'Pending', assignee: 'Unassigned', location: 'A-01..A-12' },
  { id: 'FL-1023', orderId: 'ORD-1038', items: 2, priority: 'High', status: 'Ready', assignee: 'Mary K.', location: 'C-05, D-02' },
  { id: 'FL-1024', orderId: 'ORD-1037', items: 7, priority: 'Normal', status: 'Picking', assignee: 'John D.', location: 'B-01..B-07' },
  { id: 'FL-1025', orderId: 'ORD-1036', items: 3, priority: 'Low', status: 'Shipped', assignee: 'Mary K.', location: 'A-03, C-08, D-01' },
  { id: 'FL-1026', orderId: 'ORD-1035', items: 5, priority: 'Normal', status: 'Pending', assignee: 'Unassigned', location: 'A-05..A-09' },
  { id: 'FL-1027', orderId: 'ORD-1034', items: 8, priority: 'High', status: 'Picking', assignee: 'Peter O.', location: 'B-02..B-09' },
];

const pickingItems = [
  { id: 1, sku: 'ELEC-042', name: 'Samsung Galaxy A14', location: 'A-12', qty: 1, picked: false },
  { id: 2, sku: 'CLTH-018', name: "Men's Cotton T-Shirt L", location: 'B-03', qty: 2, picked: false },
  { id: 3, sku: 'FOOD-033', name: 'Mama Ntilie Rice 5kg', location: 'C-07', qty: 1, picked: false },
  { id: 4, sku: 'HSHD-009', name: 'Borehole Pump 1HP', location: 'D-01', qty: 1, picked: false },
];

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    Pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    Picking: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    Ready: 'bg-green-500/10 text-green-400 border-green-500/20',
    Shipped: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    High: 'bg-red-500/10 text-red-400 border-red-500/20',
    Normal: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    Low: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  };
  return map[status] || 'bg-slate-500/10 text-slate-400';
};

export default function ERPWarehouse() {
  const [activeTab, setActiveTab] = useState('queue');
  const [queue, setQueue] = useState(initialQueue);
  const [items, setItems] = useState(pickingItems);
  const [scanInput, setScanInput] = useState('');
  const [scanned, setScanned] = useState<string[]>([]);
  const [qrResult, setQrResult] = useState<string | null>(null);
  const [printerStatus, setPrinterStatus] = useState('Online');

  // ── Stock Estimator state ────────────────────────────────────────────────
  type Allocation = {
    id: string;
    allocationNumber: string;
    shopName: string | null;
    warehouseName: string | null;
    totalValue: number;
    totalPieces: number;
    averagePieceValue: number;
    currency: string;
    status: string;
  };
  type EstimateResult = {
    allocationId: string;
    allocationNumber: string;
    shopName: string | null;
    totalValue: number;
    totalPieces: number;
    averagePieceValue: number;
    currency: string;
    salesValue: number;
    estimatedSoldPieces: number;
    estimatedRemainingPieces: number;
    superProfit: number;
    accuracy: string;
    status: string;
  };
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [selectedAlloc, setSelectedAlloc] = useState<Allocation | null>(null);
  const [estimateResult, setEstimateResult] = useState<EstimateResult | null>(null);
  const [salesInput, setSalesInput] = useState('');
  const [physicalInput, setPhysicalInput] = useState('');
  const [estimatorBusy, setEstimatorBusy] = useState(false);
  const [estimatorError, setEstimatorError] = useState<string | null>(null);
  // New allocation form
  const [newAllocForm, setNewAllocForm] = useState({
    allocationNumber: '', shopName: '', warehouseName: '',
    totalValue: '', totalPieces: '', currency: 'TZS',
  });
  const [showNewAllocForm, setShowNewAllocForm] = useState(false);

  // Seed /api/warehouse/items from the picking list on first mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensureSession();
        const existing = await api<Array<{ id: string }>>('/warehouse/items');
        if (cancelled || existing.length > 0) return;
        await Promise.all(pickingItems.map((p) =>
          api('/warehouse/items', {
            method: 'POST',
            body: JSON.stringify({
              sku: p.sku, name: p.name, quantity: 50,
              reorderLevel: 10, location: p.location,
            }),
          }),
        ));
      } catch { /* leave demo */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const togglePick = (id: number) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, picked: !i.picked } : i)));
  };

  const handleScan = () => {
    if (scanInput.trim()) {
      setScanned((prev) => [...prev, scanInput.trim()]);
      setScanInput('');
    }
  };

  const simulateQr = () => {
    const codes = ['BOX-A12-ELEC042', 'BOX-B03-CLTH018', 'PALLET-C07-FOOD033'];
    const random = codes[Math.floor(Math.random() * codes.length)];
    setQrResult(random);
  };

  const assignTask = (id: string) => {
    const names = ['John D.', 'Mary K.', 'Peter O.', 'Grace W.'];
    // eslint-disable-next-line react-hooks/purity
    const random = names[Math.floor(Math.random() * names.length)];
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, assignee: random, status: 'Picking' as const } : q)));
  };

  const pickedCount = items.filter((i) => i.picked).length;

  // ── Stock Estimator helpers ──────────────────────────────────────────────
  const loadAllocations = async () => {
    try {
      await ensureSession();
      const data = await api<Allocation[]>('/shop-stock/allocations');
      setAllocations(data);
    } catch { /* leave empty */ }
  };

  useEffect(() => {
    if (activeTab === 'estimator') loadAllocations();
  }, [activeTab]);

  const handleCreateAllocation = async () => {
    if (!newAllocForm.allocationNumber || !newAllocForm.totalValue || !newAllocForm.totalPieces) return;
    setEstimatorBusy(true);
    setEstimatorError(null);
    try {
      await ensureSession();
      await api('/shop-stock/allocations', {
        method: 'POST',
        body: JSON.stringify({
          allocationNumber: newAllocForm.allocationNumber,
          shopName: newAllocForm.shopName || undefined,
          warehouseName: newAllocForm.warehouseName || undefined,
          totalValue: parseFloat(newAllocForm.totalValue),
          totalPieces: parseInt(newAllocForm.totalPieces, 10),
          currency: newAllocForm.currency,
        }),
      });
      setNewAllocForm({ allocationNumber: '', shopName: '', warehouseName: '', totalValue: '', totalPieces: '', currency: 'TZS' });
      setShowNewAllocForm(false);
      await loadAllocations();
    } catch (e: any) {
      setEstimatorError(e?.message ?? 'Failed to create allocation');
    } finally {
      setEstimatorBusy(false);
    }
  };

  const handleCalculateEstimate = async () => {
    if (!selectedAlloc || !salesInput) return;
    setEstimatorBusy(true);
    setEstimatorError(null);
    try {
      await ensureSession();
      const result = await api<EstimateResult>(
        `/shop-stock/allocations/${selectedAlloc.id}/calculate-estimate`,
        { method: 'POST', body: JSON.stringify({ salesValue: parseFloat(salesInput) }) },
      );
      setEstimateResult(result);
    } catch (e: any) {
      setEstimatorError(e?.message ?? 'Calculation failed');
    } finally {
      setEstimatorBusy(false);
    }
  };

  const handleReconcile = async () => {
    if (!selectedAlloc || !physicalInput) return;
    setEstimatorBusy(true);
    setEstimatorError(null);
    try {
      await ensureSession();
      await api(`/shop-stock/allocations/${selectedAlloc.id}/reconcile`, {
        method: 'POST',
        body: JSON.stringify({ physicalCount: parseFloat(physicalInput) }),
      });
      await loadAllocations();
      setEstimateResult(null);
      setSelectedAlloc(null);
      setPhysicalInput('');
    } catch (e: any) {
      setEstimatorError(e?.message ?? 'Reconciliation failed');
    } finally {
      setEstimatorBusy(false);
    }
  };

  const fmt = (n: number, currency = 'TZS') =>
    `${currency} ${Number(n).toLocaleString('en-TZ', { maximumFractionDigits: 0 })}`;

  return (
    <div className="h-full bg-slate-950 text-slate-100 overflow-auto">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Warehouse className="w-5 h-5 text-blue-400" />
            <h1 className="text-lg font-semibold">Warehouse</h1>
          </div>
          <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">
            <span className="w-2 h-2 rounded-full bg-green-400 mr-1" /> System Online
          </Badge>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-900 border border-slate-800 h-9">
            <TabsTrigger value="queue" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Package className="w-3 h-3 mr-1" /> Queue
            </TabsTrigger>
            <TabsTrigger value="picking" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Box className="w-3 h-3 mr-1" /> Picking
            </TabsTrigger>
            <TabsTrigger value="scan" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <ScanLine className="w-3 h-3 mr-1" /> Scan Station
            </TabsTrigger>
            <TabsTrigger value="qr" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <QrCode className="w-3 h-3 mr-1" /> QR Scanner
            </TabsTrigger>
            <TabsTrigger value="printer" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Printer className="w-3 h-3 mr-1" /> Printer
            </TabsTrigger>
            <TabsTrigger value="estimator" className="text-xs data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              <BarChart2 className="w-3 h-3 mr-1" /> Estimator
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {activeTab === 'queue' && (
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Fulfillment Queue</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[450px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead className="text-slate-400 text-xs">Queue ID</TableHead>
                      <TableHead className="text-slate-400 text-xs">Order</TableHead>
                      <TableHead className="text-slate-400 text-xs">Items</TableHead>
                      <TableHead className="text-slate-400 text-xs">Priority</TableHead>
                      <TableHead className="text-slate-400 text-xs">Status</TableHead>
                      <TableHead className="text-slate-400 text-xs">Assignee</TableHead>
                      <TableHead className="text-slate-400 text-xs">Locations</TableHead>
                      <TableHead className="text-slate-400 text-xs text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queue.map((q) => (
                      <TableRow key={q.id} className="border-slate-800 hover:bg-slate-800/40">
                        <TableCell className="text-xs font-mono text-slate-300">{q.id}</TableCell>
                        <TableCell className="text-xs font-mono text-slate-400">{q.orderId}</TableCell>
                        <TableCell className="text-xs text-slate-300">{q.items}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusBadge(q.priority)}>
                            {q.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusBadge(q.status)}>
                            {q.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-300">{q.assignee}</TableCell>
                        <TableCell className="text-xs text-slate-400">{q.location}</TableCell>
                        <TableCell className="text-right">
                          {q.assignee === 'Unassigned' ? (
                            <Button size="sm" onClick={() => assignTask(q.id)} className="h-7 bg-blue-600 hover:bg-blue-500 text-white text-xs">
                              <Play className="w-3 h-3 mr-1" /> Assign
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-500">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {activeTab === 'picking' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 bg-slate-900/60 border-slate-800">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Picking List — FL-1021</CardTitle>
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                    {pickedCount}/{items.length} picked
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => togglePick(item.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        item.picked ? 'bg-green-500/5 border-green-500/20' : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
                      }`}
                    >
                      {item.picked ? <CheckSquare className="w-5 h-5 text-green-400" /> : <Square className="w-5 h-5 text-slate-500" />}
                      <div className="flex-1">
                        <div className="text-xs font-medium">{item.name}</div>
                        <div className="text-[10px] text-slate-400">{item.sku} &middot; Qty: {item.qty}</div>
                      </div>
                      <Badge variant="outline" className="text-slate-400 border-slate-700 bg-slate-800">
                        <Box className="w-3 h-3 mr-1" /> {item.location}
                      </Badge>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex gap-2">
                  <Button className="flex-1 bg-green-600 hover:bg-green-500 text-white" disabled={pickedCount < items.length}>
                    Mark Ready
                  </Button>
                  <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                    Print Pick List
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/60 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Picking Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Progress</span>
                    <span className="text-blue-400">{Math.round((pickedCount / items.length) * 100)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all" style={{ width: `${(pickedCount / items.length) * 100}%` }} />
                  </div>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Clock className="w-3 h-3" /> Started: 08:23 AM
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <User className="w-3 h-3" /> Picker: John D.
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Package className="w-3 h-3" /> Order: ORD-1040
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Warehouse className="w-3 h-3" /> Zone: A-D
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'scan' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-slate-900/60 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ScanLine className="w-4 h-4 text-blue-400" /> Barcode Scan Station
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                    placeholder="Scan or type barcode..."
                    className="bg-slate-800 border-slate-700 text-slate-100"
                    autoFocus
                  />
                  <Button onClick={handleScan} className="bg-blue-600 hover:bg-blue-500 text-white">
                    <ScanLine className="w-4 h-4" />
                  </Button>
                </div>
                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50 text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-2 border-2 border-dashed border-slate-600">
                    <ScanLine className="w-8 h-8 text-slate-500" />
                  </div>
                  <p className="text-xs text-slate-400">Scan item barcode to verify</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/60 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Scanned History</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[250px]">
                  {scanned.length === 0 ? (
                    <div className="text-center text-xs text-slate-500 py-8">No items scanned yet</div>
                  ) : (
                    <div className="space-y-1">
                      {scanned.map((s, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 rounded bg-slate-800/50 text-xs">
                          <CheckSquare className="w-3 h-3 text-green-400" />
                          <span className="text-slate-300">{s}</span>
                          <span className="ml-auto text-slate-500">{new Date().toLocaleTimeString('en-GB')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'qr' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-slate-900/60 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-blue-400" /> QR Code Scanner
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50 text-center">
                  <div className="w-32 h-32 rounded-lg bg-slate-800 flex items-center justify-center mx-auto mb-3 border-2 border-dashed border-slate-600">
                    <QrCode className="w-12 h-12 text-slate-500" />
                  </div>
                  <p className="text-xs text-slate-400 mb-3">Point camera at QR code or simulate scan</p>
                  <Button onClick={simulateQr} className="bg-blue-600 hover:bg-blue-500 text-white">
                    Simulate QR Scan
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/60 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Scan Result</CardTitle>
              </CardHeader>
              <CardContent>
                {qrResult ? (
                  <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/20 space-y-2">
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckSquare className="w-4 h-4" />
                      <span className="text-sm font-medium">Scan Successful</span>
                    </div>
                    <div className="text-xs text-slate-300 font-mono">{qrResult}</div>
                    <div className="text-[10px] text-slate-400">Timestamp: {new Date().toLocaleString('en-GB')}</div>
                    <div className="text-[10px] text-slate-400">Type: Inventory pallet label</div>
                  </div>
                ) : (
                  <div className="text-center text-xs text-slate-500 py-8">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    Waiting for QR code...
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'printer' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-slate-900/60 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Printer className="w-4 h-4 text-blue-400" /> Printer Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                  <div>
                    <div className="text-xs font-medium">Zebra ZD421</div>
                    <div className="text-[10px] text-slate-400">Label Printer &middot; USB</div>
                  </div>
                  <Badge variant="outline" className={printerStatus === 'Online' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}>
                    {printerStatus}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                  <div>
                    <div className="text-xs font-medium">Epson TM-T88VI</div>
                    <div className="text-[10px] text-slate-400">Receipt Printer &middot; Network</div>
                  </div>
                  <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">Online</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                  <div>
                    <div className="text-xs font-medium">HP LaserJet Pro</div>
                    <div className="text-[10px] text-slate-400">A4 Document &middot; Network</div>
                  </div>
                  <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20">Low Toner</Badge>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => setPrinterStatus('Online')}>
                    Test Print
                  </Button>
                  <Button variant="outline" className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => setPrinterStatus((s) => s === 'Online' ? 'Offline' : 'Online')}>
                    Toggle Status
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/60 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Print Queue</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[250px]">
                  <div className="space-y-2">
                    {[
                      { doc: 'Shipping Label #FL-1023', printer: 'Zebra ZD421', status: 'Printing' },
                      { doc: 'Receipt #ORD-1042', printer: 'Epson TM-T88VI', status: 'Queued' },
                      { doc: 'Pick List #FL-1021', printer: 'HP LaserJet Pro', status: 'Queued' },
                      { doc: 'Invoice #INV-2026-1042', printer: 'HP LaserJet Pro', status: 'Completed' },
                    ].map((job, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded bg-slate-800/50 border border-slate-700/50">
                        <div>
                          <div className="text-xs font-medium">{job.doc}</div>
                          <div className="text-[10px] text-slate-400">{job.printer}</div>
                        </div>
                        <Badge variant="outline" className={statusBadge(job.status === 'Completed' ? 'Ready' : job.status === 'Printing' ? 'Picking' : 'Pending')}>
                          {job.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        )}
        {activeTab === 'estimator' && (
          <div className="space-y-4">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-medium">Shop Stock Estimator</span>
                <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[10px]">
                  Value-ratio model
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
                  onClick={loadAllocations}
                >
                  <RefreshCw className="w-3 h-3 mr-1" /> Refresh
                </Button>
                <Button
                  size="sm"
                  className="h-7 bg-purple-600 hover:bg-purple-500 text-white text-xs"
                  onClick={() => setShowNewAllocForm((v) => !v)}
                >
                  <PlusCircle className="w-3 h-3 mr-1" /> New Allocation
                </Button>
              </div>
            </div>

            {estimatorError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0" /> {estimatorError}
              </div>
            )}

            {/* New allocation form */}
            {showNewAllocForm && (
              <Card className="bg-slate-900/60 border-purple-500/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Layers className="w-4 h-4 text-purple-400" /> New Warehouse → Shop Allocation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 uppercase tracking-wide">Allocation #</label>
                      <Input
                        value={newAllocForm.allocationNumber}
                        onChange={(e) => setNewAllocForm((f) => ({ ...f, allocationNumber: e.target.value }))}
                        placeholder="WH-DAR-2026-001"
                        className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 uppercase tracking-wide">Currency</label>
                      <Input
                        value={newAllocForm.currency}
                        onChange={(e) => setNewAllocForm((f) => ({ ...f, currency: e.target.value }))}
                        placeholder="TZS"
                        className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 uppercase tracking-wide">Warehouse</label>
                      <Input
                        value={newAllocForm.warehouseName}
                        onChange={(e) => setNewAllocForm((f) => ({ ...f, warehouseName: e.target.value }))}
                        placeholder="Main Warehouse Dar"
                        className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 uppercase tracking-wide">Shop</label>
                      <Input
                        value={newAllocForm.shopName}
                        onChange={(e) => setNewAllocForm((f) => ({ ...f, shopName: e.target.value }))}
                        placeholder="Shop Kariakoo"
                        className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 uppercase tracking-wide">Total Value</label>
                      <Input
                        type="number"
                        value={newAllocForm.totalValue}
                        onChange={(e) => setNewAllocForm((f) => ({ ...f, totalValue: e.target.value }))}
                        placeholder="20000000"
                        className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 uppercase tracking-wide">Total Pieces</label>
                      <Input
                        type="number"
                        value={newAllocForm.totalPieces}
                        onChange={(e) => setNewAllocForm((f) => ({ ...f, totalPieces: e.target.value }))}
                        placeholder="1000"
                        className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-xs"
                      />
                    </div>
                  </div>
                  {newAllocForm.totalValue && newAllocForm.totalPieces && (
                    <div className="text-[10px] text-purple-400 bg-purple-500/5 border border-purple-500/20 rounded px-3 py-2">
                      Avg piece value ≈ {fmt(
                        parseFloat(newAllocForm.totalValue) / parseInt(newAllocForm.totalPieces || '1', 10),
                        newAllocForm.currency,
                      )}
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-500 text-white text-xs"
                      onClick={handleCreateAllocation}
                      disabled={estimatorBusy}
                    >
                      Create Allocation
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
                      onClick={() => setShowNewAllocForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Allocation list */}
              <Card className="bg-slate-900/60 border-slate-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Allocations</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[380px]">
                    {allocations.length === 0 ? (
                      <div className="text-center text-xs text-slate-500 py-10 px-4">
                        <Layers className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        No allocations yet. Create one to start estimating.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-800">
                        {allocations.map((a) => (
                          <button
                            key={a.id}
                            onClick={() => { setSelectedAlloc(a); setEstimateResult(null); setSalesInput(''); setPhysicalInput(''); }}
                            className={`w-full text-left px-4 py-3 hover:bg-slate-800/60 transition-colors flex items-center gap-2 ${selectedAlloc?.id === a.id ? 'bg-purple-500/10 border-l-2 border-purple-500' : ''}`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-slate-200 truncate">{a.allocationNumber}</div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {a.warehouseName ?? '—'} → {a.shopName ?? '—'}
                              </div>
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                {a.totalPieces.toLocaleString()} pcs · {fmt(a.totalValue, a.currency)}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <Badge
                                variant="outline"
                                className={
                                  a.status === 'OPEN'
                                    ? 'bg-green-500/10 text-green-400 border-green-500/20 text-[9px]'
                                    : a.status === 'RECONCILED'
                                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 text-[9px]'
                                    : 'bg-slate-500/10 text-slate-400 border-slate-500/20 text-[9px]'
                                }
                              >
                                {a.status}
                              </Badge>
                              <ChevronRight className="w-3 h-3 text-slate-600" />
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Estimate panel */}
              <div className="lg:col-span-2 space-y-4">
                {!selectedAlloc ? (
                  <Card className="bg-slate-900/60 border-slate-800 h-full flex items-center justify-center">
                    <CardContent className="text-center py-16">
                      <TrendingUp className="w-10 h-10 mx-auto mb-3 text-slate-600" />
                      <p className="text-xs text-slate-500">Select an allocation to calculate estimated stock</p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {/* Allocation summary */}
                    <Card className="bg-slate-900/60 border-slate-800">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium">{selectedAlloc.allocationNumber}</CardTitle>
                          <Badge
                            variant="outline"
                            className={
                              selectedAlloc.status === 'OPEN'
                                ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            }
                          >
                            {selectedAlloc.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { label: 'Allocation Value', value: fmt(selectedAlloc.totalValue, selectedAlloc.currency) },
                            { label: 'Total Pieces', value: selectedAlloc.totalPieces.toLocaleString() + ' pcs' },
                            { label: 'Avg / Piece', value: fmt(selectedAlloc.averagePieceValue, selectedAlloc.currency) },
                          ].map(({ label, value }) => (
                            <div key={label} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                              <div className="text-[10px] text-slate-400 mb-1">{label}</div>
                              <div className="text-sm font-semibold text-slate-100">{value}</div>
                            </div>
                          ))}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-2">
                          {selectedAlloc.warehouseName ?? 'Warehouse'} → {selectedAlloc.shopName ?? 'Shop'}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Calculate estimate */}
                    <Card className="bg-slate-900/60 border-slate-800">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-purple-400" /> Calculate Estimated Stock
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex gap-2">
                          <div className="flex-1 space-y-1">
                            <label className="text-[10px] text-slate-400 uppercase tracking-wide">
                              Cumulative Sales Value ({selectedAlloc.currency})
                            </label>
                            <Input
                              type="number"
                              value={salesInput}
                              onChange={(e) => setSalesInput(e.target.value)}
                              placeholder="e.g. 5000000"
                              className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-xs"
                            />
                          </div>
                          <div className="flex items-end">
                            <Button
                              size="sm"
                              className="h-8 bg-purple-600 hover:bg-purple-500 text-white text-xs"
                              onClick={handleCalculateEstimate}
                              disabled={estimatorBusy || !salesInput}
                            >
                              Calculate
                            </Button>
                          </div>
                        </div>

                        {estimateResult && estimateResult.allocationId === selectedAlloc.id && (
                          <div className="space-y-3 pt-1">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                                <div className="text-[10px] text-slate-400 mb-1">Est. Sold</div>
                                <div className="text-lg font-bold text-orange-400">
                                  {Math.round(estimateResult.estimatedSoldPieces).toLocaleString()} pcs
                                </div>
                              </div>
                              <div className={`p-3 rounded-lg border ${
                                estimateResult.estimatedRemainingPieces <= 0
                                  ? 'bg-red-500/5 border-red-500/20'
                                  : 'bg-green-500/5 border-green-500/20'
                              }`}>
                                <div className="text-[10px] text-slate-400 mb-1">Est. Remaining</div>
                                <div className={`text-lg font-bold ${
                                  estimateResult.estimatedRemainingPieces <= 0 ? 'text-red-400' : 'text-green-400'
                                }`}>
                                  {Math.round(estimateResult.estimatedRemainingPieces).toLocaleString()} pcs
                                </div>
                              </div>
                            </div>

                            {/* Progress bar */}
                            <div>
                              <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                <span>Stock consumed</span>
                                <span>
                                  {Math.min(100, Math.round(
                                    (estimateResult.estimatedSoldPieces / estimateResult.totalPieces) * 100,
                                  ))}%
                                </span>
                              </div>
                              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                                <div
                                  className="h-full bg-purple-500 transition-all"
                                  style={{
                                    width: `${Math.min(100, (estimateResult.estimatedSoldPieces / estimateResult.totalPieces) * 100)}%`,
                                  }}
                                />
                              </div>
                            </div>

                            {/* Super profit */}
                            {estimateResult.superProfit > 0 && (
                              <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                                <TrendingUp className="w-5 h-5 text-yellow-400 shrink-0" />
                                <div>
                                  <div className="text-xs font-semibold text-yellow-400">Super Profit</div>
                                  <div className="text-[10px] text-slate-300">
                                    Sales exceeded allocation value by{' '}
                                    <span className="font-bold text-yellow-300">
                                      {fmt(estimateResult.superProfit, estimateResult.currency)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="text-[10px] text-slate-500 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Accuracy: ESTIMATE — based on value ratio, not item-level scan
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Physical reconciliation */}
                    {selectedAlloc.status !== 'RECONCILED' && (
                      <Card className="bg-slate-900/60 border-slate-800">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <CheckSquare className="w-4 h-4 text-blue-400" /> Physical Count Reconciliation
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex gap-2">
                            <div className="flex-1 space-y-1">
                              <label className="text-[10px] text-slate-400 uppercase tracking-wide">
                                Physical Count (pcs)
                              </label>
                              <Input
                                type="number"
                                value={physicalInput}
                                onChange={(e) => setPhysicalInput(e.target.value)}
                                placeholder="e.g. 720"
                                className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-xs"
                              />
                            </div>
                            <div className="flex items-end">
                              <Button
                                size="sm"
                                className="h-8 bg-blue-600 hover:bg-blue-500 text-white text-xs"
                                onClick={handleReconcile}
                                disabled={estimatorBusy || !physicalInput}
                              >
                                Reconcile
                              </Button>
                            </div>
                          </div>
                          {estimateResult && physicalInput && (
                            <div className="text-[10px] text-slate-400 bg-slate-800/50 rounded px-3 py-2 space-y-1">
                              <div className="flex justify-between">
                                <span>Estimated remaining</span>
                                <span className="text-slate-200">{Math.round(estimateResult.estimatedRemainingPieces)} pcs</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Physical count</span>
                                <span className="text-slate-200">{physicalInput} pcs</span>
                              </div>
                              <div className="flex justify-between border-t border-slate-700 pt-1 mt-1">
                                <span>Variance</span>
                                <span className={
                                  estimateResult.estimatedRemainingPieces - parseFloat(physicalInput) > 0
                                    ? 'text-red-400'
                                    : estimateResult.estimatedRemainingPieces - parseFloat(physicalInput) < 0
                                    ? 'text-green-400'
                                    : 'text-slate-400'
                                }>
                                  {Math.round(estimateResult.estimatedRemainingPieces - parseFloat(physicalInput))} pcs
                                  {estimateResult.estimatedRemainingPieces - parseFloat(physicalInput) > 0
                                    ? ' (shrinkage)'
                                    : estimateResult.estimatedRemainingPieces - parseFloat(physicalInput) < 0
                                    ? ' (surplus)'
                                    : ''}
                                </span>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {selectedAlloc.status === 'RECONCILED' && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400">
                        <CheckSquare className="w-4 h-4 shrink-0" />
                        This allocation has been reconciled.
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
