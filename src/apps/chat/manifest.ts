import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'chat',
  name: 'Chat',
  description: 'Instant messaging',
  icon: 'MessageCircle',
  category: 'communication',
  version: '1.0.0',
  width: 500,
  height: 600,
  minWidth: 300,
  minHeight: 200,
  singleton: false,
  requiresAuth: false,
  permissions: [],
  component: lazy(() => import('./index')),
};
