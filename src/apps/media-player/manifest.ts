import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'media-player',
  name: 'Media Player',
  description: 'Audio and video player',
  icon: 'Play',
  category: 'media',
  version: '1.0.0',
  width: 600,
  height: 400,
  minWidth: 300,
  minHeight: 200,
  singleton: false,
  requiresAuth: false,
  permissions: [],
  component: lazy(() => import('./index')),
};
