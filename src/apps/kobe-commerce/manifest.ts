import { lazy } from 'react';
import type { AppManifest } from '@/os/types';
export const manifest: AppManifest = { id: 'kobe-commerce', name: 'Kobe Commerce', description: 'Business identity, commercial shops, Jumla orders, live catalogue posting, Kobe Lite and Cars.', icon: 'Store', category: 'erp', version: '1.0.0', width: 1180, height: 760, minWidth: 390, minHeight: 420, singleton: true, requiresAuth: true, permissions: [], subscriptionTier: 'trial', component: lazy(() => import('./index')) };
