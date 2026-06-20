import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import sharp from 'sharp';

/**
 * Dedicated handwritten-digit OCR via Microsoft TrOCR
 * (Xenova/trocr-base-handwritten, MIT licensed, ~1.3 GB ONNX, runs fully
 *  offline once downloaded). Wraps @huggingface/transformers so the rest
 * of the codebase stays free of model-loading details.
 *
 * Used by OrderFromImageService as a second-opinion pass: the vision
 * model (llava) is good at recognising which product was circled but
 * notoriously weak on loopy digits like "30" vs "3". For each item
 * where the vision model returned a bounding box around the handwritten
 * quantity, we crop that region with sharp and re-read the digit with
 * TrOCR — the small dedicated model on a tight crop beats the
 * generalist VLM on the full frame.
 *
 * Degrades gracefully: if the package isn't installed, the model fails
 * to download, or the box is missing, the service returns null and the
 * caller keeps the vision model's original quantity.
 */
type Pipeline = (input: unknown) => Promise<Array<{ generated_text?: string }>>;

@Injectable()
export class HandwritingOcrService implements OnModuleInit {
  private readonly logger = new Logger(HandwritingOcrService.name);
  private pipelineLoad: Promise<Pipeline | null> | null = null;

  /** Background-prefetch the model on server boot so the first customer
   *  request doesn't pay the 334 MB download cost. Non-blocking — startup
   *  continues immediately; the download warms the on-disk cache in the
   *  background. Set HANDWRITING_OCR_PREFETCH=false to skip (e.g. local
   *  dev where you don't want the network hit on every nest start). */
  onModuleInit() {
    const enabled = (process.env.HANDWRITING_OCR_ENABLED ?? 'true').toLowerCase() !== 'false';
    const prefetch = (process.env.HANDWRITING_OCR_PREFETCH ?? 'true').toLowerCase() !== 'false';
    if (!enabled || !prefetch) return;
    // Fire and forget. Errors are swallowed inside getPipeline().
    void this.getPipeline();
  }

  /** Lazy-load TrOCR. The model is ~1.3 GB and is cached after first
   *  download, so subsequent boots reuse the local copy.
   *
   *  Sources, in order of independence from third parties:
   *    HANDWRITING_OCR_HOST   custom CDN — point at your own S3 / R2 /
   *                           MinIO bucket and KobeOS pulls the model
   *                           files from there. Zero HuggingFace
   *                           dependency. (Bucket must mirror the HF
   *                           directory layout under {model}/resolve/main/.)
   *    HANDWRITING_OCR_MODEL  HF repo id — defaults to the public Xenova
   *                           mirror; switch to your-username/...
   *                           after running scripts/mirror-handwriting-ocr.sh
   *                           so the source can only be changed by you. */
  private getPipeline(): Promise<Pipeline | null> {
    if (this.pipelineLoad) return this.pipelineLoad;
    const modelId = process.env.HANDWRITING_OCR_MODEL || 'Xenova/trocr-base-handwritten';
    const customHost = process.env.HANDWRITING_OCR_HOST?.trim();
    this.pipelineLoad = (async () => {
      try {
        const pkg = '@huggingface/transformers';
        const mod = (await import(pkg)) as unknown as {
          pipeline: (task: string, model: string) => Promise<Pipeline>;
          env: { remoteHost?: string; remotePathTemplate?: string; allowRemoteModels?: boolean };
        };
        if (!mod?.pipeline) throw new Error('@huggingface/transformers is not installed');
        if (customHost) {
          // Point transformers.js at your own bucket / mirror. The path
          // template is the standard HF layout so existing model dirs
          // copied verbatim into the bucket "just work".
          mod.env.remoteHost = customHost.endsWith('/') ? customHost : customHost + '/';
          mod.env.remotePathTemplate = '{model}/resolve/{revision}/';
          this.logger.log(`Handwriting OCR remote host overridden to ${mod.env.remoteHost}`);
        }
        this.logger.log(`Loading ${modelId} — first run downloads ~1.3 GB and may take several minutes`);
        const p = await mod.pipeline('image-to-text', modelId);
        this.logger.log('TrOCR ready');
        return p;
      } catch (err) {
        this.logger.warn(`TrOCR failed to load: ${(err as Error).message}`);
        this.pipelineLoad = null;
        return null;
      }
    })();
    return this.pipelineLoad;
  }

  /** Crop the source image to a normalized bounding box (0..1) and ask
   *  TrOCR to read it. Returns the raw recognised text plus a parsed
   *  integer when the output looks like a plausible quantity (1..9999),
   *  or null when the model is unavailable / inference fails. */
  async readNumber(
    image: Buffer,
    box?: { x: number; y: number; w: number; h: number },
  ): Promise<{ text: string; integer: number | null } | null> {
    const pipeline = await this.getPipeline();
    if (!pipeline) return null;

    let crop: Buffer;
    try {
      if (box && box.w > 0 && box.h > 0) {
        const meta = await sharp(image).metadata();
        if (!meta.width || !meta.height) return null;
        // A small padding around the bounding box gives TrOCR more context
        // for the loops of digits like "8", "0", "6".
        const pad = 0.02;
        const x = Math.max(0, Math.min(1, box.x - pad));
        const y = Math.max(0, Math.min(1, box.y - pad));
        const w = Math.max(0, Math.min(1 - x, box.w + pad * 2));
        const h = Math.max(0, Math.min(1 - y, box.h + pad * 2));
        const left   = Math.max(0, Math.min(meta.width  - 2, Math.round(x * meta.width)));
        const top    = Math.max(0, Math.min(meta.height - 2, Math.round(y * meta.height)));
        const width  = Math.max(2, Math.min(meta.width  - left, Math.round(w * meta.width)));
        const height = Math.max(2, Math.min(meta.height - top,  Math.round(h * meta.height)));
        crop = await sharp(image).extract({ left, top, width, height }).png().toBuffer();
      } else {
        crop = await sharp(image).png().toBuffer();
      }
    } catch (err) {
      this.logger.warn(`Crop failed: ${(err as Error).message}`);
      return null;
    }

    try {
      const dataUrl = `data:image/png;base64,${crop.toString('base64')}`;
      const out = await pipeline(dataUrl);
      const text = Array.isArray(out) && out[0]?.generated_text
        ? String(out[0].generated_text).trim()
        : '';
      const digits = text.replace(/[^0-9]/g, '');
      const n = digits ? Number(digits) : NaN;
      const integer = Number.isFinite(n) && n >= 1 && n <= 9999 ? n : null;
      return { text, integer };
    } catch (err) {
      this.logger.warn(`TrOCR inference failed: ${(err as Error).message}`);
      return null;
    }
  }
}
