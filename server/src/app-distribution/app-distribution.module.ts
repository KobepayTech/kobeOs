import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { PosProduct } from '../pos/pos.entity';
import { AppDistributionController } from './app-distribution.controller';
import { AppDistributionService } from './app-distribution.service';
import { DeveloperAppInstall, DeveloperAppListing, DeveloperAppRelease } from './app-distribution.entity';
@Module({
  imports: [TypeOrmModule.forFeature([DeveloperAppListing, DeveloperAppRelease, DeveloperAppInstall, PosProduct]), AuditModule],
  controllers: [AppDistributionController], providers: [AppDistributionService], exports: [AppDistributionService],
})
export class AppDistributionModule {}
