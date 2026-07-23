import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'kobe-agents',
  name: 'Kobe Agents',
  description: 'Create permissioned AI agents that run on a schedule, require approval where needed, and keep complete run logs.',
  icon: 'Bot',
  category: 'productivity',
  version: '1.0.0',
  width: 1280,
  height: 820,
  minWidth: 680,
  minHeight: 520,
  singleton: true,
  requiresAuth: true,
  permissions: [],
  subscriptionTier: 'pro',
  component: lazy(() => import('./index')),
};
