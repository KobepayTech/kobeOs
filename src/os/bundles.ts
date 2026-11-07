/**
 * Workspace bundles.
 *
 * KobeOS ships 94 registered apps. Asking a shop owner to pick the fifteen
 * that make a till work is not onboarding, it is a quiz. A bundle is the
 * answer to "what kind of business is this", and it expands into product
 * modules, which expand into apps.
 *
 * Three levels, because they answer different questions:
 *
 *   bundle          what the customer chooses      "Hotels & Hospitality"
 *   product module  what is licensed and billed    kobe-hotel
 *   app             what appears in the launcher   kobe-hotel, erp-pos, …
 *
 * Entitlements are held per product module, never per app. The launcher
 * expands them on every render, so a reload or a rehydrated store cannot
 * leave a paid-for app missing — which is exactly what happened when child
 * apps were tracked separately from the module that granted them.
 */

import { PLATFORM_SERVICE_APP_IDS, storeModules } from './store-modules';

/**
 * The sixteen product modules, as src/os/store-modules.ts already defines
 * them. That file is the source of truth for which apps a module contains —
 * restating the mapping here produced two catalogues that disagreed about one
 * app, which is how a module gets sold and a different set installed.
 */
export const PRODUCT_MODULE_IDS = storeModules.map((module) => module.id);

export type ProductModuleId = string;

export const PRODUCT_MODULES: Record<string, string> = Object.fromEntries(
  storeModules.map((module) => [module.id, module.name]),
);

/** Which product module grants each app, derived from the module definitions. */
export const APP_MODULE: Record<string, ProductModuleId> = Object.fromEntries(
  storeModules.flatMap((module) => module.appIds.map((appId) => [appId, module.id])),
);

/**
 * Operator consoles. Called out separately from the platform services because
 * they are not the same thing: a file manager belongs in every workspace,
 * while these are KobeTech's own tools and keep their role checks. Selling a
 * bundle must never be a route into them.
 */
export const OPERATOR_APPS: readonly string[] = ['kobetech-admin', 'kobetech-devops'];

/**
 * Platform services, included in every workspace and not sold. Taken from the
 * existing set, minus the operator consoles it groups together with them.
 */
export const SHARED_CORE_APPS: readonly string[] = [...PLATFORM_SERVICE_APP_IDS]
  .filter((appId) => !OPERATOR_APPS.includes(appId));



export interface Bundle {
  id: string;
  name: string;
  description: string;
  modules: ProductModuleId[];
}

/**
 * The fourteen workspaces a customer can choose from.
 *
 * Modules repeat across bundles on purpose — nearly every business needs
 * accounting and messaging — which is why installation deduplicates rather
 * than installing Kobe Accountant eleven times.
 */
export const BUNDLES: Bundle[] = [
  {
    id: 'retail',
    name: 'Retail & Wholesale',
    description: 'Shop floor, stock, customers and the books.',
    modules: ['kobe-commerce', 'kobe-accountant', 'kobe-connect'],
  },
  {
    id: 'automotive',
    name: 'Automotive & Dealerships',
    description: 'Vehicle inventory and sales, on the Cars workspace inside Kobe Commerce.',
    modules: ['kobe-commerce', 'kobe-accountant', 'kobe-connect', 'kobe-office'],
  },
  {
    id: 'hospitality',
    name: 'Hotels & Hospitality',
    description: 'Front desk, rooms and guest billing, with a shop for extras.',
    modules: ['kobe-hotel', 'kobe-commerce', 'kobe-accountant', 'kobe-connect'],
  },
  {
    id: 'restaurants',
    name: 'Restaurants & Food Service',
    description: 'Food service through the hotel tools, with a till and stock.',
    modules: ['kobe-hotel', 'kobe-commerce', 'kobe-accountant', 'kobe-connect'],
  },
  {
    id: 'property',
    name: 'Property & Rentals',
    description: 'Units, tenants, rent collection and the books.',
    modules: ['kobe-property', 'kobe-accountant', 'kobe-connect', 'kobe-office'],
  },
  {
    id: 'logistics',
    name: 'Cargo & Logistics',
    description: 'Shipments, consolidation, drivers and payments.',
    modules: ['kobe-cargo', 'kobe-pay', 'kobe-accountant', 'kobe-connect'],
  },
  {
    id: 'finance',
    name: 'Finance & Payments',
    description: 'Wallets, transfers, FX and reconciliation.',
    modules: ['kobe-pay', 'kobe-accountant', 'kobe-connect', 'kobe-office'],
  },
  {
    id: 'creators',
    name: 'Creators & Social Selling',
    description: 'Live selling, content production and a storefront behind it.',
    modules: [
      'kobe-creators', 'kobe-studio', 'kobe-live-sales', 'kobe-media',
      'kobe-commerce', 'kobe-accountant', 'kobe-connect',
    ],
  },
  {
    id: 'sports',
    name: 'Sports & Teams',
    description: 'Squads, coaching and match media.',
    modules: [
      'kobe-sports', 'kobe-studio', 'kobe-media', 'kobe-office',
      'kobe-accountant', 'kobe-connect',
    ],
  },
  {
    id: 'transit',
    name: 'Transit & Stations',
    description: 'Routes, ticketing and fare settlement.',
    modules: ['kobe-transit', 'kobe-pay', 'kobe-accountant', 'kobe-connect'],
  },
  {
    id: 'office',
    name: 'Office & Services',
    description: 'Documents, scheduling and the books, without a shop floor.',
    modules: ['kobe-office', 'kobe-accountant', 'kobe-connect'],
  },
  {
    id: 'developer',
    name: 'Developer Workspace',
    description: 'Editor, database tools and API testing.',
    modules: ['kobe-developer', 'kobe-office', 'kobe-connect'],
  },
  {
    id: 'media',
    name: 'Media & Production',
    description: 'Capture, editing and publishing.',
    modules: ['kobe-media', 'kobe-studio', 'kobe-office'],
  },
  {
    id: 'games',
    name: 'Games & Recreation',
    description: 'The bundled games, for a break.',
    modules: ['kobe-games'],
  },
];

