import { useState, useMemo, useEffect } from 'react';
import {
  Plus, Minus, Trash2, ShoppingCart, CreditCard, Smartphone, Banknote,
  Receipt, Tag, Percent, Search, Barcode, Shirt, Backpack, Coffee,
  BookOpen, PenTool, Clock, CheckCircle2, XCircle, AlertCircle,
  ArrowRight, Send, User, Phone, Package,
  History, X, Star, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ─── Types ───────────────────────────────────────────────────────
interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: 'Apparel' | 'Accessories' | 'Home';
  icon: React.ReactNode;
}

interface CartItem {
  product: Product;
  quantity: number;
  negotiatedPrice?: number;
  discountRequestId?: string;
}

interface DiscountRequest {
  id: string;
  cartItemIndex: number;
  productId: string;
  productName: string;
  quantity: number;
  standardPrice: number;
  requestedPrice: number;
  counterPrice?: number;
  finalPrice?: number;
  reason: string;
  customerName: string;
  customerPhone: string;
  sellerName: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COUNTERED' | 'EXPIRED' | 'COMPLETED';
  createdAt: number;
  resolvedAt?: number;
  expiryAt: number;
}

// ─── Mock Data ───────────────────────────────────────────────────
const PRODUCTS: Product[] = [
  { id: 'p1', name: 'T-Shirt', price: 15000, stock: 45, category: 'Apparel', icon: <Shirt className="w-5 h-5" /> },
  { id: 'p2', name: 'Hoodie', price: 35000, stock: 22, category: 'Apparel', icon: <Shirt className="w-5 h-5" /> },
  { id: 'p3', name: 'Jersey', price: 45000, stock: 15, category: 'Apparel', icon: <Shirt className="w-5 h-5" /> },
  { id: 'p4', name: 'Cap', price: 8000, stock: 60, category: 'Accessories', icon: <Tag className="w-5 h-5" /> },
  { id: 'p5', name: 'Mug', price: 12000, stock: 38, category: 'Home', icon: <Coffee className="w-5 h-5" /> },
  { id: 'p6', name: 'Apron', price: 18000, stock: 20, category: 'Apparel', icon: <Shirt className="w-5 h-5" /> },
  { id: 'p7', name: 'Vest', price: 22000, stock: 18, category: 'Apparel', icon: <Shirt className="w-5 h-5" /> },
  { id: 'p8', name: 'Tote Bag', price: 10000, stock: 55, category: 'Accessories', icon: <Package className="w-5 h-5" /> },
  { id: 'p9', name: 'Phone Case', price: 7000, stock: 80, category: 'Accessories', icon: <Smartphone className="w-5 h-5" /> },
  { id: 'p10', name: 'Notebook', price: 5000, stock: 100, category: 'Home', icon: <BookOpen className="w-5 h-5" /> },
  { id: 'p11', name: 'Pen Set', price: 3000, stock: 120, category: 'Home', icon: <PenTool className="w-5 h-5" /> },
  { id: 'p12', name: 'Backpack', price: 55000, stock: 10, category: 'Accessories', icon: <Backpack className="w-5 h-5" /> },
];

const REASONS = [
  'Bulk Order',
  'Loyalty Customer',
  'Defect/Seconds',
  'Competitive Price',
  'Staff Purchase',
  'Promotional',
];

const CATEGORY_OPTIONS = ['All', 'Apparel', 'Accessories', 'Home'] as const;

const SELLER_NAME = 'Juma Mwinyi';

// ─── Helpers ─────────────────────────────────────────────────────
const fmt = (n: number) => `TZS ${n.toLocaleString()}`;

const discountPct = (std: number, req: number) =>
  (((std - req) / std) * 100).toFixed(1);

const statusColors: Record<string, string> = {
  PENDING: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  APPROVED: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  REJECTED: 'bg-red-500/15 text-red-400 border-red-500/30',
  COUNTERED: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  EXPIRED: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
  COMPLETED: 'bg-emerald-600/15 text-emerald-300 border-emerald-600/30',
};

const statusIcons: Record<string, React.ReactNode> = {
  PENDING: <Clock className="w-3.5 h-3.5" />,
  APPROVED: <CheckCircle2 className="w-3.5 h-3.5" />,
  REJECTED: <XCircle className="w-3.5 h-3.5" />,
  COUNTERED: <AlertCircle className="w-3.5 h-3.5" />,
  EXPIRED: <X className="w-3.5 h-3.5" />,
  COMPLETED: <Star className="w-3.5 h-3.5" />,
};

