import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'kobe-transit',
  name: 'KobeOS Transit',
  description: 'Bus registration, trips, weekly plate fees, ANPR compliance, enforcement review and government settlements.',
  icon: 'BusFront',
  category: 'erp',
  version: '1.0.0',
  width: 1180,
  height: 780,
  minWidth: 390,
  minHeight: 420,
  singleton: true,
  requiresAuth: true,
  permissions: [],
  subscriptionTier: 'pro',
  component: lazy(() => import('./index')),
};
