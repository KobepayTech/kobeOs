import { readFile } from 'node:fs/promises';

const productionSurfaces = [
  'src/apps/kobe-hotel/index.tsx',
  'src/apps/kobe-hotel/ProductionHotel.tsx',
  'src/apps/creator/ProductionCreator.tsx',
  'src/apps/kobe-accountant/index.tsx',
  'src/apps/kobe-pay/index.tsx',
  'src/apps/china-cashier/index.tsx',
  'src/apps/kobepay-pro/index.tsx',
  'src/apps/erp-credit/index.tsx',
  'src/apps/property/PropEasy.tsx',
  'src/apps/erp-admin/index.tsx',
  'src/apps/erp-rider/index.tsx',
  'src/apps/erp-shipments/useCargoShipments.ts',
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
  'src/os/store-modules.ts',
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
