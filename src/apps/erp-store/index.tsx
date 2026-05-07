import { useState, useMemo } from 'react';
import {
  Store, Search, Plus, Trash2, Package, ShoppingBag, Edit3, CheckSquare, Square,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

const tzs = (n: number) => `TZS ${n.toLocaleString()}`;

const initialProducts = [
  { id: 1, name: 'Samsung Galaxy A14', sku: 'ELEC-042', price: 450000, stock: 3, category: 'Electronics', image: 'bg-blue-600', status: 'Active' },
  { id: 2, name: 'Tecno Spark 10', sku: 'ELEC-051', price: 280000, stock: 12, category: 'Electronics', image: 'bg-indigo-600', status: 'Active' },
  { id: 3, name: 'Itel PowerBank 20k', sku: 'ELEC-033', price: 45000, stock: 25, category: 'Electronics', image: 'bg-cyan-600', status: 'Active' },
  { id: 4, name: "Men's Cotton T-Shirt", sku: 'CLTH-018', price: 15000, stock: 5, category: 'Clothing', image: 'bg-emerald-600', status: 'Active' },
  { id: 5, name: 'Kitenge Dress', sku: 'CLTH-022', price: 45000, stock: 8, category: 'Clothing', image: 'bg-green-600', status: 'Active' },
  { id: 6, name: 'Mama Ntilie Rice 5kg', sku: 'FOOD-033', price: 18000, stock: 4, category: 'Food', image: 'bg-amber-600', status: 'Active' },
  { id: 7, name: 'Sunflower Oil 3L', sku: 'FOOD-041', price: 22000, stock: 18, category: 'Food', image: 'bg-yellow-600', status: 'Active' },
  { id: 8, name: 'Sugar 2kg', sku: 'FOOD-012', price: 8500, stock: 30, category: 'Food', image: 'bg-orange-600', status: 'Active' },
  { id: 9, name: 'Borehole Pump 1HP', sku: 'HSHD-009', price: 320000, stock: 2, category: 'Household', image: 'bg-rose-600', status: 'Active' },
  { id: 10, name: 'Solar Panel 100W', sku: 'HSHD-015', price: 180000, stock: 7, category: 'Household', image: 'bg-pink-600', status: 'Active' },
  { id: 11, name: 'Plastic Chairs (4)', sku: 'HSHD-021', price: 85000, stock: 10, category: 'Household', image: 'bg-fuchsia-600', status: 'Active' },
  { id: 12, name: 'Mosquito Net Double', sku: 'HSHD-027', price: 25000, stock: 14, category: 'Household', image: 'bg-rose-700', status: 'Active' },
  { id: 13, name: 'LED Bulb 12W', sku: 'ELEC-019', price: 8000, stock: 40, category: 'Electronics', image: 'bg-blue-700', status: 'Active' },
  { id: 14, name: 'School Uniform Set', sku: 'CLTH-031', price: 32000, stock: 6, category: 'Clothing', image: 'bg-teal-600', status: 'Inactive' },
  { id: 15, name: 'Water Filter', sku: 'HSHD-035', price: 65000, stock: 9, category: 'Household', image: 'bg-pink-700', status: 'Active' },
];

const initialOrders = [
  { id: 'ORD-2026-1042', customer: 'Juma Bakari', items: 3, total: 125000, status: 'Completed', date: '2026-05-08' },
  { id: 'ORD-2026-1041', customer: 'Asha Mwangi', items: 1, total: 45000, status: 'Processing', date: '2026-05-08' },
  { id: 'ORD-2026-1040', customer: 'David Ochieng', items: 5, total: 230000, status: 'Pending', date: '2026-05-07' },
  { id: 'ORD-2026-1039', customer: 'Fatuma Said', items: 2, total: 78000, status: 'Completed', date: '2026-05-07' },
  { id: 'ORD-2026-1038', customer: 'Peter Njoroge', items: 4, total: 156000, status: 'Completed', date: '2026-05-07' },
  { id: 'ORD-2026-1037', customer: 'Grace Wambui', items: 1, total: 34000, status: 'Cancelled', date: '2026-05-06' },
  { id: 'ORD-2026-1036', customer: 'Omari Juma', items: 6, total: 210000, status: 'Completed', date: '2026-05-06' },
  { id: 'ORD-2026-1035', customer: 'Halima Said', items: 2, total: 52000, status: 'Processing', date: '2026-05-05' },
  { id: 'ORD-2026-1034', customer: 'Keneth Mrema', items: 3, total: 98000, status: 'Pending', date: '2026-05-05' },
  { id: 'ORD-2026-1033', customer: 'Rehema Joseph', items: 4, total: 142000, status: 'Completed', date: '2026-05-04' },
];

const categories = ['All', 'Electronics', 'Clothing', 'Food', 'Household'];

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    Completed: 'bg-green-500/10 text-green-400 border-green-500/20',
    Processing: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    Pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    Cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
    Active: 'bg-green-500/10 text-green-400 border-green-500/20',
    Inactive: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  };
  return map[status] || 'bg-slate-500/10 text-slate-400';
};

