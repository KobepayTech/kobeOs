import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'erp-dashboard',
  name: 'ERP Dashboard',
  description: 'Business overview',
  icon: 'BarChart3',
  category: 'erp',
  version: '1.0.0',
  width: 900,
  height: 600,
  minWidth: 300,
  minHeight: 200,
  singleton: true,
  requiresAuth: false,
  permissions: [],
  component: lazy(() => import('./index')),
};
