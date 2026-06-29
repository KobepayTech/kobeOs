import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'cargo-consolidation',
  name: 'Cargo Pack',
  description: 'Customers, lanes, and consolidation boxes',
  icon: 'PackageOpen',
  category: 'erp',
  version: '1.0.0',
  width: 1100,
  height: 720,
  minWidth: 480,
  minHeight: 320,
  singleton: true,
  requiresAuth: true,
  permissions: [],
  subscriptionTier: 'pro',
  component: lazy(() => import('./index')),
};
