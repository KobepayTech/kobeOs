import { lazy } from 'react';
import type { AppManifest } from '@/os/types';
export const manifest: AppManifest = {
  id: 'kobe-pay',
  name: 'KobePay',
  description: 'Trade finance wallet - Customer deposits, supplier allocation, payout workflow, cashier roles (TZ/China), bank-style receipts',
  icon: 'Wallet',
  category: 'erp',
  version: '1.0.0',
  width: 1100,
  height: 750,
  minWidth: 400,
  minHeight: 350,
  singleton: true,
  requiresAuth: false,
  permissions: [],
  component: lazy(() => import('./index')),
};
