import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'erp-warehouse-ops',
  name: 'Warehouse Ops',
  description: 'Pending picking dashboard, pick → pack → dispatch flow, printable warehouse receipts',
  icon: 'ClipboardCheck',
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
