import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'snake',
  name: 'Snake',
  description: 'Classic snake game',
  icon: 'Gamepad2',
  category: 'games',
  version: '1.0.0',
  width: 500,
  height: 500,
  minWidth: 300,
  minHeight: 200,
  singleton: false,
  requiresAuth: false,
  permissions: [],
  component: lazy(() => import('./index')),
};
