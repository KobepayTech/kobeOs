import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AccountService } from './account.service';

@UseGuards(JwtAuthGuard)
@Controller('account')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get('export')
  exportData(@CurrentUser('id') uid: string) {
    return this.account.exportData(uid);
  }

  @Post('import')
  importData(@CurrentUser('id') uid: string, @Body() body: unknown) {
    return this.account.importData(uid, (body ?? {}) as Record<string, never>);
  }
}
