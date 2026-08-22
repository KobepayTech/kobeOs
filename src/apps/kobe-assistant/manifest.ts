import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'kobe-assistant',
  name: 'Ask Kobe',
  description: 'Chat with your business',
  icon: 'Sparkles',
  category: 'ai',
  version: '1.0.0',
  width: 520,
  height: 680,
  minWidth: 340,
  minHeight: 420,
  singleton: true,
  requiresAuth: false,
  permissions: [],
  subscriptionTier: 'pro',
  component: lazy(() => import('./index')),
};
