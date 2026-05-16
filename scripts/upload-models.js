#!/usr/bin/env node
/**
 * upload-models.js
 *
 * Uploads .kobemodel bundles to your object storage (Cloudflare R2 or MinIO)
 * and regenerates catalogue.json on the CDN.
 *
 * Usage:
 *   node scripts/upload-models.js --dir ./dist/models [--dry-run]
 *
 * Required env vars (set in .env or shell):
 *   KOBE_CDN_ENDPOINT   — S3-compatible endpoint
 *                         R2:    https://<account-id>.r2.cloudflarestorage.com
 *                         MinIO: http://localhost:9000
 *   KOBE_CDN_BUCKET     — bucket name, e.g. "kobe-models"
 *   KOBE_CDN_ACCESS_KEY — access key ID
 *   KOBE_CDN_SECRET_KEY — secret access key
 *   KOBE_CDN_REGION     — region (R2: "auto", MinIO: "us-east-1")
 *   KOBE_CDN_PUBLIC_URL — public base URL served to clients
 *                         e.g. https://models.kobe  or  https://pub-xxx.r2.dev
 *
 * What it does:
 *   1. Scans --dir for *.kobemodel files
 *   2. Uploads each to <bucket>/<category>/<filename>
 *   3. Reads kobe-models.catalogue.ts, updates downloadUrl for each model
 *   4. Uploads catalogue.json to <bucket>/catalogue.json
 *   5. Prints a summary of uploaded files and public URLs
 */

import { createReadStream, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';
import { createHmac } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────────────────

// Load .env manually (avoid requiring dotenv as a dep in scripts)
try {
  const envPath = join(__dirname, '../server/.env');
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const [key, ...rest] = line.split('=');
    if (key && rest.length && !process.env[key.trim()]) {
      process.env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
    }
  }
} catch { /* no .env — rely on shell env */ }

const ENDPOINT = process.env.KOBE_CDN_ENDPOINT;
const BUCKET   = process.env.KOBE_CDN_BUCKET ?? 'kobe-models';
const ACCESS    = process.env.KOBE_CDN_ACCESS_KEY;
const SECRET    = process.env.KOBE_CDN_SECRET_KEY;
const REGION    = process.env.KOBE_CDN_REGION ?? 'auto';
const PUBLIC_URL = process.env.KOBE_CDN_PUBLIC_URL;

const args = process.argv.slice(2);
const getArg = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
const DRY_RUN = args.includes('--dry-run');
const MODELS_DIR = getArg('--dir') ?? join(__dirname, '../dist/models');

if (!ENDPOINT || !ACCESS || !SECRET) {
  console.error([
    '❌ Missing required environment variables.',
    '',
    'Set these before running:',
    '  KOBE_CDN_ENDPOINT   — S3-compatible endpoint URL',
    '  KOBE_CDN_ACCESS_KEY — access key ID',
    '  KOBE_CDN_SECRET_KEY — secret access key',
    '  KOBE_CDN_PUBLIC_URL — public base URL for download links',
    '',
    'For Cloudflare R2:',
    '  KOBE_CDN_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com',
    '  KOBE_CDN_REGION=auto',
    '',
    'For MinIO:',
    '  KOBE_CDN_ENDPOINT=http://localhost:9000',
    '  KOBE_CDN_REGION=us-east-1',
  ].join('\n'));
  process.exit(1);
}

// ── AWS Signature V4 (minimal, for S3-compatible PUT) ─────────────────────────

function hmac(key, data, encoding) {
  return createHmac('sha256', key).update(data).digest(encoding ?? 'buffer');
}

function getSigningKey(secret, date, region, service) {
  const kDate    = hmac(`AWS4${secret}`, date);
  const kRegion  = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

function signRequest({ method, path, host, region, accessKey, secretKey, contentType, bodyHash, date }) {
  const datetime = date.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z').slice(0, 15) + 'Z';
  const dateShort = datetime.slice(0, 8);

  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${bodyHash}\nx-amz-date:${datetime}\n`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [method, path, '', canonicalHeaders, signedHeaders, bodyHash].join('\n');

  const credentialScope = `${dateShort}/${region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', datetime, credentialScope,
    createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');

  const signingKey = getSigningKey(secretKey, dateShort, region, 's3');
  const signature = hmac(signingKey, stringToSign, 'hex');

  return {
    Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    'x-amz-date': datetime,
    'x-amz-content-sha256': bodyHash,
  };
}

// ── Upload ────────────────────────────────────────────────────────────────────

async function uploadFile(localPath, s3Key, contentType = 'application/octet-stream') {
  const url = new URL(`${ENDPOINT}/${BUCKET}/${s3Key}`);
  const fileBuffer = readFileSync(localPath);
  const bodyHash = createHash('sha256').update(fileBuffer).digest('hex');
  const date = new Date().toISOString();

  const authHeaders = signRequest({
    method: 'PUT',
    path: `/${BUCKET}/${s3Key}`,
    host: url.host,
    region: REGION,
    accessKey: ACCESS,
    secretKey: SECRET,
    contentType,
    bodyHash,
    date,
  });

  const sizeMb = (fileBuffer.length / 1e6).toFixed(1);
  process.stdout.write(`  Uploading ${basename(localPath)} (${sizeMb} MB)… `);

  if (DRY_RUN) {
    console.log('[dry-run]');
    return `${PUBLIC_URL}/${s3Key}`;
  }

  await new Promise((resolve, reject) => {
    const protocol = url.protocol === 'https:' ? https : http;
    const req = protocol.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: `/${BUCKET}/${s3Key}`,
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length,
        ...authHeaders,
      },
    }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        if (res.statusCode >= 400) reject(new Error(`Upload failed ${res.statusCode}: ${body.slice(0, 200)}`));
        else resolve();
      });
    });
    req.on('error', reject);
    req.write(fileBuffer);
    req.end();
  });

  console.log('✓');
  return `${PUBLIC_URL}/${s3Key}`;
}

