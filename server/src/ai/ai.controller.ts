import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { IsArray, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AiService, ChatCompletionOptions, ModelCategory } from './ai.service';
import { KobeAgentService } from './agent.service';
import { AiDocsService } from './ai-docs.service';

// "Chat with your business" request. Decorated (whitelist-safe).
class AssistantDto {
  @IsString() @MaxLength(2000) message!: string;
  @IsOptional() @IsArray() history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

class ExecuteActionDto {
  @IsString() @MaxLength(60) tool!: string;
  @IsOptional() @IsObject() args?: Record<string, unknown>;
}

// "Chat with your documents": upload a doc's extracted text for grounding.
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

  // ── Chat with your documents ───────────────────────────────────────────────

  /** Upload a document's extracted text; Kobe chunks + embeds it for grounding. */
  @Post('docs')
  @ApiOperation({ summary: 'Ingest a document for "chat with your documents"' })
  ingestDoc(@CurrentUser('id') uid: string, @Body() dto: IngestDocDto) {
    return this.aiDocs.ingest(uid, dto.title, dto.text, dto.source ?? '');
  }

  @Get('docs')
  @ApiOperation({ summary: 'List uploaded documents' })
  listDocs(@CurrentUser('id') uid: string) {
    return this.aiDocs.list(uid);
  }

  @Delete('docs/:id')
  @ApiOperation({ summary: 'Delete an uploaded document and its passages' })
  removeDoc(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.aiDocs.remove(uid, id);
  }

  @Post('docs/search')
  @ApiOperation({ summary: 'Retrieve the passages most relevant to a question' })
  searchDocs(@CurrentUser('id') uid: string, @Body() dto: DocSearchDto) {
    return this.aiDocs.search(uid, dto.query, 6, dto.documentId);
  }

  /**
   * Natural-language business assistant. Ask "what are today's sales",
   * "which items do customers like most", "how many tenants haven't paid".
   * Write actions (notify tenants, change rent) return a pendingAction the
   * UI must confirm before running. POST /api/ai/assistant
   */
  @Post('assistant')
  assistant(@CurrentUser('id') uid: string, @Body() dto: AssistantDto) {
    return this.agent.run(uid, dto.message, dto.history ?? []);
  }

  /**
   * Run a write action the user confirmed from the assistant (e.g. send a
   * tenant notification, change rent). POST /api/ai/assistant/execute
   */
  @Post('assistant/execute')
  execute(@CurrentUser('id') uid: string, @Body() dto: ExecuteActionDto) {
    return this.agent.execute(uid, { tool: dto.tool, args: dto.args ?? {} });
  }

  /**
   * Proactive daily briefing: business summary + actionable alerts across
   * modules. Deterministic, works even when Ollama is offline.
   * GET /api/ai/briefing
   */
  @Get('briefing')
  @ApiOperation({ summary: 'Proactive daily business briefing + alerts' })
  briefing(@CurrentUser('id') uid: string) {
    return this.agent.briefing(uid);
  }

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

  // ── Vision skill ──────────────────────────────────────────────────────────

  /** Describe / read / answer about a photo (base64 image). Local vision model. */
  @Post('vision/describe')
  @ApiOperation({ summary: 'Ask Kobe about a photo (describe, read a label, etc.)' })
  async visionDescribe(@Body() body: { image: string; prompt?: string }) {
    return { content: await this.ai.describeImage(body.image, body.prompt ?? 'Describe this image for a business owner.') };
  }

  /** Draft a product listing (name/category/description/tags) from a photo. */
  @Post('vision/product')
  @ApiOperation({ summary: 'Draft a product listing from a photo' })
  visionProduct(@Body() body: { image: string }) {
    return this.ai.describeProductImage(body.image);
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
