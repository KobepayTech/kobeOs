import { lazy } from 'react';
import type { AppManifest } from '@/os/types';
export const manifest: AppManifest = { id: 'kobe-accountant', name: 'Kobe Accountant', description: 'Autonomous transaction capture, owner questions, call escalation, daily close and financial statements.', icon: 'BrainCircuit', category: 'erp', version: '1.0.0', width: 1180, height: 760, minWidth: 390, minHeight: 420, singleton: true, requiresAuth: true, permissions: [], subscriptionTier: 'pro', component: lazy(() => import('./index')) };
