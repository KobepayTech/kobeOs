/**
 * Build a CORS origin predicate that accepts:
 *   - explicit origins from CORS_ORIGIN (comma-separated)
 *   - any origin under TENANT_BASE_DOMAIN as a subdomain (e.g. https://serenahotel.kobeapptz.com)
 *
 * Both lists are read from env once at boot. The returned predicate handles
 * the (origin, callback) shape used by both express-style enableCors and
 * the socket.io cors option, so HTTP and websocket endpoints share one rule.
 */
export function buildOriginPredicate() {
  const explicit = (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const baseDomain = (process.env.TENANT_BASE_DOMAIN || '').trim().toLowerCase();
  const subdomainPattern = baseDomain
    ? new RegExp(`^https?://[a-z0-9][a-z0-9-]{0,38}[a-z0-9]\\.${baseDomain.replace(/\./g, '\\.')}(?::\\d+)?$`, 'i')
    : null;

  const isAllowed = (origin: string | undefined): boolean => {
    if (!origin) return true; // same-origin requests (curl, server-side) have no Origin header
    if (explicit.includes(origin)) return true;
    if (subdomainPattern && subdomainPattern.test(origin)) return true;
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
