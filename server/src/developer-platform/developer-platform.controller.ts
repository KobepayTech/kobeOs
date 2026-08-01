import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { Public } from '../common/public.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AiService } from '../ai/ai.service';
import {
  CreateDeveloperProjectDto,
  DeveloperCodeDto,
  DeveloperEmbedDto,
  DeveloperPromptDto,
} from './dto/developer-project.dto';
import { DeveloperPlatformService } from './developer-platform.service';

@Controller('developer-platform')
export class DeveloperPlatformController {
  constructor(private readonly projects: DeveloperPlatformService) {}

  @Get('projects')
  list(@CurrentUser('id') userId: string) {
    return this.projects.list(userId);
  }

  @Post('projects')
  create(@CurrentUser('id') userId: string, @Body() dto: CreateDeveloperProjectDto) {
    return this.projects.create(userId, dto);
  }

  @Post('projects/:id/rotate')
  rotate(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.projects.rotate(userId, id);
  }
}

@Public()
@Controller('developer/v1')
export class DeveloperAiController {
  constructor(
    private readonly projects: DeveloperPlatformService,
    private readonly ai: AiService,
  ) {}

  @Post('chat')
  async chat(
    @Headers('authorization') authorization: string | undefined,
    @Headers('origin') origin: string | undefined,
    @Body() dto: DeveloperPromptDto,
  ) {
    const project = await this.projects.authenticate(authorization, origin);
    const content = await this.ai.complete(dto.prompt, dto.system, dto.model);
    return {
      id: `kobe_chat_${Date.now()}`,
      project: project.slug,
      content,
    };
  }

  @Post('embeddings')
  async embeddings(
    @Headers('authorization') authorization: string | undefined,
    @Headers('origin') origin: string | undefined,
    @Body() dto: DeveloperEmbedDto,
  ) {
    const project = await this.projects.authenticate(authorization, origin);
    const embedding = await this.ai.generateEmbedding(dto.text, dto.model);
    return { project: project.slug, embedding };
  }

  @Post('code')
  async code(
    @Headers('authorization') authorization: string | undefined,
    @Headers('origin') origin: string | undefined,
    @Body() dto: DeveloperCodeDto,
  ) {
    const project = await this.projects.authenticate(authorization, origin);
    const content = await this.ai.generateCode(dto.prompt, dto.language);
    return { project: project.slug, content };
  }
}
