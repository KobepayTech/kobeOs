import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiService, ChatCompletionOptions } from './ai.service';

@ApiTags('AI / LLM')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('health')
  @ApiOperation({ summary: 'Check Ollama status and list models' })
  async health() { return this.ai.health(); }

  @Post('chat')
  @ApiOperation({ summary: 'Chat with local DeepSeek' })
  async chat(@Body() options: ChatCompletionOptions) { return this.ai.chatCompletion(options); }

  @Post('complete')
  @ApiOperation({ summary: 'Simple completion' })
  async complete(@Body() body: { prompt: string; system?: string }) {
    return { content: await this.ai.complete(body.prompt, body.system) };
  }

  @Post('video-script')
  @ApiOperation({ summary: 'Generate video script' })
  async videoScript(@Body() body: { topic: string; scenes?: number }) {
    return { content: await this.ai.generateVideoScript(body.topic, body.scenes) };
  }

  @Post('image-prompt')
  @ApiOperation({ summary: 'Generate image prompt' })
  async imagePrompt(@Body() body: { scene: string; style?: string }) {
    return { content: await this.ai.generateImagePrompt(body.scene, body.style) };
  }

  @Post('code')
  @ApiOperation({ summary: 'Generate code' })
  async code(@Body() body: { prompt: string; language?: string }) {
    return { content: await this.ai.generateCode(body.prompt, body.language) };
  }

  @Post('pull-model')
  @ApiOperation({ summary: 'Download new model' })
  async pullModel(@Body() body: { model: string }) {
    return this.ai.pullModel(body.model);
  }
}
