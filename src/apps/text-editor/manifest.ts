import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'text-editor',
  name: 'Text Editor',
  description: 'Code and text editor',
  icon: 'FileText',
  category: 'development',
  version: '1.0.0',
  width: 700,
  height: 500,
  minWidth: 300,
  minHeight: 200,
  singleton: false,
  requiresAuth: false,
  permissions: [],
  component: lazy(() => import('./index')),
};
