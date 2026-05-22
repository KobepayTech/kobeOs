/**
 * apps/store — KobeOS App Store
 *
 * The KobeOS app store is manifest-driven. Each app in src/apps/ has a
 * manifest.ts that declares its id, name, icon, category, and component.
 * The store reads the OS registry and presents apps for launch/install.
 *
 * Source: src/apps/erp-store/index.tsx  (product/inventory store)
 *         src/os/registry.ts            (app registry)
 *
 * This module re-exports the store app component and its manifest.
 */

// Re-export the store app for use in the OS registry
export { default } from '../../src/apps/erp-store/index';
