import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'cargo-driver',
  name: 'Driver Mode',
  description: 'Mobile-optimized delivery driver interface',
  icon: 'Smartphone',
  category: 'erp',
  version: '1.0.0',
  width: 480,
  height: 800,
  minWidth: 360,
  minHeight: 500,
  singleton: true,
  requiresAuth: false,
  permissions: [],
  subscriptionTier: 'pro',
  component: lazy(() => import('../cargo/DriverMode')),
};
