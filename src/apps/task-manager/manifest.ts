import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'task-manager',
  name: 'Task Manager',
  description: 'System processes and resources',
  icon: 'Activity',
  category: 'system',
  version: '1.0.0',
  width: 600,
  height: 400,
  minWidth: 300,
  minHeight: 200,
  singleton: true,
  requiresAuth: false,
  permissions: [],
  component: lazy(() => import('./index')),
};
