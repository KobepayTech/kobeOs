import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

// cargo-welcome has been deprecated — onboarding is now built into the main cargo app
export const manifest: AppManifest = {
  id: 'cargo-welcome',
  name: 'Cargo Welcome',
  description: '[DEPRECATED] Onboarding is built into KOBECARGO',
  icon: 'Plane',
  category: 'erp',
  version: '1.0.0',
  width: 900,
  height: 700,
  minWidth: 400,
  minHeight: 350,
  singleton: true,
  requiresAuth: false,
  permissions: [],
  subscriptionTier: 'pro',
  component: lazy(() => import('../cargo/index')),
};
