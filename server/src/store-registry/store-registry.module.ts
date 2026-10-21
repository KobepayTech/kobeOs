import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoreRegistration } from './store-registry.entity';
import { StoreRegistryService } from './store-registry.service';
import { StoreRegistryController } from './store-registry.controller';
import { CloudflareModule } from './cloudflare.module';

@Module({
  imports: [TypeOrmModule.forFeature([StoreRegistration]), CloudflareModule],
  providers: [StoreRegistryService],
  controllers: [StoreRegistryController],
  exports: [StoreRegistryService],
})
export class StoreRegistryModule {}
