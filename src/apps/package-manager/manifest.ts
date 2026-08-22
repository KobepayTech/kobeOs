import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'package-manager',
  name: 'KobeOS App Store',
  description: 'Install apps, manage 14-day trials, subscriptions, and developer projects',
  icon: 'Store',
  category: 'system',
  version: '2.0.0',
  width: 1180,
  height: 760,
  minWidth: 620,
  minHeight: 480,
  singleton: true,
  requiresAuth: false,
  permissions: [],
  component: lazy(() => import('./index')),
};
