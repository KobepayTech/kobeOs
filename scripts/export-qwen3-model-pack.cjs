'use strict';
// Export only the selected Ollama manifest and its referenced blobs, never the
// source Safetensors or unrelated models left in a conversion cache.
const fs = require('node:fs');
const path = require('node:path');
function exportPack(cache, output, executable) {
  cache = path.resolve(cache); output = path.resolve(output);
  if (output === cache || output.startsWith(cache + path.sep)) throw new Error('Choose a separate output directory');
  const relative = 'manifests/registry.ollama.ai/library/kobe-qwen3-vl/latest';
  const source = path.join(cache, relative);
  const manifest = JSON.parse(fs.readFileSync(source, 'utf8'));
  const entries = [manifest.config, ...manifest.layers];
  for (const entry of entries) {
    if (!/^sha256:[a-f0-9]{64}$/.test(entry.digest)) throw new Error('Invalid blob digest');
    const blob = path.join(cache, 'blobs', entry.digest.replace(':', '-'));
    if (fs.statSync(blob).size !== entry.size) throw new Error('Incomplete model blob');
  }
  const modelRoot = path.join(output, 'qwen3-models');
  fs.mkdirSync(path.join(modelRoot, path.dirname(relative)), { recursive: true });
  fs.mkdirSync(path.join(modelRoot, 'blobs'), { recursive: true });
  for (const entry of entries) {
    const filename = entry.digest.replace(':', '-');
    fs.copyFileSync(path.join(cache, 'blobs', filename), path.join(modelRoot, 'blobs', filename));
  }
  fs.copyFileSync(source, path.join(modelRoot, relative));
  if (executable) {
    fs.copyFileSync(path.resolve(executable), path.join(output, 'KobeOS-Qwen3.exe'));
    fs.writeFileSync(path.join(output, 'Start KobeOS.cmd'), [
      '@echo off', 'set "OLLAMA_MODELS=%~dp0qwen3-models"',
      'set "OLLAMA_HOST=127.0.0.1:11441"', 'set "OLLAMA_URL=http://127.0.0.1:11441"',
      'start "" "%~dp0KobeOS-Qwen3.exe"', '',
    ].join('\r\n'));
  }
  return { output, bytes: entries.reduce((sum, entry) => sum + entry.size, 0) };
}
if (require.main === module) {
  const [, , cache, output, executable] = process.argv;
  if (!cache || !output) throw new Error('Usage: node scripts/export-qwen3-model-pack.cjs <Ollama cache> <output folder> [portable exe]');
  console.log(JSON.stringify(exportPack(cache, output, executable)));
}
module.exports = { exportPack };
