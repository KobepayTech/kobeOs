import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  Globe, Truck, Plus, Search, Eye, Trash2, FileText,
  Star, Wallet, ArrowRight, Loader2, CheckCircle2, Package,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const tzs = (n: number) => `TZS ${n.toLocaleString()}`;

const initialSuppliers = [
  { id: 1, name: 'China Electronics Ltd', contact: 'Liu Wei', phone: '+86 138 0013 8000', country: 'China', rating: 4.5, status: 'Active' },
  { id: 2, name: 'Mumbai Textiles Co', contact: 'Rajesh Patel', phone: '+91 22 2456 7890', country: 'India', rating: 4.0, status: 'Active' },
  { id: 3, name: 'Nairobi Grain Millers', contact: 'James Oduor', phone: '+254 722 123456', country: 'Kenya', rating: 4.8, status: 'Active' },
  { id: 4, name: 'Dar Hardware Suppliers', contact: 'Amina Hassan', phone: '+255 713 456789', country: 'Tanzania', rating: 3.5, status: 'Inactive' },
  { id: 5, name: 'Dubai Trade Hub', contact: 'Faisal Al-Rashid', phone: '+971 4 555 0123', country: 'UAE', rating: 4.2, status: 'Active' },
  { id: 6, name: 'Kampala Packaging', contact: 'Grace Namuli', phone: '+256 772 987654', country: 'Uganda', rating: 3.8, status: 'Active' },
];

const initialPOs = [
  { id: 'PO-2026-0101', supplier: 'China Electronics Ltd', total: 2800000, status: 'Delivered', date: '2026-04-15', items: [{ name: 'Samsung Galaxy A14', qty: 20, price: 280000 }, { name: 'Earbuds Wireless', qty: 50, price: 15000 }], deliveryDate: '2026-05-02' },
  { id: 'PO-2026-0102', supplier: 'Mumbai Textiles Co', total: 950000, status: 'In Transit', date: '2026-04-22', items: [{ name: "Men's Cotton T-Shirt", qty: 100, price: 4500 }, { name: 'Kitenge Dress', qty: 40, price: 12500 }], deliveryDate: '2026-05-15' },
  { id: 'PO-2026-0103', supplier: 'Nairobi Grain Millers', total: 620000, status: 'Delivered', date: '2026-04-10', items: [{ name: 'Rice 25kg Bulk', qty: 30, price: 14000 }, { name: 'Wheat Flour 25kg', qty: 20, price: 11000 }], deliveryDate: '2026-04-20' },
  { id: 'PO-2026-0104', supplier: 'Dubai Trade Hub', total: 1200000, status: 'Pending', date: '2026-05-05', items: [{ name: 'Solar Panel 250W', qty: 10, price: 120000 }], deliveryDate: '2026-06-01' },
  { id: 'PO-2026-0105', supplier: 'Kampala Packaging', total: 340000, status: 'In Transit', date: '2026-05-01', items: [{ name: 'Carton Boxes (100)', qty: 50, price: 6800 }], deliveryDate: '2026-05-20' },
  { id: 'PO-2026-0106', supplier: 'China Electronics Ltd', total: 450000, status: 'Pending', date: '2026-05-06', items: [{ name: 'PowerBank 20k mAh', qty: 30, price: 15000 }], deliveryDate: '2026-05-25' },
  { id: 'PO-2026-0107', supplier: 'Dar Hardware Suppliers', total: 850000, status: 'Cancelled', date: '2026-04-28', items: [{ name: 'Borehole Pump 2HP', qty: 5, price: 170000 }], deliveryDate: '2026-05-10' },
  { id: 'PO-2026-0108', supplier: 'Nairobi Grain Millers', total: 480000, status: 'Pending', date: '2026-05-07', items: [{ name: 'Sunflower Oil 20L', qty: 30, price: 16000 }], deliveryDate: '2026-05-28' },
  { id: 'PO-2026-0109', supplier: 'Mumbai Textiles Co', total: 720000, status: 'Delivered', date: '2026-03-20', items: [{ name: 'School Uniform Set', qty: 60, price: 12000 }], deliveryDate: '2026-04-05' },
  { id: 'PO-2026-0110', supplier: 'Dubai Trade Hub', total: 950000, status: 'In Transit', date: '2026-05-03', items: [{ name: 'LED Floodlight 100W', qty: 25, price: 38000 }], deliveryDate: '2026-05-18' },
];

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    Delivered: 'bg-green-500/10 text-green-400 border-green-500/20',
    'In Transit': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    Pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    Cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
    Active: 'bg-green-500/10 text-green-400 border-green-500/20',
    Inactive: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  };
  return map[status] || 'bg-slate-500/10 text-slate-400';
};

