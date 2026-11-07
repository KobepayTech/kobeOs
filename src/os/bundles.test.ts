import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  APP_MODULE, BUNDLES, OPERATOR_APPS, PRODUCT_MODULES, SHARED_CORE_APPS,
  appIdsForBundles, appIdsForModules, bundleById, bundlesContainingModule,
  classifyApp, isAppEntitled, launcherAppIds, modulesForBundles, type ProductModuleId,
} from './bundles';

/** App ids the registry actually imports, read from the source rather than assumed. */
function registeredAppIds(): string[] {
  const registry = readFileSync(join(process.cwd(), 'src/os/registry.ts'), 'utf8');
  const dirs = [...registry.matchAll(/@\/apps\/([a-z0-9-]+)\/manifest/g)].map((m) => m[1]);
  return [...new Set(dirs)].map((dir) => {
    const manifest = join(process.cwd(), 'src/apps', dir, 'manifest.ts');
    const id = existsSync(manifest)
      ? /id:\s*'([^']+)'/.exec(readFileSync(manifest, 'utf8'))?.[1]
      : undefined;
    return id ?? dir;
  });
}

describe('catalogue coverage', () => {
  const registered = registeredAppIds();

  it('reads a plausible number of registered apps, so the check cannot pass vacuously', () => {
    // If the regex stopped matching, every assertion below would pass against
    // an empty list and the coverage guarantee would quietly disappear.
    expect(registered.length).toBeGreaterThan(80);
  });

  it('assigns every registered app to shared-core, a module, or operator', () => {
    const unassigned = registered.filter((id) => classifyApp(id) === 'unassigned');
    expect(unassigned).toEqual([]);
  });

  it('references no app that is not registered', () => {
    // A module granting an app that no longer exists installs nothing and
    // reports success, which is worse than failing.
    const known = new Set(registered);
    const dangling = [...Object.keys(APP_MODULE), ...SHARED_CORE_APPS, ...OPERATOR_APPS]
      .filter((id) => !known.has(id));
    expect(dangling).toEqual([]);
  });

  it('classifies each app exactly once', () => {
    const everywhere = [...Object.keys(APP_MODULE), ...SHARED_CORE_APPS, ...OPERATOR_APPS];
    expect(everywhere.length).toBe(new Set(everywhere).size);
  });

  it('puts every product module in at least one bundle', () => {
    // A module no bundle sells is unreachable through onboarding.
    const orphans = (Object.keys(PRODUCT_MODULES) as ProductModuleId[])
      .filter((id) => bundlesContainingModule(id).length === 0);
    expect(orphans).toEqual([]);
  });

  it('gives every product module at least one app', () => {
    const empty = (Object.keys(PRODUCT_MODULES) as ProductModuleId[])
      .filter((id) => appIdsForModules([id]).length === 0);
    expect(empty).toEqual([]);
  });

  it('names a module in every bundle that the catalogue knows', () => {
    for (const bundle of BUNDLES) {
      for (const moduleId of bundle.modules) {
        expect(PRODUCT_MODULES[moduleId], `${bundle.id} → ${moduleId}`).toBeTruthy();
      }
    }
  });
});

const modulesOf = (ids: string[]) => modulesForBundles(ids);

describe('modulesForBundles', () => {
  it('deduplicates a module two bundles share', () => {
    // Retail and Hospitality both include Kobe Accountant. Installing it twice
    // would double-bill or fail on the second attempt.
    const modules = modulesOf(['retail', 'hospitality']);
    expect(modules.filter((m) => m === 'kobe-accountant')).toHaveLength(1);
  });

  it('returns the union of both bundles', () => {
    const modules = modulesOf(['retail', 'hospitality']);
    expect(modules).toContain('kobe-commerce');
    expect(modules).toContain('kobe-hotel');
  });

  it('is order-independent, so a half-finished install is reproducible', () => {
    expect(modulesOf(['retail', 'hospitality'])).toEqual(modulesOf(['hospitality', 'retail']));
  });

  it('ignores a bundle id it does not know rather than throwing', () => {
    expect(modulesOf(['retail', 'not-a-bundle'])).toEqual(modulesOf(['retail']));
  });

  it('returns nothing for no selection', () => {
    expect(modulesOf([])).toEqual([]);
  });
});

