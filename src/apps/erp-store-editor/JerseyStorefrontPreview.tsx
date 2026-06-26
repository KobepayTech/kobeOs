import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search, ShoppingCart, Heart, User, ChevronRight, ChevronDown, Star,
  Truck, Shield, RefreshCw, CreditCard, Phone, Mail, MapPin,
  Facebook, Youtube, Instagram, MessageCircle,
} from 'lucide-react';

/**
 * Clone of the projerseyshop.es storefront for the in-app preview.
 *
 * Layered to match the live site's vertical rhythm:
 *  1. Slim utility bar — currency + language + sign-up coupon
 *  2. Brand bar — logo, search, account/cart icons
 *  3. Nav bar — main category links + highlighted promos
 *  4. Hero carousel slide — "Buy 3 Get 1 Free" double-discount pitch
 *  5. Promo category cards — Clubs / World Cup / Buy3Get1 / 26-27 New
 *  6. Top brands (Adidas / Nike / Puma / New Balance)
 *  7. Featured kits grid with badges, dual prices, hover wishlist
 *  8. Customise-your-jersey CTA with name + number form
 *  9. Trust strip (shipping / secure / returns / Klarna)
 *  10. Newsletter band
 *  11. Multi-column footer with social + payment + app badges
 */

interface JerseyPreviewProps {
  primaryColor: string;
  storeName: string;
  tagline: string;
}

const CURRENCIES = ['USD', 'EUR', 'CAD', 'AUD', 'GBP', 'MXN', 'ARS'];
const LANGS = ['English', 'Español', 'Français', 'Português'];

const NAV = [
  { label: 'WORLD CUP 2026' },
  { label: 'CLUBS' },
  { label: 'APPAREL' },
  { label: 'RETRO' },
  { label: 'KIDS' },
  { label: 'BUY 3 GET 1 FREE', emphasis: true },
  { label: 'PLAYERS' },
  { label: 'NBA' },
  { label: 'NEW', sale: true },
];

const PROMO_CARDS = [
  { title: 'CLUBS', subtitle: 'TOP KITS · 2026/27',  cta: 'SHOP NOW', from: '#c8102e', to: '#8b0000', emoji: '⚽' },
  { title: 'WORLD CUP 2026', subtitle: 'OFFICIAL JERSEYS', cta: 'SHOP NOW', from: '#0a2540', to: '#1f6feb', emoji: '🏆' },
  { title: 'BUY 3 GET 1', subtitle: 'STACKS WITH COUPON', cta: 'SHOP NOW', from: '#f59e0b', to: '#dc2626', emoji: '🎁' },
  { title: '26/27 NEW', subtitle: 'JUST DROPPED', cta: 'SHOP NOW', from: '#10b981', to: '#065f46', emoji: '✨' },
  { title: 'UCL', subtitle: 'CHAMPIONS LEAGUE KITS', cta: 'SHOP NOW', from: '#1c1c5a', to: '#3b3b9a', emoji: '⭐' },
  { title: '2026 F1', subtitle: 'TEAM APPAREL', cta: 'SHOP NOW', from: '#ff1801', to: '#8b0000', emoji: '🏎️' },
];

const BRANDS = [
  { name: 'ADIDAS',      color: '#000000' },
  { name: 'NIKE',        color: '#000000' },
  { name: 'PUMA',        color: '#000000' },
  { name: 'NEW BALANCE', color: '#000000' },
  { name: 'CASTORE',     color: '#000000' },
  { name: 'JOMA',        color: '#000000' },
];

