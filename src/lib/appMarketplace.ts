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

export async function listAppEntitlements() {
  const response = await api<unknown>('/app-marketplace/apps', {
    offlineFallback: false,
  });
  return apiArray<AppEntitlementSnapshot>(response, ['entitlements', 'apps']);
}

export async function installMarketplaceApp(appId: string) {
  const response = await api<unknown>(
    `/app-marketplace/apps/${encodeURIComponent(appId)}/install`,
    { method: 'POST', body: '{}', offlineFallback: false },
  );
  const record = apiObject<AppEntitlementSnapshot>(response);
  if (!record?.appId) throw new Error('The App Store returned an invalid installation record.');
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
