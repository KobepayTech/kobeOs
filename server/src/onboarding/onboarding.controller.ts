import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsEnum } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { OnboardingStep } from './onboarding.entity';
import { OnboardingService } from './onboarding.service';
import { SetupProvisioningService } from './setup-provisioning.service';
import { ProvisionSetupDto, SetupAnswersDto } from './setup-plan.dto';

class StepDto {
  @IsEnum(OnboardingStep) step!: OnboardingStep;
}

@UseGuards(JwtAuthGuard)
@Controller('onboarding')
export class OnboardingController {
  constructor(
    private readonly svc: OnboardingService,
    private readonly setup: SetupProvisioningService,
  ) {}

  /**
   * The workspace this business probably needs, from the interview answers.
   * Changes nothing: the owner reads it and ticks what they want.
   */
  @Post('setup-plan')
  plan(@Body() dto: SetupAnswersDto) {
    return this.setup.plan(dto);
  }

  /** Install the bundles and create the automations the owner ticked. */
  @Post('provision')
  provision(@CurrentUser('id') uid: string, @Body() dto: ProvisionSetupDto) {
    return this.setup.provision(uid, dto.answers, {
      bundleIds: dto.bundleIds,
      automationKeys: dto.automationKeys,
    });
  }

  @Get() status(@CurrentUser('id') uid: string) { return this.svc.status(uid); }

  @Post('skip') skip(@CurrentUser('id') uid: string, @Body() dto: StepDto) {
    return this.svc.skip(uid, dto.step);
  }

  @Post('resume') resume(@CurrentUser('id') uid: string, @Body() dto: StepDto) {
    return this.svc.resume(uid, dto.step);
  }

  @Post('dismiss') dismiss(@CurrentUser('id') uid: string) { return this.svc.dismiss(uid); }
}
