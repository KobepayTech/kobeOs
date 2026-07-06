import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { Public } from './common/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly ds: DataSource) {}

  // Health/liveness is polled constantly (Electron boot, useBackendHealth,
  // Cloudflare Tunnel) — exempt it from the global rate limiter so it never
  // returns 429 and boot/health detection stays reliable.
  @SkipThrottle()
  @Public()
  @Get('health')
  async health() {
    try {
      await this.ds.query('SELECT 1');
      return { status: 'ok', db: 'connected', timestamp: new Date().toISOString() };
    } catch {
      return { status: 'error', db: 'disconnected', timestamp: new Date().toISOString() };
    }
  }
}
