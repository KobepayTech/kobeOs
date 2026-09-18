import { api } from './api';

export type OnboardingStep =
  | 'PROFILE_CREATION'
  | 'BUSINESS_SETUP'
  | 'APPS_INSTALLATION'
  | 'COMPLETED';

export interface OnboardingStepState {
  step: Exclude<OnboardingStep, 'COMPLETED'>;
  done: boolean;
  skipped: boolean;
}

export interface OnboardingState {
  status: OnboardingStep;
  steps: OnboardingStepState[];
  completed: boolean;
  completedCount: number;
  totalCount: number;
}

/** Everything the checklist needs to render one row. */
export const STEP_COPY: Record<Exclude<OnboardingStep, 'COMPLETED'>, {
  title: string;
  detail: string;
  action: string;
  /** Desktop route the action opens. */
  href: string;
}> = {
  PROFILE_CREATION: {
    title: 'Add your name',
    detail: 'So receipts, reports and messages show who they came from.',
    action: 'Open settings',
    href: '/settings',
  },
  BUSINESS_SETUP: {
    title: 'Name your business',
    detail: 'Used on your storefront, receipts and invoices.',
    action: 'Open store settings',
    href: '/store',
  },
  APPS_INSTALLATION: {
    title: 'Install the apps you need',
    detail: 'KobeOS ships around thirty — install only the ones you use.',
    action: 'Open App Store',
    href: '/store',
  },
};

/**
 * The server derives progress from real records, so this is a read, not a
 * cursor the client advances. A failure is never fatal: KobeOS runs offline,
 * and a checklist must not be able to block someone from using their shop.
 */
export async function fetchOnboarding(): Promise<OnboardingState | null> {
  try {
    return await api<OnboardingState>('/onboarding');
  } catch {
    return null;
  }
}

export async function skipOnboardingStep(step: OnboardingStepState['step']): Promise<OnboardingState | null> {
  try {
    return await api<OnboardingState>('/onboarding/skip', {
      method: 'POST',
      body: JSON.stringify({ step }),
      offlineFallback: false,
    });
  } catch {
    return null;
  }
}

export async function dismissOnboarding(): Promise<OnboardingState | null> {
  try {
    return await api<OnboardingState>('/onboarding/dismiss', {
      method: 'POST',
      body: '{}',
      offlineFallback: false,
    });
  } catch {
    return null;
  }
}
