'use strict';

const fs   = require('fs');
const path = require('path');

/**
 * ModelManager
 *
 * Tracks which AI models are available locally, handles download
 * progress, and manages the model manifest.
 *
 * Models are stored in {userData}/models/ and described by
 * models/manifests/*.json.
 */
class ModelManager {
  constructor(modelsDir, ollamaBridge) {
    this.modelsDir = modelsDir;
    this.ollama    = ollamaBridge;
    this._manifest = null;
  }

  async loadManifest(manifestPath) {
    try {
      this._manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch {
      this._manifest = { models: [] };
    }
    return this._manifest;
  }

  async listAvailable() {
    if (!this.ollama) return [];
    return this.ollama.listModels();
  }

  async pull(modelName, onProgress) {
    if (!this.ollama) throw new Error('Ollama bridge not configured');
    return this.ollama.pull(modelName, onProgress);
  }

  getManifest() { return this._manifest; }
}

module.exports = ModelManager;
