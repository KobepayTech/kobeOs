import { lazy } from 'react';
import type { AppManifest } from '../../src/os/types';

export const manifest: AppManifest = {
  id:           'kobe-shop',
  name:         'Kobe Shop',
  description:  'Online shop, POS, orders, and customer management.',
  icon:         'ShoppingBag',
  category:     'erp',
  version:      '1.0.0',
  width:        1100,
  height:       720,
  minWidth:     800,
  minHeight:    550,
  singleton:    false,
  requiresAuth: true,
  permissions:  [],
  component:    lazy(() => import('../../src/apps/erp-shop/index')),
};
