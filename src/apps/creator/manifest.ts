import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'creator',
  name: 'Creator',
  description: 'Influencer Escrow & Performance Marketing - Campaigns, Creator Marketplace, Escrow Payments, KPI Tracking, Affiliate Links',
  icon: 'Users',
  category: 'erp',
  version: '1.0.0',
  width: 1100,
  height: 750,
  minWidth: 400,
  minHeight: 350,
  singleton: true,
  requiresAuth: false,
  permissions: [],
  component: lazy(() => import('./index')),
};
