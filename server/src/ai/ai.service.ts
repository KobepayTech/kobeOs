import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  /** Base64-encoded image bytes (no data: prefix). */
  images?: string[];
}

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Cancels the Ollama request when the client disconnects or presses Stop. */
  signal?: AbortSignal;
}

export interface ChatCompletionResult {
  content: string;
  model: string;
  provider: 'ollama';
  usage?: { prompt: number; completion: number; total: number };
}

export interface ModelInfo {
  id: string;
  name: string;
  category: ModelCategory;
  description: string;
  sizeGb: number;
  recommended: boolean;
}

export type ModelCategory =
  | 'chat'
  | 'coding'
  | 'vision'
  | 'speech'
  | 'embedding'
  | 'sports'
  | 'ocr'
  | 'translation'
  | 'image-edit'
  | 'multimodal';

export const MODEL_CATALOGUE: ModelInfo[] = [
  { id: 'mistral:7b', name: 'Mistral 7B', category: 'chat', description: 'Fast general assistant, great for customer support and automation', sizeGb: 4.1, recommended: true },
  { id: 'deepseek-r1:8b', name: 'DeepSeek R1 8B', category: 'chat', description: 'Reasoning model — default Kobe assistant', sizeGb: 4.9, recommended: true },
  { id: 'llama3:8b', name: 'Llama 3 8B', category: 'chat', description: 'Meta advanced reasoning, strong multilingual', sizeGb: 4.7, recommended: true },
  { id: 'gemma2:9b', name: 'Gemma 2 9B', category: 'chat', description: 'Google lightweight model, fast on CPU', sizeGb: 5.4, recommended: false },
  { id: 'phi3:mini', name: 'Phi-3 Mini', category: 'chat', description: 'Microsoft small fast model, ideal for edge devices', sizeGb: 2.3, recommended: false },
  { id: 'qwen2.5:7b', name: 'Qwen 2.5 7B', category: 'chat', description: 'Alibaba multilingual assistant, strong Swahili/Arabic support', sizeGb: 4.4, recommended: true },
  { id: 'deepseek-coder:6.7b', name: 'DeepSeek Coder', category: 'coding', description: 'Best offline coding assistant for KobeOS IDE', sizeGb: 3.8, recommended: true },
  { id: 'codellama:7b', name: 'Code Llama 7B', category: 'coding', description: 'Meta code generation, supports 20+ languages', sizeGb: 3.8, recommended: false },
  { id: 'starcoder2:7b', name: 'StarCoder 2 7B', category: 'coding', description: 'HuggingFace code model, strong Python/TypeScript', sizeGb: 4.0, recommended: false },
  { id: 'qwen2.5vl:7b', name: 'Qwen 2.5-VL 7B', category: 'multimodal', description: 'Vision-language model for images and annotated catalogues', sizeGb: 5.5, recommended: true },
  { id: 'llava:7b', name: 'LLaVA 7B', category: 'multimodal', description: 'Vision + language analysis', sizeGb: 4.5, recommended: true },
  { id: 'moondream:1.8b', name: 'Moondream 1.8B', category: 'vision', description: 'Tiny vision model for edge devices', sizeGb: 1.1, recommended: false },
  { id: 'nomic-embed-text', name: 'Nomic Embed Text', category: 'embedding', description: 'Vector embeddings for RAG and semantic search', sizeGb: 0.3, recommended: true },
  { id: 'mxbai-embed-large', name: 'MxBai Embed Large', category: 'embedding', description: 'High-quality document embeddings', sizeGb: 0.7, recommended: false },
  { id: 'whisper:base', name: 'Whisper Base', category: 'speech', description: 'Multilingual offline transcription', sizeGb: 0.08, recommended: true },
  { id: 'whisper:small', name: 'Whisper Small', category: 'speech', description: 'More accurate offline transcription', sizeGb: 0.24, recommended: false },
  { id: 'piper:en_US-amy-medium', name: 'Piper · Amy', category: 'speech', description: 'Offline US English neural voice', sizeGb: 0.063, recommended: true },
  { id: 'piper:en_GB-alba-medium', name: 'Piper · Alba', category: 'speech', description: 'Offline UK English neural voice', sizeGb: 0.063, recommended: false },
  { id: 'piper:en_US-libritts-high', name: 'Piper · LibriTTS', category: 'speech', description: 'Higher-quality offline voice', sizeGb: 0.12, recommended: false },
  { id: 'nllb-200-distilled-600M', name: 'NLLB-200 Distilled', category: 'translation', description: 'Offline translation for 200+ languages', sizeGb: 0.6, recommended: true },
  { id: 'rmbg-1.4', name: 'BRIA RMBG-1.4', category: 'image-edit', description: 'High-quality background removal', sizeGb: 0.17, recommended: true },
  { id: 'u2net', name: 'u²-Net', category: 'image-edit', description: 'MIT background-removal model', sizeGb: 0.17, recommended: false },
  { id: 'llama3:8b', name: 'Sports Commentary', category: 'sports', description: 'Football commentary and match analysis', sizeGb: 4.7, recommended: true },
];

