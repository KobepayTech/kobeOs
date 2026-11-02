import { lazy } from 'react';
import type { AppManifest } from '@/os/types';
export const manifest: AppManifest = {
  id: 'kobe-home', name: 'Kobe Home', description: 'Your business briefing, team access and six connected workspaces.',
  icon: 'House', category: 'productivity', version: '1.0.0', width: 1180, height: 800,
  minWidth: 360, minHeight: 400, singleton: true, requiresAuth: true, permissions: [],
  subscriptionTier: 'free', component: lazy(() => import('./index')),
};
