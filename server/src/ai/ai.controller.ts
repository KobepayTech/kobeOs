import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { IsArray, IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AiService, ChatCompletionOptions, MODEL_CATALOGUE, ModelCategory } from './ai.service';
import { KobeAgentService } from './agent.service';
import { AiDocsService } from './ai-docs.service';

class AssistantDto {
  @IsString() @MaxLength(2000) message!: string;
  @IsOptional() @IsArray() history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  @IsOptional() @IsIn(['fast', 'quality']) mode?: 'fast' | 'quality';
}

class ExecuteActionDto {
  @IsString() @MaxLength(60) tool!: string;
  @IsOptional() @IsObject() args?: Record<string, unknown>;
}

class IngestDocDto {
  @IsString() @MaxLength(200) title!: string;
  @IsString() @MaxLength(2_000_000) text!: string;
  @IsOptional() @IsString() @MaxLength(200) source?: string;
}

class DocSearchDto {
  @IsString() @MaxLength(2000) query!: string;
  @IsOptional() @IsString() documentId?: string;
}

@ApiTags('AI / LLM')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly agent: KobeAgentService,
    private readonly aiDocs: AiDocsService,
  ) {}

  @Post('docs')
  @ApiOperation({ summary: 'Ingest a document for "chat with your documents"' })
  ingestDoc(@CurrentUser('id') uid: string, @Body() dto: IngestDocDto) {
    return this.aiDocs.ingest(uid, dto.title, dto.text, dto.source ?? '');
  }

  @Get('docs')
  @ApiOperation({ summary: 'List uploaded documents' })
  listDocs(@CurrentUser('id') uid: string) { return this.aiDocs.list(uid); }

  @Delete('docs/:id')
  @ApiOperation({ summary: 'Delete an uploaded document and its passages' })
  removeDoc(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.aiDocs.remove(uid, id); }

  @Post('docs/search')
  @ApiOperation({ summary: 'Retrieve the passages most relevant to a question' })
  searchDocs(@CurrentUser('id') uid: string, @Body() dto: DocSearchDto) {
    return this.aiDocs.search(uid, dto.query, 6, dto.documentId);
  }

  @Post('assistant')
  assistant(@CurrentUser('id') uid: string, @Body() dto: AssistantDto) {
    return this.agent.run(uid, dto.message, dto.history ?? [], dto.mode ?? 'quality');
  }

  @Post('assistant/execute')
  execute(@CurrentUser('id') uid: string, @Body() dto: ExecuteActionDto) {
    return this.agent.execute(uid, { tool: dto.tool, args: dto.args ?? {} });
  }

  @Get('briefing')
  @ApiOperation({ summary: 'Proactive daily business briefing + alerts' })
  briefing(@CurrentUser('id') uid: string) { return this.agent.briefing(uid); }

  @Get('skills')
  @ApiOperation({ summary: 'Business skills available to the Kobe assistant' })
  skills() { return { skills: this.agent.listSkills() }; }

  @Get('health')
  @ApiOperation({ summary: 'Ollama status, installed models, active model' })
  health() { return this.ai.health(); }

  /**
   * Phone/PWA discovery contract. The phone never connects to Ollama directly;
   * it authenticates to KobeOS, which proxies inference to models installed on
   * the serving KobeOS node.
   */
  @Get('gateway/status')
  @ApiOperation({ summary: 'Kobe AI node status and capabilities for mobile clients' })
  async gatewayStatus() {
    const [health, installed] = await Promise.all([this.ai.health(), this.ai.listInstalled()]);
    const installedNames = new Set(installed.map((model) => model.name));
    const installedCategories = new Set(
      MODEL_CATALOGUE.filter((model) => installedNames.has(model.id)).map((model) => model.category),
    );
    const capabilities = new Set<string>();
    if (installed.length) capabilities.add('CHAT');
    if (installedCategories.has('coding')) capabilities.add('CODE');
    if (installedCategories.has('vision') || installedCategories.has('multimodal')) capabilities.add('VISION');
    if (installedCategories.has('embedding')) capabilities.add('EMBEDDINGS');
    if (installedCategories.has('translation')) capabilities.add('TRANSLATION');
    if (installedCategories.has('speech')) {
      capabilities.add('SPEECH');
      capabilities.add('STT_TTS');
    }
    return {
      online: health.running,
      node: process.env.KOBEOS_DESKTOP === 'true' ? 'desktop' : 'server',
      transport: 'authenticated-kobe-api',
      directOllamaExposure: false,
      activeModel: health.activeModel,
      installedModels: installed,
      capabilities: Array.from(capabilities),
      remoteReady: true,
    };
  }

  @Post('gateway/chat')
  @ApiOperation({ summary: 'Authenticated model-gateway chat for phone and remote clients' })
  gatewayChat(@Body() options: ChatCompletionOptions) { return this.ai.chatCompletion(options); }

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
  byCategory(@Param('category') category: ModelCategory) { return this.ai.getCatalogueByCategory(category); }

  @Get('models/:id')
  @ApiOperation({ summary: 'Get model info from catalogue' })
  modelInfo(@Param('id') id: string) { return this.ai.getModelInfo(id); }

  @Post('models/pull')
  @ApiOperation({ summary: 'Pull / download a model from Ollama registry' })
  pullModel(@Body() body: { model: string }) { return this.ai.pullModel(body.model); }

  @Delete('models/:name')
  @ApiOperation({ summary: 'Delete an installed model' })
  deleteModel(@Param('name') name: string) { return this.ai.deleteModel(name); }

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

  @Post('vision/describe')
  @ApiOperation({ summary: 'Ask Kobe about a photo (describe, read a label, etc.)' })
  async visionDescribe(@Body() body: { image: string; prompt?: string }) {
    return { content: await this.ai.describeImage(body.image, body.prompt ?? 'Describe this image for a business owner.') };
  }

  @Post('vision/product')
  @ApiOperation({ summary: 'Draft a product listing from a photo' })
  visionProduct(@Body() body: { image: string }) { return this.ai.describeProductImage(body.image); }

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
