/**
 * Build a CORS origin predicate that accepts:
 *   - explicit origins from CORS_ORIGIN (comma-separated)
 *   - the packaged Electron renderer's opaque `null` origin when the embedded
 *     desktop backend explicitly declares KOBEOS_DESKTOP=true
 *   - the bare apex `TENANT_BASE_DOMAIN` (e.g. https://kobeapptz.com)
 *   - any subdomain of TENANT_BASE_DOMAIN (e.g. https://tuma.kobeapptz.com,
 *     https://serenahotel.kobeapptz.com — the wildcard covers both the
 *     reserved public-app subdomains and tenant slugs)
 *
 * Both lists are read from env once at boot. The returned predicate handles
 * the (origin, callback) shape used by both express-style enableCors and
 * the socket.io cors option, so HTTP and websocket endpoints share one rule.
 *
 * Chromium serializes cross-origin requests made by a packaged file:// page as
 * `Origin: null`. KobeOS Desktop previously configured CORS_ORIGIN=file://,
 * which did not match that serialized value; the renderer therefore reported
 * "Kobe Cloud unavailable" even though the embedded API was healthy. `null`
 * is accepted only for the embedded desktop process, never for the public API.
 *
 * The predicate is deliberately restrictive: never `origin: true`, never
 * `origin: '*'`. Add explicit hosts via CORS_ORIGIN if you need a
 * partner/CNAME origin.
 */
export function buildOriginPredicate() {
  const explicit = (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const baseDomain = (process.env.TENANT_BASE_DOMAIN || '').trim().toLowerCase();
  const desktopRenderer = process.env.KOBEOS_DESKTOP === 'true';
  const escaped = baseDomain.replace(/\./g, '\\.');
  // Matches https://kobeapptz.com AND https://X.kobeapptz.com with an
  // optional :port suffix. The subdomain label follows the standard
  // hostname grammar (1-40 chars, starts+ends with alphanumeric).
  const domainPattern = baseDomain
    ? new RegExp(`^https?://(?:[a-z0-9][a-z0-9-]{0,38}[a-z0-9]\\.)?${escaped}(?::\\d+)?$`, 'i')
    : null;

  const isAllowed = (origin: string | undefined): boolean => {
    if (!origin) return true; // same-origin requests (curl, server-side) have no Origin header
    if (desktopRenderer && (origin === 'null' || origin === 'file://')) return true;
    if (explicit.includes(origin)) return true;
    if (domainPattern && domainPattern.test(origin)) return true;
    return false;
  };

  const predicate = (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) => {
    // Deny WITHOUT an error: passing an Error makes the cors middleware throw,
    // which Express turns into a 500 (browsers then report "failed to fetch").
    // callback(null, false) is a clean CORS rejection — no CORS headers are
    // set and the browser blocks it normally.
    callback(null, isAllowed(origin));
  };

  return { predicate, isAllowed, explicit, baseDomain };
}
