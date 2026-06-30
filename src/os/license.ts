/**
 * Offline-safe license token utilities.
 *
 * The backend issues a signed license token (base64url JSON + HMAC-SHA256
 * signature) when a payment is confirmed. The token is stored in localStorage
 * and verified client-side using a shared HMAC secret baked into the build.
 * This allows the OS to enforce subscription gates for a full month without
 * any network access.
 *
 * Token format (dot-separated, base64url encoded):
 *   <payload_b64>.<signature_b64>
 *
 * Payload shape: LicensePayload (see below)
 */

import type { SubscriptionTier } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LicensePayload {
  userId: string;
  /** Effective subscription plan */
  plan: Exclude<SubscriptionTier, 'free'>;
  issuedAt: number;   // Unix ms
  expiresAt: number;  // Unix ms
}

export interface LicenseToken {
  raw: string;        // the full "<payload_b64>.<sig_b64>" string
  payload: LicensePayload;
}

export type LicenseStatus =
  | 'valid'
  | 'expired'
  | 'invalid'   // bad signature or malformed
  | 'none';     // no token stored

// ---------------------------------------------------------------------------
// HMAC secret — baked in at build time via Vite define / env var.
// Must match LICENSE_HMAC_SECRET on the backend.
// ---------------------------------------------------------------------------

function getHmacSecret(): string {
  // Prefer explicit env var; fall back to a build-time constant injected by
  // vite.config.ts `define` block so the bundle works offline.
  return (
    (import.meta.env.VITE_LICENSE_HMAC_SECRET as string | undefined) ??
    (typeof __LICENSE_HMAC_SECRET__ !== 'undefined' ? __LICENSE_HMAC_SECRET__ : '')
  );
}

// ---------------------------------------------------------------------------
// Web Crypto helpers
// ---------------------------------------------------------------------------

function b64urlEncode(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function b64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function importKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'kobe_license_token';

/**
 * Verify a raw token string against the baked-in HMAC secret.
 * Returns the parsed payload on success, null on failure.
 */
export async function verifyToken(raw: string): Promise<LicensePayload | null> {
  try {
    const dot = raw.lastIndexOf('.');
    if (dot === -1) return null;

    const payloadB64 = raw.slice(0, dot);
    const sigB64 = raw.slice(dot + 1);

    const secret = getHmacSecret();
    if (!secret) {
      // No secret configured — accept token in dev mode only
      if (import.meta.env.DEV) {
        const json = new TextDecoder().decode(b64urlDecode(payloadB64));
        return JSON.parse(json) as LicensePayload;
      }
      return null;
    }

    const key = await importKey(secret);
    const enc = new TextEncoder();
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      b64urlDecode(sigB64).buffer as ArrayBuffer,
      enc.encode(payloadB64).buffer as ArrayBuffer,
    );
    if (!valid) return null;

    const json = new TextDecoder().decode(b64urlDecode(payloadB64));
    return JSON.parse(json) as LicensePayload;
  } catch {
    return null;
  }
}

/**
 * Sign a payload with the HMAC secret (used in tests / dev tooling only —
 * production tokens are issued by the backend).
 */
export async function signToken(payload: LicensePayload): Promise<string> {
  const secret = getHmacSecret();
  if (!secret) throw new Error('LICENSE_HMAC_SECRET not configured');

  const payloadB64 = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)).buffer as ArrayBuffer);
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
  return `${payloadB64}.${b64urlEncode(sig)}`;
}

/** Persist a raw license token to localStorage. */
export function storeLicenseToken(raw: string): void {
  localStorage.setItem(STORAGE_KEY, raw);
}

/** Remove the stored license token (on logout / expiry). */
export function clearLicenseToken(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Read the raw token from localStorage without verifying it. */
export function readRawToken(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

/**
 * Load, verify, and return the current license status + payload.
 * This is the main entry point called on OS boot and periodically.
 */
export async function loadLicense(): Promise<{ status: LicenseStatus; payload: LicensePayload | null }> {
  const raw = readRawToken();
  if (!raw) return { status: 'none', payload: null };

  const payload = await verifyToken(raw);
  if (!payload) return { status: 'invalid', payload: null };

  if (Date.now() >= payload.expiresAt) return { status: 'expired', payload };

  return { status: 'valid', payload };
}

/**
 * Check whether a given subscription tier is satisfied by the current plan.
 *
 * Tier hierarchy: free < trial < pro
 */
export function tierSatisfied(
  required: SubscriptionTier,
  plan: Exclude<SubscriptionTier, 'free'> | null,
): boolean {
  if (required === 'free') return true;
  if (!plan) return false;
  if (required === 'trial') return plan === 'trial' || plan === 'pro';
  if (required === 'pro') return plan === 'pro';
  return false;
}
