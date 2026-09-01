'use strict';

const BaseService = require('./_base-service');
const http        = require('http');

/**
 * Kobe AI Service
 *
 * Provides local AI inference via Ollama (DeepSeek/Llama).
 * Falls back to a stub when Ollama is not installed.
 *
 * Exposes:
 *   isAvailable()                    → boolean
 *   getModels()                      → [{ name, size }]
 *   chat(model, messages)            → AsyncGenerator<token>
 *   embed(model, text)               → number[]
 *   getStatus()
 */
class AIService extends BaseService {
  constructor(hal) {
    super('ai', hal);
    this._ollamaUrl  = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
    this._available  = false;
    this._models     = [];
    this._defaultModel = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
  }

  async _start() {
    this._available = await this._checkOllama();
    if (this._available) {
      this._models = await this._fetchModels();
      console.log(`[AIService] Ollama available — ${this._models.length} model(s)`);
    } else {
      console.log('[AIService] Ollama not available — AI features disabled');
    }
  }

  async _stop() {
    this._available = false;
  }

  async _checkOllama() {
    return new Promise(resolve => {
      const req = http.get(`${this._ollamaUrl}/api/tags`, { timeout: 2000 }, res => {
        resolve(res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
    });
  }

  async _fetchModels() {
    return new Promise(resolve => {
      const req = http.get(`${this._ollamaUrl}/api/tags`, { timeout: 3000 }, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve((json.models || []).map(m => ({ name: m.name, size: m.size })));
          } catch { resolve([]); }
        });
      });
      req.on('error', () => resolve([]));
    });
  }

  isAvailable() { return this._available; }
  getModels()   { return this._models; }

  /**
   * Stream a chat completion. Returns a Promise<string> for simplicity
   * (streaming is handled via IPC events in the renderer).
   */
  async chat(model, messages, onToken) {
    if (!this._available) throw new Error('AI service not available');
    const body = JSON.stringify({
      model: model || this._defaultModel,
      messages,
      stream: true,
      keep_alive: process.env.OLLAMA_KEEP_ALIVE || '2h',
    });
    return new Promise((resolve, reject) => {
      const url = new URL(`${this._ollamaUrl}/api/chat`);
      const req = http.request({
        hostname: url.hostname,
        port:     url.port || 11434,
        path:     url.pathname,
        method:   'POST',
        headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        timeout:  60000,
      }, res => {
        let pending = '';
        let content = '';
        res.on('data', chunk => {
          pending += chunk.toString();
          const lines = pending.split('\n');
          pending = lines.pop() || '';
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const json = JSON.parse(line);
              const token = json.message?.content || '';
              if (token) {
                content += token;
                if (onToken) onToken(token);
              }
            } catch { /* wait for a complete NDJSON line */ }
          }
        });
        res.on('end', () => {
          if (pending.trim()) {
            try {
              const json = JSON.parse(pending);
              const token = json.message?.content || '';
              if (token) {
                content += token;
                if (onToken) onToken(token);
              }
            } catch { /* final partial line is ignored */ }
          }
          resolve(content);
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  async embed(model, text) {
    if (!this._available) return [];
    const body = JSON.stringify({ model: model || process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text', prompt: text });
    return new Promise((resolve) => {
      const url = new URL(`${this._ollamaUrl}/api/embeddings`);
      const req = http.request({
        hostname: url.hostname, port: url.port || 11434,
        path: url.pathname, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        timeout: 10000,
      }, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try { resolve(JSON.parse(data).embedding || []); } catch { resolve([]); }
        });
      });
      req.on('error', () => resolve([]));
      req.write(body);
      req.end();
    });
  }

  getStatus() {
    return {
      running:   this.running,
      available: this._available,
      models:    this._models.length,
      default:   this._defaultModel,
    };
  }
}

module.exports = AIService;
