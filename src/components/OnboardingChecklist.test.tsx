import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import OnboardingChecklist from './OnboardingChecklist';
import * as onboarding from '@/lib/onboarding';
import type { OnboardingState } from '@/lib/onboarding';

const state = (over: Partial<OnboardingState> = {}): OnboardingState => ({
  status: 'PROFILE_CREATION',
  completed: false,
  completedCount: 0,
  totalCount: 3,
  steps: [
    { step: 'PROFILE_CREATION', done: false, skipped: false },
    { step: 'BUSINESS_SETUP', done: false, skipped: false },
    { step: 'APPS_INSTALLATION', done: false, skipped: false },
  ],
  ...over,
});

describe('OnboardingChecklist', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('shows the outstanding steps and the progress', async () => {
    vi.spyOn(onboarding, 'fetchOnboarding').mockResolvedValue(state({ completedCount: 1 }));
    render(<OnboardingChecklist />);

    expect(await screen.findByText('Finish setting up')).toBeTruthy();
    expect(screen.getByText(/1 of 3 done/)).toBeTruthy();
    expect(screen.getByText('Name your business')).toBeTruthy();
  });

  it('renders nothing when the account has finished', async () => {
    vi.spyOn(onboarding, 'fetchOnboarding').mockResolvedValue(
      state({ completed: true, status: 'COMPLETED', completedCount: 3 }),
    );
    const { container } = render(<OnboardingChecklist />);
    await waitFor(() => expect(container.firstChild).toBeNull());
  });

  it('renders nothing when the server cannot be reached', async () => {
    // KobeOS runs offline on a shop counter; a checklist that cannot load
    // must disappear rather than block or show an error.
    vi.spyOn(onboarding, 'fetchOnboarding').mockResolvedValue(null);
    const { container } = render(<OnboardingChecklist />);
    await waitFor(() => expect(container.firstChild).toBeNull());
  });

  it('marks a finished step as done and stops offering it', async () => {
    vi.spyOn(onboarding, 'fetchOnboarding').mockResolvedValue(state({
      completedCount: 1,
      steps: [
        { step: 'PROFILE_CREATION', done: true, skipped: false },
        { step: 'BUSINESS_SETUP', done: false, skipped: false },
        { step: 'APPS_INSTALLATION', done: false, skipped: false },
      ],
    }));
    render(<OnboardingChecklist />);

    await screen.findByText('Add your name');
    // A completed step keeps its title but loses its call to action.
    expect(screen.queryByText('Open settings')).toBeNull();
    expect(screen.getByText('Open store settings')).toBeTruthy();
  });

  it('skips a step and takes the server\'s answer as the new state', async () => {
    vi.spyOn(onboarding, 'fetchOnboarding').mockResolvedValue(state());
    const skip = vi.spyOn(onboarding, 'skipOnboardingStep').mockResolvedValue(state({
      status: 'BUSINESS_SETUP',
      steps: [
        { step: 'PROFILE_CREATION', done: false, skipped: true },
        { step: 'BUSINESS_SETUP', done: false, skipped: false },
        { step: 'APPS_INSTALLATION', done: false, skipped: false },
      ],
    }));

    render(<OnboardingChecklist />);
    await screen.findByText('Add your name');
    fireEvent.click(screen.getAllByText('Skip')[0]);

    expect(skip).toHaveBeenCalledWith('PROFILE_CREATION');
    expect(await screen.findByText('· skipped')).toBeTruthy();
  });

  it('disappears once dismissed', async () => {
    vi.spyOn(onboarding, 'fetchOnboarding').mockResolvedValue(state());
    vi.spyOn(onboarding, 'dismissOnboarding').mockResolvedValue(
      state({ completed: true, status: 'COMPLETED' }),
    );

    const { container } = render(<OnboardingChecklist />);
    await screen.findByText('Finish setting up');
    fireEvent.click(screen.getByLabelText('Dismiss setup checklist'));

    await waitFor(() => expect(container.firstChild).toBeNull());
  });

  it('opens the route for a step instead of guessing', async () => {
    vi.spyOn(onboarding, 'fetchOnboarding').mockResolvedValue(state());
    const onNavigate = vi.fn();
    render(<OnboardingChecklist onNavigate={onNavigate} />);

    await screen.findByText('Add your name');
    fireEvent.click(screen.getByText(/Open settings/));
    expect(onNavigate).toHaveBeenCalledWith('/settings');
  });
});
