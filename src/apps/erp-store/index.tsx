import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Store, Search, Plus, Trash2, Package, ShoppingBag, Edit3, CheckSquare, Square,
  AlertTriangle, RefreshCw,
} from 'lucide-react';
import { api } from '@/lib/api';
import { ensureSession } from '@/lib/auth';
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

/* Shape of /api/pos/products rows — the same catalogue the storefront
 * and the cashier consume, so editing here propagates everywhere. */
interface PosProductRow {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: string | number;
  currency: string;
  stock: number;
  imageUrl?: string | null;
  active: boolean;
}

/* Shape of /api/pos/orders rows. */
interface PosOrderRow {
  id: string;
  orderNumber: string;
  customerName?: string | null;
  customerPhone?: string | null;
  total: string | number;
  status: 'PENDING' | 'COMPLETED' | 'REFUNDED' | 'CANCELLED';
  createdAt: string;
}

const CATEGORY_OPTIONS = ['Electronics', 'Clothing', 'Food', 'Household', 'Other'];

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    COMPLETED: 'bg-green-500/10 text-green-400 border-green-500/20',
    PROCESSING: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    PENDING: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    CANCELLED: 'bg-red-500/10 text-red-400 border-red-500/20',
    REFUNDED: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    Active: 'bg-green-500/10 text-green-400 border-green-500/20',
    Inactive: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  };
  return map[status] || 'bg-slate-500/10 text-slate-400';
};

interface FormState {
  name: string;
  sku: string;
  price: number;
  stock: number;
  category: string;
  description: string;
  imageUrl: string;
  active: boolean;
}

const blankForm: FormState = {
  name: '', sku: '', price: 0, stock: 0,
  category: 'Electronics', description: '', imageUrl: '', active: true,
};

