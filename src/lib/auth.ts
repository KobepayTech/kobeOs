import {
  api, getToken, setToken, getRefreshToken, setRefreshToken,
  clearTokens, ApiError,
} from './api';

export interface AuthUser {
  id: string;
  email: string;
  phone?: string | null;
  displayName?: string;
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

interface DesktopAuthResponse extends AuthResponse {
  cloudAccessToken: string;
  cloudRefreshToken: string;
}

const CLOUD_ACCESS_KEY = 'kobe_cloud_access_token';
const CLOUD_REFRESH_KEY = 'kobe_cloud_refresh_token';

function persist(res: AuthResponse) {
  setToken(res.accessToken);
  setRefreshToken(res.refreshToken);
  localStorage.setItem('kobeos_auth_user', JSON.stringify(res.user));
}

function persistCloud(accessToken: string, refreshToken: string) {
  try {
    if (accessToken) localStorage.setItem(CLOUD_ACCESS_KEY, accessToken);
    else localStorage.removeItem(CLOUD_ACCESS_KEY);
    if (refreshToken) localStorage.setItem(CLOUD_REFRESH_KEY, refreshToken);
    else localStorage.removeItem(CLOUD_REFRESH_KEY);
  } catch { /* storage may be unavailable */ }
}

function persistDesktop(res: DesktopAuthResponse) {
  persist(res);
  persistCloud(res.cloudAccessToken, res.cloudRefreshToken);
}

export function getCloudAccessToken(): string | null {
  try { return localStorage.getItem(CLOUD_ACCESS_KEY); } catch { return null; }
}

export async function login(identifier: string, password: string): Promise<AuthUser> {
  const res = await api<AuthResponse>('/auth/login', {
    method: 'POST',
    auth: false,
    offlineFallback: false,
    body: JSON.stringify({ identifier, password }),
  });
  persist(res);
  return res.user;
}

/** Desktop login: authenticate the global Kobe account in Kobe Cloud, then
 * receive a local JWT from the embedded backend for offline-first apps. */
export async function desktopLogin(identifier: string, password: string): Promise<AuthUser> {
  const res = await api<DesktopAuthResponse>('/auth/desktop/login', {
    method: 'POST',
    auth: false,
    offlineFallback: false,
    body: JSON.stringify({ identifier, password }),
  });
  persistDesktop(res);
  return res.user;
}

/** Sign in / up with a Google Identity Services credential (ID token). */
export async function oauthGoogle(credential: string): Promise<AuthUser> {
  const res = await api<AuthResponse>('/auth/oauth/google', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ credential }),
  });
  persist(res);
  return res.user;
}

/** Desktop Google login is verified by Kobe Cloud, then exchanged for a local
 * KobeOS session. Provider secrets never ship inside the desktop installer. */
export async function desktopOauthGoogle(credential: string): Promise<AuthUser> {
  const res = await api<DesktopAuthResponse>('/auth/desktop/google', {
    method: 'POST',
    auth: false,
    offlineFallback: false,
    body: JSON.stringify({ credential }),
  });
  persistDesktop(res);
  return res.user;
}

/** Store tokens handed back by a provider redirect (e.g. TikTok callback). */
export function oauthConsume(accessToken: string, refreshToken: string): void {
  setToken(accessToken);
  setRefreshToken(refreshToken);
}

/** Exchange a successful Kobe Cloud social login for the local desktop session. */
export async function desktopOauthExchange(
  cloudAccessToken: string,
  cloudRefreshToken = '',
): Promise<AuthUser> {
  const res = await api<DesktopAuthResponse>('/auth/desktop/exchange', {
    method: 'POST',
    auth: false,
    offlineFallback: false,
    body: JSON.stringify({ accessToken: cloudAccessToken, refreshToken: cloudRefreshToken }),
  });
  persistDesktop(res);
  return res.user;
}

export async function register(identifier: string, password: string, displayName?: string): Promise<AuthUser> {
  const trimmed = identifier.trim();
  const isEmail = trimmed.includes('@');
  const res = await api<AuthResponse>('/auth/register', {
    method: 'POST',
    auth: false,
    offlineFallback: false,
    body: JSON.stringify({
      email: isEmail ? trimmed : undefined,
      phone: isEmail ? undefined : trimmed,
      password,
      displayName,
    }),
  });
  persist(res);
  return res.user;
}

