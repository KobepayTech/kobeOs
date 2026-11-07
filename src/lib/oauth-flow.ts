import { accountApiBase } from './api';

export type OAuthProvider = 'google' | 'meta' | 'tiktok';
export const providerNames: Record<OAuthProvider, string> = { google: 'Google', meta: 'Facebook', tiktok: 'TikTok' };
const CALLBACK_ORIGINS = new Set(['https://kobeos-app.pages.dev', 'https://kobeapptz.com', 'https://app.kobeapptz.com', 'https://www.kobeapptz.com']);

export function isExpectedOAuthMessage(event: Pick<MessageEvent, 'origin' | 'source' | 'data'>, popup: Window | null, provider: OAuthProvider | null): boolean {
  const data = event.data;
  return !!popup && !!provider && event.source === popup && CALLBACK_ORIGINS.has(event.origin)
    && data?.type === 'kobeos-oauth-complete' && data.provider === provider
    && typeof data.accessToken === 'string' && !!data.accessToken
    && typeof data.refreshToken === 'string' && !!data.refreshToken;
}
const PENDING_KEY = 'kobeos_pending_signin';

// Only navigation context belongs here; never store provider codes or tokens.
export function rememberOAuth(provider: OAuthProvider): void {
  try { sessionStorage.setItem(PENDING_KEY, provider); } catch { /* storage unavailable */ }
}

export function pendingOAuth(): OAuthProvider | null {
  try {
    const value = sessionStorage.getItem(PENDING_KEY);
    return value === 'google' || value === 'meta' || value === 'tiktok' ? value : null;
  } catch { return null; }
}

export function clearPendingOAuth(): void {
  try { sessionStorage.removeItem(PENDING_KEY); } catch { /* storage unavailable */ }
}

export function providerSignInUrl(provider: OAuthProvider): string {
  return `${accountApiBase()}/auth/oauth/${provider}`;
}

export function oauthErrorMessage(message: string, provider: OAuthProvider): string {
  const name = providerNames[provider];
  if (/expired|invalid oauth state|mismatched oauth state/i.test(message)) {
    return 'This sign-in attempt expired or could not be verified. Start a new sign-in below.';
  }
  if (/access_denied|user_denied|cancel/i.test(message)) {
    return `${name} sign-in was cancelled. Try again or use your KobeOS email or phone and password.`;
  }
  return message;
}
