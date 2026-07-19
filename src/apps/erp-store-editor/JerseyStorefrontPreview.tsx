import { useState } from 'react';
import {
  JerseyShopChrome,
  JerseyProductCard,
  SectionTitle,
  type JerseyProduct,
} from '@/apps/erp-shop/JerseyShopLayout';

/**
 * WYSIWYG preview for the "Jersey Shop" template.
 *
 * This renders the EXACT SAME `JerseyShopChrome` the live storefront uses
 * (src/apps/erp-shop/JerseyShopLayout.tsx) — announcement bar, header with
 * the store's own wordmark, category nav + quick-icons, hero banner, product
 * grid, trust badges, testimonials, newsletter, footer — fed a handful of
 * demo jerseys. Previously this file was a stand-alone mockup that shared
 * nothing with the live site, so the preview and the published store looked
 * completely different. Now it's one source of truth: what you see here is
 * what publishes.
 */

interface JerseyPreviewProps {
  storeName: string;
  tagline: string;
  logoUrl?: string;
  bannerHeadline?: string;
  bannerSubtext?: string;
  bannerCta?: string;
  bannerVisible?: boolean;
}

// Demo catalogue — clearly representative jerseys so the grid, badges, price
// ranges and category nav all populate. Categories drive the real MainNav /
// quick-icons; tags drive the corner badges.
const DEMO_JERSEYS: JerseyProduct[] = [
  { id: 'p1', name: 'Real Madrid Home Jersey 2026/27', sku: 'RMA-H-2627', price: 29.99, compareAtPrice: 89.99, stock: 120, category: 'Clubs', currency: 'US', tags: ['26/27'], featured: true, imageUrl: null },
  { id: 'p2', name: 'Barcelona Home Jersey 2026/27', sku: 'FCB-H-2627', price: 29.99, compareAtPrice: 89.99, stock: 90, category: 'Clubs', currency: 'US', tags: ['26/27'], imageUrl: null },
  { id: 'p3', name: 'Argentina Home Jersey — World Cup 2026', sku: 'ARG-H-WC26', price: 27.99, compareAtPrice: 84.99, stock: 60, category: 'World Cup 2026', currency: 'US', tags: ['World Cup'], imageUrl: null },
  { id: 'p4', name: 'Brazil Home Jersey — World Cup 2026', sku: 'BRA-H-WC26', price: 27.99, compareAtPrice: 84.99, stock: 75, category: 'World Cup 2026', currency: 'US', tags: ['World Cup'], imageUrl: null },
  { id: 'p5', name: 'PSG Home Jersey 2026/27', sku: 'PSG-H-2627', price: 28.99, compareAtPrice: 79.99, stock: 40, category: 'Clubs', currency: 'US', tags: ['TOP SALE'], imageUrl: null },
  { id: 'p6', name: 'Liverpool Home Jersey 2026/27', sku: 'LFC-H-2627', price: 26.99, compareAtPrice: 79.99, stock: 55, category: 'Clubs', currency: 'US', tags: ['26/27'], imageUrl: null },
  { id: 'p7', name: 'France 1998 Retro Jersey', sku: 'FRA-RETRO-98', price: 24.99, compareAtPrice: 74.99, stock: 30, category: 'Retro', currency: 'US', tags: [], imageUrl: null },
  { id: 'p8', name: 'Brazil 1998 Retro Jersey', sku: 'BRA-RETRO-98', price: 24.99, compareAtPrice: 74.99, stock: 25, category: 'Retro', currency: 'US', tags: [], imageUrl: null },
  { id: 'p9', name: 'Kids Argentina Home Kit 2026', sku: 'ARG-KIDS-26', price: 22.99, compareAtPrice: 59.99, stock: 80, category: 'Kids', currency: 'US', tags: ['NEW'], imageUrl: null },
  { id: 'p10', name: 'Training Jacket — Club Edition', sku: 'APP-JKT-01', price: 34.99, compareAtPrice: 89.99, stock: 45, category: 'Apparel', currency: 'US', tags: [], imageUrl: null },
];

export function JerseyStorefrontPreview({
  storeName,
  tagline,
  logoUrl,
  bannerHeadline,
  bannerSubtext,
  bannerCta,
  bannerVisible = true,
}: JerseyPreviewProps) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const categories = ['All', ...Array.from(new Set(DEMO_JERSEYS.map((p) => p.category)))];

  const visible = DEMO_JERSEYS.filter(
    (p) =>
      (selectedCategory === 'All' || p.category === selectedCategory) &&
      (!searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const addToCart = (p: JerseyProduct) =>
    setCart((c) => ({ ...c, [p.id]: (c[p.id] ?? 0) + 1 }));
  const toggleWishlist = (p: JerseyProduct) =>
    setWishlist((w) => {
      const n = new Set(w);
      if (n.has(p.id)) n.delete(p.id);
      else n.add(p.id);
      return n;
    });

  return (
    <JerseyShopChrome
      storeName={storeName}
      tagline={tagline}
      logoUrl={logoUrl}
      bannerHeadline={bannerHeadline}
      bannerSubtext={bannerSubtext}
      bannerCta={bannerCta}
      bannerVisible={bannerVisible}
      categories={categories}
      selectedCategory={selectedCategory}
      onSelectCategory={setSelectedCategory}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      cartCount={cartCount}
      onOpenCart={() => {}}
      onGoStores={() => {}}
    >
      <div className="max-w-7xl mx-auto px-4 py-8">
        <SectionTitle title={selectedCategory === 'All' ? 'Featured Jerseys' : selectedCategory} />
        {visible.length === 0 ? (
          <p className="text-center text-[#999] py-12 text-sm">
            No demo products in {selectedCategory}.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {visible.map((p) => (
              <JerseyProductCard
                key={p.id}
                product={p}
                onAddToCart={addToCart}
                onAddToWishlist={toggleWishlist}
                onOpen={() => {}}
                wished={wishlist.has(p.id)}
              />
            ))}
          </div>
        )}
      </div>
    </JerseyShopChrome>
  );
}
