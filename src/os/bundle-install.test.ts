import { describe, expect, it, vi } from 'vitest';
import type { AppManifest } from './types';
import { APP_MODULE, appIdsForModules } from './bundles';
import {
  installBundles, installModules, modulesForApps, retryFailedModules,
  type BundleInstallDeps, type BundleInstallProgress,
} from './bundle-install';

/** A catalogue covering every app the real one does, with nothing to render. */
const catalogue: AppManifest[] = Object.keys(APP_MODULE).map((id): AppManifest => ({
  id, name: id, description: id, icon: 'Box', category: 'erp', version: '1.0.0',
  width: 800, height: 600, minWidth: 300, minHeight: 200, singleton: false,
  requiresAuth: false, permissions: [], component: (() => null) as never,
}));

const deps = (over: Partial<BundleInstallDeps> = {}): BundleInstallDeps => ({
  installApp: vi.fn().mockResolvedValue(undefined),
  ...over,
});

describe('installBundles', () => {
  it('installs every app a bundle needs', async () => {
    const d = deps();
    const result = await installBundles(['hospitality'], catalogue, d);

    expect(result.failed).toEqual([]);
    expect(result.apps).toContain('kobe-hotel');
    expect(result.apps).toContain('erp-pos');
    expect(result.apps).toContain('erp-accounting');
  });

  it('installs a shared module once when two bundles both need it', async () => {
    // Retail and Hospitality both include Kobe Accountant. Installing twice
    // would re-claim an entitlement that is already held.
    const entitle = vi.fn().mockResolvedValue(undefined);
    const result = await installBundles(['retail', 'hospitality'], catalogue, deps({ entitle }));

    const accountantCalls = entitle.mock.calls.filter(([id]) => id === 'kobe-accountant');
    expect(accountantCalls).toHaveLength(1);
    expect(result.modules.filter((m) => m.moduleId === 'kobe-accountant')).toHaveLength(1);
  });

  it('activates no app for a module whose entitlement is refused', async () => {
    // Apps in the launcher without an entitlement behind them are a support
    // call and a refund.
    const installApp = vi.fn().mockResolvedValue(undefined);
    const entitle = vi.fn(async (id: string) => {
      if (id === 'kobe-commerce') throw new Error('Subscription required');
    });
    const result = await installBundles(['retail'], catalogue, deps({ installApp, entitle }));

    expect(result.failed).toEqual(['kobe-commerce']);
    const installedIds = installApp.mock.calls.map(([app]) => (app as AppManifest).id);
    for (const appId of appIdsForModules(['kobe-commerce'])) {
      expect(installedIds).not.toContain(appId);
    }
  });

  it('claims the entitlement before touching any app', async () => {
    const order: string[] = [];
    const entitle = vi.fn(async (id: string) => { order.push(`entitle:${id}`); });
    const installApp = vi.fn(async (app: AppManifest) => { order.push(`install:${app.id}`); });

    await installBundles(['games'], catalogue, deps({ entitle, installApp }));

    expect(order[0]).toBe('entitle:kobe-games');
    expect(order.slice(1).every((step) => step.startsWith('install:'))).toBe(true);
  });

  it('keeps the modules that worked when one fails', async () => {
    const entitle = vi.fn(async (id: string) => {
      if (id === 'kobe-accountant') throw new Error('network down');
    });
    const result = await installBundles(['retail'], catalogue, deps({ entitle }));

    expect(result.failed).toEqual(['kobe-accountant']);
    expect(result.installed).toContain('kobe-commerce');
    expect(result.installed).toContain('kobe-connect');
    expect(result.apps).toContain('erp-pos');
  });

  it('reports a failure instead of throwing, so the caller can offer a retry', async () => {
    const installApp = vi.fn().mockRejectedValue(new Error('disk full'));
    await expect(installBundles(['games'], catalogue, deps({ installApp }))).resolves.toMatchObject({
      failed: ['kobe-games'],
    });
  });

  it('carries the failure reason, not just the fact of it', async () => {
    const entitle = vi.fn().mockRejectedValue(new Error('Card declined'));
    const result = await installBundles(['games'], catalogue, deps({ entitle }));
    expect(result.modules[0].error).toBe('Card declined');
  });

  it('skips apps that are already active', async () => {
    const installApp = vi.fn().mockResolvedValue(undefined);
    const result = await installBundles(['games'], catalogue, deps({
      installApp, isInstalled: (app) => app.id === 'snake',
    }));

    expect(installApp).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'snake' }));
    expect(result.apps).not.toContain('snake');
    expect(result.apps).toContain('tetris');
    expect(result.failed).toEqual([]);
  });

  it('works without a server, for a shop setting itself up offline', async () => {
    // No entitle dependency at all: activate locally and let the server
    // reconcile later, rather than refusing to configure the machine.
    const result = await installBundles(['games'], catalogue, { installApp: vi.fn() });
    expect(result.failed).toEqual([]);
    expect(result.apps).toHaveLength(4);
  });

  it('ignores an app the catalogue does not ship rather than failing the module', async () => {
    const thin = catalogue.filter((app) => app.id !== 'snake');
    const result = await installBundles(['games'], thin, deps());

    expect(result.failed).toEqual([]);
    expect(result.apps).not.toContain('snake');
    expect(result.apps).toContain('chess');
  });

  it('reports progress naming the module and the app', async () => {
    const seen: BundleInstallProgress[] = [];
    await installBundles(['games'], catalogue, deps(), (p) => seen.push(p));

    expect(seen.some((p) => p.appId === 'tetris')).toBe(true);
    expect(seen.every((p) => p.moduleCount === 1)).toBe(true);
    expect(seen.at(-1)?.message).toMatch(/ready/i);
  });

  it('does nothing for an empty selection', async () => {
    const installApp = vi.fn();
    const result = await installBundles([], catalogue, deps({ installApp }));

    expect(result.modules).toEqual([]);
    expect(installApp).not.toHaveBeenCalled();
  });
});