export default function ERPSourcing() {
  const [tab, setTab] = useState('suppliers');
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [pos, setPos] = useState(initialPOs);
  const [liveSummary, setLiveSummary] = useState<{ suppliers: number; totalItems: number; lowStock: number; totalValue: number } | null>(null);
  const [lowStockItems, setLowStockItems] = useState<{ id: string; name: string; sku: string; quantity: number; reorderLevel: number }[]>([]);

  useEffect(() => {
    api<{ summary: typeof liveSummary; suppliers: typeof initialSuppliers; lowStockItems: typeof lowStockItems }>('/erp/sourcing')
      .then(d => {
        if (d.suppliers?.length) setSuppliers(d.suppliers as typeof initialSuppliers);
        if (d.summary) setLiveSummary(d.summary);
        if (d.lowStockItems) setLowStockItems(d.lowStockItems);
      })
      .catch(() => {});
  }, []);
  const [search, setSearch] = useState('');
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [poModalOpen, setPoModalOpen] = useState(false);
  const [poDetail, setPoDetail] = useState<typeof initialPOs[0] | null>(null);
  const [supplierForm, setSupplierForm] = useState({ name: '', contact: '', phone: '', country: '', rating: 4 });
  const [poForm, setPoForm] = useState<{
    supplier: string;
    transport: number;
    items: Array<{ name: string; qty: number; price: number; sellPrice: number }>;
  }>({
    supplier: '',
    transport: 0,
    items: [{ name: '', qty: 1, price: 0, sellPrice: 0 }],
  });

  const filteredSuppliers = suppliers.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  const addSupplier = async () => {
    if (!supplierForm.name.trim()) return;
    try {
      // Persist via the real backend so the supplier survives a reload.
      // Backend POST /erp/sourcing/suppliers already existed (see
      // erp.controller.ts) — this UI just wasn't calling it.
      await api('/erp/sourcing/suppliers', {
        method: 'POST',
        body: JSON.stringify({
          name: supplierForm.name.trim(),
          contact: supplierForm.contact,
          phone: supplierForm.phone,
          country: supplierForm.country,
        }),
      });
    } catch (err) {
      // Network/offline — fall back to local insert so the form doesn't
      // dead-end. The list will reconcile on the next /erp/sourcing fetch.
      console.warn('[sourcing] supplier persist failed, keeping local entry only:', (err as Error).message);
    }
    const newId = Math.max(...suppliers.map((s) => s.id), 0) + 1;
    setSuppliers((prev) => [...prev, { id: newId, ...supplierForm, status: 'Active' }]);
    setSupplierModalOpen(false);
    setSupplierForm({ name: '', contact: '', phone: '', country: '', rating: 4 });
  };

  // Roll-up for the PO form: transport is allocated per-unit so a
  // line's cost reflects "buying price + freight share" — i.e. the
  // landed unit cost the operator actually sells against. Net profit
  // across the whole PO comes out the same as if we just subtracted
  // transport at the end; doing it per-unit makes per-line profit
  // honest, which is what the operator cares about while editing.
  const poCalc = (() => {
    const transport = Number(poForm.transport) || 0;
    const totalQty = poForm.items.reduce((s, it) => s + (Number(it.qty) || 0), 0);
    const freightPerUnit = totalQty > 0 ? transport / totalQty : 0;
    const lines = poForm.items.map((it) => {
      const qty = Number(it.qty) || 0;
      const price = Number(it.price) || 0;
      const sellPrice = Number(it.sellPrice) || 0;
      const landedUnit = price + freightPerUnit;
      const freight = qty * freightPerUnit;
      const cost = qty * landedUnit; // goods + freight share
      const revenue = qty * sellPrice;
      const profit = revenue - cost;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      return { ...it, landedUnit, freight, cost, revenue, profit, margin };
    });
    const goodsTotal   = lines.reduce((s, l) => s + l.qty * l.price, 0);
    const costTotal    = lines.reduce((s, l) => s + l.cost, 0); // includes transport
    const revenueTotal = lines.reduce((s, l) => s + l.revenue, 0);
    const netProfit    = revenueTotal - costTotal;
    const netMargin    = revenueTotal > 0 ? (netProfit / revenueTotal) * 100 : 0;
    return { lines, goodsTotal, costTotal, revenueTotal, transport, freightPerUnit, totalQty, landedCost: costTotal, netProfit, netMargin };
  })();
  const poTotal = poCalc.landedCost;

  // Persist a purchase order via /erp/supplier-capital/purchase-orders.
  // Previously the "Create PO" button only closed the modal — the form
  // looked functional but nothing was ever saved. Falls back to a local
  // insert when offline so the operator's keystrokes aren't lost.
  const createPO = async () => {
    if (!poForm.supplier || poForm.items.length === 0 || poCalc.costTotal <= 0) return;
    const supplierMatch = suppliers.find((s) => s.name === poForm.supplier);
    const poNumber = `PO-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const isUuid = supplierMatch && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(supplierMatch.id));
    if (isUuid) {
      try {
        // Backend DTO doesn't yet have columns for sellPrice / transport;
        // pack them into notes as kobeos-po-meta:<json> so a future
        // migration can grep + backfill into proper columns. Format
        // matches the mobile PO encoding so both clients round-trip
        // the same way.
        const meta = {
          transportCost: poCalc.transport,
          revenueTotal: poCalc.revenueTotal,
          netProfit: poCalc.netProfit,
          lines: poForm.items.map((l) => ({ name: l.name, qty: l.qty, price: l.price, sellPrice: l.sellPrice })),
        };
        const summary = `${poForm.items.length} line${poForm.items.length === 1 ? '' : 's'}: ${poForm.items.map((i) => `${i.name} x${i.qty}`).join(', ')}`;
        const notes = `kobeos-po-meta:${JSON.stringify(meta)}\n${summary}`.slice(0, 2000);
        await api('/erp/supplier-capital/purchase-orders', {
          method: 'POST',
          body: JSON.stringify({
            poNumber,
            supplierId: String(supplierMatch.id),
            // totalCny = landed cost (goods + transport) so accounting
            // sees the all-in figure, not just goods.
            totalCny: poCalc.landedCost,
            notes,
          }),
        });
      } catch (err) {
        console.warn('[sourcing] PO persist failed, keeping local entry only:', (err as Error).message);
      }
    }
    setPos((prev) => [
      {
        id: poNumber,
        supplier: poForm.supplier,
        total: poCalc.landedCost,
        status: 'Pending',
        date: new Date().toISOString().slice(0, 10),
        items: poForm.items,
        deliveryDate: '',
      },
      ...prev,
    ]);
    setPoModalOpen(false);
    setPoForm({ supplier: '', transport: 0, items: [{ name: '', qty: 1, price: 0, sellPrice: 0 }] });
  };

  return (
    <div className="h-full bg-slate-950 text-slate-100 overflow-auto">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-400" />
            <h1 className="text-lg font-semibold">Sourcing</h1>
          </div>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="bg-slate-900 border border-slate-800 h-9">
              <TabsTrigger value="suppliers" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <Truck className="w-3 h-3 mr-1" /> Suppliers
              </TabsTrigger>
              <TabsTrigger value="po" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <FileText className="w-3 h-3 mr-1" /> Purchase Orders
              </TabsTrigger>
              <TabsTrigger value="payments" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <Wallet className="w-3 h-3 mr-1" /> Payments
              </TabsTrigger>
              <TabsTrigger value="reorder" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <Package className="w-3 h-3 mr-1" /> Restock
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Live summary */}
        {liveSummary && (
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Categories', value: liveSummary.suppliers },
              { label: 'Total Items', value: liveSummary.totalItems },
              { label: 'Low Stock', value: liveSummary.lowStock },
              { label: 'Stock Value', value: `TZS ${(liveSummary.totalValue / 1000).toFixed(0)}K` },
            ].map(k => (
              <Card key={k.label} className="bg-slate-900/60 border-slate-800">
                <CardContent className="p-3">
                  <p className="text-[10px] text-slate-500">{k.label}</p>
                  <p className="text-base font-semibold text-slate-200">{k.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {tab === 'suppliers' && (
          <>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search suppliers..." className="pl-8 h-8 bg-slate-900 border-slate-700 text-xs" />
              </div>
              <Button size="sm" onClick={() => setSupplierModalOpen(true)} className="h-8 bg-blue-600 hover:bg-blue-500 text-white text-xs">
                <Plus className="w-3 h-3 mr-1" /> Add Supplier
              </Button>
            </div>
            <Card className="bg-slate-900/60 border-slate-800">
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-800 hover:bg-transparent">
                        <TableHead className="text-slate-400 text-xs">Supplier</TableHead>
                        <TableHead className="text-slate-400 text-xs">Contact</TableHead>
                        <TableHead className="text-slate-400 text-xs">Phone</TableHead>
                        <TableHead className="text-slate-400 text-xs">Country</TableHead>
                        <TableHead className="text-slate-400 text-xs">Rating</TableHead>
                        <TableHead className="text-slate-400 text-xs">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSuppliers.map((s) => (
                        <TableRow key={s.id} className="border-slate-800 hover:bg-slate-800/40">
                          <TableCell className="text-xs font-medium text-slate-200">{s.name}</TableCell>
                          <TableCell className="text-xs text-slate-300">{s.contact}</TableCell>
                          <TableCell className="text-xs text-slate-400">{s.phone}</TableCell>
                          <TableCell className="text-xs text-slate-300">{s.country}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Star className="w-3 h-3 text-yellow-400" />
                              <span className="text-xs text-slate-300">{s.rating}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statusBadge(s.status)}>
                              {s.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </>
        )}

        {tab === 'po' && (
          <>
            <div className="flex items-center justify-between">
              <div className="relative flex-1 max-w-xs">
                <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input placeholder="Search POs..." className="pl-8 h-8 bg-slate-900 border-slate-700 text-xs" />
              </div>
              <Button size="sm" onClick={() => setPoModalOpen(true)} className="h-8 bg-blue-600 hover:bg-blue-500 text-white text-xs">
                <Plus className="w-3 h-3 mr-1" /> Create PO
              </Button>
            </div>
            <Card className="bg-slate-900/60 border-slate-800">
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-800 hover:bg-transparent">
                        <TableHead className="text-slate-400 text-xs">PO Number</TableHead>
                        <TableHead className="text-slate-400 text-xs">Supplier</TableHead>
                        <TableHead className="text-slate-400 text-xs">Total</TableHead>
                        <TableHead className="text-slate-400 text-xs">Status</TableHead>
                        <TableHead className="text-slate-400 text-xs">Date</TableHead>
                        <TableHead className="text-slate-400 text-xs">Delivery</TableHead>
                        <TableHead className="text-slate-400 text-xs text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pos.map((po) => (
                        <TableRow key={po.id} className="border-slate-800 hover:bg-slate-800/40">
                          <TableCell className="text-xs font-mono text-slate-300">{po.id}</TableCell>
                          <TableCell className="text-xs text-slate-300">{po.supplier}</TableCell>
                          <TableCell className="text-xs font-medium">{tzs(po.total)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statusBadge(po.status)}>
                              {po.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-slate-400">{po.date}</TableCell>
                          <TableCell className="text-xs text-slate-400">{po.deliveryDate}</TableCell>
                          <TableCell className="text-right">
                            <button onClick={() => { setPoDetail(po); setPoModalOpen(true); }} className="text-slate-400 hover:text-blue-400">
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
          </>
        )}

        {tab === 'payments' && (
          <PaymentsTab suppliers={suppliers.map((s) => ({ id: String(s.id), name: s.name }))} />
        )}
        {tab === 'reorder' && <ReorderTab />}
      </div>

      <Dialog open={supplierModalOpen} onOpenChange={setSupplierModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Add Supplier</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Company name" value={supplierForm.name} onChange={(e) => setSupplierForm((f) => ({ ...f, name: e.target.value }))} className="bg-slate-800 border-slate-700 text-slate-100" />
            <Input placeholder="Contact person" value={supplierForm.contact} onChange={(e) => setSupplierForm((f) => ({ ...f, contact: e.target.value }))} className="bg-slate-800 border-slate-700 text-slate-100" />
            <Input placeholder="Phone" value={supplierForm.phone} onChange={(e) => setSupplierForm((f) => ({ ...f, phone: e.target.value }))} className="bg-slate-800 border-slate-700 text-slate-100" />
            <Input placeholder="Country" value={supplierForm.country} onChange={(e) => setSupplierForm((f) => ({ ...f, country: e.target.value }))} className="bg-slate-800 border-slate-700 text-slate-100" />
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setSupplierModalOpen(false)} className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800">Cancel</Button>
              <Button onClick={addSupplier} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white">Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={poModalOpen} onOpenChange={setPoModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">{poDetail ? 'Purchase Order Details' : 'Create Purchase Order'}</DialogTitle>
          </DialogHeader>
          {poDetail ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">PO Number</span>
                <span className="font-mono text-slate-200">{poDetail.id}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Supplier</span>
                <span className="text-slate-200">{poDetail.supplier}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Status</span>
                <Badge variant="outline" className={statusBadge(poDetail.status)}>{poDetail.status}</Badge>
              </div>
              <div className="border-t border-slate-800 pt-2 space-y-2">
                {poDetail.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-slate-300">{item.name} x{item.qty}</span>
                    <span className="text-slate-200">{tzs(item.price * item.qty)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-800 pt-2 flex justify-between text-sm font-bold">
                <span className="text-slate-200">Total</span>
                <span className="text-blue-400">{tzs(poDetail.total)}</span>
              </div>
              <Button onClick={() => setPoModalOpen(false)} className="w-full bg-blue-600 hover:bg-blue-500 text-white">Close</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <select
                  value={poForm.supplier}
                  onChange={(e) => setPoForm((f) => ({ ...f, supplier: e.target.value }))}
                  className="flex-1 h-9 px-2 rounded-md bg-slate-800 border border-slate-700 text-xs text-slate-300"
                >
                  <option value="">{suppliers.length === 0 ? 'No suppliers — click + to add' : 'Select supplier'}</option>
                  {suppliers.filter((s) => s.status === 'Active').map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    // Close the PO modal and open the supplier-add modal.
                    // The supplier modal already POSTs to the backend and
                    // updates the suppliers list — when the operator
                    // returns to the PO modal the new supplier is
                    // selectable in the dropdown.
                    setPoModalOpen(false);
                    setSupplierModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 h-9 px-3 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold whitespace-nowrap"
                  title="Add a new supplier"
                >
                  <Plus className="w-3 h-3" /> New
                </button>
              </div>
              <div className="space-y-1.5">
                <div className="grid grid-cols-12 gap-2 text-[9px] uppercase font-bold text-slate-500 tracking-wide px-1">
                  <div className="col-span-4">Item</div>
                  <div className="col-span-2 text-right">Qty</div>
                  <div className="col-span-2 text-right">Unit cost</div>
                  <div className="col-span-3 text-right">Sell @</div>
                  <div className="col-span-1" />
                </div>
                {poCalc.lines.map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-4">
                        <Input placeholder="Item name" value={item.name} onChange={(e) => { const items = [...poForm.items]; items[idx].name = e.target.value; setPoForm((f) => ({ ...f, items })); }} className="h-8 bg-slate-800 border-slate-700 text-xs" />
                      </div>
                      <div className="col-span-2">
                        <Input type="number" placeholder="0" value={item.qty || ''} onChange={(e) => { const items = [...poForm.items]; items[idx].qty = Number(e.target.value); setPoForm((f) => ({ ...f, items })); }} className="h-8 bg-slate-800 border-slate-700 text-xs text-right" />
                      </div>
                      <div className="col-span-2">
                        <Input type="number" placeholder="0" value={item.price || ''} onChange={(e) => { const items = [...poForm.items]; items[idx].price = Number(e.target.value); setPoForm((f) => ({ ...f, items })); }} className="h-8 bg-slate-800 border-slate-700 text-xs text-right" />
                      </div>
                      <div className="col-span-3">
                        <Input
                          type="number"
                          placeholder="0"
                          value={item.sellPrice || ''}
                          onChange={(e) => { const items = [...poForm.items]; items[idx].sellPrice = Number(e.target.value); setPoForm((f) => ({ ...f, items })); }}
                          className={`h-8 bg-slate-800 text-xs text-right ${
                            item.sellPrice > 0 && item.sellPrice < item.price ? 'border-rose-500/50'
                            : item.sellPrice > 0 ? 'border-emerald-500/40'
                            : 'border-slate-700'
                          }`}
                        />
                      </div>
                      <div className="col-span-1">
                        <button onClick={() => setPoForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))} className="text-slate-500 hover:text-red-400 h-8 flex items-center">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {item.qty > 0 && (item.price > 0 || item.sellPrice > 0) && (
                      <div
                        className="flex items-center justify-between text-[10px] px-1"
                        title={`Cost ${tzs(item.cost)} (goods + ${tzs(item.freight)} freight) · revenue ${tzs(item.revenue)}`}
                      >
                        <span className="text-slate-500">
                          Landed <span className="font-bold text-slate-300">{tzs(item.landedUnit)}</span>/unit · Sale {tzs(item.revenue)}
                        </span>
                        <span className={`font-bold px-1.5 py-0.5 rounded ${
                          item.profit > 0 ? 'bg-emerald-500/15 text-emerald-300'
                          : item.profit < 0 ? 'bg-rose-500/15 text-rose-300'
                          : 'bg-slate-700/40 text-slate-400'
                        }`}>
                          {item.profit >= 0 ? '+' : ''}{tzs(item.profit)}
                          {item.revenue > 0 && ` (${((item.profit / item.revenue) * 100).toFixed(1)}%)`}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
                <Button variant="outline" onClick={() => setPoForm((f) => ({ ...f, items: [...f.items, { name: '', qty: 1, price: 0, sellPrice: 0 }] }))} className="w-full border-slate-700 text-slate-300 hover:bg-slate-800 text-xs">
                  <Plus className="w-3 h-3 mr-1" /> Add Item
                </Button>
              </div>

              {/* Transport / freight — one entry per PO, allocated per unit. */}
              <div className="grid grid-cols-2 gap-2 items-end pt-2 border-t border-slate-800">
                <label className="text-xs text-slate-400">
                  Transport / freight
                  <Input
                    type="number"
                    placeholder="0"
                    value={poForm.transport || ''}
                    onChange={(e) => setPoForm((f) => ({ ...f, transport: Number(e.target.value) || 0 }))}
                    className="h-8 bg-slate-800 border-slate-700 text-xs text-right mt-0.5"
                  />
                  {poCalc.transport > 0 && poCalc.totalQty > 0 && (
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {tzs(poCalc.freightPerUnit)}/unit across {poCalc.totalQty}
                    </p>
                  )}
                </label>
                <div className="text-right text-[11px] text-slate-400">
                  Goods <span className="font-bold text-slate-200">{tzs(poCalc.goodsTotal)}</span>
                  <br />
                  Landed <span className="font-bold text-slate-200">{tzs(poCalc.costTotal)}</span>
                </div>
              </div>

              {/* Roll-up profit summary. */}
              <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-800 bg-slate-900/40 p-2">
                <div>
                  <div className="text-[9px] uppercase tracking-wide text-slate-500 font-bold">Landed cost</div>
                  <div className="text-sm font-extrabold text-slate-200">{tzs(poCalc.landedCost)}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wide text-indigo-400 font-bold">Revenue</div>
                  <div className="text-sm font-extrabold text-indigo-300">{tzs(poCalc.revenueTotal)}</div>
                </div>
                <div>
                  <div className={`text-[9px] uppercase tracking-wide font-bold ${
                    poCalc.netProfit > 0 ? 'text-emerald-400'
                    : poCalc.netProfit < 0 ? 'text-rose-400'
                    : 'text-slate-500'
                  }`}>Profit</div>
                  <div className={`text-sm font-extrabold ${
                    poCalc.netProfit > 0 ? 'text-emerald-300'
                    : poCalc.netProfit < 0 ? 'text-rose-300'
                    : 'text-slate-300'
                  }`}>
                    {tzs(poCalc.netProfit)}
                    {poCalc.revenueTotal > 0 && <span className="text-[10px] ml-1">({poCalc.netMargin.toFixed(1)}%)</span>}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setPoModalOpen(false)} className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800">Cancel</Button>
                <Button
                  onClick={createPO}
                  disabled={!poForm.supplier || poCalc.costTotal <= 0 || poForm.items.some((i) => !i.name.trim())}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40"
                >
                  Create PO · {tzs(poCalc.landedCost)}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─────────────────────────── Payments tab ────────────────────────────
 * Lists supplier payments recorded against this owner — primarily
 * those created from the KobePay reconciliation modal (kind=PO_PAYMENT
 * or NEW_GOODS or GENERAL). Each NEW_GOODS row gets a "Promote to PO"
 * button that calls the backend method to turn the snapshot into a
 * formal PurchaseOrder.
 */

interface SupplierPaymentRow {
  id: string;
  supplierId: string;
  supplierName: string;
  amount: number | string;
  currency: string;
  kind: 'PO_PAYMENT' | 'NEW_GOODS' | 'GENERAL';
  purchaseOrderId?: string | null;
  payoutId?: string | null;
  itemsSnapshot?: Array<{ description: string; quantity: number; unitPrice?: number }> | null;
  notes?: string;
  paidAt?: string | null;
  createdAt?: string;
}

interface SupplierLite { id: string; name: string }

function PaymentsTab({ suppliers }: { suppliers: SupplierLite[] }) {
  const [activeSupplierId, setActiveSupplierId] = useState<string>('');
  const [payments, setPayments] = useState<SupplierPaymentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [promoting, setPromoting] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);

  /** A row is eligible for promotion when it's a NEW_GOODS payment that
   *  isn't already linked to a PO and has an item snapshot. Mirrors the
   *  backend's refusal conditions so the checkboxes only appear where
   *  the action would actually succeed. */
  const eligible = (p: SupplierPaymentRow) =>
    p.kind === 'NEW_GOODS' && !p.purchaseOrderId && (p.itemsSnapshot?.length ?? 0) > 0;

  // Default to the first supplier so the tab isn't empty on open.
  useEffect(() => {
    if (!activeSupplierId && suppliers.length > 0) {
      setActiveSupplierId(suppliers[0].id);
    }
  }, [suppliers, activeSupplierId]);

  useEffect(() => {
    if (!activeSupplierId) return;
    let cancelled = false;
    setLoading(true);
    setErr(null);
    setSelected(new Set());     // reset selection when supplier changes
    api<SupplierPaymentRow[]>(`/erp/sourcing/suppliers/${activeSupplierId}/payments`)
      .then((rows) => { if (!cancelled) setPayments(Array.isArray(rows) ? rows : []); })
      .catch((e) => { if (!cancelled) setErr((e as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeSupplierId]);

  const eligibleRows = payments.filter(eligible);
  const allSelected = eligibleRows.length > 0 && eligibleRows.every((r) => selected.has(r.id));

  const toggleOne = (id: string, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  };
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(eligibleRows.map((r) => r.id)));
  };

  const bulkPromote = async () => {
    if (selected.size === 0) return;
    setBulkRunning(true);
    setErr(null);
    try {
      const results = await api<Array<{ paymentId: string; ok: boolean; created?: boolean; po?: { poNumber: string }; error?: string }>>(
        '/erp/sourcing/supplier-payments/promote-to-po/bulk',
        { method: 'POST', body: JSON.stringify({ paymentIds: Array.from(selected) }) },
      );
      const created = results.filter((r) => r.ok && r.created).length;
      const already = results.filter((r) => r.ok && !r.created).length;
      const failed = results.filter((r) => !r.ok).length;
      const parts = [
        created > 0 && `created ${created}`,
        already > 0 && `${already} already linked`,
        failed > 0 && `${failed} failed`,
      ].filter(Boolean);
      setToast(`Bulk promote — ${parts.join(', ')}`);
      setTimeout(() => setToast(null), 4500);
      setSelected(new Set());
      await reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBulkRunning(false);
    }
  };

  const reload = async () => {
    if (!activeSupplierId) return;
    try {
      const rows = await api<SupplierPaymentRow[]>(`/erp/sourcing/suppliers/${activeSupplierId}/payments`);
      setPayments(Array.isArray(rows) ? rows : []);
    } catch (e) { setErr((e as Error).message); }
  };

  const promote = async (payment: SupplierPaymentRow) => {
    setPromoting((p) => ({ ...p, [payment.id]: true }));
    setErr(null);
    try {
      const res = await api<{ payment: SupplierPaymentRow; po: { poNumber: string }; created: boolean }>(
        `/erp/sourcing/supplier-payments/${payment.id}/promote-to-po`,
        { method: 'POST', body: '{}' },
      );
      setToast(res.created ? `Created ${res.po.poNumber}` : `Already linked to ${res.po.poNumber}`);
      setTimeout(() => setToast(null), 3500);
      await reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setPromoting((p) => ({ ...p, [payment.id]: false }));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-slate-200">Supplier payments</span>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <Button
              size="sm"
              onClick={bulkPromote}
              disabled={bulkRunning}
              className="h-8 bg-amber-500 hover:bg-amber-400 text-amber-950 text-xs font-bold"
            >
              {bulkRunning
                ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                : <ArrowRight className="w-3 h-3 mr-1" />}
              Promote {selected.size} to PO{selected.size === 1 ? '' : 's'}
            </Button>
          )}
          <select
            value={activeSupplierId}
            onChange={(e) => setActiveSupplierId(e.target.value)}
            className="h-8 px-2 rounded bg-slate-900 border border-slate-700 text-xs text-slate-200"
          >
            <option value="">— pick a supplier —</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {err && (
        <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded p-2">
          {err}
        </div>
      )}
      {toast && (
        <div className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded p-2 inline-flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5" /> {toast}
        </div>
      )}

      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" /> Loading…
            </div>
          ) : payments.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs italic">
              {activeSupplierId
                ? 'No payments recorded for this supplier yet. They appear here automatically when you reconcile a KobePay payout against this supplier\'s phone number.'
                : 'Pick a supplier above to see payments.'}
            </div>
          ) : (
            <ScrollArea className="h-[420px]">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800">
                    <TableHead className="w-8 text-center">
                      {eligibleRows.length > 0 && (
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleAll}
                          className="accent-amber-500"
                          title="Select all NEW_GOODS rows"
                        />
                      )}
                    </TableHead>
                    <TableHead className="text-slate-400 text-xs">Date</TableHead>
                    <TableHead className="text-slate-400 text-xs">Type</TableHead>
                    <TableHead className="text-slate-400 text-xs text-right">Amount</TableHead>
                    <TableHead className="text-slate-400 text-xs">Linked to</TableHead>
                    <TableHead className="text-slate-400 text-xs">Notes</TableHead>
                    <TableHead className="text-slate-400 text-xs text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => {
                    const items = p.itemsSnapshot ?? [];
                    const itemSummary = items.length === 0
                      ? '—'
                      : items.map((l) => `${l.quantity}× ${l.description}`).join(', ');
                    const canPromote = eligible(p);
                    return (
                      <TableRow key={p.id} className={`border-slate-800 hover:bg-slate-800/30 ${selected.has(p.id) ? 'bg-amber-500/[0.05]' : ''}`}>
                        <TableCell className="text-center">
                          {canPromote && (
                            <input
                              type="checkbox"
                              checked={selected.has(p.id)}
                              onChange={(e) => toggleOne(p.id, e.target.checked)}
                              className="accent-amber-500"
                              disabled={!!promoting[p.id] || bulkRunning}
                            />
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-slate-300">
                          {new Date(p.paidAt ?? p.createdAt ?? Date.now()).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className={
                            p.kind === 'PO_PAYMENT' ? 'border-emerald-500/40 text-emerald-300' :
                            p.kind === 'NEW_GOODS'  ? 'border-amber-500/40 text-amber-300'   :
                                                      'border-slate-500/40 text-slate-300'
                          }>
                            {p.kind === 'PO_PAYMENT' ? 'PO payment' : p.kind === 'NEW_GOODS' ? 'New goods' : 'General'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-right font-bold text-slate-200">
                          {p.currency} {Math.round(Number(p.amount)).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs text-slate-400 max-w-[200px] truncate" title={itemSummary}>
                          {p.purchaseOrderId
                            ? <span className="inline-flex items-center gap-1 text-emerald-300"><FileText className="w-3 h-3" /> PO linked</span>
                            : items.length > 0
                              ? <span className="inline-flex items-center gap-1"><Package className="w-3 h-3" /> {items.length} item{items.length === 1 ? '' : 's'}</span>
                              : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-slate-400 max-w-[180px] truncate" title={p.notes}>
                          {p.notes || '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {canPromote && (
                            <Button
                              size="sm"
                              onClick={() => promote(p)}
                              disabled={!!promoting[p.id] || bulkRunning}
                              className="h-7 bg-amber-500 hover:bg-amber-400 text-amber-950 text-[10px] font-bold"
                            >
                              {promoting[p.id]
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <><ArrowRight className="w-3 h-3 mr-1" /> Promote to PO</>}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─────────────────────────── Reorder tab ────────────────────────────
 * Surfaces SKUs that need restocking based on the last 30 days of POS
 * sales velocity, current stock, and a typical 14-day lead time.
 * Operator can tweak the window / lead time and tap "Draft PO" on
 * the urgent rows to pre-fill the existing PO creator.
 */

interface ReorderSuggestion {
  productId: string;
  sku: string;
  name: string;
  stock: number;
  unit: string;
  velocity: number;
  unitsSoldInWindow: number;
  daysOfCover: number | null;
  reorderByIso: string | null;
  suggestedReorderQty: number;
  urgency: 'CRITICAL' | 'URGENT' | 'SOON' | 'OK' | 'NO_SALES';
}

function ReorderTab() {
  const [rows, setRows] = useState<ReorderSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState(30);
  const [leadTimeDays, setLeadTimeDays] = useState(14);
  const [hideOk, setHideOk] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    api<ReorderSuggestion[]>(`/pos/reorder-suggestions?windowDays=${windowDays}&leadTimeDays=${leadTimeDays}`)
      .then((r) => { if (!cancelled && Array.isArray(r)) setRows(r); })
      .catch((e) => { if (!cancelled) setErr((e as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [windowDays, leadTimeDays]);

  const visible = hideOk ? rows.filter((r) => r.urgency !== 'OK' && r.urgency !== 'NO_SALES') : rows;
  const counts = {
    CRITICAL: rows.filter((r) => r.urgency === 'CRITICAL').length,
    URGENT:   rows.filter((r) => r.urgency === 'URGENT').length,
    SOON:     rows.filter((r) => r.urgency === 'SOON').length,
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-slate-200">Restock suggestions</span>
          <div className="flex gap-1 text-[10px]">
            {counts.CRITICAL > 0 && <Badge variant="outline" className="border-rose-500/40 text-rose-300 h-5 px-1.5">{counts.CRITICAL} critical</Badge>}
            {counts.URGENT > 0   && <Badge variant="outline" className="border-amber-500/40 text-amber-300 h-5 px-1.5">{counts.URGENT} urgent</Badge>}
            {counts.SOON > 0     && <Badge variant="outline" className="border-blue-500/40 text-blue-300 h-5 px-1.5">{counts.SOON} soon</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <label className="text-slate-400">Window
            <select value={windowDays} onChange={(e) => setWindowDays(Number(e.target.value))} className="ml-1 h-7 px-2 rounded bg-slate-900 border border-slate-700 text-slate-200">
              <option value={7}>7d</option>
              <option value={14}>14d</option>
              <option value={30}>30d</option>
              <option value={60}>60d</option>
              <option value={90}>90d</option>
            </select>
          </label>
          <label className="text-slate-400">Lead time
            <select value={leadTimeDays} onChange={(e) => setLeadTimeDays(Number(e.target.value))} className="ml-1 h-7 px-2 rounded bg-slate-900 border border-slate-700 text-slate-200">
              <option value={3}>3d</option>
              <option value={7}>7d</option>
              <option value={14}>14d</option>
              <option value={21}>21d</option>
              <option value={30}>30d</option>
            </select>
          </label>
          <label className="text-slate-400 inline-flex items-center gap-1">
            <input type="checkbox" checked={hideOk} onChange={(e) => setHideOk(e.target.checked)} className="accent-amber-500" />
            Hide OK
          </label>
        </div>
      </div>

      {err && (
        <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded p-2">{err}</div>
      )}

      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" /> Crunching {windowDays}d of sales…
            </div>
          ) : visible.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs italic">
              {rows.length === 0
                ? 'No products on file yet — add some in POS first.'
                : 'Nothing urgent — every SKU has plenty of cover.'}
            </div>
          ) : (
            <ScrollArea className="h-[440px]">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800">
                    <TableHead className="text-slate-400 text-xs">SKU</TableHead>
                    <TableHead className="text-slate-400 text-xs">Name</TableHead>
                    <TableHead className="text-slate-400 text-xs text-right">Stock</TableHead>
                    <TableHead className="text-slate-400 text-xs text-right">Velocity</TableHead>
                    <TableHead className="text-slate-400 text-xs text-right">Cover</TableHead>
                    <TableHead className="text-slate-400 text-xs">Reorder by</TableHead>
                    <TableHead className="text-slate-400 text-xs text-right">Suggested</TableHead>
                    <TableHead className="text-slate-400 text-xs">Urgency</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((r) => (
                    <TableRow key={r.productId} className="border-slate-800 hover:bg-slate-800/30">
                      <TableCell className="text-xs text-slate-300 font-mono">{r.sku}</TableCell>
                      <TableCell className="text-xs font-bold">{r.name}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{r.stock} {r.unit !== 'piece' ? r.unit : ''}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{r.velocity}/d</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{r.daysOfCover != null ? `${r.daysOfCover}d` : '—'}</TableCell>
                      <TableCell className="text-xs text-slate-400">{r.reorderByIso ?? '—'}</TableCell>
                      <TableCell className="text-xs text-right font-bold tabular-nums">
                        {r.suggestedReorderQty > 0 ? `${r.suggestedReorderQty} ${r.unit !== 'piece' ? r.unit : ''}` : '—'}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className={
                          r.urgency === 'CRITICAL' ? 'border-rose-500/40 text-rose-300' :
                          r.urgency === 'URGENT'   ? 'border-amber-500/40 text-amber-300' :
                          r.urgency === 'SOON'     ? 'border-blue-500/40 text-blue-300' :
                          r.urgency === 'OK'       ? 'border-emerald-500/40 text-emerald-300' :
                                                     'border-slate-500/40 text-slate-400'
                        }>
                          {r.urgency.toLowerCase()}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
