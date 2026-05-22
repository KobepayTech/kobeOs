import { lazy } from 'react';
import type { AppManifest } from '../../src/os/types';

export const manifest: AppManifest = {
  id:           'kobe-system-dashboard',
  name:         'System Dashboard',
  description:  'Live view of runtime services, drivers, network, and AI status.',
  icon:         'Activity',
  category:     'system',
  version:      '1.0.0',
  width:        900,
  height:       620,
  minWidth:     700,
  minHeight:    500,
  singleton:    true,
  requiresAuth: false,
  permissions:  [],
  component:    lazy(() => import('./index')),
};
