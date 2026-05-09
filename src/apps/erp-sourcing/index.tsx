import { useState } from 'react';
import {
  Globe, Truck, Plus, Search, Eye, Trash2, FileText,
  Star,
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
  const [pos] = useState(initialPOs);
  const [search, setSearch] = useState('');
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [poModalOpen, setPoModalOpen] = useState(false);
  const [poDetail, setPoDetail] = useState<typeof initialPOs[0] | null>(null);
  const [supplierForm, setSupplierForm] = useState({ name: '', contact: '', phone: '', country: '', rating: 4 });
  const [poForm, setPoForm] = useState({ supplier: '', items: [{ name: '', qty: 1, price: 0 }] });

  const filteredSuppliers = suppliers.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  const addSupplier = () => {
    const newId = Math.max(...suppliers.map((s) => s.id), 0) + 1;
    setSuppliers((prev) => [...prev, { id: newId, ...supplierForm, status: 'Active' }]);
    setSupplierModalOpen(false);
    setSupplierForm({ name: '', contact: '', phone: '', country: '', rating: 4 });
  };

  const poTotal = poForm.items.reduce((s, i) => s + i.qty * i.price, 0);

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
            </TabsList>
          </Tabs>
        </div>

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
              <select
                value={poForm.supplier}
                onChange={(e) => setPoForm((f) => ({ ...f, supplier: e.target.value }))}
                className="w-full h-9 px-2 rounded-md bg-slate-800 border border-slate-700 text-xs text-slate-300"
              >
                <option value="">Select supplier</option>
                {suppliers.filter((s) => s.status === 'Active').map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
              <div className="space-y-2">
                {poForm.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2">
                    <div className="col-span-5">
                      <Input placeholder="Item name" value={item.name} onChange={(e) => { const items = [...poForm.items]; items[idx].name = e.target.value; setPoForm((f) => ({ ...f, items })); }} className="h-8 bg-slate-800 border-slate-700 text-xs" />
                    </div>
                    <div className="col-span-3">
                      <Input type="number" placeholder="Qty" value={item.qty} onChange={(e) => { const items = [...poForm.items]; items[idx].qty = Number(e.target.value); setPoForm((f) => ({ ...f, items })); }} className="h-8 bg-slate-800 border-slate-700 text-xs" />
                    </div>
                    <div className="col-span-3">
                      <Input type="number" placeholder="Price" value={item.price} onChange={(e) => { const items = [...poForm.items]; items[idx].price = Number(e.target.value); setPoForm((f) => ({ ...f, items })); }} className="h-8 bg-slate-800 border-slate-700 text-xs" />
                    </div>
                    <div className="col-span-1">
                      <button onClick={() => setPoForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))} className="text-slate-500 hover:text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" onClick={() => setPoForm((f) => ({ ...f, items: [...f.items, { name: '', qty: 1, price: 0 }] }))} className="w-full border-slate-700 text-slate-300 hover:bg-slate-800 text-xs">
                  <Plus className="w-3 h-3 mr-1" /> Add Item
                </Button>
              </div>
              <div className="flex justify-between text-xs pt-2">
                <span className="text-slate-400">Total</span>
                <span className="font-bold text-slate-200">{tzs(poTotal)}</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setPoModalOpen(false)} className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800">Cancel</Button>
                <Button onClick={() => setPoModalOpen(false)} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white">Create PO</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
