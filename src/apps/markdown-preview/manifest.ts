import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'markdown-preview',
  name: 'Markdown Preview',
  description: 'Render markdown',
  icon: 'FileCode',
  category: 'development',
  version: '1.0.0',
  width: 600,
  height: 500,
  minWidth: 300,
  minHeight: 200,
  singleton: false,
  requiresAuth: false,
  permissions: [],
  component: lazy(() => import('./index')),
};