export const RECOMMENDED_MODELS = MODEL_CATALOGUE.filter((model) => model.recommended);

export interface RuntimeHealth {
  running: boolean;
  models: string[];
  activeModel: string;
  ollamaUrl: string;
  latencyMs: number | null;
  queueDepth: number;
  lastError: string;
  circuitOpenUntil: string | null;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly ollamaUrl: string;
  private readonly requestTimeoutMs: number;
  private readonly maxConcurrent: number;
  private activeModel: string;
  private activeRequests = 0;
  private waiters: Array<() => void> = [];
  private consecutiveFailures = 0;
  private circuitOpenUntil = 0;
  private lastError = '';
  private installedCache: { at: number; names: string[] } = { at: 0, names: [] };

  constructor(private readonly config: ConfigService) {
    this.ollamaUrl = this.config.get('OLLAMA_URL', 'http://localhost:11434').replace(/\/$/, '');
    this.activeModel = this.config.get('OLLAMA_MODEL', 'deepseek-r1:8b');
    this.requestTimeoutMs = Number(this.config.get('OLLAMA_REQUEST_TIMEOUT_MS', 120_000));
    this.maxConcurrent = Math.max(1, Number(this.config.get('OLLAMA_MAX_CONCURRENT', 2)));
  }

  async listCatalogue(): Promise<(ModelInfo & { installed: boolean })[]> {
    const installed = await this.getInstalledModelNames();
    return MODEL_CATALOGUE.map((model) => ({ ...model, installed: installed.includes(model.id) }));
  }

