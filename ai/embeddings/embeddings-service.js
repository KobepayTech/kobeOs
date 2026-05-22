'use strict';

/**
 * ai/embeddings/embeddings-service.js
 *
 * Vector embeddings and semantic search for KobeOS.
 *
 * Uses nomic-embed-text via Ollama for generating embeddings.
 * Stores vectors in-memory (or optionally in a JSON file for persistence).
 *
 * Use cases:
 *   - Semantic search across notes, documents, products
 *   - RAG (Retrieval-Augmented Generation) for the AI assistant
 *   - Duplicate detection
 *   - Recommendation engine
 */

const fs   = require('fs');
const path = require('path');

class EmbeddingsService {
  constructor(ollamaBridge, storePath = null, model = 'nomic-embed-text') {
    this.ollama    = ollamaBridge;
    this.model     = model;
    this.storePath = storePath;
    this._store    = new Map(); // id → { text, vector, metadata }
    if (storePath && fs.existsSync(storePath)) this._load();
  }

  // ── Embedding generation ──────────────────────────────────────────────────

  async embed(text) {
    if (!this.ollama) throw new Error('Ollama bridge not configured');
    const result = await this.ollama.embed(this.model, text);
    // Ollama returns { embeddings: [[...]] } or { embedding: [...] }
    return result?.embeddings?.[0] ?? result?.embedding ?? [];
  }

  async embedBatch(texts) {
    return Promise.all(texts.map(t => this.embed(t)));
  }

  // ── Store management ──────────────────────────────────────────────────────

  async add(id, text, metadata = {}) {
    const vector = await this.embed(text);
    this._store.set(id, { id, text, vector, metadata, addedAt: Date.now() });
    if (this.storePath) this._save();
    return { id, dimensions: vector.length };
  }

  remove(id) {
    this._store.delete(id);
    if (this.storePath) this._save();
  }

  clear() {
    this._store.clear();
    if (this.storePath) this._save();
  }

  // ── Semantic search ───────────────────────────────────────────────────────

  /**
   * Find the top-k most similar items to a query string.
   * Returns items sorted by cosine similarity (highest first).
   */
  async search(query, topK = 5, filter) {
    if (this._store.size === 0) return [];
    const queryVec = await this.embed(query);
    const results = [];

    for (const item of this._store.values()) {
      if (filter && !filter(item)) continue;
      const score = this._cosine(queryVec, item.vector);
      results.push({ ...item, score });
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(({ vector: _, ...rest }) => rest); // strip raw vector from output
  }

  /**
   * Find similar items to an existing stored item by id.
   */
  async findSimilar(id, topK = 5) {
    const item = this._store.get(id);
    if (!item) throw new Error(`Item not found: ${id}`);
    const results = [];
    for (const other of this._store.values()) {
      if (other.id === id) continue;
      results.push({ ...other, score: this._cosine(item.vector, other.vector) });
    }
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(({ vector: _, ...rest }) => rest);
  }

  // ── Cosine similarity ─────────────────────────────────────────────────────

  _cosine(a, b) {
    if (!a?.length || !b?.length || a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot   += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  _save() {
    try {
      const data = JSON.stringify([...this._store.values()]);
      fs.writeFileSync(this.storePath, data);
    } catch { /* ignore */ }
  }

  _load() {
    try {
      const items = JSON.parse(fs.readFileSync(this.storePath, 'utf8'));
      for (const item of items) this._store.set(item.id, item);
    } catch { /* ignore */ }
  }

  getStatus() {
    return {
      model:      this.model,
      items:      this._store.size,
      persistent: !!this.storePath,
    };
  }
}

module.exports = EmbeddingsService;
