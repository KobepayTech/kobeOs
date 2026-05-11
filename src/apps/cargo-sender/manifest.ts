import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'cargo-sender',
  name: 'Cargo Sender',
  description: 'Send parcels worldwide - Easy shipping from China to Tanzania',
  icon: 'Send',
  category: 'erp',
  version: '1.0.0',
  width: 900,
  height: 750,
  minWidth: 400,
  minHeight: 350,
  singleton: true,
  requiresAuth: false,
  permissions: [],
  component: lazy(() => import('./index')),
};
