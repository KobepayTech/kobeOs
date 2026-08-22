import { lazy } from 'react';
import type { AppManifest } from '@/os/types';
export const manifest: AppManifest = {
  id: 'live-sales',
  name: 'Live Sales',
  description: 'Sell during Instagram/TikTok/Facebook lives — pin products with a buy-code, catch comment orders, one-tap convert to a sale with real-time stock + PalmPesa payment request.',
  icon: 'Radio',
  category: 'erp',
  version: '1.0.0',
  width: 1200,
  height: 800,
  minWidth: 420,
  minHeight: 400,
  singleton: true,
  requiresAuth: true,
  permissions: [],
  subscriptionTier: 'pro',
  component: lazy(() => import('./index')),
};
