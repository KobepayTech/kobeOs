import { Injectable, Logger } from '@nestjs/common';

/**
 * Offline OCR via tesseract.js (https://github.com/naptha/tesseract.js, Apache-2.0).
 *
 * Pure WASM, no native binary needed. Used by:
 *   • KobeHotel — guest ID scan during check-in
 *   • KobePay   — paper-receipt extraction for expense logging
 *   • Kobe Studio — caption text from images
 *
 * The worker is created lazily and reused — tesseract.js loads ~10 MB
 * of language data per language, so we keep one worker per language
 * around for the life of the process.
 */

type TesseractWorker = {
  recognize: (image: Buffer | string) => Promise<{ data: { text: string; confidence: number; lines?: Array<{ text: string; confidence: number }> } }>;
  terminate: () => Promise<void>;
};

export interface OcrResult {
  text: string;
  confidence: number;
  language: string;
  lines: Array<{ text: string; confidence: number }>;
}

export interface OcrReceiptResult extends OcrResult {
  parsed: { total: number | null; currency: string | null; date: string | null; merchant: string | null };
}

@Injectable()
export class OcrService {
  private readonly logger = new Logger('OcrService');
  private readonly workers = new Map<string, Promise<TesseractWorker>>();

  /** Languages supported out of the box. Add more by passing an arbitrary
   *  Tesseract lang code; tesseract.js will auto-download the traineddata
   *  on first use. */
  static readonly SUPPORTED = ['eng', 'swa', 'fra', 'spa', 'ara'];

  /**
   * Extract text from an image buffer (PNG / JPEG / WebP / GIF / BMP).
   * @param buffer  raw image bytes
   * @param lang    Tesseract language code (default 'eng+swa' — handles
   *                bilingual East African receipts in one pass)
   */
  async extract(buffer: Buffer, lang = 'eng+swa'): Promise<OcrResult> {
    const worker = await this._getWorker(lang);
    const { data } = await worker.recognize(buffer);
    return {
      text: data.text.trim(),
      confidence: Number((data.confidence ?? 0).toFixed(2)),
      language: lang,
      lines: (data.lines ?? []).map((l) => ({
        text: l.text.trim(),
        confidence: Number((l.confidence ?? 0).toFixed(2)),
      })),
    };
  }

  /**
   * Receipt-shaped helper: extract text, then try to pull out a total,
   * a date, and a merchant line by simple regex. Best-effort — the raw
   * text is always returned so the caller can fall back.
   */
  async extractReceipt(buffer: Buffer, lang = 'eng+swa'): Promise<OcrReceiptResult> {
    const base = await this.extract(buffer, lang);
    const lines = base.text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    let total: number | null = null;
    let currency: string | null = null;
    const totalLine = lines.reverse().find((l) => /total|jumla|amount/i.test(l));
    if (totalLine) {
      const m = totalLine.match(/(tzs|ksh|ush|usd|eur|gbp|kes|rwf|\$|€|£)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);
      if (m) {
        currency = (m[1] ?? '').toUpperCase().replace('$', 'USD').replace('€', 'EUR').replace('£', 'GBP') || null;
        total = Number(m[2].replace(/,/g, ''));
        if (!Number.isFinite(total)) total = null;
      }
    }

    let date: string | null = null;
    for (const l of lines) {
      const m = l.match(/\b(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b/);
      if (m) { date = m[1]; break; }
    }

    const merchant = lines.find((l) => l.length >= 3 && l.length <= 40 && /^[A-Za-z0-9 .,&'-]+$/.test(l)) ?? null;

    return { ...base, parsed: { total, currency, date, merchant } };
  }

  async terminate() {
    for (const p of this.workers.values()) {
      try { (await p).terminate(); } catch { /* ignore */ }
    }
    this.workers.clear();
  }

  private _getWorker(lang: string): Promise<TesseractWorker> {
    const existing = this.workers.get(lang);
    if (existing) return existing;
    const promise = this._createWorker(lang).catch((err) => {
      this.workers.delete(lang);
      throw err;
    });
    this.workers.set(lang, promise);
    return promise;
  }

  private async _createWorker(lang: string): Promise<TesseractWorker> {
    // Dynamic import (constructed string keeps tesseract.js optional — the
    // server still boots even when the package hasn't been npm-installed
    // yet). Returns a typed handle once the worker is ready.
    const pkg = 'tesseract.js';
    const mod = (await import(pkg)) as unknown as {
      createWorker: (lang: string) => Promise<TesseractWorker>;
    };
    if (!mod?.createWorker) throw new Error('tesseract.js is not installed. Run `npm install tesseract.js` in server/.');
    this.logger.log(`Loading Tesseract worker for "${lang}" — first use downloads traineddata`);
    return mod.createWorker(lang);
  }
}
