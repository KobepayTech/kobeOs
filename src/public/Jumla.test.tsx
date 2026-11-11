import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Jumla from './Jumla';
import { samples } from './jumla-catalog';
import type { Item } from './jumla-catalog';

const api = vi.hoisted(() => vi.fn());
vi.mock('./api', () => ({ publicApi: api, publicAssetUrl: (value?: string) => value || '' }));
vi.mock('@/hooks/usePwaManifest', () => ({ usePwaManifest: vi.fn() }));

function merchantProduct(id: string, name: string, category: string): Item {
  const sample = samples[0];
  return {
    ...sample, id, productId: id, businessId: id, name, category, sample: undefined,
    business: { ...sample.business, id, name: `${name} shop`, publicSlug: id },
  };
}

const fashion = merchantProduct('fashion', 'Canvas bag', 'Fashion');
const audio = merchantProduct('audio', 'Portable speaker', ' electronics ');
const liveCatalog = '/commerce-public/jumla/items?limit=60';
const dialogPrototype = HTMLDialogElement.prototype;
const shimDialog = !dialogPrototype.showModal;

describe('Jumla onboarding', () => {
  let showEndCard: ((ratio: number) => void) | undefined;
  beforeEach(() => {
    history.replaceState(null, '', '/jumla#discover');
    localStorage.clear();
    sessionStorage.clear();
    if (shimDialog) Object.defineProperties(dialogPrototype, {
      showModal: { configurable: true, value(this: HTMLDialogElement) { this.open = true; } },
      close: { configurable: true, value(this: HTMLDialogElement) { this.open = false; } },
    });
    api.mockReset().mockResolvedValue([]);
    showEndCard = undefined;
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) {
        showEndCard = (intersectionRatio) => callback([{ intersectionRatio } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
      }
      observe() {}
      disconnect() {}
    });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    if (shimDialog) {
      Reflect.deleteProperty(dialogPrototype, 'showModal');
      Reflect.deleteProperty(dialogPrototype, 'close');
    }
  });

  it('switches to real listings at the end of the swipe demo and ranks the liked category first', async () => {
    api.mockResolvedValue([fashion, audio]);
    render(<Jumla />);
    const demo = screen.getAllByRole('article');
    fireEvent.click(within(demo[0]).getByRole('button', { name: 'Like product' }));

    await waitFor(() => expect(showEndCard).toBeDefined());
    act(() => showEndCard?.(0.7));
    expect(screen.getByText('Practice mode')).toBeVisible();
    act(() => showEndCard?.(1));

    expect(screen.queryByText('Practice mode')).not.toBeInTheDocument();
    expect(screen.queryByText('Studio Wireless Headphones')).not.toBeInTheDocument();
    expect(screen.getAllByRole('article')[0]).toHaveTextContent('Portable speaker');
    expect(JSON.parse(localStorage.getItem('jumla_category_affinity') || '{}')).toEqual({ electronics: 2 });
    expect(JSON.parse(localStorage.getItem('jumla_liked_products') || '[]')).toEqual([]);
    expect(localStorage.getItem('jumla_intro_complete')).toBe('true');
    expect(api.mock.calls.filter(([path]) => path !== '/commerce-public/jumla/interest').map(([path]) => path)).toEqual([liveCatalog]);
    const views = api.mock.calls.filter(([path]) => path === '/commerce-public/jumla/interest').map(([, options]) => JSON.parse(options.body));
    expect(views).toEqual([expect.objectContaining({ productId: audio.productId, eventType: 'VIEW', metadata: expect.objectContaining({ source: 'discover' }) })]);
  });

  it('shares the category filter with Grid and restores the chosen view on a fresh visit', async () => {
    const { unmount } = render(<Jumla />);
    fireEvent.click(screen.getByRole('button', { name: 'Fashion' }));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    fireEvent.click(within(screen.getByRole('group', { name: 'Shopping view' })).getByRole('button', { name: 'Grid' }));
    expect(await screen.findByRole('heading', { name: 'Browse the grid' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Fashion' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('article')).toHaveLength(1);
    unmount();

    history.replaceState(null, '', '/jumla');
    render(<Jumla />);
    expect(screen.getByRole('heading', { name: 'Browse the grid' })).toBeVisible();
  });

  it('uses the live catalogue for similar products and adds a selected option from Discover', async () => {
    localStorage.setItem('jumla_intro_complete', 'true');
    const match = merchantProduct('tote', 'Sand tote', 'Fashion');
    const clip = { ...fashion, videoUrl: 'https://shop.example/bag.mp4', requiredOptions: ['Size'],
      variants: [{ id: 'medium', name: 'Medium', attributes: { Size: 'M' } }],
      location: { property: 'Kariakoo', floor: '', shopCode: '' } };
    api.mockResolvedValue([clip, audio, match]);
    render(<Jumla />);

    const card = await screen.findByRole('heading', { name: 'Canvas bag' }).then((node) => within(node.closest('article')!));
    expect(document.querySelector('video')).toBeNull();
    fireEvent.click(card.getByRole('button', { name: 'Watch' }));
    expect(within(screen.getByRole('dialog')).getByLabelText('Canvas bag video')).toHaveAttribute('preload', 'none');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(document.querySelector('video')).toBeNull();

    fireEvent.click(card.getByRole('button', { name: 'Find similar' }));
    const similar = within(screen.getByRole('dialog'));
    expect(await similar.findByRole('button', { name: /Sand tote/ })).toBeVisible();
    expect(similar.queryByRole('button', { name: /Portable speaker/ })).not.toBeInTheDocument();
    expect(similar.queryByRole('button', { name: /Canvas bag/ })).not.toBeInTheDocument();
    fireEvent.click(similar.getByRole('button', { name: 'Close' }));

    fireEvent.click(card.getByRole('button', { name: 'Shop this look' }));
    const quickShop = within(screen.getByRole('dialog'));
    expect(quickShop.getByText('Pickup: Kariakoo')).toBeVisible();
    fireEvent.change(quickShop.getByLabelText('Size'), { target: { value: 'M' } });
    fireEvent.click(quickShop.getByRole('button', { name: 'Add to bag' }));
    expect(await screen.findByRole('heading', { name: 'Shopping bag' })).toBeVisible();
    expect(JSON.parse(localStorage.getItem('jumla_cart') || '[]')).toEqual([
      expect.objectContaining({ item: expect.objectContaining({ productId: clip.productId }), selectedOptions: { Size: 'M' } }),
    ]);
  });

  it('keeps the walkthrough available when the catalog is empty and checks again on demand', async () => {
    render(<Jumla />);
    await waitFor(() => expect(api).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Practice mode')).toBeVisible();
    expect(showEndCard).toBeUndefined();
    fireEvent.click(screen.getByRole('button', { name: 'Go live' }));
    expect(await screen.findByText('Your feed starts here')).toBeVisible();

    api.mockResolvedValue([fashion]);
    fireEvent.click(screen.getByRole('button', { name: 'Check for new listings' }));
    expect(await screen.findByText('Canvas bag')).toBeVisible();
    expect(screen.queryByText('Practice mode')).not.toBeInTheDocument();
  });
});
