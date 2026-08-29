import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../common/public.decorator';
import { ReceptionService } from './reception.service';
import type { Receptionist, ReceptionSession } from './reception.entity';

/** Owner configuration of their AI receptionist. */
@Controller('reception')
export class ReceptionController {
  constructor(private readonly svc: ReceptionService) {}

  @Get()
  mine(@CurrentUser('id') uid: string) { return this.svc.listMine(uid); }

  @Post()
  upsert(@CurrentUser('id') uid: string, @Body() dto: Partial<Receptionist> & { slug: string; businessName: string }) {
    return this.svc.upsert(uid, dto);
  }

  @Get(':id/leads')
  leads(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.svc.leadsFor(uid, id); }
}

/** Public customer-facing surface — the widget / QR / WhatsApp / voice worker all
 * call this. Identified by the receptionist slug; no login. */
@Public()
@Controller('reception-public')
export class ReceptionPublicController {
  constructor(private readonly svc: ReceptionService) {}

  @Get(':slug')
  profile(@Param('slug') slug: string) { return this.svc.publicProfile(slug); }

  @Post(':slug/message')
  message(
    @Param('slug') slug: string,
    @Body() dto: { sessionId?: string; text: string; channel?: ReceptionSession['channel']; customer?: { name?: string; phone?: string } },
  ) {
    return this.svc.message(slug, dto);
  }
}
