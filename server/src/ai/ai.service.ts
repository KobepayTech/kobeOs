import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatCompletionResult {
  content: string;
  model: string;
  provider: 'ollama';
  usage?: { prompt: number; completion: number; total: number };
}

@Injectable()
export class AiService {
  private readonly logger = new Logger('AiService');
  private readonly ollamaUrl: string;
  private readonly defaultModel: string;

  constructor(private readonly config: ConfigService) {
    this.ollamaUrl = this.config.get('OLLAMA_URL', 'http://localhost:11434');
    this.defaultModel = this.config.get('OLLAMA_MODEL', 'deepseek-r1:8b');
  }

  /**
   * Chat completion using local Ollama models.
   * Default: deepseek-r1 (local DeepSeek reasoning model)
   */
  async chatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    const model = options.model || this.defaultModel;

    const res = await fetch(`${this.ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: options.messages,
        stream: false,
        options: {
          temperature: options.temperature ?? 0.7,
          num_predict: options.maxTokens ?? 4096,
        },
      }),
      signal: AbortSignal.timeout(120000), // 2 min for reasoning models
    });

    if (!res.ok) {
      const text = await res.text().catch(() => 'Unknown error');
      throw new Error(`Ollama HTTP ${res.status}: ${text}`);
    }

    const data = await res.json();
    return {
      content: data.message?.content || '',
      model: data.model || model,
      provider: 'ollama',
      usage: {
        prompt: data.prompt_eval_count || 0,
        completion: data.eval_count || 0,
        total: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      },
    };
  }

  /** Simple text completion */
  async complete(prompt: string, systemPrompt?: string): Promise<string> {
    const messages: ChatMessage[] = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });
    const result = await this.chatCompletion({ messages });
    return result.content;
  }

  /** Generate video script */
  async generateVideoScript(topic: string, scenes = 5): Promise<string> {
    return this.complete(
      `Write a ${scenes}-scene video script about: ${topic}. Each scene 1-2 sentences. Total 30-60 seconds.`,
      `You are a professional video script writer. Output only script text, no markdown.`
    );
  }

  /** Generate image prompt */
  async generateImagePrompt(scene: string, style?: string): Promise<string> {
    const styleHint = style ? ` Style: ${style}.` : '';
    return this.complete(
      `Create detailed English image generation prompt:${styleHint}\nScene: ${scene}`,
      `You are an AI image prompt engineer. Output only the prompt text.`
    );
  }

  /** Generate code */
  async generateCode(prompt: string, language?: string): Promise<string> {
    const langHint = language ? ` in ${language}` : '';
    return this.complete(
      `Write clean, production-ready code${langHint} for: ${prompt}`,
      `You are an expert software engineer. Write clean, well-commented code.`
    );
  }

  /** Check Ollama health */
  async health(): Promise<{ running: boolean; models: string[]; defaultModel: string }> {
    try {
      const res = await fetch(`${this.ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return { running: false, models: [], defaultModel: this.defaultModel };
      const data = await res.json();
      return {
        running: true,
        models: data.models?.map((m: any) => m.name) || [],
        defaultModel: this.defaultModel,
      };
    } catch {
      return { running: false, models: [], defaultModel: this.defaultModel };
    }
  }

  /** Pull a model via Ollama */
  async pullModel(modelName: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${this.ollamaUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName, stream: false }),
        signal: AbortSignal.timeout(300000),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => 'Unknown');
        return { success: false, message: `HTTP ${res.status}: ${text}` };
      }
      return { success: true, message: `Model ${modelName} pulled` };
    } catch (err) {
      return { success: false, message: (err as Error).message };
    }
  }
}
