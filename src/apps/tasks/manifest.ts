import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'tasks',
  name: 'Tasks',
  description: 'To-do lists and tasks',
  icon: 'ListChecks',
  category: 'productivity',
  version: '1.0.0',
  width: 720,
  height: 520,
  minWidth: 480,
  minHeight: 320,
  singleton: false,
  requiresAuth: false,
  permissions: [],
  component: lazy(() => import('./index')),
};
