#!/usr/bin/env node
/**
 * bundle-kobemodel.js
 *
 * Packages a locally-installed Ollama model into a .kobemodel bundle.
 *
 * A .kobemodel file is a gzip-compressed tar archive containing:
 *   manifest.json   — model metadata (id, version, license, category, …)
 *   Modelfile       — Ollama Modelfile (FROM + PARAMETER directives)
 *   blobs/          — model weight blobs (copied from ~/.ollama/blobs/)
 *
 * Usage:
 *   node scripts/bundle-kobemodel.js --model mistral:7b --output ./dist/models/
 *   node scripts/bundle-kobemodel.js --model kobe-football-vision:1b \
 *       --weights ./models/yolo/football.pt --output ./dist/models/
 *
 * Prerequisites:
 *   - Ollama installed and the model already pulled (for Ollama-based models)
 *   - For custom models: provide --weights path to the weights file
 *
 * Output:
 *   ./dist/models/<category>/<model-slug>.kobemodel
 *   SHA-256 of the bundle is printed — copy it into kobe-models.catalogue.ts
 */

import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'fs';
import { createHash } from 'crypto';
import { exec as execCb } from 'child_process';
import { promisify } from 'util';
import { join, basename } from 'path';
import { homedir } from 'os';
import { createGzip } from 'zlib';
import { pack } from 'tar-stream';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const exec = promisify(execCb);
const __dirname = dirname(fileURLToPath(import.meta.url));

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
};

const modelId = getArg('--model');
const outputDir = getArg('--output') ?? join(__dirname, '../dist/models');
const customWeights = getArg('--weights');

if (!modelId) {
  console.error('Usage: node scripts/bundle-kobemodel.js --model <id> [--output <dir>] [--weights <path>]');
  process.exit(1);
}

// ── Catalogue lookup ──────────────────────────────────────────────────────────

const catalogueSrc = readFileSync(
  join(__dirname, '../server/src/kobe-models/kobe-models.catalogue.ts'), 'utf8'
);

