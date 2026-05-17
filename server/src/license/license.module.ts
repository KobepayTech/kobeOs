import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OsLicense } from './os-license.entity';
import { LicenseService } from './license.service';
import { LicenseController } from './license.controller';
import { CreatorsModule } from '../creators/creators.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OsLicense]),
    CreatorsModule, // provides PalmPesaService
  ],
  providers: [LicenseService],
  controllers: [LicenseController],
  exports: [LicenseService],
})
export class LicenseModule {}
