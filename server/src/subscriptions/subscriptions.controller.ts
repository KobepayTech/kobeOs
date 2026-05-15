import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto, UpdateSubscriptionDto } from './dto/subscription.dto';

@UseGuards(JwtAuthGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly svc: SubscriptionsService) {}

  @Get() list(@CurrentUser('id') uid: string) { return this.svc.list(uid); }
  @Get(':id') get(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.svc.get(uid, id); }
  @Post() create(@CurrentUser('id') uid: string, @Body() dto: CreateSubscriptionDto) { return this.svc.create(uid, dto); }
  @Patch(':id') update(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateSubscriptionDto) { return this.svc.update(uid, id, dto); }
  @Delete(':id') remove(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.svc.remove(uid, id); }
}
