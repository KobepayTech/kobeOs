import { Module } from '@nestjs/common';
import { CloudflareService } from './cloudflare.service';

/**
 * One CloudflareService, shared by store-registry and store-settings rather
 * than provided twice.
 */
@Module({
  providers: [CloudflareService],
  exports: [CloudflareService],
})
export class CloudflareModule {}