export type AppClassification = 'shared-core' | 'module' | 'operator';

export function classifyApp(appId: string): AppClassification | 'unassigned' {
  if (SHARED_CORE_APPS.includes(appId)) return 'shared-core';
  if (OPERATOR_APPS.includes(appId)) return 'operator';
  if (APP_MODULE[appId]) return 'module';
  return 'unassigned';
}

export function bundleById(bundleId: string): Bundle | undefined {
  return BUNDLES.find((bundle) => bundle.id === bundleId);
}

/**
 * The modules a selection of bundles needs, each once.
 *
 * Deduplication is the point: choosing Retail and Hospitality together asks
 * for Kobe Accountant twice, and installing it twice would either double-bill
 * or fail on the second attempt.
 */
export function modulesForBundles(bundleIds: readonly string[]): ProductModuleId[] {
  const seen = new Set<ProductModuleId>();
  for (const id of bundleIds) {
    for (const moduleId of bundleById(id)?.modules ?? []) seen.add(moduleId);
  }
  // Catalogue order, so two equivalent selections install in the same sequence
  // and a half-finished install is reproducible.
  return PRODUCT_MODULE_IDS.filter((id) => seen.has(id));
}

/** The apps a set of modules grants, in registry order. */
export function appIdsForModules(moduleIds: readonly ProductModuleId[]): string[] {
  const wanted = new Set(moduleIds);
  return Object.keys(APP_MODULE).filter((appId) => wanted.has(APP_MODULE[appId]));
}

export function appIdsForBundles(bundleIds: readonly string[]): string[] {
  return appIdsForModules(modulesForBundles(bundleIds));
}

/** Which bundles would grant a given module, for "why do I have this?". */
export function bundlesContainingModule(moduleId: ProductModuleId): Bundle[] {
  return BUNDLES.filter((bundle) => bundle.modules.includes(moduleId));
}

/**
 * Every app the launcher should show for a set of entitled modules.
 *
 * Shared platform services are always included, operator consoles never are,
 * and module apps are expanded from the entitlement itself. Because this is
 * derived rather than stored, a reload or a rehydrated store cannot lose a
 * child app: the entitlement is the only thing that has to survive.
 */
export function launcherAppIds(entitledModules: readonly ProductModuleId[]): string[] {
  return [...SHARED_CORE_APPS, ...appIdsForModules(entitledModules)];
}

/** Whether a module entitlement grants this app. */
export function isAppEntitled(appId: string, entitledModules: readonly ProductModuleId[]): boolean {
  if (SHARED_CORE_APPS.includes(appId)) return true;
  if (OPERATOR_APPS.includes(appId)) return false;
  const moduleId = APP_MODULE[appId];
  return Boolean(moduleId && entitledModules.includes(moduleId));
}
