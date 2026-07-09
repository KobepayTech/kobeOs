import { useState, useMemo, useEffect } from 'react';
import {
  ShoppingBag, Search, Plus, Minus, Trash2, Package,
  ShoppingCart, CreditCard, Truck, CheckCircle2,
  Smartphone, Building2, Banknote, Loader2, AlertCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { StorefrontNav, type StorefrontView } from './StorefrontNav';
import {
  BnplPage,
  BrandsPage,
  CollectionPage,
  LoyaltyPage,
  TrackOrderPage,
  WishlistPage,
} from './StorefrontPages';
import { JerseyShopChrome, JerseyProductCard, type JerseyConfig } from './JerseyShopLayout';

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
  /** Jersey-editor config (top promo, hero, trust strip, footer). */
  jerseyConfig?: JerseyConfig;
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
  paymentMethod: 'cod' | 'mobile' | 'bank' | 'bnpl';
}

interface BnplEligibility {
  eligible: boolean;
  availableCredit: number;
  creditLimit: number;
  currency: string;
  reason?: 'no_profile' | 'inactive' | 'no_phone';
}

interface TrackedOrder {
  orderNumber: string;
  status: string;
  total: string | number;
  currency: string;
  paymentMethod: string;
  customerName?: string | null;
  placedAt: string;
  items: Array<{ productName: string; quantity: number; unitPrice: string | number; lineTotal: string | number }>;
  pickTicket: { ticketNumber: string; status: string } | null;
}

/* ------------------------------------------------------------------ */
/*  HELPERS                                                             */
/* ------------------------------------------------------------------ */

// Same-origin '/api' in production: the store at {slug}.kobeapptz.com calls its
// OWN backend through the same tunnel (no cross-origin, no CORS). Previously
// this hit https://api.kobeapptz.com which failed cross-origin ("failed to
// fetch"). Override with VITE_API_BASE for a central/split deployment.
const API =
  (import.meta.env.VITE_API_BASE as string | undefined) ??
  (import.meta.env.DEV ? 'http://localhost:3000/api' : '/api');
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

/**
 * Detect the store slug from the current hostname.
 * When accessed via kelvinfashion.kobeapptz.com the first label is the slug.
 * Returns empty string when running inside the OS shell (localhost / Electron).
 */
function detectSubdomainSlug(): string {
  try {
    const host = window.location.hostname; // e.g. "kelvinfashion.kobeapptz.com"
    const parts = host.split('.');
    // Must have at least 3 parts (slug.domain.tld) and not be localhost/IP
    if (parts.length >= 3 && !/^\d+$/.test(parts[0]) && parts[0] !== 'www') {
      return parts[0]; // "kelvinfashion"
    }
  } catch {
    // window not available (SSR / test env)
  }
  return '';
}

interface StoreReview { id: string; rating: number; title?: string; comment?: string; customerName?: string; createdAt?: string }

/** Real product reviews + submit, backed by /store/:slug/products/:id/reviews. */
function ProductReviews({ slug, productId }: { slug: string; productId: string }) {
  const [reviews, setReviews] = useState<StoreReview[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { const r = await api<StoreReview[]>(`/store/${encodeURIComponent(slug)}/products/${productId}/reviews`, { auth: false }); setReviews(Array.isArray(r) ? r : []); }
    catch { /* none */ }
  };
  useEffect(() => { if (slug && productId) load(); }, [slug, productId]);

  const avg = reviews.length ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length : 0;
  const submit = async () => {
    if (!comment.trim()) return;
    setBusy(true);
    try {
      await api(`/store/${encodeURIComponent(slug)}/products/${productId}/reviews`, { method: 'POST', auth: false, body: JSON.stringify({ rating, comment: comment.trim(), customerName: name.trim() || 'Customer' }) });
      setComment(''); setName('');
      await load();
    } catch { /* ignore */ } finally { setBusy(false); }
  };
  const stars = (n: number) => '★★★★★'.slice(0, Math.round(n)) + '☆☆☆☆☆'.slice(0, 5 - Math.round(n));

  return (
    <div className="mt-4 border-t border-white/10 pt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold">Reviews</span>
        {reviews.length > 0 && <span className="text-xs text-amber-400">{stars(avg)} {avg.toFixed(1)} · {reviews.length}</span>}
      </div>
      <div className="space-y-2 max-h-32 overflow-y-auto mb-3">
        {reviews.length === 0 ? (
          <p className="text-xs text-slate-400">No reviews yet — be the first.</p>
        ) : reviews.slice(0, 20).map((r) => (
          <div key={r.id} className="text-xs">
            <div className="text-amber-400">{stars(r.rating)} <span className="text-slate-300 font-medium">{r.customerName || 'Customer'}</span></div>
            {r.comment && <div className="text-slate-400">{r.comment}</div>}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mb-2">
        <select value={rating} onChange={(e) => setRating(Number(e.target.value))} className="h-8 px-2 rounded bg-white/5 border border-white/10 text-xs text-white">
          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n} className="bg-slate-800">{n} ★</option>)}
        </select>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="h-8 px-2 rounded bg-white/5 border border-white/10 text-xs text-white flex-1 min-w-0" />
      </div>
      <div className="flex items-center gap-2">
        <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Write a review…" className="h-8 px-2 rounded bg-white/5 border border-white/10 text-xs text-white flex-1 min-w-0" />
        <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700 shrink-0" onClick={submit} disabled={busy || !comment.trim()}>{busy ? '…' : 'Post'}</Button>
      </div>
    </div>
  );
}

