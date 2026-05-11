import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'kobe-print',
  name: 'KobePrint',
  description: 'All-in-one print shop management - Designer Studio, Jersey Customizer, Vinyl Cutter, AI Generator, 3D Preview, Production Workflow',
  icon: 'Printer',
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
