/**
 * Client-side LAN failover. When the internet base URL is unreachable (self-
 * hosted server offline from the public tunnel, or no internet at all), the web
 * app tries to reach the SAME server directly over WiFi.
 *
 * Browsers can't do mDNS/UDP, so discovery here is limited to what a page can
 * do: reuse a remembered LAN address, and — if the page itself is already being
 * served from a private LAN host — use that same origin. The server's
 * `/lan/info` handshake then reveals all of its addresses so we can remember a
 * good one for next time.
 *
 * The pure helpers (host classification, candidate ordering) are unit-tested;
 * the probing uses fetch.
 */

const LAN_KEY = 'kobeos:lanBase';

/** RFC-1918 / link-local / .local / loopback — i.e. a same-WiFi address. */
export function isPrivateHost(host: string): boolean {
  const h = (host || '').split(':')[0].toLowerCase();
  if (h === 'localhost' || h.endsWith('.local')) return true;
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;            // link-local
  const m = /^172\.(\d+)\./.exec(h);                  // 172.16.0.0 – 172.31.255.255
  if (m) { const n = Number(m[1]); return n >= 16 && n <= 31; }
  return false;
}

export function loadLanBase(): string | null {
  try { return window.localStorage.getItem(LAN_KEY); } catch { return null; }
}
export function saveLanBase(base: string): void {
  try { window.localStorage.setItem(LAN_KEY, base); } catch { /* ignore */ }
}
export function clearLanBase(): void {
  try { window.localStorage.removeItem(LAN_KEY); } catch { /* ignore */ }
}

/**
 * Ordered list of API bases to try when the primary is down, most-likely first,
 * de-duplicated. `origin` is the current page origin (window.location.origin).
 */
export function candidateBases(origin: string, remembered: string | null): string[] {
  const out: string[] = [];
  if (remembered) out.push(remembered);
  // If the page is already served from a LAN host over http, its own /api works.
  try {
    const u = new URL(origin);
    if (isPrivateHost(u.hostname)) out.push(`${origin.replace(/\/$/, '')}/api`);
  } catch { /* non-URL origin (native shell) */ }
  return Array.from(new Set(out));
}

/** Probe a base's /health; true if it's our backend and the DB is up. */
export async function probeBase(base: string, timeoutMs = 2500): Promise<boolean> {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/health`, { signal: controller.signal, headers: { accept: 'application/json' } });
    const ct = res.headers.get('content-type') ?? '';
    if (!res.ok || !ct.includes('application/json')) return false;
    const body = await res.json().catch(() => null);
    return body?.status === 'ok';
  } catch {
    return false;
  } finally {
    clearTimeout(to);
  }
}

/** Ask a reachable server for all its LAN addresses (to remember a good one). */
export async function fetchLanInfo(base: string): Promise<{ addresses: { ip: string; url: string }[] } | null> {
  try {
    const res = await fetch(`${base}/lan/info`, { headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Find a reachable LAN base. Returns the base (…/api) that responded, or null.
 * On success remembers it, and upgrades to a server-reported address if the one
 * we reached isn't already in the remembered slot.
 */
export async function discoverLanBase(origin: string): Promise<string | null> {
  for (const base of candidateBases(origin, loadLanBase())) {
    if (await probeBase(base)) {
      saveLanBase(base);
      return base;
    }
  }
  return null;
}
