import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoreSettings } from './store-settings.entity';
import { StoreSettingsService } from './store-settings.service';
import { StoreSettingsController } from './store-settings.controller';
import { PublishService } from './publish.service';
import { CloudflareService } from '../store-registry/cloudflare.service';

@Module({
  imports: [TypeOrmModule.forFeature([StoreSettings])],
  providers: [StoreSettingsService, PublishService, CloudflareService],
  controllers: [StoreSettingsController],
  exports: [StoreSettingsService, PublishService, TypeOrmModule],
})
export class StoreSettingsModule {}
