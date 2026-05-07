import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'erp-sourcing',
  name: 'Sourcing',
  description: 'Procurement',
  icon: 'Truck',
  category: 'erp',
  version: '1.0.0',
  width: 800,
  height: 550,
  minWidth: 300,
  minHeight: 200,
  singleton: false,
  requiresAuth: false,
  permissions: [],
  component: lazy(() => import('./index')),
};
