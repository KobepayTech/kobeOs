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

describe('Jumla onboarding', () => {
  let showEndCard: ((ratio: number) => void) | undefined;
  beforeEach(() => {
    history.replaceState(null, '', '/jumla#discover');
    localStorage.clear();
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
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

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
    expect(api.mock.calls.map(([path]) => path)).toEqual([liveCatalog]);
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
