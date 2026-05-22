import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrintJob, PrintMaterial, PrintTemplate } from './print.entity';
import { PrintJobsService, PrintMaterialsService, PrintTemplatesService } from './print.service';
import { PrintController } from './print.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PrintJob, PrintTemplate, PrintMaterial])],
  providers: [PrintJobsService, PrintTemplatesService, PrintMaterialsService],
  controllers: [PrintController],
})
export class PrintModule {}
