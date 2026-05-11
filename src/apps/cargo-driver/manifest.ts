import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'cargo-driver',
  name: 'Cargo Driver',
  description: 'Driver portal - Manage trips, track routes, earn rewards',
  icon: 'Truck',
  category: 'erp',
  version: '1.0.0',
  width: 900,
  height: 750,
  minWidth: 400,
  minHeight: 350,
  singleton: true,
  requiresAuth: false,
  permissions: [],
  component: lazy(() => import('./index')),
};
