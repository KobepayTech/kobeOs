'use strict';

/**
 * ollama-bridge.js
 *
 * Thin wrapper around the Ollama HTTP API.
 * Used by runtime/services/ai-service.js.
 */

const http = require('http');

class OllamaBridge {
  constructor(baseUrl = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
  }

  async isAvailable() {
    try {
      await this._get('/api/tags');
      return true;
    } catch {
      return false;
    }
  }

  async listModels() {
    const res = await this._get('/api/tags');
    return res.models || [];
  }

  async chat(model, messages, options = {}) {
    return this._post('/api/chat', { model, messages, stream: false, ...options });
  }

  async generate(model, prompt, options = {}) {
    return this._post('/api/generate', { model, prompt, stream: false, ...options });
  }

  async embed(model, input) {
    return this._post('/api/embed', { model, input });
  }

  async pull(model, onProgress) {
    return new Promise((resolve, reject) => {
      const url = new URL('/api/pull', this.baseUrl);
      const body = JSON.stringify({ name: model, stream: true });
      const req = http.request({ hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, res => {
        res.on('data', chunk => {
          try {
            const line = JSON.parse(chunk.toString());
            if (onProgress) onProgress(line);
            if (line.status === 'success') resolve(line);
          } catch { /* partial chunk */ }
        });
        res.on('end', resolve);
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  _get(path) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      http.get(url.toString(), res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({}); } });
      }).on('error', reject);
    });
  }

  _post(path, body) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const payload = JSON.stringify(body);
      const req = http.request({ hostname: url.hostname, port: url.port || 11434, path: url.pathname, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({}); } });
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }
}

module.exports = OllamaBridge;
