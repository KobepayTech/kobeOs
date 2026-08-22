import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../common/public.decorator';
import { AccountantService } from './accountant.service';

@UseGuards(JwtAuthGuard)
@Controller('accountant')
export class AccountantController {
  constructor(private readonly accountant: AccountantService) {}
  @Get() dashboard(@CurrentUser('id') uid: string) { return this.accountant.list(uid); }
  @Post('sync') sync() { return this.accountant.aggregateOperations(); }
  @Post('questions/:id/answer') answer(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() body: { answer: string; via?: 'CHAT' | 'CALL' | 'MANUAL'; classificationType?: 'INCOME' | 'EXPENSE' | 'ASSET' | 'LIABILITY' | 'EQUITY' | 'TRANSFER' | 'IGNORE'; category?: string; accountCode?: string; confidence?: number }) { return this.accountant.answerQuestion(uid, id, body); }
  @Post('classifications/:id/correct') correct(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() body: { answer: string; classificationType?: 'INCOME' | 'EXPENSE' | 'ASSET' | 'LIABILITY' | 'EQUITY' | 'TRANSFER' | 'IGNORE'; category?: string; accountCode?: string; confidence?: number }) { return this.accountant.correctClassification(uid, id, body); }
  @Get('statements') statements(@CurrentUser('id') uid: string, @Query('from') from?: string, @Query('to') to?: string) { return this.accountant.statements(uid, from, to); }
  @Post('daily-close') close(@CurrentUser('id') uid: string, @Body('date') date?: string) { return this.accountant.closeDay(uid, date); }
}

@Public()
@Controller('accountant-public')
export class AccountantPublicController {
  constructor(private readonly accountant: AccountantService) {}
  @Post('calls/:token/answer') answer(@Param('token') token: string, @Body() body: { answer: string; transcript?: string; providerPayload?: Record<string, unknown> }) { return this.accountant.answerCall(token, body); }
}
