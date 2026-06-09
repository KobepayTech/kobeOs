import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'system-settings',
  name: 'System Settings',
  description: 'OS-level system settings panel',
  icon: 'SlidersHorizontal',
  category: 'system',
  version: '1.0.0',
  width: 900,
  height: 600,
  minWidth: 400,
  minHeight: 300,
  singleton: true,
  requiresAuth: false,
  permissions: [],
  component: lazy(() => import('./index')),
};
