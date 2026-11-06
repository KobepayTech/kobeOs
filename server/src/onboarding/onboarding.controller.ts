import { GuidedSetupDto } from './guided-setup.dto';
import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
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

  @Get('guided') guided(@CurrentUser('id') uid: string) { return this.svc.guided(uid); }

  @Put('guided') saveGuided(@CurrentUser('id') uid: string, @Body() dto: GuidedSetupDto) { return this.svc.saveGuided(uid, dto); }

  @Get() status(@CurrentUser('id') uid: string) { return this.svc.status(uid); }

  @Post('skip') skip(@CurrentUser('id') uid: string, @Body() dto: StepDto) {
    return this.svc.skip(uid, dto.step);
  }

  @Post('resume') resume(@CurrentUser('id') uid: string, @Body() dto: StepDto) {
    return this.svc.resume(uid, dto.step);
  }

  @Post('dismiss') dismiss(@CurrentUser('id') uid: string) { return this.svc.dismiss(uid); }
}
