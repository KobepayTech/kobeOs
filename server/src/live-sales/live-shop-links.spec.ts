import { liveShopLinks } from './live-shop-links';

describe('live-shop links', () => {
  const store = { domainSlug: 'test-shop', publishedUrl: 'https://test-shop.kobeapptz.com' };
  it('shares the working central routes for cloud-hosted merchants', () => {
    expect(liveShopLinks(store, { KOBEOS_DEPLOYMENT: 'cloudflare-container' })).toEqual({ storefrontUrl: 'https://kobeos-app.pages.dev/shop/test-shop', catalogUrl: 'https://kobeos-app.pages.dev/@test-shop' });
  });
  it('uses the storefront for slugs longer than the catalog route supports', () => {
    const result = liveShopLinks({ domainSlug: 'a'.repeat(45) }, { KOBEOS_DEPLOYMENT: 'cloudflare-container' });
    expect(result.catalogUrl).toBe(result.storefrontUrl);
  });
  it('preserves an explicit merchant domain and local-node publication', () => {
    expect(liveShopLinks({ ...store, customDomain: 'shop.example.com' }, { KOBEOS_DEPLOYMENT: 'cloudflare-container' }).storefrontUrl).toBe('https://shop.example.com');
    expect(liveShopLinks(store, {}).catalogUrl).toBe('https://test-shop.kobeapptz.com/live');
  });
});
