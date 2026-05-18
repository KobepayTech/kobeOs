import { Injectable, Logger } from '@nestjs/common';

interface CacheEntry<T> {
  value: T;
  expiresAt: number; // ms epoch; 0 = never
}

/**
 * Simple in-process LRU-style cache with TTL support.
 *
 * Capped at MAX_ENTRIES — oldest entries are evicted when the cap is reached.
 * A background interval sweeps expired entries every 60 s.
 *
 * Drop-in replacement path: swap this class for @nestjs/cache-manager when
 * Redis is available; the get/set/del/wrap API is intentionally compatible.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private static readonly MAX_ENTRIES = 1_000;
  private static readonly SWEEP_INTERVAL_MS = 60_000;

  constructor() {
    const timer = setInterval(() => this.sweep(), CacheService.SWEEP_INTERVAL_MS);
    // Allow the process to exit even if this interval is still running
    if (timer.unref) timer.unref();
  }

  /** Retrieve a cached value, or undefined if missing / expired. */
  get<T>(key: string): T | undefined {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;
    if (entry.expiresAt !== 0 && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /** Store a value. ttlMs = 0 means no expiry. */
  set<T>(key: string, value: T, ttlMs = 0): void {
    if (this.store.size >= CacheService.MAX_ENTRIES && !this.store.has(key)) {
      // Evict the oldest entry
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, {
      value,
      expiresAt: ttlMs > 0 ? Date.now() + ttlMs : 0,
    });
  }

  /** Delete a single key. */
  del(key: string): void {
    this.store.delete(key);
  }

  /** Delete all keys matching a prefix. */
  delByPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  /**
   * Return cached value if present, otherwise call factory, cache the result,
   * and return it.
   */
  async wrap<T>(key: string, factory: () => Promise<T>, ttlMs = 0): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) return cached;
    const value = await factory();
    this.set(key, value, ttlMs);
    return value;
  }

  /** Remove all expired entries. Called automatically every 60 s. */
  private sweep(): void {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt !== 0 && now > entry.expiresAt) {
        this.store.delete(key);
        removed++;
      }
    }
    if (removed > 0) {
      this.logger.debug(`Cache sweep: removed ${removed} expired entries (${this.store.size} remaining)`);
    }
  }
}
