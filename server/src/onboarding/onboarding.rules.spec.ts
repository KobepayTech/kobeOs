import { OnboardingStep } from './onboarding.entity';
import { OnboardingFacts, deriveOnboarding, hasChosenDisplayName, hasNamedBusiness } from './onboarding.rules';

const base: OnboardingFacts = {
  displayName: '',
  email: 'juma@duka.co.tz',
  storeName: '',
  installedAppCount: 0,
  skippedSteps: [],
  dismissed: false,
};

describe('account onboarding', () => {
  it('starts a brand new account at the first step', () => {
    const state = deriveOnboarding(base);
    expect(state.status).toBe(OnboardingStep.PROFILE_CREATION);
    expect(state.completed).toBe(false);
    expect(state.completedCount).toBe(0);
    expect(state.totalCount).toBe(3);
  });

  it('does not count the name register() invented as a profile the user set', () => {
    // register() fills displayName from the email local part, or a generic
    // fallback for phone signups. Treating either as "done" would skip the
    // profile step for every account ever created.
    expect(hasChosenDisplayName('juma', 'juma@duka.co.tz')).toBe(false);
    expect(hasChosenDisplayName('KobeOS user', '')).toBe(false);
    expect(hasChosenDisplayName('', 'juma@duka.co.tz')).toBe(false);
    expect(hasChosenDisplayName('Juma Mwinyi', 'juma@duka.co.tz')).toBe(true);
  });

  it('does not count the untouched default store name as a business set up', () => {
    expect(hasNamedBusiness('My Store')).toBe(false);
    expect(hasNamedBusiness('  ')).toBe(false);
    expect(hasNamedBusiness('Duka la Juma')).toBe(true);
  });

  it('advances as the real records fill in, in order', () => {
    const named = { ...base, displayName: 'Juma Mwinyi' };
    expect(deriveOnboarding(named).status).toBe(OnboardingStep.BUSINESS_SETUP);

    const withShop = { ...named, storeName: 'Duka la Juma' };
    expect(deriveOnboarding(withShop).status).toBe(OnboardingStep.APPS_INSTALLATION);

    const withApps = { ...withShop, installedAppCount: 2 };
    const done = deriveOnboarding(withApps);
    expect(done.status).toBe(OnboardingStep.COMPLETED);
    expect(done.completed).toBe(true);
    expect(done.completedCount).toBe(3);
  });

  it('credits work done outside the wizard', () => {
    // Someone who named their shop in the Store Editor has done that step.
    // Deriving from records instead of a stored counter is what prevents
    // asking them to do it again.
    const state = deriveOnboarding({ ...base, storeName: 'Duka la Juma' });
    expect(state.steps.find((s) => s.step === OnboardingStep.BUSINESS_SETUP)?.done).toBe(true);
    expect(state.status).toBe(OnboardingStep.PROFILE_CREATION);
  });

  it('moves past a skipped step without marking it done', () => {
    const state = deriveOnboarding({ ...base, skippedSteps: [OnboardingStep.PROFILE_CREATION] });
    expect(state.status).toBe(OnboardingStep.BUSINESS_SETUP);
    const profile = state.steps.find((s) => s.step === OnboardingStep.PROFILE_CREATION);
    expect(profile).toMatchObject({ skipped: true, done: false });
    expect(state.completedCount).toBe(0);
  });

  it('completes when every remaining step was skipped', () => {
    const state = deriveOnboarding({ ...base, skippedSteps: [...ONBOARDING_ALL] });
    expect(state.status).toBe(OnboardingStep.COMPLETED);
    expect(state.completed).toBe(true);
    expect(state.completedCount).toBe(0);
  });

  it('stays completed once dismissed, whatever is outstanding', () => {
    const state = deriveOnboarding({ ...base, dismissed: true });
    expect(state.status).toBe(OnboardingStep.COMPLETED);
    expect(state.completed).toBe(true);
    // The checklist still reports the truth so it can be resumed.
    expect(state.completedCount).toBe(0);
  });

  it('ignores a skip recorded for a step that no longer exists', () => {
    const state = deriveOnboarding({
      ...base,
      skippedSteps: ['INVITE_TEAM' as OnboardingStep],
    });
    expect(state.status).toBe(OnboardingStep.PROFILE_CREATION);
  });
});

const ONBOARDING_ALL = [
  OnboardingStep.PROFILE_CREATION,
  OnboardingStep.BUSINESS_SETUP,
  OnboardingStep.APPS_INSTALLATION,
];
