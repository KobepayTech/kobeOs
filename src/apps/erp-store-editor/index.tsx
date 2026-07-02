import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Palette, Image, RotateCcw, Save, Download,
  ShoppingBag, Search, ChevronDown, ChevronRight, Check, Eye, X,
  Store, Type as TypeIcon, Grid3X3, PanelLeft, Tag, Plus, Globe, Loader2, AlertTriangle,
  LayoutGrid, Layers,
  Wifi, ExternalLink, Languages, QrCode, Smartphone, Copy,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { PhotoUpload } from '@/components/PhotoUpload';
import { HomepageSectionBuilder, IndustryTemplatePicker } from './StorefrontSections';
import { JerseyStorefrontPreview } from './JerseyStorefrontPreview';
import { JerseyDesignEditor } from './JerseyDesignEditor';


/* ═══════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════ */

interface StoreSettings {
  // Store Identity
  storeName: string;
  tagline: string;
  logoUrl: string;
  faviconUrl: string;
  // Domain
  /** Custom domain entered by the user, e.g. shop.mycompany.com */
  customDomain: string;
  /** Read-only slug derived from storeName by the backend, e.g. "my-store" */
  domainSlug: string;
  // Hero Banner
  bannerHeadline: string;
  bannerSubtext: string;
  bannerCta: string;
  bannerBg: string;
  bannerHeight: 'small' | 'medium' | 'large';
  bannerVisible: boolean;
  // Theme Colors
  primaryColor: string;
  bgStyle: 'dark' | 'darker' | 'navy' | 'midnight';
  cardStyle: 'glass' | 'solid' | 'minimal';
  accentColor: string;
  // Product Grid
  gridColumns: 2 | 3 | 4;
  productCardStyle: 'standard' | 'compact' | 'featured';
  showStock: boolean;
  showCategoryBadge: boolean;
  showQuickAdd: boolean;
  productsPerPage: 6 | 9 | 12 | 18;
  // Layout
  headerStyle: 'centered' | 'left' | 'minimal';
  showSearch: boolean;
  showCategoryNav: boolean;
  showCartIcon: boolean;
  footerText: string;
  enableCategoryNav: boolean;
  // Typography
  headingSize: 'small' | 'medium' | 'large';
  bodySize: 'small' | 'medium' | 'large';
  // Publish state (read from backend, not editable directly)
  isPublished?: boolean;
  publishedUrl?: string | null;
  publishedAt?: string | null;
  // Storefront template — 'generic' = original mockup; 'jerseys' uses
  // the projerseyshop.es-style preview (clubs grid, kit cards,
  // customizer CTA, trust strip).
  template?: 'generic' | 'jerseys';
}

interface PreviewProduct {
  id: number;
  name: string;
  price: number;
  stock: number;
  category: string;
  gradient: string;
}

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════ */

const defaultSettings: StoreSettings = {
  storeName: 'PRO JERSEY SHOP',
  tagline: 'Soccer Jerseys Wholesale and Retail',
  logoUrl: '',
  faviconUrl: '',
  customDomain: '',
  domainSlug: '',
  bannerHeadline: 'UPGRADE YOUR JERSEY WITH 2026 WORLD CUP SLEEVE BADGES',
  bannerSubtext: 'Shop authentic World Cup 2026 jerseys and sleeve badges',
  bannerCta: 'SHOP NOW',
  bannerBg: '#1a1a2e',
  bannerHeight: 'large',
  bannerVisible: true,
  primaryColor: '#c8102e',
  bgStyle: 'dark',
  cardStyle: 'solid',
  accentColor: '#c8102e',
  gridColumns: 4,
  productCardStyle: 'standard',
  showStock: false,
  showCategoryBadge: true,
  showQuickAdd: true,
  productsPerPage: 12,
  headerStyle: 'left',
  showSearch: true,
  showCategoryNav: true,
  showCartIcon: true,
  footerText: '© 2010-2026 Pro Jersey Shop soccer store All Rights Reserved',
  enableCategoryNav: true,
  headingSize: 'large',
  bodySize: 'medium',
  isPublished: false,
  publishedUrl: null,
  publishedAt: null,
};

const PREVIEW_PRODUCTS: PreviewProduct[] = [
  { id: 1, name: 'Spain Away Soccer Match Jersey World Cup 2026', price: 24.99, stock: 150, category: 'World Cup 2026', gradient: 'from-red-500 to-yellow-500' },
  { id: 2, name: 'Real Madrid Home Soccer Fan Jersey 2026/27', price: 17.99, stock: 200, category: 'Clubs', gradient: 'from-white to-purple-600' },
  { id: 3, name: 'PSG Champions of Europe #26 Home Soccer Fan Jersey', price: 29.99, stock: 80, category: 'Clubs', gradient: 'from-blue-700 to-red-600' },
  { id: 4, name: 'Brazil Home Soccer Fan Jersey World Cup 2026', price: 19.99, stock: 120, category: 'World Cup 2026', gradient: 'from-yellow-400 to-green-500' },
  { id: 5, name: 'Retro 1998 Brazil Home Soccer Jersey', price: 22.99, stock: 60, category: 'Retro', gradient: 'from-yellow-400 to-blue-600' },
  { id: 6, name: 'Liverpool Home Soccer Match Jersey 2026/27', price: 22.99, stock: 90, category: 'Clubs', gradient: 'from-red-600 to-red-800' },
];

const categoryOptions = ['Electronics', 'Clothing', 'Food', 'Household'];

