import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'property',
  name: 'Property Manager',
  description: 'Property management system for landlords and agents',
  icon: 'Building2',
  category: 'erp',
  version: '1.0.0',
  width: 950,
  height: 650,
  minWidth: 360,
  minHeight: 300,
  singleton: true,
  requiresAuth: false,
  permissions: [],
  component: lazy(() => import('./index')),
};
