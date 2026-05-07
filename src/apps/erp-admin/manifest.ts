import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'erp-admin',
  name: 'ERP Admin',
  description: 'System administration',
  icon: 'Shield',
  category: 'erp',
  version: '1.0.0',
  width: 800,
  height: 550,
  minWidth: 300,
  minHeight: 200,
  singleton: true,
  requiresAuth: false,
  permissions: [],
  component: lazy(() => import('./index')),
};
