import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'erp-summary',
  name: 'Sales & Expenses',
  description: 'Quick-entry book for daily sales totals and expenses. Offline-first.',
  icon: 'NotebookPen',
  category: 'erp',
  version: '1.0.0',
  width: 720,
  height: 760,
  minWidth: 360,
  minHeight: 480,
  singleton: true,
  requiresAuth: false,
  permissions: [],
  subscriptionTier: 'free',
  component: lazy(() => import('./index')),
};
