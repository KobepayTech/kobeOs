// ai.controller.ts
import { 
  Body, 
  Controller, 
  Delete, 
  Get, 
  Param, 
  Post, 
  Put, 
  UseGuards,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  UseInterceptors,
  CacheInterceptor,
  CacheTTL,
} from '@nestjs/common';
import { 
  IsArray, 
  IsIn, 
  IsObject, 
  IsOptional, 
  IsString, 
  MaxLength,
  IsNotEmpty,
  IsUUID,
  IsNumber,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiResponse, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AiService, ChatCompletionOptions, MODEL_CATALOGUE, ModelCategory } from './ai.service';
import { KobeAgentService } from './agent.service';
import { AiDocsService } from './ai-docs.service';

// ─── DTOs ─────────────────────────────────────────────────────────────────────

class MessageHistoryDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @MaxLength(2000)
  content!: string;
}

class AssistantDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageHistoryDto)
  history?: MessageHistoryDto[];

  @IsOptional()
  @IsIn(['fast', 'quality'])
  mode?: 'fast' | 'quality';
}

class ExecuteActionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  tool!: string;

  @IsOptional()
  @IsObject()
  args?: Record<string, unknown>;
}

class IngestDocDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2_000_000)
  text!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  source?: string;
}

class DocSearchDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  query!: string;

  @IsOptional()
  @IsUUID()
  documentId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  limit?: number;
}

class SetActiveModelDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  model!: string;
}

class PullModelDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  model!: string;
}

class CompleteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  prompt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  system?: string;

  @IsOptional()
  @IsString()
  model?: string;
}

class EmbedDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  text!: string;

  @IsOptional()
  @IsString()
  model?: string;
}

class VisionDescribeDto {
  @IsString()
  @IsNotEmpty()
  image!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  prompt?: string;
}

class VisionProductDto {
  @IsString()
  @IsNotEmpty()
  image!: string;
}

class VideoScriptDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  topic!: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  scenes?: number;
}

class ImagePromptDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  scene!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  style?: string;
}

class CodeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  prompt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  language?: string;
}

class SportsCommentaryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  context!: string;
}

class SportsStatsDto {
  @IsObject()
  @IsNotEmpty()
  stats!: Record<string, unknown>;
}

class SportsReportDto {
  @IsObject()
  @IsNotEmpty()
  matchData!: Record<string, unknown>;
}

class SportsFormationDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  positions!: string[];
}

// ─── Controller ──────────────────────────────────────────────────────────────

