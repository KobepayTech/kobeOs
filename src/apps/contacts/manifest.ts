import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'contacts',
  name: 'Contacts',
  description: 'Contact management',
  icon: 'Users',
  category: 'communication',
  version: '1.0.0',
  width: 500,
  height: 450,
  minWidth: 300,
  minHeight: 200,
  singleton: false,
  requiresAuth: false,
  permissions: [],
  component: lazy(() => import('./index')),
};
