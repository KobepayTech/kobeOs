import { useMemo, useState } from 'react';
import {
  ShoppingCart,
  Search,
  User,
  Heart,
  ChevronRight,
  Truck,
  RotateCcw,
  Star,
  Facebook,
  Youtube,
  Instagram,
  Smartphone,
  Award,
  Globe,
  Clock,
  CreditCard,
  Package,
  Trophy,
  Gift,
  Sparkles,
  ShieldCheck,
  CircleDot,
  Fuel,
  Mail,
  ChevronLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

/* ─── Types ─────────────────────────────────────────────────────────── */

export interface JerseyConfig {
  topPromo?: { text?: string; ctaText?: string; bgColor?: string };
  hero?: {
    headline?: string;
    subtext?: string;
    cta?: string;
    imageUrl?: string;
    gradientFrom?: string;
    gradientTo?: string;
  };
  trustStrip?: Array<{
    icon: 'truck' | 'shield' | 'rotate' | 'star';
    title: string;
    desc: string;
  }>;
  footerColumns?: Array<{
    title: string;
    items: Array<{ label: string; href?: string }>;
  }>;
  newsletterPitch?: string;
  tiers?: Array<{
    slug: string;
    label: string;
    parentSlug?: string;
    href?: string;
  }>;
  paymentLogos?: Array<
    'visa' | 'mastercard' | 'amex' | 'paypal' | 'mpesa' | 'tigopesa' | 'airtelmoney' | 'kobepay'
  >;
  languages?: Array<{ code: string; label: string }>;
  trustpilot?: { businessUnitId?: string; templateId?: string };
}

export interface JerseyProduct {
  id: string;
  name: string;
  sku: string;
  price: number;
  priceMin?: number | null;
  priceMax?: number | null;
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

interface JerseyShopChromeProps {
  storeName: string;
  tagline?: string;
  logoUrl?: string;
  bannerHeadline?: string;
  bannerSubtext?: string;
  bannerCta?: string;
  bannerVisible?: boolean;
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  cartCount: number;
  onOpenCart: () => void;
  onGoStores: () => void;
  onPickNav?: (
    view: 'new-arrivals' | 'offers' | 'brands' | 'wishlist' | 'track-order',
  ) => void;
  config?: JerseyConfig;
  children: React.ReactNode;
}

/* ─── Announcement Bar ──────────────────────────────────────────────── */

export function AnnouncementBar() {
  return (
    <div className="bg-[#f5f5f5] text-[11px] text-[#666] border-b border-[#e5e5e5]">
      <div className="max-w-7xl mx-auto px-4 py-1.5">
        {/* Row 1 */}
        <div className="flex items-center justify-center gap-2 mb-1">
          <select
            className="bg-transparent border-none text-[11px] text-[#666] focus:outline-none cursor-pointer"
            aria-label="Currency"
            defaultValue="USD"
          >
            <option>USD / US$</option>
            <option>EUR / €</option>
            <option>GBP / £</option>
          </select>
          <span className="text-[#ccc]">|</span>
          <select
            className="bg-transparent border-none text-[11px] text-[#666] focus:outline-none cursor-pointer"
            aria-label="Language"
            defaultValue="en"
          >
            <option value="en">Language: English</option>
            <option value="es">Language: Español</option>
            <option value="fr">Language: Français</option>
          </select>
          <span className="text-[#ccc]">|</span>
          <button className="hover:text-[#c8102e] transition-colors">
            Contact us
          </button>
        </div>
        {/* Row 2 */}
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="font-semibold text-[#1a1a1a]">
            SIGN UP GET 15% OFF
          </span>
          <button className="border border-[#999] text-[#1a1a1a] px-3 py-0.5 text-[11px] font-medium hover:border-[#c8102e] hover:text-[#c8102e] transition-colors">
            Sign up
          </button>
        </div>
        {/* Row 3 */}
        <div className="flex items-center justify-center gap-2">
          <span className="flex items-center gap-1">
            <Truck className="w-3 h-3" />
            Free Shipping Worldwide
          </span>
          <span className="text-[#ccc]">|</span>
          <button className="underline hover:text-[#c8102e] transition-colors">
            See terms
          </button>
          <span className="text-[#ccc]">|</span>
          <span className="flex items-center gap-1">
            <Gift className="w-3 h-3" />
            Buy 3 Get 1 Free
          </span>
          <span className="text-[#ccc]">|</span>
          <button className="underline hover:text-[#c8102e] transition-colors">
            Shop Now
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Header ────────────────────────────────────────────────────────── */

/** Renders a store's name as a two-tone wordmark (first word accented),
 *  so the storefront brand tracks the actual store name. */
function StoreWordmark({ name, accent, rest }: { name: string; accent: string; rest: string }) {
  const parts = (name || 'My Store').trim().split(/\s+/);
  return (
    <span className="text-[22px] font-black tracking-wider" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <span style={{ color: accent }}>{parts[0].toUpperCase()}</span>
      {parts.length > 1 && <span style={{ color: rest }}> {parts.slice(1).join(' ').toUpperCase()}</span>}
    </span>
  );
}

export function Header({
  storeName,
  logoUrl,
  searchQuery,
  onSearchChange,
  cartCount,
  onOpenCart,
  onPickNav,
}: {
  storeName: string;
  logoUrl?: string;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  cartCount: number;
  onOpenCart: () => void;
  onPickNav?: JerseyShopChromeProps['onPickNav'];
}) {
  return (
    <header className="bg-white border-b border-[#e5e5e5]">
      <div className="max-w-7xl mx-auto px-4 h-[70px] flex items-center gap-6">
        {/* Logo — the store's own name/logo (was hardcoded "PRO JERSEY SHOP"). */}
        <a href="/" className="shrink-0 flex items-center gap-2">
          {logoUrl && <img src={logoUrl} alt={storeName} className="h-9 w-auto max-w-[140px] object-contain" />}
          {!logoUrl && <StoreWordmark name={storeName} accent="#c8102e" rest="#1a1a1a" />}
        </a>

        {/* Search */}
        <div className="flex-1 max-w-xl relative">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#999]" />
          <input
            type="text"
            placeholder="Search Your Favourite Gears"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-full bg-gray-100 border border-gray-200 text-sm text-[#1a1a1a] placeholder:text-[#999] focus:outline-none focus:border-[#c8102e] focus:ring-1 focus:ring-[#c8102e] transition-all"
          />
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-5 text-[12px] text-[#1a1a1a]">
          <button
            onClick={() => onPickNav?.('track-order')}
            className="hidden lg:flex items-center gap-1.5 hover:text-[#c8102e] transition-colors"
          >
            <Truck className="w-4 h-4" />
            Track Order
          </button>
          <button className="hidden lg:flex items-center gap-1.5 hover:text-[#c8102e] transition-colors">
            <Smartphone className="w-4 h-4" />
            Download App
          </button>
          <button
            onClick={() => onPickNav?.('track-order')}
            className="flex items-center gap-1.5 hover:text-[#c8102e] transition-colors"
          >
            <User className="w-4 h-4" />
            Login
          </button>
          <button
            onClick={onOpenCart}
            className="relative flex items-center gap-1.5 hover:text-[#c8102e] transition-colors"
          >
            <ShoppingCart className="w-4 h-4" />
            Cart
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-[#c8102e] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

/* ─── Main Nav ──────────────────────────────────────────────────────── */

export function MainNav({
  categories,
  selectedCategory,
  onSelectCategory,
}: {
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
}) {
  // Build the nav from the store's REAL product categories (+ an "All" reset),
  // so clicking a tab actually filters the grid. Previously this used a
  // hardcoded jersey list whose labels never matched any DB category, so every
  // tab showed an empty grid. Hidden when the store has no products yet.
  // `categories` already includes an "All" reset. Hide the nav entirely when
  // there are no real categories yet (empty store) — no lone "All" tab.
  const realCats = (categories ?? []).filter((c) => c !== 'All');
  if (realCats.length === 0) return null;
  const items = ['All', ...realCats];
  return (
    <nav className="bg-white border-t border-b border-[#e5e5e5]">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-0 overflow-x-auto">
        {items.map((item) => {
          const isActive = selectedCategory === item;
          return (
            <button
              key={item}
              onClick={() => onSelectCategory(item)}
              className={`px-4 h-12 text-[13px] font-bold uppercase tracking-wide whitespace-nowrap border-b-2 transition-colors ${
                isActive
                  ? 'border-[#c8102e] text-[#c8102e]'
                  : 'border-transparent text-[#1a1a1a] hover:text-[#c8102e]'
              }`}
            >
              {item}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* ─── Category Quick Icons ──────────────────────────────────────────── */

// Rotating icon/gradient styling applied to the store's REAL categories, so
// each quick-icon actually filters the grid (previously these were hardcoded
// marketing labels with no onClick — clicking did nothing).
const QUICK_ICON_SET = [CircleDot, Trophy, Gift, Sparkles, Star, Fuel];
const QUICK_ICON_GRADIENTS = [
  'from-green-400 to-green-600',
  'from-amber-400 to-amber-600',
  'from-red-400 to-red-600',
  'from-blue-400 to-blue-600',
  'from-violet-400 to-violet-600',
  'from-orange-400 to-orange-600',
];

export function CategoryIcons({
  categories,
  selectedCategory,
  onSelectCategory,
}: {
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
}) {
  // Quick-icons are for REAL categories only — never the "All" reset (that
  // was the stray green circle). Hidden when the store has no categories yet.
  const items = (categories ?? []).filter((c) => c !== 'All').slice(0, 8);
  if (items.length === 0) return null;
  return (
    <section className="bg-white border-b border-[#e5e5e5]">
      <div className="max-w-7xl mx-auto px-4 py-5">
        <div className="flex items-center justify-center gap-8 md:gap-12 overflow-x-auto">
          {items.map((label, i) => {
            const Icon = QUICK_ICON_SET[i % QUICK_ICON_SET.length];
            const gradient = QUICK_ICON_GRADIENTS[i % QUICK_ICON_GRADIENTS.length];
            const isActive = selectedCategory === label;
            return (
              <button
                key={label}
                onClick={() => onSelectCategory(label)}
                className="flex flex-col items-center gap-2 group shrink-0"
              >
                <div
                  className={`w-14 h-14 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform ${
                    isActive ? 'ring-2 ring-offset-2 ring-[#c8102e]' : ''
                  }`}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <span
                  className={`text-[12px] font-medium whitespace-nowrap ${
                    isActive ? 'text-[#c8102e]' : 'text-[#1a1a1a]'
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── Hero Banner ───────────────────────────────────────────────────── */

export function HeroBanner({
  config,
  bannerHeadline,
  bannerSubtext,
  bannerCta,
  bannerVisible,
}: {
  config?: JerseyConfig;
  bannerHeadline?: string;
  bannerSubtext?: string;
  bannerCta?: string;
  bannerVisible?: boolean;
}) {
  if (!bannerVisible) return null;

  const hero = {
    headline:
      config?.hero?.headline ?? bannerHeadline ?? '2026 WORLD CUP',
    subtext:
      config?.hero?.subtext ??
      bannerSubtext ??
      'UPGRADE YOUR JERSEY WITH SLEEVE BADGES',
    cta: config?.hero?.cta ?? bannerCta ?? 'SHOP NOW',
    imageUrl: config?.hero?.imageUrl,
    gradientFrom: config?.hero?.gradientFrom ?? '#1a1a2e',
    gradientTo: config?.hero?.gradientTo ?? '#16213e',
  };

  return (
    <section
      className="relative text-white overflow-hidden"
      style={{
        background: hero.imageUrl
          ? undefined
          : `linear-gradient(135deg, ${hero.gradientFrom}, ${hero.gradientTo})`,
      }}
    >
      {hero.imageUrl && (
        <img
          src={hero.imageUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      <div
        className={`relative max-w-7xl mx-auto px-4 py-16 md:py-20 flex flex-col items-center text-center gap-4 ${
          hero.imageUrl ? 'bg-black/40' : ''
        }`}
      >
        <p className="text-sm md:text-base tracking-[0.2em] uppercase text-white/80">
          UPGRADE YOUR JERSEY WITH
        </p>
        <h2
          className="text-4xl md:text-6xl font-black tracking-tight"
          style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}
        >
          {hero.headline}
        </h2>
        <p className="text-lg md:text-xl tracking-[0.15em] uppercase text-white/90">
          SLEEVE BADGES
        </p>
        <button className="mt-4 px-10 py-3 bg-[#c9a96e] hover:bg-[#b8985e] text-[#1a1a1a] font-bold text-sm uppercase tracking-wide rounded transition-colors shadow-lg">
          {hero.cta}
        </button>
      </div>
    </section>
  );
}

/* ─── Section Title ─────────────────────────────────────────────────── */

export function SectionTitle({
  title,
  onMore,
}: {
  title: string;
  onMore?: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b-2 border-[#e5e5e5] pb-3 mb-5">
      <h2 className="text-xl font-bold text-[#1a1a1a]">{title}</h2>
      {onMore && (
        <button
          onClick={onMore}
          className="flex items-center gap-1 text-[13px] text-[#666] hover:text-[#c8102e] transition-colors"
        >
          MORE
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

/* ─── Product Card ──────────────────────────────────────────────────── */

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
  const newRecent = useMemo(() => {
    if (!product.publishedAt) return false;
    const days =
      (Date.now() - new Date(product.publishedAt).getTime()) /
      (1000 * 60 * 60 * 24);
    return days <= 14;
  }, [product.publishedAt]);

  const hasRange =
    product.priceMin != null &&
    product.priceMax != null &&
    product.priceMin !== product.priceMax;

  const displayPrice = hasRange
    ? `${product.currency}$${Number(product.priceMin).toFixed(2)} ~ ${product.currency}$${Number(product.priceMax).toFixed(2)}`
    : `${product.currency}$${Number(product.price).toFixed(2)}`;

  // Derive badge from tags
  const badgeTag = product.tags?.find((t) =>
    ['26/27', 'World Cup', 'TOP SALE', 'NEW'].includes(t),
  );
  const badgeColor: Record<string, string> = {
    '26/27': 'bg-blue-600',
    'World Cup': 'bg-red-600',
    'TOP SALE': 'bg-amber-500',
    NEW: 'bg-emerald-500',
  };

  return (
    <div className="group bg-white rounded-lg border border-[#e5e5e5] overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      {/* Image area */}
      <button
        onClick={() => onOpen(product)}
        className="relative aspect-square bg-[#f8f8f8] overflow-hidden"
      >
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#ccc] text-xs">
            <Package className="w-10 h-10" />
          </div>
        )}

        {/* Badge top-right */}
        {badgeTag && (
          <span
            className={`absolute top-2 right-2 ${badgeColor[badgeTag] ?? 'bg-blue-600'} text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase`}
          >
            {badgeTag}
          </span>
        )}

        {/* Wishlist button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddToWishlist(product);
          }}
          className={`absolute top-2 left-2 p-1.5 rounded-full transition-colors ${
            wished
              ? 'bg-[#c8102e] text-white'
              : 'bg-white/90 text-[#999] hover:bg-white hover:text-[#c8102e]'
          }`}
          title="Add to wishlist"
        >
          <Heart className={`w-3.5 h-3.5 ${wished ? 'fill-current' : ''}`} />
        </button>

        {/* Hover overlay - Quick View */}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpen(product);
            }}
            className="px-6 py-2 bg-white text-[#1a1a1a] text-xs font-bold uppercase tracking-wide rounded hover:bg-[#f5f5f5] transition-colors"
          >
            QUICK VIEW
          </button>
        </div>
      </button>

      {/* Info area */}
      <div className="p-3 flex-1 flex flex-col gap-1.5">
        <h3
          onClick={() => onOpen(product)}
          className="text-[13px] text-[#1a1a1a] line-clamp-2 leading-snug cursor-pointer hover:text-[#c8102e] transition-colors min-h-[2.5rem]"
        >
          {product.name}
        </h3>

        <div className="text-[15px] font-bold text-[#1a1a1a]">
          {displayPrice}
        </div>

        {/* Star rating placeholder */}
        <div className="flex items-center gap-1">
          <div className="flex">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className="w-3 h-3 text-amber-400 fill-amber-400"
              />
            ))}
          </div>
          <span className="text-[11px] text-[#999]">(211)</span>
        </div>

        <Button
          size="sm"
          onClick={() => onAddToCart(product)}
          disabled={product.stock <= 0}
          className="bg-[#c8102e] hover:bg-[#a00d24] text-white h-8 text-[11px] mt-1 font-bold uppercase tracking-wide"
        >
          <ShoppingCart className="w-3.5 h-3.5 mr-1.5" />
          {product.stock <= 0 ? 'OUT OF STOCK' : 'ADD TO CART'}
        </Button>
      </div>
    </div>
  );
}

/* ─── Product Section (carousel/grid) ───────────────────────────────── */

export function ProductSection({
  title,
  products,
  onMore,
  onAddToCart,
  onAddToWishlist,
  onOpenProduct,
  wishlistIds,
  variant = 'carousel',
}: {
  title: string;
  products: JerseyProduct[];
  onMore?: () => void;
  onAddToCart: (p: JerseyProduct) => void;
  onAddToWishlist: (p: JerseyProduct) => void;
  onOpenProduct: (p: JerseyProduct) => void;
  wishlistIds: Set<string>;
  variant?: 'carousel' | 'grid';
}) {
  const [scrollRef, setScrollRef] = useState<HTMLDivElement | null>(null);

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef) return;
    const amount = 300;
    scrollRef.scrollBy({
      left: dir === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  };

  if (products.length === 0) return null;

  return (
    <section className="py-8">
      <div className="max-w-7xl mx-auto px-4">
        <SectionTitle title={title} onMore={onMore} />

        {variant === 'carousel' ? (
          <div className="relative">
            {/* Arrow left */}
            <button
              onClick={() => scroll('left')}
              className="absolute -left-3 top-[40%] z-10 w-8 h-8 bg-white border border-[#e5e5e5] rounded-full flex items-center justify-center shadow hover:border-[#c8102e] hover:text-[#c8102e] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div
              ref={setScrollRef}
              className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide scroll-smooth"
              style={{ scrollbarWidth: 'none' }}
            >
              {products.map((product) => (
                <div key={product.id} className="w-[220px] md:w-[260px] shrink-0">
                  <JerseyProductCard
                    product={product}
                    onAddToCart={onAddToCart}
                    onAddToWishlist={onAddToWishlist}
                    onOpen={onOpenProduct}
                    wished={wishlistIds.has(product.id)}
                  />
                </div>
              ))}
            </div>

            {/* Arrow right */}
            <button
              onClick={() => scroll('right')}
              className="absolute -right-3 top-[40%] z-10 w-8 h-8 bg-white border border-[#e5e5e5] rounded-full flex items-center justify-center shadow hover:border-[#c8102e] hover:text-[#c8102e] transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {products.map((product) => (
              <JerseyProductCard
                key={product.id}
                product={product}
                onAddToCart={onAddToCart}
                onAddToWishlist={onAddToWishlist}
                onOpen={onOpenProduct}
                wished={wishlistIds.has(product.id)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ─── Recommend Tabs Section ────────────────────────────────────────── */

const TABS = ['World Cup', '¡Hala Madrid!', 'Barcelona'];

export function RecommendSection({
  products,
  onAddToCart,
  onAddToWishlist,
  onOpenProduct,
  wishlistIds,
}: {
  products: JerseyProduct[];
  onAddToCart: (p: JerseyProduct) => void;
  onAddToWishlist: (p: JerseyProduct) => void;
  onOpenProduct: (p: JerseyProduct) => void;
  wishlistIds: Set<string>;
}) {
  const [activeTab, setActiveTab] = useState(0);

  const filtered = useMemo(() => {
    const tab = TABS[activeTab];
    if (tab === 'World Cup') {
      return products.filter(
        (p) =>
          p.tags?.includes('World Cup') ||
          p.name.toLowerCase().includes('world cup'),
      );
    }
    if (tab === '¡Hala Madrid!') {
      return products.filter(
        (p) =>
          p.name.toLowerCase().includes('real madrid') ||
          p.name.toLowerCase().includes('madrid'),
      );
    }
    if (tab === 'Barcelona') {
      return products.filter(
        (p) =>
          p.name.toLowerCase().includes('barcelona') ||
          p.name.toLowerCase().includes('barca'),
      );
    }
    return products;
  }, [activeTab, products]);

  return (
    <section className="py-8 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        {/* Tab bar */}
        <div className="flex items-center justify-between border-b-2 border-[#e5e5e5] mb-5">
          <div className="flex gap-0">
            {TABS.map((tab, i) => (
              <button
                key={tab}
                onClick={() => setActiveTab(i)}
                className={`px-5 py-3 text-[14px] font-bold border-b-2 transition-colors ${
                  activeTab === i
                    ? 'border-[#c8102e] text-[#c8102e]'
                    : 'border-transparent text-[#666] hover:text-[#1a1a1a]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-1 text-[13px] text-[#666] hover:text-[#c8102e] transition-colors mb-2">
            Shop all
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Product grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {(filtered.length > 0 ? filtered : products.slice(0, 5)).map(
            (product) => (
              <JerseyProductCard
                key={product.id}
                product={product}
                onAddToCart={onAddToCart}
                onAddToWishlist={onAddToWishlist}
                onOpen={onOpenProduct}
                wished={wishlistIds.has(product.id)}
              />
            ),
          )}
        </div>
      </div>
    </section>
  );
}

/* ─── Trust Badges ──────────────────────────────────────────────────── */

const TRUST_BADGES_DATA = [
  { icon: Award, title: '8-Year Brand', desc: 'Since 2017' },
  { icon: ShieldCheck, title: 'Premium Quality', desc: 'Top materials' },
  { icon: Globe, title: 'Ship Worldwide', desc: 'Global delivery' },
  { icon: RotateCcw, title: '30 Days Return', desc: 'Easy returns' },
  { icon: Clock, title: '24/7 Service', desc: 'Always here' },
  { icon: CreditCard, title: 'Secure Payment', desc: '100% secure' },
];

export function TrustBadges() {
  return (
    <section className="bg-[#f5f5f5] border-y border-[#e5e5e5]">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          {TRUST_BADGES_DATA.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="flex flex-col items-center gap-2 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-white border border-[#e5e5e5] flex items-center justify-center text-[#c8102e]">
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[12px] font-bold text-[#1a1a1a]">
                  {title}
                </div>
                <div className="text-[11px] text-[#999]">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Testimonials ──────────────────────────────────────────────────── */

const TESTIMONIALS_HELPFUL = [
  {
    name: 'Michael R.',
    avatar: 'M',
    text: 'The quality of the jerseys is outstanding. I ordered a Real Madrid kit and the stitching, fabric, and badges are all top-notch. Will definitely be ordering again!',
    product: 'Real Madrid Home Jersey 2024/25',
    stars: 5,
  },
  {
    name: 'Sarah L.',
    avatar: 'S',
    text: 'Fast shipping to the US and the jersey fits perfectly. The player version feels authentic and the detailing is incredible. Highly recommend!',
    product: 'Barcelona Away Jersey 2024/25',
    stars: 5,
  },
  {
    name: 'James T.',
    avatar: 'J',
    text: 'Great customer service. Had a question about sizing and they responded within minutes. The World Cup jersey I got looks amazing.',
    product: 'World Cup 2026 USA Jersey',
    stars: 5,
  },
];

const TESTIMONIALS_STORIES = [
  {
    name: 'Carlos M.',
    avatar: 'C',
    text: 'I have been collecting retro jerseys for years and Pro Jersey Shop has the best selection. The 1998 France jersey I bought brings back so many memories!',
    product: 'France Retro Jersey 1998',
    stars: 5,
  },
  {
    name: 'Emma W.',
    avatar: 'E',
    text: 'Bought matching jerseys for my whole family for the World Cup. The kids jerseys are adorable and great quality. Everyone loved them!',
    product: 'Kids Argentina Jersey 2024/25',
    stars: 5,
  },
];

export function TestimonialsSection() {
  const [tab, setTab] = useState<'helpful' | 'stories'>('helpful');
  const reviews = tab === 'helpful' ? TESTIMONIALS_HELPFUL : TESTIMONIALS_STORIES;

  return (
    <section className="py-10 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-xl font-bold text-[#1a1a1a] mb-4">
          What They Said About Our Soccer Jerseys
        </h2>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-[#e5e5e5]">
          <button
            onClick={() => setTab('helpful')}
            className={`pb-2 text-[13px] font-bold uppercase tracking-wide border-b-2 transition-colors ${
              tab === 'helpful'
                ? 'border-[#c8102e] text-[#c8102e]'
                : 'border-transparent text-[#999] hover:text-[#1a1a1a]'
            }`}
          >
            Helpful
          </button>
          <button
            onClick={() => setTab('stories')}
            className={`pb-2 text-[13px] font-bold uppercase tracking-wide border-b-2 transition-colors ${
              tab === 'stories'
                ? 'border-[#c8102e] text-[#c8102e]'
                : 'border-transparent text-[#999] hover:text-[#1a1a1a]'
            }`}
          >
            Soccer Stories
          </button>
        </div>

        {/* Review cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {reviews.map((review, i) => (
            <div
              key={i}
              className="border border-[#e5e5e5] rounded-lg p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-[#f5f5f5] flex items-center justify-center text-[#1a1a1a] font-bold text-sm">
                  {review.avatar}
                </div>
                <div>
                  <div className="text-[13px] font-bold text-[#1a1a1a]">
                    {review.name}
                  </div>
                  <div className="flex">
                    {[...Array(5)].map((_, s) => (
                      <Star
                        key={s}
                        className={`w-3 h-3 ${
                          s < review.stars
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-[12px] text-[#666] leading-relaxed mb-3">
                {review.text}
              </p>
              <div className="text-[11px] text-[#c8102e] font-medium">
                {review.product}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Newsletter ────────────────────────────────────────────────────── */

export function NewsletterSection() {
  const [email, setEmail] = useState('');

  return (
    <section className="bg-[#f5f5f5] border-y border-[#e5e5e5]">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-lg font-bold text-[#1a1a1a] mb-2 uppercase tracking-wide">
            Join PJ, BE THE 1ST TO KNOW ABOUT SPECIAL OFFERS & PROMOTIONS!
          </h2>
          <div className="flex gap-2 mt-5 max-w-md mx-auto">
            <div className="flex-1 relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#999]" />
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-10 pl-9 pr-4 border border-[#e5e5e5] rounded text-sm text-[#1a1a1a] placeholder:text-[#999] focus:outline-none focus:border-[#c8102e] bg-white"
              />
            </div>
            <button className="h-10 px-6 bg-[#c8102e] hover:bg-[#a00d24] text-white text-[12px] font-bold uppercase tracking-wide rounded transition-colors">
              SIGN UP NOW
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Footer ────────────────────────────────────────────────────────── */

const DEFAULT_FOOTER_COLS: JerseyConfig['footerColumns'] = [
  {
    title: 'PRODUCTS',
    items: [
      { label: 'New Arrivals', href: '#' },
      { label: 'Best Sellers', href: '#' },
      { label: 'Soccer Kits', href: '#' },
    ],
  },
  {
    title: 'COLLECTIONS',
    items: [
      { label: 'National Jerseys', href: '#' },
      { label: 'Club Jerseys', href: '#' },
      { label: 'Retro Jerseys', href: '#' },
      { label: 'Player Version', href: '#' },
    ],
  },
  {
    title: 'SUPPORT',
    items: [
      { label: 'Contact Us', href: '#' },
      { label: 'Returns & Exchanges', href: '#' },
      { label: 'Shipping', href: '#' },
      { label: 'Payment', href: '#' },
      { label: 'How to Clean', href: '#' },
    ],
  },
  {
    title: 'COMPANY INFO',
    items: [
      { label: 'About Us', href: '#' },
      { label: 'Wholesale Price', href: '#' },
      { label: 'Dropshipping', href: '#' },
      { label: 'MOQ', href: '#' },
    ],
  },
];

export function Footer({
  storeName,
  tagline,
  config,
}: {
  storeName: string;
  tagline?: string;
  config?: JerseyConfig;
}) {
  const footerCols =
    config?.footerColumns && config.footerColumns.length > 0
      ? config.footerColumns
      : DEFAULT_FOOTER_COLS;

  return (
    <footer className="bg-[#1a1a1a] text-[#999] text-[12px]">
      {/* Main footer columns */}
      <div className="max-w-7xl mx-auto px-4 py-10 grid grid-cols-2 md:grid-cols-5 gap-8">
        {/* Brand column */}
        <div className="col-span-2 md:col-span-1">
          <div className="text-[16px] font-black mb-2">
            <StoreWordmark name={storeName} accent="#c8102e" rest="#ffffff" />
          </div>
          <p className="text-[#999] mb-4">
            {tagline ?? 'Your #1 Source for Premium Soccer Jerseys Since 2017.'}
          </p>
          {/* Social icons */}
          <div className="flex items-center gap-3 mt-4">
            <a
              href="#"
              className="w-8 h-8 rounded-full bg-[#333] flex items-center justify-center hover:bg-[#c8102e] transition-colors"
            >
              <Facebook className="w-4 h-4 text-white" />
            </a>
            <a
              href="#"
              className="w-8 h-8 rounded-full bg-[#333] flex items-center justify-center hover:bg-[#c8102e] transition-colors"
            >
              <Youtube className="w-4 h-4 text-white" />
            </a>
            <a
              href="#"
              className="w-8 h-8 rounded-full bg-[#333] flex items-center justify-center hover:bg-[#c8102e] transition-colors"
            >
              <Instagram className="w-4 h-4 text-white" />
            </a>
          </div>
        </div>

        {/* Link columns */}
        {(footerCols ?? []).map((col, i) => (
          <div key={i}>
            <h4 className="text-white font-bold text-[13px] mb-3 tracking-wide">
              {col.title}
            </h4>
            <ul className="space-y-2">
              {col.items.map((item, j) => (
                <li key={j}>
                  {item.href ? (
                    <a
                      href={safeHref(item.href)}
                      className="hover:text-white transition-colors"
                      rel="noopener noreferrer"
                    >
                      {item.label}
                    </a>
                  ) : (
                    <span>{item.label}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Trustpilot + App download */}
      <div className="border-t border-[#333]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-[#00b67a] fill-[#00b67a]" />
            <span className="text-white font-bold text-[13px]">Excellent</span>
            <span className="text-[#666]">based on 12,400+ reviews</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[#999]">Download App:</span>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[#333] rounded text-white text-[11px] hover:bg-[#444] transition-colors">
              <Smartphone className="w-3.5 h-3.5" />
              Android
            </button>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="border-t border-[#333]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-2 text-[11px] text-[#666]">
          <div className="flex items-center gap-3">
            <a href="#" className="hover:text-white transition-colors">
              Privacy Policy
            </a>
            <span>|</span>
            <a href="#" className="hover:text-white transition-colors">
              Terms and Conditions
            </a>
          </div>
          <p>
            &copy; 2010-{new Date().getFullYear()} {storeName} soccer store All
            Rights Reserved
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ─── JerseyShopChrome (main wrapper) ───────────────────────────────── */

export function JerseyShopChrome({
  storeName,
  tagline,
  logoUrl: _logoUrl,
  bannerHeadline,
  bannerSubtext,
  bannerCta,
  bannerVisible = true,
  categories,
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  cartCount,
  onOpenCart,
  onGoStores: _onGoStores,
  onPickNav,
  config,
  children,
}: JerseyShopChromeProps) {
  // _logoUrl, _onGoStores kept for backward compatibility
  void _onGoStores;
  return (
    <div className="flex flex-col min-h-screen bg-white text-[#1a1a1a] font-sans">
      {/* Announcement Bar */}
      <AnnouncementBar />

      {/* Header */}
      <Header
        storeName={storeName}
        logoUrl={_logoUrl}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        cartCount={cartCount}
        onOpenCart={onOpenCart}
        onPickNav={onPickNav}
      />

      {/* Main Navigation — real product categories */}
      <MainNav
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={onSelectCategory}
      />

      {/* Category Quick Icons — clickable, filter by real categories */}
      <CategoryIcons
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={onSelectCategory}
      />

      {/* Hero Banner */}
      <HeroBanner
        config={config}
        bannerHeadline={bannerHeadline}
        bannerSubtext={bannerSubtext}
        bannerCta={bannerCta}
        bannerVisible={bannerVisible}
      />

      {/* Main content area (product grid from host) */}
      <main className="flex-1">
        {children}
      </main>

      {/* Trust Badges */}
      <TrustBadges />

      {/* Testimonials */}
      <TestimonialsSection />

      {/* Newsletter */}
      <NewsletterSection />

      {/* Footer */}
      <Footer storeName={storeName} tagline={tagline} config={config} />
    </div>
  );
}

/** Allow-list URL schemes that can be rendered as an <a href>. Anything
 *  else (notably `javascript:` and `data:`) falls back to `#` so an
 *  operator-controlled footer link can't smuggle script into a guest's
 *  browser. Storefronts are rendered to anonymous visitors. */
function safeHref(raw: string): string {
  const trimmed = String(raw).trim();
  if (!trimmed) return '#';
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return trimmed;
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('tel:')
  ) {
    return trimmed;
  }
  return '#';
}
