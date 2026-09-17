import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { StoreSettings } from '../store-settings/store-settings.entity';
import { AppEntitlement } from '../app-marketplace/app-entitlement.entity';
import { ONBOARDING_STEPS, OnboardingStep, UserOnboarding } from './onboarding.entity';
import { OnboardingState, deriveOnboarding } from './onboarding.rules';

@Injectable()
export class OnboardingService {
  constructor(
    @InjectRepository(UserOnboarding) private readonly repo: Repository<UserOnboarding>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(StoreSettings) private readonly settings: Repository<StoreSettings>,
    @InjectRepository(AppEntitlement) private readonly entitlements: Repository<AppEntitlement>,
  ) {}

  /** Read the live records and work out where this account is. */
  async status(ownerId: string): Promise<OnboardingState> {
    const [user, settings, installedAppCount, record] = await Promise.all([
      this.users.findOne({ where: { id: ownerId } }),
      this.settings.findOne({ where: { ownerId } }),
      // Only entitlements that represent a usable app — a failed or expired
      // install is not an app the user has.
      this.entitlements.count({ where: { userId: ownerId, status: In(['trialing', 'active']) } }),
      this.repo.findOne({ where: { ownerId } }),
    ]);

    return deriveOnboarding({
      displayName: user?.displayName ?? '',
      email: user?.email ?? '',
      storeName: settings?.storeName ?? '',
      installedAppCount,
      skippedSteps: record?.skippedSteps ?? [],
      dismissed: !!record?.dismissedAt,
    });
  }

  async skip(ownerId: string, step: OnboardingStep): Promise<OnboardingState> {
    if (!ONBOARDING_STEPS.includes(step)) {
      throw new BadRequestException(`"${step}" is not a step that can be skipped.`);
    }
    const record = await this.record(ownerId);
    if (!record.skippedSteps.includes(step)) {
      record.skippedSteps = [...record.skippedSteps, step];
      await this.repo.save(record);
    }
    return this.status(ownerId);
  }

  /** Un-skip a step so the user can come back to it from the checklist. */
  async resume(ownerId: string, step: OnboardingStep): Promise<OnboardingState> {
    const record = await this.record(ownerId);
    if (record.skippedSteps.includes(step) || record.dismissedAt) {
      record.skippedSteps = record.skippedSteps.filter((entry) => entry !== step);
      record.dismissedAt = null;
      await this.repo.save(record);
    }
    return this.status(ownerId);
  }

  /** Dismiss onboarding entirely — "I'll set this up later". */
  async dismiss(ownerId: string): Promise<OnboardingState> {
    const record = await this.record(ownerId);
    record.dismissedAt = record.dismissedAt ?? new Date();
    await this.repo.save(record);
    return this.status(ownerId);
  }

  private async record(ownerId: string): Promise<UserOnboarding> {
    const existing = await this.repo.findOne({ where: { ownerId } });
    if (existing) return existing;
    return this.repo.create({ ownerId, skippedSteps: [], dismissedAt: null });
  }
}
