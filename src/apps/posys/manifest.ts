import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'posys',
  name: 'POSys',
  description: 'Mobile-first rental + hotel ops with payment tokens (SW/EN)',
  icon: 'Building2',
  category: 'erp',
  version: '1.0.0',
  width: 540,
  height: 820,
  minWidth: 360,
  minHeight: 540,
  singleton: true,
  requiresAuth: false,
  permissions: [],
  subscriptionTier: 'free',
  component: lazy(() => import('./index')),
};
