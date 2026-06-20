import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiService } from '../ai/ai.service';
import { OcrService } from '../ocr/ocr.service';
import { PosProduct } from '../pos/pos.entity';

export interface ParsedItem {
  name: string;
  quantity: number;
  notes?: string;
  matchedProductId?: string | null;
  matchedSku?: string | null;
  matchedName?: string | null;
  matchedPrice?: number | null;
  confidence: number;
}

export interface ParseResult {
  hasAnnotations: boolean;
  items: ParsedItem[];
  rawSummary: string;
  ocrText?: string;
  model?: string;
  source: 'ollama' | 'ocr-fallback' | 'none';
}

/**
 * Parses a customer-annotated catalog photo into a list of items + quantities
 * the seller can review and turn into a real POS order.
 *
 * Pipeline:
 *   1. If a vision-capable LLM is reachable (Ollama with llava/moondream),
 *      ask it to extract `{ items: [{ name, quantity }], hasAnnotations }`.
 *   2. Otherwise fall back to OCR text extraction — picks up handwritten
 *      quantities ("30", "2 pcs") so the seller has something to work
 *      with even without a vision model.
 *   3. Match each extracted item against the owner's POS catalog by
 *      lower-case substring (over the product `name` and `sku`), so the
 *      review UI can show "Adidas cap (red)" → "Adidas SKU JR-001".
 *
 * Returns ParseResult — never throws on AI failure; surfaces a "none"
 * source so the UI can ask the operator to enter the items manually.
 */
@Injectable()
export class OrderFromImageService {
  private readonly logger = new Logger(OrderFromImageService.name);

  constructor(
    private readonly ai: AiService,
    private readonly ocr: OcrService,
    private readonly config: ConfigService,
    @InjectRepository(PosProduct) private readonly products: Repository<PosProduct>,
  ) {}

  /** Best-effort vision parse. Never throws; returns source='none' on
   *  full failure so the operator can fall back to manual entry. */
  async parseImage(ownerId: string, image: Buffer): Promise<ParseResult> {
    if (!image || image.length === 0) {
      throw new BadRequestException('Image is empty');
    }

    // Try vision model first.
    const visionModel = this.config.get<string>('AI_VISION_MODEL') || 'llava:7b';
    let visionResult: { items: ParsedItem[]; rawSummary: string; hasAnnotations: boolean } | null = null;
    try {
      visionResult = await this.runVision(image, visionModel);
    } catch (err) {
      this.logger.warn(`Vision model ${visionModel} failed: ${(err as Error).message}`);
    }

    // OCR fallback / supplement.
    let ocrText = '';
    try {
      const ocrResult = await this.ocr.extract(image);
      ocrText = ocrResult?.text || '';
    } catch (err) {
      this.logger.warn(`OCR failed: ${(err as Error).message}`);
    }

    let items: ParsedItem[];
    let summary = '';
    let source: ParseResult['source'] = 'none';
    let hasAnnotations = false;

    if (visionResult && visionResult.items.length > 0) {
      items = visionResult.items;
      summary = visionResult.rawSummary;
      hasAnnotations = visionResult.hasAnnotations;
      source = 'ollama';
    } else if (ocrText) {
      // Build placeholder items from quantities found in OCR text. The
      // operator will rename / match them in the review UI.
      const quantities = extractQuantities(ocrText);
      items = quantities.map((q) => ({
        name: `(unmatched) qty ${q}`,
        quantity: q,
        confidence: 0.3,
      }));
      summary = `OCR text: ${ocrText.slice(0, 400)}`;
      hasAnnotations = quantities.length > 0;
      source = 'ocr-fallback';
    } else {
      items = [];
      summary = 'No annotations detected and no OCR text available — enter items manually.';
    }

    // Catalog match. Doesn't fail the whole parse if the catalog is empty.
    try {
      const catalog = await this.products.find({ where: { ownerId } });
      items = items.map((it) => matchProduct(it, catalog));
    } catch (err) {
      this.logger.warn(`Catalog match failed: ${(err as Error).message}`);
    }

    return {
      hasAnnotations,
      items,
      rawSummary: summary,
      ocrText: ocrText || undefined,
      model: source === 'ollama' ? visionModel : undefined,
      source,
    };
  }

  private async runVision(
    image: Buffer,
    model: string,
  ): Promise<{ items: ParsedItem[]; rawSummary: string; hasAnnotations: boolean }> {
    const base64 = image.toString('base64');
    const result = await this.ai.chatCompletion({
      model,
      temperature: 0.2,
      maxTokens: 800,
      messages: [
        {
          role: 'system',
          content: ORDER_FROM_IMAGE_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content:
            'A customer has annotated this product photo to indicate what they want. ' +
            'Identify which items they selected and how many of each. ' +
            'Return ONLY valid JSON matching the schema in the system message.',
          images: [base64],
        },
      ],
    });
    return parseModelJson(result.content);
  }
}

