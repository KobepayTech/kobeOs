import { Body, Controller, Headers, Param, Post, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WebhookGuard } from './webhook.guard';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger('Webhook');

  @Post(':provider')
  @UseGuards(WebhookGuard)
  @ApiOperation({ summary: 'Receive webhook from external provider' })
  async receive(
    @Param('provider') provider: string,
    @Body() payload: Record<string, any>,
    @Headers('x-event-type') eventType: string,
  ) {
    this.logger.log(`Received ${provider} webhook: ${eventType}`);
    return { ok: true, provider, eventType, received: true };
  }
}
