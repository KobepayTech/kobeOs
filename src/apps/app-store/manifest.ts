import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'app-store',
  name: 'App Store',
  description: 'Browse, verify, install, enable, update, and remove KobeOS modules.',
  icon: 'PackageOpen',
  category: 'system',
  version: '1.0.0',
  width: 1280,
  height: 820,
  minWidth: 680,
  minHeight: 520,
  singleton: true,
  requiresAuth: true,
  permissions: ['modules:read', 'modules:install'],
  subscriptionTier: 'free',
  component: lazy(() => import('./index')),
};
