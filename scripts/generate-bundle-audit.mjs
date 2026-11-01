#!/usr/bin/env node
/**
 * Regenerate docs/BUNDLE_INVENTORY.md from the catalogue and the source tree.
 *
 * The inventory is a report, not a source of truth. Hand-maintaining a table
 * of 94 apps guarantees it drifts from the code, and a stale inventory is
 * worse than none: it is used to decide what a customer gets.
 *
 * Exits non-zero if anything is unassigned, so CI can fail on a new app
 * nobody put in a bundle — the same check the unit tests make, available
 * without a test runner.
 *
 *   node scripts/generate-bundle-audit.mjs          write the report
 *   node scripts/generate-bundle-audit.mjs --check   verify only
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const CHECK_ONLY = process.argv.includes('--check');
const OUT = join(ROOT, 'docs/BUNDLE_INVENTORY.md');

/**
 * Read the catalogue by evaluating the literals out of bundles.ts.
 *
 * Importing the TypeScript directly would need a loader, and a build step
 * between the source and its own audit is a place for them to disagree.
 */
function readCatalogue() {
  const source = readFileSync(join(ROOT, 'src/os/bundles.ts'), 'utf8');

  // Module definitions live in store-modules.ts, which is the source of truth
  // for which apps a module contains. bundles.ts adds only the bundle layer.
  const moduleSource = readFileSync(join(ROOT, 'src/os/store-modules.ts'), 'utf8');
  const modules = {};
  const appModule = {};
  for (const chunk of moduleSource.split(/\n  \{/).slice(1)) {
    const id = /id:\s*'([^']+)'/.exec(chunk)?.[1];
    const name = /name:\s*'([^']+)'/.exec(chunk)?.[1];
    const appIds = /appIds:\s*\[([\s\S]*?)\]/.exec(chunk)?.[1];
    if (!id || !name || appIds === undefined) continue;
    modules[id] = name;
    for (const [, appId] of appIds.matchAll(/'([a-z0-9-]+)'/g)) appModule[appId] = id;
  }

  const bundles = [];
  const bundleBlock = /export const BUNDLES: Bundle\[\] = \[([\s\S]*?)\n\];/.exec(source);
  for (const entry of (bundleBlock?.[1] ?? '').split(/\n  \{/)) {
    const id = /id:\s*'([^']+)'/.exec(entry)?.[1];
    const name = /name:\s*'([^']+)'/.exec(entry)?.[1];
    const mods = /modules:\s*\[([\s\S]*?)\]/.exec(entry)?.[1] ?? '';
    if (!id || !name) continue;
    bundles.push({ id, name, modules: [...mods.matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]) });
  }

  const listOf = (name) => {
    const block = new RegExp(`export const ${name}: readonly string\\[\\] = \\[([\\s\\S]*?)\\];`).exec(source);
    return [...(block?.[1] ?? '').matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]);
  };

  const operator = listOf('OPERATOR_APPS');
  const platform = [...(/export const PLATFORM_SERVICE_APP_IDS = new Set\(\[([\s\S]*?)\]\);/
    .exec(moduleSource)?.[1] ?? '').matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]);
  const core = platform.filter((appId) => !operator.includes(appId));
  return { modules, bundles, appModule, core, operator };
}

/** Apps the registry imports, with the id and name from each manifest. */
function readRegisteredApps() {
  const registry = readFileSync(join(ROOT, 'src/os/registry.ts'), 'utf8');
  const dirs = [...new Set([...registry.matchAll(/@\/apps\/([a-z0-9-]+)\/manifest/g)].map((m) => m[1]))];
  return dirs.map((dir) => {
    const path = join(ROOT, 'src/apps', dir, 'manifest.ts');
    const source = existsSync(path) ? readFileSync(path, 'utf8') : '';
    return {
      dir,
      id: /id:\s*'([^']+)'/.exec(source)?.[1] ?? dir,
      name: /name:\s*'([^']+)'/.exec(source)?.[1] ?? dir,
    };
  }).sort((a, b) => a.id.localeCompare(b.id));
}

/** Every NestJS module file, so the report covers the backend too. */
function readBackendModules(dir = join(ROOT, 'server/src'), found = []) {
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) readBackendModules(path, found);
    else if (entry.endsWith('.module.ts')) found.push(relative(ROOT, path));
  }
  return found.sort();
}

const { modules, bundles, appModule, core, operator } = readCatalogue();
const apps = readRegisteredApps();
const backend = readBackendModules();

const classify = (id) => {
  if (core.includes(id)) return 'shared-core';
  if (operator.includes(id)) return 'operator';
  if (appModule[id]) return 'module';
  return 'UNASSIGNED';
};

const unassigned = apps.filter((app) => classify(app.id) === 'UNASSIGNED');
const dangling = [...Object.keys(appModule), ...core, ...operator]
  .filter((id) => !apps.some((app) => app.id === id));
const emptyModules = Object.keys(modules)
  .filter((id) => !Object.values(appModule).includes(id));
const unsoldModules = Object.keys(modules)
  .filter((id) => !bundles.some((bundle) => bundle.modules.includes(id)));

const bundlesFor = (moduleId) => bundles
  .filter((bundle) => bundle.modules.includes(moduleId)).map((bundle) => bundle.id).join(', ');

