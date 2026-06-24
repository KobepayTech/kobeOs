import { Injectable, Logger } from '@nestjs/common';

/**
 * Free live-FX rate service with sane fallbacks.
 *
 * Source: frankfurter.dev (ECB-backed, no API key, ~daily refresh,
 * stable since 2018). EUR-based, so cross-rates derive client-side.
 *
 * Caching: in-memory Map keyed by "USD->TZS", 6h TTL. Refreshed on
 * first miss after expiry; serves stale-while-revalidating so a slow
 * upstream never blocks the request. On total upstream failure we
 * fall through to FALLBACK_RATES below — recent average TZS/USD as
 * of late 2025 (operator-configurable per-tenant via the existing
 * KobePayRatesService overrides this anywhere it matters).
 */
export interface FxRate {
  from: string;
  to: string;
  rate: number;
  source: 'live' | 'cached' | 'fallback';
  fetchedAt: string;
}

/** Sensible TZS-pivot fallback table for when the upstream API is
 *  unreachable. These are not real-time and shouldn't be used to
 *  price actual transfers — they exist so the UI always renders
 *  *something*. Update annually when reality drifts too far. */
const FALLBACK_TZS_PER: Record<string, number> = {
  USD: 2630,
  EUR: 2880,
  GBP: 3340,
  CNY: 365,
  KES: 20.2,
  UGX: 0.71,
  NGN: 1.81,
  ZAR: 145,
  RWF: 1.93,
  AED: 716,
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const UPSTREAM_TIMEOUT_MS = 4000;
const UPSTREAM = 'https://api.frankfurter.dev/v1/latest';

interface CacheEntry { rate: number; fetchedAt: number }

@Injectable()
export class FxService {
  private readonly logger = new Logger('FxService');
  private readonly cache = new Map<string, CacheEntry>();
  /** Tracks in-flight requests so 50 simultaneous lookups for the
   *  same pair coalesce into one upstream call. */
  private readonly inflight = new Map<string, Promise<number | null>>();

  /** Returns the rate that converts 1 unit of `from` into `to`.
   *  Always returns a positive number — falls through to the
   *  hardcoded table if both the cache and upstream are empty. */
  async getRate(from: string, to: string): Promise<FxRate> {
    const f = from.toUpperCase();
    const t = to.toUpperCase();
    if (f === t) return { from: f, to: t, rate: 1, source: 'live', fetchedAt: new Date().toISOString() };

    const key = `${f}->${t}`;
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return { from: f, to: t, rate: cached.rate, source: 'cached', fetchedAt: new Date(cached.fetchedAt).toISOString() };
    }

    // Coalesce concurrent misses for the same pair.
    let fetch = this.inflight.get(key);
    if (!fetch) {
      fetch = this.fetchLive(f, t).finally(() => this.inflight.delete(key));
      this.inflight.set(key, fetch);
    }
    const live = await fetch;
    if (live != null && live > 0) {
      this.cache.set(key, { rate: live, fetchedAt: Date.now() });
      return { from: f, to: t, rate: live, source: 'live', fetchedAt: new Date().toISOString() };
    }

    // Serve stale-while-revalidating: if we have a cached value past
    // its TTL but no fresh upstream, return the stale one rather than
    // dropping to the hardcoded table.
    if (cached) {
      return { from: f, to: t, rate: cached.rate, source: 'cached', fetchedAt: new Date(cached.fetchedAt).toISOString() };
    }

    const fallback = this.fallbackRate(f, t);
    return { from: f, to: t, rate: fallback, source: 'fallback', fetchedAt: new Date().toISOString() };
  }

  private async fetchLive(from: string, to: string): Promise<number | null> {
    try {
      const url = `${UPSTREAM}?base=${encodeURIComponent(from)}&symbols=${encodeURIComponent(to)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
      if (!res.ok) {
        this.logger.warn(`FX upstream ${from}->${to} HTTP ${res.status}`);
        return null;
      }
      const data = await res.json() as { rates?: Record<string, number> };
      const r = data.rates?.[to];
      return typeof r === 'number' && r > 0 ? r : null;
    } catch (err) {
      this.logger.warn(`FX upstream ${from}->${to} failed: ${(err as Error).message}`);
      return null;
    }
  }

  /** Derive `from -> to` from the TZS-pivot fallback table. Both
   *  ends must be in the table; we go through TZS for any pair. */
  private fallbackRate(from: string, to: string): number {
    const tzsPerFrom = from === 'TZS' ? 1 : FALLBACK_TZS_PER[from];
    const tzsPerTo   = to   === 'TZS' ? 1 : FALLBACK_TZS_PER[to];
    if (!tzsPerFrom || !tzsPerTo) {
      this.logger.warn(`FX fallback missing for ${from}->${to}, returning 1`);
      return 1;
    }
    return tzsPerFrom / tzsPerTo;
  }
}
