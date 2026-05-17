import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoreRegistration } from './store-registry.entity';
import { StoreRegistryService } from './store-registry.service';
import { StoreRegistryController } from './store-registry.controller';
import { CloudflareService } from './cloudflare.service';

@Module({
  imports: [TypeOrmModule.forFeature([StoreRegistration])],
  providers: [StoreRegistryService, CloudflareService],
  controllers: [StoreRegistryController],
  exports: [StoreRegistryService],
})
export class StoreRegistryModule {}
