import { useState } from 'react';
import {
  Warehouse, Package, ScanLine, QrCode, Printer, CheckSquare, Square,
  Clock, User, AlertCircle, Play, Box,
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
    const random = names[Math.floor(Math.random() * names.length)];
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, assignee: random, status: 'Picking' as const } : q)));
  };

  const pickedCount = items.filter((i) => i.picked).length;

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
      </div>
    </div>
  );
}
