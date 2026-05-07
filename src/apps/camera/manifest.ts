import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'camera',
  name: 'Camera',
  description: 'Webcam capture',
  icon: 'Camera',
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