const report = [
  '# KobeOS bundle inventory',
  '',
  '<!-- Generated by scripts/generate-bundle-audit.mjs. Do not edit by hand. -->',
  '',
  `${apps.length} registered apps, ${Object.keys(modules).length} product modules, `
  + `${bundles.length} bundles and ${backend.length} backend module files.`,
  '',
  unassigned.length
    ? `**${unassigned.length} apps are unassigned:** ${unassigned.map((a) => a.id).join(', ')}`
    : 'Every registered app is assigned to a bundle, a shared platform service, or an operator console.',
  '',
  '## Bundles',
  '',
  '| Bundle | Product modules |',
  '|---|---|',
  ...bundles.map((b) => `| ${b.name} | ${b.modules.map((m) => modules[m] ?? m).join(', ')} |`),
  '',
  '## Every registered app',
  '',
  '| App ID | Name | Classification | Product module | Bundles |',
  '|---|---|---|---|---|',
  ...apps.map((app) => {
    const kind = classify(app.id);
    const moduleId = appModule[app.id];
    const moduleName = kind === 'module' ? (modules[moduleId] ?? moduleId) : 'Included platform service';
    const where = kind === 'module' ? bundlesFor(moduleId)
      : kind === 'operator' ? 'Operator access only' : 'Every workspace';
    return `| ${app.id} | ${app.name} | ${kind} | ${moduleName} | ${where} |`;
  }),
  '',
  '## Backend modules',
  '',
  'Service assignments, not separately installed apps or new access grants.',
  '',
  '| Source |',
  '|---|',
  ...backend.map((path) => `| ${path} |`),
  '',
  '## Installation behaviour',
  '',
  'The App Store opens on bundles. Selecting several and installing once',
  'resolves them to product modules, deduplicates the overlap, claims each',
  'entitlement on the server before activating anything locally, and reports',
  'per module so a failure can be retried without reinstalling what worked.',
  '',
  'Entitlements are held per product module and expanded into child app ids on',
  'every render, so a reload or a rehydrated store cannot leave a paid-for app',
  'missing from the launcher.',
  '',
  `Regenerate with \`node scripts/generate-bundle-audit.mjs\`. Verified by`,
  '`src/os/bundles.test.ts`, which fails if an app is unassigned.',
  '',
].join('\n');


/**
 * The server needs the same catalogue to issue module entitlements. Keeping a
 * second hand-written copy there would drift from this one, and a catalogue
 * that disagrees with itself sells a module and installs a different set of
 * apps. Generated instead, and --check fails when it is stale.
 */
const GENERATED = join(ROOT, 'server/src/app-marketplace/module-catalogue.generated.ts');
const generated = [
  '// Generated by scripts/generate-bundle-audit.mjs from src/os/bundles.ts.',
  '// Do not edit by hand; run the script and commit the result.',
  '',
  `export const PRODUCT_MODULE_IDS = ${JSON.stringify(Object.keys(modules))} as const;`,
  '',
  'export type ProductModuleId = (typeof PRODUCT_MODULE_IDS)[number];',
  '',
  `export const PRODUCT_MODULE_NAMES: Record<string, string> = ${JSON.stringify(modules, null, 2)};`,
  '',
  'export const BUNDLE_MODULES: Record<string, readonly string[]> = '
  + `${JSON.stringify(Object.fromEntries(bundles.map((b) => [b.id, b.modules])), null, 2)};`,
  '',
  `export const BUNDLE_NAMES: Record<string, string> = ${JSON.stringify(Object.fromEntries(bundles.map((b) => [b.id, b.name])), null, 2)};`,
  '',
  `export const APP_MODULE: Record<string, string> = ${JSON.stringify(appModule, null, 2)};`,
  '',
  `export const SHARED_CORE_APPS: readonly string[] = ${JSON.stringify(core)};`,
  '',
  `export const OPERATOR_APPS: readonly string[] = ${JSON.stringify(operator)};`,
  '',
].join('\n');

const generatedStale = !existsSync(GENERATED)
  || readFileSync(GENERATED, 'utf8') !== generated;

if (!CHECK_ONLY) {
  writeFileSync(GENERATED, generated);
  writeFileSync(OUT, report);
  console.log(`Wrote ${relative(ROOT, OUT)} and ${relative(ROOT, GENERATED)}`
    + ` — ${apps.length} apps, ${bundles.length} bundles, ${backend.length} backend modules.`);
}

const problems = [
  unassigned.length && `${unassigned.length} unassigned app(s): ${unassigned.map((a) => a.id).join(', ')}`,
  dangling.length && `${dangling.length} catalogue entr(ies) with no registered app: ${dangling.join(', ')}`,
  emptyModules.length && `module(s) with no apps: ${emptyModules.join(', ')}`,
  unsoldModules.length && `module(s) in no bundle: ${unsoldModules.join(', ')}`,
  CHECK_ONLY && generatedStale
    && 'server/src/app-marketplace/module-catalogue.generated.ts is stale — run node scripts/generate-bundle-audit.mjs',
].filter(Boolean);

if (problems.length) {
  console.error('\nCatalogue problems:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
if (CHECK_ONLY) console.log(`Catalogue is complete: ${apps.length} apps, all assigned.`);
