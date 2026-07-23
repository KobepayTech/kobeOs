import { Module } from '@nestjs/common';
import { SystemHealthService } from './system-health.service';
import { SystemHealthController } from './system-health.controller';

/**
 * Runtime self-healing. Uses the global DataSource + ConfigService (no extra
 * providers), so it can watch the database and local AI and publish a
 * safe-mode status without depending on the modules it monitors.
 */
@Module({
  providers: [SystemHealthService],
  controllers: [SystemHealthController],
  exports: [SystemHealthService],
})
export class SystemHealthModule {}
