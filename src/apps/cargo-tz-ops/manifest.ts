import { lazy } from 'react';
import type { AppManifest } from '@/os/types';
export const manifest: AppManifest = {
  id: 'cargo-tz-ops',
  name: 'Cargo TZ',
  description: 'Domestic bus-cargo operations — receiving agent intake (auto tracking + QR), warehouse scan-and-pack, owner dashboard. Public parcel tracking by QR.',
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
  subscriptionTier: 'pro',
  component: lazy(() => import('./index')),
};
