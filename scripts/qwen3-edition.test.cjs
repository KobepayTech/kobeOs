const { test } = require('node:test');
const assert = require('node:assert/strict');
const { editionConfig } = require('./prepare-qwen3-edition.cjs');
const { editionEnvironment, profile } = require('../electron/ai-edition.cjs');
const fs = require('node:fs');
const path = require('node:path');
const { exportPack } = require('./export-qwen3-model-pack.cjs');
test('edition isolates its identity, update feed and packaged model resources', () => {
  const config = editionConfig();
  assert.equal(config.extraMetadata.kobeEdition, profile.id);
  assert.notEqual(config.appId, require('../package.json').build.appId);
  assert.equal(config.generateUpdatesFilesForAllChannels, false);
  assert.ok(config.publish.every(p => p.channel === 'qwen3-only'));
  assert.deepEqual(config.extraResources.find(r => r.to === 'models').filter, ['models.json']);
  assert.ok(config.extraResources.find(r => r.to === 'ollama').filter.includes('!**/cuda_v12/**'));
});
test('one model handles every AI role and standard edition keeps its configuration', () => {
  assert.deepEqual(editionEnvironment('standard'), {});
  const env = editionEnvironment(profile.id);
  for (const role of ['MODEL', 'EVERYDAY_MODEL', 'ROUTER_MODEL', 'REASONING_MODEL', 'CODER_MODEL', 'VISION_MODEL']) {
    assert.equal(env[`OLLAMA_${role}`], profile.model);
  }
  assert.equal(env.KOBE_AI_FALLBACK_URL, '');
  assert.equal(env.OLLAMA_MAX_CONCURRENT, '1');
});
test('offline export includes only the selected model, excluding full-precision conversion inputs', () => {
  const parent = path.resolve('node_modules/.cache');
  const fixture = fs.mkdtempSync(path.join(parent, 'qwen-pack-test-'));
  try {
    const cache = path.join(fixture, 'cache');
    const manifest = path.join(cache, 'manifests/registry.ollama.ai/library/kobe-qwen3-vl/latest');
    fs.mkdirSync(path.dirname(manifest), { recursive: true });
    fs.mkdirSync(path.join(cache, 'blobs'), { recursive: true });
    const digest = 'a'.repeat(64);
    fs.writeFileSync(path.join(cache, 'blobs', `sha256-${digest}`), 'model');
    fs.writeFileSync(path.join(cache, 'blobs', 'unrelated-source'), 'large source');
    fs.writeFileSync(manifest, JSON.stringify({ config: { digest: `sha256:${digest}`, size: 5 }, layers: [] }));
    const output = path.join(fixture, 'pack');
    assert.equal(exportPack(cache, output).bytes, 5);
    assert.deepEqual(fs.readdirSync(path.join(output, 'qwen3-models/blobs')), [`sha256-${digest}`]);
    assert.throws(() => exportPack(cache, path.join(cache, 'nested')), /separate/);
  } finally {
    if (fixture.startsWith(parent + path.sep)) fs.rmSync(fixture, { recursive: true, force: true });
  }
});
