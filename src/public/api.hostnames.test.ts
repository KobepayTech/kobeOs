import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectTenantSubdomain } from './api';

describe('tenant routing on hosted KobeOS', () => {
  afterEach(() => vi.unstubAllGlobals());
  it.each(['kobeos-app.pages.dev', 'review.kobeos-app.pages.dev', 'kobeos-primary-api.example.workers.dev'])('opens the shell on %s', hostname => {
    vi.stubGlobal('window', { location: { hostname } });
    expect(detectTenantSubdomain()).toBeNull();
  });
  it('retains merchant subdomain routing', () => {
    vi.stubGlobal('window', { location: { hostname: 'amina.kobeapptz.com' } });
    expect(detectTenantSubdomain()).toBe('amina');
  });
});
