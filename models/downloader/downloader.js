'use strict';

/**
 * models/downloader/downloader.js
 *
 * Downloads AI models via Ollama pull.
 * Called from the KobeOS model manager UI and the AI service setup wizard.
 */

const path = require('path');
const OllamaBridge = require('../../ai/llama-runtime/ollama-bridge');

async function downloadModel(modelTag, onProgress) {
  const ollama = new OllamaBridge(process.env.OLLAMA_URL || 'http://localhost:11434');

  const available = await ollama.isAvailable();
  if (!available) throw new Error('Ollama is not running. Start it with: ollama serve');

  console.log(`[Downloader] Pulling ${modelTag}…`);
  return ollama.pull(modelTag, (progress) => {
    if (onProgress) onProgress(progress);
    if (progress.total) {
      const pct = Math.round((progress.completed / progress.total) * 100);
      process.stdout.write(`\r  ${pct}% — ${progress.status}`);
    }
  });
}

async function listManifestModels() {
  const manifest = require('../manifests/default.json');
  return manifest.models;
}

module.exports = { downloadModel, listManifestModels };

// CLI usage: node downloader.js deepseek-r1:1.5b
if (require.main === module) {
  const tag = process.argv[2];
  if (!tag) { console.error('Usage: node downloader.js <model-tag>'); process.exit(1); }
  downloadModel(tag, null)
    .then(() => console.log('\nDone.'))
    .catch(e => { console.error(e.message); process.exit(1); });
}
