import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'erp-shop',
  name: 'Shop',
  description: 'Online store front',
  icon: 'ShoppingBag',
  category: 'erp',
  version: '1.0.0',
  width: 1000,
  height: 700,
  minWidth: 350,
  minHeight: 400,
  singleton: false,
  requiresAuth: false,
  permissions: [],
  component: lazy(() => import('./index')),
};
