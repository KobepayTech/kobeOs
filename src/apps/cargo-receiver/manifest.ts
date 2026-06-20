import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'cargo-receiver',
  name: 'Customer Portal',
  description: 'Book shipments, track deliveries, manage documents',
  icon: 'UserCircle',
  category: 'erp',
  version: '1.0.0',
  width: 900,
  height: 750,
  minWidth: 400,
  minHeight: 350,
  singleton: true,
  requiresAuth: false,
  permissions: [],
  subscriptionTier: 'pro',
  component: lazy(() => import('../cargo/CustomerPortal')),
};
