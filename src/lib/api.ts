/**
 * api.ts — HTTP client with offline-first fallback
 *
 * When the backend is unreachable, reads fall back to the local SQLite cache
 * and writes are queued locally so the UI stays responsive offline.
 * All 70 apps get this for free — no per-app changes needed.
 *
 * Token storage uses window.kobeOS.db KV store when in Electron,
 * falling back to localStorage in browser dev mode.
 */

// ── Token storage ─────────────────────────────────────────────────────────────

const TOKEN_KEY   = 'kobe_auth_token';
const REFRESH_KEY = 'kobe_refresh_token';

function db() {
  return (window as any).kobeOS?.db ?? null;
}

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      db()?.kvSet(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
      db()?.kvDel(TOKEN_KEY);
    }
  } catch { /* ignore */ }
}

export function getRefreshToken(): string | null {
  try { return localStorage.getItem(REFRESH_KEY); } catch { return null; }
}

export function setRefreshToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(REFRESH_KEY, token);
      db()?.kvSet(REFRESH_KEY, token);
    } else {
      localStorage.removeItem(REFRESH_KEY);
      db()?.kvDel(REFRESH_KEY);
    }
  } catch { /* ignore */ }
}

export function clearTokens() {
  setToken(null);
  setRefreshToken(null);
}

// ── API base URL ──────────────────────────────────────────────────────────────

export const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ??
  (import.meta.env.DEV ? 'http://localhost:3000/api' : 'https://api.kobeapptz.com/api');

// ── Backend reachability ──────────────────────────────────────────────────────

let _backendReachable = true;
let _lastCheck = 0;
const CHECK_TTL = 10_000;

export function markBackendReachable() {
  _backendReachable = true;
  _lastCheck = Date.now();
}

export function isOnline(): boolean {
  return _backendReachable;
}

// ── Path → SQLite table mapping ───────────────────────────────────────────────

const PATH_TABLE_MAP: Record<string, string> = {
  '/notes': 'notes',
  '/contacts': 'contacts',
  '/todo': 'todo_items',
  '/todo-lists': 'todo_lists',
  '/pos/products': 'pos_products',
  '/pos/orders': 'pos_orders',
  '/pos': 'pos_orders',
  '/cargo/shipments': 'cargo_shipments',
  '/cargo': 'cargo_shipments',
  '/hotel-security/room-links': 'hotel_room_signal_links',
  '/hotel-security/room-reviews': 'hotel_room_reviews',
  '/hotel/rooms': 'hotel_rooms',
  '/hotel/bookings': 'hotel_bookings',
  '/hotel': 'hotel_bookings',
  '/security/clients': 'security_clients',
  '/security/sites': 'client_sites',
  '/security/members': 'team_members',
  '/security/routes': 'service_routes',
  '/security/checks': 'service_checks',
  '/security/signals': 'site_signals',
  '/security/work-items': 'work_items',
  '/studio/media/projects': 'studio_media_projects',
  '/studio/media/jobs': 'studio_media_jobs',
  '/calendar/events': 'calendar_events',
  '/calendar': 'calendar_events',
};

function pathToTable(path: string): string | null {
  const sorted = Object.keys(PATH_TABLE_MAP).sort((a, b) => b.length - a.length);
  for (const prefix of sorted) {
    if (path.startsWith(prefix)) return PATH_TABLE_MAP[prefix];
  }
  return null;
}

function pathId(path: string): string | null {
  const m = path.match(/\/(\d+|[0-9a-f-]{36})$/i);
  return m ? m[1] : null;
}

// ── Offline read from SQLite cache ────────────────────────────────────────────

async function offlineRead<T>(path: string): Promise<T | null> {
  const localDb = db();
  if (!localDb) return null;
  const table = pathToTable(path);
  if (!table) return null;
  const id = pathId(path);
  try {
    if (id) {
      const rows = await localDb.query(table, { id }) as T[];
      return rows[0] ?? null;
    }
    const rows = await localDb.query(table) as Array<Record<string, unknown>>;
    return rows.filter(r => !r.deleted) as unknown as T;
  } catch {
    return null;
  }
}

// ── Offline write: apply locally + enqueue for sync ──────────────────────────

async function offlineWrite(
  path: string,
  method: string,
  body: unknown,
  authHeader: string | null,
): Promise<void> {
  const localDb = db();
  if (!localDb) return;
  const table = pathToTable(path);

  if (table && body && typeof body === 'object') {
    const record = { ...(body as Record<string, unknown>) };
    if (!record.id) record.id = `local_${Date.now()}`;
    record.updated_at = Math.floor(Date.now() / 1000);
    record.synced = 0;

    if (method === 'DELETE') {
      const id = pathId(path);
      if (id) await localDb.delete(table, id).catch(() => {});
    } else {
      await localDb.insert(table, record).catch(() => {});
    }
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) headers['Authorization'] = authHeader;
  await localDb.enqueue({ method, path, body, headers }).catch(() => {});
}

// ── Cache a successful GET response into SQLite ───────────────────────────────

function cacheResponse(path: string, data: unknown): void {
  const localDb = db();
  if (!localDb) return;
  const table = pathToTable(path);
  if (!table) return;
  try {
    const rows = Array.isArray(data) ? data : [data];
    for (const row of rows) {
      if (row && typeof row === 'object' && (row as any).id) {
        localDb.insert(table, { ...(row as object), synced: 1 }).catch(() => {});
      }
    }
  } catch { /* ignore */ }
}

