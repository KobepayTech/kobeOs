import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoreSettings } from './store-settings.entity';
import { StoreSettingsService } from './store-settings.service';
import { StoreSettingsController } from './store-settings.controller';
import { PublishService } from './publish.service';

@Module({
  imports: [TypeOrmModule.forFeature([StoreSettings])],
  providers: [StoreSettingsService, PublishService],
  controllers: [StoreSettingsController],
  exports: [StoreSettingsService, PublishService],
})
export class StoreSettingsModule {}
