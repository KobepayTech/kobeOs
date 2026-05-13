const TOKEN_KEY = 'kobe_auth_token';

export const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:3000/api';

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore */ }
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

export async function api<T = unknown>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const { auth = true, headers, ...rest } = init;
  const h = new Headers(headers);
  if (!h.has('Content-Type') && init.body) h.set('Content-Type', 'application/json');
  if (auth) {
    const token = getToken();
    if (token) h.set('Authorization', `Bearer ${token}`);
  }
  const res = await fetch(`${API_BASE}${path}`, { ...rest, headers: h });
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

function safeJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return s; }
}
