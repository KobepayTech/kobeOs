import { Container, getContainer } from '@cloudflare/containers';

const PRIMARY_INSTANCE = 'kobeos-primary';
const OPTIONAL_CONTAINER_ENV = [
  'SENDGRID_API_KEY',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'WEBHOOK_SECRET',
  'OLLAMA_URL',
  'OLLAMA_MODEL',
  'FOOTBALL_DATA_API_KEY',
  'API_FOOTBALL_KEY',
  'CF_API_TOKEN',
  'CF_ZONE_ID',
  'CF_DOMAIN',
  'REGISTRY_API_URL',
  'SCRAPE_CREATORS_API_KEY',
  'PALMPESA_API_TOKEN',
  'PALMPESA_USER_ID',
  'INSTAGRAM_APP_ID',
  'INSTAGRAM_APP_SECRET',
  'INSTAGRAM_REDIRECT_URI',
  'INSTAGRAM_API_VERSION',
  'INSTAGRAM_OAUTH_SCOPES',
  'IG_WEBHOOK_VERIFY_TOKEN',
  'GOOGLE_CLIENT_ID',
  'TIKTOK_CLIENT_KEY',
  'TIKTOK_CLIENT_SECRET',
  'TIKTOK_REDIRECT_URI',
  'TIKTOK_CREATOR_REDIRECT_URI',
  'TIKTOK_CREATOR_OAUTH_SCOPES',
  'META_APP_ID',
  'META_APP_SECRET',
  'META_REDIRECT_URI',
  'META_LOGIN_CONFIG_ID',
  'META_GRAPH_VERSION',
  'LICENSE_HMAC_SECRET',
  'BEEM_API_KEY',
  'BEEM_SECRET_KEY',
  'BEEM_SOURCE_ADDR',
  'BEEM_SMS_URL',
  'FR24_API_KEY',
  'FR24_API_BASE',
  'FR24_API_VERSION',
  'KOBE_MODELS_CDN_URL',
];

function required(env, key) {
  const value = env[key];
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new Error(`Missing required Cloudflare binding: ${key}`);
  }
  return String(value);
}

function containerEnv(env) {
  const values = {
    NODE_ENV: 'production',
    PORT: '3000',
    KOBEOS_DEPLOYMENT: 'cloudflare-container',
    KOBEOS_DESKTOP: 'false',
    DB_HOST: required(env, 'DB_HOST'),
    DB_PORT: String(env.DB_PORT || '5432'),
    DB_USERNAME: required(env, 'DB_USERNAME'),
    DB_PASSWORD: required(env, 'DB_PASSWORD'),
    DB_DATABASE: String(env.DB_DATABASE || 'kobeos'),
    DB_SSL: String(env.DB_SSL ?? 'true'),
    DB_SSL_REJECT_UNAUTHORIZED: String(env.DB_SSL_REJECT_UNAUTHORIZED ?? 'true'),
    DB_SYNCHRONIZE: 'false',
    DB_MIGRATIONS_RUN: 'true',
    JWT_SECRET: required(env, 'JWT_SECRET'),
    PROVIDER_ENCRYPTION_KEY: required(env, 'PROVIDER_ENCRYPTION_KEY'),
    TENANT_BASE_DOMAIN: String(env.TENANT_BASE_DOMAIN || 'kobeapptz.com'),
    CORS_ORIGIN: String(
      env.CORS_ORIGIN ||
        'https://lala.kobeapptz.com,https://kobeapptz.com,https://www.kobeapptz.com',
    ),
    APP_PUBLIC_URL: String(env.APP_PUBLIC_URL || 'https://api.kobeapptz.com'),
  };

  for (const key of OPTIONAL_CONTAINER_ENV) {
    if (env[key] !== undefined && env[key] !== null && String(env[key]) !== '') {
      values[key] = String(env[key]);
    }
  }

  return values;
}

function withProductionMarker(response, path) {
  const headers = new Headers(response.headers);
  headers.set('X-Kobe-Production-Path', path);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function fetchLegacy(request, env) {
  // Preview deployments can point explicitly at a direct legacy hostname.
  if (env.LEGACY_ORIGIN_URL) {
    const target = new URL(request.url);
    const legacy = new URL(String(env.LEGACY_ORIGIN_URL));
    target.protocol = legacy.protocol;
    target.hostname = legacy.hostname;
    target.port = legacy.port;

    const response = await fetch(new Request(target.toString(), request));
    return withProductionMarker(response, 'legacy-origin-fallback');
  }

  // In production we use a Workers Route over the existing proxied API DNS
  // record. A subrequest for the incoming Request reaches the DNS-configured
  // origin behind that route, so the old origin remains an immediate fallback.
  if (String(env.ROUTE_ORIGIN_FALLBACK || '').toLowerCase() === 'true') {
    const response = await fetch(request);
    return withProductionMarker(response, 'legacy-origin-fallback');
  }

  return null;
}

export class KobeApiContainer extends Container {
  defaultPort = 3000;
  sleepAfter = '10m';

  constructor(ctx, env) {
    super(ctx, env);
    this.envVars = containerEnv(env);
  }

  onStart() {
    console.log('KobeOS primary API container started');
  }

  onStop(params) {
    console.log('KobeOS primary API container stopped', params);
  }

  onError(error) {
    console.error('KobeOS primary API container error', error);
  }
}

async function primaryFetch(request, env) {
  const container = getContainer(env.KOBE_API, PRIMARY_INSTANCE);
  const response = await container.fetch(request);
  return withProductionMarker(response, 'cloudflare-container');
}

function canReplayToLegacy(request) {
  return ['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase());
}

async function maybeFallbackRead(request, env, reason) {
  if (!canReplayToLegacy(request)) {
    console.warn('Not replaying mutating request to legacy origin', {
      method: request.method,
      reason,
    });
    return null;
  }

  try {
    return await fetchLegacy(request, env);
  } catch (fallbackError) {
    console.error('Legacy API fallback failed', fallbackError);
    return null;
  }
}

export default {
  async fetch(request, env) {
    try {
      const response = await primaryFetch(request, env);

      if (response.status >= 500) {
        const fallback = await maybeFallbackRead(request, env, `primary-status-${response.status}`);
        if (fallback) return fallback;
      }

      return response;
    } catch (error) {
      console.error('Cloudflare primary API request failed', error);
      const fallback = await maybeFallbackRead(request, env, 'primary-exception');
      if (fallback) return fallback;

      return Response.json(
        { ok: false, error: 'KobeOS primary API is temporarily unavailable' },
        {
          status: 503,
          headers: {
            'Retry-After': '10',
            'X-Kobe-Production-Path': 'cloudflare-container-error',
          },
        },
      );
    }
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      primaryFetch(new Request('https://api.kobeapptz.com/api/health'), env).catch((error) => {
        console.error('KobeOS primary API keep-warm health check failed', error);
      }),
    );
  },
};
