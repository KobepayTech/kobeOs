import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'file-manager',
  name: 'File Manager',
  description: 'Browse and manage files',
  icon: 'FolderOpen',
  category: 'system',
  version: '1.0.0',
  width: 800,
  height: 600,
  minWidth: 300,
  minHeight: 200,
  singleton: false,
  requiresAuth: false,
  permissions: [],
  component: lazy(() => import('./index')),
};
