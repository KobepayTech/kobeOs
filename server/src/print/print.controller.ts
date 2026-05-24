import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PrintJobsService, PrintMaterialsService, PrintTemplatesService } from './print.service';
import {
  AdjustStockDto,
  CreatePrintJobDto, CreatePrintMaterialDto, CreatePrintTemplateDto,
  UpdatePrintJobDto, UpdatePrintMaterialDto, UpdatePrintTemplateDto,
} from './dto/print.dto';

@UseGuards(JwtAuthGuard)
@Controller('print')
export class PrintController {
  constructor(
    private readonly jobs: PrintJobsService,
    private readonly templates: PrintTemplatesService,
    private readonly materials: PrintMaterialsService,
  ) {}

  // ── Jobs ────────────────────────────────────────────────────────────────────
  @Get('jobs')         listJobs(@CurrentUser('id') uid: string, @Query('page') page?: string, @Query('status') status?: string) { return this.jobs.list(uid, page ? +page : 1, 50, status); }
  @Get('jobs/stats')   jobStats(@CurrentUser('id') uid: string) { return this.jobs.stats(uid); }
  @Get('jobs/:id')     getJob(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.jobs.get(uid, id); }
  @Post('jobs')        createJob(@CurrentUser('id') uid: string, @Body() dto: CreatePrintJobDto) { return this.jobs.create(uid, dto); }
  @Patch('jobs/:id')   updateJob(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdatePrintJobDto) { return this.jobs.update(uid, id, dto); }
  @Delete('jobs/:id')  removeJob(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.jobs.remove(uid, id); }

  // ── Templates ───────────────────────────────────────────────────────────────
  @Get('templates')         listTemplates(@CurrentUser('id') uid: string) { return this.templates.list(uid); }
  @Get('templates/:id')     getTemplate(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.templates.get(uid, id); }
  @Post('templates')        createTemplate(@CurrentUser('id') uid: string, @Body() dto: CreatePrintTemplateDto) { return this.templates.create(uid, dto); }
  @Patch('templates/:id')   updateTemplate(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdatePrintTemplateDto) { return this.templates.update(uid, id, dto); }
  @Delete('templates/:id')  removeTemplate(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.templates.remove(uid, id); }

  // ── Materials ───────────────────────────────────────────────────────────────
  @Get('materials')                    listMaterials(@CurrentUser('id') uid: string) { return this.materials.list(uid); }
  @Get('materials/:id')                getMaterial(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.materials.get(uid, id); }
  @Post('materials')                   createMaterial(@CurrentUser('id') uid: string, @Body() dto: CreatePrintMaterialDto) { return this.materials.create(uid, dto); }
  @Patch('materials/:id')              updateMaterial(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdatePrintMaterialDto) { return this.materials.update(uid, id, dto); }
  @Post('materials/:id/adjust-stock')  adjustStock(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: AdjustStockDto) { return this.materials.adjustStock(uid, id, dto); }
  @Delete('materials/:id')             removeMaterial(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.materials.remove(uid, id); }
}
