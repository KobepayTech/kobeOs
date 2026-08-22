import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'kobe-hotel',
  name: 'Kobe Hotels',
  description: 'Live hospitality operations — reservations, front desk, rooms, F&B, inventory, staff, accounting, Lala and booking website.',
  icon: 'Building2',
  category: 'erp',
  version: '1.1.0',
  width: 1180,
  height: 780,
  minWidth: 760,
  minHeight: 520,
  singleton: true,
  requiresAuth: true,
  permissions: [],
  subscriptionTier: 'pro',
  component: lazy(() => import('./ProductionHotel')),
};
