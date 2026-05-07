import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'music-studio',
  name: 'Music Studio',
  description: 'Audio production',
  icon: 'Mic',
  category: 'media',
  version: '1.0.0',
  width: 800,
  height: 500,
  minWidth: 300,
  minHeight: 200,
  singleton: false,
  requiresAuth: false,
  permissions: [],
  component: lazy(() => import('./index')),
};