// ─── Main Component ──────────────────────────────────────────────
export default function POSSystem() {
  // ── State ──
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('All');
  const [requests, setRequests] = useState<DiscountRequest[]>([]);
  const [activeTab, setActiveTab] = useState('pos');

  // Discount dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [selectedItemIdx, setSelectedItemIdx] = useState<string>('');
  const [reqQty, setReqQty] = useState<number>(1);
  const [reqPrice, setReqPrice] = useState<string>('');
  const [reqReason, setReqReason] = useState<string>('');
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');

  // Checkout dialog
  const [showCheckout, setShowCheckout] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mobile'>('cash');

  // Counter offer dialog
  const [showCounter, setShowCounter] = useState(false);
  const [counterRequestId, setCounterRequestId] = useState<string>('');
  const [counterPrice, setCounterPrice] = useState<string>('');

  // ── Expiry timer ──
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setRequests((prev) =>
        prev.map((r) =>
          r.status === 'PENDING' && now > r.expiryAt
            ? { ...r, status: 'EXPIRED' }
            : r
        )
      );
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // ── Computed ──
  const filteredProducts = useMemo(() => {
    return PRODUCTS.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.price.toString().includes(search);
      const matchCat = category === 'All' || p.category === category;
      return matchSearch && matchCat;
    });
  }, [search, category]);

  const subtotal = useMemo(
    () =>
      cart.reduce(
        (sum, item) =>
          sum +
          (item.negotiatedPrice ?? item.product.price) *
            item.quantity,
        0
      ),
    [cart]
  );

  const tax = Math.round(subtotal * 0.18);
  const total = subtotal + tax;
  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);

  const pendingRequests = requests.filter((r) => r.status === 'PENDING');

  // ── Cart Actions ──
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.findIndex((i) => i.product.id === product.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = {
          ...updated[existing],
          quantity: updated[existing].quantity + 1,
        };
        return updated;
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQty = (index: number, delta: number) => {
    setCart((prev) => {
      const updated = [...prev];
      const newQty = updated[index].quantity + delta;
      if (newQty <= 0) {
        updated.splice(index, 1);
      } else {
        updated[index] = { ...updated[index], quantity: newQty };
      }
      return updated;
    });
  };

  const removeItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Discount Request ──
  const openDiscountDialog = () => {
    if (cart.length === 0) return;
    setSelectedItemIdx('0');
    setReqQty(cart[0].quantity);
    setReqPrice(cart[0].product.price.toString());
    setReqReason('');
    setCustName('');
    setCustPhone('');
    setShowDialog(true);
  };

  const handleSelectItem = (val: string) => {
    setSelectedItemIdx(val);
    const idx = parseInt(val, 10);
    const item = cart[idx];
    if (item) {
      setReqQty(item.quantity);
      setReqPrice(item.product.price.toString());
    }
  };

  const submitDiscountRequest = () => {
    const idx = parseInt(selectedItemIdx, 10);
    const item = cart[idx];
    if (!item || !reqPrice || !reqReason) return;
    const price = parseInt(reqPrice, 10);
    if (price >= item.product.price || price <= 0) return;

    const request: DiscountRequest = {
      id: `req-${Date.now()}`,
      cartItemIndex: idx,
      productId: item.product.id,
      productName: item.product.name,
      quantity: reqQty,
      standardPrice: item.product.price,
      requestedPrice: price,
      reason: reqReason,
      customerName: custName,
      customerPhone: custPhone,
      sellerName: SELLER_NAME,
      status: 'PENDING',
      createdAt: Date.now(),
      expiryAt: Date.now() + 5 * 60 * 1000,
    };

    setRequests((prev) => [request, ...prev]);
    setShowDialog(false);
  };

  // ── Approval Actions ──
  const approveRequest = (reqId: string) => {
    setRequests((prev) =>
      prev.map((r) => {
        if (r.id !== reqId) return r;
        return { ...r, status: 'APPROVED', finalPrice: r.requestedPrice, resolvedAt: Date.now() };
      })
    );
    // Update cart price
    setRequests((prev) => {
      const req = prev.find((r) => r.id === reqId);
      if (req && req.status === 'APPROVED') {
        setCart((c) => {
          const updated = [...c];
          const item = updated[req.cartItemIndex];
          if (item) {
            updated[req.cartItemIndex] = {
              ...item,
              negotiatedPrice: req.requestedPrice,
              discountRequestId: req.id,
            };
          }
          return updated;
        });
      }
      return prev;
    });
  };

  const rejectRequest = (reqId: string) => {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === reqId
          ? { ...r, status: 'REJECTED', resolvedAt: Date.now() }
          : r
      )
    );
  };

  const openCounterDialog = (reqId: string) => {
    const req = requests.find((r) => r.id === reqId);
    if (!req) return;
    setCounterRequestId(reqId);
    setCounterPrice(Math.round((req.standardPrice + req.requestedPrice) / 2).toString());
    setShowCounter(true);
  };

  const submitCounterOffer = () => {
    const price = parseInt(counterPrice, 10);
    const req = requests.find((r) => r.id === counterRequestId);
    if (!req || price <= 0 || price >= req.standardPrice) return;

    setRequests((prev) =>
      prev.map((r) =>
        r.id === counterRequestId
          ? { ...r, status: 'COUNTERED', counterPrice: price }
          : r
      )
    );
    setShowCounter(false);
  };

  // ── Checkout ──
  const handleCheckout = () => {
    setShowCheckout(true);
  };

  const finalizeCheckout = () => {
    // Mark all applied discount requests as COMPLETED
    setRequests((prev) =>
      prev.map((r) =>
        r.status === 'APPROVED' ? { ...r, status: 'COMPLETED' } : r
      )
    );
    setCart([]);
    setShowCheckout(false);
  };

  // ── Countdown helper ──
  const getRemaining = (expiry: number) => {
    const diff = expiry - Date.now();
    if (diff <= 0) return '00:00';
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ── Stats ──
  const historyStats = useMemo(() => {
    const all = requests.filter((r) => r.status !== 'PENDING');
    const approved = all.filter((r) => r.status === 'APPROVED' || r.status === 'COMPLETED');
    const totalDiscount = approved.reduce(
      (s, r) => s + (r.standardPrice - (r.finalPrice ?? r.requestedPrice)) * r.quantity,
      0
    );
    return {
      total: all.length,
      approvedCount: approved.length,
      rate: all.length > 0 ? ((approved.length / all.length) * 100).toFixed(0) : '0',
      totalDiscount,
    };
  }, [requests]);

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div className="w-full h-full bg-[#0a0a1a] text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-[#13131f] border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <ShoppingCart className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">POS System</h1>
            <p className="text-xs text-white/40">Discount Negotiation & Approval</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-[#0a0a1a] border border-white/[0.08]">
            <TabsTrigger
              value="pos"
              className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 text-white/50"
            >
              <Barcode className="w-3.5 h-3.5 mr-1.5" />
              Point of Sale
            </TabsTrigger>
            <TabsTrigger
              value="pending"
              className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 text-white/50 relative"
            >
              <Clock className="w-3.5 h-3.5 mr-1.5" />
              Pending Approvals
              {pendingRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-[10px] font-bold text-black flex items-center justify-center">
                  {pendingRequests.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 text-white/50"
            >
              <History className="w-3.5 h-3.5 mr-1.5" />
              Approval History
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2 text-sm text-white/50">
          <User className="w-4 h-4" />
          <span>{SELLER_NAME}</span>
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
            Online
          </Badge>
        </div>
      </header>

      {/* ─── POS Tab ─── */}
      <TabsContent value="pos" className="flex-1 flex overflow-hidden m-0 p-0">
        {/* Left: Product Catalog */}
        <div className="w-[60%] flex flex-col border-r border-white/[0.06]">
          {/* Search & Filter */}
          <div className="p-4 flex gap-3 border-b border-white/[0.06]">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-[#13131f] border-white/[0.08] text-white placeholder:text-white/30"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-36 bg-[#13131f] border-white/[0.08] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a2e] border-white/[0.08]">
                {CATEGORY_OPTIONS.map((c) => (
                  <SelectItem key={c} value={c} className="text-white">
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Product Grid */}
          <ScrollArea className="flex-1 p-4">
            <div className="grid grid-cols-3 gap-3">
              {filteredProducts.map((product) => (
                <Card
                  key={product.id}
                  className="bg-[#13131f] border-white/[0.06] hover:border-amber-500/40 transition-all group cursor-pointer overflow-hidden"
                  onClick={() => addToCart(product)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center text-amber-400 group-hover:bg-amber-500/15 transition-colors">
                        {product.icon}
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          product.stock > 20
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : product.stock > 10
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            : 'bg-red-500/10 text-red-400 border-red-500/30'
                        }`}
                      >
                        {product.stock} in stock
                      </Badge>
                    </div>
                    <h3 className="font-semibold text-sm mb-1">{product.name}</h3>
                    <p className="text-amber-400 font-bold text-lg mb-2">{fmt(product.price)}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-white/30 uppercase tracking-wider">
                        {product.category}
                      </span>
                      <Button
                        size="sm"
                        className="h-8 bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold"
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart(product);
                        }}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Add
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Right: Cart Panel */}
        <div className="w-[40%] flex flex-col bg-[#0e0e1a]">
          <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-amber-400" />
              <h2 className="font-bold">Cart</h2>
              {totalItems > 0 && (
                <Badge className="bg-amber-500 text-black text-xs">{totalItems}</Badge>
              )}
            </div>
            {cart.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 text-xs"
                onClick={() => setCart([])}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Clear
              </Button>
            )}
          </div>

          <ScrollArea className="flex-1 p-4">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-white/20">
                <ShoppingCart className="w-16 h-16 mb-4" />
                <p className="text-sm">Your cart is empty</p>
                <p className="text-xs mt-1">Click a product to add</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item, idx) => {
                  const effectivePrice = item.negotiatedPrice ?? item.product.price;
                  const isNegotiated = item.negotiatedPrice !== undefined;
                  return (
                    <div
                      key={`${item.product.id}-${idx}`}
                      className={`p-3 rounded-xl border ${
                        isNegotiated
                          ? 'bg-emerald-500/5 border-emerald-500/30'
                          : 'bg-[#13131f] border-white/[0.06]'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-amber-400">
                            {item.product.icon}
                          </div>
                          <div>
                            <h4 className="font-semibold text-sm">{item.product.name}</h4>
                            <p className="text-xs text-white/40">{fmt(effectivePrice)} each</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          onClick={() => removeItem(idx)}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>

                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0 border-white/[0.1] bg-transparent hover:bg-white/5"
                            onClick={() => updateQty(idx, -1)}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="text-sm font-bold w-6 text-center">
                            {item.quantity}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0 border-white/[0.1] bg-transparent hover:bg-white/5"
                            onClick={() => updateQty(idx, 1)}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                        <div className="text-right">
                          {isNegotiated && (
                            <p className="text-[10px] line-through text-white/30">
                              {fmt(item.product.price * item.quantity)}
                            </p>
                          )}
                          <p
                            className={`font-bold text-sm ${
                              isNegotiated ? 'text-emerald-400' : 'text-white'
                            }`}
                          >
                            {fmt(effectivePrice * item.quantity)}
                          </p>
                        </div>
                      </div>

                      {isNegotiated && (
                        <Badge className="mt-2 bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">
                          <Tag className="w-2.5 h-2.5 mr-1" />
                          Negotiated: {discountPct(item.product.price, effectivePrice)}% off
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Cart Footer */}
          <div className="p-4 border-t border-white/[0.06] bg-[#13131f]">
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Subtotal</span>
                <span className="font-medium">{fmt(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/50">VAT (18%)</span>
                <span className="font-medium">{fmt(tax)}</span>
              </div>
              <div className="h-px bg-white/[0.06]" />
              <div className="flex justify-between">
                <span className="font-bold text-lg">Total</span>
                <span className="font-bold text-lg text-amber-400">{fmt(total)}</span>
              </div>
            </div>

            <Button
              className="w-full mb-2 bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 h-10 text-sm font-bold"
              variant="outline"
              disabled={cart.length === 0}
              onClick={openDiscountDialog}
            >
              <Percent className="w-4 h-4 mr-2" />
              Request Discount
            </Button>

            <Button
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-bold h-11 text-sm"
              disabled={cart.length === 0}
              onClick={handleCheckout}
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Checkout {fmt(total)}
            </Button>
          </div>
        </div>
      </TabsContent>

      {/* ─── Pending Approvals Tab ─── */}
      <TabsContent value="pending" className="flex-1 overflow-hidden m-0 p-0">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold">Pending Discount Approvals</h2>
              <p className="text-sm text-white/40 mt-1">
                {pendingRequests.length} request{pendingRequests.length !== 1 ? 's' : ''} awaiting your decision
              </p>
            </div>
            <div className="flex gap-3">
              <div className="px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                <p className="text-2xl font-bold text-amber-400">{pendingRequests.length}</p>
                <p className="text-[10px] text-white/40 uppercase tracking-wider">Pending</p>
              </div>
            </div>
          </div>

          {pendingRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-white/20">
              <CheckCircle2 className="w-16 h-16 mb-4" />
              <p className="text-sm">No pending requests</p>
              <p className="text-xs mt-1">All discount requests have been processed</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {pendingRequests.map((req) => (
                <Card
                  key={req.id}
                  className="bg-[#13131f] border-amber-500/20 overflow-hidden"
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-bold text-lg">{req.productName}</h3>
                        <p className="text-sm text-white/40">
                          Qty: {req.quantity} &middot; Seller: {req.sellerName}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={statusColors[req.status]}
                      >
                        {statusIcons[req.status]}
                        <span className="ml-1">{req.status}</span>
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-4 p-3 rounded-lg bg-white/[0.03]">
                      <div className="text-center">
                        <p className="text-[10px] text-white/30 uppercase">Standard</p>
                        <p className="font-bold text-sm">{fmt(req.standardPrice)}</p>
                      </div>
                      <div className="text-center border-x border-white/[0.06]">
                        <p className="text-[10px] text-white/30 uppercase">Requested</p>
                        <p className="font-bold text-sm text-amber-400">
                          {fmt(req.requestedPrice)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-white/30 uppercase">Discount</p>
                        <p className="font-bold text-sm text-red-400">
                          -{discountPct(req.standardPrice, req.requestedPrice)}%
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-white/40 mb-4">
                      <span className="flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {req.reason}
                      </span>
                      {req.customerName && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {req.customerName}
                        </span>
                      )}
                      <span className="flex items-center gap-1 ml-auto text-amber-400 font-mono">
                        <Clock className="w-3 h-3" />
                        {getRemaining(req.expiryAt)}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        className="flex-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 h-9 text-xs font-bold"
                        variant="outline"
                        onClick={() => approveRequest(req.id)}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                        Approve
                      </Button>
                      <Button
                        className="flex-1 bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25 h-9 text-xs font-bold"
                        variant="outline"
                        onClick={() => openCounterDialog(req.id)}
                      >
                        <ArrowRight className="w-3.5 h-3.5 mr-1.5" />
                        Counter
                      </Button>
                      <Button
                        className="flex-1 bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 h-9 text-xs font-bold"
                        variant="outline"
                        onClick={() => rejectRequest(req.id)}
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1.5" />
                        Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </TabsContent>

      {/* ─── Approval History Tab ─── */}
      <TabsContent value="history" className="flex-1 overflow-hidden m-0 p-0">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold">Approval History</h2>
              <p className="text-sm text-white/40 mt-1">
                Track all discount negotiations and outcomes
              </p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-xl bg-[#13131f] border border-white/[0.06]">
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">
                Total Requests
              </p>
              <p className="text-2xl font-bold">{historyStats.total}</p>
            </div>
            <div className="p-4 rounded-xl bg-[#13131f] border border-white/[0.06]">
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">
                Approval Rate
              </p>
              <p className="text-2xl font-bold text-emerald-400">{historyStats.rate}%</p>
            </div>
            <div className="p-4 rounded-xl bg-[#13131f] border border-white/[0.06]">
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">
                Approved
              </p>
              <p className="text-2xl font-bold text-emerald-400">
                {historyStats.approvedCount}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[#13131f] border border-white/[0.06]">
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">
                Total Discount Given
              </p>
              <p className="text-2xl font-bold text-amber-400">
                {fmt(historyStats.totalDiscount)}
              </p>
            </div>
          </div>

          {/* History Table */}
          {requests.filter((r) => r.status !== 'PENDING').length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-white/20">
              <History className="w-16 h-16 mb-4" />
              <p className="text-sm">No history yet</p>
              <p className="text-xs mt-1">Processed requests will appear here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {requests
                .filter((r) => r.status !== 'PENDING')
                .map((req) => {
                  const finalPrice = req.finalPrice ?? req.counterPrice ?? req.requestedPrice;
                  const discount = (req.standardPrice - finalPrice) * req.quantity;
                  return (
                    <div
                      key={req.id}
                      className="flex items-center gap-4 p-4 rounded-xl bg-[#13131f] border border-white/[0.06] hover:border-white/[0.12] transition-colors"
                    >
                      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-amber-400 shrink-0">
                        <Receipt className="w-5 h-5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm">{req.productName}</h4>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${statusColors[req.status]}`}
                          >
                            {statusIcons[req.status]}
                            <span className="ml-1">{req.status}</span>
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-white/30 mt-1">
                          <span>Qty: {req.quantity}</span>
                          <span>Reason: {req.reason}</span>
                          <span>Seller: {req.sellerName}</span>
                          {req.customerName && (
                            <span>Customer: {req.customerName}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-6 text-right shrink-0">
                        <div>
                          <p className="text-[10px] text-white/30">Standard</p>
                          <p className="text-xs font-medium line-through text-white/30">
                            {fmt(req.standardPrice * req.quantity)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-white/30">Final</p>
                          <p className="text-sm font-bold text-emerald-400">
                            {fmt(finalPrice * req.quantity)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-white/30">Discount</p>
                          <p className="text-sm font-bold text-amber-400">
                            {discount > 0 ? `-${fmt(discount)}` : fmt(0)}
                          </p>
                        </div>
                        <div className="w-20 text-right">
                          <p className="text-[10px] text-white/30">
                            {req.resolvedAt
                              ? new Date(req.resolvedAt).toLocaleTimeString()
                              : new Date(req.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </TabsContent>

      {/* ─── Discount Request Dialog ─── */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-[#13131f] border border-white/[0.08] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Zap className="w-5 h-5 text-amber-400" />
              Request Discount
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Step 1: Select Item */}
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Step 1: Select Item</label>
              <Select value={selectedItemIdx} onValueChange={handleSelectItem}>
                <SelectTrigger className="bg-[#0a0a1a] border-white/[0.08] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a2e] border-white/[0.08]">
                  {cart.map((item, idx) => (
                    <SelectItem key={idx} value={String(idx)} className="text-white">
                      {item.product.name} ({item.quantity}x) - {fmt(item.product.price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Step 2: Quantity */}
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Step 2: Quantity</label>
              <Input
                type="number"
                min={1}
                max={cart[parseInt(selectedItemIdx ?? '0', 10)]?.quantity ?? 1}
                value={reqQty}
                onChange={(e) => setReqQty(parseInt(e.target.value, 10) || 1)}
                className="bg-[#0a0a1a] border-white/[0.08] text-white"
              />
            </div>

            {/* Step 3: Standard Price (readonly) */}
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Step 3: Standard Price</label>
              <Input
                readOnly
                value={fmt(
                  (cart[parseInt(selectedItemIdx ?? '0', 10)]?.product.price ?? 0) * reqQty
                )}
                className="bg-white/[0.03] border-white/[0.08] text-white/50"
              />
            </div>

            {/* Step 4: Requested Price */}
            <div>
              <label className="text-xs text-amber-400 mb-1.5 block">
                Step 4: Requested Price (per unit)
              </label>
              <Input
                type="number"
                placeholder="Enter price..."
                value={reqPrice}
                onChange={(e) => setReqPrice(e.target.value)}
                className="bg-[#0a0a1a] border-amber-500/30 text-white focus:border-amber-500"
              />
              {reqPrice && cart[parseInt(selectedItemIdx ?? '0', 10)] && (
                <p className="text-xs mt-1.5 text-white/30">
                  Total: {fmt(parseInt(reqPrice, 10) * reqQty)} &middot; Discount:{' '}
                  <span className="text-red-400">
                    {discountPct(
                      cart[parseInt(selectedItemIdx ?? '0', 10)]?.product.price ?? 0,
                      parseInt(reqPrice, 10) || 0
                    )}
                    %
                  </span>
                </p>
              )}
            </div>

            {/* Step 5: Reason */}
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Step 5: Reason</label>
              <Select value={reqReason} onValueChange={setReqReason}>
                <SelectTrigger className="bg-[#0a0a1a] border-white/[0.08] text-white">
                  <SelectValue placeholder="Select reason..." />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a2e] border-white/[0.08]">
                  {REASONS.map((r) => (
                    <SelectItem key={r} value={r} className="text-white">
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Step 6: Customer Info */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">
                  <User className="w-3 h-3 inline mr-1" />
                  Customer Name
                </label>
                <Input
                  placeholder="Optional"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  className="bg-[#0a0a1a] border-white/[0.08] text-white"
                />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">
                  <Phone className="w-3 h-3 inline mr-1" />
                  Phone
                </label>
                <Input
                  placeholder="Optional"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  className="bg-[#0a0a1a] border-white/[0.08] text-white"
                />
              </div>
            </div>

            <Button
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-bold h-10"
              onClick={submitDiscountRequest}
              disabled={!reqPrice || !reqReason}
            >
              <Send className="w-4 h-4 mr-2" />
              Submit Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Counter Offer Dialog ─── */}
      <Dialog open={showCounter} onOpenChange={setShowCounter}>
        <DialogContent className="bg-[#13131f] border border-white/[0.08] text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRight className="w-5 h-5 text-blue-400" />
              Counter Offer
            </DialogTitle>
          </DialogHeader>

          {(() => {
            const req = requests.find((r) => r.id === counterRequestId);
            if (!req) return null;
            return (
              <div className="space-y-4 mt-2">
                <div className="p-3 rounded-lg bg-white/[0.03]">
                  <p className="text-xs text-white/30">Product</p>
                  <p className="font-semibold">{req.productName} x{req.quantity}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-white/[0.03]">
                    <p className="text-xs text-white/30">Standard</p>
                    <p className="font-bold text-sm">{fmt(req.standardPrice)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                    <p className="text-xs text-white/30">Requested</p>
                    <p className="font-bold text-sm text-amber-400">{fmt(req.requestedPrice)}</p>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-blue-400 mb-1.5 block">
                    Your Counter Price (per unit)
                  </label>
                  <Input
                    type="number"
                    value={counterPrice}
                    onChange={(e) => setCounterPrice(e.target.value)}
                    className="bg-[#0a0a1a] border-blue-500/30 text-white focus:border-blue-500"
                  />
                  {counterPrice && (
                    <p className="text-xs mt-1.5 text-white/30">
                      Total: {fmt(parseInt(counterPrice, 10) * req.quantity)} &middot; Discount:{' '}
                      <span className="text-blue-400">
                        {discountPct(req.standardPrice, parseInt(counterPrice, 10) || 0)}%
                      </span>
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 border-white/[0.1] hover:bg-white/5 h-10"
                    onClick={() => setShowCounter(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-bold h-10"
                    onClick={submitCounterOffer}
                    disabled={!counterPrice}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Send Counter
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ─── Checkout Dialog ─── */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="bg-[#13131f] border border-white/[0.08] text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-400" />
              Checkout
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="p-4 rounded-xl bg-white/[0.03] space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Subtotal</span>
                <span>{fmt(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/50">VAT (18%)</span>
                <span>{fmt(tax)}</span>
              </div>
              <div className="h-px bg-white/[0.06]" />
              <div className="flex justify-between">
                <span className="font-bold">Total</span>
                <span className="font-bold text-amber-400 text-lg">{fmt(total)}</span>
              </div>
            </div>

            <div>
              <label className="text-xs text-white/40 mb-2 block">Payment Method</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'cash' as const, label: 'Cash', icon: <Banknote className="w-5 h-5" /> },
                  { key: 'card' as const, label: 'Card', icon: <CreditCard className="w-5 h-5" /> },
                  { key: 'mobile' as const, label: 'Mobile', icon: <Smartphone className="w-5 h-5" /> },
                ].map((method) => (
                  <button
                    key={method.key}
                    onClick={() => setPaymentMethod(method.key)}
                    className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-1.5 ${
                      paymentMethod === method.key
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                        : 'bg-white/[0.03] border-white/[0.06] text-white/40 hover:border-white/[0.12]'
                    }`}
                  >
                    {method.icon}
                    <span className="text-xs font-medium">{method.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <Button
              className="w-full bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white font-bold h-11"
              onClick={finalizeCheckout}
            >
              <Receipt className="w-4 h-4 mr-2" />
              Complete Payment {fmt(total)}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
