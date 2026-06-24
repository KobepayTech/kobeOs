import { BadRequestException, Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { PushService } from './push.service';

/**
 * Public web-push endpoints. Subscriptions are bound to a phone
 * number (no JWT) because the customer portal already verified
 * ownership via the OTP step before calling these — the client
 * passes the phone alongside the browser-issued subscription details.
 *
 *   GET  /push/info       — VAPID public key + configured flag
 *   POST /push/subscribe  — { phone, endpoint, p256dh, auth }
 *   POST /push/unsubscribe — { phone, endpoint }
 *   POST /push/test       — { phone } — fires a "Test" notification
 *                            to every subscription for the phone.
 *                            Useful from the portal's "test push" button.
 */
@Controller('push')
export class PushController {
  constructor(private readonly svc: PushService) {}

  @Get('info')
  info() {
    return {
      configured: this.svc.isConfigured(),
      publicKey: this.svc.publicKey(),
    };
  }

  @Post('subscribe')
  async subscribe(
    @Body() dto: { phone: string; endpoint: string; p256dh: string; auth: string },
    @Req() req: Request,
  ) {
    if (!dto?.phone || !dto?.endpoint || !dto?.p256dh || !dto?.auth) {
      throw new BadRequestException('phone, endpoint, p256dh, auth all required');
    }
    const ua = req.headers['user-agent']?.slice(0, 200) ?? '';
    const sub = await this.svc.subscribe({ ...dto, userAgent: ua });
    return { id: sub.id, phone: sub.phone };
  }

  @Post('unsubscribe')
  unsubscribe(@Body() dto: { phone: string; endpoint: string }) {
    if (!dto?.phone || !dto?.endpoint) throw new BadRequestException('phone + endpoint required');
    return this.svc.unsubscribe(dto.phone, dto.endpoint);
  }

  @Post('test')
  test(@Body() dto: { phone: string }) {
    if (!dto?.phone) throw new BadRequestException('phone required');
    return this.svc.sendToPhone(dto.phone, {
      title: 'KobeOS',
      body: 'Test notification — push is working on this device.',
      url: '/me',
      tag: 'kobe-test',
    });
  }
}
