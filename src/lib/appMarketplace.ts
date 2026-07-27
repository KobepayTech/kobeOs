import { api } from './api';

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

export function listAppEntitlements() {
  return api<AppEntitlementSnapshot[]>('/app-marketplace/apps');
}

export function installMarketplaceApp(appId: string) {
  return api<AppEntitlementSnapshot>(
    `/app-marketplace/apps/${encodeURIComponent(appId)}/install`,
    { method: 'POST', body: '{}' },
  );
}

export function startPalmPesaAppPayment(appId: string, msisdn: string) {
  return api<{ transactionId: string; orderId: string; amount: number; appId: string }>(
    `/app-marketplace/apps/${encodeURIComponent(appId)}/palmpesa`,
    { method: 'POST', body: JSON.stringify({ msisdn }) },
  );
}

export function startPayPalAppPayment(appId: string) {
  return api<{ orderId: string; approvalUrl: string; amount: number; currency: string; appId: string }>(
    `/app-marketplace/apps/${encodeURIComponent(appId)}/paypal`,
    { method: 'POST', body: '{}' },
  );
}

export function capturePayPalAppPayment(appId: string, orderId: string) {
  return api<{ status: string; appId: string; periodEndsAt?: number }>(
    `/app-marketplace/apps/${encodeURIComponent(appId)}/paypal/capture`,
    { method: 'POST', body: JSON.stringify({ orderId }) },
  );
}

export function getAppPaymentStatus(transactionId: string) {
  return api<{ status: AppAccess; appId: string; periodEndsAt: number | null }>(
    `/app-marketplace/payments/${encodeURIComponent(transactionId)}`,
  );
}

export function listDeveloperProjects() {
  return api<DeveloperProject[]>('/developer-platform/projects');
}

export function createDeveloperProject(name: string, allowedOrigins: string[]) {
  return api<{ project: DeveloperProject; apiKey: string }>('/developer-platform/projects', {
    method: 'POST',
    body: JSON.stringify({ name, allowedOrigins }),
  });
}

export function rotateDeveloperProjectKey(projectId: string) {
  return api<{ project: DeveloperProject; apiKey: string }>(
    `/developer-platform/projects/${encodeURIComponent(projectId)}/rotate`,
    { method: 'POST', body: '{}' },
  );
}
