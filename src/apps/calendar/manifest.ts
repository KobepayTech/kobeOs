import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'calendar',
  name: 'Calendar',
  description: 'Calendar and events',
  icon: 'Calendar',
  category: 'productivity',
  version: '1.0.0',
  width: 700,
  height: 550,
  minWidth: 300,
  minHeight: 200,
  singleton: false,
  requiresAuth: false,
  permissions: [],
  component: lazy(() => import('./index')),
};
