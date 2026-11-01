import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModernProductCard, ModernStorefront } from './ModernStorefront';

vi.mock('@/lib/api', () => ({ assetUrl: (url: string) => url }));
afterEach(cleanup);
const product = { id: 'cap', name: 'Everyday cap', sku: 'CAP', category: 'Accessories', price: 12000, currency: 'TZS', stock: 4, imageUrl: 'https://shop.example/cap.jpg' };
const props = () => ({ storeName: 'Form & Field', tagline: 'Objects for everyday living.', categories: ['All', 'Accessories', 'Clothing'], selectedCategory: 'All', onSelectCategory: vi.fn(), searchQuery: '', onSearchChange: vi.fn(), cartCount: 2, onOpenCart: vi.fn(), onGoStores: vi.fn(), onSignup: vi.fn(), onPickNav: vi.fn(), heroProducts: [product], children: <div id="store-product-grid">Products</div> });

describe('modern merchant storefront', () => {
  it('uses merchant branding and omits fabricated reviews and shipping promises', () => {
    render(<ModernStorefront {...props()} />);
    expect(screen.getByRole('button', { name: /Form & Field/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'The collection' })).toBeInTheDocument();
    expect(screen.queryByText(/12,400|Free Shipping Worldwide|Michael R\.|Since 2017/)).not.toBeInTheDocument();
  });
  it('opens the real cart and filters using merchant categories', () => {
    const handlers = props();
    render(<ModernStorefront {...handlers} />);
    fireEvent.click(screen.getByRole('button', { name: 'Shopping bag, 2 items' }));
    expect(handlers.onOpenCart).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Accessories', pressed: false }));
    expect(handlers.onSelectCategory).toHaveBeenCalledWith('Accessories');
  });
  it('wires catalogue search, tracking, and membership to existing flows', () => {
    const handlers = props();
    render(<ModernStorefront {...handlers} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Search products' }), { target: { value: 'cap' } });
    expect(handlers.onSearchChange).toHaveBeenCalledWith('cap');
    fireEvent.click(screen.getByRole('button', { name: /Track your order/ }));
    expect(handlers.onPickNav).toHaveBeenCalledWith('track-order');
    fireEvent.click(screen.getByRole('button', { name: 'Make yourself at home' }));
    expect(handlers.onSignup).toHaveBeenCalledTimes(1);
  });
  it('supports a mobile menu with the real categories', () => {
    render(<ModernStorefront {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByRole('navigation', { name: 'Mobile store navigation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
  });
  it('formats the real price, adds products, and saves favourites', () => {
    const add = vi.fn(); const wish = vi.fn(); const open = vi.fn();
    render(<ModernProductCard product={product} wished={false} onAddToCart={add} onAddToWishlist={wish} onOpen={open} />);
    expect(screen.getByText('TZS 12,000')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add Everyday cap to cart' }));
    expect(add).toHaveBeenCalledWith(product);
    fireEvent.click(screen.getByRole('button', { name: 'Save Everyday cap to wishlist' }));
    expect(wish).toHaveBeenCalledWith(product);
    fireEvent.click(screen.getByRole('button', { name: 'View Everyday cap' }));
    expect(open).toHaveBeenCalledWith(product);
  });
  it('disables purchasing sold-out products', () => {
    render(<ModernProductCard product={{ ...product, stock: 0 }} wished={false} onAddToCart={vi.fn()} onAddToWishlist={vi.fn()} onOpen={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Add Everyday cap to cart' })).toBeDisabled();
    expect(screen.getByText('Sold out')).toBeInTheDocument();
  });
});
