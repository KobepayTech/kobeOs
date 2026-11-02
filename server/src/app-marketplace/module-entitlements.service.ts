import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AppMarketplaceService, type AppAccess, type AppEntitlementView } from './app-marketplace.service';
import {
  APP_MODULE, BUNDLE_MODULES, BUNDLE_NAMES, PRODUCT_MODULE_IDS, PRODUCT_MODULE_NAMES,
  SHARED_CORE_APPS,
} from './module-catalogue.generated';

/**
 * Module and bundle entitlements.
 *
 * Deliberately not a new entitlement system. Access is already decided per app
 * by AppMarketplaceService — a 14-day trial, then a paid period, then expiry —
 * and a second mechanism beside it would eventually disagree with the first
 * about whether someone has paid. A product module is simply the set of apps
 * it grants, claimed through that same gate, so trials, payments and renewal
 * keep working exactly as they already do.
 *
 * What this adds is the grouping: one call claims a whole workspace, the
 * overlap between bundles is claimed once, and access is reported per module
 * so a launcher can expand an entitlement rather than track each app.
 *
 * The catalogue is generated from src/os/bundles.ts. A hand-written copy here
 * would drift, and a catalogue that disagrees with itself sells one module and
 * installs a different set of apps.
 */

export type ModuleAccess = AppAccess | 'none';

export interface ModuleEntitlementView {
  moduleId: string;
  name: string;
  /** The weakest access across the module's apps — see moduleAccess. */
  access: ModuleAccess;
  apps: AppEntitlementView[];
  daysRemaining: number;
}

/**
 * A module is only as entitled as its least-entitled app.
 *
 * Reporting the best case would show a module as active while part of it is
 * locked, and the person would find that out by opening the app that does not
 * work. Order matters: anything missing or expired decides the answer.
 */
export function moduleAccess(apps: readonly { access: AppAccess }[], expected: number): ModuleAccess {
  if (!apps.length) return 'none';
  if (apps.length < expected) return 'none';
  const ranked: AppAccess[] = ['failed', 'expired', 'pending', 'trial', 'active'];
  let worst: AppAccess = 'active';
  for (const app of apps) {
    if (ranked.indexOf(app.access) < ranked.indexOf(worst)) worst = app.access;
  }
  return worst;
}

/** Apps a module grants, excluding anything that is free to everyone. */
export function appsForModule(moduleId: string): string[] {
  return Object.keys(APP_MODULE)
    .filter((appId) => APP_MODULE[appId] === moduleId && !SHARED_CORE_APPS.includes(appId));
}

/** Modules a bundle selection needs, each once, in catalogue order. */
export function modulesForBundles(bundleIds: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const bundleId of bundleIds) {
    for (const moduleId of BUNDLE_MODULES[bundleId] ?? []) seen.add(moduleId);
  }
  return PRODUCT_MODULE_IDS.filter((id) => seen.has(id));
}

@Injectable()
export class ModuleEntitlementsService {
  private readonly logger = new Logger(ModuleEntitlementsService.name);

  constructor(private readonly apps: AppMarketplaceService) {}

  private assertModule(moduleId: string): void {
    if (!PRODUCT_MODULE_NAMES[moduleId]) {
      // Naming an unknown module must fail rather than quietly entitle
      // nothing: a caller that mistypes would otherwise get a success and an
      // empty workspace.
      throw new BadRequestException(`Unknown product module: ${moduleId}`);
    }
  }

  /**
   * Claim one module for a user. Idempotent, because the underlying per-app
   * install is: claiming twice returns the existing entitlement rather than
   * restarting a trial or charging again.
   */
  async installModule(userId: string, moduleId: string): Promise<ModuleEntitlementView> {
    this.assertModule(moduleId);
    const appIds = appsForModule(moduleId);
    const apps: AppEntitlementView[] = [];
    for (const appId of appIds) apps.push(await this.apps.install(userId, appId));

    this.logger.log(`Entitled ${userId} to ${moduleId} (${apps.length} apps).`);
    return this.view(moduleId, apps, appIds.length);
  }

  /**
   * Claim every module a bundle selection needs.
   *
   * The overlap is claimed once — most bundles include Kobe Accountant, and
   * claiming it per bundle would restart trials and, on a paid plan, charge
   * repeatedly for one thing.
   */
  async installBundles(userId: string, bundleIds: readonly string[]): Promise<{
    bundleIds: string[];
    modules: ModuleEntitlementView[];
  }> {
    const unknown = bundleIds.filter((id) => !BUNDLE_NAMES[id]);
    if (unknown.length) throw new BadRequestException(`Unknown bundle: ${unknown.join(', ')}`);

    const moduleIds = modulesForBundles(bundleIds);
    const modules: ModuleEntitlementView[] = [];
    for (const moduleId of moduleIds) modules.push(await this.installModule(userId, moduleId));

    return { bundleIds: [...bundleIds], modules };
  }

  /** Module-level access for a user, derived from their app entitlements. */
  async listModules(userId: string): Promise<ModuleEntitlementView[]> {
    const owned = await this.apps.list(userId);
    const byApp = new Map(owned.map((view) => [view.appId, view]));

    return PRODUCT_MODULE_IDS.map((moduleId) => {
      const appIds = appsForModule(moduleId);
      const apps = appIds.map((appId) => byApp.get(appId)).filter((v): v is AppEntitlementView => Boolean(v));
      return this.view(moduleId, apps, appIds.length);
    });
  }

  /** The modules a user may actually use right now, for launcher expansion. */
  async entitledModuleIds(userId: string): Promise<string[]> {
    const modules = await this.listModules(userId);
    return modules
      .filter((module) => module.access === 'trial' || module.access === 'active')
      .map((module) => module.moduleId);
  }

  private view(moduleId: string, apps: AppEntitlementView[], expected: number): ModuleEntitlementView {
    return {
      moduleId,
      name: PRODUCT_MODULE_NAMES[moduleId] ?? moduleId,
      access: moduleAccess(apps, expected),
      apps,
      // The soonest expiry in the module: that is when the workspace starts
      // breaking, not the latest.
      daysRemaining: apps.length ? Math.min(...apps.map((app) => app.daysRemaining)) : 0,
    };
  }
}
