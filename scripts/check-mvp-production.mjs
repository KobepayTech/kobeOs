import { readFile } from 'node:fs/promises';

const productionSurfaces = [
  'src/apps/kobe-hotel/index.tsx',
  'src/apps/kobe-hotel/ProductionHotel.tsx',
  'src/apps/kobe-hotel/ChannelsTab.tsx',
  'src/apps/creator/ProductionCreator.tsx',
  'src/apps/kobe-assistant/index.tsx',
  'src/apps/kobe-models/index.tsx',
  'src/apps/erp-dashboard/index.tsx',
  'src/apps/erp-shop/index.tsx',
  'src/apps/erp-discounts/index.tsx',
  'src/apps/posys/index.tsx',
  'src/apps/property/PropertyOps.tsx',
  'src/apps/kobe-accountant/index.tsx',
  'src/apps/kobe-pay/index.tsx',
  'src/apps/china-cashier/index.tsx',
  'src/apps/kobepay-pro/index.tsx',
  'src/apps/erp-credit/index.tsx',
  'src/apps/property/PropEasy.tsx',
  'src/apps/erp-admin/index.tsx',
  'src/apps/erp-rider/index.tsx',
  'src/apps/erp-pos/index.tsx',
  'src/apps/erp-store-editor/index.tsx',
  'src/apps/erp-shipments/useCargoShipments.ts',
  'src/apps/cargo-welcome/index.tsx',
  'src/apps/cargo-sender/index.tsx',
  'src/apps/cargo-owner/index.tsx',
  'src/apps/cargo-driver/index.tsx',
  'src/apps/cargo-receiver/index.tsx',
  'src/apps/cargo-company/index.tsx',
  'src/apps/cargo-consolidation/index.tsx',
  'src/apps/cargo-tz/index.tsx',
  'src/apps/cargo-tz-ops/index.tsx',
  'src/modules/kobe-studio/KobeStudio.tsx',
  'src/apps/kobe-print/index.tsx',
  'src/apps/kobe-sports/index.tsx',
  'src/apps/kobe-transit/index.tsx',
  'src/apps/live-sales/index.tsx',
  'src/apps/code-ide/index.tsx',
  'src/apps/git-client/index.tsx',
  'src/apps/presentation/index.tsx',
  'src/apps/music-studio/index.tsx',
  'src/apps/screen-recorder/index.tsx',
  'src/apps/video-conference/index.tsx',
  'src/lib/appMarketplace.ts',
  'src/os/store-modules.ts',
  'server/src/pos/pos.controller.ts',
  'server/src/property/services/screening.service.ts',
  'server/src/kobe-models/kobe-models.service.ts',
];

const forbidden = [
  [/\bStubApp\b/, 'StubApp'],
  [/Coming Soon/i, 'Coming Soon'],
  [/under development/i, 'under development'],
  [/\bMOCK_[A-Z0-9_]*/g, 'MOCK_* fixture'],
  [/\bDEMO_[A-Z0-9_]*/g, 'DEMO_* fixture'],
  [/seed-demo/i, 'seed-demo endpoint'],
  [/fallback\s+to\s+demo/i, 'fallback to demo'],
  [/demo\s+fallback/i, 'demo fallback'],
  [/launching\s+soon/i, 'launching soon placeholder'],
];

const failures = [];
for (const path of productionSurfaces) {
  let source;
  try { source = await readFile(path, 'utf8'); }
  catch (error) { failures.push(`${path}: cannot read (${error.message})`); continue; }
  for (const [pattern, label] of forbidden) {
    pattern.lastIndex = 0;
    if (pattern.test(source)) failures.push(`${path}: contains forbidden production marker: ${label}`);
  }
}

if (failures.length) {
  console.error('KobeOS MVP production gate failed:\n' + failures.map((x) => ` - ${x}`).join('\n'));
  process.exit(1);
}
console.log(`KobeOS MVP production gate passed for ${productionSurfaces.length} surfaces.`);
