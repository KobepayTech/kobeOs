import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'email',
  name: 'Email',
  description: 'Email client',
  icon: 'Mail',
  category: 'communication',
  version: '1.0.0',
  width: 800,
  height: 550,
  minWidth: 300,
  minHeight: 200,
  singleton: false,
  requiresAuth: false,
  permissions: [],
  component: lazy(() => import('./index')),
};
