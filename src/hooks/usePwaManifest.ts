import { useEffect } from 'react';

/**
 * Swap in a route-scoped web-app manifest while a standalone app screen is
 * mounted, so "Install app" adds a home-screen icon that opens *this* app at
 * *this* URL — not the whole OS at '/'. Restores the previous manifest on
 * unmount. Mirrors the pattern in MobileShell, extracted for reuse.
 */
export function usePwaManifest(opts: {
  name: string;
  shortName: string;
  startUrl: string;
  themeColor?: string;
  backgroundColor?: string;
  /** Icon file base paths (without size/ext), e.g. '/ctz-warehouse'. Each
   *  resolves to `${base}-192.png` and `${base}-512.png`. Defaults to the
   *  generic KobeOS icons. */
  iconBase?: string;
  /** When false the hook is inert (e.g. running inside the OS shell, where
   *  we must not clobber the OS's own manifest). Defaults to true. */
  enabled?: boolean;
}) {
  const { name, shortName, startUrl, themeColor = '#059669', backgroundColor = '#f8fafc', iconBase, enabled = true } = opts;
  useEffect(() => {
    if (!enabled) return;
    const manifest = {
      name,
      short_name: shortName,
      start_url: startUrl,
      scope: startUrl,
      display: 'standalone',
      theme_color: themeColor,
      background_color: backgroundColor,
      icons: iconBase
        ? [
            { src: `${iconBase}-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
            { src: `${iconBase}-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          ]
        : [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          ],
    };
    const href = `data:application/manifest+json,${encodeURIComponent(JSON.stringify(manifest))}`;
    let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    const prev = link?.getAttribute('href') ?? null;
    if (!link) { link = document.createElement('link'); link.rel = 'manifest'; document.head.appendChild(link); }
    link.setAttribute('href', href);
    const prevTheme = document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor);
    return () => {
      if (prev) link!.setAttribute('href', prev);
      if (prevTheme) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', prevTheme);
    };
  }, [name, shortName, startUrl, themeColor, backgroundColor, iconBase, enabled]);
}