@ApiTags('AI / LLM')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  private readonly logger = new Logger(AiController.name);

  constructor(
    private readonly ai: AiService,
    private readonly agent: KobeAgentService,
    private readonly aiDocs: AiDocsService,
  ) {}

  // ─── Document Management ──────────────────────────────────────────────────

  @Post('docs')
  @ApiOperation({ summary: 'Ingest a document for "chat with your documents"' })
  @ApiResponse({ status: 201, description: 'Document ingested successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async ingestDoc(@CurrentUser('id') uid: string, @Body() dto: IngestDocDto) {
    try {
      this.logger.log(`User ${uid} ingesting document: ${dto.title}`);
      return await this.aiDocs.ingest(uid, dto.title, dto.text, dto.source ?? '');
    } catch (error) {
      this.logger.error(`Document ingestion failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to ingest document');
    }
  }

  @Get('docs')
  @ApiOperation({ summary: 'List uploaded documents' })
  @ApiResponse({ status: 200, description: 'List of documents' })
  async listDocs(@CurrentUser('id') uid: string) {
    try {
      return await this.aiDocs.list(uid);
    } catch (error) {
      this.logger.error(`Failed to list documents: ${error.message}`);
      throw new InternalServerErrorException('Failed to list documents');
    }
  }

  @Delete('docs/:id')
  @ApiOperation({ summary: 'Delete an uploaded document and its passages' })
  @ApiParam({ name: 'id', description: 'Document UUID' })
  @ApiResponse({ status: 200, description: 'Document deleted' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async removeDoc(@CurrentUser('id') uid: string, @Param('id') id: string) {
    try {
      this.logger.log(`User ${uid} deleting document: ${id}`);
      return await this.aiDocs.remove(uid, id);
    } catch (error) {
      this.logger.error(`Failed to delete document: ${error.message}`);
      throw new InternalServerErrorException('Failed to delete document');
    }
  }

  @Post('docs/search')
  @ApiOperation({ summary: 'Retrieve the passages most relevant to a question' })
  @ApiResponse({ status: 200, description: 'Search results' })
  async searchDocs(@CurrentUser('id') uid: string, @Body() dto: DocSearchDto) {
    try {
      const limit = dto.limit ?? 6;
      this.logger.debug(`User ${uid} searching documents with limit ${limit}`);
      return await this.aiDocs.search(uid, dto.query, limit, dto.documentId);
    } catch (error) {
      this.logger.error(`Document search failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to search documents');
    }
  }

  // ─── Assistant / Agent ────────────────────────────────────────────────────

  @Post('assistant')
  @ApiOperation({ 
    summary: 'Run Kobe assistant',
    description: 'Process user messages with conversation history and mode selection'
  })
  @ApiResponse({ status: 200, description: 'Assistant response' })
  async assistant(@CurrentUser('id') uid: string, @Body() dto: AssistantDto) {
    try {
      this.logger.log(`User ${uid} running assistant (mode: ${dto.mode || 'quality'})`);
      return await this.agent.run(uid, dto.message, dto.history ?? [], dto.mode ?? 'quality');
    } catch (error) {
      this.logger.error(`Assistant failed: ${error.message}`);
      throw new InternalServerErrorException('Assistant processing failed');
    }
  }

  @Post('assistant/execute')
  @ApiOperation({ summary: 'Execute a specific tool/action' })
  @ApiResponse({ status: 200, description: 'Action executed successfully' })
  async execute(@CurrentUser('id') uid: string, @Body() dto: ExecuteActionDto) {
    try {
      this.logger.log(`User ${uid} executing tool: ${dto.tool}`);
      return await this.agent.execute(uid, { tool: dto.tool, args: dto.args ?? {} });
    } catch (error) {
      this.logger.error(`Tool execution failed: ${error.message}`);
      throw new InternalServerErrorException(`Failed to execute tool: ${dto.tool}`);
    }
  }

  @Get('briefing')
  @ApiOperation({ summary: 'Proactive daily business briefing + alerts' })
  @ApiResponse({ status: 200, description: 'Business briefing generated' })
  async briefing(@CurrentUser('id') uid: string) {
    try {
      this.logger.log(`User ${uid} requesting briefing`);
      return await this.agent.briefing(uid);
    } catch (error) {
      this.logger.error(`Briefing failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to generate briefing');
    }
  }

  @Get('skills')
  @ApiOperation({ summary: 'Business skills available to the Kobe assistant' })
  @ApiResponse({ status: 200, description: 'List of available skills' })
  skills() {
    try {
      return { 
        skills: this.agent.listSkills(),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`Failed to list skills: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve skills');
    }
  }

  // ─── Health & Gateway ─────────────────────────────────────────────────────

  @Get('health')
  @ApiOperation({ summary: 'Ollama status, installed models, active model' })
  @ApiResponse({ status: 200, description: 'Health status' })
  async health() {
    try {
      return await this.ai.health();
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);
      throw new InternalServerErrorException('Health check failed');
    }
  }

  @Get('gateway/status')
  @ApiOperation({ 
    summary: 'Kobe AI node status and capabilities for mobile clients',
    description: 'Single discovery endpoint for KobeOS phone/PWA clients. The phone never talks to Ollama directly.'
  })
  @ApiResponse({ status: 200, description: 'Gateway status' })
  async gatewayStatus() {
    try {
      const [health, installed] = await Promise.all([
        this.ai.health(), 
        this.ai.listInstalled()
      ]);
      
      const installedNames = new Set(installed.map((model) => model.name));
      const installedCategories = new Set(
        MODEL_CATALOGUE
          .filter((model) => installedNames.has(model.id))
          .map((model) => model.category),
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
        version: process.env.APP_VERSION || '1.0.0',
      };
    } catch (error) {
      this.logger.error(`Gateway status failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to get gateway status');
    }
  }

  @Post('gateway/chat')
  @ApiOperation({ 
    summary: 'Authenticated model-gateway chat for phone and remote clients',
    description: 'Stable mobile/remote inference endpoint. Clients should prefer this over addressing Ollama directly.'
  })
  @ApiResponse({ status: 200, description: 'Chat completion response' })
  async gatewayChat(@Body() options: ChatCompletionOptions) {
    try {
      this.logger.log(`Gateway chat request (model: ${options.model || 'default'})`);
      return await this.ai.chatCompletion(options);
    } catch (error) {
      this.logger.error(`Gateway chat failed: ${error.message}`);
      throw new InternalServerErrorException('Chat completion failed');
    }
  }

  // ─── Model Registry ───────────────────────────────────────────────────────

  @Get('models/catalogue')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300)
  @ApiOperation({ summary: 'Full model catalogue with install status' })
  @ApiResponse({ status: 200, description: 'Model catalogue' })
  async catalogue() {
    try {
      return await this.ai.listCatalogue();
    } catch (error) {
      this.logger.error(`Failed to list catalogue: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve catalogue');
    }
  }

  @Get('models/installed')
  @ApiOperation({ summary: 'Models currently installed in Ollama' })
  @ApiResponse({ status: 200, description: 'Installed models' })
  async installed() {
    try {
      return await this.ai.listInstalled();
    } catch (error) {
      this.logger.error(`Failed to list installed models: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve installed models');
    }
  }

  @Get('models/active')
  @ApiOperation({ summary: 'Currently active model' })
  @ApiResponse({ status: 200, description: 'Active model' })
  activeModel() {
    try {
      return { 
        model: this.ai.getActiveModel(),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`Failed to get active model: ${error.message}`);
      throw new InternalServerErrorException('Failed to get active model');
    }
  }

  @Put('models/active')
  @ApiOperation({ summary: 'Switch active model' })
  @ApiResponse({ status: 200, description: 'Active model updated' })
  @ApiResponse({ status: 400, description: 'Invalid model' })
  async setActiveModel(@Body() body: SetActiveModelDto) {
    try {
      // Validate model exists
      const installed = await this.ai.listInstalled();
      const modelExists = installed.some(m => m.name === body.model || m.id === body.model);
      
      if (!modelExists) {
        throw new BadRequestException(`Model "${body.model}" is not installed`);
      }

      this.ai.setActiveModel(body.model);
      this.logger.log(`Active model switched to: ${body.model}`);
      return { 
        model: body.model, 
        message: 'Active model updated',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`Failed to set active model: ${error.message}`);
      throw new InternalServerErrorException('Failed to set active model');
    }
  }

  @Get('models/category/:category')
  @ApiOperation({ summary: 'List catalogue models by category' })
  @ApiParam({ name: 'category', enum: ModelCategory })
  @ApiResponse({ status: 200, description: 'Models by category' })
  byCategory(@Param('category') category: ModelCategory) {
    try {
      return this.ai.getCatalogueByCategory(category);
    } catch (error) {
      this.logger.error(`Failed to get models by category: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve models by category');
    }
  }

  @Get('models/:id')
  @ApiOperation({ summary: 'Get model info from catalogue' })
  @ApiParam({ name: 'id', description: 'Model ID' })
  @ApiResponse({ status: 200, description: 'Model information' })
  @ApiResponse({ status: 404, description: 'Model not found' })
  modelInfo(@Param('id') id: string) {
    try {
      const info = this.ai.getModelInfo(id);
      if (!info) {
        throw new BadRequestException(`Model "${id}" not found in catalogue`);
      }
      return info;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`Failed to get model info: ${error.message}`);
      throw new InternalServerErrorException('Failed to get model information');
    }
  }

  @Post('models/pull')
  @ApiOperation({ summary: 'Pull / download a model from Ollama registry' })
  @ApiResponse({ status: 201, description: 'Model pull initiated' })
  @ApiResponse({ status: 400, description: 'Invalid model name' })
  async pullModel(@Body() body: PullModelDto) {
    try {
      // Validate model name
      if (!body.model || body.model.length < 2) {
        throw new BadRequestException('Invalid model name');
      }

      this.logger.log(`Pulling model: ${body.model}`);
      const result = await this.ai.pullModel(body.model);
      return {
        ...result,
        message: `Model "${body.model}" pull initiated`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`Failed to pull model: ${error.message}`);
      throw new InternalServerErrorException(`Failed to pull model: ${body.model}`);
    }
  }

  @Delete('models/:name')
  @ApiOperation({ summary: 'Delete an installed model' })
  @ApiParam({ name: 'name', description: 'Model name' })
  @ApiResponse({ status: 200, description: 'Model deleted' })
  @ApiResponse({ status: 400, description: 'Cannot delete active model' })
  async deleteModel(@Param('name') name: string) {
    try {
      // Validate model name (security)
      if (!this.isValidModelName(name)) {
        throw new BadRequestException('Invalid model name format');
      }

      // Check if it's the active model
      const active = this.ai.getActiveModel();
      if (active === name) {
        throw new BadRequestException(`Cannot delete active model "${name}". Switch to another model first.`);
      }

      this.logger.log(`Deleting model: ${name}`);
      const result = await this.ai.deleteModel(name);
      return {
        ...result,
        message: `Model "${name}" deleted`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`Failed to delete model: ${error.message}`);
      throw new InternalServerErrorException(`Failed to delete model: ${name}`);
    }
  }

  // ─── Chat & Completion ────────────────────────────────────────────────────

  @Post('chat')
  @ApiOperation({ summary: 'Chat completion (specify model or use active)' })
  @ApiResponse({ status: 200, description: 'Chat completion' })
  async chat(@Body() options: ChatCompletionOptions) {
    try {
      this.logger.log(`Chat request (model: ${options.model || 'default'})`);
      return await this.ai.chatCompletion(options);
    } catch (error) {
      this.logger.error(`Chat failed: ${error.message}`);
      throw new InternalServerErrorException('Chat completion failed');
    }
  }

  @Post('complete')
  @ApiOperation({ summary: 'Simple prompt completion' })
  @ApiResponse({ status: 200, description: 'Completion result' })
  async complete(@Body() body: CompleteDto) {
    try {
      this.logger.log(`Complete request (model: ${body.model || 'default'})`);
      const content = await this.ai.complete(body.prompt, body.system, body.model);
      return { 
        content,
        model: body.model || this.ai.getActiveModel(),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`Complete failed: ${error.message}`);
      throw new InternalServerErrorException('Completion failed');
    }
  }

  @Post('embed')
  @ApiOperation({ summary: 'Generate text embedding vector' })
  @ApiResponse({ status: 200, description: 'Embedding vector' })
  async embed(@Body() body: EmbedDto) {
    try {
      this.logger.log(`Embedding request (${body.text.length} chars)`);
      const embedding = await this.ai.generateEmbedding(body.text, body.model);
      return { 
        embedding,
        dimensions: embedding.length,
        model: body.model || this.ai.getActiveModel(),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`Embedding failed: ${error.message}`);
      throw new InternalServerErrorException('Embedding generation failed');
    }
  }

  // ─── Vision ───────────────────────────────────────────────────────────────

  @Post('vision/describe')
  @ApiOperation({ summary: 'Ask Kobe about a photo (describe, read a label, etc.)' })
  @ApiResponse({ status: 200, description: 'Image description' })
  async visionDescribe(@Body() body: VisionDescribeDto) {
    try {
      this.logger.log(`Vision describe request`);
      const content = await this.ai.describeImage(
        body.image, 
        body.prompt ?? 'Describe this image for a business owner.'
      );
      return { 
        content,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`Vision describe failed: ${error.message}`);
      throw new InternalServerErrorException('Image description failed');
    }
  }

  @Post('vision/product')
  @ApiOperation({ summary: 'Draft a product listing from a photo' })
  @ApiResponse({ status: 200, description: 'Product listing draft' })
  async visionProduct(@Body() body: VisionProductDto) {
    try {
      this.logger.log(`Vision product request`);
      const result = await this.ai.describeProductImage(body.image);
      return {
        ...result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`Vision product failed: ${error.message}`);
      throw new InternalServerErrorException('Product image analysis failed');
    }
  }

  // ─── Specialised Content Generation ──────────────────────────────────────

  @Post('video-script')
  @ApiOperation({ summary: 'Generate video script' })
  @ApiResponse({ status: 200, description: 'Video script' })
  async videoScript(@Body() body: VideoScriptDto) {
    try {
      this.logger.log(`Video script request for: ${body.topic}`);
      const content = await this.ai.generateVideoScript(body.topic, body.scenes);
      return { 
        content,
        metadata: {
          topic: body.topic,
          scenes: body.scenes || 5,
          generatedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      this.logger.error(`Video script generation failed: ${error.message}`);
      throw new InternalServerErrorException('Video script generation failed');
    }
  }

  @Post('image-prompt')
  @ApiOperation({ summary: 'Generate image generation prompt' })
  @ApiResponse({ status: 200, description: 'Image generation prompt' })
  async imagePrompt(@Body() body: ImagePromptDto) {
    try {
      this.logger.log(`Image prompt generation for: ${body.scene}`);
      const content = await this.ai.generateImagePrompt(body.scene, body.style);
      return { 
        content,
        metadata: {
          scene: body.scene,
          style: body.style || 'realistic',
          generatedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      this.logger.error(`Image prompt generation failed: ${error.message}`);
      throw new InternalServerErrorException('Image prompt generation failed');
    }
  }

  @Post('code')
  @ApiOperation({ summary: 'Generate code (uses coder model)' })
  @ApiResponse({ status: 200, description: 'Generated code' })
  async code(@Body() body: CodeDto) {
    try {
      this.logger.log(`Code generation request (lang: ${body.language || 'auto'})`);
      const content = await this.ai.generateCode(body.prompt, body.language);
      return { 
        content,
        language: body.language || 'auto-detected',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`Code generation failed: ${error.message}`);
      throw new InternalServerErrorException('Code generation failed');
    }
  }

  // ─── Sports Analytics ─────────────────────────────────────────────────────

  @Post('sports/commentary')
  @ApiOperation({ summary: 'Generate live football commentary' })
  @ApiResponse({ status: 200, description: 'Commentary text' })
  async commentary(@Body() body: SportsCommentaryDto) {
    try {
      this.logger.log(`Commentary request`);
      const content = await this.ai.generateMatchCommentary(body.context);
      return { 
        content,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`Commentary generation failed: ${error.message}`);
      throw new InternalServerErrorException('Commentary generation failed');
    }
  }

  @Post('sports/analyse')
  @ApiOperation({ summary: 'Analyse match statistics' })
  @ApiResponse({ status: 200, description: 'Analysis result' })
  async analyseStats(@Body() body: SportsStatsDto) {
    try {
      this.logger.log(`Stats analysis request`);
      const content = await this.ai.analyseMatchStats(body.stats);
      return { 
        content,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
this.logger.error(`Some message: ${message}`);
      throw new InternalServerErrorException('Stats analysis failed');
    }
  }

  @Post('sports/report')
  @ApiOperation({ summary: 'Generate post-match report' })
  @ApiResponse({ status: 200, description: 'Match report' })
  async matchReport(@Body() body: SportsReportDto) {
    try {
      this.logger.log(`Match report request`);
      const content = await this.ai.generateMatchReport(body.matchData);
      return { 
        content,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
this.logger.error(`Some message: ${message}`);
      throw new InternalServerErrorException('Match report generation failed');
    }
  }

  @Post('sports/formation')
  @ApiOperation({ summary: 'Predict formation from player positions' })
  @ApiResponse({ status: 200, description: 'Formation prediction' })
  async formation(@Body() body: SportsFormationDto) {
    try {
      this.logger.log(`Formation prediction for ${body.positions.length} players`);
      const content = await this.ai.predictFormation(body.positions);
      return { 
        content,
        metadata: {
          playerCount: body.positions.length,
          generatedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
this.logger.error(`Some message: ${message}`);
      throw new InternalServerErrorException('Formation prediction failed');
    }
  }

  // ─── Private Helper Methods ──────────────────────────────────────────────

  private isValidModelName(name: string): boolean {
    // Security: Only allow alphanumeric, hyphens, underscores, colons, and dots
    // Ollama model names typically look like: "llama2", "mistral:7b", "codellama:13b"
    return /^[a-zA-Z0-9][a-zA-Z0-9_.\-:]*$/.test(name) && name.length > 0 && name.length <= 100;
  }
}
