import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'property-payments',
  name: 'Property Payments',
  description: 'Create secure rent payment orders, manage bank and agent partners, and reconcile every collection.',
  icon: 'BadgeDollarSign',
  category: 'erp',
  version: '1.0.0',
  width: 1280,
  height: 820,
  minWidth: 620,
  minHeight: 520,
  singleton: true,
  requiresAuth: true,
  permissions: [],
  subscriptionTier: 'pro',
  component: lazy(() => import('./index')),
};
