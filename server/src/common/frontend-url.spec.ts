import { resolveFrontendUrl, resolvePublicApiUrl } from './frontend-url';

/** A lookup backed by a plain object, the way process.env behaves. */
const env = (values: Record<string, unknown>) => (key: string) => values[key];

describe('resolving public URLs', () => {
  describe('typed config values', () => {
    it('survives a non-string value from ConfigService', () => {
      // Nest's ConfigService returns whatever the validated schema produced —
      // PORT comes back as a number. Reading .trim() off that threw
      // "get(...)?.trim is not a function" and 500'd the WhatsApp settings
      // endpoint in CI.
      expect(() => resolvePublicApiUrl(env({ PORT: 3000 }))).not.toThrow();
      expect(resolvePublicApiUrl(env({ PORT: 3000 }))).toBe('http://localhost:3000/');
    });

    it('survives null and undefined without falling over', () => {
      expect(resolvePublicApiUrl(env({ APP_PUBLIC_URL: null, PORT: undefined })))
        .toBe('http://localhost:3000/');
      expect(() => resolveFrontendUrl(env({ CORS_ORIGIN: null }))).not.toThrow();
    });

    it('ignores a value that is only whitespace', () => {
      expect(resolvePublicApiUrl(env({ APP_PUBLIC_URL: '   ', PORT: 8080 })))
        .toBe('http://localhost:8080/');
    });
  });

  describe('public API URL', () => {
    it('prefers an explicit public URL', () => {
      expect(resolvePublicApiUrl(env({ APP_PUBLIC_URL: 'https://api.example.com' })))
        .toBe('https://api.example.com/');
    });

    it('trims a trailing slash rather than doubling it', () => {
      expect(resolvePublicApiUrl(env({ APP_PUBLIC_URL: 'https://api.example.com///' })))
        .toBe('https://api.example.com/');
    });

    it('derives api.<tenant domain> when only the tenant domain is set', () => {
      expect(resolvePublicApiUrl(env({ TENANT_BASE_DOMAIN: '.kobeapptz.com' })))
        .toBe('https://api.kobeapptz.com/');
    });
  });

  describe('frontend URL', () => {
    it('prefers an explicit frontend URL over everything else', () => {
      expect(resolveFrontendUrl(env({
        APP_FRONTEND_URL: 'https://app.example.com',
        APP_PUBLIC_URL: 'https://api.example.com',
      }))).toBe('https://app.example.com/');
    });

    it('picks the CORS origin on the tenant domain, not merely the first', () => {
      expect(resolveFrontendUrl(env({
        TENANT_BASE_DOMAIN: 'kobeapptz.com',
        CORS_ORIGIN: 'https://preview.pages.dev,https://shop.kobeapptz.com',
      }))).toBe('https://shop.kobeapptz.com/');
    });

    it('only falls back to localhost when nothing production-shaped is set', () => {
      expect(resolveFrontendUrl(env({}))).toBe('http://localhost:5173/');
    });
  });
});
