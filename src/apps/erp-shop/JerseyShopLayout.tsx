import { useMemo } from 'react';
import { ShoppingCart, Search, User, Heart, ChevronRight, Truck, Shield, RotateCcw, Star } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/**
 * projerseyshop.es-style storefront chrome — top promo bar, multi-tier
 * header, banded hero, category icon row, square product cards with
 * badges, trust strip, multi-column footer.
 *
 * The container takes a `children` slot for the product grid so the host
 * page (erp-shop) keeps owning data fetching, cart state and routing.
 * `Product` is the same shape the existing storefront already uses.
 */
export interface JerseyProduct {
  id: string;
  name: string;
  sku: string;
  price: number;
  compareAtPrice?: number | null;
  stock: number;
  category: string;
  imageUrl?: string | null;
  currency: string;
  brand?: string | null;
  tags?: string[];
  publishedAt?: string | null;
  featured?: boolean;
}

export function JerseyShopChrome({
  storeName,
  tagline,
  logoUrl,
  bannerHeadline,
  bannerSubtext,
  bannerCta,
  categories,
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  cartCount,
  onOpenCart,
  onGoStores,
  onPickNav,
  children,
}: {
  storeName: string;
  tagline?: string;
  logoUrl?: string;
  bannerHeadline?: string;
  bannerSubtext?: string;
  bannerCta?: string;
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  cartCount: number;
  onOpenCart: () => void;
  onGoStores: () => void;
  onPickNav?: (view: 'new-arrivals' | 'offers' | 'brands' | 'wishlist' | 'track-order') => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-full bg-white text-slate-900 overflow-y-auto">
      {/* Top promo bar — currency selector + signup CTA, projerseyshop style. */}
      <div className="bg-slate-900 text-white text-[11px]">
        <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center justify-between gap-3">
          <span className="text-white/70 hidden md:inline">Free worldwide shipping over $50 · 30-day returns</span>
          <div className="flex items-center gap-3">
            <span className="text-amber-300 font-semibold">SIGN UP & GET 15% OFF</span>
            <select className="bg-transparent border-none text-[11px] focus:outline-none">
              <option>USD</option>
              <option>TZS</option>
              <option>EUR</option>
              <option>GBP</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <button onClick={onGoStores} className="flex items-center gap-2 shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt={storeName} className="h-9 w-9 rounded object-cover" />
            ) : (
              <div className="h-9 w-9 rounded bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-bold text-sm">
                {storeName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <div className="text-base font-bold leading-tight">{storeName}</div>
              {tagline && <div className="text-[10px] text-slate-500">{tagline}</div>}
            </div>
          </button>
          <div className="flex-1 max-w-2xl relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search products, brands, categories…"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 h-10 bg-slate-100 border-slate-200 text-sm"
            />
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPickNav?.('wishlist')}
              className="p-2 hover:bg-slate-100 rounded"
              title="Wishlist"
            >
              <Heart className="w-5 h-5 text-slate-700" />
            </button>
            <button
              onClick={() => onPickNav?.('track-order')}
              className="hidden md:flex items-center gap-1 text-xs text-slate-700 px-2 hover:bg-slate-100 rounded h-9"
            >
              <User className="w-4 h-4" /> Track order
            </button>
            <button onClick={onOpenCart} className="relative p-2 hover:bg-slate-100 rounded">
              <ShoppingCart className="w-5 h-5 text-slate-700" />
              {cartCount > 0 && (
                <span className="absolute -top-0 -right-0 bg-rose-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
        {/* Primary category nav */}
        <nav className="border-t border-slate-100 bg-white">
          <div className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => onSelectCategory(cat)}
                className={`px-3 py-2.5 text-[12px] font-semibold uppercase tracking-wide whitespace-nowrap border-b-2 ${
                  selectedCategory === cat
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-700 hover:text-blue-700'
                }`}
              >
                {cat}
              </button>
            ))}
            <button
              onClick={() => onPickNav?.('new-arrivals')}
              className="ml-auto px-3 py-2.5 text-[12px] font-semibold uppercase text-amber-700 whitespace-nowrap"
            >
              New arrivals
            </button>
            <button
              onClick={() => onPickNav?.('offers')}
              className="px-3 py-2.5 text-[12px] font-semibold uppercase text-rose-700 whitespace-nowrap"
            >
              Hot offers
            </button>
          </div>
        </nav>
      </header>

      {/* Hero banner */}
      {bannerHeadline && (
        <section className="bg-gradient-to-br from-blue-700 via-indigo-700 to-fuchsia-700 text-white">
          <div className="max-w-7xl mx-auto px-4 py-12 md:py-16 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-3 text-center md:text-left">
              <div className="inline-block bg-amber-300/90 text-amber-950 text-[10px] uppercase font-bold px-2 py-1 rounded">
                Featured collection
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{bannerHeadline}</h2>
              {bannerSubtext && <p className="text-base md:text-lg text-white/85">{bannerSubtext}</p>}
              {bannerCta && (
                <Button className="bg-white text-blue-700 hover:bg-slate-100 font-bold h-11 px-6">
                  {bannerCta} <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
            <div className="hidden md:block">
              <div className="w-64 h-64 rounded-2xl bg-white/10 border border-white/20 backdrop-blur flex items-center justify-center text-white/40 text-sm">
                Banner image
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Category icon strip */}
      <section className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4 grid grid-cols-3 md:grid-cols-6 gap-3">
          {categories.slice(0, 6).map((cat) => (
            <button
              key={cat}
              onClick={() => onSelectCategory(cat)}
              className="flex flex-col items-center gap-1.5 hover:opacity-80 transition"
            >
              <div
                className={`w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center text-2xl font-bold ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white ring-4 ring-blue-200'
                    : 'bg-white border border-slate-200 text-slate-700'
                }`}
              >
                {cat.slice(0, 1).toUpperCase()}
              </div>
              <span className="text-[11px] font-medium text-slate-700 text-center">{cat}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Trust strip */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-[12px]">
          <TrustItem icon={<Truck className="w-4 h-4" />} title="Fast shipping" desc="Same-day dispatch on orders before 2pm" />
          <TrustItem icon={<Shield className="w-4 h-4" />} title="Authentic" desc="Sourced direct from suppliers" />
          <TrustItem icon={<RotateCcw className="w-4 h-4" />} title="30-day returns" desc="No-questions money-back" />
          <TrustItem icon={<Star className="w-4 h-4" />} title="Excellent reviews" desc="4.8 / 5 from 12,400+ customers" />
        </div>
      </section>

      {/* Product grid (host-provided) */}
      <main className="flex-1 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 py-6">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 text-xs">
        <div className="max-w-7xl mx-auto px-4 py-10 grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <h4 className="text-white font-bold text-sm mb-2">{storeName}</h4>
            <p className="text-slate-400">{tagline ?? 'Quality products, fast delivery.'}</p>
            <p className="text-slate-500 mt-3">© {new Date().getFullYear()} {storeName}</p>
          </div>
          <FooterCol title="Shop" items={categories.slice(0, 5)} onPick={onSelectCategory} />
          <div>
            <h4 className="text-white font-bold text-sm mb-2">Support</h4>
            <ul className="space-y-1 text-slate-400">
              <li><button onClick={() => onPickNav?.('track-order')} className="hover:text-white">Track order</button></li>
              <li><button onClick={() => onPickNav?.('wishlist')} className="hover:text-white">Wishlist</button></li>
              <li>Shipping &amp; returns</li>
              <li>Contact us</li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold text-sm mb-2">Stay in the loop</h4>
            <p className="text-slate-400 mb-2">15% off your first order when you sign up.</p>
            <div className="flex gap-1">
              <Input placeholder="your@email.com" className="h-8 bg-white/5 border-white/10 text-white text-xs" />
              <Button size="sm" className="bg-amber-500 text-amber-950 hover:bg-amber-400 h-8">Join</Button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, items, onPick }: { title: string; items: string[]; onPick: (item: string) => void }) {
  return (
    <div>
      <h4 className="text-white font-bold text-sm mb-2">{title}</h4>
      <ul className="space-y-1 text-slate-400">
        {items.map((i) => (
          <li key={i}><button onClick={() => onPick(i)} className="hover:text-white text-left">{i}</button></li>
        ))}
      </ul>
    </div>
  );
}

function TrustItem({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="text-blue-600 mt-0.5">{icon}</div>
      <div>
        <div className="font-semibold text-slate-800">{title}</div>
        <div className="text-slate-500 text-[11px]">{desc}</div>
      </div>
    </div>
  );
}

// ── Product card matching the jersey-shop look ──────────────────────────────

export function JerseyProductCard({
  product,
  onAddToCart,
  onAddToWishlist,
  onOpen,
  wished,
}: {
  product: JerseyProduct;
  onAddToCart: (p: JerseyProduct) => void;
  onAddToWishlist: (p: JerseyProduct) => void;
  onOpen: (p: JerseyProduct) => void;
  wished: boolean;
}) {
  const onSale = (product.compareAtPrice ?? 0) > product.price;
  const newRecent = useMemo(() => {
    if (!product.publishedAt) return false;
    const days = (Date.now() - new Date(product.publishedAt).getTime()) / (1000 * 60 * 60 * 24);
    return days <= 14;
  }, [product.publishedAt]);

  return (
    <div className="group bg-white rounded-lg border border-slate-200 overflow-hidden flex flex-col hover:shadow-lg transition-shadow">
      <button onClick={() => onOpen(product)} className="relative aspect-square bg-slate-100 overflow-hidden">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs">No image</div>
        )}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.featured && (
            <Badge className="bg-amber-500 hover:bg-amber-500 text-amber-950 text-[9px] font-bold uppercase">Featured</Badge>
          )}
          {newRecent && (
            <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white text-[9px] font-bold uppercase">New</Badge>
          )}
          {onSale && (
            <Badge className="bg-rose-500 hover:bg-rose-500 text-white text-[9px] font-bold uppercase">Hot offer</Badge>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onAddToWishlist(product); }}
          className={`absolute top-2 right-2 p-1.5 rounded-full ${wished ? 'bg-rose-500 text-white' : 'bg-white/90 text-slate-700 hover:bg-white'}`}
          title="Add to wishlist"
        >
          <Heart className={`w-3.5 h-3.5 ${wished ? 'fill-current' : ''}`} />
        </button>
      </button>
      <div className="p-3 flex-1 flex flex-col gap-1">
        {product.brand && (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-700">{product.brand}</span>
        )}
        <h3 onClick={() => onOpen(product)} className="text-sm font-medium text-slate-900 line-clamp-2 leading-snug cursor-pointer hover:text-blue-700">
          {product.name}
        </h3>
        <div className="flex items-end gap-2 mt-auto pt-1">
          <span className="text-base font-bold text-slate-900">
            {product.currency} {Number(product.price).toLocaleString()}
          </span>
          {onSale && (
            <span className="text-xs text-slate-400 line-through">
              {product.currency} {Number(product.compareAtPrice).toLocaleString()}
            </span>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => onAddToCart(product)}
          disabled={product.stock <= 0}
          className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs mt-1"
        >
          <ShoppingCart className="w-3.5 h-3.5 mr-1.5" />
          {product.stock <= 0 ? 'Out of stock' : 'Add to cart'}
        </Button>
      </div>
    </div>
  );
}
