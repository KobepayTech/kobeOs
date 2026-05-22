import { lazy } from 'react';
import type { AppManifest } from '../../src/os/types';

export const manifest: AppManifest = {
  id:           'kobe-store',
  name:         'Kobe Store',
  description:  'Product catalogue, inventory management, and online storefront.',
  icon:         'Store',
  category:     'erp',
  version:      '1.0.0',
  width:        1000,
  height:       680,
  minWidth:     700,
  minHeight:    500,
  singleton:    false,
  requiresAuth: true,
  permissions:  [],
  component:    lazy(() => import('../../src/apps/erp-store/index')),
};
