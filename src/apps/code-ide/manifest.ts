import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'code-ide',
  name: 'Code IDE',
  description: 'Integrated development environment',
  icon: 'Code2',
  category: 'development',
  version: '1.0.0',
  width: 900,
  height: 650,
  minWidth: 300,
  minHeight: 200,
  singleton: false,
  requiresAuth: false,
  permissions: [],
  component: lazy(() => import('./index')),
};
