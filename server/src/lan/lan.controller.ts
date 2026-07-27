import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/public.decorator';
import { LanService } from './lan.service';

@ApiTags('LAN')
@Controller('lan')
export class LanController {
  constructor(private readonly lan: LanService) {}

  /**
   * LAN discovery handshake. Public + throttle-exempt (polled like /health).
   * A client that reaches this server on ANY address learns all of its LAN
   * addresses + a stable id, so it can fail over to WiFi when the internet is
   * down and show a QR for phones/tablets to join.
   */
  @SkipThrottle()
  @Public()
  @Get('info')
  @ApiOperation({ summary: 'LAN discovery: this server\'s WiFi addresses + id' })
  info() {
    return this.lan.getInfo();
  }
}
