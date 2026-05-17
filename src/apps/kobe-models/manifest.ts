import { lazy } from 'react';
import type { AppManifest } from '@/os/types';

export const manifest: AppManifest = {
  id: 'kobe-models',
  name: 'Model Manager',
  description: 'Browse, download and manage local AI models — chat, coding, vision, sports and embedding models from the Kobe catalogue',
  icon: 'BrainCircuit',
  category: 'system',
  version: '1.0.0',
  width: 1100,
  height: 750,
  minWidth: 700,
  minHeight: 500,
  singleton: true,
  requiresAuth: false,
  permissions: [],
  component: lazy(() => import('./index')),
};
