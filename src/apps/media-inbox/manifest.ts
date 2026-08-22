import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'media-inbox',
  name: 'Media Inbox',
  description: 'Bulk-upload images, classify them, create products or module assets, and move completed media out of the unprocessed gallery.',
  icon: 'Images',
  category: 'erp',
  version: '1.0.0',
  width: 1280,
  height: 820,
  minWidth: 720,
  minHeight: 540,
  singleton: true,
  requiresAuth: true,
  permissions: ['media:read', 'media:write', 'products:write'],
  subscriptionTier: 'pro',
  component: lazy(() => import('./index')),
};