const colorPresets = [
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Indigo', value: '#6366f1' },
  { label: 'Violet', value: '#8b5cf6' },
  { label: 'Emerald', value: '#10b981' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Rose', value: '#f43f5e' },
  { label: 'Cyan', value: '#06b6d4' },
  { label: 'Pink', value: '#ec4899' },
];

const bannerPresets = [
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Purple', value: '#7c3aed' },
  { label: 'Emerald', value: '#059669' },
  { label: 'Rose', value: '#e11d48' },
  { label: 'Orange', value: '#ea580c' },
  { label: 'Indigo', value: '#4f46e5' },
  { label: 'Teal', value: '#0d9488' },
  { label: 'Slate', value: '#475569' },
];

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */

const tzs = (n: number) => `TZS ${n.toLocaleString()}`;

const bgStyleMap: Record<string, string> = {
  dark: '#0f0f1a',
  darker: '#08080f',
  navy: '#0a1628',
  midnight: '#0d1117',
};

const cardStyleBg: Record<string, string> = {
  glass: 'bg-white/[0.05] backdrop-blur-sm border border-white/[0.08]',
  solid: 'bg-[#16162a] border border-white/[0.06]',
  minimal: 'bg-transparent border border-white/[0.04]',
};

const headingSizeMap = { small: 'text-xl', medium: 'text-2xl', large: 'text-3xl' };
const bodySizeMap = { small: 'text-xs', medium: 'text-sm', large: 'text-base' };
const bannerHeightMap = { small: 'h-32', medium: 'h-44', large: 'h-56' };

/* ═══════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════ */

function ColorPicker({
  label,
  value,
  onChange,
  presets,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  presets: { label: string; value: string }[];
}) {
  const [customOpen, setCustomOpen] = useState(false);

  return (
    <div className="space-y-2">
      {label && <label className="text-xs font-medium text-white/60">{label}</label>}
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p.value}
            onClick={() => onChange(p.value)}
            className={`group relative w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${
              value === p.value ? 'border-white shadow-md scale-110' : 'border-transparent'
            }`}
            style={{ backgroundColor: p.value }}
            title={p.label}
          >
            {value === p.value && (
              <Check className="absolute inset-0 m-auto w-3.5 h-3.5 text-white drop-shadow" />
            )}
          </button>
        ))}
        <div className="relative">
          <button
            onClick={() => setCustomOpen(!customOpen)}
            className="w-7 h-7 rounded-full border-2 border-white/20 bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center hover:border-white/40 transition-all"
            title="Custom color"
          >
            <Palette className="w-3.5 h-3.5 text-white/60" />
          </button>
          {customOpen && (
            <div className="absolute z-50 top-8 left-0 bg-[#1a1a2e] border border-white/[0.08] rounded-lg p-2 shadow-xl">
              <input
                type="color"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-24 h-8 rounded cursor-pointer"
              />
              <button onClick={() => setCustomOpen(false)} className="ml-1 text-white/40 hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/[0.04]">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 w-full px-4 py-3 hover:bg-white/[0.02] transition-colors"
      >
        <Icon className="w-4 h-4 text-white/50" />
        <span className="flex-1 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
          {title}
        </span>
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-white/40" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-white/40" />
        )}
      </button>
      {open && <div className="px-4 pb-4 space-y-4">{children}</div>}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <span className="text-sm text-white/70 group-hover:text-white/90 transition-colors">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

/* ═══════════════════════════════════════════════════════════
   PREVIEW HEADER
   ═══════════════════════════════════════════════════════════ */