export default function ErpShop({ data }: { data?: Record<string, unknown> }) {
  // Priority: prop > subdomain auto-detect > empty (shows SlugPicker)
  const initialSlug =
    (data?.slug as string | undefined) ||
    detectSubdomainSlug() ||
    '';

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
  const [orderReceipt, setOrderReceipt] = useState<string | null>(null);
  const [orderDiscount, setOrderDiscount] = useState<{ discountAmount: number; breakdown: Array<{ source: string; label: string; amount: number }> } | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [checkoutForm, setCheckoutForm] = useState<CheckoutForm>({
    name: '', phone: '', address: '', paymentMethod: 'cod',
  });
  // Top-level storefront view (home / collection / portal pages).
  const [view, setView] = useState<StorefrontView>('home');
  const [wishlistIds, setWishlistIds] = useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem('kobeshop:wishlist');
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });
  const [loyaltyPhone, setLoyaltyPhone] = useState('');

  useEffect(() => {
    try {
      window.localStorage.setItem('kobeshop:wishlist', JSON.stringify(wishlistIds));
    } catch {
      /* storage disabled */
    }
  }, [wishlistIds]);

  const toggleWishlist = (id: string) =>
    setWishlistIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const wishlistProducts = useMemo(() => products.filter((p) => wishlistIds.includes(p.id)), [products, wishlistIds]);

  // BNPL eligibility — fetched whenever the buyer picks BNPL + has a phone.
  const [bnplEligibility, setBnplEligibility] = useState<BnplEligibility | null>(null);
  const [bnplLoading, setBnplLoading] = useState(false);
  const [installmentMonths, setInstallmentMonths] = useState<number>(3);
  // Track-order dialog
  const [trackOpen, setTrackOpen] = useState(false);
  const [trackOrderNumber, setTrackOrderNumber] = useState('');
  const [trackPhone, setTrackPhone] = useState('');
  const [trackResult, setTrackResult] = useState<TrackedOrder | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [tracking, setTracking] = useState(false);

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

  // Pre-flight BNPL check: whenever the buyer is on the BNPL payment
  // option AND has typed a phone, ask the backend if they're eligible.
  // Debounced so each keystroke doesn't spam the credit lookup.
  useEffect(() => {
    if (!slug) return;
    if (checkoutForm.paymentMethod !== 'bnpl') {
      setBnplEligibility(null);
      return;
    }
    const phone = checkoutForm.phone.trim();
    if (!phone) {
      setBnplEligibility(null);
      return;
    }
    let cancelled = false;
    setBnplLoading(true);
    const timer = setTimeout(async () => {
      try {
        const r = await api<BnplEligibility>(
          `/store/${encodeURIComponent(slug)}/credit/eligibility?phone=${encodeURIComponent(phone)}`,
          { auth: false },
        );
        if (!cancelled) setBnplEligibility(r);
      } catch {
        if (!cancelled) setBnplEligibility({ eligible: false, availableCredit: 0, creditLimit: 0, currency: 'TZS' });
      } finally {
        if (!cancelled) setBnplLoading(false);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [slug, checkoutForm.paymentMethod, checkoutForm.phone]);

  const handleTrackOrder = async () => {
    if (!slug || !trackOrderNumber.trim() || !trackPhone.trim()) return;
    setTrackError(null);
    setTrackResult(null);
    setTracking(true);
    try {
      const r = await api<TrackedOrder>(
        `/store/${encodeURIComponent(slug)}/orders/${encodeURIComponent(trackOrderNumber.trim())}?phone=${encodeURIComponent(trackPhone.trim())}`,
        { auth: false },
      );
      setTrackResult(r);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTrackError(msg.includes('404') || /not found/i.test(msg)
        ? 'Order not found. Check the order number and phone you used at checkout.'
        : msg);
    } finally {
      setTracking(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!checkoutForm.name || !checkoutForm.phone || !checkoutForm.address) return;
    if (!slug || cart.length === 0) return;
    setOrderError(null);
    setPlacingOrder(true);
    // Map UI payment method codes to POS service's vocabulary.
    const paymentMethod =
      checkoutForm.paymentMethod === 'cod' ? 'CASH'
      : checkoutForm.paymentMethod === 'mobile' ? 'MOBILE'
      : checkoutForm.paymentMethod === 'bnpl' ? 'BNPL'
      : 'BANK';
    const isBnpl = paymentMethod === 'BNPL';
    const orderDto: Record<string, unknown> = {
      orderNumber: `SHOP-${Date.now().toString(36).toUpperCase()}`,
      lines: cart.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
      paymentMethod,
      couponCode: couponCode.trim() || undefined,
      customerName: checkoutForm.name,
      customerPhone: checkoutForm.phone,
    };
    if (isBnpl) orderDto.installmentMonths = installmentMonths;
    try {
      const sale = await api<{
        orderNumber: string;
        receipt?: { text: string };
        pickTicket?: { ticketNumber: string };
        discount?: { discountAmount: number; breakdown: Array<{ source: string; label: string; amount: number }> };
      }>(`/store/${slug}/orders`, {
        method: 'POST',
        auth: false,
        body: JSON.stringify(orderDto),
      });
      setOrderNumber(sale.orderNumber ?? orderDto.orderNumber);
      setOrderReceipt(sale.receipt?.text ?? null);
      setOrderDiscount(sale.discount ?? null);
      setIsCheckout(false);
      setOrderConfirmed(true);
      clearCart();
      setCheckoutForm({ name: '', phone: '', address: '', paymentMethod: 'cod' });
      setCouponCode('');
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : 'Order could not be placed. Try again.');
    } finally {
      setPlacingOrder(false);
    }
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
    <div className="h-full overflow-hidden">
      <JerseyShopChrome
        storeName={settings.storeName}
        tagline={settings.tagline}
        logoUrl={settings.logoUrl}
        bannerHeadline={settings.bannerHeadline}
        bannerSubtext={settings.bannerSubtext}
        bannerCta={settings.bannerCta}
        bannerVisible={view === 'home' && settings.bannerVisible}
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        cartCount={cartCount}
        onOpenCart={() => setIsCartOpen(true)}
        onGoStores={() => setSlug('')}
        onPickNav={(v) => setView(v as StorefrontView)}
        config={settings.jerseyConfig}
      >
      {/* ----- The dark "header" block below is retained only for the
            cart/track/back-to-stores actions on legacy callers; the new
            JerseyShopChrome above renders the visible header. Wrapped in
            `hidden` so it never appears. ----- */}
      <div className="hidden">
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
            onClick={() => { setTrackOpen(true); setTrackError(null); setTrackResult(null); }}
            className="h-8 px-2 text-xs hover:bg-white/10"
            title="Track an order"
          >
            <Package className="w-4 h-4 mr-1" />
            Track
          </Button>
          <Button
            variant="ghost" size="sm"
            onClick={() => setSlug('')}
            className="h-8 px-2 text-xs hover:bg-white/10"
          >
            Stores
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <ScrollArea className="h-full">
          {view === 'wishlist' ? (
            <WishlistPage
              products={wishlistProducts}
              onAddToCart={(p) => addToCart(p)}
              onRemove={(id) => toggleWishlist(id)}
            />
          ) : view === 'track-order' ? (
            <TrackOrderPage slug={slug} />
          ) : view === 'bnpl' ? (
            <BnplPage slug={slug} />
          ) : view === 'brands' ? (
            <BrandsPage slug={slug} onPickBrand={(brand) => setSelectedCategory(brand)} />
          ) : view === 'loyalty' ? (
            <LoyaltyPage phone={loyaltyPhone} setPhone={setLoyaltyPhone} />
          ) : (view === 'new-arrivals' || view === 'best-sellers' || view === 'offers') ? (
            <CollectionPage
              slug={slug}
              collectionSlug={view}
              title={view === 'new-arrivals' ? 'New Arrivals' : view === 'best-sellers' ? 'Best Sellers' : 'Offers'}
              empty={view === 'new-arrivals' ? 'No new arrivals yet.' : view === 'best-sellers' ? 'No best sellers yet.' : 'No offers yet.'}
              onAddToCart={(p) => addToCart(p)}
              onAddToWishlist={(p) => toggleWishlist(p.id)}
              wishlist={wishlistIds}
            />
          ) : (
            <>
              <div className={`grid gap-4 p-6 ${gridClass}`}>
                {filteredProducts.map((p) => (
                  <JerseyProductCard
                    key={p.id}
                    product={p}
                    wished={wishlistIds.includes(p.id)}
                    onOpen={(prod) => setSelectedProduct(prod)}
                    onAddToCart={(prod) => addToCart(prod)}
                    onAddToWishlist={(prod) => toggleWishlist(prod.id)}
                  />
                ))}
              </div>
              {filteredProducts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                  <ShoppingBag className="w-10 h-10 mb-3 opacity-40" />
                  <p className="font-medium">No products found</p>
                </div>
              )}
            </>
          )}
        </ScrollArea>
      </div>
      </JerseyShopChrome>

      {/* Product Detail Dialog */}
      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          {selectedProduct && (
            <>
              <DialogHeader><DialogTitle>{selectedProduct.name}</DialogTitle></DialogHeader>
              <div className={`h-40 rounded-lg bg-gradient-to-br ${productGradient(selectedProduct.category)} flex items-center justify-center mb-4`}>
                {selectedProduct.imageUrl ? <img src={selectedProduct.imageUrl} alt="" className="h-full w-full object-cover rounded-lg" /> : <Package className="w-16 h-16 text-white/50" />}
              </div>
              <div className="space-y-2 text-sm">
                <p><span className="text-slate-400">SKU:</span> {selectedProduct.sku}</p>
                <p><span className="text-slate-400">Category:</span> {selectedProduct.category}</p>
                <p className="text-2xl font-bold text-blue-400">{formatPrice(selectedProduct.price, selectedProduct.currency)}</p>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${getStockColor(selectedProduct.stock)}`} />
                  <span>{getStockLabel(selectedProduct.stock)} ({selectedProduct.stock} available)</span>
                </div>
              </div>
              <Button
                onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }}
                disabled={selectedProduct.stock <= 0}
                className="w-full mt-4 bg-blue-600 hover:bg-blue-700"
              >
                Add to Cart
              </Button>
              {slug && <ProductReviews slug={slug} productId={selectedProduct.id} />}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Cart Dialog */}
      <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader><DialogTitle>Shopping Cart</DialogTitle></DialogHeader>
          {cart.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-40" />
              Your cart is empty
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {cart.map((item) => (
                <Card key={item.product.id} className="bg-white/5 border-white/10">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{item.product.name}</p>
                      <p className="text-sm text-blue-400">{formatPrice(item.product.price, item.product.currency)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => updateQuantity(item.product.id, -1)} className="h-7 w-7">
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-6 text-center text-sm">{item.quantity}</span>
                      <Button size="icon" variant="ghost" onClick={() => updateQuantity(item.product.id, 1)} className="h-7 w-7">
                        <Plus className="w-3 h-3" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => removeFromCart(item.product.id)} className="h-7 w-7 text-red-400">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {cart.length > 0 && (
            <div className="border-t border-white/10 pt-4 space-y-3">
              <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatPrice(cartTotal, products[0]?.currency ?? 'TZS')}</span></div>
              <div className="flex justify-between text-sm"><span>Shipping</span><span>{formatPrice(SHIPPING_COST, products[0]?.currency ?? 'TZS')}</span></div>
              <div className="flex justify-between text-lg font-bold"><span>Total</span><span>{formatPrice(cartTotal + SHIPPING_COST, products[0]?.currency ?? 'TZS')}</span></div>
              <Button onClick={handleCheckout} className="w-full bg-blue-600 hover:bg-blue-700">Checkout</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Checkout Dialog */}
      <Dialog open={isCheckout} onOpenChange={setIsCheckout}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader><DialogTitle>Checkout</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Full Name" value={checkoutForm.name} onChange={(e) => setCheckoutForm({ ...checkoutForm, name: e.target.value })} className="bg-white/10 border-white/20 text-white" />
            <Input placeholder="Phone Number" value={checkoutForm.phone} onChange={(e) => setCheckoutForm({ ...checkoutForm, phone: e.target.value })} className="bg-white/10 border-white/20 text-white" />
            <Input placeholder="Delivery Address" value={checkoutForm.address} onChange={(e) => setCheckoutForm({ ...checkoutForm, address: e.target.value })} className="bg-white/10 border-white/20 text-white" />
            <Input placeholder="Coupon code (optional)" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} className="bg-white/10 border-white/20 text-white" />
            <div>
              <p className="text-sm text-slate-400 mb-2">Payment Method</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'cod', label: 'Cash on Delivery', icon: Banknote },
                  { id: 'mobile', label: 'Mobile Money', icon: Smartphone },
                  { id: 'bank', label: 'Bank Transfer', icon: Building2 },
                  { id: 'bnpl', label: 'Buy Now Pay Later', icon: CreditCard },
                ].map((m) => (
                  <Button
                    key={m.id}
                    variant={checkoutForm.paymentMethod === m.id ? 'default' : 'outline'}
                    onClick={() => setCheckoutForm({ ...checkoutForm, paymentMethod: m.id as CheckoutForm['paymentMethod'] })}
                    className={checkoutForm.paymentMethod === m.id ? 'bg-blue-600' : 'border-white/20 text-white'}
                  >
                    <m.icon className="w-4 h-4 mr-1" />
                    <span className="text-xs">{m.label}</span>
                  </Button>
                ))}
              </div>
            </div>

            {checkoutForm.paymentMethod === 'bnpl' && (
              <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-medium">BNPL eligibility</span>
                  {bnplLoading && <Loader2 className="w-4 h-4 animate-spin text-blue-300" />}
                </div>
                {!checkoutForm.phone.trim() ? (
                  <p className="text-slate-400">Enter buyer phone to check available credit.</p>
                ) : bnplEligibility?.eligible ? (
                  <div className="text-emerald-300 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 mt-0.5" />
                    <span>Eligible — available credit {formatPrice(Number(bnplEligibility.availableCredit), bnplEligibility.currency)}</span>
                  </div>
                ) : (
                  <div className="text-amber-300 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5" />
                    <span>Not eligible yet{bnplEligibility?.reason ? ` (${bnplEligibility.reason})` : ''}. Choose another payment method or create a credit profile.</span>
                  </div>
                )}
                <label className="block text-xs text-slate-400">
                  Installment months
                  <select
                    value={installmentMonths}
                    onChange={(e) => setInstallmentMonths(Number(e.target.value))}
                    className="mt-1 w-full rounded bg-slate-800 border border-white/10 p-2 text-white"
                  >
                    {[1, 2, 3, 6, 12].map((m) => <option key={m} value={m}>{m} month{m > 1 ? 's' : ''}</option>)}
                  </select>
                </label>
              </div>
            )}

            <div className="border-t border-white/10 pt-3">
              <div className="flex justify-between font-bold"><span>Total</span><span>{formatPrice(cartTotal + SHIPPING_COST, products[0]?.currency ?? 'TZS')}</span></div>
              {orderDiscount && orderDiscount.discountAmount > 0 && (
                <div className="text-xs text-emerald-300 mt-1">Discount applied: {formatPrice(orderDiscount.discountAmount, products[0]?.currency ?? 'TZS')}</div>
              )}
              {orderError && <div className="text-xs text-red-300 mt-2">{orderError}</div>}
            </div>
            <Button
              onClick={handlePlaceOrder}
              disabled={!checkoutForm.name || !checkoutForm.phone || !checkoutForm.address || placingOrder || (checkoutForm.paymentMethod === 'bnpl' && bnplEligibility?.eligible === false)}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50"
            >
              {placingOrder && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Place Order
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={orderConfirmed} onOpenChange={setOrderConfirmed}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <div className="text-center py-6">
            <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Order Confirmed!</h2>
            <p className="text-slate-400 mb-2">Your order number is</p>
            <p className="text-2xl font-mono font-bold text-blue-400 mb-4">{orderNumber}</p>
            {orderReceipt && (
              <pre className="text-left text-xs bg-black/40 rounded-lg p-3 overflow-auto max-h-40 whitespace-pre-wrap mb-4">{orderReceipt}</pre>
            )}
            <p className="text-sm text-slate-500">We will contact you shortly to confirm delivery.</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