/** Desktop registration creates the global Kobe account first, then provisions
 * the matching local identity used by the embedded backend. */
export async function desktopRegister(identifier: string, password: string, displayName?: string): Promise<AuthUser> {
  const trimmed = identifier.trim();
  const isEmail = trimmed.includes('@');
  const res = await api<DesktopAuthResponse>('/auth/desktop/register', {
    method: 'POST',
    auth: false,
    offlineFallback: false,
    body: JSON.stringify({
      email: isEmail ? trimmed : undefined,
      phone: isEmail ? undefined : trimmed,
      password,
      displayName,
    }),
  });
  persistDesktop(res);
  return res.user;
}

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    try {
      await api('/auth/logout', {
        method: 'POST',
        auth: false,
        offlineFallback: false,
        body: JSON.stringify({ refreshToken }),
      });
    } catch { /* server may already have revoked the token */ }
  }
  clearTokens();
  persistCloud('', '');
  try {
    localStorage.removeItem('kobeos_auth_user');
    localStorage.removeItem('kobeos_user');
    localStorage.removeItem('kobeos_entitlement_owner');
  } catch { /* storage may be unavailable */ }
}

export async function requestPasswordReset(email: string): Promise<{ ok: true; resetToken?: string }> {
  return api('/auth/forgot-password', {
    method: 'POST',
    auth: false,
    offlineFallback: false,
    body: JSON.stringify({ email }),
  });
}

export async function desktopRequestPasswordReset(email: string): Promise<{ ok: true; resetToken?: string }> {
  return api('/auth/desktop/forgot-password', {
    method: 'POST',
    auth: false,
    offlineFallback: false,
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<{ ok: true }> {
  return api('/auth/reset-password', {
    method: 'POST',
    auth: false,
    offlineFallback: false,
    body: JSON.stringify({ token, newPassword }),
  });
}

export async function desktopResetPassword(token: string, newPassword: string): Promise<{ ok: true }> {
  return api('/auth/desktop/reset-password', {
    method: 'POST',
    auth: false,
    offlineFallback: false,
    body: JSON.stringify({ token, newPassword }),
  });
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

export function hasStoredSession(): boolean {
  return !!(getToken() || getRefreshToken());
}

export function getStoredAuthUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem('kobeos_auth_user');
    return raw ? JSON.parse(raw) as AuthUser : null;
  } catch {
    return null;
  }
}

/**
 * Ensure a session exists. Reuses stored tokens (the api client auto-refreshes
 * on 401). In development only, falls back to a demo account so apps can be
 * previewed without a real login. In production, throws if no session exists.
 */
export async function ensureSession(): Promise<AuthUser> {
  if (isLoggedIn() || getRefreshToken()) {
    try {
      const user = await api<AuthUser>('/users/me');
      // Offline reads can intentionally return an empty fallback. Keep using
      // the last verified account instead of turning that into a logout.
      if (user && typeof user === 'object' && typeof user.id === 'string') {
        try { localStorage.setItem('kobeos_auth_user', JSON.stringify(user)); } catch { /* storage unavailable */ }
        return user;
      }
      const stored = getStoredAuthUser();
      if (stored) return stored;
      throw new Error('Account verification is temporarily unavailable.');
    } catch (err) {
      // A rejected access/refresh token is the only condition that should
      // remove a saved login. Network, CORS, Cloudflare and 5xx failures are
      // temporary and must preserve the session for the next retry.
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        clearTokens();
      } else {
        const stored = getStoredAuthUser();
        if (stored) return stored;
        throw err;
      }
    }
  }

  const isDev = import.meta.env.DEV;
  if (!isDev) {
    throw new Error('No active session. Please log in.');
  }

  // Dev-only: auto-provision a demo account for local development.
  const email = 'demo@kobeos.local';
  const password = 'kobeos-demo-1234';
  try {
    return await register(email, password, 'Demo User');
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      return login(email, password);
    }
    throw err;
  }
}
