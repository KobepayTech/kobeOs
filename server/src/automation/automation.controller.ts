import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AutomationService } from './automation.service';

class UpdateAutomationDto {
  @IsOptional() @IsBoolean() dailyReport?: boolean;
  @IsOptional() @IsString() @MaxLength(40) ownerPhone?: string;
  @IsOptional() @IsBoolean() tenantReminders?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(60) reminderDaysBefore?: number;
  @IsOptional() @IsString() @MaxLength(320) reminderMessage?: string;
  @IsOptional() @IsString() @MaxLength(320) overdueMessage?: string;
  @IsOptional() @IsString() @MaxLength(320) finalNoticeMessage?: string;
  @IsOptional() @IsInt() @Min(0) @Max(365) firmAfterDays?: number;
  @IsOptional() @IsInt() @Min(0) @Max(365) finalAfterDays?: number;
}

@ApiTags('AI / Automation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('automation')
export class AutomationController {
  constructor(private readonly svc: AutomationService) {}

  @Get()
  @ApiOperation({ summary: 'Get the owner automation config (daily reports, tenant reminders)' })
  get(@CurrentUser('id') uid: string) { return this.svc.getConfig(uid); }

  @Put()
  @ApiOperation({ summary: 'Update the automation config' })
  update(@CurrentUser('id') uid: string, @Body() dto: UpdateAutomationDto) { return this.svc.setConfig(uid, dto); }

  @Post('run/daily-report')
  @ApiOperation({ summary: 'Send the daily owner report now (test)' })
  runReport(@CurrentUser('id') uid: string) { return this.svc.sendDailyReport(uid); }

  @Post('run/tenant-reminders')
  @ApiOperation({ summary: 'Send tenant rent reminders now (test)' })
  runReminders(@CurrentUser('id') uid: string) { return this.svc.remindTenants(uid); }
}
