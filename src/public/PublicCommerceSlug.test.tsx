import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { publicApi } from './api';
import PublicCommerceSlug from './PublicCommerceSlug';

vi.mock('./api', () => ({ publicApi: vi.fn() }));
vi.mock('../apps/erp-shop', () => ({ default: ({ data }: { data: { slug: string } }) => <div>Store {data.slug}</div> }));
vi.mock('./PropertyMarketplace', () => ({ default: () => <div>Property marketplace</div> }));
vi.mock('./DealerSite', () => ({ default: () => <div>Dealer site</div> }));
const missing = () => Object.assign(new Error('Public site not found'), { status: 404 });
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

describe('public store address resolution', () => {
  it('opens a published Store Editor shop absent from the commerce registry', async () => {
    vi.mocked(publicApi).mockRejectedValueOnce(missing()).mockResolvedValueOnce({ settings: { id: 'store', domainSlug: 'test-shop', storeName: 'Test Shop', isPublished: true } });
    render(<PublicCommerceSlug slug="test-shop" pathname="/shop/test-shop" />);
    expect(await screen.findByText('Store test-shop')).toBeInTheDocument();
    expect(publicApi).toHaveBeenNthCalledWith(2, '/store/test-shop');
  });
  it.each([null, { id: 'store', domainSlug: 'draft', isPublished: false }])('does not expose an unpublished store (%j)', async settings => {
    vi.mocked(publicApi).mockRejectedValueOnce(missing()).mockResolvedValueOnce({ settings });
    render(<PublicCommerceSlug slug="draft" pathname="/shop/draft" />);
    expect(await screen.findByRole('heading', { name: 'Site not found' })).toBeInTheDocument();
    expect(screen.queryByText('Store draft')).not.toBeInTheDocument();
  });
  it('reports outages without treating them as missing shops', async () => {
    vi.mocked(publicApi).mockRejectedValue(Object.assign(new Error('Backend unavailable'), { status: 503 }));
    render(<PublicCommerceSlug slug="test-shop" pathname="/shop/test-shop" />);
    expect(await screen.findByText('Backend unavailable')).toBeInTheDocument();
    expect(publicApi).toHaveBeenCalledTimes(1);
  });
  it.each([['property', 'Property marketplace'], ['dealership', 'Dealer site']])('preserves the %s registry route', async (kind, text) => {
    vi.mocked(publicApi).mockResolvedValue({ kind, slug: 'registered', id: 'registered', name: 'Registered' });
    render(<PublicCommerceSlug slug="registered" pathname="/" />);
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(publicApi).toHaveBeenCalledTimes(1);
  });
  it('clears the previous shop while a different slug is resolving', async () => {
    vi.mocked(publicApi).mockResolvedValueOnce({ kind: 'business', slug: 'first', id: 'first', name: 'First' });
    const view = render(<PublicCommerceSlug slug="first" pathname="/shop/first" />);
    await screen.findByText('Store first');
    vi.mocked(publicApi).mockImplementationOnce(() => new Promise(() => {}));
    view.rerender(<PublicCommerceSlug slug="second" pathname="/shop/second" />);
    await waitFor(() => expect(screen.queryByText('Store first')).not.toBeInTheDocument());
  });
});