describe('retryFailedModules', () => {
  it('retries only what failed and reuses what did not', async () => {
    let failOnce = true;
    const entitle = vi.fn(async (id: string) => {
      if (id === 'kobe-accountant' && failOnce) { failOnce = false; throw new Error('timeout'); }
    });
    const first = await installBundles(['retail'], catalogue, deps({ entitle }));
    expect(first.failed).toEqual(['kobe-accountant']);

    entitle.mockClear();
    const second = await retryFailedModules(first, catalogue, deps({ entitle }));

    // Only the failed module is claimed again; a metered plan would otherwise
    // charge twice for the ones that already succeeded.
    expect(entitle.mock.calls.map(([id]) => id)).toEqual(['kobe-accountant']);
    expect(second.failed).toEqual([]);
    expect(second.installed).toContain('kobe-commerce');
    expect(second.installed).toContain('kobe-accountant');
  });

  it('keeps a module failed when the retry fails too', async () => {
    const entitle = vi.fn(async (id: string) => {
      if (id === 'kobe-games') throw new Error('still down');
    });
    const first = await installBundles(['games'], catalogue, deps({ entitle }));
    const second = await retryFailedModules(first, catalogue, deps({ entitle }));

    expect(second.failed).toEqual(['kobe-games']);
    expect(second.modules[0].error).toBe('still down');
  });

  it('is a no-op when nothing failed', async () => {
    const first = await installBundles(['games'], catalogue, deps());
    const installApp = vi.fn();
    const second = await retryFailedModules(first, catalogue, deps({ installApp }));

    expect(installApp).not.toHaveBeenCalled();
    expect(second).toBe(first);
  });

  it('preserves the original bundle selection through a retry', async () => {
    const entitle = vi.fn(async (id: string) => {
      if (id === 'kobe-accountant') throw new Error('nope');
    });
    const first = await installBundles(['retail', 'hospitality'], catalogue, deps({ entitle }));
    const second = await retryFailedModules(first, catalogue, deps({ entitle }));

    expect(second.bundleIds).toEqual(['retail', 'hospitality']);
  });
});

describe('installModules', () => {
  it('installs an explicit module list without a bundle', async () => {
    const result = await installModules(['kobe-hotel'], catalogue, deps());
    expect(result.apps).toEqual(['kobe-hotel']);
  });
});

describe('modulesForApps', () => {
  it('maps apps back to the modules that grant them', () => {
    expect(modulesForApps(['erp-pos', 'erp-accounting'])).toEqual(['kobe-commerce', 'kobe-accountant']);
  });

  it('deduplicates apps from the same module', () => {
    expect(modulesForApps(['erp-pos', 'erp-shop', 'posys'])).toEqual(['kobe-commerce']);
  });

  it('ignores apps that no module sells', () => {
    // Shared-core and operator apps have no module behind them, so a legacy
    // per-app install must not invent an entitlement for them.
    expect(modulesForApps(['settings', 'kobetech-admin'])).toEqual([]);
  });
});
