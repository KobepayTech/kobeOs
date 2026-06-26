import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search, ShoppingCart, Heart, ChevronRight, Star, Truck, Shield, RefreshCw, CreditCard,
} from 'lucide-react';

/**
 * First-pass clone of the projerseyshop.es storefront so the in-app
 * preview matches the look the user asked for: deep-navy header with
 * a red brand bar, club chip row, hero with stamped promo, kit grid
 * with crest + year + dual price (sale + crossed-out), customizer
 * CTA, free-shipping/secure-checkout strip, and a dark footer with
 * card icons.
 *
 * Kept self-contained (no shared state with the rest of the editor)
 * so the existing generic preview can co-exist behind a setting
 * toggle.
 */

interface JerseyPreviewProps {
  primaryColor: string;
  storeName: string;
  tagline: string;
}

const CLUBS = [
  { name: 'Real Madrid', short: 'RMA', from: '#ffffff', to: '#fbd84a', text: '#1c1c5a' },
  { name: 'Barcelona',   short: 'BAR', from: '#a50044', to: '#004d98', text: '#ffffff' },
  { name: 'Man United',  short: 'MUN', from: '#da291c', to: '#fbe122', text: '#000000' },
  { name: 'Liverpool',   short: 'LIV', from: '#c8102e', to: '#00b2a9', text: '#ffffff' },
  { name: 'PSG',         short: 'PSG', from: '#004170', to: '#da291c', text: '#ffffff' },
  { name: 'Bayern',      short: 'BAY', from: '#dc052d', to: '#0066b2', text: '#ffffff' },
  { name: 'Juventus',    short: 'JUV', from: '#000000', to: '#ffffff', text: '#ffffff' },
  { name: 'Man City',    short: 'MCI', from: '#6cabdd', to: '#1c2c5b', text: '#ffffff' },
];

const KITS = [
  { club: 'Real Madrid', kind: 'Home 2026/27',     price: 29.99, was: 89.99, from: '#ffffff', to: '#e9e6d4', accent: '#1c1c5a', crest: 'RMA' },
  { club: 'Barcelona',   kind: 'Home 2026/27',     price: 29.99, was: 89.99, from: '#a50044', to: '#004d98', accent: '#ffe600', crest: 'FCB' },
  { club: 'Man United',  kind: 'Home 2026/27',     price: 29.99, was: 89.99, from: '#da291c', to: '#8c0000', accent: '#fbe122', crest: 'MUN' },
  { club: 'Liverpool',   kind: 'Home 2026/27',     price: 29.99, was: 89.99, from: '#c8102e', to: '#8b0000', accent: '#00b2a9', crest: 'LFC' },
  { club: 'PSG',         kind: 'Away 2026/27',     price: 29.99, was: 89.99, from: '#1a1a1a', to: '#222222', accent: '#da291c', crest: 'PSG' },
  { club: 'Bayern',      kind: 'Home 2026/27',     price: 29.99, was: 89.99, from: '#dc052d', to: '#a00020', accent: '#ffffff', crest: 'FCB' },
  { club: 'Juventus',    kind: 'Home 2026/27',     price: 29.99, was: 89.99, from: '#0a0a0a', to: '#ffffff', accent: '#facc15', crest: 'JUV' },
  { club: 'Argentina',   kind: 'Home World Cup',   price: 29.99, was: 89.99, from: '#74acdf', to: '#ffffff', accent: '#fcbf49', crest: 'ARG' },
];

const NAV = ['NATIONAL TEAMS', 'CLUBS', 'PLAYERS', 'RETRO', 'CUSTOM', 'KIDS', 'SALE'];

