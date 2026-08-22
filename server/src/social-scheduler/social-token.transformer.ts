import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import type { ValueTransformer } from 'typeorm';

const PREFIX = 'enc:v1:';

function key(): Buffer {
  const material = (process.env.SOCIAL_TOKEN_ENCRYPTION_KEY || process.env.JWT_SECRET || '').trim();
  if (!material) {
    throw new Error('SOCIAL_TOKEN_ENCRYPTION_KEY or JWT_SECRET is required to protect social OAuth tokens');
  }
  return createHash('sha256').update(material).digest();
}

function encrypt(value: string): string {
  if (!value) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`;
}

function decrypt(value: string): string {
  if (!value || !value.startsWith(PREFIX)) return value; // legacy plaintext rows remain readable until next save
  const raw = value.slice(PREFIX.length);
  const [ivRaw, tagRaw, dataRaw] = raw.split('.');
  if (!ivRaw || !tagRaw || !dataRaw) throw new Error('Invalid encrypted social token');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataRaw, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export const socialTokenTransformer: ValueTransformer = {
  to(value?: string | null): string | null {
    if (!value) return null;
    return encrypt(value);
  },
  from(value?: string | null): string | null {
    if (!value) return null;
    return decrypt(value);
  },
};
