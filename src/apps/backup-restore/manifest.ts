import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'backup-restore',
  name: 'Backup & Restore',
  description: 'Data backup and restore',
  icon: 'Archive',
  category: 'system',
  version: '1.0.0',
  width: 500,
  height: 400,
  minWidth: 300,
  minHeight: 200,
  singleton: false,
  requiresAuth: false,
  permissions: [],
  component: lazy(() => import('./index')),
};
