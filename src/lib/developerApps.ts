import { api } from './api';
export interface DeveloperManifest { apiVersion: 1; id: string; name: string; description: string; version: string; permissions: Array<'inventory.read'> }
export interface DeveloperPackage { manifest: DeveloperManifest; html: string }
export interface DeveloperRelease { id: string; manifest: DeveloperManifest; publisherId: string; status: 'pending' | 'approved' | 'rejected' | 'revoked'; reviewNote: string; digest: string }
export interface DeveloperInstall { appId: string; releaseId: string; grants: string[]; release: DeveloperRelease | null }
interface SignedPackage { payload: string; signature: string; sha256: string; keyId: string }
interface TrustKey { keyId: string; publicKey: string }
export const developerApi = <T,>(path: string, method = 'GET', body?: unknown) => api<T>(`/app-distribution${path}`, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }), offlineFallback: false });
function bytes(base64: string): Uint8Array<ArrayBuffer> { return Uint8Array.from(atob(base64), c => c.charCodeAt(0)); }
export async function verifyDeveloperPackage(signed: SignedPackage, trust: TrustKey, expectedId: string): Promise<DeveloperPackage> {
  if (signed.keyId !== trust.keyId || !signed.payload || signed.payload.length > 1100000) throw new Error('The app’s publisher signature could not be verified.');
  const content = new TextEncoder().encode(signed.payload);
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', content))].map(v => v.toString(16).padStart(2, '0')).join('');
  if (digest !== signed.sha256) throw new Error('The app package was changed after review.');
  const key = await crypto.subtle.importKey('spki', bytes(trust.publicKey), { name: 'Ed25519' }, false, ['verify']);
  if (!await crypto.subtle.verify('Ed25519', key, bytes(signed.signature), content)) throw new Error('The app signature is invalid.');
  const value = JSON.parse(signed.payload) as DeveloperPackage;
  if (value.manifest?.id !== expectedId || value.manifest.apiVersion !== 1 || typeof value.html !== 'string' || !Array.isArray(value.manifest.permissions) || value.manifest.permissions.some(p => p !== 'inventory.read')) throw new Error('This app package is incompatible with KobeOS.');
  return value;
}
export async function loadDeveloperPackage(path: string, expectedId: string) {
  const [signed, trust] = await Promise.all([developerApi<SignedPackage>(path), developerApi<TrustKey>('/trust-key')]);
  return verifyDeveloperPackage(signed, trust, expectedId);
}
