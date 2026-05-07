import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'spreadsheet',
  name: 'Spreadsheet',
  description: 'Spreadsheet application',
  icon: 'Table',
  category: 'productivity',
  version: '1.0.0',
  width: 800,
  height: 600,
  minWidth: 300,
  minHeight: 200,
  singleton: false,
  requiresAuth: false,
  permissions: [],
  component: lazy(() => import('./index')),
};