describe('appIdsForBundles', () => {
  it('expands a bundle to the apps that make it usable', () => {
    const apps = appIdsForBundles(['hospitality']);
    expect(apps).toContain('kobe-hotel');
    expect(apps).toContain('erp-pos');
    expect(apps).toContain('erp-accounting');
  });

  it('lists each app once even when bundles overlap', () => {
    const apps = appIdsForBundles(['retail', 'hospitality', 'restaurants']);
    expect(apps.length).toBe(new Set(apps).size);
  });

  it('does not include apps from a bundle that was not chosen', () => {
    const apps = appIdsForBundles(['games']);
    expect(apps).toEqual(['snake', 'tetris', 'chess', 'solitaire']);
    expect(apps).not.toContain('erp-pos');
  });

  it('never includes an operator console', () => {
    // Buying a bundle must not be a route into KobeTech's own tools.
    const everyBundle = appIdsForBundles(BUNDLES.map((b) => b.id));
    for (const operator of OPERATOR_APPS) expect(everyBundle).not.toContain(operator);
  });
});

describe('launcherAppIds', () => {
  it('always includes the shared platform services', () => {
    // A workspace without a file manager is not a cheaper workspace.
    const apps = launcherAppIds([]);
    for (const core of SHARED_CORE_APPS) expect(apps).toContain(core);
  });

  it('expands module entitlements into their child apps', () => {
    // This is the rehydrate fix: child apps are derived from the entitlement
    // on every render, so a reload cannot leave a paid-for app missing.
    const apps = launcherAppIds(['kobe-cargo']);
    expect(apps).toContain('cargo-driver');
    expect(apps).toContain('cargo-consolidation');
  });

  it('is stable across repeated calls, so a rehydrate shows the same launcher', () => {
    expect(launcherAppIds(['kobe-commerce'])).toEqual(launcherAppIds(['kobe-commerce']));
  });

  it('excludes operator consoles however many modules are entitled', () => {
    const apps = launcherAppIds(Object.keys(PRODUCT_MODULES) as ProductModuleId[]);
    for (const operator of OPERATOR_APPS) expect(apps).not.toContain(operator);
  });
});

describe('isAppEntitled', () => {
  it('grants shared-core without any entitlement', () => {
    expect(isAppEntitled('settings', [])).toBe(true);
  });

  it('refuses a module app that was not bought', () => {
    expect(isAppEntitled('erp-pos', ['kobe-hotel'])).toBe(false);
  });

  it('grants a module app from the module that owns it', () => {
    expect(isAppEntitled('erp-pos', ['kobe-commerce'])).toBe(true);
  });

  it('refuses operator consoles even with every module entitled', () => {
    const all = Object.keys(PRODUCT_MODULES) as ProductModuleId[];
    for (const operator of OPERATOR_APPS) expect(isAppEntitled(operator, all)).toBe(false);
  });

  it('refuses an app it has never heard of', () => {
    expect(isAppEntitled('not-an-app', Object.keys(PRODUCT_MODULES) as ProductModuleId[])).toBe(false);
  });
});

describe('bundle catalogue shape', () => {
  it('has unique bundle ids', () => {
    const ids = BUNDLES.map((b) => b.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it('describes every bundle, since the chooser shows the description', () => {
    for (const bundle of BUNDLES) {
      expect(bundle.name.length, bundle.id).toBeGreaterThan(0);
      expect(bundle.description.length, bundle.id).toBeGreaterThan(0);
      expect(bundle.modules.length, bundle.id).toBeGreaterThan(0);
    }
  });

  it('resolves a bundle by id and reports an unknown one as missing', () => {
    expect(bundleById('retail')?.name).toBe('Retail & Wholesale');
    expect(bundleById('nope')).toBeUndefined();
  });
});
