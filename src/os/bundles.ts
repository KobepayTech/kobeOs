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

export type ProductModuleId =
  | 'kobe-commerce' | 'kobe-accountant' | 'kobe-connect' | 'kobe-office'
  | 'kobe-hotel' | 'kobe-property' | 'kobe-cargo' | 'kobe-pay'
  | 'kobe-creators' | 'kobe-studio' | 'kobe-live-sales' | 'kobe-media'
  | 'kobe-sports' | 'kobe-transit' | 'kobe-developer' | 'kobe-games';

export const PRODUCT_MODULES: Record<ProductModuleId, string> = {
  'kobe-commerce': 'Kobe Commerce',
  'kobe-accountant': 'Kobe Accountant',
  'kobe-connect': 'Kobe Connect',
  'kobe-office': 'Kobe Office',
  'kobe-hotel': 'Kobe Hotels',
  'kobe-property': 'Kobe Property',
  'kobe-cargo': 'Kobe Cargo',
  'kobe-pay': 'KobePay',
  'kobe-creators': 'Kobe Creators',
  'kobe-studio': 'Kobe Studio',
  'kobe-live-sales': 'Kobe Live Sales',
  'kobe-media': 'Kobe Media',
  'kobe-sports': 'Kobe Sports',
  'kobe-transit': 'Kobe Transit',
  'kobe-developer': 'Kobe Developer',
  'kobe-games': 'Kobe Games',
};

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

/**
 * Platform services, included in every workspace.
 *
 * These are not sold, cannot be uninstalled, and must never depend on a
 * bundle: a workspace without a file manager or settings is not a cheaper
 * workspace, it is a broken one.
 */
export const SHARED_CORE_APPS: readonly string[] = [
  'file-manager', 'terminal', 'settings', 'system-settings', 'task-manager',
  'package-manager', 'app-store', 'backup-restore', 'password-manager',
  'browser', 'kobe-models', 'kobe-assistant', 'kobe-agents',
];

/**
 * Operator consoles. Deliberately outside every bundle — they are KobeTech's
 * own tools, and they keep their existing role checks regardless of what a
 * customer has installed. Selling a bundle must never be a route to them.
 */
export const OPERATOR_APPS: readonly string[] = ['kobetech-admin', 'kobetech-devops'];

/** Which product module grants each app. Apps not listed here are not sold. */
export const APP_MODULE: Record<string, ProductModuleId> = {
  // Kobe Office
  calculator: 'kobe-office', 'text-editor': 'kobe-office', notepad: 'kobe-office',
  calendar: 'kobe-office', clock: 'kobe-office', tasks: 'kobe-office',
  notes: 'kobe-office', spreadsheet: 'kobe-office', presentation: 'kobe-office',
  draw: 'kobe-office', kanban: 'kobe-office',

  // Kobe Media
  'media-player': 'kobe-media', 'image-viewer': 'kobe-media',
  'music-studio': 'kobe-media', camera: 'kobe-media', 'screen-recorder': 'kobe-media',

  // Kobe Connect
  email: 'kobe-connect', chat: 'kobe-connect', contacts: 'kobe-connect',
  'video-conference': 'kobe-connect',

  // Kobe Developer
  'code-ide': 'kobe-developer', 'database-manager': 'kobe-developer',
  'api-tester': 'kobe-developer', 'git-client': 'kobe-developer',
  'regex-tester': 'kobe-developer', 'json-formatter': 'kobe-developer',
  'color-picker': 'kobe-developer', 'markdown-preview': 'kobe-developer',

  // Kobe Games
  snake: 'kobe-games', tetris: 'kobe-games', chess: 'kobe-games', solitaire: 'kobe-games',

  // Kobe Commerce
  'erp-dashboard': 'kobe-commerce', 'erp-pos': 'kobe-commerce',
  'erp-messaging': 'kobe-commerce', 'erp-store': 'kobe-commerce',
  'erp-warehouse': 'kobe-commerce', 'erp-warehouse-ops': 'kobe-commerce',
  'erp-kobepay-inbox': 'kobe-commerce', 'erp-reports': 'kobe-commerce',
  'erp-summary': 'kobe-commerce', 'erp-eod': 'kobe-commerce',
  'erp-admin': 'kobe-commerce', 'erp-sourcing': 'kobe-commerce',
  'erp-shipments': 'kobe-commerce', 'erp-loyalty': 'kobe-commerce',
  'erp-rider': 'kobe-commerce', posys: 'kobe-commerce',
  'erp-credit': 'kobe-commerce', 'erp-discounts': 'kobe-commerce',
  'erp-shop': 'kobe-commerce', 'erp-store-editor': 'kobe-commerce',
  'kobe-commerce': 'kobe-commerce',

  // Kobe Accountant
  'erp-accounting': 'kobe-accountant', 'kobe-accountant': 'kobe-accountant',

  // Kobe Property
  property: 'kobe-property', 'property-payments': 'kobe-property',

  // Kobe Studio
  'media-inbox': 'kobe-studio', 'kobe-print': 'kobe-studio', 'kobe-studio': 'kobe-studio',

  // Kobe Cargo
  cargo: 'kobe-cargo', 'cargo-welcome': 'kobe-cargo', 'cargo-sender': 'kobe-cargo',
  'cargo-owner': 'kobe-cargo', 'cargo-driver': 'kobe-cargo',
  'cargo-receiver': 'kobe-cargo', 'cargo-company': 'kobe-cargo',
  'cargo-consolidation': 'kobe-cargo', 'cargo-tz': 'kobe-cargo',
  'cargo-tz-ops': 'kobe-cargo',

  // Remaining single-app modules
  creator: 'kobe-creators',
  'kobe-sports': 'kobe-sports', 'kobe-coach': 'kobe-sports',
  'kobe-hotel': 'kobe-hotel',
  'kobe-pay': 'kobe-pay', 'china-cashier': 'kobe-pay', 'kobepay-pro': 'kobe-pay',
  'live-sales': 'kobe-live-sales',
  'kobe-transit': 'kobe-transit',
};

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
  return (Object.keys(PRODUCT_MODULES) as ProductModuleId[]).filter((id) => seen.has(id));
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
