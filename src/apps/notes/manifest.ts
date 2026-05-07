import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'notes',
  name: 'Notes',
  description: 'Advanced note-taking',
  icon: 'BookOpen',
  category: 'productivity',
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
