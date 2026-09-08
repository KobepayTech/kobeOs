import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it } from 'vitest';

const html = readFileSync('index.html', 'utf8');
const bootstrap = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];

describe('hosted callback asset resolution', () => {
  afterEach(() => {
    document.querySelectorAll('base').forEach(base => base.remove());
    window.history.replaceState(null, '', '/');
  });

  it.each(['/oauth/meta', '/oauth/tiktok'])('loads root assets on %s before the app starts', path => {
    window.history.replaceState(null, '', path);
    expect(bootstrap).toBeTruthy();
    runInNewContext(bootstrap!, { window, document });
    expect(new URL('./assets/app.js', document.baseURI).pathname).toBe('/assets/app.js');
    expect(new URL('./manifest.webmanifest', document.baseURI).pathname).toBe('/manifest.webmanifest');
    expect(html.indexOf('<script>')).toBeLessThan(html.indexOf('type="module"'));
  });

  it('preserves relative asset resolution for packaged Electron', () => {
    runInNewContext(bootstrap!, { window: { location: { protocol: 'file:' } }, document });
    expect(document.querySelector('base')).toBeNull();
  });
});
