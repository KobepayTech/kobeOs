import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

// cargo-company has been consolidated into cargo-owner
// This manifest redirects to the cargo-owner app
export const manifest: AppManifest = {
  id: 'cargo-company',
  name: 'Cargo Company Admin',
  description: '[DEPRECATED] Use Cargo Owner instead',
  icon: 'Shield',
  category: 'erp',
  version: '1.0.0',
  width: 900,
  height: 750,
  minWidth: 400,
  minHeight: 350,
  singleton: true,
  requiresAuth: false,
  permissions: [],
  subscriptionTier: 'pro',
  component: lazy(() => import('../cargo-owner/index')),
};
