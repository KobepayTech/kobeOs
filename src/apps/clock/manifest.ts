import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'clock',
  name: 'Clock',
  description: 'Clock, alarm, timer, stopwatch',
  icon: 'Clock',
  category: 'system',
  version: '1.0.0',
  width: 420,
  height: 500,
  minWidth: 300,
  minHeight: 200,
  singleton: false,
  requiresAuth: false,
  permissions: [],
  component: lazy(() => import('./index')),
};
