import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'erp-store',
  name: 'Store',
  description: 'Online store',
  icon: 'Store',
  category: 'erp',
  version: '1.0.0',
  width: 900,
  height: 600,
  minWidth: 300,
  minHeight: 200,
  singleton: false,
  requiresAuth: false,
  permissions: [],
  component: lazy(() => import('./index')),
};
