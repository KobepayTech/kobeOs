import { lazy } from 'react';
import type { AppManifest } from '../../src/os/types';

export const manifest: AppManifest = {
  id:           'kobe-creator',
  name:         'Creator Platform',
  description:  'Video, music, design, and content publishing tools.',
  icon:         'Palette',
  category:     'creative',
  version:      '1.0.0',
  width:        1200,
  height:       750,
  minWidth:     900,
  minHeight:    600,
  singleton:    false,
  requiresAuth: true,
  permissions:  ['camera', 'audio'],
  component:    lazy(() => import('../../src/apps/creator/index')),
};
