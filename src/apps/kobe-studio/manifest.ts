import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'kobe-studio',
  name: 'Kobe Studio',
  description: 'AI short videos, ads, scripts and voiceovers — Media Studios powered by MoneyPrinterTurbo, plus Creator Marketplace, Brand Studio and Football Analytics workspaces.',
  icon: 'Clapperboard',
  category: 'media',
  version: '1.0.0',
  width: 1200,
  height: 780,
  minWidth: 480,
  minHeight: 360,
  singleton: true,
  requiresAuth: false,
  permissions: [],
  subscriptionTier: 'pro',
  component: lazy(() => import('./index')),
};
