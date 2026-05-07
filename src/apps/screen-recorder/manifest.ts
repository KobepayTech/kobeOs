import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'screen-recorder',
  name: 'Screen Recorder',
  description: 'Record screen',
  icon: 'ScreenShare',
  category: 'media',
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