const KITS = [
  { club: 'Real Madrid', kind: 'Home 26/27',     priceFrom: 19.99, priceTo: 30.99, was: 89.99, from: '#ffffff', to: '#f5f1d6', accent: '#ffd700',  text: '#1c1c5a', crest: 'RMA', cat: '26/27' },
  { club: 'Barcelona',   kind: 'Home 26/27',     priceFrom: 19.99, priceTo: 30.99, was: 89.99, from: '#a50044', to: '#004d98', accent: '#ffe600',  text: '#ffffff', crest: 'FCB', cat: '26/27' },
  { club: 'Argentina',   kind: 'Home World Cup', priceFrom: 19.99, priceTo: 30.99, was: 89.99, from: '#74acdf', to: '#ffffff', accent: '#fcbf49',  text: '#1c1c5a', crest: 'ARG', cat: 'World Cup' },
  { club: 'PSG',         kind: 'Home 26/27',     priceFrom: 19.99, priceTo: 30.99, was: 89.99, from: '#004170', to: '#1a1a1a', accent: '#da291c',  text: '#ffffff', crest: 'PSG', cat: '26/27' },
  { club: 'Man United',  kind: 'Home 26/27',     priceFrom: 19.99, priceTo: 30.99, was: 89.99, from: '#da291c', to: '#8c0000', accent: '#fbe122',  text: '#ffffff', crest: 'MUN', cat: '26/27' },
  { club: 'Liverpool',   kind: 'Home 26/27',     priceFrom: 19.99, priceTo: 30.99, was: 89.99, from: '#c8102e', to: '#8b0000', accent: '#00b2a9',  text: '#ffffff', crest: 'LFC', cat: '26/27' },
  { club: 'Bayern',      kind: 'Home 26/27',     priceFrom: 19.99, priceTo: 30.99, was: 89.99, from: '#dc052d', to: '#a00020', accent: '#0066b2',  text: '#ffffff', crest: 'FCB', cat: '26/27' },
  { club: 'Brazil',      kind: 'Home World Cup', priceFrom: 19.99, priceTo: 30.99, was: 89.99, from: '#fedd00', to: '#009c3b', accent: '#0a2540',  text: '#0a2540', crest: 'BRA', cat: 'World Cup' },
  { club: 'Juventus',    kind: 'Home 26/27',     priceFrom: 19.99, priceTo: 30.99, was: 89.99, from: '#0a0a0a', to: '#ffffff', accent: '#facc15',  text: '#0a0a0a', crest: 'JUV', cat: '26/27' },
  { club: 'Man City',    kind: 'Home 26/27',     priceFrom: 19.99, priceTo: 30.99, was: 89.99, from: '#6cabdd', to: '#1c2c5b', accent: '#ffffff',  text: '#ffffff', crest: 'MCI', cat: '26/27' },
  { club: 'AC Milan',    kind: 'Home 26/27',     priceFrom: 19.99, priceTo: 30.99, was: 89.99, from: '#fb090b', to: '#000000', accent: '#ffffff',  text: '#ffffff', crest: 'ACM', cat: '26/27' },
  { club: 'Inter',       kind: 'Home 26/27',     priceFrom: 19.99, priceTo: 30.99, was: 89.99, from: '#011e41', to: '#000000', accent: '#0099ff',  text: '#ffffff', crest: 'INT', cat: '26/27' },
];

const RETRO_KITS = [
  { club: 'Brazil 1998',  priceFrom: 22.99, was: 79.99, from: '#fedd00', to: '#009c3b', accent: '#0a2540', text: '#0a2540', crest: 'BRA' },
  { club: 'France 1998',  priceFrom: 22.99, was: 79.99, from: '#002395', to: '#ed2939', accent: '#ffffff', text: '#ffffff', crest: 'FRA' },
  { club: 'Arsenal 03/04',priceFrom: 22.99, was: 79.99, from: '#ef0107', to: '#9c824a', accent: '#ffffff', text: '#ffffff', crest: 'ARS' },
  { club: 'Milan 1989',   priceFrom: 22.99, was: 79.99, from: '#fb090b', to: '#000000', accent: '#ffffff', text: '#ffffff', crest: 'ACM' },
];