// ── Error classes ─────────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  body?: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export class OfflineError extends Error {
  constructor() {
    super('Offline — changes saved locally and will sync when connected');
  }
}

/**
 * Thrown when a write call fell through to the local offline queue
 * because the backend was unreachable. The write IS saved locally (and
 * will sync later) but the caller should know about it so the UI can
 * decide whether to optimistically render or surface a "backend offline,
 * queued for sync" notice.
 */
export class OfflineWriteQueuedError extends Error {
  readonly queued = true;
  constructor(public readonly path: string) {
    super(`Backend unreachable — ${path} write queued locally and will sync when reconnected`);
  }
}

// ── Token refresh ─────────────────────────────────────────────────────────────

let refreshInFlight: Promise<boolean> | null = null;

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
      if (!res.ok) { clearTokens(); return false; }
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

// ── Raw fetch ─────────────────────────────────────────────────────────────────

type RequestExtras = {
  auth?: boolean;
  _retry?: boolean;
  offlineFallback?: boolean;
};

async function rawFetch(path: string, init: RequestInit, attachAuth: boolean): Promise<Response> {
  const headers = new Headers(init.headers);
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (!isFormData && !headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (attachAuth) {
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  // Forward the active shop id on every request so shop-scoped endpoints
  // (expenses, EOD, POS orders) know which branch to charge. Backend
  // ignores the header on endpoints that aren't shop-scoped.
  try {
    const shopId = window.localStorage.getItem('kobeos:active-shop-id');
    if (shopId && !headers.has('X-Active-Shop-Id')) headers.set('X-Active-Shop-Id', shopId);
  } catch {
    /* storage disabled */
  }
  return fetch(`${API_BASE}${path}`, { ...init, headers });
}

// ── Main api() ────────────────────────────────────────────────────────────────

export async function api<T = unknown>(
  path: string,
  init: RequestInit & RequestExtras = {},
): Promise<T> {
  const { auth = true, _retry, offlineFallback = true, ...rest } = init;
  const method = (rest.method ?? 'GET').toUpperCase();
  const isRead = method === 'GET' || method === 'HEAD';

  if (offlineFallback && isRead && !_backendReachable) {
    const cached = await offlineRead<T>(path);
    if (cached !== null) return cached;
  }

  try {
    let res = await rawFetch(path, rest, auth);

    if (res.status === 401 && auth && !_retry && getRefreshToken()) {
      const refreshed = await refreshAccessToken();
      if (refreshed) res = await rawFetch(path, rest, true);
    }

    if (res.ok) {
      _backendReachable = true;
      _lastCheck = Date.now();
      const text = await res.text();
      const body = text ? safeJson(text) : undefined;
      if (offlineFallback && isRead) cacheResponse(path, body);
      return body as T;
    }

    if (offlineFallback && isRead && res.status >= 500) {
      _backendReachable = false;
      _lastCheck = Date.now();
      const cached = await offlineRead<T>(path);
      if (cached !== null) return cached;
    }

    const text = await res.text();
    const body = text ? safeJson(text) : undefined;
    // Prefer NestJS-style `message` (detail like "Discount exceeds approval
    // threshold; manager approval required") over `error` (which is the
    // bare status name, e.g. "Forbidden") so the user sees something
    // actionable instead of a generic "HTTP 403".
    const bag = (body && typeof body === 'object' ? (body as Record<string, unknown>) : undefined);
    const msgField = bag?.message;
    const errField = bag?.error;
    const msg =
      (typeof msgField === 'string' && msgField) ||
      (Array.isArray(msgField) && msgField.length && typeof msgField[0] === 'string' && msgField.join(', ')) ||
      (typeof errField === 'string' && errField) ||
      res.statusText ||
      `HTTP ${res.status}`;
    throw new ApiError(res.status, msg, body);

  } catch (err) {
    if (err instanceof ApiError) throw err;

    _backendReachable = false;
    _lastCheck = Date.now();

    if (!offlineFallback) throw err;

    if (isRead) {
      const cached = await offlineRead<T>(path);
      if (cached !== null) return cached;
      if (!pathId(path)) return [] as unknown as T;
      throw new OfflineError();
    }

    const bodyStr = typeof rest.body === 'string' ? rest.body : JSON.stringify(rest.body ?? {});
    const token = auth ? getToken() : null;
    await offlineWrite(path, method, safeJson(bodyStr) ?? {}, token ? `Bearer ${token}` : null);
    // The legacy `{ _offline: true, _queued: true }` return looked like a
    // success to callers and crashed any code that tried to read fields
    // off the response. Throw a recognisable error instead so handlers
    // can decide what to do — show a toast, surface inline, etc. The
    // local queue still has the write; nothing is lost.
    throw new OfflineWriteQueuedError(path);
  }
}

// ── File upload ───────────────────────────────────────────────────────────────

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
  // Force-disable offline fallback for file uploads: FormData can't be
  // serialised to the local queue (JSON.stringify(formData) → "{}"),
  // so silently queuing would lose the file. Surface the real error to
  // the caller — they can show a clear "backend offline" message
  // instead of pretending the upload worked.
  return api<T>(path, { method: 'POST', body: form, offlineFallback: false });
}

// ── Authenticated binary → object URL ────────────────────────────────────────

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

// ── Util ──────────────────────────────────────────────────────────────────────

function safeJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return s; }
}