function PreviewHeader({
  settings,
}: {
  settings: StoreSettings;
}) {
  const { storeName, tagline, headerStyle, showSearch, showCartIcon, primaryColor } = settings;

  if (headerStyle === 'minimal') {
    return (
      <header
        className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]"
        style={{ backgroundColor: bgStyleMap[settings.bgStyle] }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
            style={{ backgroundColor: primaryColor }}
          >
            {storeName.charAt(0)}
          </div>
          <span className="font-semibold text-white/90 text-sm">{storeName}</span>
        </div>
        {showCartIcon && (
          <button className="relative p-2 rounded-lg hover:bg-white/[0.06] transition-colors">
            <ShoppingBag className="w-4 h-4 text-white/70" />
            <span
              className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
              style={{ backgroundColor: primaryColor }}
            >
              2
            </span>
          </button>
        )}
      </header>
    );
  }

  if (headerStyle === 'centered') {
    return (
      <header
        className="px-5 py-4 border-b border-white/[0.06]"
        style={{ backgroundColor: bgStyleMap[settings.bgStyle] }}
      >
        <div className="flex flex-col items-center gap-1 mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg"
            style={{ backgroundColor: primaryColor }}
          >
            {storeName.charAt(0)}
          </div>
          <div className="text-center">
            <h1 className="font-bold text-white/90 text-lg leading-tight">{storeName}</h1>
            <p className="text-white/40 text-xs">{tagline}</p>
          </div>
        </div>
        <div className="flex items-center justify-center gap-3">
          {showSearch && (
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <input
                type="text"
                placeholder="Search products..."
                readOnly
                className="w-full h-8 pl-8 pr-3 rounded-lg bg-white/[0.05] border border-white/[0.08] text-xs text-white/70 placeholder:text-white/30 outline-none"
              />
            </div>
          )}
          {showCartIcon && (
            <button className="relative p-2 rounded-lg hover:bg-white/[0.06] transition-colors">
              <ShoppingBag className="w-4 h-4 text-white/70" />
              <span
                className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                style={{ backgroundColor: primaryColor }}
              >
                2
              </span>
            </button>
          )}
        </div>
      </header>
    );
  }

  // left-aligned (default)
  return (
    <header
      className="flex items-center gap-4 px-5 py-3.5 border-b border-white/[0.06]"
      style={{ backgroundColor: bgStyleMap[settings.bgStyle] }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold"
        style={{ backgroundColor: primaryColor }}
      >
        {storeName.charAt(0)}
      </div>
      <div className="flex-1">
        <h1 className="font-bold text-white/90 text-sm leading-tight">{storeName}</h1>
        <p className="text-white/40 text-[10px]">{tagline}</p>
      </div>
      {showSearch && (
        <div className="relative w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input
            type="text"
            placeholder="Search..."
            readOnly
            className="w-full h-8 pl-8 pr-3 rounded-lg bg-white/[0.05] border border-white/[0.08] text-xs text-white/70 placeholder:text-white/30 outline-none"
          />
        </div>
      )}
      {showCartIcon && (
        <button className="relative p-2 rounded-lg hover:bg-white/[0.06] transition-colors">
          <ShoppingBag className="w-4 h-4 text-white/70" />
          <span
            className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
            style={{ backgroundColor: primaryColor }}
          >
            2
          </span>
        </button>
      )}
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════
   PREVIEW BANNER
   ═══════════════════════════════════════════════════════════ */

function PreviewBanner({
  settings,
}: {
  settings: StoreSettings;
}) {
  if (!settings.bannerVisible) return null;
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${bannerHeightMap[settings.bannerHeight]}`}
      style={{ backgroundColor: settings.bannerBg }}
    >
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-4 left-8 w-20 h-20 rounded-full bg-white/20 blur-xl" />
        <div className="absolute bottom-4 right-12 w-28 h-28 rounded-full bg-white/15 blur-xl" />
      </div>
      <div className="relative z-10 text-center px-6">
        <h2
          className={`font-bold text-white mb-1 ${headingSizeMap[settings.headingSize]}`}
        >
          {settings.bannerHeadline}
        </h2>
        <p className={`text-white/80 mb-3 ${bodySizeMap[settings.bodySize]}`}>
          {settings.bannerSubtext}
        </p>
        <button
          className="px-5 py-2 rounded-lg text-white text-sm font-medium shadow-lg hover:brightness-110 transition-all"
          style={{ backgroundColor: settings.accentColor }}
        >
          {settings.bannerCta}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PREVIEW PRODUCT CARD
   ═══════════════════════════════════════════════════════════ */

function PreviewProductCard({
  product,
  settings,
}: {
  product: PreviewProduct;
  settings: StoreSettings;
}) {
  const { cardStyle, productCardStyle, showStock, showCategoryBadge, showQuickAdd, primaryColor } = settings;

  const isCompact = productCardStyle === 'compact';
  const isFeatured = productCardStyle === 'featured';

  return (
    <div
      className={`group relative rounded-xl overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg ${cardStyleBg[cardStyle]}`}
    >
      {/* Image area */}
      <div
        className={`relative w-full overflow-hidden ${
          isCompact ? 'h-20' : isFeatured ? 'h-32' : 'h-28'
        }`}
      >
        <div className={`absolute inset-0 bg-gradient-to-br ${product.gradient} opacity-80`} />
        <div className="absolute inset-0 flex items-center justify-center">
          <Tag className="w-8 h-8 text-white/30" />
        </div>
        {showCategoryBadge && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/40 text-[10px] text-white/80 font-medium backdrop-blur-sm">
            {product.category}
          </span>
        )}
        {showStock && product.stock <= 5 && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-red-500/70 text-[10px] text-white font-medium backdrop-blur-sm">
            {product.stock} left
          </span>
        )}
        {showStock && product.stock > 5 && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-emerald-500/60 text-[10px] text-white font-medium backdrop-blur-sm">
            In stock
          </span>
        )}
      </div>

      {/* Info */}
      <div className={`p-2.5 ${isCompact ? 'p-2' : ''}`}>
        <h3
          className={`font-medium text-white/90 truncate leading-tight ${
            isCompact ? 'text-[11px]' : 'text-xs'
          }`}
        >
          {product.name}
        </h3>
        <p className="text-[10px] text-white/40 mt-0.5">{product.category}</p>
        <div className="flex items-center justify-between mt-1.5">
          <span
            className={`font-bold text-white/90 ${isCompact ? 'text-[11px]' : 'text-xs'}`}
          >
            {tzs(product.price)}
          </span>
          {showQuickAdd && (
            <button
              className="p-1 rounded-md text-white/60 hover:text-white transition-colors"
              style={{ backgroundColor: `${primaryColor}30` }}
            >
              <Plus className={`${isCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'}`} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PREVIEW FOOTER
   ═══════════════════════════════════════════════════════════ */

function PreviewFooter({ settings }: { settings: StoreSettings }) {
  return (
    <footer
      className="px-5 py-3 border-t border-white/[0.06] text-center"
      style={{ backgroundColor: bgStyleMap[settings.bgStyle] }}
    >
      <p className="text-[10px] text-white/30">{settings.footerText}</p>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════
   LIVE PREVIEW
   ═══════════════════════════════════════════════════════════ */

function LivePreview({ settings }: { settings: StoreSettings }) {
  if (settings.template === 'jerseys') {
    return (
      <JerseyStorefrontPreview
        primaryColor={settings.primaryColor}
        storeName={settings.storeName}
        tagline={settings.tagline}
      />
    );
  }
  const gridCols =
    settings.gridColumns === 2
      ? 'grid-cols-2'
      : settings.gridColumns === 4
      ? 'grid-cols-4'
      : 'grid-cols-3';

  const bodySize = bodySizeMap[settings.bodySize];

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ backgroundColor: bgStyleMap[settings.bgStyle] }}
    >
      <PreviewHeader settings={settings} />

      <ScrollArea className="flex-1 min-h-0">
        {/* Banner */}
        <PreviewBanner settings={settings} />

        {/* Category Nav */}
        {settings.enableCategoryNav && settings.showCategoryNav && (
          <div className="px-5 py-3 flex flex-wrap gap-2 border-b border-white/[0.04]">
            {['All', ...categoryOptions].map((cat, i) => (
              <button
                key={cat}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  i === 0
                    ? 'text-white'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
                }`}
                style={i === 0 ? { backgroundColor: settings.primaryColor } : {}}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Product Grid */}
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2
              className={`font-bold text-white/90 ${headingSizeMap[settings.headingSize]}`}
            >
              Featured Products
            </h2>
            <button
              className="text-xs font-medium hover:opacity-80 transition-opacity"
              style={{ color: settings.primaryColor }}
            >
              View all
            </button>
          </div>
          <div className={`grid ${gridCols} gap-3`}>
            {PREVIEW_PRODUCTS.slice(0, Math.min(settings.productsPerPage, PREVIEW_PRODUCTS.length)).map((product) => (
              <PreviewProductCard key={product.id} product={product} settings={settings} />
            ))}
          </div>
        </div>

        {/* Newsletter / CTA section */}
        <div className="px-5 pb-5">
          <div
            className="rounded-xl p-5 text-center"
            style={{ backgroundColor: `${settings.primaryColor}15` }}
          >
            <h3 className={`font-bold text-white/90 mb-1 ${headingSizeMap[settings.headingSize]}`}>
              Stay Updated
            </h3>
            <p className={`text-white/50 mb-3 ${bodySize}`}>
              Subscribe for exclusive deals and new arrivals
            </p>
            <div className="flex gap-2 max-w-xs mx-auto">
              <input
                type="text"
                placeholder="Enter your email"
                readOnly
                className="flex-1 h-8 px-3 rounded-lg bg-white/[0.06] border border-white/[0.08] text-xs text-white/70 placeholder:text-white/30 outline-none"
              />
              <button
                className="px-4 h-8 rounded-lg text-xs font-medium text-white hover:brightness-110 transition-all"
                style={{ backgroundColor: settings.primaryColor }}
              >
                Subscribe
              </button>
            </div>
          </div>
        </div>

        <PreviewFooter settings={settings} />
      </ScrollArea>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */

export default function StoreEditor() {
  const [settings, setSettings] = useState<StoreSettings>(defaultSettings);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<{
    ready: boolean;
    deploymentMode: 'hosted' | 'self-hosted';
    domain: string;
    checks: Array<{ id: string; label: string; ok: boolean; detail: string }>;
  } | null>(null);

  // Mount-only async work uses this flag (the install handler also flips it)
  // so we don't setState after the editor closes mid-request.
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // Publish-readiness preflight — one checklist of what's configured vs
  // missing for go-live, so the operator isn't guessing.
  const refreshReadiness = useCallback(async () => {
    try {
      const r = await api<{
        ready: boolean;
        deploymentMode: 'hosted' | 'self-hosted';
        domain: string;
        checks: Array<{ id: string; label: string; ok: boolean; detail: string }>;
      }>('/store-settings/publish-readiness');
      if (mountedRef.current) setReadiness(r);
    } catch { /* leave null — panel hidden when unknown */ }
  }, []);

  useEffect(() => { void refreshReadiness(); }, [refreshReadiness]);

  const [mobileQrOpen, setMobileQrOpen] = useState(false);
  const [qrCopied, setQrCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Load persisted settings on mount
  useEffect(() => {
    api<StoreSettings>('/store-settings')
      .then((data) => setSettings({ ...defaultSettings, ...data }))
      .catch((e) => setLoadError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const update = useCallback(<K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
    setSaveError(null);
  }, []);

  // Latest settings snapshot — read inside async handlers to avoid the
  // stale-closure bug when the user clicks Save twice quickly (the second
  // request used to send the pre-update form state).
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await api<StoreSettings>('/store-settings', {
        method: 'PUT',
        body: JSON.stringify(settingsRef.current),
      });
      // The backend auto-publishes on save when the slug changed / was
      // never published, so the response can include publish fields too.
      // Merge the full payload so the UI flips to "Published" without a
      // separate refresh.
      setSettings((prev) => ({ ...prev, ...updated }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    setSettings(defaultSettings);
    setSaved(false);
    setSaveError(null);
  }, []);

  const handlePublish = useCallback(async () => {
    setPublishing(true);
    setPublishError(null);
    try {
      // Save first so the backend has the latest store name / slug. The
      // PUT may already publish (backend auto-publishes on save) — if so
      // we skip the redundant POST below to avoid double-publishing and
      // the slug-check race that would happen between them.
      const saved = await api<StoreSettings>('/store-settings', {
        method: 'PUT',
        body: JSON.stringify(settingsRef.current),
      });
      if (saved.isPublished) {
        setSettings((prev) => ({ ...prev, ...saved }));
        return;
      }

      // Check slug availability — only relevant when the backend's
      // auto-publish didn't already take it.
      if (saved.domainSlug) {
        const check = await api<{ available: boolean; reason?: string }>(
          `/store-settings/check-slug?slug=${encodeURIComponent(saved.domainSlug)}`,
        );
        if (!check.available && check.reason !== 'taken') {
          // "taken" by the same owner is fine — they're re-publishing
          setPublishError(
            check.reason === 'reserved'
              ? `"${saved.domainSlug}" is a reserved name. Choose a different store name.`
              : 'That store name is already taken. Choose a different name.',
          );
          return;
        }
      }

      const updated = await api<StoreSettings>('/store-settings/publish', { method: 'POST' });
      setSettings((prev) => ({
        ...prev,
        isPublished: updated.isPublished,
        publishedUrl: updated.publishedUrl,
        publishedAt: updated.publishedAt,
      }));
    } catch (e) {
      setPublishError((e as Error).message ?? 'Publish failed');
    } finally {
      setPublishing(false);
    }
  }, []);

  const handleUnpublish = useCallback(async () => {
    setPublishing(true);
    setPublishError(null);
    try {
      const updated = await api<StoreSettings>('/store-settings/publish', { method: 'DELETE' });
      setSettings((prev) => ({
        ...prev,
        isPublished: updated.isPublished,
        publishedUrl: updated.publishedUrl,
        publishedAt: updated.publishedAt,
      }));
    } catch (e) {
      setPublishError((e as Error).message);
    } finally {
      setPublishing(false);
    }
  }, []);

  const handleExport = useCallback(() => {
    const css = `/* KOBESTORE Theme CSS */
:root {
  --primary-color: ${settings.primaryColor};
  --accent-color: ${settings.accentColor};
  --bg-color: ${bgStyleMap[settings.bgStyle]};
  --banner-bg: ${settings.bannerBg};
}
.store-name { font-size: ${settings.headingSize === 'large' ? '1.5rem' : settings.headingSize === 'medium' ? '1.25rem' : '1rem'}; }
.body-text { font-size: ${settings.bodySize === 'large' ? '1rem' : settings.bodySize === 'medium' ? '0.875rem' : '0.75rem'}; }
.product-grid { grid-template-columns: repeat(${settings.gridColumns}, 1fr); }
.banner { background-color: ${settings.bannerBg}; display: ${settings.bannerVisible ? 'block' : 'none'}; }
.card-style { /* ${settings.cardStyle} */ }
`;
    const blob = new Blob([css], { type: 'text/css' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kobestore-theme.css';
    a.click();
    URL.revokeObjectURL(url);
  }, [settings]);

  /* ═════════════════════════════════════════════════════════
     RENDER
     ═════════════════════════════════════════════════════════ */
  return (
    <div className="flex h-full bg-[#0d0d1a] text-white/90 overflow-hidden">
      {/* LEFT SIDEBAR — Editor Controls */}
      <aside className="w-72 shrink-0 bg-[#111118] border-r border-white/[0.06] flex flex-col">
        {/* Sidebar Header */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.06]">
          <div className="w-8 h-8 rounded-lg bg-violet-500 flex items-center justify-center">
            <Palette className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white/90 leading-tight">Store Editor</h2>
            <p className="text-[10px] text-white/40">Customize your storefront</p>
          </div>
        </div>

        {/* Sections */}
        <ScrollArea className="flex-1 min-h-0">
          {/* ─── Preview Template ─── */}
          <Section title="Preview Template" icon={LayoutGrid} defaultOpen>
            <div className="space-y-2">
              <p className="text-[10px] text-white/50">
                Pick the storefront layout used by the live preview on the right.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'generic', label: 'Generic', sub: 'Single hero + product grid' },
                  { id: 'jerseys', label: 'Jersey Shop', sub: 'projerseyshop.es style' },
                ].map((opt) => {
                  const active = (settings.template ?? 'generic') === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => update('template', opt.id as 'generic' | 'jerseys')}
                      className={`text-left p-2.5 rounded-lg border transition-all ${
                        active
                          ? 'border-amber-500/60 bg-amber-500/10'
                          : 'border-white/[0.08] bg-white/[0.03] hover:border-white/20'
                      }`}
                    >
                      <div className={`text-xs font-bold ${active ? 'text-amber-300' : 'text-white/80'}`}>{opt.label}</div>
                      <div className="text-[10px] text-white/50 mt-0.5">{opt.sub}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </Section>

          {/* ─── Industry Template ─── */}
          <Section title="Industry Template" icon={LayoutGrid}>
            <IndustryTemplatePicker />
          </Section>

          {/* ─── Homepage Section Builder ─── */}
          <Section title="Homepage Sections" icon={Layers}>
            <HomepageSectionBuilder />
          </Section>

          {/* ─── Jersey Storefront Design (projerseyshop.es-style) ─── */}
          <Section title="Storefront Design" icon={LayoutGrid}>
            <JerseyDesignEditor />
          </Section>

          {/* ─── Store Identity ─── */}
          <Section title="Store Identity" icon={Store} defaultOpen>
            <div className="space-y-3">
              <div>
                <label htmlFor="store-name-input" className="text-xs font-medium text-white/50 mb-1.5 block">Store Name</label>
                <Input
                  id="store-name-input"
                  value={settings.storeName}
                  onChange={(e) => update('storeName', e.target.value)}
                  className="h-8 bg-white/[0.04] border-white/[0.08] text-sm text-white/90 placeholder:text-white/30"
                  placeholder="Your store name"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="store-tagline-input" className="text-xs font-medium text-white/50">Tagline</label>
                  <TranslateButton text={settings.tagline} onTranslated={(t) => update('tagline', t)} />
                </div>
                <Input
                  id="store-tagline-input"
                  value={settings.tagline}
                  onChange={(e) => update('tagline', e.target.value)}
                  className="h-8 bg-white/[0.04] border-white/[0.08] text-sm text-white/90 placeholder:text-white/30"
                  placeholder="Your tagline"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-white/50 mb-1.5 block">Logo</label>
                {/* Real upload — was a dead <div> before. PhotoUpload handles
                    drag-drop, click-to-pick, paste-URL, error state, and
                    persists via /api/media/upload. */}
                <PhotoUpload
                  value={settings.logoUrl}
                  onChange={(url) => update('logoUrl', url ?? '')}
                  aspect="square"
                />
              </div>
              <div>
                <label htmlFor="store-favicon-input" className="text-xs font-medium text-white/50 mb-1.5 block">Favicon</label>
                <div className="flex items-center gap-2">
                  <div
                    aria-hidden="true"
                    className="w-8 h-8 rounded bg-[#1a1a2e] border border-white/[0.08] flex items-center justify-center text-xs font-bold text-white/60"
                  >
                    {settings.storeName.charAt(0)}
                  </div>
                  <Input
                    id="store-favicon-input"
                    value={settings.faviconUrl}
                    onChange={(e) => update('faviconUrl', e.target.value)}
                    className="flex-1 h-8 bg-white/[0.04] border-white/[0.08] text-xs text-white/70 placeholder:text-white/30"
                    placeholder="Favicon URL"
                  />
                </div>
              </div>
            </div>
          </Section>

          {/* ─── Domain & Publish ─── */}
          <Section title="Domain & Publish" icon={Globe} defaultOpen>
            <div className="space-y-3">
              {/* Default subdomain (read-only) */}
              <div>
                <label className="text-xs font-medium text-white/50 mb-1.5 block">Your subdomain</label>
                <div className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-white/[0.02] border border-white/[0.06] text-xs text-white/40 font-mono select-all">
                  {settings.domainSlug
                    ? `${settings.domainSlug}.kobeapptz.com`
                    : <span className="italic">save store name first…</span>}
                </div>
                <p className="text-[10px] text-white/30 mt-1">Auto-generated from your store name</p>
              </div>

              {/* Custom domain */}
              <div>
                <label htmlFor="store-custom-domain-input" className="text-xs font-medium text-white/50 mb-1.5 block">Custom Domain (optional)</label>
                <Input
                  id="store-custom-domain-input"
                  value={settings.customDomain}
                  onChange={(e) => update('customDomain', e.target.value)}
                  className="h-8 bg-white/[0.04] border-white/[0.08] text-sm text-white/90 placeholder:text-white/30 font-mono"
                  placeholder="shop.mycompany.com"
                />
                <p className="text-[10px] text-white/30 mt-1">
                  Point a CNAME to <span className="text-white/50 font-mono">kobeapptz.com</span> then enter it here
                </p>
              </div>

              {/* Publish status */}
              {settings.isPublished ? (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2">
                  {/* Live indicator — under Cloudflare Pages the store is served
                      from the edge the moment it's published; no tunnel to
                      reconnect, so "published" == "live". */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0 bg-emerald-400 animate-pulse" />
                      <span className="text-xs font-medium text-emerald-300">Live</span>
                    </div>
                    <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  </div>

                  <a
                    href={settings.publishedUrl ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] text-emerald-300/80 font-mono truncate hover:text-emerald-200 underline underline-offset-2"
                  >
                    {settings.publishedUrl}
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>

                  {settings.publishedAt && (
                    <p className="text-[10px] text-white/30">
                      Published {new Date(settings.publishedAt).toLocaleDateString()}
                    </p>
                  )}

                  {/* Direct (path-based) link — works the moment the apex
                      serves the app, with no wildcard DNS or tunnel. Give
                      merchants a reliable share link even while the
                      subdomain above is still coming up. */}
                  {settings.domainSlug && (() => {
                    const pathUrl = `https://kobeapptz.com/shop/${settings.domainSlug}`;
                    return (
                      <div className="rounded-md border border-white/10 bg-white/[0.02] p-2 space-y-1">
                        <div className="text-[10px] font-bold text-white/50 uppercase tracking-wide">
                          Direct link — always works
                        </div>
                        <div className="flex items-center gap-1.5">
                          <a
                            href={pathUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 text-[11px] text-indigo-300/80 font-mono truncate hover:text-indigo-200 underline underline-offset-2"
                          >
                            kobeapptz.com/shop/{settings.domainSlug}
                          </a>
                          <button
                            onClick={() => {
                              navigator.clipboard?.writeText(pathUrl).catch(() => {});
                              setLinkCopied(true);
                              setTimeout(() => setLinkCopied(false), 1500);
                            }}
                            className="shrink-0 text-white/50 hover:text-white/80"
                            title="Copy direct link"
                          >
                            {linkCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <p className="text-[9px] text-white/30 leading-snug">
                          No wildcard/tunnel needed — share this while the subdomain finishes setup.
                        </p>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10 hover:text-indigo-200 bg-transparent"
                      onClick={() => setMobileQrOpen(true)}
                      disabled={!settings.domainSlug}
                    >
                      <QrCode className="w-3 h-3 mr-1" /> Mobile QR
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 bg-transparent"
                      onClick={handleUnpublish}
                      disabled={publishing}
                    >
                      {publishing
                        ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> Unpublishing…</>
                        : 'Unpublish'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Button
                    size="sm"
                    className="w-full h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                    onClick={handlePublish}
                    disabled={publishing || !settings.domainSlug}
                  >
                    {publishing
                      ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> Publishing…</>
                      : <><Globe className="w-3 h-3 mr-1.5" /> Publish to kobeapptz.com</>}
                  </Button>
                  {!settings.domainSlug && (
                    <p className="text-[10px] text-amber-400/70 text-center">Save your store name first</p>
                  )}
                  {/* Publish-readiness preflight — shows the operator exactly
                      what's configured vs missing for go-live. Only rendered
                      when something is NOT ready, so a healthy install stays
                      clean. */}
                  {readiness && !readiness.ready && (
                    <div className="rounded-md border border-amber-500/25 bg-amber-500/[0.06] p-2.5 space-y-1.5">
                      <div className="text-[10px] font-bold text-amber-300/90 uppercase tracking-wide">
                        Publish setup ({readiness.deploymentMode})
                      </div>
                      {readiness.checks.map((c) => (
                        <div key={c.id} className="flex items-start gap-1.5 text-[10px]">
                          <span className={`mt-0.5 shrink-0 ${c.ok ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {c.ok ? '✓' : '•'}
                          </span>
                          <span className={c.ok ? 'text-white/60' : 'text-white/80'}>
                            <span className="font-semibold">{c.label}:</span> {c.detail}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {readiness?.ready && (
                    <p className="text-[10px] text-emerald-400/80 text-center inline-flex items-center justify-center gap-1 w-full">
                      <Globe className="w-3 h-3" /> Ready to publish on {readiness.domain}
                    </p>
                  )}
                  {/* Served from Cloudflare's edge — no per-machine binary,
                      no tunnel. Publishing flips the store live on its
                      subdomain instantly via the platform's wildcard domain. */}
                  <div className="flex items-start gap-2 px-2.5 py-2 rounded-md border bg-white/[0.03] border-white/[0.06] text-[10px] text-white/50">
                    <Globe className="w-3 h-3 shrink-0 mt-0.5 text-indigo-400/60" />
                    <span className="flex-1">
                      Served from Cloudflare's edge — publishing makes your store
                      live at <span className="font-mono text-white/70">{settings.domainSlug || 'yourstore'}.kobeapptz.com</span> instantly.
                      No install needed.
                    </span>
                  </div>
                </div>
              )}

              {/* Publish error */}
              {publishError && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[11px] text-red-300">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span className="break-words">{publishError}</span>
                </div>
              )}
            </div>
          </Section>

          {/* ─── Hero Banner ─── */}
          <Section title="Hero Banner" icon={Image} defaultOpen>
            <div className="space-y-3">
              <Toggle label="Show Banner" checked={settings.bannerVisible} onChange={(v) => update('bannerVisible', v)} />
              {settings.bannerVisible && (
                <>
                  <div>
                    <label htmlFor="store-banner-headline-input" className="text-xs font-medium text-white/50 mb-1.5 block">Headline</label>
                    <Input
                      id="store-banner-headline-input"
                      value={settings.bannerHeadline}
                      onChange={(e) => update('bannerHeadline', e.target.value)}
                      className="h-8 bg-white/[0.04] border-white/[0.08] text-sm text-white/90"
                    />
                  </div>
                  <div>
                    <label htmlFor="store-banner-subtext-input" className="text-xs font-medium text-white/50 mb-1.5 block">Subtext</label>
                    <Input
                      id="store-banner-subtext-input"
                      value={settings.bannerSubtext}
                      onChange={(e) => update('bannerSubtext', e.target.value)}
                      className="h-8 bg-white/[0.04] border-white/[0.08] text-sm text-white/90"
                    />
                  </div>
                  <div>
                    <label htmlFor="store-banner-cta-input" className="text-xs font-medium text-white/50 mb-1.5 block">CTA Button</label>
                    <Input
                      id="store-banner-cta-input"
                      value={settings.bannerCta}
                      onChange={(e) => update('bannerCta', e.target.value)}
                      className="h-8 bg-white/[0.04] border-white/[0.08] text-sm text-white/90"
                    />
                  </div>
                  <ColorPicker
                    label="Background Color"
                    value={settings.bannerBg}
                    onChange={(v) => update('bannerBg', v)}
                    presets={bannerPresets}
                  />
                  <div>
                    <label className="text-xs font-medium text-white/50 mb-1.5 block">
                      Height: <span className="text-white/70 capitalize">{settings.bannerHeight}</span>
                    </label>
                    <div className="flex gap-2">
                      {(['small', 'medium', 'large'] as const).map((h) => (
                        <button
                          key={h}
                          onClick={() => update('bannerHeight', h)}
                          className={`flex-1 h-7 rounded-md text-[10px] font-medium capitalize border transition-all ${
                            settings.bannerHeight === h
                              ? 'bg-white/[0.1] border-white/30 text-white/90'
                              : 'bg-white/[0.03] border-white/[0.08] text-white/40 hover:text-white/60'
                          }`}
                        >
                          {h}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </Section>

          {/* ─── Theme Colors ─── */}
          <Section title="Theme Colors" icon={Palette}>
            <div className="space-y-4">
              <ColorPicker
                label="Primary Color"
                value={settings.primaryColor}
                onChange={(v) => update('primaryColor', v)}
                presets={colorPresets}
              />
              <div>
                <label className="text-xs font-medium text-white/50 mb-1.5 block">Background Style</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { label: 'Dark', value: 'dark' },
                      { label: 'Darker', value: 'darker' },
                      { label: 'Navy', value: 'navy' },
                      { label: 'Midnight', value: 'midnight' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => update('bgStyle', opt.value)}
                      className={`h-8 rounded-lg text-[11px] font-medium border transition-all ${
                        settings.bgStyle === opt.value
                          ? 'border-white/30 bg-white/[0.08] text-white/90'
                          : 'border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/60'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-white/50 mb-1.5 block">Card Style</label>
                <div className="flex gap-1.5">
                  {(['glass', 'solid', 'minimal'] as const).map((style) => (
                    <button
                      key={style}
                      onClick={() => update('cardStyle', style)}
                      className={`flex-1 h-8 rounded-lg text-[11px] font-medium capitalize border transition-all ${
                        settings.cardStyle === style
                          ? 'border-white/30 bg-white/[0.08] text-white/90'
                          : 'border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/60'
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>
              <ColorPicker
                label="Accent Color"
                value={settings.accentColor}
                onChange={(v) => update('accentColor', v)}
                presets={colorPresets}
              />
            </div>
          </Section>

          {/* ─── Product Grid ─── */}
          <Section title="Product Grid" icon={Grid3X3}>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-white/50 mb-1.5 block">Columns</label>
                <div className="flex gap-1.5">
                  {([2, 3, 4] as const).map((n) => (
                    <button
                      key={n}
                      onClick={() => update('gridColumns', n)}
                      className={`flex-1 h-8 rounded-lg text-[11px] font-medium border transition-all ${
                        settings.gridColumns === n
                          ? 'border-white/30 bg-white/[0.08] text-white/90'
                          : 'border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/60'
                      }`}
                    >
                      {n} Cols
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-white/50 mb-1.5 block">Card Style</label>
                <div className="flex gap-1.5">
                  {(['standard', 'compact', 'featured'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => update('productCardStyle', s)}
                      className={`flex-1 h-8 rounded-lg text-[11px] font-medium capitalize border transition-all ${
                        settings.productCardStyle === s
                          ? 'border-white/30 bg-white/[0.08] text-white/90'
                          : 'border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/60'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2.5">
                <Toggle label="Show Stock Indicator" checked={settings.showStock} onChange={(v) => update('showStock', v)} />
                <Toggle label="Show Category Badge" checked={settings.showCategoryBadge} onChange={(v) => update('showCategoryBadge', v)} />
                <Toggle label="Show Quick Add Button" checked={settings.showQuickAdd} onChange={(v) => update('showQuickAdd', v)} />
              </div>
              <div>
                <label className="text-xs font-medium text-white/50 mb-1.5 block">Products per Page</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {([6, 9, 12, 18] as const).map((n) => (
                    <button
                      key={n}
                      onClick={() => update('productsPerPage', n)}
                      className={`h-8 rounded-lg text-[11px] font-medium border transition-all ${
                        settings.productsPerPage === n
                          ? 'border-white/30 bg-white/[0.08] text-white/90'
                          : 'border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/60'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* ─── Layout ─── */}
          <Section title="Layout" icon={PanelLeft}>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-white/50 mb-1.5 block">Header Style</label>
                <div className="flex gap-1.5">
                  {([
                    { label: 'Left', value: 'left' },
                    { label: 'Centered', value: 'centered' },
                    { label: 'Minimal', value: 'minimal' },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => update('headerStyle', opt.value)}
                      className={`flex-1 h-8 rounded-lg text-[11px] font-medium border transition-all capitalize ${
                        settings.headerStyle === opt.value
                          ? 'border-white/30 bg-white/[0.08] text-white/90'
                          : 'border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/60'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2.5">
                <Toggle label="Show Search Bar" checked={settings.showSearch} onChange={(v) => update('showSearch', v)} />
                <Toggle label="Show Category Nav" checked={settings.showCategoryNav} onChange={(v) => update('showCategoryNav', v)} />
                <Toggle label="Show Cart Icon" checked={settings.showCartIcon} onChange={(v) => update('showCartIcon', v)} />
                <Toggle label="Enable Category Nav Bar" checked={settings.enableCategoryNav} onChange={(v) => update('enableCategoryNav', v)} />
              </div>
              <div>
                <label htmlFor="store-footer-text-input" className="text-xs font-medium text-white/50 mb-1.5 block">Footer Text</label>
                <Input
                  id="store-footer-text-input"
                  value={settings.footerText}
                  onChange={(e) => update('footerText', e.target.value)}
                  className="h-8 bg-white/[0.04] border-white/[0.08] text-xs text-white/90"
                  placeholder="Footer text"
                />
              </div>
            </div>
          </Section>

          {/* ─── Typography ─── */}
          <Section title="Typography" icon={TypeIcon}>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-white/50 mb-1.5 block">Heading Size</label>
                <div className="flex gap-1.5">
                  {(['small', 'medium', 'large'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => update('headingSize', s)}
                      className={`flex-1 h-8 rounded-lg text-[11px] font-medium capitalize border transition-all ${
                        settings.headingSize === s
                          ? 'border-white/30 bg-white/[0.08] text-white/90'
                          : 'border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/60'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-white/50 mb-1.5 block">Body Size</label>
                <div className="flex gap-1.5">
                  {(['small', 'medium', 'large'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => update('bodySize', s)}
                      className={`flex-1 h-8 rounded-lg text-[11px] font-medium capitalize border transition-all ${
                        settings.bodySize === s
                          ? 'border-white/30 bg-white/[0.08] text-white/90'
                          : 'border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/60'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Section>
        </ScrollArea>

        {/* Bottom Actions */}
        <div className="p-3 border-t border-white/[0.06] flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8 bg-transparent border-white/[0.08] text-white/60 hover:bg-white/[0.06] hover:text-white/90 text-xs"
            onClick={handleReset}
          >
            <RotateCcw className="w-3 h-3 mr-1.5" />
            Reset
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8 bg-transparent border-white/[0.08] text-white/60 hover:bg-white/[0.06] hover:text-white/90 text-xs"
            onClick={handleExport}
          >
            <Download className="w-3 h-3 mr-1.5" />
            Export CSS
          </Button>
        </div>
      </aside>

      {/* RIGHT PANEL — Live Preview */}
      <div className="flex-1 flex flex-col bg-[#0a0a1a] overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col border-b border-white/[0.06] bg-[#111118]">
          <div className="flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-white/50" />
              <span className="text-xs font-medium text-white/70">Live Preview</span>
              <span className="text-[10px] text-white/30 px-1.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06]">
                375px
              </span>
              {/* Active domain pill */}
              {(settings.publishedUrl || settings.customDomain || settings.domainSlug) && (
                <span className={`hidden sm:flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-mono border ${
                  settings.isPublished
                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                    : 'text-white/40 bg-white/[0.03] border-white/[0.06]'
                }`}>
                  <Globe className="w-2.5 h-2.5" />
                  {settings.publishedUrl ?? settings.customDomain ?? `${settings.domainSlug}.kobeapptz.com`}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {loading && (
                <span className="text-[10px] text-white/40 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading…
                </span>
              )}
              {saved && (
                <span className="text-[10px] text-emerald-400 font-medium px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Saved
                </span>
              )}
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || loading}
                className="h-7 px-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-medium"
              >
                {saving
                  ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> Saving…</>
                  : <><Save className="w-3 h-3 mr-1.5" /> Save</>
                }
              </Button>
            </div>
          </div>
          {/* Error banners */}
          {loadError && (
            <div className="mx-4 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Could not load saved settings: {loadError}. Showing defaults.
            </div>
          )}
          {saveError && (
            <div className="mx-4 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[11px] text-red-300">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Save failed: {saveError}
            </div>
          )}
        </div>

        {/* Preview Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <LivePreview settings={settings} />
        </div>
      </div>

      {/* Mobile QR dialog — owners scan to load the mobile webapp (POS,
       *  PO, EOD, Sales/Expenses, stock, orders) at the same subdomain. */}
      {mobileQrOpen && (
        <MobileQrDialog
          slug={settings.domainSlug}
          publishedUrl={settings.publishedUrl ?? null}
          onClose={() => { setMobileQrOpen(false); setQrCopied(false); }}
          copied={qrCopied}
          onCopy={() => { setQrCopied(true); setTimeout(() => setQrCopied(false), 2000); }}
        />
      )}
    </div>
  );
}

function MobileQrDialog({
  slug, publishedUrl, onClose, copied, onCopy,
}: {
  slug: string;
  publishedUrl: string | null;
  onClose: () => void;
  copied: boolean;
  onCopy: () => void;
}) {
  // Prefer the published HTTPS URL on the real subdomain (e.g.
  // https://kelvinfashion.kobeapptz.com/m/kelvinfashion). Fall back to
  // the current origin so the QR still works for an operator testing
  // locally before publishing.
  const base = publishedUrl
    ? publishedUrl.replace(/\/+$/, '')
    : (typeof window !== 'undefined' ? window.location.origin : '');
  const mobileUrl = `${base}/m/${slug || 'store'}`;

  const downloadQr = () => {
    const svg = document.getElementById('kobe-mobile-qr')?.outerHTML;
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kobeos-mobile-${slug || 'store'}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#13131f] border-white/[0.06] text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-indigo-400" /> Mobile workspace
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-white/60">
            Scan with a phone to open POS, Purchase Orders, End-of-Day, Sales &amp; Expenses,
            stock lookup, and order history — all on the same subdomain as your store.
          </p>

          <div className="bg-white rounded-xl p-4 grid place-items-center">
            <QRCodeSVG
              id="kobe-mobile-qr"
              value={mobileUrl}
              size={200}
              level="M"
              includeMargin
            />
          </div>

          <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-[11px] font-mono text-white/80 break-all">
            <span className="flex-1">{mobileUrl}</span>
            <button
              onClick={async () => {
                try { await navigator.clipboard?.writeText(mobileUrl); onCopy(); }
                catch { /* clipboard unavailable */ }
              }}
              className="text-indigo-300 hover:text-indigo-200"
              title="Copy URL"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-white/15 text-white/80 hover:bg-white/5"
              onClick={downloadQr}
            >
              <Download className="w-3.5 h-3.5 mr-1.5" /> Download SVG
            </Button>
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={onClose}
            >
              Done
            </Button>
          </div>

          {!publishedUrl && (
            <p className="text-[10px] text-amber-400/70 text-center">
              Store not yet published — QR points at this device's URL. Publish to get a real https://{slug || '<slug>'}.kobeapptz.com link.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────── NLLB translate button (en → swh) ─────────────────── */

function TranslateButton({ text, onTranslated }: { text: string; onTranslated: (t: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<'swh_Latn' | 'fra_Latn' | 'arb_Arab' | 'por_Latn'>('swh_Latn');
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    if (!text?.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const out = await api<{ translation: string }>('/translation/translate', {
        method: 'POST',
        body: JSON.stringify({ text, source: 'eng_Latn', target }),
      });
      if (out.translation) onTranslated(out.translation);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
      setTimeout(() => setErr(null), 4000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      {err && <span className="text-[10px] text-rose-300">{err}</span>}
      <select
        value={target}
        onChange={(e) => setTarget(e.target.value as typeof target)}
        className="bg-white/5 border border-white/10 rounded text-[10px] text-white/80 px-1.5 py-0.5"
      >
        <option value="swh_Latn">→ Swahili</option>
        <option value="fra_Latn">→ French</option>
        <option value="arb_Arab">→ Arabic</option>
        <option value="por_Latn">→ Portuguese</option>
      </select>
      <button
        type="button"
        onClick={run}
        disabled={busy || !text?.trim()}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 border border-blue-500/30 disabled:opacity-60"
      >
        {busy ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Languages className="w-2.5 h-2.5" />}
        {busy ? '…' : 'Translate'}
      </button>
    </div>
  );
}