const ORDER_FROM_IMAGE_SYSTEM_PROMPT = `
You are a sales assistant looking at product photos that customers have annotated
in WhatsApp. They typically:
  - Circle items they want with a marker
  - Write a number near each item to indicate quantity (e.g. "30", "2 pcs")
  - Sometimes draw an arrow or strike-through to mean "skip this one"

Your job is to identify which items the customer SELECTED and what quantity
they wrote next to each one. Ignore items with no markings — those weren't
ordered.

Return ONLY a JSON object on a single line with this exact schema:
{ "hasAnnotations": boolean, "items": [ { "name": string, "quantity": number, "notes": string } ] }

Rules:
  - If the photo has no marker annotations at all, return { "hasAnnotations": false, "items": [] }.
  - Use the product's most distinguishing feature in "name" (e.g. "Red Adidas cap", "Blue NY cap").
  - "quantity" must be a number ≥ 1. If you can't read it, default to 1.
  - "notes" is a short free-text comment for the operator. Empty string if nothing to add.
  - NEVER wrap the JSON in markdown or prose. NEVER add a code fence. Output one JSON object only.
`.trim();

/** Extract the JSON object from the model output, tolerating code fences
 *  and leading prose. Returns an empty result on failure. */
function parseModelJson(raw: string): { items: ParsedItem[]; rawSummary: string; hasAnnotations: boolean } {
  const empty = { items: [], rawSummary: raw.slice(0, 400), hasAnnotations: false };
  if (!raw) return empty;
  // Strip code fences.
  let body = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  // Pick the first { ... } block.
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return empty;
  body = body.slice(start, end + 1);
  try {
    const parsed = JSON.parse(body) as { hasAnnotations?: boolean; items?: Array<{ name?: string; quantity?: number; notes?: string }> };
    const items: ParsedItem[] = (parsed.items ?? [])
      .filter((it): it is { name: string; quantity?: number; notes?: string } => typeof it?.name === 'string' && !!it.name.trim())
      .map((it) => ({
        name: String(it.name).trim().slice(0, 120),
        quantity: Math.max(1, Math.floor(Number(it.quantity) || 1)),
        notes: it.notes ? String(it.notes).slice(0, 200) : undefined,
        confidence: 0.85,
      }));
    return {
      items,
      rawSummary: raw.slice(0, 400),
      hasAnnotations: Boolean(parsed.hasAnnotations) || items.length > 0,
    };
  } catch {
    return empty;
  }
}

/** Pull plausible quantity numbers out of OCR text. Picks integers
 *  1..9999 written as bare digits or followed by common units. */
function extractQuantities(text: string): number[] {
  const matches = Array.from(text.matchAll(/\b(\d{1,4})\b(?:\s*(?:pcs|pc|x|×|kg|qty|piece|pieces|carton|ctn|box))?/gi));
  const out: number[] = [];
  for (const m of matches) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n >= 1 && n <= 9999) out.push(n);
  }
  return out.slice(0, 20);
}

/** Fuzzy-match a parsed item against the owner's POS catalog. Looks at
 *  product name + SKU; picks the longest substring overlap. */
function matchProduct(item: ParsedItem, catalog: PosProduct[]): ParsedItem {
  if (catalog.length === 0) return item;
  const needle = item.name.toLowerCase();
  let best: { score: number; product: PosProduct } | null = null;
  for (const p of catalog) {
    const name = (p.name || '').toLowerCase();
    const sku  = (p.sku  || '').toLowerCase();
    let score = 0;
    // Direct SKU match wins outright.
    if (sku && (needle === sku || needle.includes(sku))) score = 100;
    else {
      // Token overlap score.
      const needleTokens = needle.split(/[^a-z0-9]+/).filter((t) => t.length > 2);
      const hayTokens    = (name + ' ' + sku).split(/[^a-z0-9]+/).filter((t) => t.length > 2);
      for (const t of needleTokens) {
        if (hayTokens.includes(t)) score += 10;
        else if (hayTokens.some((h) => h.includes(t) || t.includes(h))) score += 4;
      }
    }
    if (!best || score > best.score) best = { score, product: p };
  }
  if (!best || best.score < 4) return item;
  return {
    ...item,
    matchedProductId: best.product.id,
    matchedSku: best.product.sku,
    matchedName: best.product.name,
    matchedPrice: Number(best.product.price),
    confidence: Math.min(1, Math.max(item.confidence, best.score / 100)),
  };
}
