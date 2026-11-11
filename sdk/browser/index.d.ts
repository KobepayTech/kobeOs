/** KobeOS browser-app API v1. The host injects this bridge into isolated apps.
 * The bridge never exposes a JWT, the Electron API, or arbitrary HTTP access. */
export interface InventoryProduct { id: string; name: string; sku: string; stock: number; unit: string }
export interface KobeOSBrowserSDK {
  readonly apiVersion: 1;
  readonly inventory: { list(): Promise<{ items: InventoryProduct[]; hasMore: boolean }> };
}
declare global { const KobeOS: KobeOSBrowserSDK; interface Window { readonly KobeOS: KobeOSBrowserSDK } }
