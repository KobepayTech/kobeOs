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
 * KobeOS sells complete modules, never the individual implementation apps
 * inside them. Internal app ids stay intact for the launcher/window manager,
 * while entitlements are resolved at the parent module boundary.
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
    features: ['POS', 'Inventory', 'Orders', 'Warehouse', 'Sourcing', 'Discounts', 'Storefront', 'Delivery'],
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
      'cargo', 'cargo-welcome', 'cargo-sender', 'cargo-owner', 'cargo-driver',
      'cargo-receiver', 'cargo-company', 'cargo-consolidation', 'cargo-tz', 'cargo-tz-ops',
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
    features: ['Bookings', 'Rooms', 'Operations', 'Departments', 'Reporting', 'Lala'],
  },
  {
    id: 'kobe-property',
    name: 'Kobe Property',
    description: 'Property portfolio, units, tenants, rent collection and payment tracking.',
    category: 'erp',
    primaryAppId: 'property',
    appIds: ['property', 'property-payments'],
    features: ['Properties', 'Units', 'Tenants', 'Rent', 'Payments', 'Collections'],
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
    description: 'Sports competition operations, team, coach, analytics and broadcast tools.',
    category: 'sports',
    primaryAppId: 'kobe-sports',
    appIds: ['kobe-sports', 'kobe-coach'],
    features: ['Competitions', 'Teams', 'Coaches', 'Analytics', 'Live operations'],
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
  {
    id: 'kobe-office',
    name: 'Kobe Office',
    description: 'Documents, spreadsheets, presentations, notes, tasks, planning and everyday office work.',
    category: 'productivity',
    primaryAppId: 'spreadsheet',
    appIds: ['calculator', 'text-editor', 'notepad', 'calendar', 'tasks', 'notes', 'spreadsheet', 'presentation', 'draw', 'kanban'],
    features: ['Documents', 'Spreadsheets', 'Presentations', 'Notes', 'Tasks', 'Calendar', 'Kanban'],
  },
  {
    id: 'kobe-connect',
    name: 'Kobe Connect',
    description: 'Business communication tools for email, chat, contacts and video meetings.',
    category: 'communication',
    primaryAppId: 'chat',
    appIds: ['email', 'chat', 'contacts', 'video-conference'],
    features: ['Email', 'Chat', 'Contacts', 'Video meetings'],
  },
  {
    id: 'kobe-media',
    name: 'Kobe Media',
    description: 'Media playback, image viewing, audio recording, camera and screen recording tools.',
    category: 'media',
    primaryAppId: 'media-player',
    appIds: ['media-player', 'image-viewer', 'music-studio', 'camera', 'screen-recorder'],
    features: ['Media player', 'Images', 'Audio studio', 'Camera', 'Screen recorder'],
  },
  {
    id: 'kobe-developer',
    name: 'Kobe Developer',
    description: 'Coding and developer tools bundled as one complete KobeOS developer module.',
    category: 'development',
    primaryAppId: 'code-ide',
    appIds: ['code-ide', 'database-manager', 'api-tester', 'git-client', 'regex-tester', 'json-formatter', 'color-picker', 'markdown-preview'],
    features: ['IDE', 'Database manager', 'API tester', 'Git', 'Regex', 'JSON', 'Markdown'],
  },
  {
    id: 'kobe-games',
    name: 'Kobe Games',
    description: 'The built-in KobeOS casual game collection.',
    category: 'games',
    primaryAppId: 'chess',
    appIds: ['snake', 'tetris', 'chess', 'solitaire'],
    features: ['Snake', 'Tetris', 'Chess', 'Solitaire'],
  },
];

/** Platform/internal services ship with KobeOS and are never store products. */
export const PLATFORM_SERVICE_APP_IDS = new Set([
  'app-store', 'file-manager', 'terminal', 'settings', 'system-settings',
  'task-manager', 'package-manager', 'backup-restore', 'password-manager',
  'browser', 'kobe-assistant', 'kobe-models', 'kobe-agents',
  'kobetech-admin', 'kobetech-devops',
]);

const byId = new Map(appCatalogue.map((app) => [app.id, app]));

/** Only explicitly defined modules are sold. There is intentionally no fallback
 * that turns an arbitrary internal app into a store product. */
export const storeModules: StoreModule[] = MODULE_DEFINITIONS.map((module) => ({
  ...module,
  version: byId.get(module.primaryAppId)?.version ?? '1.0.0',
}));

export const STORE_MODULE_APP_IDS = new Set(storeModules.flatMap((module) => module.appIds));

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
