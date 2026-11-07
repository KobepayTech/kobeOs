import { useState, type ComponentProps, type CSSProperties } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, Heart, Menu, Package, Search, Shirt, ShoppingBag, X } from 'lucide-react';
import { assetUrl } from '@/lib/api';
import type { JerseyProduct, JerseyProductCard, JerseyShopChrome } from './JerseyShopLayout';
import './modern-storefront.css';

type ChromeProps = ComponentProps<typeof JerseyShopChrome> & { heroProducts?: JerseyProduct[]; accent?: string };
type CardProps = ComponentProps<typeof JerseyProductCard>;

const price = (amount: number, currency: string) => `${currency || 'TZS'} ${Number(amount).toLocaleString('en', { maximumFractionDigits: 2 })}`;
const hasPhoto = (url?: string | null) => !!url && !/\/(?:icon(?:-\d+)?|favicon|logo)\.(?:png|ico|svg)(?:\?|$)/i.test(url);

function ProductVisual({ product }: { product?: JerseyProduct }) {
  if (product && hasPhoto(product.imageUrl)) return <img src={assetUrl(product.imageUrl!)} alt={product.name} loading="lazy" />;
  if (/cap|hat/i.test(product?.name || '')) return <svg className="sf-product-drawing" viewBox="0 0 240 200" aria-hidden="true"><path d="M45 125c0-61 27-91 74-91s70 31 70 91" fill="#f1e9d6" stroke="currentColor" strokeWidth="3" /><path d="M47 123c49-15 90-13 143 0l33 28c-26 25-98 23-133 8l-43-20z" fill="#f1e9d6" stroke="currentColor" strokeWidth="3" /><path d="M119 36c-21 23-26 52-25 80M119 36c22 21 28 51 27 81M106 29h22" fill="none" stroke="currentColor" strokeWidth="2.5" /><path d="M90 141c42 10 83 12 116 8" fill="none" stroke="currentColor" strokeWidth="2" /></svg>;
  if (/shirt|jersey|top/i.test(product?.name || '')) return <Shirt className="sf-product-drawing sf-shirt" strokeWidth={1} aria-hidden="true" />;
  return <Package className="sf-product-drawing" strokeWidth={1} aria-hidden="true" />;
}

export function ModernProductCard({ product, onAddToCart, onAddToWishlist, onOpen, wished }: CardProps) {
  const available = product.stock > 0;
  return <article className="sf-product-card">
    <div className="sf-product-media">
      <button className="sf-product-open" onClick={() => onOpen(product)} aria-label={`View ${product.name}`}><ProductVisual product={product} /></button>
      <span className={`sf-product-tag ${!available ? 'sf-sold-out' : ''}`}>{available ? product.category || 'The collection' : 'Sold out'}</span>
      <button className={`sf-wish ${wished ? 'sf-wished' : ''}`} aria-label={`${wished ? 'Remove' : 'Save'} ${product.name} ${wished ? 'from' : 'to'} wishlist`} aria-pressed={wished} onClick={() => onAddToWishlist(product)}><Heart size={18} fill={wished ? 'currentColor' : 'none'} /></button>
      <button className="sf-quick-add" disabled={!available} onClick={() => onAddToCart(product)} aria-label={`Add ${product.name} to cart`}><span>{available ? 'Add to bag' : 'Out of stock'}</span><ArrowUpRight size={18} /></button>
    </div>
    <div className="sf-product-info"><button onClick={() => onOpen(product)}>{product.name}</button><span>{product.priceMin != null && product.priceMax != null && product.priceMin !== product.priceMax ? `${price(product.priceMin, product.currency)} – ${price(product.priceMax, product.currency)}` : price(product.price, product.currency)}</span></div>
    <div className="sf-product-caption">{product.brand || product.category || 'Explore the details'}{available && <span>{product.stock} available</span>}</div>
  </article>;
}

