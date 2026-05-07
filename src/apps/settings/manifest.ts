import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'settings',
  name: 'Settings',
  description: 'System settings',
  icon: 'Settings',
  category: 'system',
  version: '1.0.0',
  width: 700,
  height: 550,
  minWidth: 300,
  minHeight: 200,
  singleton: true,
  requiresAuth: false,
  permissions: [],
  component: lazy(() => import('./index')),
};
