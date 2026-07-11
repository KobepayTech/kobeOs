/**
 * Tiny fetch wrapper for the public, unauthenticated `/api/public/*` surface
 * that the guest QR pages talk to. Mirrors the base-URL resolution in
 * src/lib/api.ts so the same .env settings drive both.
 */
// Same-origin '/api' in production so public apps served at {slug}.kobeapptz.com
// call their own backend through the same tunnel (no cross-origin CORS).
const PUBLIC_API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ??
  (import.meta.env.DEV ? 'http://localhost:3000/api' : '/api');

/**
 * If the OS is reached at `serenahotel.kobeapptz.com`, the first label is the
 * tenant slug. Reserved system subdomains (api, app, www, etc.) are NOT
 * treated as tenants. Returns null on bare-IP/localhost hosts and apex
 * domains with fewer than three labels.
 */
const RESERVED_SUBDOMAINS = new Set([
  'www', 'api', 'app', 'admin', 'desktop', 'staff', 'kobeos', 'docs', 'help', 'status',
  // Public app subdomains — see APP_SUBDOMAINS below. Listed here too
  // so the tenant detector doesn't treat them as a customer slug.
  'tuma', 'mzigo', 'me', 'track', 'posys', 'cargo', 'cargotz',
]);

/**
 * Public apps that are reachable directly via a subdomain
 * (e.g. `tuma.kobeapptz.com`) in addition to their path form
 * (`/tuma`). `detectAppSubdomain()` resolves the first host label
 * against this set; the router in main.tsx uses the returned id
 * to lazy-load the matching component.
 */
export const APP_SUBDOMAINS = {
  tuma:   'tuma',     // KobeOS · Tuma money tokens
  mzigo:  'mzigo',    // KobeOS · Mzigo ground cargo (4-role flow)
  me:     'me',       // Customer self-serve portal
  track:  'track',    // Public cargo tracking
  posys:  'posys',    // POSys property + hotel ops (bilingual)
  cargo:  'mzigo',    // Friendly alias → Mzigo
  cargotz: 'cargotz', // Cargo TZ — domestic ground transport, standalone
} as const;

export type PublicAppId = (typeof APP_SUBDOMAINS)[keyof typeof APP_SUBDOMAINS];

export function detectAppSubdomain(): PublicAppId | null {
  const host = window.location.hostname.toLowerCase();
  if (host === 'localhost' || /^[0-9.]+$/.test(host)) return null;
  const parts = host.split('.');
  if (parts.length < 3) return null;
  const sub = parts[0];
  return (APP_SUBDOMAINS as Record<string, PublicAppId>)[sub] ?? null;
}

export function detectTenantSubdomain(): string | null {
  const host = window.location.hostname.toLowerCase();
  if (host === 'localhost' || /^[0-9.]+$/.test(host)) return null;
  const parts = host.split('.');
  if (parts.length < 3) return null;
  const sub = parts[0];
  if (RESERVED_SUBDOMAINS.has(sub)) return null;
  if (!/^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$/.test(sub)) return null;
  return sub;
}

/** Build the public guest URL for a given slug + room/table, preferring the subdomain form when configured. */
export function buildPublicGuestUrl(
  slug: string,
  locationType: 'room' | 'table',
  locationNumber: string,
): string {
  const baseDomain = import.meta.env.VITE_TENANT_BASE_DOMAIN as string | undefined;
  if (baseDomain) {
    return `https://${slug}.${baseDomain}/${locationType}/${encodeURIComponent(locationNumber)}`;
  }
  return `${window.location.origin}/p/${slug}/${locationType}/${encodeURIComponent(locationNumber)}`;
}

export async function publicApi<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const res = await fetch(`${PUBLIC_API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${txt || res.statusText}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export interface PublicTenant {
  slug: string;
  name: string;
  brandColor?: string | null;
  logoUrl?: string | null;
  currency: string;
}

export interface PublicMenuItem {
  id: string;
  name: string;
  category: string;
  price: number | string;
  currency: string;
  available: boolean;
  station: 'kitchen' | 'bar' | 'other';
}

export interface PublicOrderItem {
  menuItemId?: string;
  name: string;
  qty: number;
  price: number;
  station?: 'kitchen' | 'bar' | 'other';
}

export interface PublicOrder {
  id: string;
  roomNumber: string;
  locationType: 'room' | 'table';
  items: PublicOrderItem[];
  total: number | string;
  currency: string;
  status: string;
  createdAt?: string;
}

export interface PublicServiceRequest {
  id: string;
  roomNumber: string;
  kind: string;
  status: string;
}
