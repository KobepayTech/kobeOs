import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'color-picker',
  name: 'Color Picker',
  description: 'Color tools',
  icon: 'Droplet',
  category: 'development',
  version: '1.0.0',
  width: 400,
  height: 350,
  minWidth: 300,
  minHeight: 200,
  singleton: false,
  requiresAuth: false,
  permissions: [],
  component: lazy(() => import('./index')),
};
