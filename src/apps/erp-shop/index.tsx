import { useState, useMemo, useEffect } from 'react';
import {
  ShoppingBag, Search, Plus, Minus, Trash2, Package,
  ShoppingCart, CreditCard, Truck, CheckCircle2,
  Smartphone, Building2, Banknote, Loader2, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';

/* ------------------------------------------------------------------ */
/*  TYPES                                                               */
/* ------------------------------------------------------------------ */

interface StoreSettings {
  storeName: string;
  tagline: string;
  logoUrl: string;
  bannerHeadline: string;
  bannerSubtext: string;
  bannerCta: string;
  bannerBg: string;
  bannerHeight: string;
  bannerVisible: boolean;
  primaryColor: string;
  accentColor: string;
  bgStyle: string;
  cardStyle: string;
  gridColumns: number;
  showStock: boolean;
  showCategoryBadge: boolean;
  showQuickAdd: boolean;
  productsPerPage: number;
  showSearch: boolean;
  showCategoryNav: boolean;
  showCartIcon: boolean;
  footerText: string;
  headingSize: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  category: string;
  imageUrl?: string | null;
  currency: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface CheckoutForm {
  name: string;
  phone: string;
  address: string;
  paymentMethod: 'cod' | 'mobile' | 'bank';
}

/* ------------------------------------------------------------------ */
/*  HELPERS                                                             */
/* ------------------------------------------------------------------ */

const API = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000/api';
const SHIPPING_COST = 5000;

function formatPrice(price: number, currency = 'TZS'): string {
  return `${currency} ${Number(price).toLocaleString('en-US')}`;
}

function getStockColor(stock: number): string {
  if (stock <= 3) return 'bg-red-500';
  if (stock <= 10) return 'bg-yellow-500';
  return 'bg-emerald-500';
}

function getStockLabel(stock: number): string {
  if (stock <= 3) return 'Low Stock';
  if (stock <= 10) return 'Limited';
  return 'In Stock';
}

function generateOrderNumber(): string {
  return 'KOBE-' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

const CATEGORY_GRADIENTS: Record<string, string> = {
  Electronics: 'from-blue-600 to-indigo-700',
  Clothing: 'from-emerald-600 to-green-700',
  Food: 'from-amber-600 to-yellow-700',
  Household: 'from-rose-600 to-pink-700',
  Beauty: 'from-pink-400 to-rose-500',
};
function productGradient(category: string): string {
  return CATEGORY_GRADIENTS[category] ?? 'from-slate-600 to-slate-700';
}

/* ------------------------------------------------------------------ */
/*  SLUG PICKER                                                         */
/* ------------------------------------------------------------------ */

function SlugPicker({ onSelect }: { onSelect: (slug: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8 bg-slate-900">
      <ShoppingBag className="w-12 h-12 text-blue-400" />
      <h2 className="text-xl font-semibold text-white">Open a Store</h2>
      <p className="text-sm text-slate-400 text-center max-w-xs">
        Enter a store subdomain to browse its catalogue.
      </p>
      <div className="flex gap-2 w-full max-w-sm">
        <Input
          placeholder="e.g. kelvinfashion"
          value={value}
          onChange={(e) => setValue(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && value && onSelect(value)}
          className="bg-white/10 border-white/20 text-white placeholder:text-slate-500"
        />
        <Button
          onClick={() => value && onSelect(value)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Open
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MAIN COMPONENT                                                      */
/* ------------------------------------------------------------------ */

export default function ErpShop({ data }: { data?: Record<string, unknown> }) {
  const initialSlug = (data?.slug as string | undefined) ?? '';

  const [slug, setSlug] = useState(initialSlug);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isCheckout, setIsCheckout] = useState(false);
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [checkoutForm, setCheckoutForm] = useState<CheckoutForm>({
    name: '', phone: '', address: '', paymentMethod: 'cod',
  });

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSettings(null);
    setProducts([]);
    fetch(`${API}/store/${encodeURIComponent(slug)}?limit=100`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? 'Store not found' : 'Failed to load store');
        return r.json();
      })
      .then((body: { settings: StoreSettings; products: Product[] }) => {
        if (cancelled) return;
        setSettings(body.settings);
        setProducts(body.products);
      })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  const categories = useMemo(() => {
    const cats = [...new Set(products.map((p) => p.category))].sort();
    return ['All', ...cats];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = selectedCategory === 'All' || p.category === selectedCategory;
      const q = searchQuery.toLowerCase();
      const matchSearch = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [products, searchQuery, selectedCategory]);

  const cartTotal = useMemo(() => cart.reduce((s, i) => s + i.product.price * i.quantity, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((s, i) => s + i.quantity, 0), [cart]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: Math.min(i.quantity + 1, product.stock) }
            : i,
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => setCart((p) => p.filter((i) => i.product.id !== id));

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev.map((i) =>
        i.product.id === id
          ? { ...i, quantity: Math.max(1, Math.min(i.quantity + delta, i.product.stock)) }
          : i,
      ),
    );
  };

  const clearCart = () => setCart([]);

  const handleCheckout = () => {
    if (cart.length) { setIsCartOpen(false); setIsCheckout(true); }
  };

  const handlePlaceOrder = () => {
    if (!checkoutForm.name || !checkoutForm.phone || !checkoutForm.address) return;
    setOrderNumber(generateOrderNumber());
    setIsCheckout(false);
    setOrderConfirmed(true);
    clearCart();
    setCheckoutForm({ name: '', phone: '', address: '', paymentMethod: 'cod' });
  };

  if (!slug) return <SlugPicker onSelect={setSlug} />;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-3 text-slate-400 bg-slate-900">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span>Loading store…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 bg-slate-900">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-red-300 font-medium">{error}</p>
        <Button variant="outline" onClick={() => setSlug('')} className="border-white/20 text-white">
          Try another store
        </Button>
      </div>
    );
  }

  if (!settings) return null;

  const cols = settings.gridColumns ?? 3;
  const gridClass = cols === 2 ? 'grid-cols-2' : cols >= 4 ? 'grid-cols-4' : 'grid-cols-3';

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white overflow-hidden">
      {/* HEADER */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800/80 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          {settings.logoUrl
            ? <img src={settings.logoUrl} alt={settings.storeName} className="h-7 w-7 rounded object-cover" />
            : <ShoppingBag className="w-5 h-5 text-blue-400" />}
          <div>
            <h1 className="font-bold text-sm leading-tight">{settings.storeName}</h1>
            {settings.tagline && <p className="text-xs text-slate-400">{settings.tagline}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {settings.showSearch && (
            <div className="relative hidden sm:block">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                placeholder="Search…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 h-7 w-40 text-xs bg-white/10 border-white/20 text-white placeholder:text-slate-500"
              />
            </div>
          )}
          {settings.showCartIcon && (
            <Button
              variant="ghost" size="sm"
              onClick={() => setIsCartOpen(true)}
              className="relative h-8 w-8 p-0 hover:bg-white/10"
            >
              <ShoppingCart className="w-4 h-4" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {cartCount}
                </span>
              )}
            </Button>
          )}
          <Button
            variant="ghost" size="sm"
            onClick={() => setSlug('')}
            className="h-7 px-2 text-xs text-slate-400 hover:text-white hover:bg-white/10"
          >
            ← Stores
          </Button>
        </div>
      </div>

      {/* BANNER */}
      {settings.bannerVisible && (
        <div className={`bg-gradient-to-r ${settings.bannerBg} px-6 py-4 shrink-0`}>
          <h2 className="font-bold text-lg">{settings.bannerHeadline}</h2>
          <p className="text-sm opacity-80 mt-0.5">{settings.bannerSubtext}</p>
        </div>
      )}

      {/* CATEGORY NAV */}
      {settings.showCategoryNav && categories.length > 1 && (
        <div className="flex gap-2 px-4 py-2 overflow-x-auto shrink-0 border-b border-white/10">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/10 text-slate-300 hover:bg-white/20'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* PRODUCT GRID */}
      <ScrollArea className="flex-1">
        <div className={`grid ${gridClass} gap-3 p-4`}>
          {filteredProducts.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
              <Package className="w-10 h-10" />
              <p>No products found</p>
            </div>
          ) : (
            filteredProducts.map((product) => (
              <Card
                key={product.id}
                className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                onClick={() => setSelectedProduct(product)}
              >
                <CardContent className="p-0">
                  <div className={`h-28 rounded-t-lg bg-gradient-to-br ${productGradient(product.category)} flex items-center justify-center overflow-hidden`}>
                    {product.imageUrl
                      ? <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                      : <Package className="w-8 h-8 text-white/40" />}
                  </div>
                  <div className="p-2.5">
                    {settings.showCategoryBadge && (
                      <span className="text-xs text-blue-400 font-medium">{product.category}</span>
                    )}
                    <p className="text-sm font-semibold text-white leading-tight mt-0.5 line-clamp-2">{product.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{product.sku}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm font-bold text-blue-300">
                        {formatPrice(product.price, product.currency)}
                      </span>
                      {settings.showStock && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full text-white ${getStockColor(product.stock)}`}>
                          {getStockLabel(product.stock)}
                        </span>
                      )}
                    </div>
                    {settings.showQuickAdd && (
                      <Button
                        size="sm"
                        className="w-full mt-2 h-7 text-xs bg-blue-600 hover:bg-blue-700"
                        onClick={(e) => { e.stopPropagation(); addToCart(product); }}
                        disabled={product.stock === 0}
                      >
                        <Plus className="w-3 h-3 mr-1" /> Add to Cart
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
        {settings.footerText && (
          <p className="text-center text-xs text-slate-500 py-4 px-4">{settings.footerText}</p>
        )}
      </ScrollArea>

      {/* PRODUCT DETAIL DIALOG */}
      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent className="bg-slate-800 border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">{selectedProduct?.name}</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-3">
              <div className={`h-36 rounded-lg bg-gradient-to-br ${productGradient(selectedProduct.category)} flex items-center justify-center overflow-hidden`}>
                {selectedProduct.imageUrl
                  ? <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-full h-full object-cover" />
                  : <Package className="w-12 h-12 text-white/40" />}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-blue-300">
                  {formatPrice(selectedProduct.price, selectedProduct.currency)}
                </span>
                <span className={`text-xs px-2 py-1 rounded-full text-white ${getStockColor(selectedProduct.stock)}`}>
                  {getStockLabel(selectedProduct.stock)} ({selectedProduct.stock})
                </span>
              </div>
              <p className="text-xs text-slate-400">SKU: {selectedProduct.sku}</p>
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }}
                disabled={selectedProduct.stock === 0}
              >
                <ShoppingCart className="w-4 h-4 mr-2" /> Add to Cart
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* CART DIALOG */}
      <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
        <DialogContent className="bg-slate-800 border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" /> Cart ({cartCount})
            </DialogTitle>
          </DialogHeader>
          {cart.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Your cart is empty</p>
            </div>
          ) : (
            <div className="space-y-3">
              <ScrollArea className="max-h-56">
                <div className="space-y-2 pr-2">
                  {cart.map((item) => (
                    <div key={item.product.id} className="flex items-center gap-2 bg-white/5 rounded-lg p-2">
                      <div className={`w-8 h-8 rounded bg-gradient-to-br ${productGradient(item.product.category)} flex items-center justify-center shrink-0`}>
                        <Package className="w-4 h-4 text-white/60" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{item.product.name}</p>
                        <p className="text-xs text-slate-400">{formatPrice(item.product.price, item.product.currency)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQuantity(item.product.id, -1)} className="w-5 h-5 rounded bg-white/10 flex items-center justify-center hover:bg-white/20">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs w-5 text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.product.id, 1)} className="w-5 h-5 rounded bg-white/10 flex items-center justify-center hover:bg-white/20">
                          <Plus className="w-3 h-3" />
                        </button>
                        <button onClick={() => removeFromCart(item.product.id)} className="w-5 h-5 rounded bg-red-500/20 flex items-center justify-center hover:bg-red-500/40 ml-1">
                          <Trash2 className="w-3 h-3 text-red-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="border-t border-white/10 pt-2 space-y-1 text-sm">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal</span><span>{formatPrice(cartTotal)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Shipping</span><span>{formatPrice(SHIPPING_COST)}</span>
                </div>
                <div className="flex justify-between font-bold text-white">
                  <span>Total</span><span>{formatPrice(cartTotal + SHIPPING_COST)}</span>
                </div>
              </div>
              <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleCheckout}>
                <CreditCard className="w-4 h-4 mr-2" /> Checkout
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* CHECKOUT DIALOG */}
      <Dialog open={isCheckout} onOpenChange={setIsCheckout}>
        <DialogContent className="bg-slate-800 border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-4 h-4" /> Checkout
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Full name *"
              value={checkoutForm.name}
              onChange={(e) => setCheckoutForm((f) => ({ ...f, name: e.target.value }))}
              className="bg-white/10 border-white/20 text-white placeholder:text-slate-500"
            />
            <Input
              placeholder="Phone number *"
              value={checkoutForm.phone}
              onChange={(e) => setCheckoutForm((f) => ({ ...f, phone: e.target.value }))}
              className="bg-white/10 border-white/20 text-white placeholder:text-slate-500"
            />
            <Input
              placeholder="Delivery address *"
              value={checkoutForm.address}
              onChange={(e) => setCheckoutForm((f) => ({ ...f, address: e.target.value }))}
              className="bg-white/10 border-white/20 text-white placeholder:text-slate-500"
            />
            <div className="space-y-1">
              <p className="text-xs text-slate-400 font-medium">Payment method</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: 'cod', label: 'Cash', Icon: Banknote },
                  { value: 'mobile', label: 'Mobile', Icon: Smartphone },
                  { value: 'bank', label: 'Bank', Icon: Building2 },
                ] as const).map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    onClick={() => setCheckoutForm((f) => ({ ...f, paymentMethod: value }))}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-colors ${
                      checkoutForm.paymentMethod === value
                        ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                        : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-between text-sm font-bold border-t border-white/10 pt-2">
              <span>Total</span>
              <span>{formatPrice(cartTotal + SHIPPING_COST)}</span>
            </div>
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={handlePlaceOrder}
              disabled={!checkoutForm.name || !checkoutForm.phone || !checkoutForm.address}
            >
              Place Order
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ORDER CONFIRMED DIALOG */}
      <Dialog open={orderConfirmed} onOpenChange={setOrderConfirmed}>
        <DialogContent className="bg-slate-800 border-white/10 text-white max-w-sm text-center">
          <div className="flex flex-col items-center gap-3 py-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-400" />
            <h3 className="text-lg font-bold">Order Placed!</h3>
            <p className="text-slate-400 text-sm">Your order has been received.</p>
            <div className="bg-white/10 rounded-lg px-4 py-2">
              <p className="text-xs text-slate-400">Order number</p>
              <p className="font-mono font-bold text-blue-300">{orderNumber}</p>
            </div>
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 mt-2"
              onClick={() => setOrderConfirmed(false)}
            >
              Continue Shopping
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
