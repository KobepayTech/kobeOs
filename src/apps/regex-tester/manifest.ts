import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'regex-tester',
  name: 'Regex Tester',
  description: 'Regular expression testing',
  icon: 'Search',
  category: 'development',
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