  async listInstalled(): Promise<{ name: string; size: number; modifiedAt: string }[]> {
    try {
      const res = await this.fetchWithRetry(`${this.ollamaUrl}/api/tags`, { method: 'GET' }, 5_000, 1);
      const data = await res.json() as { models?: Array<{ name: string; size: number; modified_at: string }> };
      const models = (data.models ?? []).map((model) => ({ name: model.name, size: model.size, modifiedAt: model.modified_at }));
      this.installedCache = { at: Date.now(), names: models.map((model) => model.name) };
      return models;
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
    const info = MODEL_CATALOGUE.find((model) => model.id === modelId);
    if (!info) throw new NotFoundException(`Model '${modelId}' not in catalogue`);
    return info;
  }

  getCatalogueByCategory(category: ModelCategory): ModelInfo[] {
    return MODEL_CATALOGUE.filter((model) => model.category === category);
  }

  async chatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    if (this.circuitOpenUntil > Date.now()) {
      throw new ServiceUnavailableException(`Kobe AI is cooling down after repeated runtime failures. Retry after ${new Date(this.circuitOpenUntil).toLocaleTimeString()}.`);
    }
    const release = await this.acquireSlot(options.signal);
    try {
      const messages = this.prepareMessages(options.messages);
      const model = await this.routeModel(options.model, messages);
      const res = await this.fetchWithRetry(`${this.ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          options: {
            temperature: options.temperature ?? 0.45,
            num_predict: Math.min(Math.max(options.maxTokens ?? 2048, 64), 8192),
          },
        }),
        signal: options.signal,
      }, this.requestTimeoutMs, 2);
      const data = await res.json() as {
        message?: { content?: string };
        model?: string;
        prompt_eval_count?: number;
        eval_count?: number;
      };
      const content = this.cleanAnswer(data.message?.content || '');
      if (!content) throw new Error('The local model returned an empty answer. Try another installed chat model.');
      this.recordSuccess();
      return {
        content,
        model: data.model || model,
        provider: 'ollama',
        usage: {
          prompt: data.prompt_eval_count || 0,
          completion: data.eval_count || 0,
          total: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        },
      };
    } catch (error) {
      this.recordFailure(error);
      throw this.friendlyError(error);
    } finally {
      release();
    }
  }

  async complete(prompt: string, systemPrompt?: string, model?: string): Promise<string> {
    const messages: ChatMessage[] = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });
    return (await this.chatCompletion({ messages, model })).content;
  }

  /**
   * VISION SKILL — look at a photo and answer. Routes to the local vision model
   * automatically (images present). `image` is base64 (data: URI prefix is
   * stripped). Used for "describe this", "tag this product", "read this label".
   */
  async describeImage(image: string, prompt: string, systemPrompt?: string): Promise<string> {
    const b64 = (image || '').replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '').trim();
    if (!b64) throw new Error('No image provided.');
    const messages: ChatMessage[] = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt || 'Describe this image.', images: [b64] });
    return (await this.chatCompletion({ messages })).content;
  }

  /**
   * VISION SKILL (structured) — draft a product listing from a photo. Returns
   * best-effort {name, category, description, tags[]} the operator can edit.
   * Never invents price/cost. Falls back to a plain description on parse fail.
   */
  async describeProductImage(image: string): Promise<{ name: string; category: string; description: string; tags: string[]; raw: string }> {
    const raw = await this.describeImage(
      image,
      'You are cataloguing a product from its photo. Reply with ONLY a JSON object: {"name": short product name, "category": one category word, "description": one selling sentence, "tags": [3-6 short keywords]}. Do not invent price or brand you cannot see.',
      'You are a precise retail cataloguer. Output only JSON.',
    );
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      const obj = m ? JSON.parse(m[0]) : {};
      return {
        name: String(obj.name ?? '').slice(0, 120),
        category: String(obj.category ?? '').slice(0, 60),
        description: String(obj.description ?? '').slice(0, 400),
        tags: Array.isArray(obj.tags) ? obj.tags.map((t: unknown) => String(t).slice(0, 40)).slice(0, 6) : [],
        raw,
      };
    } catch {
      return { name: '', category: '', description: raw.slice(0, 400), tags: [], raw };
    }
  }

  async generateVideoScript(topic: string, scenes = 5): Promise<string> {
    return this.complete(`Write a ${scenes}-scene video script about: ${topic}. Each scene 1-2 sentences. Total 30-60 seconds.`, 'You are a professional video script writer. Output only script text, no markdown.');
  }

  async generateImagePrompt(scene: string, style?: string): Promise<string> {
    return this.complete(`Create detailed English image generation prompt:${style ? ` Style: ${style}.` : ''}\nScene: ${scene}`, 'You are an AI image prompt engineer. Output only the prompt text.');
  }

  async generateCode(prompt: string, language?: string): Promise<string> {
    return this.complete(`Write clean, production-ready code${language ? ` in ${language}` : ''} for: ${prompt}`, 'You are an expert software engineer. Write clean, well-commented code.', this.config.get('OLLAMA_CODER_MODEL', 'deepseek-coder:6.7b'));
  }

  async generateMatchCommentary(matchContext: string): Promise<string> {
    return this.complete(`Generate live football commentary for this match situation: ${matchContext}`, 'You are an expert football commentator. Be energetic, accurate, and concise. Max 2 sentences.');
  }

  async analyseMatchStats(stats: Record<string, unknown>): Promise<string> {
    return this.complete(`Analyse these football match statistics and provide tactical insights:\n${JSON.stringify(stats, null, 2)}`, 'You are a professional football analyst. Provide clear tactical insights, formation analysis, and key observations.');
  }

  async generateMatchReport(matchData: Record<string, unknown>): Promise<string> {
    return this.complete(`Write a professional post-match report for:\n${JSON.stringify(matchData, null, 2)}`, 'You are a sports journalist. Write a concise, professional match report with key moments, player ratings, and tactical analysis.');
  }

  async predictFormation(playerPositions: string[]): Promise<string> {
    return this.complete(`Based on these player positions, identify the formation and tactical setup: ${playerPositions.join(', ')}`, 'You are a football tactics expert. Identify the formation and describe the tactical intent.');
  }

  async generateEmbedding(text: string, model = 'nomic-embed-text'): Promise<number[]> {
    const res = await this.fetchWithRetry(`${this.ollamaUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: text.slice(0, 50_000) }),
    }, 30_000, 2);
    const data = await res.json() as { embedding?: number[] };
    return data.embedding ?? [];
  }

  async health(): Promise<RuntimeHealth> {
    const started = Date.now();
    try {
      const res = await this.fetchWithRetry(`${this.ollamaUrl}/api/tags`, { method: 'GET' }, 5_000, 0);
      const data = await res.json() as { models?: Array<{ name: string }> };
      const models = (data.models ?? []).map((model) => model.name);
      this.installedCache = { at: Date.now(), names: models };
      return {
        running: true,
        models,
        activeModel: this.activeModel,
        ollamaUrl: this.ollamaUrl,
        latencyMs: Date.now() - started,
        queueDepth: this.waiters.length,
        lastError: this.lastError,
        circuitOpenUntil: this.circuitOpenUntil > Date.now() ? new Date(this.circuitOpenUntil).toISOString() : null,
      };
    } catch (error) {
      return {
        running: false,
        models: [],
        activeModel: this.activeModel,
        ollamaUrl: this.ollamaUrl,
        latencyMs: null,
        queueDepth: this.waiters.length,
        lastError: error instanceof Error ? error.message : String(error),
        circuitOpenUntil: this.circuitOpenUntil > Date.now() ? new Date(this.circuitOpenUntil).toISOString() : null,
      };
    }
  }

  async pullModel(modelName: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await this.fetchWithRetry(`${this.ollamaUrl}/api/pull`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: modelName, stream: false }),
      }, 600_000, 1);
      if (!res.ok) return { success: false, message: `HTTP ${res.status}` };
      this.installedCache.at = 0;
      return { success: true, message: `Model ${modelName} pulled successfully` };
    } catch (error) { return { success: false, message: this.friendlyError(error).message }; }
  }

  async deleteModel(modelName: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.fetchWithRetry(`${this.ollamaUrl}/api/delete`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: modelName }),
      }, 30_000, 1);
      this.installedCache.at = 0;
      return { success: true, message: `Model ${modelName} deleted` };
    } catch (error) { return { success: false, message: this.friendlyError(error).message }; }
  }

  private prepareMessages(input: ChatMessage[]): ChatMessage[] {
    const valid = input
      .filter((message) => ['system', 'user', 'assistant'].includes(message.role) && typeof message.content === 'string')
      .map((message) => ({ ...message, content: message.content.slice(0, 20_000), images: message.images?.slice(0, 4) }));
    const system = valid.filter((message) => message.role === 'system').slice(-1);
    const conversation = valid.filter((message) => message.role !== 'system').slice(-30);
    const languageRule: ChatMessage = {
      role: 'system',
      content: 'Answer in the same language as the user. Be accurate and concise. Never claim that an external or business action succeeded unless a confirmed tool result says it succeeded. Do not reveal hidden reasoning.',
    };
    return [languageRule, ...system, ...conversation];
  }

  private cleanAnswer(content: string): string {
    return content
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/^\s*(?:assistant|kobechat|kobe ai)\s*:\s*/i, '')
      .trim();
  }

  private async routeModel(requested: string | undefined, messages: ChatMessage[]): Promise<string> {
    const installed = await this.getInstalledModelNames();
    if (!installed.length) {
      throw new Error('Ollama is running but no model is installed. Install a recommended chat model in Kobe Models.');
    }
    if (requested) {
      const exact = installed.find((name) => name === requested || name.split(':')[0] === requested.split(':')[0]);
      if (!exact) throw new Error(`Model ${requested} is not installed. Installed models: ${installed.join(', ')}`);
      return exact;
    }
    const needsVision = messages.some((message) => message.images?.length);
    const preferred = needsVision
      ? [this.config.get('OLLAMA_VISION_MODEL', 'qwen2.5vl:7b'), 'llava:7b', 'moondream:1.8b']
      : [this.activeModel, 'qwen2.5:7b', 'mistral:7b', 'llama3:8b', 'phi3:mini'];
    return preferred.find((candidate) => installed.some((name) => name === candidate || name.split(':')[0] === candidate.split(':')[0]))
      || installed[0];
  }

  private async getInstalledModelNames(): Promise<string[]> {
    if (Date.now() - this.installedCache.at < 15_000) return this.installedCache.names;
    const installed = await this.listInstalled();
    return installed.map((model) => model.name);
  }

  private async acquireSlot(signal?: AbortSignal): Promise<() => void> {
    if (this.activeRequests < this.maxConcurrent) {
      this.activeRequests += 1;
      return () => this.releaseSlot();
    }
    await new Promise<void>((resolve, reject) => {
      const waiter = () => { signal?.removeEventListener('abort', abort); resolve(); };
      const abort = () => { this.waiters = this.waiters.filter((item) => item !== waiter); reject(new DOMException('Request cancelled', 'AbortError')); };
      this.waiters.push(waiter);
      signal?.addEventListener('abort', abort, { once: true });
    });
    this.activeRequests += 1;
    return () => this.releaseSlot();
  }

  private releaseSlot() {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
    const next = this.waiters.shift();
    if (next) next();
  }

  private async fetchWithRetry(url: string, init: RequestInit, timeoutMs: number, retries: number): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(new DOMException('AI request timed out', 'TimeoutError')), timeoutMs);
      const external = init.signal;
      const abort = () => controller.abort(external?.reason);
      external?.addEventListener('abort', abort, { once: true });
      try {
        const res = await fetch(url, { ...init, signal: controller.signal });
        if (res.ok) return res;
        const text = await res.text().catch(() => '');
        const error = new Error(`Ollama HTTP ${res.status}${text ? `: ${text.slice(0, 500)}` : ''}`);
        if (res.status < 500 && res.status !== 429) throw error;
        lastError = error;
      } catch (error) {
        lastError = error;
        if (external?.aborted) throw error;
      } finally {
        clearTimeout(timeout);
        external?.removeEventListener('abort', abort);
      }
      if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, 350 * 2 ** attempt));
    }
    throw lastError instanceof Error ? lastError : new Error('Ollama request failed');
  }

  private recordSuccess() {
    this.consecutiveFailures = 0;
    this.circuitOpenUntil = 0;
    this.lastError = '';
  }

  private recordFailure(error: unknown) {
    this.consecutiveFailures += 1;
    this.lastError = error instanceof Error ? error.message : String(error);
    if (this.consecutiveFailures >= 3) this.circuitOpenUntil = Date.now() + 30_000;
    this.logger.warn(this.lastError);
  }

  private friendlyError(error: unknown): Error {
    const message = error instanceof Error ? error.message : String(error);
    if (/abort|cancel/i.test(message)) return new Error('Kobe AI request was cancelled.');
    if (/timed out|timeout/i.test(message)) return new ServiceUnavailableException('Kobe AI took too long to respond. The local model may be overloaded; retry or select a smaller model.');
    if (/ECONNREFUSED|fetch failed|network/i.test(message)) return new ServiceUnavailableException('Kobe AI runtime is offline. Start Ollama in Kobe Models, then retry.');
    if (/not installed|no model/i.test(message)) return new ServiceUnavailableException(message);
    if (/model.*not found|404/i.test(message)) return new ServiceUnavailableException('The selected AI model is not installed. Open Kobe Models and install or select another model.');
    return new ServiceUnavailableException(`Kobe AI could not complete the request: ${message}`);
  }
}
