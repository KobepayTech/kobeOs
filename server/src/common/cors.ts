/**
 * Build a CORS origin predicate that accepts:
 *   - explicit origins from CORS_ORIGIN (comma-separated)
 *   - the bare apex `TENANT_BASE_DOMAIN` (e.g. https://kobeapptz.com)
 *   - any subdomain of TENANT_BASE_DOMAIN (e.g. https://tuma.kobeapptz.com,
 *     https://serenahotel.kobeapptz.com — the wildcard covers both the
 *     reserved public-app subdomains and tenant slugs)
 *
 * Both lists are read from env once at boot. The returned predicate handles
 * the (origin, callback) shape used by both express-style enableCors and
 * the socket.io cors option, so HTTP and websocket endpoints share one rule.
 *
 * Previously the predicate only matched subdomains of TENANT_BASE_DOMAIN,
 * NOT the bare apex. So the OS shell at https://kobeapptz.com couldn't
 * call https://api.kobeapptz.com/* — every fetch failed preflight and the
 * SPA reported "Backend unreachable" via OfflineWriteQueuedError. Every
 * Store Editor Save + Install cloudflared button click hit this path.
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
  const escaped = baseDomain.replace(/\./g, '\\.');
  // Matches https://kobeapptz.com AND https://X.kobeapptz.com with an
  // optional :port suffix. The subdomain label follows the standard
  // hostname grammar (1-40 chars, starts+ends with alphanumeric).
  const domainPattern = baseDomain
    ? new RegExp(`^https?://(?:[a-z0-9][a-z0-9-]{0,38}[a-z0-9]\\.)?${escaped}(?::\\d+)?$`, 'i')
    : null;

  const isAllowed = (origin: string | undefined): boolean => {
    if (!origin) return true; // same-origin requests (curl, server-side) have no Origin header
    if (explicit.includes(origin)) return true;
    if (domainPattern && domainPattern.test(origin)) return true;
    return false;
  };

  const predicate = (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) => {
    if (isAllowed(origin)) callback(null, true);
    else callback(new Error(`Origin '${origin}' not allowed by CORS`), false);
  };

  return { predicate, isAllowed, explicit, baseDomain };
}
