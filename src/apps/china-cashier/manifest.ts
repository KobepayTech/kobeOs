import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'china-cashier',
  name: 'China Cashier',
  description: 'Restricted mobile-first supplier payout station. Look up a customer by mobile number, scan the supplier receipt QR, verify all details, and initiate an idempotent payout.',
  icon: 'Landmark',
  category: 'erp',
  version: '1.1.0',
  width: 1280,
  height: 820,
  minWidth: 420,
  minHeight: 500,
  singleton: true,
  requiresAuth: true,
  permissions: [],
  subscriptionTier: 'pro',
  component: lazy(() => import('./EnhancedChinaCashier')),
};
