'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { profile } = require('../electron/ai-edition.cjs');

function editionConfig(root = path.resolve(__dirname, '..')) {
  const base = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).build;
  return {
    ...base,
    appId: 'com.kobepaytech.kobeos.qwen3',
    productName: profile.name,
    directories: { ...base.directories },
    artifactName: 'KobeOS-Qwen3-${version}-${arch}.${ext}',
    extraMetadata: { kobeEdition: profile.id },
    generateUpdatesFilesForAllChannels: false,
    files: [...base.files, '!ai/**/*.gguf', '!ai/**/*.onnx', '!ai/**/*.bin', '!ai/**/*.safetensors'],
    extraResources: base.extraResources.map(resource => resource.to === 'models'
      ? { from: 'build/edition-qwen3-only/models', to: 'models', filter: ['models.json'] }
      : resource.to === 'ollama' ? { ...resource, filter: ['win-x64/**/*', '!**/cuda_v11/**', '!**/cuda_v12/**', '!**/cuda_v13/**'] }
      : resource.to === 'cloudflared' ? { ...resource, filter: ['cloudflared-win-x64.exe'] } : resource),
    nsis: { ...base.nsis, shortcutName: profile.name, artifactName: 'KobeOS-Qwen3-Setup-${version}.exe' },
    publish: base.publish.map(publisher => ({ ...publisher, channel: profile.updateChannel })),
  };
}

function prepare(root = path.resolve(__dirname, '..')) {
  const output = path.join(root, 'build/edition-qwen3-only');
  fs.mkdirSync(path.join(output, 'models'), { recursive: true });
  // Explicit allowlist in the builder config prevents stale GGUFs entering this edition.
  fs.writeFileSync(path.join(output, 'models/models.json'), JSON.stringify({
    edition: profile.id, default: profile.model, models: [],
    setup: 'Reuse an installed Qwen 3 8B model or install it once in Model Manager. Internet is needed only for the model download.',
  }, null, 2));
  const configPath = path.join(output, 'electron-builder.json');
  fs.writeFileSync(configPath, JSON.stringify(editionConfig(root), null, 2));
  return configPath;
}
if (require.main === module) console.log(prepare());
module.exports = { prepare, editionConfig };
