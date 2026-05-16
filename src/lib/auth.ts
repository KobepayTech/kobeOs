import {
  api, getToken, setToken, getRefreshToken, setRefreshToken,
  clearTokens, ApiError,
} from './api';

export interface AuthUser {
  id: string;
  email: string;
  displayName?: string;
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

function persist(res: AuthResponse) {
  setToken(res.accessToken);
  setRefreshToken(res.refreshToken);
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await api<AuthResponse>('/auth/login', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ email, password }),
  });
  persist(res);
  return res.user;
}

export async function register(email: string, password: string, displayName?: string): Promise<AuthUser> {
  const res = await api<AuthResponse>('/auth/register', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ email, password, displayName }),
  });
  persist(res);
  return res.user;
}

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    try {
      await api('/auth/logout', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ refreshToken }),
      });
    } catch { /* server may already have revoked the token */ }
  }
  clearTokens();
}

export async function requestPasswordReset(email: string): Promise<{ ok: true; resetToken?: string }> {
  return api('/auth/forgot-password', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<{ ok: true }> {
  return api('/auth/reset-password', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ token, newPassword }),
  });
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

/**
 * Ensure a session exists. Reuses stored tokens (the api client auto-refreshes
 * on 401). In development only, falls back to a demo account so apps can be
 * previewed without a real login. In production, throws if no session exists.
 */
export async function ensureSession(): Promise<AuthUser> {
  if (isLoggedIn() || getRefreshToken()) {
    try {
      return await api<AuthUser>('/users/me');
    } catch {
      clearTokens();
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
