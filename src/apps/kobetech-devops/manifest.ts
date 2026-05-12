import { lazy } from 'react';
import type { AppManifest } from '@/os/types';
export const manifest: AppManifest = {
  id: 'kobetech-devops',
  name: 'Kobetech DevOps',
  description: 'Developer portal - Module development, code commits, feature flags, deployments, issue tracking, API docs',
  icon: 'Code2',
  category: 'system',
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
