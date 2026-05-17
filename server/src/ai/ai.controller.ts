import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiService, ChatCompletionOptions, ModelCategory } from './ai.service';

@ApiTags('AI / LLM')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  // ── Health ────────────────────────────────────────────────────────────────

  @Get('health')
  @ApiOperation({ summary: 'Ollama status, installed models, active model' })
  health() { return this.ai.health(); }

  // ── Model registry ────────────────────────────────────────────────────────

  @Get('models/catalogue')
  @ApiOperation({ summary: 'Full model catalogue with install status' })
  catalogue() { return this.ai.listCatalogue(); }

  @Get('models/installed')
  @ApiOperation({ summary: 'Models currently installed in Ollama' })
  installed() { return this.ai.listInstalled(); }

  @Get('models/active')
  @ApiOperation({ summary: 'Currently active model' })
  activeModel() { return { model: this.ai.getActiveModel() }; }

  @Put('models/active')
  @ApiOperation({ summary: 'Switch active model' })
  setActiveModel(@Body() body: { model: string }) {
    this.ai.setActiveModel(body.model);
    return { model: body.model, message: 'Active model updated' };
  }

  @Get('models/category/:category')
  @ApiOperation({ summary: 'List catalogue models by category' })
  byCategory(@Param('category') category: ModelCategory) {
    return this.ai.getCatalogueByCategory(category);
  }

  @Get('models/:id')
  @ApiOperation({ summary: 'Get model info from catalogue' })
  modelInfo(@Param('id') id: string) { return this.ai.getModelInfo(id); }

  @Post('models/pull')
  @ApiOperation({ summary: 'Pull / download a model from Ollama registry' })
  pullModel(@Body() body: { model: string }) { return this.ai.pullModel(body.model); }

  @Delete('models/:name')
  @ApiOperation({ summary: 'Delete an installed model' })
  deleteModel(@Param('name') name: string) { return this.ai.deleteModel(name); }

  // ── Chat & completions ────────────────────────────────────────────────────

  @Post('chat')
  @ApiOperation({ summary: 'Chat completion (specify model or use active)' })
  chat(@Body() options: ChatCompletionOptions) { return this.ai.chatCompletion(options); }

  @Post('complete')
  @ApiOperation({ summary: 'Simple prompt completion' })
  async complete(@Body() body: { prompt: string; system?: string; model?: string }) {
    return { content: await this.ai.complete(body.prompt, body.system, body.model) };
  }

  @Post('embed')
  @ApiOperation({ summary: 'Generate text embedding vector' })
  async embed(@Body() body: { text: string; model?: string }) {
    return { embedding: await this.ai.generateEmbedding(body.text, body.model) };
  }

  // ── Specialised ───────────────────────────────────────────────────────────

  @Post('video-script')
  @ApiOperation({ summary: 'Generate video script' })
  async videoScript(@Body() body: { topic: string; scenes?: number }) {
    return { content: await this.ai.generateVideoScript(body.topic, body.scenes) };
  }

  @Post('image-prompt')
  @ApiOperation({ summary: 'Generate image generation prompt' })
  async imagePrompt(@Body() body: { scene: string; style?: string }) {
    return { content: await this.ai.generateImagePrompt(body.scene, body.style) };
  }

  @Post('code')
  @ApiOperation({ summary: 'Generate code (uses coder model)' })
  async code(@Body() body: { prompt: string; language?: string }) {
    return { content: await this.ai.generateCode(body.prompt, body.language) };
  }

  // ── Sports AI ─────────────────────────────────────────────────────────────

  @Post('sports/commentary')
  @ApiOperation({ summary: 'Generate live football commentary' })
  async commentary(@Body() body: { context: string }) {
    return { content: await this.ai.generateMatchCommentary(body.context) };
  }

  @Post('sports/analyse')
  @ApiOperation({ summary: 'Analyse match statistics' })
  async analyseStats(@Body() body: { stats: Record<string, unknown> }) {
    return { content: await this.ai.analyseMatchStats(body.stats) };
  }

  @Post('sports/report')
  @ApiOperation({ summary: 'Generate post-match report' })
  async matchReport(@Body() body: { matchData: Record<string, unknown> }) {
    return { content: await this.ai.generateMatchReport(body.matchData) };
  }

  @Post('sports/formation')
  @ApiOperation({ summary: 'Predict formation from player positions' })
  async formation(@Body() body: { positions: string[] }) {
    return { content: await this.ai.predictFormation(body.positions) };
  }
}
