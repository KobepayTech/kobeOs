import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { StoreSettingsService } from './store-settings.service';
import { UpsertStoreSettingsDto } from './dto/store-settings.dto';

@UseGuards(JwtAuthGuard)
@Controller('store-settings')
export class StoreSettingsController {
  constructor(private readonly svc: StoreSettingsService) {}

  @Get() get(@CurrentUser('id') uid: string) { return this.svc.get(uid); }
  @Put() upsert(@CurrentUser('id') uid: string, @Body() dto: UpsertStoreSettingsDto) { return this.svc.upsert(uid, dto); }
}
