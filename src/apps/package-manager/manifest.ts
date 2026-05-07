import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'package-manager',
  name: 'Package Manager',
  description: 'Install and manage packages',
  icon: 'Package',
  category: 'system',
  version: '1.0.0',
  width: 600,
  height: 400,
  minWidth: 300,
  minHeight: 200,
  singleton: false,
  requiresAuth: false,
  permissions: [],
  component: lazy(() => import('./index')),
};
