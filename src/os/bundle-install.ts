import type { AppManifest } from './types';
import {
  APP_MODULE, PRODUCT_MODULES, appIdsForModules, modulesForBundles,
  type ProductModuleId,
} from './bundles';

/**
 * Installing a workspace.
 *
 * A customer picks one or more bundles and installs once. The work underneath
 * is per product module, because that is what is entitled and billed, and the
 * module is claimed on the server before anything is activated locally — an
 * app that appears in the launcher without an entitlement behind it is a
 * support call, and a refund.
 *
 * Modules install independently. One failure must not discard the others:
 * a shop that paid for Commerce and Accountant and lost its connection during
 * Accountant should keep Commerce and retry the one that failed, not start
 * again.
 *
 * The orchestration takes its collaborators as arguments so it can be tested
 * without a browser, a server or localStorage. The real wiring passes the
 * existing module installer.
 */

export type ModuleInstallStatus = 'installed' | 'failed' | 'skipped';

export interface ModuleOutcome {
  moduleId: ProductModuleId;
  name: string;
  status: ModuleInstallStatus;
  /** Apps this module actually activated in this pass. */
  apps: string[];
  error: string;
}

export interface BundleInstallResult {
  bundleIds: string[];
  modules: ModuleOutcome[];
  installed: ProductModuleId[];
  failed: ProductModuleId[];
  /** Every app now active because of this install, deduplicated. */
  apps: string[];
}

export interface BundleInstallDeps {
  /**
   * Claim the module entitlement on the server. Called once per module,
   * before any of its apps are touched.
   *
   * Optional because a single-shop install with no account still needs to be
   * able to set a workspace up; when it is absent the modules are activated
   * locally and the server reconciles later.
   */
  entitle?: (moduleId: ProductModuleId) => Promise<void>;
  /** Activate one app locally. */
  installApp: (app: AppManifest) => Promise<unknown>;
  /** Whether an app is already active, so a repeated install is cheap. */
  isInstalled?: (app: AppManifest) => boolean;
}

export interface BundleInstallProgress {
  moduleId: ProductModuleId;
  moduleName: string;
  moduleIndex: number;
  moduleCount: number;
  appId: string | null;
  message: string;
}

const nameOf = (moduleId: ProductModuleId) => PRODUCT_MODULES[moduleId] ?? moduleId;
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error ?? 'Unknown error');

/**
 * Install the modules a bundle selection needs, in catalogue order.
 *
 * Returns an outcome per module rather than throwing, because the caller has
 * to show the customer which parts of their workspace are ready and offer a
 * retry for the rest. Throwing would collapse that into "something failed".
 */
export async function installBundles(
  bundleIds: readonly string[],
  catalogue: readonly AppManifest[],
  deps: BundleInstallDeps,
  onProgress?: (progress: BundleInstallProgress) => void,
): Promise<BundleInstallResult> {
  return installModules(modulesForBundles(bundleIds), catalogue, deps, onProgress, [...bundleIds]);
}

/** Install an explicit module list — used by retries, which are module-level. */
export async function installModules(
  moduleIds: readonly ProductModuleId[],
  catalogue: readonly AppManifest[],
  deps: BundleInstallDeps,
  onProgress?: (progress: BundleInstallProgress) => void,
  bundleIds: string[] = [],
): Promise<BundleInstallResult> {
  const byId = new Map(catalogue.map((app) => [app.id, app]));
  const outcomes: ModuleOutcome[] = [];

  for (const [index, moduleId] of moduleIds.entries()) {
    const report = (appId: string | null, message: string) => onProgress?.({
      moduleId,
      moduleName: nameOf(moduleId),
      moduleIndex: index,
      moduleCount: moduleIds.length,
      appId,
      message,
    });

    const outcome: ModuleOutcome = {
      moduleId, name: nameOf(moduleId), status: 'installed', apps: [], error: '',
    };

    try {
      if (deps.entitle) {
        report(null, `Confirming your ${nameOf(moduleId)} subscription`);
        await deps.entitle(moduleId);
      }

      for (const appId of appIdsForModules([moduleId])) {
        const app = byId.get(appId);
        // A module may name an app this build does not ship. Skipping is right:
        // the rest of the module still works, and the catalogue test is what
        // catches the mismatch.
        if (!app) continue;
        if (deps.isInstalled?.(app)) continue;

        report(appId, `Installing ${app.name}`);
        await deps.installApp(app);
        outcome.apps.push(appId);
      }
      report(null, `${nameOf(moduleId)} is ready`);
    } catch (error) {
      outcome.status = 'failed';
      outcome.error = errorText(error);
      report(null, `${nameOf(moduleId)} could not be installed: ${outcome.error}`);
    }

    outcomes.push(outcome);
  }

  const installed = outcomes.filter((o) => o.status === 'installed').map((o) => o.moduleId);
  const failed = outcomes.filter((o) => o.status === 'failed').map((o) => o.moduleId);
  const apps = [...new Set(outcomes.flatMap((o) => o.apps))];

  return { bundleIds, modules: outcomes, installed, failed, apps };
}

/**
 * Retry only the modules that failed.
 *
 * The successful ones are reused rather than reinstalled — repeating them
 * would re-claim entitlements that are already held, and on a metered plan
 * that is a second charge for the same thing.
 */
export async function retryFailedModules(
  previous: BundleInstallResult,
  catalogue: readonly AppManifest[],
  deps: BundleInstallDeps,
  onProgress?: (progress: BundleInstallProgress) => void,
): Promise<BundleInstallResult> {
  if (!previous.failed.length) return previous;

  const retried = await installModules(previous.failed, catalogue, deps, onProgress, previous.bundleIds);
  const merged = new Map(previous.modules.map((o) => [o.moduleId, o]));
  for (const outcome of retried.modules) merged.set(outcome.moduleId, outcome);

  const modules = [...merged.values()];
  return {
    bundleIds: previous.bundleIds,
    modules,
    installed: modules.filter((o) => o.status === 'installed').map((o) => o.moduleId),
    failed: modules.filter((o) => o.status === 'failed').map((o) => o.moduleId),
    apps: [...new Set(modules.flatMap((o) => o.apps))],
  };
}

/**
 * The modules behind a set of apps — for showing what a workspace is made of,
 * and for turning a legacy per-app install into module entitlements.
 */
export function modulesForApps(appIds: readonly string[]): ProductModuleId[] {
  const seen = new Set<ProductModuleId>();
  for (const appId of appIds) {
    const moduleId = APP_MODULE[appId];
    if (moduleId) seen.add(moduleId);
  }
  return (Object.keys(PRODUCT_MODULES) as ProductModuleId[]).filter((id) => seen.has(id));
}
