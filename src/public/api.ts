/**
 * Tiny fetch wrapper for the public, unauthenticated `/api/public/*` surface
 * that the guest QR pages talk to. Mirrors the base-URL resolution in
 * src/lib/api.ts so the same .env settings drive both.
 */
// Same-origin '/api' in production so public apps served at {slug}.kobeapptz.com
// call their own backend through the same origin by default. A second independent
// API base can be supplied with VITE_API_FALLBACK_BASE. Reads are safe to retry
// across origins. Mutating requests are sent exactly once: the wrapper probes
// both origins first and chooses one healthy target, which avoids duplicate
// bookings/orders/payments if a primary response is lost during failover.
const PRIMARY_PUBLIC_API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ??
  (import.meta.env.DEV ? 'http://localhost:3000/api' : '/api');

const FALLBACK_PUBLIC_API_BASE =
  (import.meta.env.VITE_API_FALLBACK_BASE as string | undefined)?.trim() || '';

const PUBLIC_API_BASES = Array.from(new Set(
  [PRIMARY_PUBLIC_API_BASE, FALLBACK_PUBLIC_API_BASE]
    .map((value) => value.replace(/\/$/, ''))
    .filter(Boolean),
));

let lastHealthyBase = PUBLIC_API_BASES[0] ?? PRIMARY_PUBLIC_API_BASE;
let lastHealthyAt = 0;
const WRITE_HEALTH_TTL_MS = 10_000;
const PROBE_TIMEOUT_MS = 3_500;

export function publicApiBase(): string {
  return lastHealthyBase || PRIMARY_PUBLIC_API_BASE;
}

export function publicApiBases(): readonly string[] {
  return PUBLIC_API_BASES;
}

class PublicApiHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'PublicApiHttpError';
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  const upstreamSignal = init.signal;
  const abort = () => controller.abort();

  if (upstreamSignal) {
    if (upstreamSignal.aborted) controller.abort();
    else upstreamSignal.addEventListener('abort', abort, { once: true });
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
    upstreamSignal?.removeEventListener('abort', abort);
  }
}

async function probeBase(base: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(
      `${base}/health`,
      { method: 'GET', cache: 'no-store', headers: { Accept: 'application/json' } },
      PROBE_TIMEOUT_MS,
    );
    if (!res.ok) return false;
    lastHealthyBase = base;
    lastHealthyAt = Date.now();
    return true;
  } catch {
    return false;
  }
}

async function chooseWriteBase(): Promise<string> {
  if (
    lastHealthyBase &&
    PUBLIC_API_BASES.includes(lastHealthyBase) &&
    Date.now() - lastHealthyAt < WRITE_HEALTH_TTL_MS
  ) {
    return lastHealthyBase;
  }

  for (const base of PUBLIC_API_BASES) {
    if (await probeBase(base)) return base;
  }

  throw new Error(
    'KobeOS is temporarily unreachable on both production paths. ' +
    'The transaction was not sent, so it is safe to retry.',
  );
}

/** Resolve uploaded `/api/media/...` paths against the most recently healthy API host. */
export function publicAssetUrl(value?: string | null): string {
  if (!value) return '';
  if (/^https?:\/\//i.test(value) || value.startsWith('data:') || value.startsWith('blob:')) return value;
  const base = publicApiBase();
  return `${base}${value.startsWith('/api') ? value.slice(4) : value}`;
}

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
  // Property module subdomains (#9).
  'property', 'estate', 'pay', 'contract', 'jumla', 'lala',
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
  // Property module (#9) — reachable from anywhere via subdomain.
  property: 'property', // Property management app (standalone)
  estate:  'estate',   // Tenant portal (token-gated)
  pay:     'pay',      // Bank/agent rent-collection panel
  contract: 'contract', // Lawyer contract portal
  jumla: 'jumla',       // Live commerce discovery network
  lala: 'lala',         // Live hotel discovery and rewards
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
  if ((import.meta.env.VITE_DISABLE_TENANT_SUBDOMAIN as string | undefined) === 'true') return null;
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

  const method = (init.method || 'GET').toUpperCase();
  const isRead = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
  const bases = isRead ? PUBLIC_API_BASES : [await chooseWriteBase()];
  let lastError: Error | null = null;

  for (let index = 0; index < bases.length; index += 1) {
    const base = bases[index];
    try {
      const res = await fetch(`${base}${path}`, { ...init, headers });

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        const error = new PublicApiHttpError(
          res.status,
          `API ${res.status}: ${txt || res.statusText}`,
        );

        if (isRead && isRetryableStatus(res.status) && index < bases.length - 1) {
          lastError = error;
          continue;
        }

        throw error;
      }

      lastHealthyBase = base;
      lastHealthyAt = Date.now();
      const text = await res.text();
      return (text ? JSON.parse(text) : undefined) as T;
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      lastError = normalized;

      if (
        normalized instanceof PublicApiHttpError &&
        !isRetryableStatus(normalized.status)
      ) {
        throw normalized;
      }

      if (!isRead || index >= bases.length - 1) {
        if (!isRead) {
          throw new Error(
            `${normalized.message}. This transaction was sent to only one origin and was not automatically replayed.`,
          );
        }
        throw normalized;
      }
    }
  }

  throw lastError ?? new Error('KobeOS public API is unavailable.');
}

export interface PublicTenant {
  slug: string;
  name: string;
  brandColor?: string | null;
  logoUrl?: string | null;
  currency: string;
  location?: string;
  phone?: string;
  email?: string;
}

export interface PublicMenuItem {
  id: string;
  name: string;
  category: string;
  price: number | string;
  currency: string;
  available: boolean;
  station: 'kitchen' | 'bar' | 'other';
  imageUrl?: string | null;
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
  locationType: 'room' | 'table' | 'pickup' | 'delivery';
  guestName?: string | null;
  guestPhone?: string | null;
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
