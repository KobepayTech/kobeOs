/**
 * Tiny fetch wrapper for the public, unauthenticated `/api/public/*` surface
 * that the guest QR pages talk to. Mirrors the base-URL resolution in
 * src/lib/api.ts so the same .env settings drive both.
 */
const PUBLIC_API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ??
  (import.meta.env.DEV ? 'http://localhost:3000/api' : 'https://api.kobeapptz.com/api');

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
