import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AppStateService } from './app-state.service';

/**
 * GET  /api/app-state/:key  → { key, value, updatedAt }  (value null if unset)
 * PUT  /api/app-state/:key  { value } → upsert the owner's blob for that key
 *
 * Owner-scoped via JWT. `value` is a plain object body (no DTO class), so the
 * global whitelist ValidationPipe passes it through untouched.
 */
@UseGuards(JwtAuthGuard)
@Controller('app-state')
export class AppStateController {
  constructor(private readonly svc: AppStateService) {}

  @Get(':key')
  get(@CurrentUser('id') uid: string, @Param('key') key: string) {
    return this.svc.get(uid, key);
  }

  @Put(':key')
  put(@CurrentUser('id') uid: string, @Param('key') key: string, @Body() body: { value: unknown }) {
    return this.svc.put(uid, key, body?.value);
  }
}
