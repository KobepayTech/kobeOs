import { ONBOARDING_STEPS, OnboardingStep } from './onboarding.entity';

/** Default assigned by StoreSettings when a user has never named their business. */
export const DEFAULT_STORE_NAME = 'My Store';
/** Fallback display name assigned by AuthService.register for phone-only signups. */
export const DEFAULT_DISPLAY_NAME = 'KobeOS user';

/**
 * Everything the derivation needs, read from the records that already exist.
 * Keeping this a plain shape (rather than entities) is what lets the rules be
 * tested without a database.
 */
export interface OnboardingFacts {
  displayName: string;
  email: string;
  storeName: string;
  installedAppCount: number;
  skippedSteps: OnboardingStep[];
  dismissed: boolean;
}

export interface OnboardingStepState {
  step: OnboardingStep;
  done: boolean;
  skipped: boolean;
}

export interface OnboardingState {
  /** The step to present now, or COMPLETED when there is nothing left. */
  status: OnboardingStep;
  steps: OnboardingStepState[];
  completed: boolean;
  /** Steps genuinely finished, for a progress indicator. */
  completedCount: number;
  totalCount: number;
}

/**
 * register() fills displayName in for the user — from the email local part, or
 * a generic fallback — so a non-empty name does not mean they chose one. Only
 * a name that is neither of those counts as a profile the user actually set.
 */
export function hasChosenDisplayName(displayName: string, email: string): boolean {
  const name = displayName?.trim() ?? '';
  if (!name) return false;
  if (name === DEFAULT_DISPLAY_NAME) return false;
  const localPart = (email ?? '').split('@')[0]?.trim();
  if (localPart && name === localPart) return false;
  return true;
}

/** A business named anything other than the untouched default counts as set up. */
export function hasNamedBusiness(storeName: string): boolean {
  const name = storeName?.trim() ?? '';
  return !!name && name !== DEFAULT_STORE_NAME;
}

function isDone(step: OnboardingStep, facts: OnboardingFacts): boolean {
  switch (step) {
    case OnboardingStep.PROFILE_CREATION:
      return hasChosenDisplayName(facts.displayName, facts.email);
    case OnboardingStep.BUSINESS_SETUP:
      return hasNamedBusiness(facts.storeName);
    case OnboardingStep.APPS_INSTALLATION:
      return facts.installedAppCount > 0;
    default:
      return true;
  }
}

/**
 * Derive where a user is, from what they have actually done.
 *
 * Progress is never read from a stored counter: a user who named their shop
 * from the Store Editor, or installed an app from the marketplace, has done
 * the step regardless of whether they did it inside the wizard. Only skips and
 * an explicit dismissal are remembered, because nothing else can express them.
 */
export function deriveOnboarding(facts: OnboardingFacts): OnboardingState {
  const skipped = new Set(facts.skippedSteps ?? []);
  const steps: OnboardingStepState[] = ONBOARDING_STEPS.map((step) => ({
    step,
    done: isDone(step, facts),
    skipped: skipped.has(step),
  }));

  const next = steps.find((entry) => !entry.done && !entry.skipped);
  const completed = facts.dismissed || !next;

  return {
    status: completed ? OnboardingStep.COMPLETED : next!.step,
    steps,
    completed,
    completedCount: steps.filter((entry) => entry.done).length,
    totalCount: steps.length,
  };
}
