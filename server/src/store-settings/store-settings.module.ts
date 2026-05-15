import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoreSettings } from './store-settings.entity';
import { StoreSettingsService } from './store-settings.service';
import { StoreSettingsController } from './store-settings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([StoreSettings])],
  providers: [StoreSettingsService],
  controllers: [StoreSettingsController],
  exports: [StoreSettingsService],
})
export class StoreSettingsModule {}
