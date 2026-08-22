import { api, apiArray, apiObject } from './api';

export type AppAccess = 'trial' | 'active' | 'expired' | 'pending' | 'failed';

export interface AppEntitlementSnapshot {
  appId: string;
  access: AppAccess;
  installedAt: number;
  trialEndsAt: number;
  periodEndsAt: number | null;
  daysRemaining: number;
  priceTzs: number;
  priceUsd: number;
  paymentProviders: {
    palmPesa: boolean;
    paypal: boolean;
  };
}

export interface DeveloperProject {
  id: string;
  name: string;
  slug: string;
  keyPrefix: string;
  allowedOrigins: string[];
  status: 'active' | 'suspended';
  usageCount: number;
  lastUsedAt: number | null;
  createdAt: number;
}

export const CORE_APP_IDS = [
  'package-manager',
  'settings',
  'file-manager',
] as const;

const ENTITLEMENT_CACHE_KEY = 'kobeos.app.entitlements.v1';

function readCachedEntitlements(): AppEntitlementSnapshot[] {
  try {
    const raw = localStorage.getItem(ENTITLEMENT_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row): row is AppEntitlementSnapshot => Boolean(row && typeof row === 'object' && typeof (row as { appId?: unknown }).appId === 'string'));
  } catch {
    return [];
  }
}

function writeCachedEntitlements(rows: AppEntitlementSnapshot[]) {
  try { localStorage.setItem(ENTITLEMENT_CACHE_KEY, JSON.stringify(rows)); }
  catch { /* Storage can be unavailable in restricted browser contexts. */ }
}

export async function listAppEntitlements() {
  try {
    const response = await api<unknown>('/app-marketplace/apps', {
      offlineFallback: false,
    });
    const rows = apiArray<AppEntitlementSnapshot>(response, ['entitlements', 'apps']);
    writeCachedEntitlements(rows);
    return rows;
  } catch {
    // Offline KobeOS may continue using the last entitlement snapshot that was
    // actually issued by the backend. On a first offline launch there is no
    // fabricated entitlement: only CORE_APP_IDS remain available.
    return readCachedEntitlements();
  }
}

export async function installMarketplaceApp(appId: string) {
  const response = await api<unknown>(
    `/app-marketplace/apps/${encodeURIComponent(appId)}/install`,
    { method: 'POST', body: '{}', offlineFallback: false },
  );
  const record = apiObject<AppEntitlementSnapshot>(response);
  if (!record?.appId) throw new Error('The App Store returned an invalid installation record.');
  const cached = readCachedEntitlements().filter((row) => row.appId !== record.appId);
  writeCachedEntitlements([...cached, record]);
  return record;
}

export function startPalmPesaAppPayment(appId: string, msisdn: string) {
  return api<{ transactionId: string; orderId: string; amount: number; appId: string }>(
    `/app-marketplace/apps/${encodeURIComponent(appId)}/palmpesa`,
    {
      method: 'POST',
      body: JSON.stringify({ msisdn }),
      offlineFallback: false,
    },
  );
}

export function startPayPalAppPayment(appId: string) {
  return api<{ orderId: string; approvalUrl: string; amount: number; currency: string; appId: string }>(
    `/app-marketplace/apps/${encodeURIComponent(appId)}/paypal`,
    { method: 'POST', body: '{}', offlineFallback: false },
  );
}

export function capturePayPalAppPayment(appId: string, orderId: string) {
  return api<{ status: string; appId: string; periodEndsAt?: number }>(
    `/app-marketplace/apps/${encodeURIComponent(appId)}/paypal/capture`,
    {
      method: 'POST',
      body: JSON.stringify({ orderId }),
      offlineFallback: false,
    },
  );
}

export function getAppPaymentStatus(transactionId: string) {
  return api<{ status: AppAccess; appId: string; periodEndsAt: number | null }>(
    `/app-marketplace/payments/${encodeURIComponent(transactionId)}`,
    { offlineFallback: false },
  );
}

export async function listDeveloperProjects() {
  const response = await api<unknown>('/developer-platform/projects', {
    offlineFallback: false,
  });
  return apiArray<DeveloperProject>(response, ['projects']);
}

export async function createDeveloperProject(name: string, allowedOrigins: string[]) {
  const response = await api<unknown>('/developer-platform/projects', {
    method: 'POST',
    body: JSON.stringify({ name, allowedOrigins }),
    offlineFallback: false,
  });
  const result = apiObject<{ project: DeveloperProject; apiKey: string }>(response);
  if (!result?.project?.id || !result.apiKey) {
    throw new Error('The developer platform returned an invalid project record.');
  }
  return result;
}

export async function rotateDeveloperProjectKey(projectId: string) {
  const response = await api<unknown>(
    `/developer-platform/projects/${encodeURIComponent(projectId)}/rotate`,
    { method: 'POST', body: '{}', offlineFallback: false },
  );
  const result = apiObject<{ project: DeveloperProject; apiKey: string }>(response);
  if (!result?.project?.id || !result.apiKey) {
    throw new Error('The developer platform returned an invalid key-rotation response.');
  }
  return result;
}
