import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'kobe-cargo-exchange',
  name: 'Kobe Cargo Exchange',
  description: 'Air cargo exchange — passenger kilo marketplace, flight tracking, agent negotiation, P&L dashboard',
  icon: 'PlaneTakeoff',
  category: 'erp',
  version: '1.0.0',
  width: 1200,
  height: 750,
  minWidth: 800,
  minHeight: 500,
  singleton: true,
  requiresAuth: false,
  permissions: [],
  subscriptionTier: 'pro',
  component: lazy(() => import('./index')),
};
