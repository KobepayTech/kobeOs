import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsEnum } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { OnboardingStep } from './onboarding.entity';
import { OnboardingService } from './onboarding.service';

class StepDto {
  @IsEnum(OnboardingStep) step!: OnboardingStep;
}

@UseGuards(JwtAuthGuard)
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly svc: OnboardingService) {}

  @Get() status(@CurrentUser('id') uid: string) { return this.svc.status(uid); }

  @Post('skip') skip(@CurrentUser('id') uid: string, @Body() dto: StepDto) {
    return this.svc.skip(uid, dto.step);
  }

  @Post('resume') resume(@CurrentUser('id') uid: string, @Body() dto: StepDto) {
    return this.svc.resume(uid, dto.step);
  }

  @Post('dismiss') dismiss(@CurrentUser('id') uid: string) { return this.svc.dismiss(uid); }
}
