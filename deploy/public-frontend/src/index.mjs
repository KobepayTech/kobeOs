const SYSTEM_HOSTS = new Set(['api', 'app', 'www', 'lala', 'jumla', 'admin', 'desktop', 'staff', 'kobeos', 'tuma', 'mzigo', 'me', 'track', 'posys', 'cargo', 'cargotz', 'property', 'estate', 'pay', 'contract']);

export async function handleRequest(request, env, originFetch = fetch) {
  const url = new URL(request.url);
  const domain = env.TENANT_BASE_DOMAIN || 'kobeapptz.com';
  const label = url.hostname.endsWith(`.${domain}`) ? url.hostname.slice(0, -domain.length - 1) : '';
  const isTenant = !!label && !label.includes('.') && !SYSTEM_HOSTS.has(label);

  // A shop's uploaded media stays on that shop's origin. Do not upload it to
  // static assets or cache it at the edge; the public UI is independent of it.
  if (isTenant && /^\/api\/media(?:\/|$)/.test(url.pathname)) {
    try {
      const upstream = await originFetch(new Request(request, { redirect: 'manual' }), {
        cache: 'no-store', cf: { cacheTtl: 0, cacheEverything: false },
      });
      const headers = new Headers(upstream.headers);
      headers.set('Cache-Control', 'no-store');
      return new Response(upstream.body, { status: upstream.status, headers });
    } catch {
      return new Response('Shop media is temporarily unavailable.', { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
  }

  // Never serve index.html for API requests or replay a customer's write.
  // The service binding reaches the independent cloud API, without resolving
  // the old tunnel DNS or depending on the Windows machine.
  if (url.hostname === `api.${domain}` || /^\/(?:api|socket\.io)(?:\/|$)/.test(url.pathname)) {
    try {
      return await env.API.fetch(request);
    } catch {
      return Response.json({ error: 'The online service is temporarily unavailable. No automatic retry was made.' }, {
        status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '10' },
      });
    }
  }

  if (!['GET', 'HEAD'].includes(request.method)) {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }

  // Static assets (including SPA deep links) NEVER call a server or tunnel.
  const response = await env.ASSETS.fetch(request);
  const headers = new Headers(response.headers);
  headers.set('X-Kobe-Public-Hosting', 'cloudflare-assets');
  headers.set('X-Kobe-Public-Revision', env.RELEASE_REVISION || 'development');
  if (headers.get('Content-Type')?.includes('text/html')) headers.set('Cache-Control', 'no-cache');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default { fetch: (request, env) => handleRequest(request, env) };