export function JerseyStorefrontPreview({ primaryColor, storeName, tagline }: JerseyPreviewProps) {
  return (
    <div className="flex flex-col h-full overflow-hidden bg-white text-slate-900">

      {/* Top utility bar */}
      <div className="text-[10px] tracking-wider bg-slate-900 text-white py-1.5 px-4 flex items-center justify-between">
        <span className="font-semibold">FREE WORLDWIDE SHIPPING ON ORDERS OVER $99</span>
        <span className="hidden sm:inline opacity-70">USD ▾  ·  EN ▾  ·  HELP</span>
      </div>

      {/* Brand bar */}
      <header className="bg-white border-b border-slate-200">
        <div className="px-5 py-3 flex items-center gap-5">
          <div className="flex-shrink-0">
            <div
              className="text-lg font-black tracking-tight leading-none"
              style={{ color: primaryColor }}
            >
              {(storeName || 'PRO JERSEY').toUpperCase()}
            </div>
            <div className="text-[9px] uppercase tracking-[0.2em] text-slate-700 font-bold mt-0.5">
              {tagline || 'SHOP'}
            </div>
          </div>
          <div className="flex-1 relative max-w-md mx-auto hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-700" />
            <input
              type="text"
              readOnly
              placeholder="Search for a team, a player, a kit…"
              className="w-full h-9 pl-9 pr-3 rounded-full bg-slate-100 border border-slate-200 text-xs text-slate-700 placeholder:text-slate-700 outline-none"
            />
          </div>
          <div className="flex items-center gap-3 text-slate-700">
            <Heart className="w-4 h-4" />
            <span className="text-[10px] font-semibold hidden sm:inline">SIGN IN</span>
            <div className="relative">
              <ShoppingCart className="w-4 h-4" />
              <span
                className="absolute -top-1.5 -right-2 w-3.5 h-3.5 rounded-full text-[8px] grid place-items-center font-bold text-white"
                style={{ backgroundColor: primaryColor }}
              >2</span>
            </div>
          </div>
        </div>

        {/* Nav row */}
        <nav className="px-5 pb-2 flex items-center gap-4 overflow-x-auto text-[10px] font-extrabold tracking-wider text-slate-900">
          {NAV.map((item) => (
            <button
              key={item}
              className="py-1 whitespace-nowrap hover:opacity-70 transition-opacity border-b-2 border-transparent hover:border-slate-900"
              style={item === 'SALE' ? { color: primaryColor } : undefined}
            >
              {item}
            </button>
          ))}
        </nav>
      </header>

      <ScrollArea className="flex-1 min-h-0">

        {/* Hero */}
        <section
          className="relative px-6 py-10 overflow-hidden"
          style={{
            background: `linear-gradient(120deg, ${primaryColor} 0%, ${primaryColor}cc 50%, #0a0a1a 100%)`,
          }}
        >
          <div className="max-w-2xl">
            <div className="inline-block text-[10px] font-extrabold tracking-[0.2em] text-white bg-black/30 backdrop-blur px-2.5 py-1 rounded mb-3">
              NEW · 2026/27 SEASON
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white leading-tight">
              Wear the colours.<br />Live the badge.
            </h1>
            <p className="text-white/85 text-sm mt-3 max-w-md">
              Official-style match jerseys from every top club &amp; national team. Personalise with any name + number.
            </p>
            <div className="flex gap-3 mt-5">
              <button className="px-5 h-10 rounded bg-white text-slate-900 font-extrabold text-xs tracking-wide hover:bg-slate-100 transition-colors">
                SHOP CLUBS
              </button>
              <button className="px-5 h-10 rounded border-2 border-white text-white font-extrabold text-xs tracking-wide hover:bg-white/10 transition-colors inline-flex items-center gap-2">
                CUSTOMIZE YOURS <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {/* Decorative stamp */}
          <div className="absolute right-4 top-4 w-20 h-20 rounded-full border-4 border-white/30 text-white/80 grid place-items-center text-[10px] font-extrabold leading-tight text-center rotate-12">
            FROM<br /><span className="text-2xl">$29</span>.99
          </div>
        </section>

        {/* Club chips */}
        <section className="px-5 py-5 bg-slate-50 border-y border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-extrabold tracking-wide text-slate-900">SHOP BY CLUB</h2>
            <button className="text-[10px] font-bold text-slate-700 hover:text-slate-900 inline-flex items-center gap-0.5">
              VIEW ALL <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
            {CLUBS.map((c) => (
              <button
                key={c.short}
                className="aspect-square rounded-lg shadow-sm hover:shadow-md transition-all hover:scale-105 grid place-items-center font-black text-[11px]"
                style={{
                  background: `linear-gradient(135deg, ${c.from} 0%, ${c.to} 100%)`,
                  color: c.text,
                  textShadow: '0 1px 2px rgba(0,0,0,0.15)',
                }}
                title={c.name}
              >
                {c.short}
              </button>
            ))}
          </div>
        </section>

        {/* Featured kits */}
        <section className="px-5 py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-black tracking-tight text-slate-900">FEATURED KITS · 2026/27</h2>
              <p className="text-[11px] text-slate-700 mt-0.5">Match versions · official colour codes · stitched crests</p>
            </div>
            <button className="text-[10px] font-bold text-slate-700 hover:text-slate-900 inline-flex items-center gap-0.5">
              VIEW ALL KITS <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {KITS.map((k) => (
              <article key={`${k.club}-${k.kind}`} className="group cursor-pointer">
                <div
                  className="aspect-[3/4] rounded-md overflow-hidden relative shadow-sm group-hover:shadow-lg transition-shadow"
                  style={{ background: `linear-gradient(160deg, ${k.from} 0%, ${k.to} 100%)` }}
                >
                  {/* Crest mock */}
                  <div className="absolute top-3 left-3 w-7 h-7 rounded-full bg-white/95 grid place-items-center text-[9px] font-black"
                       style={{ color: k.accent }}>
                    {k.crest}
                  </div>
                  {/* Sale ribbon */}
                  <div className="absolute top-0 right-0 px-2 py-0.5 text-[9px] font-black tracking-wider text-white"
                       style={{ backgroundColor: primaryColor }}>
                    -67%
                  </div>
                  {/* Jersey silhouette (CSS-only) */}
                  <div className="absolute inset-0 grid place-items-center">
                    <svg viewBox="0 0 100 110" className="w-3/5 h-3/5 opacity-90" fill="none">
                      <path d="M30 10 L20 25 L8 30 L12 50 L25 45 L25 100 L75 100 L75 45 L88 50 L92 30 L80 25 L70 10 L62 14 L50 18 L38 14 Z"
                            fill={k.accent} fillOpacity="0.85" stroke={k.accent} strokeWidth="1" />
                      <text x="50" y="62" textAnchor="middle" fontSize="7" fontWeight="900" fill={k.from === '#ffffff' ? '#1c1c5a' : '#ffffff'}>
                        {k.crest}
                      </text>
                    </svg>
                  </div>
                  <button className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-white/95 grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Heart className="w-3.5 h-3.5 text-slate-700" />
                  </button>
                </div>
                <div className="mt-2">
                  <div className="flex items-center gap-0.5 text-amber-500 mb-1">
                    {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="w-2.5 h-2.5 fill-current" />)}
                    <span className="text-[9px] text-slate-700 ml-1">(214)</span>
                  </div>
                  <h3 className="text-[11px] font-extrabold text-slate-900 leading-tight">{k.club}</h3>
                  <p className="text-[10px] text-slate-700">{k.kind}</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-sm font-black" style={{ color: primaryColor }}>${k.price.toFixed(2)}</span>
                    <span className="text-[10px] text-slate-400 line-through">${k.was.toFixed(2)}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Customizer CTA */}
        <section className="mx-5 mb-6 rounded-xl overflow-hidden shadow-md"
                 style={{ background: `linear-gradient(110deg, #0a0a1a 0%, #1c1c2e 100%)` }}>
          <div className="px-6 py-6 grid md:grid-cols-2 gap-4 items-center">
            <div>
              <div className="text-[10px] font-extrabold tracking-[0.2em] mb-2" style={{ color: primaryColor }}>
                JERSEY CUSTOMIZER
              </div>
              <h3 className="text-xl font-black text-white">Your name. Your number. Your jersey.</h3>
              <p className="text-white/70 text-xs mt-2 max-w-sm">
                Add custom name + number printing to any kit. Official typography. +$9.99.
              </p>
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
              <button className="w-full h-9 rounded text-white font-extrabold text-xs tracking-wider"
                      style={{ backgroundColor: primaryColor }}>
                ADD CUSTOMIZATION
              </button>
            </div>
          </div>
        </section>

        {/* Trust strip */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 px-5 pb-5">
          {[
            { icon: Truck,     title: 'Free shipping',  sub: 'On orders > $99' },
            { icon: Shield,    title: 'Secure checkout', sub: 'SSL + 3DS' },
            { icon: RefreshCw, title: '30-day returns',  sub: 'No questions' },
            { icon: CreditCard,title: 'Pay in 3',        sub: 'Klarna · Clearpay' },
          ].map(({ icon: I, title, sub }) => (
            <div key={title} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 flex items-center gap-2">
              <I className="w-4 h-4 text-slate-700 flex-shrink-0" />
              <div>
                <div className="text-[11px] font-extrabold text-slate-900">{title}</div>
                <div className="text-[9px] text-slate-700">{sub}</div>
              </div>
            </div>
          ))}
        </section>

        {/* Footer */}
        <footer className="bg-slate-900 text-slate-300 px-5 py-6 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[10px]">
            <div>
              <div className="font-black text-white text-xs mb-2 tracking-wide">SHOP</div>
              <ul className="space-y-1">
                <li>Clubs</li><li>National Teams</li><li>Retro</li><li>Kids</li>
              </ul>
            </div>
            <div>
              <div className="font-black text-white text-xs mb-2 tracking-wide">HELP</div>
              <ul className="space-y-1">
                <li>Size guide</li><li>Shipping</li><li>Returns</li><li>Contact</li>
              </ul>
            </div>
            <div>
              <div className="font-black text-white text-xs mb-2 tracking-wide">COMPANY</div>
              <ul className="space-y-1">
                <li>About us</li><li>Stores</li><li>Affiliates</li>
              </ul>
            </div>
            <div>
              <div className="font-black text-white text-xs mb-2 tracking-wide">NEWSLETTER</div>
              <p className="leading-snug mb-2">Be first to know about new kits + sales.</p>
              <div className="flex gap-1">
                <input readOnly placeholder="email" className="flex-1 h-7 px-2 rounded bg-slate-800 border border-slate-700 text-[10px] outline-none" />
                <button className="h-7 px-3 rounded text-[10px] font-extrabold text-white" style={{ backgroundColor: primaryColor }}>OK</button>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-3 flex flex-wrap items-center justify-between gap-3 text-[9px]">
            <span>© {storeName || 'PRO JERSEY SHOP'} · All rights reserved</span>
            <div className="flex items-center gap-1.5">
              {['VISA', 'MC', 'AMEX', 'PYPL', 'KLN'].map((b) => (
                <span key={b} className="px-1.5 py-0.5 rounded bg-white text-slate-900 font-black tracking-tighter">{b}</span>
              ))}
            </div>
          </div>
        </footer>
      </ScrollArea>
    </div>
  );
}
