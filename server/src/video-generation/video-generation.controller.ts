import { Body, Controller, Get, Param, Post, Delete, UseGuards, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { VideoGenerationService } from './video-generation.service';

@ApiTags('Video Generation')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('videos')
export class VideoGenerationController {
  constructor(private readonly videoService: VideoGenerationService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Create a new AI video generation job' })
  async generate(@CurrentUser('id') ownerId: string, @Body() data: Record<string, unknown>) {
    return this.videoService.createJob(ownerId, data);
  }

  @Get('jobs')
  @ApiOperation({ summary: 'List all video generation jobs' })
  async list(
    @CurrentUser('id') ownerId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.videoService.listJobs(
      ownerId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Get video job status and details' })
  async get(@CurrentUser('id') ownerId: string, @Param('id') id: string) {
    return this.videoService.getJob(ownerId, id);
  }

  @Delete('jobs/:id')
  @ApiOperation({ summary: 'Delete a video job' })
  async delete(@CurrentUser('id') ownerId: string, @Param('id') id: string) {
    await this.videoService.deleteJob(ownerId, id);
    return { ok: true };
  }
}
