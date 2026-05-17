const TOKEN_KEY = 'kobe_auth_token';
const REFRESH_KEY = 'kobe_refresh_token';

/** In dev, fall back to localhost. In a production build, fall back to the central KobePay API. */
export const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ??
  (import.meta.env.DEV ? 'http://localhost:3000/api' : 'https://api.kobeapptz.com/api');

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore */ }
}

export function getRefreshToken(): string | null {
  try { return localStorage.getItem(REFRESH_KEY); } catch { return null; }
}

export function setRefreshToken(token: string | null) {
  try {
    if (token) localStorage.setItem(REFRESH_KEY, token);
    else localStorage.removeItem(REFRESH_KEY);
  } catch { /* ignore */ }
}

export function clearTokens() {
  setToken(null);
  setRefreshToken(null);
}

export class ApiError extends Error {
  status: number;
  body?: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Single-flight refresh: if multiple requests race in with a stale access
 * token, only one POST /auth/refresh runs and the rest await its result.
 */
async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  const rt = getRefreshToken();
  if (!rt) return false;
  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      });
      if (!res.ok) {
        clearTokens();
        return false;
      }
      const body = (await res.json()) as { accessToken: string; refreshToken: string };
      setToken(body.accessToken);
      setRefreshToken(body.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

type RequestExtras = { auth?: boolean; _retry?: boolean };

async function rawFetch(path: string, init: RequestInit, attachAuth: boolean): Promise<Response> {
  const headers = new Headers(init.headers);
  // For multipart bodies (FormData), let fetch set the boundary itself.
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (!isFormData && !headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (attachAuth) {
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(`${API_BASE}${path}`, { ...init, headers });
}

export async function api<T = unknown>(
  path: string,
  init: RequestInit & RequestExtras = {},
): Promise<T> {
  const { auth = true, _retry, ...rest } = init;
  let res = await rawFetch(path, rest, auth);

  // Transparent refresh on 401 — exactly one retry per call.
  if (res.status === 401 && auth && !_retry && getRefreshToken()) {
    const refreshed = await refreshAccessToken();
    if (refreshed) res = await rawFetch(path, rest, true);
  }

  const text = await res.text();
  const body = text ? safeJson(text) : undefined;
  if (!res.ok) {
    const errField =
      body && typeof body === 'object' && 'error' in body
        ? (body as { error?: unknown }).error
        : undefined;
    const msg =
      (typeof errField === 'string' && errField) ||
      res.statusText ||
      `HTTP ${res.status}`;
    throw new ApiError(res.status, msg, body);
  }
  return body as T;
}

/** Multipart helper: build a FormData payload and POST with auth attached. */
export async function uploadFile<T = unknown>(
  path: string,
  file: File | Blob,
  opts: { fieldName?: string; filename?: string; extraFields?: Record<string, string> } = {},
): Promise<T> {
  const form = new FormData();
  const filename = opts.filename ?? (file instanceof File ? file.name : 'upload.bin');
  form.append(opts.fieldName ?? 'file', file, filename);
  if (opts.extraFields) {
    for (const [k, v] of Object.entries(opts.extraFields)) form.append(k, v);
  }
  return api<T>(path, { method: 'POST', body: form });
}

/**
 * Fetch an authenticated binary endpoint and return an object URL the
 * browser can render in <img>/<audio>/<video>. Caller is responsible for
 * URL.revokeObjectURL() when the URL is no longer needed.
 */
export async function fetchObjectUrl(path: string): Promise<string> {
  const res = await rawFetch(path, { method: 'GET' }, true);
  if (res.status === 401 && getRefreshToken()) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return fetchObjectUrl(path);
  }
  if (!res.ok) throw new ApiError(res.status, res.statusText);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

function safeJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return s; }
}
