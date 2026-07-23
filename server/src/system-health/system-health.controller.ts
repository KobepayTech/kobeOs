import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/public.decorator';
import { SystemHealthService } from './system-health.service';

@ApiTags('System')
@Controller('system')
export class SystemHealthController {
  constructor(private readonly health: SystemHealthService) {}

  /**
   * Detailed self-healing status for the UI safe-mode banner. Public + throttle-
   * exempt (polled like /health), and never throws — it reports failures rather
   * than becoming one.
   */
  @SkipThrottle()
  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Self-healing subsystem status (mode + banner message)' })
  report() {
    return this.health.getReport();
  }
}
