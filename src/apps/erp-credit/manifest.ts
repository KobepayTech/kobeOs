import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'erp-credit',
  name: 'Credit & Collections',
  description: 'Customer credit tracking, unpaid balances, aging reports, payment reminders',
  icon: 'CreditCard',
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
