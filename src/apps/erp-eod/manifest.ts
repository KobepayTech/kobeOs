import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'erp-eod',
  name: 'End of Day',
  description: 'Record expenses, count the till, close the trading day. PWA-friendly.',
  icon: 'Calculator',
  category: 'erp',
  version: '1.0.0',
  width: 720,
  height: 820,
  minWidth: 360,
  minHeight: 480,
  singleton: true,
  requiresAuth: true,
  permissions: [],
  subscriptionTier: 'pro',
  component: lazy(() => import('./index')),
};
