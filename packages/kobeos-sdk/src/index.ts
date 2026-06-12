/**
 * @kobeos/sdk — public surface for third-party apps that run inside KobeOS.
 *
 * KobeOS apps are React components packaged with a manifest. The host loads
 * them into a window (managed by the OS shell), feeds them an SDK context,
 * and gates them on subscription tier. This SDK exposes:
 *
 *   • `defineApp(...)`        — type-safe manifest builder
 *   • `useKobeOS()`           — runtime context (current user, token, theme)
 *   • `useKobeApi<T>(path)`   — JWT-aware fetch hook that auto-renews tokens
 *   • `subscribeEvents(...)`  — listen for OS-level events (theme, locale)
 *   • Permission + tier types — match what the host enforces
 *
 * Everything here is host-agnostic — the implementations are injected by
 * the OS at runtime via `window.kobeos`. In dev you can stub them.
 */

import type { ComponentType, LazyExoticComponent } from 'react';
import { useEffect, useRef, useState } from 'react';

/* ──────────────────────────────────────────────────────────────────────────
 * Manifest types
 * ────────────────────────────────────────────────────────────────────── */

export type AppCategory =
  | 'system'
  | 'productivity'
  | 'media'
  | 'development'
  | 'erp'
  | 'games'
  | 'communication'
  | 'sports';

export type SubscriptionTier = 'free' | 'trial' | 'pro';

export type AppPermission =
  | 'fs.read'        // read files from the user's KobeOS file space
  | 'fs.write'       // write into the user's KobeOS file space
  | 'net.fetch'      // make outbound HTTP requests
  | 'kobepay.read'   // read wallet balance / customers
  | 'kobepay.write'  // initiate transactions
  | 'storefront'     // act on the operator's storefront
  | 'cargo'          // read/write cargo shipments
  | 'hotel'          // read/write hotel rooms + bookings
  | 'ai.chat'        // call the local Ollama bridge
  | 'ai.speech'      // call Whisper / Piper
  | 'media.camera'   // capture from webcam
  | 'media.mic';     // capture from microphone

/**
 * Manifest a developer ships with their app. The host loads this, gates
 * on subscription tier + permissions, then mounts `component` into a
 * KobeOS window.
 */
export interface AppManifest {
  /** Globally unique, dash-cased, e.g. `acme-invoicing`. */
  id: string;
  name: string;
  description: string;
  /** Lucide icon name (e.g. `Wallet`, `Building2`, `Plane`). */
  icon: string;
  category: AppCategory;
  /** SemVer. */
  version: string;
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  /** When true, only one window of this app may be open at a time. */
  singleton: boolean;
  /** When true the OS prompts for sign-in before launching. */
  requiresAuth: boolean;
  /** Coarse-grained permissions the user grants on install. */
  permissions: AppPermission[];
  /** Minimum subscription tier required to launch (default 'free'). */
  subscriptionTier?: SubscriptionTier;
  /** Author + contact for the app store listing. */
  publisher?: {
    name: string;
    url?: string;
    email?: string;
  };
  /** The lazy-loaded React component. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: LazyExoticComponent<ComponentType<any>>;
}

/** Tiny convenience wrapper that gives developers a typed builder. */
export function defineApp(manifest: AppManifest): AppManifest {
  return manifest;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Runtime context — injected by the host
 * ────────────────────────────────────────────────────────────────────── */

export interface KobeOSUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
}

export interface KobeOSContext {
  /** Currently-signed-in operator. Null while booting / signed out. */
  user: KobeOSUser | null;
  /** OS theme ('dark' | 'light'). React to changes via subscribeEvents('theme'). */
  theme: 'dark' | 'light';
  /** BCP-47 locale tag, e.g. 'en-TZ', 'sw'. */
  locale: string;
  /** Subscription plan currently active for the user. */
  plan: 'free' | 'trial' | 'pro';
  /** ISO-string when the plan expires (null on free tier). */
  planExpiresAt: string | null;
  /** API base URL — third-party apps should prefer apiFetch() over hard-coding. */
  apiBase: string;
  /** Issued JWT — auto-attached by apiFetch(). Don't store it yourself. */
  token: string | null;
}

declare global {
  interface Window {
    kobeos?: {
      context: () => KobeOSContext;
      apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
      subscribe: (
        event: 'theme' | 'locale' | 'user' | 'plan',
        cb: (next: unknown) => void,
      ) => () => void;
      launchApp?: (id: string, data?: Record<string, unknown>) => void;
      notify?: (title: string, body: string, kind?: 'info' | 'success' | 'warning' | 'error') => void;
    };
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Hooks
 * ────────────────────────────────────────────────────────────────────── */

/**
 * Returns the live KobeOS context. Re-renders the calling component
 * whenever the user, theme, locale, or plan changes.
 */
export function useKobeOS(): KobeOSContext {
  const [ctx, setCtx] = useState<KobeOSContext>(() => getContextOrStub());
  useEffect(() => {
    if (!window.kobeos) return;
    const offs = (['theme', 'locale', 'user', 'plan'] as const).map((evt) =>
      window.kobeos!.subscribe(evt, () => setCtx(window.kobeos!.context())),
    );
    return () => { offs.forEach((off) => off()); };
  }, []);
  return ctx;
}

/**
 * Permission-aware data hook. Wraps the OS's apiFetch (which adds the
 * current JWT and handles 401 → refresh transparently) into a small
 * SWR-style result. No external deps.
 */
export function useKobeApi<T>(path: string | null, init?: RequestInit): {
  data: T | null;
  error: Error | null;
  loading: boolean;
  refetch: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(path));
  const [tick, setTick] = useState(0);
  const initRef = useRef(init);
  initRef.current = init;

  useEffect(() => {
    if (!path) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const fetcher = window.kobeos?.apiFetch ?? fetch;
        const res = await fetcher(path, initRef.current);
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const body = await res.json() as T;
        if (!cancelled) { setData(body); setError(null); }
      } catch (e) {
        if (!cancelled) setError(e as Error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [path, tick]);

  return { data, error, loading, refetch: () => setTick((t) => t + 1) };
}

/**
 * Imperative apiFetch — same as window.kobeos.apiFetch but works in
 * standalone dev mode (falls back to plain fetch).
 */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return (window.kobeos?.apiFetch ?? fetch)(path, init);
}

/**
 * Show a desktop notification through the host. No-ops in standalone dev.
 */
export function notify(title: string, body: string, kind?: 'info' | 'success' | 'warning' | 'error') {
  window.kobeos?.notify?.(title, body, kind);
}

/**
 * Launch another KobeOS app, optionally passing data (deep-link style).
 * Returns false if the host is unavailable (e.g. running outside KobeOS).
 */
export function launchApp(appId: string, data?: Record<string, unknown>): boolean {
  if (!window.kobeos?.launchApp) return false;
  window.kobeos.launchApp(appId, data);
  return true;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Stub for dev — pretend the OS exists when running standalone via Vite.
 * The real host (KobeOS shell) overwrites these methods on first mount.
 * ────────────────────────────────────────────────────────────────────── */
function getContextOrStub(): KobeOSContext {
  if (window.kobeos?.context) return window.kobeos.context();
  return {
    user: null,
    theme: 'dark',
    locale: 'en-TZ',
    plan: 'free',
    planExpiresAt: null,
    apiBase: '/api',
    token: null,
  };
}
