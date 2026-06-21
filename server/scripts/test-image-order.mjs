#!/usr/bin/env node
// Smoke-test the Order-from-image vision pipeline against real images.
//
// Runs the EXACT prompt + Ollama chat API call that the production
// OrderFromImageService uses, against any image paths you pass on the
// command line. Reports the parsed item list and quantity for each.
//
// Why this lives in scripts/: dev container Xeon CPUs sometimes have
// broken Intel AMX flags that crash llama.cpp during model warmup, so
// we can't test the vision step from this repo's CI. Running this on
// the actual server (or any machine with a working Ollama) gives a
// real before/after comparison when swapping vision models.
//
// Prerequisites:
//   - Ollama running with the model already pulled
//     (`ollama pull qwen2.5vl:7b`)
//   - Test images on disk
//
// Usage:
//   node scripts/test-image-order.mjs path/to/photo1.jpg path/to/photo2.jpg
//
// Env:
//   OLLAMA_URL          default: http://localhost:11434
//   AI_VISION_MODEL     default: qwen2.5vl:7b
//   EXPECTED_QTYS       optional comma-separated list of expected quantities
//                       per image (e.g. "30,30,60,30:60,100,30"). Per-image
//                       expectations separated by ":", per-item by ",".

import fs from 'node:fs';

const OLLAMA = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL  = process.env.AI_VISION_MODEL || 'qwen2.5vl:7b';

const images = process.argv.slice(2);
if (images.length === 0) {
  console.error('Usage: node scripts/test-image-order.mjs <image-path> [<image-path>...]');
  process.exit(1);
}
const expectedAll = (process.env.EXPECTED_QTYS || '').split(':').map((s) => s.split(',').filter(Boolean));

// EXACT prompt from server/src/order-from-image/order-from-image.service.ts.
// Keep these two in sync — diverging silently would make this script lie.
const SYSTEM_PROMPT = `
You are a sales assistant looking at product photos that customers have annotated
in WhatsApp. They typically:
  - Circle items they want with a marker
  - Write a number near each item to indicate quantity (e.g. "30", "2 pcs")
  - Sometimes draw an arrow or strike-through to mean "skip this one"

Your job is to identify which items the customer SELECTED and what quantity
they wrote next to each one. Ignore items with no markings — those weren't
ordered.

Pay particular attention to handwritten digits — customers often write
"30" or "60" (two digits) rather than "3" or "6". When in doubt between
a single digit and a two-digit number ending in zero, prefer the two-digit
reading.

Return ONLY a JSON object on a single line with this exact schema:
{ "hasAnnotations": boolean, "items": [ { "name": string, "quantity": number, "matchedSku": string | null, "notes": string } ] }

Rules:
  - If the photo has no marker annotations at all, return { "hasAnnotations": false, "items": [] }.
  - Use the product's most distinguishing feature in "name" (e.g. "Red Adidas cap", "Blue NY cap").
  - "quantity" must be a number ≥ 1. If you can't read it, default to 1.
  - "matchedSku" must be a SKU from the CATALOG list in the user message when you can confidently match the detected item to a catalog row by colour / brand / style. Otherwise null. Never invent a SKU that isn't in the list.
  - "notes" is a short free-text comment for the operator. Empty string if nothing to add.
  - NEVER wrap the JSON in markdown or prose. NEVER add a code fence. Output one JSON object only.
`.trim();

async function callVision(imagePath) {
  const buf = fs.readFileSync(imagePath);
  const res = await fetch(`${OLLAMA}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      options: { temperature: 0.2, num_predict: 1000 },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: 'A customer has annotated this product photo to indicate what they want. Identify which items they selected and how many of each. Return ONLY the JSON in the schema.',
          images: [buf.toString('base64')],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.message?.content || '';
}

function parseJson(raw) {
  if (!raw) return null;
  let body = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try { return JSON.parse(body.slice(start, end + 1)); } catch { return null; }
}

console.log(`Vision model: ${MODEL}`);
console.log(`Ollama:       ${OLLAMA}\n`);

let totalCorrect = 0;
let totalExpected = 0;

for (let idx = 0; idx < images.length; idx++) {
  const img = images[idx];
  const expected = expectedAll[idx] || [];
  console.log('━'.repeat(80));
  console.log(`${img}`);
  if (expected.length) console.log(`expected: ${expected.join(', ')}`);
  const t0 = Date.now();
  let raw;
  try {
    raw = await callVision(img);
  } catch (e) {
    console.log(`  ✗ ${e.message}\n`);
    continue;
  }
  const ms = Date.now() - t0;
  console.log(`  inference: ${(ms / 1000).toFixed(1)}s`);
  const parsed = parseJson(raw);
  if (!parsed) {
    console.log(`  ✗ JSON parse failed. Raw:\n    ${raw.slice(0, 400).replace(/\n/g, '\n    ')}\n`);
    continue;
  }
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  console.log(`  hasAnnotations: ${parsed.hasAnnotations}  detected ${items.length} item${items.length === 1 ? '' : 's'}:`);
  let correct = 0;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const q = String(it.quantity ?? '?');
    const want = expected[i];
    const mark = want ? (q === want ? '✓' : '✗') : ' ';
    console.log(`    ${String(i + 1).padStart(2)}. qty=${q.padEnd(4)} ${mark}${want ? ` (expected ${want})` : ''}  "${(it.name || '').slice(0, 60)}"`);
    if (want && q === want) correct++;
  }
  if (expected.length) {
    totalCorrect += correct;
    totalExpected += expected.length;
    console.log(`  score: ${correct}/${Math.min(items.length, expected.length)} of ${expected.length} expected\n`);
  } else {
    console.log('');
  }
}

if (totalExpected > 0) {
  console.log('━'.repeat(80));
  console.log(`OVERALL: ${totalCorrect}/${totalExpected} (${Math.round(100 * totalCorrect / totalExpected)}%) digit accuracy with ${MODEL}`);
}
