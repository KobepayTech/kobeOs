import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller()
export class AppController {
  constructor(private readonly ds: DataSource) {}

  @Get('health')
  async health() {
    try {
      await this.ds.query('SELECT 1');
      return { status: 'ok', db: 'connected', timestamp: new Date().toISOString() };
    } catch (e) {
      return { status: 'error', db: 'disconnected', timestamp: new Date().toISOString() };
    }
  }
}
