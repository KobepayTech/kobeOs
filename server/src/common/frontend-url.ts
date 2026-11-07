/**
 * Absolute URL of the web app — the landing target after an OAuth round-trip
 * (Instagram/TikTok connect, auth redirects).
 *
 * This used to fall straight back to http://localhost:5173/ when
 * APP_FRONTEND_URL was unset, which silently stranded production users on a dev
 * address after they authorised an account: the provider redirected correctly,
 * the server redirected correctly, and the browser landed nowhere. The live
 * origin does not set APP_FRONTEND_URL, so that was the default behaviour.
 *
 * Prefer every explicit production signal before considering localhost, and
 * only use localhost when nothing production-shaped is configured.
 */
/**
 * Config lookups here are declared as returning strings, but a real caller may
 * hand us Nest's ConfigService, whose `get` returns whatever the validated
 * schema produced — PORT comes back as a number. Reading `.trim()` off that
 * threw "get(...)?.trim is not a function" and 500'd the endpoint. Coerce
 * once, here, so every caller is safe rather than every caller remembering.
 */
type ConfigLookup = (key: string) => unknown;

function read(get: ConfigLookup, key: string): string | undefined {
  const value = get(key);
  if (value === undefined || value === null) return undefined;
  const text = typeof value === 'string' ? value : String(value);
  return text.trim() || undefined;
}

export function resolveFrontendUrl(get: ConfigLookup): string {
  const withSlash = (value: string) => `${value.replace(/\/+$/, '')}/`;

  const direct = read(get, 'APP_FRONTEND_URL') || read(get, 'FRONTEND_URL');
  if (direct) return withSlash(direct);

  const publicUrl = read(get, 'APP_PUBLIC_URL');
  if (publicUrl) return withSlash(publicUrl);

  const tenantDomain = read(get, 'TENANT_BASE_DOMAIN')?.replace(/^\.+/, '');

  // Concrete https origins from CORS_ORIGIN (wildcards can't be a redirect
  // target). Prefer one on the tenant domain over an incidental first entry
  // such as a *.pages.dev preview host.
  const corsOrigins = (read(get, 'CORS_ORIGIN') ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => /^https:\/\/[^*\s]+$/.test(entry));
  const preferred = tenantDomain
    ? corsOrigins.find((entry) => {
        try { return new URL(entry).hostname.endsWith(tenantDomain); } catch { return false; }
      })
    : undefined;
  if (preferred) return withSlash(preferred);

  if (tenantDomain) return `https://${tenantDomain}/`;
  if (corsOrigins.length) return withSlash(corsOrigins[0]);

  return 'http://localhost:5173/';
}

/**
 * Absolute public base URL of the API itself — used for the Instagram/Meta
 * webhook callback shown to the operator so they can register it in the Meta
 * App dashboard. Falling back to a bare relative path (the previous behaviour
 * when APP_PUBLIC_URL was unset, which is the case on the live origin) gives
 * the operator a URL Meta cannot accept.
 */
export function resolvePublicApiUrl(get: ConfigLookup): string {
  const withSlash = (value: string) => `${value.replace(/\/+$/, '')}/`;

  const direct = read(get, 'APP_PUBLIC_URL');
  if (direct) return withSlash(direct);

  // The API is published at api.<tenant domain> in this deployment.
  const tenantDomain = read(get, 'TENANT_BASE_DOMAIN')?.replace(/^\.+/, '');
  if (tenantDomain) return `https://api.${tenantDomain}/`;

  return `http://localhost:${read(get, 'PORT') || '3000'}/`;
}
