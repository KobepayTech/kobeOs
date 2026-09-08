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
 * grid, trust badges, testimonials, newsletter, footer — fed the store’s saved products. Previously this file was a stand-alone mockup that shared
 * nothing with the live site, so the preview and the published store looked
 * completely different. Now it's one source of truth: what you see here is
 * what publishes.
 */

interface JerseyPreviewProps {
  products?: JerseyProduct[];
  storeName: string;
  tagline: string;
  logoUrl?: string;
  bannerHeadline?: string;
  bannerSubtext?: string;
  bannerCta?: string;
  bannerVisible?: boolean;
}

export function JerseyStorefrontPreview({
  products = [],
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
  const categories = ['All', ...Array.from(new Set(products.map((p) => p.category)))];

  const visible = products.filter(
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
            No products in this category yet.
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
