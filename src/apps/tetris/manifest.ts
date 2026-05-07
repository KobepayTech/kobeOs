import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'tetris',
  name: 'Tetris',
  description: 'Block puzzle game',
  icon: 'Puzzle',
  category: 'games',
  version: '1.0.0',
  width: 400,
  height: 550,
  minWidth: 300,
  minHeight: 200,
  singleton: false,
  requiresAuth: false,
  permissions: [],
  component: lazy(() => import('./index')),
};
