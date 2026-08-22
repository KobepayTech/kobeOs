import { appCatalogue } from './registry';
import type { AppCategory, AppManifest } from './types';

export interface StoreModule {
  id: string;
  name: string;
  description: string;
  category: AppCategory;
  primaryAppId: string;
  appIds: string[];
  features: string[];
  version: string;
}

/**
 * The App Store sells business modules, not every internal screen/package.
 * Internal app ids stay intact for the window manager and backwards
 * compatibility, but one entitlement owns all apps in a module.
 */
const MODULE_DEFINITIONS: Array<Omit<StoreModule, 'version'>> = [
  {
    id: 'kobe-commerce',
    name: 'Kobe Commerce',
    description: 'POS, inventory, orders, warehouse, sourcing, discounts, storefront and commerce operations.',
    category: 'erp',
    primaryAppId: 'kobe-commerce',
    appIds: [
      'kobe-commerce', 'erp-dashboard', 'erp-pos', 'erp-messaging', 'erp-store',
      'erp-warehouse', 'erp-warehouse-ops', 'erp-kobepay-inbox', 'erp-reports',
      'erp-summary', 'erp-eod', 'erp-admin', 'erp-sourcing', 'erp-shipments',
      'erp-loyalty', 'erp-rider', 'erp-credit', 'erp-discounts', 'erp-shop',
      'erp-store-editor', 'posys',
    ],
    features: ['POS', 'Inventory', 'Orders', 'Warehouse', 'Sourcing', 'Discounts', 'Storefront'],
  },
  {
    id: 'kobe-accountant',
    name: 'Kobe Accountant',
    description: 'Automated accounting, books, statements, expense capture and business financial intelligence.',
    category: 'erp',
    primaryAppId: 'kobe-accountant',
    appIds: ['kobe-accountant', 'erp-accounting'],
    features: ['Automated books', 'Expenses', 'Statements', 'Daily close', 'AI accountant'],
  },
  {
    id: 'kobe-cargo',
    name: 'Kobe Cargo',
    description: 'Cargo intake, receiving, packing, consolidation, dispatch, drivers and owner operations.',
    category: 'erp',
    primaryAppId: 'cargo',
    appIds: [
      'cargo', 'cargo-sender', 'cargo-owner', 'cargo-driver', 'cargo-receiver',
      'cargo-company', 'cargo-consolidation', 'cargo-tz', 'cargo-tz-ops',
    ],
    features: ['Receiving', 'Packing', 'Consolidation', 'Dispatch', 'Tracking', 'Owner dashboard'],
  },
  {
    id: 'kobe-creators',
    name: 'Kobe Creators',
    description: 'Creator marketplace, campaigns, social performance, attribution, escrow and creator commerce.',
    category: 'erp',
    primaryAppId: 'creator',
    appIds: ['creator'],
    features: ['Marketplace', 'Campaigns', 'Social accounts', 'Attribution', 'Escrow', 'Creator AI'],
  },
  {
    id: 'kobe-hotel',
    name: 'Kobe Hotels',
    description: 'Hotel operations, rooms, bookings, guest service, departments and hotel reporting.',
    category: 'erp',
    primaryAppId: 'kobe-hotel',
    appIds: ['kobe-hotel'],
    features: ['Bookings', 'Rooms', 'Operations', 'Departments', 'Reporting'],
  },
  {
    id: 'kobe-property',
    name: 'Kobe Property',
    description: 'Property portfolio, tenants, rent collection and payment tracking.',
    category: 'erp',
    primaryAppId: 'property',
    appIds: ['property', 'property-payments'],
    features: ['Properties', 'Tenants', 'Rent', 'Payments', 'Collections'],
  },
  {
    id: 'kobe-pay',
    name: 'KobePay',
    description: 'Payments, school wallets, supplier flows and cashier operations.',
    category: 'erp',
    primaryAppId: 'kobe-pay',
    appIds: ['kobe-pay', 'kobepay-pro', 'china-cashier'],
    features: ['Wallets', 'Payments', 'Suppliers', 'Cashier', 'School money'],
  },
  {
    id: 'kobe-studio',
    name: 'Kobe Studio',
    description: 'Media production, media inbox and business printing workflows.',
    category: 'media',
    primaryAppId: 'kobe-studio',
    appIds: ['kobe-studio', 'media-inbox', 'kobe-print'],
    features: ['Media projects', 'Inbox', 'Production', 'Print'],
  },
  {
    id: 'kobe-sports',
    name: 'Kobe Sports',
    description: 'Sports competition operations, team and coach tools.',
    category: 'sports',
    primaryAppId: 'kobe-sports',
    appIds: ['kobe-sports', 'kobe-coach'],
    features: ['Competitions', 'Teams', 'Coaches', 'Live operations'],
  },
  {
    id: 'kobe-transit',
    name: 'Kobe Transit',
    description: 'Bus operations, station visibility, compliance and transit monitoring.',
    category: 'erp',
    primaryAppId: 'kobe-transit',
    appIds: ['kobe-transit'],
    features: ['Bus operations', 'Station board', 'Compliance', 'Monitoring'],
  },
  {
    id: 'kobe-live-sales',
    name: 'Kobe Live Sales',
    description: 'Live social selling, comment-driven orders and real-time sales sessions.',
    category: 'erp',
    primaryAppId: 'live-sales',
    appIds: ['live-sales'],
    features: ['Live sessions', 'Comments', 'Reservations', 'Orders'],
  },
];

// AI runtime, model management and assistants are platform services. They remain
// installed/launchable in KobeOS but are intentionally not sold as separate App
// Store products.
export const PLATFORM_SERVICE_APP_IDS = new Set([
  'kobe-assistant', 'kobe-models', 'kobe-agents',
]);

const byId = new Map(appCatalogue.map((app) => [app.id, app]));
const groupedAppIds = new Set(MODULE_DEFINITIONS.flatMap((module) => module.appIds));

export const storeModules: StoreModule[] = [
  ...MODULE_DEFINITIONS.map((module) => ({
    ...module,
    version: byId.get(module.primaryAppId)?.version ?? '1.0.0',
  })),
  // Any app that is not a feature of a larger module remains a standalone
  // module. This prevents breaking older utility/developer apps while ensuring
  // related ERP/cargo/property components are never listed separately.
  ...appCatalogue
    .filter((app) => !groupedAppIds.has(app.id) && !PLATFORM_SERVICE_APP_IDS.has(app.id))
    .map((app) => ({
      id: app.id,
      name: app.name,
      description: app.description,
      category: app.category,
      primaryAppId: app.id,
      appIds: [app.id],
      features: [],
      version: app.version,
    })),
];

const moduleById = new Map(storeModules.map((module) => [module.id, module]));
const entitlementByAppId = new Map<string, string>();
for (const module of storeModules) {
  for (const appId of module.appIds) entitlementByAppId.set(appId, module.id);
}

export function getStoreModule(moduleId: string): StoreModule | undefined {
  return moduleById.get(moduleId);
}

export function getModuleApps(moduleId: string): AppManifest[] {
  const module = getStoreModule(moduleId);
  if (!module) return [];
  return module.appIds.map((id) => byId.get(id)).filter((app): app is AppManifest => !!app);
}

export function getModulePrimaryApp(moduleId: string): AppManifest | undefined {
  const module = getStoreModule(moduleId);
  return module ? byId.get(module.primaryAppId) : undefined;
}

export function entitlementIdForApp(appId: string): string {
  return entitlementByAppId.get(appId) ?? appId;
}
