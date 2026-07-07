import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Serve the cached app shell for any navigation when the network/site is
        // unreachable (e.g. the store's tunnel is down), instead of failing with
        // "Failed to fetch https://<slug>.kobeapptz.com/". API calls are excluded
        // so they still hit the network (and fall back via the app's offline queue).
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [{ urlPattern: /^https:\/\/api\./, handler: 'NetworkFirst', options: { cacheName: 'api-cache' } }]
      },
      manifest: {
        name: 'KobeOS — Business OS',
        short_name: 'KobeOS',
        description: 'ERP, POS, cargo, hotel and payments in one installable app.',
        theme_color: '#1a1a2e',
        background_color: '#0a0a1a',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        shortcuts: [
          { name: 'POS',        url: '/?app=erp-pos',     description: 'Open the cashier POS' },
          { name: 'Storefront', url: '/?app=erp-shop',    description: 'Open the public shop' },
          { name: 'Cargo',      url: '/?app=cargo',       description: 'Open KobeCargo' },
        ],
      }
    })
  ],
  base: './',
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  // Bake production defaults into every build so end-user machines need
  // zero configuration. Override via env vars for white-label deployments.
  define: {
    __REGISTRY_URL__:        JSON.stringify('https://kobeos-registry.onrender.com'),
    __REGISTRY_DOMAIN__:     JSON.stringify('kobeapptz.com'),
    // Fallback HMAC secret used when VITE_LICENSE_HMAC_SECRET is not set.
    // Override in production via the env var to rotate without a rebuild.
    __LICENSE_HMAC_SECRET__: JSON.stringify(
      process.env.VITE_LICENSE_HMAC_SECRET ?? 'kobe-license-secret-change-in-prod',
    ),
  },
  // live-build/ contains a chroot with self-referential symlinks (e.g.
  // usr/bin/X11/X11/...) that crash chokidar with ELOOP if scanned.
  // release/ holds packaged Electron output, also outside the source set.
  server: { watch: { ignored: ['**/live-build/**', '**/release/**', '**/dist/**', '**/node_modules/**'] } },
  // Restrict the dep scanner to the actual source set so it doesn't crawl
  // live-build/ or release/ and trip over self-referential symlinks.
  optimizeDeps: { entries: ['index.html', 'src/**/*.{ts,tsx}'] },
  build: { outDir: 'dist', assetsDir: 'assets', emptyOutDir: true, rollupOptions: { output: { manualChunks: undefined } } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Exclude Playwright specs, the server directory (NestJS has its own
    // Jest runner; pulling server/node_modules into Vitest causes failures),
    // the live-build chroot (vendors a full node_modules copy whose internal
    // *.test.js files would otherwise get discovered), and dist/ output.
    exclude: ['tests/**', 'node_modules/**', 'server/**', 'live-build/**', 'dist/**', 'release/**', 'electron/**'],
  },
});
