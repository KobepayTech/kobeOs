import { api } from './api';
import type { ProductModuleId } from '@/os/bundles';

/**
 * The server side of bundle installation.
 *
 * Entitlements are claimed before anything is activated locally, because an
 * app in the launcher with nothing behind it is a support call and a refund.
 * The endpoints sit on the existing per-app gate, so trials, payments and
 * renewal are unchanged — a module is simply the set of apps it grants.
 */

export type ModuleAccess = 'trial' | 'active' | 'expired' | 'pending' | 'failed' | 'none';

export interface AppEntitlementView {
  appId: string;
  access: Exclude<ModuleAccess, 'none'>;
  installedAt: number;
  trialEndsAt: number;
  periodEndsAt: number | null;
  daysRemaining: number;
  priceTzs: number;
  priceUsd: number;
}

export interface ModuleEntitlementView {
  moduleId: ProductModuleId;
  name: string;
  access: ModuleAccess;
  apps: AppEntitlementView[];
  daysRemaining: number;
}

/** Module-level access for the signed-in user. */
export function listModuleEntitlements(): Promise<ModuleEntitlementView[]> {
  return api<ModuleEntitlementView[]>('/app-marketplace/modules');
}

/** Claim one module. Idempotent: a repeat returns the existing entitlement. */
export function entitleModule(moduleId: ProductModuleId): Promise<ModuleEntitlementView> {
  return api<ModuleEntitlementView>(`/app-marketplace/modules/${moduleId}/install`, {
    method: 'POST',
  });
}

/**
 * Claim a whole selection in one call, letting the server deduplicate the
 * overlap between bundles.
 *
 * Preferred over claiming module by module where the connection allows it: one
 * round trip, and the server decides the dedup rather than two places having
 * to agree about it.
 */
export function entitleBundles(bundleIds: readonly string[]): Promise<{
  bundleIds: string[];
  modules: ModuleEntitlementView[];
}> {
  return api('/app-marketplace/bundles/install', {
    method: 'POST',
    body: JSON.stringify({ bundleIds }),
    headers: { 'content-type': 'application/json' },
  });
}

/** Modules the user may use now — what the launcher expands. */
export function usableModuleIds(modules: readonly ModuleEntitlementView[]): ProductModuleId[] {
  return modules
    .filter((module) => module.access === 'trial' || module.access === 'active')
    .map((module) => module.moduleId);
}
