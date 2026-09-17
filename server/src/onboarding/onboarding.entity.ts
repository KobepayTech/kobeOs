import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

/**
 * Steps a new KobeOS account walks through before the desktop is useful.
 *
 * The order is the order they are presented in. COMPLETED is a terminal
 * marker, not a step someone performs.
 *
 * Deliberately absent, because KobeOS has no infrastructure behind them yet
 * and a step that cannot be satisfied is a step that traps the user:
 *   - contact verification (no email/SMS verification exists)
 *   - team invites (there is no multi-user-under-one-owner model)
 * Add them here once the feature behind them is real.
 */
export enum OnboardingStep {
  PROFILE_CREATION = 'PROFILE_CREATION',
  BUSINESS_SETUP = 'BUSINESS_SETUP',
  APPS_INSTALLATION = 'APPS_INSTALLATION',
  COMPLETED = 'COMPLETED',
}

/** The steps a user actually performs, in presentation order. */
export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  OnboardingStep.PROFILE_CREATION,
  OnboardingStep.BUSINESS_SETUP,
  OnboardingStep.APPS_INSTALLATION,
] as const;

/**
 * Only the decisions a user made that cannot be read back from their data:
 * which steps they chose to skip, and whether they dismissed onboarding.
 *
 * Progress itself is NOT stored. It is derived from the real records — the
 * profile name, the store settings, the app entitlements — so that a user who
 * sets their business up by some other route is never told to do it again, and
 * so a stale flag can never strand someone on a step they already finished.
 */
@Entity('user_onboarding')
export class UserOnboarding extends BaseEntity {
  /**
   * One row per owner. Declared here rather than inherited from OwnedEntity,
   * which already puts a plain index on ownerId — keeping both meant two
   * indexes on the same column and synchronize failing with
   * "relation ... already exists". StoreSettings is the same shape for the
   * same reason. The name matches the migration so the two agree.
   */
  @Index('IDX_user_onboarding_owner', { unique: true })
  @Column('uuid')
  ownerId!: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  skippedSteps!: OnboardingStep[];

  @Column({ type: 'timestamptz', nullable: true })
  dismissedAt?: Date | null;
}
