#!/usr/bin/env node
/**
 * Pre-warm the TrOCR handwriting model used by OrderFromImageService.
 *
 * Why: the model is ~1.3 GB. By default it's downloaded lazily on the
 * first image parse — that means the very first customer waiting at the
 * till bears the cost. Running this script during your Docker build or
 * cold deploy bakes the model into the on-disk cache so the first
 * inference is immediate.
 *
 * Usage:
 *   node scripts/prefetch-handwriting-ocr.mjs
 *   # or
 *   npm run prefetch:handwriting-ocr     (from server/)
 *
 * Env:
 *   HANDWRITING_OCR_MODEL   override model id (default: Xenova/trocr-base-handwritten)
 *
 * Cache location:
 *   server/node_modules/@huggingface/transformers/.cache/<model-id>/
 *   so a Docker build that runs `npm ci && npm run prefetch:handwriting-ocr`
 *   bakes the model into the resulting image layer.
 */
const modelId = process.env.HANDWRITING_OCR_MODEL || 'Xenova/trocr-base-handwritten';

console.log(`[prefetch] Loading ${modelId} — this may download ~1.3 GB on first run`);
const t0 = Date.now();

const { pipeline } = await import('@huggingface/transformers');
const pipe = await pipeline('image-to-text', modelId);

// Run one tiny inference so weights are not just downloaded but fully
// initialized — catches problems like missing config / mismatched ONNX
// runtime versions at build time instead of at request time.
try {
  const { RawImage } = await import('@huggingface/transformers');
  // 8x8 grey image. RawImage takes Uint8Array, width, height, channels.
  const blank = new RawImage(new Uint8Array(8 * 8 * 3).fill(128), 8, 8, 3);
  await pipe(blank);
} catch (err) {
  console.warn(`[prefetch] Warmup inference failed (cache may still be valid): ${err.message}`);
}

const seconds = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`[prefetch] ${modelId} ready in ${seconds}s`);
console.log('[prefetch] On the live server, OrderFromImageService will use the cached copy with no further downloads.');
