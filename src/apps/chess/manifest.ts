import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'chess',
  name: 'Chess',
  description: 'Strategy board game',
  icon: 'Trophy',
  category: 'games',
  version: '1.0.0',
  width: 600,
  height: 600,
  minWidth: 300,
  minHeight: 200,
  singleton: false,
  requiresAuth: false,
  permissions: [],
  component: lazy(() => import('./index')) as unknown as AppManifest['component'],
};
