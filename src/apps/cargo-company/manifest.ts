import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'cargo-company',
  name: 'Cargo Company Admin',
  description: 'Company admin - Manage receivers, notifications, SMS gateway',
  icon: 'Shield',
  category: 'erp',
  version: '1.0.0',
  width: 1000,
  height: 800,
  minWidth: 400,
  minHeight: 350,
  singleton: true,
  requiresAuth: false,
  permissions: [],
  component: lazy(() => import('./index')),
};
