import { useState, useCallback } from 'react';
import {
  Palette, Image, RotateCcw, Save, Download,
  ShoppingBag, Search, ChevronDown, ChevronRight, Check, Upload, Eye, X,
  Store, Type as TypeIcon, Grid3X3, PanelLeft, Tag, Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';


/* ═══════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════ */

interface StoreSettings {
  // Store Identity
  storeName: string;
  tagline: string;
  logoUrl: string;
  faviconUrl: string;
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
  storeName: 'KOBESTORE',
  tagline: 'Your One-Stop Shop',
  logoUrl: '',
  faviconUrl: '',
  bannerHeadline: 'Summer Collection',
  bannerSubtext: 'Up to 50% off on selected items',
  bannerCta: 'Shop Now',
  bannerBg: '#3b82f6',
  bannerHeight: 'medium',
  bannerVisible: true,
  primaryColor: '#6366f1',
  bgStyle: 'dark',
  cardStyle: 'glass',
  accentColor: '#8b5cf6',
  gridColumns: 3,
  productCardStyle: 'standard',
  showStock: true,
  showCategoryBadge: true,
  showQuickAdd: true,
  productsPerPage: 9,
  headerStyle: 'left',
  showSearch: true,
  showCategoryNav: true,
  showCartIcon: true,
  footerText: '© 2025 KOBESTORE. All rights reserved.',
  enableCategoryNav: true,
  headingSize: 'medium',
  bodySize: 'medium',
};

const previewProducts: PreviewProduct[] = [
  { id: 1, name: 'Samsung Galaxy A14', price: 450000, stock: 3, category: 'Electronics', gradient: 'from-blue-600 to-indigo-700' },
  { id: 2, name: 'Tecno Spark 10', price: 280000, stock: 12, category: 'Electronics', gradient: 'from-indigo-600 to-purple-700' },
  { id: 3, name: "Men's Cotton T-Shirt", price: 15000, stock: 5, category: 'Clothing', gradient: 'from-emerald-600 to-green-700' },
  { id: 4, name: 'Kitenge Dress', price: 45000, stock: 8, category: 'Clothing', gradient: 'from-green-600 to-teal-700' },
  { id: 5, name: 'Mama Ntilie Rice 5kg', price: 18000, stock: 4, category: 'Food', gradient: 'from-amber-600 to-yellow-700' },
  { id: 6, name: 'Solar Panel 100W', price: 180000, stock: 7, category: 'Household', gradient: 'from-pink-600 to-fuchsia-700' },
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

      <ScrollArea className="flex-1">
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
            {previewProducts.slice(0, settings.productsPerPage > 6 ? 6 : settings.productsPerPage).map((product) => (
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

  const update = useCallback(<K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

  const handleSave = useCallback(() => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, []);

  const handleReset = useCallback(() => {
    setSettings(defaultSettings);
    setSaved(false);
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
        <ScrollArea className="flex-1">
          {/* ─── Store Identity ─── */}
          <Section title="Store Identity" icon={Store} defaultOpen>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-white/50 mb-1.5 block">Store Name</label>
                <Input
                  value={settings.storeName}
                  onChange={(e) => update('storeName', e.target.value)}
                  className="h-8 bg-white/[0.04] border-white/[0.08] text-sm text-white/90 placeholder:text-white/30"
                  placeholder="Your store name"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-white/50 mb-1.5 block">Tagline</label>
                <Input
                  value={settings.tagline}
                  onChange={(e) => update('tagline', e.target.value)}
                  className="h-8 bg-white/[0.04] border-white/[0.08] text-sm text-white/90 placeholder:text-white/30"
                  placeholder="Your tagline"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-white/50 mb-1.5 block">Logo</label>
                <div className="border border-dashed border-white/[0.12] rounded-lg p-4 flex flex-col items-center gap-2 hover:border-white/20 transition-colors cursor-pointer bg-white/[0.02]">
                  <Upload className="w-5 h-5 text-white/30" />
                  <span className="text-[10px] text-white/40">Click to upload logo</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-white/50 mb-1.5 block">Favicon</label>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-[#1a1a2e] border border-white/[0.08] flex items-center justify-center text-xs font-bold text-white/60">
                    {settings.storeName.charAt(0)}
                  </div>
                  <Input
                    value={settings.faviconUrl}
                    onChange={(e) => update('faviconUrl', e.target.value)}
                    className="flex-1 h-8 bg-white/[0.04] border-white/[0.08] text-xs text-white/70 placeholder:text-white/30"
                    placeholder="Favicon URL"
                  />
                </div>
              </div>
            </div>
          </Section>

          {/* ─── Hero Banner ─── */}
          <Section title="Hero Banner" icon={Image} defaultOpen>
            <div className="space-y-3">
              <Toggle label="Show Banner" checked={settings.bannerVisible} onChange={(v) => update('bannerVisible', v)} />
              {settings.bannerVisible && (
                <>
                  <div>
                    <label className="text-xs font-medium text-white/50 mb-1.5 block">Headline</label>
                    <Input
                      value={settings.bannerHeadline}
                      onChange={(e) => update('bannerHeadline', e.target.value)}
                      className="h-8 bg-white/[0.04] border-white/[0.08] text-sm text-white/90"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-white/50 mb-1.5 block">Subtext</label>
                    <Input
                      value={settings.bannerSubtext}
                      onChange={(e) => update('bannerSubtext', e.target.value)}
                      className="h-8 bg-white/[0.04] border-white/[0.08] text-sm text-white/90"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-white/50 mb-1.5 block">CTA Button</label>
                    <Input
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
                <label className="text-xs font-medium text-white/50 mb-1.5 block">Footer Text</label>
                <Input
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
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] bg-[#111118]">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-white/50" />
            <span className="text-xs font-medium text-white/70">Live Preview</span>
            <span className="text-[10px] text-white/30 px-1.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06]">
              375px
            </span>
          </div>
          <div className="flex items-center gap-2">
            {saved && (
              <span className="text-[10px] text-emerald-400 font-medium px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1">
                <Check className="w-3 h-3" /> Saved
              </span>
            )}
            <Button
              size="sm"
              onClick={handleSave}
              className="h-7 px-3 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium"
            >
              <Save className="w-3 h-3 mr-1.5" />
              Save Theme
            </Button>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-hidden">
          <LivePreview settings={settings} />
        </div>
      </div>
    </div>
  );
}
