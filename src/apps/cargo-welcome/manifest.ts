import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'cargo-welcome',
  name: 'KOBECARGO',
  description: 'Welcome to KOBECARGO - Global cargo logistics partner',
  icon: 'Plane',
  category: 'erp',
  version: '1.0.0',
  width: 1100,
  height: 750,
  minWidth: 400,
  minHeight: 350,
  singleton: true,
  requiresAuth: false,
  permissions: [],
  component: lazy(() => import('./index')),
};