function getCatalogueEntry(id) {
  // Simple regex extraction — good enough for a build script
  const blocks = catalogueSrc.split(/(?=\s*\{[\s\S]*?id:\s*')/);
  for (const block of blocks) {
    if (block.includes(`id: '${id}'`)) {
      const get = (key) => block.match(new RegExp(`${key}:\\s*'([^']+)'`))?.[1] ?? '';
      const getBool = (key) => block.match(new RegExp(`${key}:\\s*(true|false)`))?.[1] === 'true';
      return {
        id,
        name: get('name'),
        category: get('category'),
        version: get('version'),
        license: get('license'),
        upstreamUrl: get('upstreamUrl'),
        kobeOptimised: getBool('kobeOptimised'),
      };
    }
  }
  return null;
}

// ── Ollama blob resolution ────────────────────────────────────────────────────

async function getOllamaModelInfo(modelId) {
  try {
    const { stdout } = await exec(`ollama show --modelfile "${modelId}"`);
    return stdout.trim();
  } catch {
    return null;
  }
}

function getOllamaBlobDir() {
  return join(homedir(), '.ollama', 'blobs');
}

function findBlobsForModel(modelId) {
  // Ollama stores blobs as sha256-<hex> files
  const blobDir = getOllamaBlobDir();
  if (!existsSync(blobDir)) return [];
  return readdirSync(blobDir)
    .filter((f) => f.startsWith('sha256-'))
    .map((f) => join(blobDir, f));
}

// ── Bundle builder ────────────────────────────────────────────────────────────

async function buildBundle(modelId, outputDir, customWeightsPath) {
  const entry = getCatalogueEntry(modelId);
  if (!entry) {
    console.warn(`⚠ Model '${modelId}' not found in catalogue — using minimal metadata`);
  }

  const category = entry?.category ?? 'chat';
  const slug = modelId.replace(/[:/]/g, '-');
  const outPath = join(outputDir, category, `${slug}.kobemodel`);

  mkdirSync(join(outputDir, category), { recursive: true });

  console.log(`\nBundling ${modelId} → ${outPath}`);

  const manifest = {
    id: modelId,
    name: entry?.name ?? modelId,
    version: entry?.version ?? '1.0',
    category,
    license: entry?.license ?? 'unknown',
    upstreamUrl: entry?.upstreamUrl ?? '',
    kobeOptimised: entry?.kobeOptimised ?? false,
    bundledAt: new Date().toISOString(),
    format: 'kobemodel-v1',
  };

  // Get Modelfile from Ollama (for Ollama-based models)
  let modelfile = null;
  if (!customWeightsPath) {
    process.stdout.write('  Fetching Modelfile from Ollama… ');
    modelfile = await getOllamaModelInfo(modelId);
    if (modelfile) {
      console.log('✓');
    } else {
      console.log('✗ (Ollama not running or model not installed)');
    }
  }

  // Create tar.gz bundle
  const tarPack = pack();
  const gzip = createGzip({ level: 6 });
  const output = createWriteStream(outPath);
  const hashStream = createHash('sha256');

  const pipeline = new Promise((resolve, reject) => {
    tarPack.pipe(gzip).pipe(output);
    output.on('finish', resolve);
    output.on('error', reject);
    gzip.on('error', reject);
  });

  // Add manifest.json
  const manifestJson = JSON.stringify(manifest, null, 2);
  tarPack.entry({ name: 'manifest.json' }, manifestJson);

  // Add Modelfile
  if (modelfile) {
    tarPack.entry({ name: 'Modelfile' }, modelfile);
  } else if (customWeightsPath) {
    // For custom models, generate a minimal Modelfile
    const customModelfile = `FROM ./blobs/${basename(customWeightsPath)}\nPARAMETER stop "<|end|>"\n`;
    tarPack.entry({ name: 'Modelfile' }, customModelfile);
  }

  // Add weights
  if (customWeightsPath && existsSync(customWeightsPath)) {
    process.stdout.write(`  Adding weights ${basename(customWeightsPath)}… `);
    const stat = statSync(customWeightsPath);
    const entry = tarPack.entry({ name: `blobs/${basename(customWeightsPath)}`, size: stat.size });
    await new Promise((resolve, reject) => {
      createReadStream(customWeightsPath).pipe(entry);
      entry.on('finish', resolve);
      entry.on('error', reject);
    });
    console.log('✓');
  } else if (!customWeightsPath) {
    // For Ollama models, include a README explaining blobs are fetched at install time
    const readme = [
      `# ${manifest.name}`,
      '',
      'This .kobemodel bundle contains the Modelfile and metadata.',
      'Model weight blobs are fetched from the Ollama registry at install time',
      'unless pre-bundled weights are present in the blobs/ directory.',
      '',
      `Model ID: ${modelId}`,
      `Bundled: ${manifest.bundledAt}`,
    ].join('\n');
    tarPack.entry({ name: 'README.md' }, readme);
  }

  tarPack.finalize();
  await pipeline;

  // Compute SHA-256 of the output bundle
  process.stdout.write('  Computing bundle checksum… ');
  const checksum = await new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(outPath)
      .on('data', (c) => hash.update(c))
      .on('end', () => resolve(hash.digest('hex')))
      .on('error', reject);
  });
  console.log('✓');

  const sizeMb = (statSync(outPath).size / 1e6).toFixed(1);
  console.log(`\n✅ Bundle created: ${outPath} (${sizeMb} MB)`);
  console.log(`   SHA-256: ${checksum}`);
  console.log(`\n   Update kobe-models.catalogue.ts:`);
  console.log(`   checksum: '${checksum}',`);

  return { outPath, checksum };
}

// ── Main ──────────────────────────────────────────────────────────────────────

buildBundle(modelId, outputDir, customWeights).catch((err) => {
  console.error('\n❌ Bundle failed:', err.message);
  process.exit(1);
});
