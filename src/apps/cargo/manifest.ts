import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'cargo',
  name: 'Kobe Air Cargo',
  description: 'Merchant-first China to Tanzania air cargo, tracking, warehouse, flights and customs',
  icon: 'Plane',
  category: 'erp',
  version: '2.0.0',
  width: 1200,
  height: 780,
  minWidth: 400,
  minHeight: 350,
  singleton: true,
  requiresAuth: false,
  permissions: [],
  subscriptionTier: 'pro',
  component: lazy(() => import('./KobeAirCargo')),
};
