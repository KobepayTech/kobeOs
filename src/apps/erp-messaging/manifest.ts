import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'erp-messaging',
  name: 'Customer Messaging',
  description: 'Bulk SMS + WhatsApp to your customer list',
  icon: 'Send',
  category: 'erp',
  version: '1.0.0',
  width: 880,
  height: 620,
  minWidth: 360,
  minHeight: 280,
  singleton: true,
  requiresAuth: true,
  permissions: [],
  subscriptionTier: 'pro',
  component: lazy(() => import('./index')),
};
