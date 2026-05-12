import { lazy } from 'react';
import type { AppManifest } from '@/os/types';
export const manifest: AppManifest = {
  id: 'kobetech-admin',
  name: 'Kobetech Admin',
  description: 'Super admin portal - Subscription management, company onboarding, billing, system health, role management',
  icon: 'Shield',
  category: 'system',
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
