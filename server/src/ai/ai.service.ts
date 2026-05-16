import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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

/** Catalogue of all supported offline models with metadata. */
export interface ModelInfo {
  id: string;           // Ollama pull name  e.g. "mistral:7b"
  name: string;         // Display name
  category: ModelCategory;
  description: string;
  sizeGb: number;       // Approximate download size
  recommended: boolean;
}

export type ModelCategory =
  | 'chat'        // General assistant / reasoning
  | 'coding'      // Code generation
  | 'vision'      // Image / video understanding
  | 'speech'      // STT / TTS
  | 'embedding'   // Vector embeddings
  | 'sports'      // Football / sports analytics
  | 'ocr'         // Document / OCR
  | 'multimodal'; // Combined

export const MODEL_CATALOGUE: ModelInfo[] = [
  // ── Chat & Reasoning ──────────────────────────────────────────────────────
  { id: 'mistral:7b',          name: 'Mistral 7B',        category: 'chat',      description: 'Fast general assistant, great for customer support and automation', sizeGb: 4.1,  recommended: true  },
  { id: 'deepseek-r1:8b',      name: 'DeepSeek R1 8B',    category: 'chat',      description: 'Reasoning model — default Kobe assistant',                          sizeGb: 4.9,  recommended: true  },
  { id: 'llama3:8b',           name: 'Llama 3 8B',        category: 'chat',      description: 'Meta advanced reasoning, strong multilingual',                      sizeGb: 4.7,  recommended: true  },
  { id: 'gemma2:9b',           name: 'Gemma 2 9B',        category: 'chat',      description: 'Google lightweight model, fast on CPU',                             sizeGb: 5.4,  recommended: false },
  { id: 'phi3:mini',           name: 'Phi-3 Mini',        category: 'chat',      description: 'Microsoft small fast model, ideal for edge devices',                sizeGb: 2.3,  recommended: false },
  { id: 'qwen2.5:7b',          name: 'Qwen 2.5 7B',       category: 'chat',      description: 'Alibaba multilingual assistant, strong Swahili/Arabic support',     sizeGb: 4.4,  recommended: true  },
  // ── Coding ────────────────────────────────────────────────────────────────
  { id: 'deepseek-coder:6.7b', name: 'DeepSeek Coder',    category: 'coding',    description: 'Best offline coding assistant for KobeOS IDE',                     sizeGb: 3.8,  recommended: true  },
  { id: 'codellama:7b',        name: 'Code Llama 7B',     category: 'coding',    description: 'Meta code generation, supports 20+ languages',                     sizeGb: 3.8,  recommended: false },
  { id: 'starcoder2:7b',       name: 'StarCoder 2 7B',    category: 'coding',    description: 'HuggingFace code model, strong Python/TypeScript',                  sizeGb: 4.0,  recommended: false },
  // ── Multimodal / Vision ───────────────────────────────────────────────────
  { id: 'llava:7b',            name: 'LLaVA 7B',          category: 'multimodal', description: 'Vision + language — analyse images, football frames',             sizeGb: 4.5,  recommended: true  },
  { id: 'moondream:1.8b',      name: 'Moondream 1.8B',    category: 'vision',    description: 'Tiny vision model for edge devices',                               sizeGb: 1.1,  recommended: false },
  // ── Embeddings ────────────────────────────────────────────────────────────
  { id: 'nomic-embed-text',    name: 'Nomic Embed Text',  category: 'embedding', description: 'Vector embeddings for RAG / semantic search',                      sizeGb: 0.3,  recommended: true  },
  { id: 'mxbai-embed-large',   name: 'MxBai Embed Large', category: 'embedding', description: 'High-quality embeddings for document search',                      sizeGb: 0.7,  recommended: false },
  // ── Sports / Analytics ────────────────────────────────────────────────────
  { id: 'llama3:8b',           name: 'Sports Commentary', category: 'sports',    description: 'Llama 3 tuned for football commentary and match analysis',          sizeGb: 4.7,  recommended: true  },
];

/** Recommended starter pack for a fresh KobeOS install */
export const RECOMMENDED_MODELS = MODEL_CATALOGUE.filter((m) => m.recommended);

@Injectable()
export class AiService {
  private readonly logger = new Logger('AiService');
  private readonly ollamaUrl: string;
  private activeModel: string;

  constructor(private readonly config: ConfigService) {
    this.ollamaUrl = this.config.get('OLLAMA_URL', 'http://localhost:11434');
    this.activeModel = this.config.get('OLLAMA_MODEL', 'deepseek-r1:8b');
  }

  // ── Model registry ────────────────────────────────────────────────────────

  /** Return the full model catalogue with install status from Ollama. */
  async listCatalogue(): Promise<(ModelInfo & { installed: boolean })[]> {
    const installed = await this.getInstalledModelNames();
    return MODEL_CATALOGUE.map((m) => ({
      ...m,
      installed: installed.includes(m.id),
    }));
  }