// ── Catalogue generation ──────────────────────────────────────────────────────

function buildCatalogueJson(uploadedUrls) {
  // Read the TypeScript catalogue and extract model entries
  const src = readFileSync(
    join(__dirname, '../server/src/kobe-models/kobe-models.catalogue.ts'), 'utf8'
  );

  const blocks = src.split(/(?=\s*\{[\s\S]*?id:\s*')/);
  const models = [];

  for (const block of blocks) {
    const get = (key) => block.match(new RegExp(`${key}:\\s*'([^']+)'`))?.[1];
    const getNum = (key) => {
      const m = block.match(new RegExp(`${key}:\\s*([\\d_]+)`));
      return m ? parseInt(m[1].replace(/_/g, ''), 10) : 0;
    };
    const getBool = (key) => block.match(new RegExp(`${key}:\\s*(true|false)`))?.[1] === 'true';
    const getArr = (key) => {
      const m = block.match(new RegExp(`${key}:\\s*\\[([^\\]]+)\\]`));
      return m ? m[1].split(',').map((s) => s.trim().replace(/'/g, '')) : [];
    };

    const id = get('id');
    if (!id) continue;

    const model = {
      id,
      name: get('name'),
      description: get('description') ?? '',
      category: get('category'),
      sizeBytes: getNum('sizeBytes'),
      sizeLabel: get('sizeLabel'),
      minVramGb: getNum('minVramGb'),
      kobeOptimised: getBool('kobeOptimised'),
      downloadUrl: uploadedUrls[id] ?? get('downloadUrl'),
      checksum: get('checksum'),
      ollamaFallback: get('ollamaFallback'),
      license: get('license'),
      upstreamUrl: get('upstreamUrl'),
      version: get('version'),
      recommended: getBool('recommended'),
      tags: getArr('tags'),
    };

    // Remove undefined fields
    Object.keys(model).forEach((k) => model[k] === undefined && delete model[k]);
    models.push(model);
  }

  return {
    version: '1.0.0',
    updatedAt: new Date().toISOString().slice(0, 10),
    models,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nKobe Model Upload${DRY_RUN ? ' [DRY RUN]' : ''}`);
  console.log(`Endpoint: ${ENDPOINT}`);
  console.log(`Bucket:   ${BUCKET}`);
  console.log(`Public:   ${PUBLIC_URL ?? '(not set)'}\n`);

  // Scan for .kobemodel files
  let bundles = [];
  try {
    const categories = readdirSync(MODELS_DIR);
    for (const cat of categories) {
      const catDir = join(MODELS_DIR, cat);
      if (!statSync(catDir).isDirectory()) continue;
      for (const file of readdirSync(catDir)) {
        if (file.endsWith('.kobemodel')) {
          bundles.push({ localPath: join(catDir, file), s3Key: `${cat}/${file}`, category: cat });
        }
      }
    }
  } catch {
    console.error(`❌ Models directory not found: ${MODELS_DIR}`);
    console.error('Run `npm run models:bundle` first to create .kobemodel bundles.');
    process.exit(1);
  }

  if (bundles.length === 0) {
    console.log('No .kobemodel files found. Run `npm run models:bundle` first.');
    process.exit(0);
  }

  console.log(`Found ${bundles.length} bundle(s) to upload:\n`);

  const uploadedUrls = {};

  for (const { localPath, s3Key } of bundles) {
    try {
      const publicUrl = await uploadFile(localPath, s3Key);
      // Map slug back to model id
      const slug = basename(localPath, '.kobemodel');
      // slug format: name-tag → name:tag
      const modelId = slug.replace(/-([^-]+)$/, ':$1');
      uploadedUrls[modelId] = publicUrl;
    } catch (err) {
      console.error(`  ✗ Failed: ${err.message}`);
    }
  }

  // Build and upload catalogue.json
  console.log('\nGenerating catalogue.json…');
  const catalogue = buildCatalogueJson(uploadedUrls);
  const catalogueJson = JSON.stringify(catalogue, null, 2);
  const tmpCatalogue = join(__dirname, '../dist/catalogue.json');
  writeFileSync(tmpCatalogue, catalogueJson);

  await uploadFile(tmpCatalogue, 'catalogue.json', 'application/json');

  console.log('\n✅ Upload complete.');
  console.log(`\nSet in server/.env:`);
  console.log(`  KOBE_MODELS_CDN_URL=${PUBLIC_URL}`);
  console.log('\nClients will fetch: GET ${KOBE_MODELS_CDN_URL}/catalogue.json');
}

main().catch((err) => {
  console.error('\n❌ Upload failed:', err.message);
  process.exit(1);
});
