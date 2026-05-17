import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'kobe-sports',
  name: 'KobeSports',
  description: 'Sports analytics platform — live scores, match events, player tracking, heatmaps, xG, VAR review, AI commentary and tactical reports',
  icon: 'Trophy',
  category: 'sports',
  version: '1.0.0',
  width: 1200,
  height: 800,
  minWidth: 800,
  minHeight: 600,
  singleton: true,
  requiresAuth: false,
  permissions: [],
  component: lazy(() => import('./index')),
};
