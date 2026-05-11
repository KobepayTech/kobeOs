import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'erp-store-editor',
  name: 'Store Editor',
  description: 'Customize your storefront',
  icon: 'Palette',
  category: 'erp',
  version: '1.0.0',
  width: 1100,
  height: 700,
  minWidth: 400,
  minHeight: 400,
  singleton: false,
  requiresAuth: false,
  permissions: [],
  component: lazy(() => import('./index')),
};
