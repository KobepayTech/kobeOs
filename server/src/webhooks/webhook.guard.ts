import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';

@Injectable()
export class WebhookGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const signature = request.headers['x-webhook-signature'] as string;
    const provider = request.params.provider;

    if (!signature) throw new UnauthorizedException('Missing webhook signature');

    const secret = this.config.get('WEBHOOK_SECRET', 'default-secret');
    const payload = JSON.stringify(request.body);
    const expected = createHmac('sha256', `${secret}:${provider}`).update(payload).digest('hex');

    if (signature !== expected) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    return true;
  }
}
