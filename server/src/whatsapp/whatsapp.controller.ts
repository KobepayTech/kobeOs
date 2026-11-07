import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../common/public.decorator';
import { resolvePublicApiUrl } from '../common/frontend-url';
import { ConfigService } from '@nestjs/config';
import { WhatsAppService } from './whatsapp.service';

class AutoReplyDto {
  @IsBoolean() autoReply!: boolean;
}

class SendDto {
  @IsString() @MaxLength(4000) body!: string;
}

class VerifyDto {
  @IsOptional() @IsString() challenge?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('whatsapp')
export class WhatsAppController {
  constructor(
    private readonly svc: WhatsAppService,
    private readonly config: ConfigService,
  ) {}

  @Get('settings')
  @ApiOperation({ summary: 'WhatsApp settings and the webhook URL to register with the provider' })
  async settings(@CurrentUser('id') uid: string) {
    const config = await this.svc.getSettings(uid);
    const base = resolvePublicApiUrl((key) => this.config.get<string>(key)).replace(/\/+$/, '');
    return {
      autoReply: config.autoReply,
      // The operator has to paste this into the provider, so it must be
      // absolute — a relative path is useless to Beem or Meta.
      webhookUrl: `${base}/api/whatsapp/webhook/${config.webhookToken}`,
    };
  }

  @Put('settings')
  async setAutoReply(@CurrentUser('id') uid: string, @Body() dto: AutoReplyDto) {
    const config = await this.svc.setAutoReply(uid, dto.autoReply);
    return { autoReply: config.autoReply };
  }

  @Post('settings/rotate-token')
  async rotate(@CurrentUser('id') uid: string) {
    await this.svc.rotateToken(uid);
    return this.settings(uid);
  }

  @Get('contacts')
  contacts(@CurrentUser('id') uid: string) { return this.svc.listContacts(uid); }

  @Get('contacts/:id')
  conversation(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.svc.conversation(uid, id);
  }

  @Post('contacts/:id/send')
  send(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: SendDto) {
    return this.svc.sendManual(uid, id, dto.body);
  }
}

/**
 * Public provider callback. The token in the path is the only thing that
 * identifies the shop, so it is treated as a credential: unguessable, and
 * rotatable from settings.
 */
@Public()
@Controller('whatsapp/webhook')
export class WhatsAppWebhookController {
  constructor(private readonly svc: WhatsAppService) {}

  /** Meta verifies a webhook by echoing a challenge back on GET. */
  @Get(':token')
  verify(@Param('token') _token: string, @Req() req: Request) {
    const challenge = req.query['hub.challenge'] ?? (req.query as VerifyDto).challenge;
    return typeof challenge === 'string' ? challenge : { ok: true };
  }

  @Post(':token')
  receive(@Param('token') token: string, @Body() payload: unknown) {
    return this.svc.receive(token, payload);
  }
}
