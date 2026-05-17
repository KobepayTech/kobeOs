import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Public } from './common/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly ds: DataSource) {}

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