export function ModernStorefront({ storeName, tagline, logoUrl, bannerHeadline, bannerSubtext, bannerCta, bannerVisible = true, categories, selectedCategory, onSelectCategory, searchQuery, onSearchChange, cartCount, onOpenCart, onPickNav, onSignup, customerName, config, children, heroProducts = [], accent }: ChromeProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const scrollToProducts = () => document.getElementById('store-product-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const selectCategory = (category: string) => { onSelectCategory(category); setMenuOpen(false); scrollToProducts(); };
  const collectionCategories = categories.filter(category => category !== 'All');
  const featured = heroProducts.slice(0, 2);
  const headline = config?.hero?.headline || bannerHeadline || 'A little discovery. A lot to love.';
  return <div className="sf-storefront" data-surface="light" style={{ '--sf-brand-accent': accent || '#153c33' } as CSSProperties}>
    <div className="sf-announcement"><span>A fresh perspective on your everyday.</span><button onClick={scrollToProducts}>Explore the collection <ArrowRight size={13} /></button></div>
    <header className="sf-header">
      <div className="sf-main-nav"><button className="sf-menu sf-icon-button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button>
        <button className="sf-wordmark" title={storeName} onClick={() => selectCategory('All')}>{logoUrl ? <img src={assetUrl(logoUrl)} alt={storeName} /> : <><span className="sf-brand-symbol">✳</span><span>{storeName}</span><span className="sf-brand-dot">.</span></>}</button>
        <nav className="sf-desktop-links" aria-label="Store navigation"><button onClick={() => selectCategory('All')}>Shop all</button>{collectionCategories.slice(0, 2).map(category => <button key={category} onClick={() => selectCategory(category)}>{category}</button>)}</nav>
        <div className="sf-nav-actions"><button className="sf-account" onClick={onSignup}>{customerName ? 'Your account' : 'Join the club'}</button><button className="sf-icon-button sf-header-wishlist" onClick={() => onPickNav?.('wishlist')} aria-label="Your wishlist"><Heart size={20} /></button><button className="sf-bag" onClick={onOpenCart} aria-label={`Shopping bag, ${cartCount} items`}><ShoppingBag size={20} /><span className="sf-bag-word">Bag</span><span className="sf-bag-count">{cartCount}</span></button></div>
      </div>
      {menuOpen && <nav className="sf-mobile-links" aria-label="Mobile store navigation"><button onClick={() => selectCategory('All')}>Shop all</button>{collectionCategories.map(category => <button key={category} onClick={() => selectCategory(category)}>{category}</button>)}<button onClick={() => { onPickNav?.('track-order'); setMenuOpen(false); }}>Track an order</button><button onClick={onSignup}>Your account</button></nav>}
    </header>
    {bannerVisible && <section className="sf-hero" aria-label="Store collection introduction">
      <div className="sf-hero-copy"><div className="sf-eyebrow"><span />THE EVERYDAY EDIT</div><h1>{headline}</h1><p>{config?.hero?.subtext || bannerSubtext || tagline || 'Discover the pieces that fit your life. Find your favourites, make them yours.'}</p><button className="sf-primary-button" onClick={scrollToProducts}>{config?.hero?.cta || bannerCta || 'Shop the collection'}<ArrowUpRight size={19} /></button><div className="sf-hero-bottom"><span>Something for your everyday.</span><ArrowDown size={18} /></div></div>
      <div className="sf-hero-art"><span className="sf-hero-orbit" /><div className="sf-hero-label">GOOD FINDS.<br />GREAT EVERYDAYS.</div><div className="sf-feature-card sf-feature-first"><ProductVisual product={featured[0]} /><div><span>{featured[0]?.name || 'Your next favourite'}</span><ArrowUpRight size={17} /></div></div><div className="sf-feature-card sf-feature-second"><ProductVisual product={featured[1] || featured[0]} /><div><span>{featured[1]?.category || 'Made for your rotation'}</span><ArrowUpRight size={17} /></div></div><span className="sf-hero-seal" aria-hidden="true">the<br /><b>good</b><br />edit ✳</span></div>
    </section>}
    <section className="sf-collection" aria-label="Shop products">
      <div className="sf-collection-heading"><div><div className="sf-eyebrow">FIND YOUR FAVOURITES</div><h2>{selectedCategory === 'All' ? 'The collection' : selectedCategory}<span aria-hidden="true"> ✳</span></h2></div><span className="sf-collection-note">A closer look at what’s in store.</span></div>
      <div className="sf-collection-toolbar"><div className="sf-category-pills"><button aria-pressed={selectedCategory === 'All'} onClick={() => onSelectCategory('All')}>All products</button>{collectionCategories.map(category => <button key={category} aria-pressed={selectedCategory === category} onClick={() => onSelectCategory(category)}>{category}</button>)}</div><label className="sf-search"><Search size={17} /><input aria-label="Search products" value={searchQuery} onChange={event => onSearchChange(event.target.value)} placeholder="Find something you love" /></label></div>
      {children}
    </section>
    <section className="sf-membership"><div><div className="sf-eyebrow">LET’S MAKE IT PERSONAL</div><h2>Your favourites.<br />Your little corner.</h2><p>Save your details for a quicker checkout and see your membership in one place.</p><button className="sf-primary-button" onClick={onSignup}>{customerName ? 'View your membership' : 'Make yourself at home'}<ArrowUpRight size={18} /></button></div><div className="sf-membership-art" aria-hidden="true"><span>✳</span><div>GOOD THINGS<br />START HERE.</div></div></section>
    <footer className="sf-footer"><div className="sf-footer-top"><div><div className="sf-footer-brand">{storeName}<span>.</span></div><p>{tagline || 'Good finds for your everyday.'}</p></div><div className="sf-footer-links"><button onClick={() => selectCategory('All')}>Shop the collection <ArrowUpRight size={15} /></button><button onClick={() => onPickNav?.('track-order')}>Track your order <ArrowUpRight size={15} /></button><button onClick={() => onPickNav?.('wishlist')}>Your wishlist <ArrowUpRight size={15} /></button><button onClick={onSignup}>Your membership <ArrowUpRight size={15} /></button></div></div><div className="sf-footer-bottom"><span>© {new Date().getFullYear()} {storeName}</span><span>Powered by <b>KobeOS</b></span><button onClick={scrollToProducts}>Back to the good stuff ↑</button></div></footer>
  </div>;
}
