import { lazy } from 'react';
import type { AppManifest } from '@/os/types';
export const manifest: AppManifest = {
  id: 'kobe-coach',
  name: 'Kobe Coach',
  description: 'Coach & team-admin PWA — manage teams, squads and match lineups from your phone. Installable standalone at /coach.',
  icon: 'Goal',
  category: 'sports',
  version: '1.0.0',
  width: 900,
  height: 760,
  minWidth: 360,
  minHeight: 380,
  singleton: true,
  requiresAuth: true,
  permissions: [],
  subscriptionTier: 'trial',
  component: lazy(() => import('./index')),
};
