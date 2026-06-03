import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'erp-kobepay-inbox',
  name: 'KobePay Inbox',
  description: 'Inbound trade-finance receipts pushed by KobePay; safely matched to your suppliers + POs.',
  icon: 'Inbox',
  category: 'erp',
  version: '1.0.0',
  width: 1100,
  height: 720,
  minWidth: 480,
  minHeight: 360,
  singleton: true,
  requiresAuth: true,
  permissions: [],
  subscriptionTier: 'pro',
  component: lazy(() => import('./index')),
};
