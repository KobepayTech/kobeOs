import { lazy } from 'react';
import type { AppManifest } from '@/os/types';
export const manifest: AppManifest = {
  id: 'cargo-tz-ops',
  name: 'CargoTZ',
  description: 'Domestic cargo intake, collector handoffs, warehouse operations and public parcel tracking.',
  icon: 'PackageCheck',
  category: 'erp',
  version: '1.0.0',
  width: 1040,
  height: 760,
  minWidth: 380,
  minHeight: 380,
  singleton: true,
  requiresAuth: true,
  permissions: [],
  subscriptionTier: 'free',
  component: lazy(() => import('./index')),
};
