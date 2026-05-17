import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { KobeModelsService } from './kobe-models.service';
import { StartDownloadDto } from './dto/kobe-models.dto';

@ApiTags('kobe-models')
@Controller('kobe-models')
export class KobeModelsController {
  constructor(private readonly svc: KobeModelsService) {}

  // ── Catalogue ──────────────────────────────────────────────────────────────

  @Get('catalogue')
  @ApiOperation({ summary: 'Full model catalogue (refreshed from CDN if configured)' })
  getCatalogue() {
    return this.svc.getCatalogue();
  }

  @Get('catalogue/recommended')
  @ApiOperation({ summary: 'Recommended models for first-time setup' })
  getRecommended() {
    return this.svc.getRecommended();
  }

  @Get('catalogue/category/:category')
  @ApiOperation({ summary: 'Models filtered by category (chat, coding, vision, sports, …)' })
  getByCategory(@Param('category') category: string) {
    return this.svc.getByCategory(category);
  }

  @Get('catalogue/:id')
  @ApiOperation({ summary: 'Single model entry by ID' })
  getModel(@Param('id') id: string) {
    return this.svc.getModelById(id);
  }

  // ── Downloads ──────────────────────────────────────────────────────────────

  @Post('download')
  @ApiOperation({ summary: 'Start a model download job (returns jobId for polling)' })
  startDownload(@Body() dto: StartDownloadDto) {
    return this.svc.startDownload(dto.modelId);
  }

  @Get('jobs')
  @ApiOperation({ summary: 'List all download jobs' })
  listJobs() {
    return this.svc.listJobs();
  }

  @Get('jobs/:jobId')
  @ApiOperation({ summary: 'Poll a download job by ID' })
  getJob(@Param('jobId') jobId: string) {
    return this.svc.getJob(jobId);
  }
}
