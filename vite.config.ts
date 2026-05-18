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
        runtimeCaching: [{ urlPattern: /^https:\/\/api\./, handler: 'NetworkFirst', options: { cacheName: 'api-cache' } }]
      },
      manifest: { name: 'KobeOS', short_name: 'KobeOS', theme_color: '#1a1a2e', icons: [{ src: '/icon.png', sizes: '192x192', type: 'image/png' }] }
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
  build: { outDir: 'dist', assetsDir: 'assets', emptyOutDir: true, rollupOptions: { output: { manualChunks: undefined } } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