  /** Return only models currently installed in Ollama. */
  async listInstalled(): Promise<{ name: string; size: number; modifiedAt: string }[]> {
    try {
      const res = await fetch(`${this.ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.models ?? []).map((m: { name: string; size: number; modified_at: string }) => ({
        name: m.name,
        size: m.size,
        modifiedAt: m.modified_at,
      }));
    } catch {
      return [];
    }
  }

  getActiveModel(): string { return this.activeModel; }

  setActiveModel(modelId: string): void {
    this.activeModel = modelId;
    this.logger.log(`Active model switched to: ${modelId}`);
  }

  getModelInfo(modelId: string): ModelInfo {
    const info = MODEL_CATALOGUE.find((m) => m.id === modelId);
    if (!info) throw new NotFoundException(`Model '${modelId}' not in catalogue`);
    return info;
  }

  getCatalogueByCategory(category: ModelCategory): ModelInfo[] {
    return MODEL_CATALOGUE.filter((m) => m.category === category);
  }

  // ── Chat & completions ────────────────────────────────────────────────────

  async chatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    const model = options.model || this.activeModel;
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
      signal: AbortSignal.timeout(120_000),
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

  async complete(prompt: string, systemPrompt?: string, model?: string): Promise<string> {
    const messages: ChatMessage[] = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });
    const result = await this.chatCompletion({ messages, model });
    return result.content;
  }

  // ── Specialised completions ───────────────────────────────────────────────

  async generateVideoScript(topic: string, scenes = 5): Promise<string> {
    return this.complete(
      `Write a ${scenes}-scene video script about: ${topic}. Each scene 1-2 sentences. Total 30-60 seconds.`,
      'You are a professional video script writer. Output only script text, no markdown.',
    );
  }

  async generateImagePrompt(scene: string, style?: string): Promise<string> {
    const styleHint = style ? ` Style: ${style}.` : '';
    return this.complete(
      `Create detailed English image generation prompt:${styleHint}\nScene: ${scene}`,
      'You are an AI image prompt engineer. Output only the prompt text.',
    );
  }

  async generateCode(prompt: string, language?: string): Promise<string> {
    const langHint = language ? ` in ${language}` : '';
    return this.complete(
      `Write clean, production-ready code${langHint} for: ${prompt}`,
      'You are an expert software engineer. Write clean, well-commented code.',
      this.config.get('OLLAMA_CODER_MODEL', 'deepseek-coder:6.7b'),
    );
  }

  // ── Sports AI ─────────────────────────────────────────────────────────────

  async generateMatchCommentary(matchContext: string): Promise<string> {
    return this.complete(
      `Generate live football commentary for this match situation: ${matchContext}`,
      'You are an expert football commentator. Be energetic, accurate, and concise. Max 2 sentences.',
    );
  }

  async analyseMatchStats(stats: Record<string, unknown>): Promise<string> {
    return this.complete(
      `Analyse these football match statistics and provide tactical insights:\n${JSON.stringify(stats, null, 2)}`,
      'You are a professional football analyst. Provide clear tactical insights, formation analysis, and key observations.',
    );
  }

  async generateMatchReport(matchData: Record<string, unknown>): Promise<string> {
    return this.complete(
      `Write a professional post-match report for:\n${JSON.stringify(matchData, null, 2)}`,
      'You are a sports journalist. Write a concise, professional match report with key moments, player ratings, and tactical analysis.',
    );
  }

  async predictFormation(playerPositions: string[]): Promise<string> {
    return this.complete(
      `Based on these player positions, identify the formation and tactical setup: ${playerPositions.join(', ')}`,
      'You are a football tactics expert. Identify the formation (e.g. 4-3-3, 4-4-2) and describe the tactical intent.',
    );
  }

  // ── Embeddings ────────────────────────────────────────────────────────────

  async generateEmbedding(text: string, model = 'nomic-embed-text'): Promise<number[]> {
    const res = await fetch(`${this.ollamaUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: text }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Embedding failed: HTTP ${res.status}`);
    const data = await res.json();
    return data.embedding ?? [];
  }

  // ── Health & model management ─────────────────────────────────────────────

  async health(): Promise<{ running: boolean; models: string[]; activeModel: string; ollamaUrl: string }> {
    try {
      const res = await fetch(`${this.ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return { running: false, models: [], activeModel: this.activeModel, ollamaUrl: this.ollamaUrl };
      const data = await res.json();
      return {
        running: true,
        models: data.models?.map((m: { name: string }) => m.name) || [],
        activeModel: this.activeModel,
        ollamaUrl: this.ollamaUrl,
      };
    } catch {
      return { running: false, models: [], activeModel: this.activeModel, ollamaUrl: this.ollamaUrl };
    }
  }

  async pullModel(modelName: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${this.ollamaUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName, stream: false }),
        signal: AbortSignal.timeout(600_000), // 10 min for large models
      });
      if (!res.ok) {
        const text = await res.text().catch(() => 'Unknown');
        return { success: false, message: `HTTP ${res.status}: ${text}` };
      }
      return { success: true, message: `Model ${modelName} pulled successfully` };
    } catch (err) {
      return { success: false, message: (err as Error).message };
    }
  }

  async deleteModel(modelName: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${this.ollamaUrl}/api/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) return { success: false, message: `HTTP ${res.status}` };
      return { success: true, message: `Model ${modelName} deleted` };
    } catch (err) {
      return { success: false, message: (err as Error).message };
    }
  }

  private async getInstalledModelNames(): Promise<string[]> {
    const installed = await this.listInstalled();
    return installed.map((m) => m.name);
  }
}