export function JerseyStorefrontPreview({ primaryColor, storeName, tagline }: JerseyPreviewProps) {
  const brandName = (storeName || 'PRO JERSEY SHOP').toUpperCase();

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white text-slate-900">

      {/* ── 1. Utility bar ───────────────────────────────── */}
      <div className="bg-slate-900 text-white text-[10px] tracking-wider">
        <div className="px-4 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-semibold flex items-center gap-1">
              {CURRENCIES[0]} <ChevronDown className="w-2.5 h-2.5" />
            </span>
            <span className="opacity-50">|</span>
            <span className="font-semibold flex items-center gap-1">
              {LANGS[0]} <ChevronDown className="w-2.5 h-2.5" />
            </span>
            <span className="opacity-50 hidden md:inline">|</span>
            <span className="opacity-80 hidden md:inline">Contact us</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="opacity-80 hidden sm:inline">Sign up for</span>
            <span className="font-extrabold px-1.5 py-0.5 rounded" style={{ backgroundColor: primaryColor }}>
              15% OFF
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. Brand bar ─────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200">
        <div className="px-5 py-3 flex items-center gap-5">
          <div className="flex-shrink-0">
            <div className="text-lg font-black tracking-tight leading-none text-slate-900">
              {brandName}
            </div>
            <div className="text-[9px] uppercase tracking-[0.25em] text-slate-700 font-bold mt-0.5">
              {tagline || 'OFFICIAL JERSEYS · WORLDWIDE'}
            </div>
          </div>
          <div className="flex-1 relative max-w-xl mx-auto hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-700" />
            <input
              type="text"
              readOnly
              placeholder="Search for a team, a player, a kit…"
              className="w-full h-9 pl-9 pr-3 rounded-full bg-slate-100 border border-slate-200 text-xs text-slate-700 placeholder:text-slate-700 outline-none"
            />
          </div>
          <div className="flex items-center gap-4 text-slate-700">
            <button className="flex flex-col items-center" title="Wishlist">
              <Heart className="w-4 h-4" />
            </button>
            <button className="flex items-center gap-1.5" title="Account">
              <User className="w-4 h-4" />
              <span className="text-[10px] font-bold hidden sm:inline">SIGN IN</span>
            </button>
            <button className="relative" title="Cart">
              <ShoppingCart className="w-4 h-4" />
              <span
                className="absolute -top-1.5 -right-2 w-4 h-4 rounded-full text-[8px] grid place-items-center font-bold text-white"
                style={{ backgroundColor: primaryColor }}
              >3</span>
            </button>
          </div>
        </div>

        {/* ── 3. Nav ─────────────────────────────────────── */}
        <nav className="px-5 pb-2 flex items-center gap-5 overflow-x-auto text-[10px] font-extrabold tracking-wider text-slate-900">
          {NAV.map((item) => (
            <button
              key={item.label}
              className="py-1.5 whitespace-nowrap hover:opacity-70 transition-opacity border-b-2 border-transparent hover:border-slate-900"
              style={item.sale ? { color: primaryColor } : item.emphasis ? { color: '#dc2626' } : undefined}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <ScrollArea className="flex-1 min-h-0">

        {/* ── 4. Hero ─────────────────────────────────────── */}
        <section
          className="relative px-6 py-10 overflow-hidden"
          style={{
            background: `linear-gradient(115deg, ${primaryColor} 0%, ${primaryColor}cc 45%, #0a0a1a 100%)`,
          }}
        >
          <div className="relative max-w-2xl">
            <div className="inline-block text-[10px] font-extrabold tracking-[0.2em] text-white bg-black/30 backdrop-blur px-2.5 py-1 rounded mb-3">
              MEMBER COUPON STACKS!
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white leading-tight">
              Double Discount:<br />
              <span style={{ color: '#fbbf24' }}>Buy 3</span>, Get <span style={{ color: '#fbbf24' }}>1 Free</span>
            </h1>
            <p className="text-white/85 text-sm mt-3 max-w-md">
              Mix &amp; match across the entire catalog. Member coupon stacks on top — the cheapest jersey ships free.
            </p>
            <div className="flex gap-3 mt-5">
              <button className="px-5 h-10 rounded bg-white text-slate-900 font-extrabold text-xs tracking-wide hover:bg-slate-100">
                SHOP THE DEAL
              </button>
              <button className="px-5 h-10 rounded border-2 border-white text-white font-extrabold text-xs tracking-wide hover:bg-white/10 inline-flex items-center gap-2">
                BROWSE ALL KITS <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {/* Decorative stamp */}
          <div className="absolute right-4 top-4 w-20 h-20 rounded-full border-4 border-white/30 text-white/80 grid place-items-center text-[10px] font-extrabold leading-tight text-center rotate-12">
            FROM<br /><span className="text-2xl">$19</span>.99
          </div>
          {/* Carousel dots */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            <span className="w-6 h-1.5 rounded-full bg-white" />
            <span className="w-1.5 h-1.5 rounded-full bg-white/50" />
            <span className="w-1.5 h-1.5 rounded-full bg-white/50" />
          </div>
        </section>

        {/* ── 5. Promo category cards ────────────────────── */}
        <section className="px-5 py-5 bg-white">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {PROMO_CARDS.map((c) => (
              <button
                key={c.title}
                className="group relative aspect-square rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all"
                style={{ background: `linear-gradient(140deg, ${c.from} 0%, ${c.to} 100%)` }}
              >
                <div className="absolute inset-0 p-2.5 flex flex-col justify-between text-white">
                  <span className="text-3xl leading-none">{c.emoji}</span>
                  <div>
                    <div className="text-[11px] font-black tracking-wide leading-tight">{c.title}</div>
                    <div className="text-[8px] uppercase opacity-80 mt-0.5 leading-tight">{c.subtitle}</div>
                    <div className="mt-1.5 text-[8px] font-black tracking-wider opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-0.5 underline">
                      {c.cta} <ChevronRight className="w-2.5 h-2.5" />
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* ── Top brands strip ───────────────────────────── */}
        <section className="px-5 pb-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[11px] font-black tracking-wider text-slate-900">SHOP BY BRAND</h3>
            <button className="text-[10px] font-bold text-slate-700 hover:text-slate-900 inline-flex items-center gap-0.5">
              ALL BRANDS <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {BRANDS.map((b) => (
              <div
                key={b.name}
                className="aspect-[2/1] rounded border border-slate-200 bg-white grid place-items-center font-black text-[11px] tracking-widest hover:border-slate-900 transition-colors"
                style={{ color: b.color }}
              >
                {b.name}
              </div>
            ))}
          </div>
        </section>

        {/* ── 6. Featured kits grid ──────────────────────── */}
        <section className="px-5 py-6 bg-slate-50 border-y border-slate-200">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-black tracking-tight text-slate-900">FEATURED KITS · 2026/27</h2>
            <button className="text-[10px] font-bold text-slate-700 hover:text-slate-900 inline-flex items-center gap-0.5">
              VIEW ALL <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <p className="text-[11px] text-slate-700 mb-4">Match versions · official colour codes · stitched crests · 30-day returns</p>
          <KitGrid kits={KITS} primaryColor={primaryColor} />
        </section>

        {/* ── 7. Customizer CTA ──────────────────────────── */}
        <section className="mx-5 my-6 rounded-xl overflow-hidden shadow-md"
                 style={{ background: `linear-gradient(110deg, #0a0a1a 0%, #1c1c2e 100%)` }}>
          <div className="px-6 py-6 grid md:grid-cols-2 gap-4 items-center">
            <div>
              <div className="text-[10px] font-extrabold tracking-[0.25em] mb-2" style={{ color: primaryColor }}>
                JERSEY CUSTOMIZER · +$9.99
              </div>
              <h3 className="text-xl font-black text-white">Your name. Your number. Your jersey.</h3>
              <p className="text-white/70 text-xs mt-2 max-w-sm">
                Add official-style name + number printing to any kit. Multiple fonts. Patches optional.
              </p>
              <div className="mt-3 flex items-center gap-3 text-white/60 text-[10px] font-bold">
                <span className="inline-flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-400 fill-current" /> 4.9 / 5
                </span>
                <span>·</span>
                <span>18,400 customised this year</span>
              </div>
            </div>
            <div className="bg-white rounded-lg p-3 space-y-2 shadow-lg">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] uppercase font-bold text-slate-700 tracking-wide">Name on back</label>
                  <input readOnly defaultValue="MESSI" className="w-full h-9 px-2 mt-0.5 rounded bg-slate-100 border border-slate-200 text-xs font-bold tracking-wider text-slate-900" />
                </div>
                <div>
                  <label className="text-[9px] uppercase font-bold text-slate-700 tracking-wide">Number</label>
                  <input readOnly defaultValue="10" className="w-full h-9 px-2 mt-0.5 rounded bg-slate-100 border border-slate-200 text-xs font-black text-center text-slate-900" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {['UCL', 'PREMIER', 'LA LIGA'].map((p) => (
                  <button key={p} className="h-7 rounded border border-slate-200 text-[9px] font-extrabold text-slate-700 hover:border-slate-900">
                    +{p}
                  </button>
                ))}
              </div>
              <button className="w-full h-9 rounded text-white font-extrabold text-xs tracking-wider"
                      style={{ backgroundColor: primaryColor }}>
                ADD CUSTOMIZATION
              </button>
            </div>
          </div>
        </section>

        {/* ── Retro section ─────────────────────────────── */}
        <section className="px-5 py-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-black tracking-tight text-slate-900">RETRO COLLECTION</h2>
            <button className="text-[10px] font-bold text-slate-700 hover:text-slate-900 inline-flex items-center gap-0.5">
              ALL RETRO <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <p className="text-[11px] text-slate-700 mb-4">Throwback shirts from the classic eras · embroidered crests</p>
          <KitGrid kits={RETRO_KITS} primaryColor={primaryColor} />
        </section>

        {/* ── 8. Trust strip ─────────────────────────────── */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 px-5 pb-5">
          {[
            { icon: Truck,      title: 'Free shipping',  sub: 'On orders > $99' },
            { icon: Shield,     title: 'Secure checkout',sub: 'SSL + 3DS' },
            { icon: RefreshCw,  title: '30-day returns', sub: 'No questions' },
            { icon: CreditCard, title: 'Pay in 3',       sub: 'Klarna · Clearpay' },
          ].map(({ icon: I, title, sub }) => (
            <div key={title} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 flex items-center gap-2">
              <I className="w-4 h-4 text-slate-700 flex-shrink-0" />
              <div>
                <div className="text-[11px] font-extrabold text-slate-900">{title}</div>
                <div className="text-[9px] text-slate-700">{sub}</div>
              </div>
            </div>
          ))}
        </section>

        {/* ── 9. Newsletter band ─────────────────────────── */}
        <section className="mx-5 mb-6 rounded-xl text-center py-6 px-4"
                 style={{ background: `linear-gradient(110deg, ${primaryColor}15 0%, ${primaryColor}05 100%)` }}>
          <div className="text-[10px] font-extrabold tracking-[0.25em] text-slate-700 mb-1">JOIN THE CLUB</div>
          <h3 className="text-lg font-black text-slate-900">Get 15% off your first order</h3>
          <p className="text-xs text-slate-700 mt-1 max-w-sm mx-auto">
            Be the first to know about new kits, retro drops, and member-only flash sales.
          </p>
          <div className="mt-3 max-w-sm mx-auto flex gap-1.5">
            <input readOnly placeholder="your@email.com"
                   className="flex-1 h-9 px-3 rounded bg-white border border-slate-300 text-xs text-slate-900 placeholder:text-slate-700 outline-none" />
            <button className="h-9 px-4 rounded text-xs font-extrabold text-white tracking-wider"
                    style={{ backgroundColor: primaryColor }}>
              SUBSCRIBE
            </button>
          </div>
        </section>

        {/* ── 10. Footer ─────────────────────────────────── */}
        <footer className="bg-slate-900 text-slate-300 px-5 pt-6 pb-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-[10px]">
            <div className="col-span-2 md:col-span-2">
              <div className="text-base font-black text-white mb-1">{brandName}</div>
              <p className="leading-snug mb-3 opacity-80">
                Official-style match jerseys from every top club and national team, shipped worldwide.
              </p>
              <div className="space-y-1 text-[10px] opacity-80">
                <div className="inline-flex items-center gap-1.5"><Phone className="w-3 h-3" /> +1 (305) 555 0142</div><br />
                <div className="inline-flex items-center gap-1.5"><Mail className="w-3 h-3" /> support@projersey.shop</div><br />
                <div className="inline-flex items-center gap-1.5"><MapPin className="w-3 h-3" /> Miami · Madrid · Dar es Salaam</div>
              </div>
            </div>
            <div>
              <div className="font-black text-white text-xs mb-2 tracking-wide">PRODUCTS</div>
              <ul className="space-y-1 opacity-80">
                <li>Clubs</li><li>National Teams</li><li>Retro</li><li>Players</li><li>Kids</li><li>F1 &amp; NBA</li>
              </ul>
            </div>
            <div>
              <div className="font-black text-white text-xs mb-2 tracking-wide">SUPPORT</div>
              <ul className="space-y-1 opacity-80">
                <li>Size guide</li><li>Shipping</li><li>Returns &amp; exchanges</li><li>Order tracking</li><li>FAQs</li>
              </ul>
            </div>
            <div>
              <div className="font-black text-white text-xs mb-2 tracking-wide">COMPANY</div>
              <ul className="space-y-1 opacity-80">
                <li>About us</li><li>Stores</li><li>Affiliates</li><li>Wholesale</li>
                <li>Privacy</li><li>Terms</li>
              </ul>
            </div>
          </div>

          {/* Social + apps */}
          <div className="border-t border-slate-800 pt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {[Facebook, Youtube, Instagram, MessageCircle].map((I, i) => (
                <a key={i} href="#" className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 grid place-items-center">
                  <I className="w-3.5 h-3.5" />
                </a>
              ))}
            </div>
            <div className="flex items-center gap-2 text-[9px] opacity-80">
              <span className="font-bold">DOWNLOAD</span>
              <span className="px-2 py-1 rounded border border-slate-700 font-bold">▼ App Store</span>
              <span className="px-2 py-1 rounded border border-slate-700 font-bold">▼ Google Play</span>
            </div>
          </div>

          {/* Payment row */}
          <div className="border-t border-slate-800 pt-3 flex flex-wrap items-center justify-between gap-3 text-[9px]">
            <span>© {brandName} · All rights reserved</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {['VISA', 'MC', 'AMEX', 'PYPL', 'KLN', 'GPAY', 'APAY'].map((b) => (
                <span key={b} className="px-1.5 py-0.5 rounded bg-white text-slate-900 font-black tracking-tighter text-[9px]">{b}</span>
              ))}
            </div>
          </div>
        </footer>
      </ScrollArea>
    </div>
  );
}

/* ── kit grid sub-component ─────────────────────────── */
interface Kit {
  club: string;
  kind?: string;
  priceFrom: number;
  priceTo?: number;
  was: number;
  from: string;
  to: string;
  accent: string;
  text: string;
  crest: string;
  cat?: string;
}

function KitGrid({ kits, primaryColor }: { kits: Kit[]; primaryColor: string }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {kits.map((k) => {
        const discount = Math.round((1 - k.priceFrom / k.was) * 100);
        return (
          <article key={`${k.club}-${k.kind ?? ''}`} className="group cursor-pointer">
            <div
              className="aspect-[3/4] rounded-md overflow-hidden relative shadow-sm group-hover:shadow-lg transition-shadow"
              style={{ background: `linear-gradient(160deg, ${k.from} 0%, ${k.to} 100%)` }}
            >
              {/* Cat tag */}
              {k.cat && (
                <div className="absolute top-2 left-2 px-1.5 py-0.5 text-[8px] font-extrabold tracking-wider bg-white/95 text-slate-900 rounded">
                  {k.cat}
                </div>
              )}
              {/* Crest mock */}
              <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/95 grid place-items-center text-[9px] font-black"
                   style={{ color: k.accent === '#ffffff' ? k.from : k.accent }}>
                {k.crest}
              </div>
              {/* Sale ribbon */}
              <div className="absolute top-9 right-0 px-2 py-0.5 text-[9px] font-black tracking-wider text-white shadow"
                   style={{ backgroundColor: primaryColor }}>
                -{discount}%
              </div>
              {/* Jersey silhouette */}
              <div className="absolute inset-0 grid place-items-center">
                <svg viewBox="0 0 100 110" className="w-3/5 h-3/5 opacity-95" fill="none">
                  <path d="M30 10 L20 25 L8 30 L12 50 L25 45 L25 100 L75 100 L75 45 L88 50 L92 30 L80 25 L70 10 L62 14 L50 18 L38 14 Z"
                        fill={k.accent} fillOpacity="0.85" stroke={k.accent} strokeWidth="1" />
                  <text x="50" y="62" textAnchor="middle" fontSize="7" fontWeight="900"
                        fill={k.text}>
                    {k.crest}
                  </text>
                </svg>
              </div>
              <button className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-white/95 grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Heart className="w-3.5 h-3.5 text-slate-700" />
              </button>
              {/* Quick add */}
              <button
                className="absolute inset-x-2 bottom-2 h-8 rounded text-white text-[10px] font-extrabold tracking-wider opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ backgroundColor: '#0a0a1a' }}
              >
                + ADD TO CART
              </button>
            </div>
            <div className="mt-2">
              <div className="flex items-center gap-0.5 text-amber-500 mb-1">
                {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="w-2.5 h-2.5 fill-current" />)}
                <span className="text-[9px] text-slate-700 ml-1">(214)</span>
              </div>
              <h3 className="text-[11px] font-extrabold text-slate-900 leading-tight">{k.club}</h3>
              {k.kind && <p className="text-[10px] text-slate-700">{k.kind}</p>}
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-sm font-black" style={{ color: primaryColor }}>
                  US${k.priceFrom.toFixed(2)}
                  {k.priceTo ? <span className="opacity-80">~${k.priceTo.toFixed(2)}</span> : null}
                </span>
                <span className="text-[10px] text-slate-400 line-through">${k.was.toFixed(2)}</span>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
