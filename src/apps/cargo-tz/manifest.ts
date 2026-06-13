import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'cargo-tz',
  name: 'Cargo TZ',
  description: 'Tanzania domestic ground transport — trucks, routes, local delivery',
  icon: 'Truck',
  category: 'erp',
  version: '1.0.0',
  width: 1000,
  height: 700,
  minWidth: 400,
  minHeight: 350,
  singleton: true,
  requiresAuth: false,
  permissions: [],
  subscriptionTier: 'pro',
  component: lazy(() => import('./index')),
};
