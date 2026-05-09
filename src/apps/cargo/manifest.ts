import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'cargo',
  name: 'KOBECARGO',
  description: 'Air cargo logistics - China to Tanzania shipments, customs, warehouse, flights, tracking',
  icon: 'Plane',
  category: 'erp',
  version: '1.0.0',
  width: 1000,
  height: 700,
  minWidth: 400,
  minHeight: 350,
  singleton: true,
  requiresAuth: false,
  permissions: [],
  component: lazy(() => import('./index')),
};
