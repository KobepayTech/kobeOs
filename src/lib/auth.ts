import { api, getToken, setToken, ApiError } from './api';

export interface AuthUser {
  id: string;
  email: string;
  displayName?: string;
}

interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const { accessToken, user } = await api<AuthResponse>('/auth/login', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ email, password }),
  });
  setToken(accessToken);
  return user;
}

export async function register(email: string, password: string, displayName?: string): Promise<AuthUser> {
  const { accessToken, user } = await api<AuthResponse>('/auth/register', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ email, password, displayName }),
  });
  setToken(accessToken);
  return user;
}

export function logout() {
  setToken(null);
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

/**
 * Convenience: ensure a session exists. Reuses stored token, or
 * registers/logs in a demo account so apps can talk to the API immediately.
 */
export async function ensureSession(): Promise<AuthUser> {
  if (isLoggedIn()) {
    try {
      return await api<AuthUser>('/users/me');
    } catch {
      setToken(null);
    }
  }
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
