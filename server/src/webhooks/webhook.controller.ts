import { Body, Controller, Headers, Param, Post, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../common/public.decorator';
import { WebhookGuard } from './webhook.guard';
import { WebhookService } from './webhook.service';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly webhookService: WebhookService) {}

  @Post(':provider')
  @Public()
  @UseGuards(WebhookGuard)
  @ApiOperation({ summary: 'Receive webhook from external provider' })
  async receive(
    @Param('provider') provider: string,
    @Body() payload: Record<string, unknown>,
    @Headers('x-event-type') eventType: string,
  ) {
    const event = await this.webhookService.receive(provider, eventType, payload);
    this.logger.log(`Webhook persisted: ${event.id} (${provider}/${eventType})`);
    return { ok: true, id: event.id, provider, eventType };
  }
}
