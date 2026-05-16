#!/usr/bin/env node
/**
 * fetch-model-checksums.js
 *
 * Queries the Ollama registry manifest API for each model in the catalogue
 * and writes the real SHA-256 digest of the model layer back into
 * kobe-models.catalogue.ts.
 *
 * Run this once when you are ready to publish .kobemodel bundles:
 *
 *   node scripts/fetch-model-checksums.js
 *
 * The script updates the catalogue file in-place. Commit the result.
 *
 * How it works:
 *   1. For each model with a placeholder checksum, fetch:
 *      GET https://registry.ollama.ai/v2/library/<name>/manifests/<tag>
 *   2. Parse the OCI manifest — the model weights are in the layer with
 *      mediaType "application/vnd.ollama.image.model".
 *   3. Extract the digest (sha256:...) and write it to the catalogue.
 *
 * Note: the digest here is the SHA-256 of the compressed layer blob as
 * stored in the Ollama registry. When you repackage models as .kobemodel
 * bundles you should re-hash the final bundle file and update accordingly.
 * This script gives you the upstream digest as a starting point.
 */

import { readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import https from 'https';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOGUE_PATH = join(__dirname, '../server/src/kobe-models/kobe-models.catalogue.ts');

// Models that have an ollamaFallback and can be looked up in the Ollama registry
const OLLAMA_REGISTRY = 'registry.ollama.ai';

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'Accept': 'application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.manifest.v1+json',
        'User-Agent': 'kobe-studio/1.0',
      }
    }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(httpsGet(res.headers.location));
      }
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}: ${data.slice(0, 200)}`));
        } else {
          try { resolve(JSON.parse(data)); }
          catch { resolve(data); }
        }
      });
    }).on('error', reject);
  });
}

/**
 * Fetch the SHA-256 digest of the model weights layer from the Ollama registry.
 * Returns the digest string (e.g. "sha256:abc123...") or null on failure.
 */
async function fetchOllamaDigest(modelId) {
  // modelId format: "name:tag" or "namespace/name:tag"
  const [namepart, tag = 'latest'] = modelId.split(':');
  const name = namepart.includes('/') ? namepart : `library/${namepart}`;
  const url = `https://${OLLAMA_REGISTRY}/v2/${name}/manifests/${tag}`;

  try {
    const manifest = await httpsGet(url);
    if (!manifest.layers && !manifest.manifests) {
      console.warn(`  ⚠ Unexpected manifest format for ${modelId}`);
      return null;
    }

    // OCI image index — pick the first platform manifest
    if (manifest.manifests) {
      const first = manifest.manifests[0];
      if (first?.digest) {
        // Fetch the actual image manifest
        const imageManifest = await httpsGet(
          `https://${OLLAMA_REGISTRY}/v2/${name}/manifests/${first.digest}`
        );
        return extractModelDigest(imageManifest, modelId);
      }
    }

    return extractModelDigest(manifest, modelId);
  } catch (err) {
    console.warn(`  ⚠ Could not fetch manifest for ${modelId}: ${err.message}`);
    return null;
  }
}

function extractModelDigest(manifest, modelId) {
  const layers = manifest.layers ?? [];
  // Prefer the model weights layer
  const modelLayer = layers.find(
    (l) => l.mediaType === 'application/vnd.ollama.image.model'
  ) ?? layers[0];

  if (!modelLayer?.digest) {
    console.warn(`  ⚠ No model layer found in manifest for ${modelId}`);
    return null;
  }

  // Strip "sha256:" prefix — we store just the hex digest
  return modelLayer.digest.replace(/^sha256:/, '');
}

async function main() {
  console.log('Fetching model checksums from Ollama registry…\n');

  let source = readFileSync(CATALOGUE_PATH, 'utf8');
  let updated = 0;
  let failed = 0;

  // Extract all model entries from the catalogue source
  // Match: id: 'name:tag', ... checksum: 'placeholder-...'
  const modelIdRegex = /id:\s*'([^']+)'/g;
  const checksumRegex = /checksum:\s*'(placeholder-[^']+)'/g;
  const ollamaFallbackRegex = /ollamaFallback:\s*'([^']+)'/g;

  // Build a map of modelId -> ollamaFallback by parsing the catalogue
  // We do a simple block-by-block parse
  const blocks = source.split(/(?=\s*\{[\s\S]*?id:\s*')/);
  const modelMap = new Map();

  for (const block of blocks) {
    const idMatch = block.match(/id:\s*'([^']+)'/);
    const checksumMatch = block.match(/checksum:\s*'([^']+)'/);
    const fallbackMatch = block.match(/ollamaFallback:\s*'([^']+)'/);
    if (idMatch && checksumMatch) {
      modelMap.set(idMatch[1], {
        checksum: checksumMatch[1],
        ollamaFallback: fallbackMatch?.[1] ?? idMatch[1],
      });
    }
  }

  for (const [modelId, { checksum, ollamaFallback }] of modelMap) {
    if (!checksum.startsWith('placeholder-')) {
      console.log(`  ✓ ${modelId} — already has checksum`);
      continue;
    }

    // Sports/custom models don't have an Ollama registry entry
    if (modelId.startsWith('kobe-')) {
      console.log(`  ⏭ ${modelId} — custom model, skipping (set checksum manually after bundling)`);
      continue;
    }

    process.stdout.write(`  Fetching ${ollamaFallback}… `);
    const digest = await fetchOllamaDigest(ollamaFallback);

    if (digest) {
      // Replace the placeholder in the source
      source = source.replace(
        `checksum: '${checksum}'`,
        `checksum: '${digest}'`
      );
      console.log(`✓ ${digest.slice(0, 16)}…`);
      updated++;
    } else {
      console.log('✗ failed');
      failed++;
    }

    // Be polite to the registry
    await new Promise((r) => setTimeout(r, 300));
  }

  writeFileSync(CATALOGUE_PATH, source, 'utf8');

  console.log(`\nDone. Updated: ${updated}, Failed/skipped: ${failed}`);
  if (failed > 0) {
    console.log('Re-run after fixing network issues, or set checksums manually.');
  }
  console.log('\nIMPORTANT: These are upstream Ollama registry digests.');
  console.log('When you repackage models as .kobemodel bundles, re-hash the');
  console.log('final bundle and update the checksums again before publishing.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
