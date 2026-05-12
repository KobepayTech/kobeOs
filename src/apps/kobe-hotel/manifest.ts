import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'kobe-hotel',
  name: 'KobeHotel OS',
  description: 'Complete hospitality management - Reception, Rooms, Bar POS, Restaurant POS, Inventory, Staff, Accounting, QR Ordering',
  icon: 'Building2',
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