export default function ERPStore() {
  const [tab, setTab] = useState('products');
  const [products, setProducts] = useState(initialProducts);
  const [orders] = useState(initialOrders);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<typeof initialProducts[0] | null>(null);
  const [form, setForm] = useState({ name: '', sku: '', price: 0, stock: 0, category: 'Electronics', description: '', image: 'bg-blue-600' });

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
      const matchCat = categoryFilter === 'All' || p.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [products, search, categoryFilter]);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const selectAll = () => {
    if (selectedIds.length === filteredProducts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProducts.map((p) => p.id));
    }
  };

  const deleteSelected = () => {
    setProducts((prev) => prev.filter((p) => !selectedIds.includes(p.id)));
    setSelectedIds([]);
  };

  const openAdd = () => {
    setEditingProduct(null);
    setForm({ name: '', sku: '', price: 0, stock: 0, category: 'Electronics', description: '', image: 'bg-blue-600' });
    setProductModalOpen(true);
  };

  const openEdit = (product: typeof initialProducts[0]) => {
    setEditingProduct(product);
    setForm({ name: product.name, sku: product.sku, price: product.price, stock: product.stock, category: product.category, description: '', image: product.image });
    setProductModalOpen(true);
  };

  const saveProduct = () => {
    if (editingProduct) {
      setProducts((prev) => prev.map((p) => (p.id === editingProduct.id ? { ...p, ...form } : p)));
    } else {
      const newId = Math.max(...products.map((p) => p.id), 0) + 1;
      setProducts((prev) => [...prev, { id: newId, ...form, status: 'Active' }]);
    }
    setProductModalOpen(false);
  };

  const lowStockCount = products.filter((p) => p.stock < 10).length;

  return (
    <div className="h-full bg-slate-950 text-slate-100 overflow-auto">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-blue-400" />
            <h1 className="text-lg font-semibold">Store Manager</h1>
          </div>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="bg-slate-900 border border-slate-800">
              <TabsTrigger value="products" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <Package className="w-3 h-3 mr-1" /> Products
              </TabsTrigger>
              <TabsTrigger value="orders" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <ShoppingBag className="w-3 h-3 mr-1" /> Orders
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {tab === 'products' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="bg-slate-900/60 border-slate-800">
                <CardContent className="p-3">
                  <div className="text-xs text-slate-400">Total Products</div>
                  <div className="text-xl font-bold">{products.length}</div>
                </CardContent>
              </Card>
              <Card className="bg-slate-900/60 border-slate-800">
                <CardContent className="p-3">
                  <div className="text-xs text-slate-400">Active</div>
                  <div className="text-xl font-bold text-green-400">{products.filter((p) => p.status === 'Active').length}</div>
                </CardContent>
              </Card>
              <Card className="bg-slate-900/60 border-slate-800">
                <CardContent className="p-3">
                  <div className="text-xs text-slate-400">Low Stock</div>
                  <div className="text-xl font-bold text-red-400 flex items-center gap-1">
                    {lowStockCount}
                    {lowStockCount > 0 && <AlertTriangle className="w-4 h-4" />}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-slate-900/60 border-slate-800">
                <CardContent className="p-3">
                  <div className="text-xs text-slate-400">Categories</div>
                  <div className="text-xl font-bold">{categories.length - 1}</div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-slate-900/60 border-slate-800">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm font-medium">Product Catalog</CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
                      <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search..."
                        className="pl-8 h-8 w-48 bg-slate-900 border-slate-700 text-xs"
                      />
                    </div>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="h-8 px-2 rounded-md bg-slate-900 border border-slate-700 text-xs text-slate-300"
                    >
                      {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {selectedIds.length > 0 && (
                      <Button variant="outline" size="sm" onClick={deleteSelected} className="h-8 border-red-500/30 text-red-400 hover:bg-red-500/10">
                        <Trash2 className="w-3 h-3 mr-1" /> Delete ({selectedIds.length})
                      </Button>
                    )}
                    <Button size="sm" onClick={openAdd} className="h-8 bg-blue-600 hover:bg-blue-500 text-white">
                      <Plus className="w-3 h-3 mr-1" /> Add
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-800 hover:bg-transparent">
                        <TableHead className="w-8">
                          <button onClick={selectAll}>
                            {selectedIds.length === filteredProducts.length && filteredProducts.length > 0 ? <CheckSquare className="w-4 h-4 text-blue-400" /> : <Square className="w-4 h-4 text-slate-500" />}
                          </button>
                        </TableHead>
                        <TableHead className="text-slate-400 text-xs">Product</TableHead>
                        <TableHead className="text-slate-400 text-xs">SKU</TableHead>
                        <TableHead className="text-slate-400 text-xs">Price</TableHead>
                        <TableHead className="text-slate-400 text-xs">Stock</TableHead>
                        <TableHead className="text-slate-400 text-xs">Category</TableHead>
                        <TableHead className="text-slate-400 text-xs">Status</TableHead>
                        <TableHead className="text-slate-400 text-xs text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.map((p) => (
                        <TableRow key={p.id} className="border-slate-800 hover:bg-slate-800/40">
                          <TableCell>
                            <button onClick={() => toggleSelect(p.id)}>
                              {selectedIds.includes(p.id) ? <CheckSquare className="w-4 h-4 text-blue-400" /> : <Square className="w-4 h-4 text-slate-500" />}
                            </button>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-md ${p.image} shrink-0`} />
                              <span className="text-xs font-medium">{p.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-mono text-slate-400">{p.sku}</TableCell>
                          <TableCell className="text-xs font-medium">{tzs(p.price)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={p.stock < 10 ? 'text-red-400 border-red-400/20 bg-red-500/10' : 'text-slate-400 border-slate-700'}>
                              {p.stock}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-slate-300">{p.category}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statusBadge(p.status)}>
                              {p.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <button onClick={() => openEdit(p)} className="text-slate-400 hover:text-blue-400">
                              <Edit3 className="w-4 h-4" />
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

        {tab === 'orders' && (
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Customer Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead className="text-slate-400 text-xs">Order ID</TableHead>
                      <TableHead className="text-slate-400 text-xs">Customer</TableHead>
                      <TableHead className="text-slate-400 text-xs">Items</TableHead>
                      <TableHead className="text-slate-400 text-xs">Total</TableHead>
                      <TableHead className="text-slate-400 text-xs">Status</TableHead>
                      <TableHead className="text-slate-400 text-xs">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((o) => (
                      <TableRow key={o.id} className="border-slate-800 hover:bg-slate-800/40">
                        <TableCell className="text-xs font-mono text-slate-300">{o.id}</TableCell>
                        <TableCell className="text-xs text-slate-300">{o.customer}</TableCell>
                        <TableCell className="text-xs text-slate-400">{o.items}</TableCell>
                        <TableCell className="text-xs font-medium">{tzs(o.total)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusBadge(o.status)}>
                            {o.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-400">{o.date}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={productModalOpen} onOpenChange={setProductModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">{editingProduct ? 'Edit Product' : 'Add Product'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Name</label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="bg-slate-800 border-slate-700 text-slate-100" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">SKU</label>
                <Input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} className="bg-slate-800 border-slate-700 text-slate-100" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full h-9 px-2 rounded-md bg-slate-800 border border-slate-700 text-xs text-slate-300"
                >
                  {categories.filter((c) => c !== 'All').map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Price (TZS)</label>
                <Input type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))} className="bg-slate-800 border-slate-700 text-slate-100" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Stock</label>
                <Input type="number" value={form.stock} onChange={(e) => setForm((f) => ({ ...f, stock: Number(e.target.value) }))} className="bg-slate-800 border-slate-700 text-slate-100" />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Description</label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="bg-slate-800 border-slate-700 text-slate-100 text-xs" rows={3} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setProductModalOpen(false)} className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800">
                Cancel
              </Button>
              <Button onClick={saveProduct} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white">
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
