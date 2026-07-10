import { lazy } from 'react';
import type { AppManifest } from '@/os/types';
export const manifest: AppManifest = {
  id: 'china-cashier',
  name: 'China Cashier',
  description: 'Supplier payout station — scan a receipt QR or enter the receipt number, pay the supplier, no manual amounts. Dashboard, payout history, and admin analytics.',
  icon: 'Landmark',
  category: 'erp',
  version: '1.0.0',
  width: 1160,
  height: 780,
  minWidth: 420,
  minHeight: 380,
  singleton: true,
  requiresAuth: true,
  permissions: [],
  subscriptionTier: 'pro',
  component: lazy(() => import('./index')),
};