export default function ERPStore() {
  const [tab, setTab] = useState('products');
  const [products, setProducts] = useState<PosProductRow[]>([]);
  const [orders, setOrders] = useState<PosOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<PosProductRow | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [p, o] = await Promise.all([
        api<PosProductRow[]>('/pos/products'),
        api<PosOrderRow[]>('/pos/orders'),
      ]);
      setProducts(p);
      setOrders(o);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load store data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try { await ensureSession(); } catch { /* offline */ }
      await reload();
    })();
  }, [reload]);

  const categoriesOnDisk = useMemo(() => {
    const set = new Set<string>(products.map((p) => p.category).filter(Boolean));
    return ['All', ...Array.from(set)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const q = search.toLowerCase();
      const matchSearch = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      const matchCat = categoryFilter === 'All' || p.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [products, search, categoryFilter]);

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const selectAll = () => {
    if (selectedIds.length === filteredProducts.length) setSelectedIds([]);
    else setSelectedIds(filteredProducts.map((p) => p.id));
  };

  const deleteSelected = async () => {
    if (selectedIds.length === 0) return;
    try {
      await Promise.all(
        selectedIds.map((id) => api(`/pos/products/${id}`, { method: 'DELETE' })),
      );
      setSelectedIds([]);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const openAdd = () => {
    setEditingProduct(null);
    setForm(blankForm);
    setProductModalOpen(true);
  };

  const openEdit = (product: PosProductRow) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      sku: product.sku,
      price: Number(product.price),
      stock: Number(product.stock),
      category: product.category || 'Electronics',
      description: '',
      imageUrl: product.imageUrl ?? '',
      active: product.active,
    });
    setProductModalOpen(true);
  };

  const saveProduct = async () => {
    if (!form.name.trim() || !form.sku.trim()) return;
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        sku: form.sku.trim(),
        category: form.category,
        price: form.price,
        stock: form.stock,
        imageUrl: form.imageUrl || undefined,
        active: form.active,
      };
      if (editingProduct) {
        await api(`/pos/products/${editingProduct.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await api('/pos/products', { method: 'POST', body: JSON.stringify(body) });
      }
      setProductModalOpen(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const lowStockCount = products.filter((p) => Number(p.stock) < 10).length;

  return (
    <div className="h-full bg-slate-950 text-slate-100 overflow-auto">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-blue-400" />
            <h1 className="text-lg font-semibold">Store Manager</h1>
          </div>
          <div className="flex items-center gap-3">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="bg-slate-900 border border-slate-800">
                <TabsTrigger value="products" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  <Package className="w-3 h-3 mr-1" /> Products ({products.length})
                </TabsTrigger>
                <TabsTrigger value="orders" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  <ShoppingBag className="w-3 h-3 mr-1" /> Orders ({orders.length})
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button size="sm" variant="ghost" onClick={reload} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>
        )}

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
                  <div className="text-xl font-bold text-green-400">{products.filter((p) => p.active).length}</div>
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
                  <div className="text-xl font-bold">{Math.max(0, categoriesOnDisk.length - 1)}</div>
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
                        placeholder="Search name or SKU..."
                        className="pl-8 h-8 w-56 bg-slate-900 border-slate-700 text-xs"
                      />
                    </div>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="h-8 px-2 rounded-md bg-slate-900 border border-slate-700 text-xs text-slate-300"
                    >
                      {categoriesOnDisk.map((c) => <option key={c} value={c}>{c}</option>)}
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
                            {selectedIds.length === filteredProducts.length && filteredProducts.length > 0
                              ? <CheckSquare className="w-4 h-4 text-blue-400" />
                              : <Square className="w-4 h-4 text-slate-500" />}
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
                      {!loading && filteredProducts.length === 0 && (
                        <TableRow className="border-slate-800"><TableCell colSpan={8} className="text-center text-xs text-slate-500 py-8">
                          {products.length === 0 ? 'No products yet — click Add to create the first one.' : 'No products match the current filter.'}
                        </TableCell></TableRow>
                      )}
                      {filteredProducts.map((p) => (
                        <TableRow key={p.id} className="border-slate-800 hover:bg-slate-800/40">
                          <TableCell>
                            <button onClick={() => toggleSelect(p.id)}>
                              {selectedIds.includes(p.id) ? <CheckSquare className="w-4 h-4 text-blue-400" /> : <Square className="w-4 h-4 text-slate-500" />}
                            </button>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {p.imageUrl
                                ? <img src={p.imageUrl} alt={p.name} className="w-8 h-8 rounded-md object-cover shrink-0" />
                                : <div className="w-8 h-8 rounded-md bg-slate-700 shrink-0 flex items-center justify-center"><Package className="w-4 h-4 text-slate-400" /></div>}
                              <span className="text-xs font-medium">{p.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-mono text-slate-400">{p.sku}</TableCell>
                          <TableCell className="text-xs font-medium">{tzs(Number(p.price))}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={Number(p.stock) < 10 ? 'text-red-400 border-red-400/20 bg-red-500/10' : 'text-slate-400 border-slate-700'}>
                              {p.stock}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-slate-300">{p.category || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statusBadge(p.active ? 'Active' : 'Inactive')}>
                              {p.active ? 'Active' : 'Inactive'}
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
              <CardTitle className="text-sm font-medium">Customer Orders ({orders.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead className="text-slate-400 text-xs">Order #</TableHead>
                      <TableHead className="text-slate-400 text-xs">Customer</TableHead>
                      <TableHead className="text-slate-400 text-xs">Phone</TableHead>
                      <TableHead className="text-slate-400 text-xs">Total</TableHead>
                      <TableHead className="text-slate-400 text-xs">Status</TableHead>
                      <TableHead className="text-slate-400 text-xs">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!loading && orders.length === 0 && (
                      <TableRow className="border-slate-800"><TableCell colSpan={6} className="text-center text-xs text-slate-500 py-8">
                        No orders yet — sales placed via the POS terminal or the online storefront will appear here.
                      </TableCell></TableRow>
                    )}
                    {orders.map((o) => (
                      <TableRow key={o.id} className="border-slate-800 hover:bg-slate-800/40">
                        <TableCell className="text-xs font-mono text-slate-300">{o.orderNumber}</TableCell>
                        <TableCell className="text-xs text-slate-300">{o.customerName ?? 'Walk-in / Online'}</TableCell>
                        <TableCell className="text-xs text-slate-400">{o.customerPhone ?? '-'}</TableCell>
                        <TableCell className="text-xs font-medium">{tzs(Number(o.total))}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusBadge(o.status)}>{o.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-400">{new Date(o.createdAt).toLocaleString()}</TableCell>
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
              <label className="text-xs text-slate-400 block mb-1">Name *</label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="bg-slate-800 border-slate-700 text-slate-100" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">SKU *</label>
                <Input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} className="bg-slate-800 border-slate-700 text-slate-100 font-mono" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full h-9 px-2 rounded-md bg-slate-800 border border-slate-700 text-xs text-slate-300"
                >
                  {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
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
              <label className="text-xs text-slate-400 block mb-1">Image URL (optional)</label>
              <Input value={form.imageUrl} onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))} placeholder="https://…" className="bg-slate-800 border-slate-700 text-slate-100 text-xs" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Notes</label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="bg-slate-800 border-slate-700 text-slate-100 text-xs" rows={2} />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-300 select-none">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
              Active in catalogue
            </label>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setProductModalOpen(false)} disabled={saving} className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800">
                Cancel
              </Button>
              <Button onClick={saveProduct} disabled={saving || !form.name.trim() || !form.sku.trim()} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white">
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
