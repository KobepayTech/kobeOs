import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'kanban',
  name: 'Kanban',
  description: 'Task boards',
  icon: 'Layout',
  category: 'productivity',
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
