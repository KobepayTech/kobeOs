import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'erp-discounts',
  name: 'Discounts & Promos',
  description: 'Product discounts, promotional campaigns, bulk pricing, coupon codes',
  icon: 'Percent',
  category: 'erp',
  version: '1.0.0',
  width: 1000,
  height: 750,
  minWidth: 400,
  minHeight: 350,
  singleton: true,
  requiresAuth: false,
  permissions: [],
  component: lazy(() => import('./index')),
};
