import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { Public } from './common/public.decorator';
import { ContinuityService } from './cloud-continuity/continuity.service';

@Controller()
export class AppController {
  constructor(
    private readonly ds: DataSource,
    private readonly continuity: ContinuityService,
  ) {}

  // Health/liveness is polled constantly (Electron boot, useBackendHealth,
  // Cloudflare Tunnel) — exempt it from the global rate limiter so it never
  // returns 429 and boot/health detection stays reliable.
  @SkipThrottle({ default: true, auth: true, 'public-lookup': true })
  @Public()
  @Get('health')
  async health() {
    try {
      await this.ds.query('SELECT 1');
      // Sync backlog rides along here because this endpoint is already polled
      // by everything that watches the system, so one external uptime check
      // covers both liveness and whether online transactions are reaching the
      // main database.
      //
      // A stalled sync deliberately does NOT fail this endpoint. Unsynced
      // bookings are a problem for an operator to chase, not a reason to take
      // the API out of service and stop accepting the next one.
      return {
        status: 'ok',
        db: 'connected',
        sync: await this.continuity.syncHealth(),
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        db: 'disconnected',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
