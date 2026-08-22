import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'kobepay-pro',
  name: 'Kobepay Pro',
  description: 'Programmable school financial OS — student wallets, rules, merchants, deposits and settlement',
  icon: 'GraduationCap',
  category: 'erp',
  version: '1.0.0',
  width: 1200,
  height: 820,
  minWidth: 480,
  minHeight: 400,
  singleton: true,
  requiresAuth: true,
  permissions: [],
  subscriptionTier: 'pro',
  component: lazy(() => import('./index')),
};
