import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'video-conference',
  name: 'Video Conference',
  description: 'Video calls',
  icon: 'Video',
  category: 'communication',
  version: '1.0.0',
  width: 800,
  height: 500,
  minWidth: 300,
  minHeight: 200,
  singleton: false,
  requiresAuth: false,
  permissions: [],
  component: lazy(() => import('./index')),
};
