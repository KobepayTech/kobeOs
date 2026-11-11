import { BadRequestException } from '@nestjs/common';
import { createHash, createPrivateKey, createPublicKey, hkdfSync, sign } from 'crypto';
import { DeveloperAppManifest } from './app-distribution.entity';

export function validatePackage(input: unknown): { manifest: DeveloperAppManifest; html: string } {
  const value = input as { manifest?: Record<string, unknown>; html?: unknown };
  const m = value?.manifest;
  if (!value || !m || typeof value.html !== 'string' || Buffer.byteLength(value.html, 'utf8') > 262144 || !value.html.trim()) throw new BadRequestException('Upload a JSON app package with inline HTML, up to 256 KB.');
  if (Object.keys(value).some(key => !['manifest', 'html'].includes(key)) || Object.keys(m).some(key => !['apiVersion', 'id', 'name', 'description', 'version', 'permissions'].includes(key))) throw new BadRequestException('Unknown package fields.');
  if (m.apiVersion !== 1 || typeof m.id !== 'string' || !/^ext\.[a-z0-9]+(?:[.-][a-z0-9]+)+$/.test(m.id) || m.id.length > 80) throw new BadRequestException('Use API version 1 and a unique app ID starting with ext.');
  if (typeof m.version !== 'string' || !/^(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})$/.test(m.version)) throw new BadRequestException('Use a version such as 1.0.0.');
  if (typeof m.name !== 'string' || !m.name.trim() || m.name.length > 80 || typeof m.description !== 'string' || !m.description.trim() || m.description.length > 280) throw new BadRequestException('An app name and short description are required.');
  if (!Array.isArray(m.permissions) || m.permissions.length > 1 || m.permissions.some(p => p !== 'inventory.read')) throw new BadRequestException('Only inventory.read is supported in this developer preview.');
  return { manifest: { apiVersion: 1, id: m.id, name: m.name.trim(), description: m.description.trim(), version: m.version, permissions: [...m.permissions] as ['inventory.read'] }, html: value.html };
}

export const packagePayload = (manifest: DeveloperAppManifest, html: string) => JSON.stringify({ manifest, html });
export const packageDigest = (payload: string) => createHash('sha256').update(payload).digest('hex');
export function compareVersions(a: string, b: string): number {
  const x = a.split('.').map(Number); const y = b.split('.').map(Number);
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}

export class PackageSigner {
  private readonly key;
  readonly publicKey: string;
  readonly keyId: string;
  constructor(secret: string) {
    if (!secret || secret.length < 32) throw new Error('A strong JWT_SECRET is required for app-package attestation.');
    // A separate, domain-separated signing key; never disclose the account secret
    // or use a third-party app's self-supplied public key as a trust root.
    const seed = Buffer.from(hkdfSync('sha256', secret, 'kobeos-app-distribution', 'ed25519-package-v1', 32));
    this.key = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]), format: 'der', type: 'pkcs8' });
    const pub = createPublicKey(this.key).export({ format: 'der', type: 'spki' }) as Buffer;
    this.publicKey = pub.toString('base64'); this.keyId = createHash('sha256').update(pub).digest('hex');
  }
  attest(payload: string) {
    return { payload, sha256: packageDigest(payload), signature: sign(null, Buffer.from(payload), this.key).toString('base64'), keyId: this.keyId };
  }
}
