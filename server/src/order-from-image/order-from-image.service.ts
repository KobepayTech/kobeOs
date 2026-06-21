import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiService } from '../ai/ai.service';
import { OcrService } from '../ocr/ocr.service';
import { PosProduct } from '../pos/pos.entity';

export interface VisionModelStatus {
  model: string;
  installed: boolean;
  pulling: boolean;
  ollamaRunning: boolean;
}

export interface ParsedItem {
  name: string;
  quantity: number;
  notes?: string;
  matchedProductId?: string | null;
  matchedSku?: string | null;
  matchedName?: string | null;
  matchedPrice?: number | null;
  /** Catalog product photo URL — surfaced in the review UI so the
   *  operator can visually confirm the AI / fuzzy match. */
  matchedImageUrl?: string | null;
  confidence: number;
}

export interface ParseResult {
  hasAnnotations: boolean;
  items: ParsedItem[];
  rawSummary: string;
  ocrText?: string;
  model?: string;
  source: 'ollama' | 'ocr-fallback' | 'none';
  /** How much of the catalog has product images bound — drives the
   *  "add inventory photos for better matching" hint in the UI. */
  catalogStats?: { total: number; withImage: number };
}

/**
 * Parses a customer-annotated catalog photo into a list of items + quantities
 * the seller can review and turn into a real POS order.
 *
 * Pipeline:
 *   1. If a vision-capable LLM is reachable (Ollama with qwen2.5vl/llava),
 *      ask it to extract `{ items: [{ name, quantity }], hasAnnotations }`.
 *   2. Otherwise fall back to Tesseract OCR — picks up handwritten
 *      quantities ("30", "2 pcs") so the seller has something to work
 *      with even without a vision model.
 *   3. Match each extracted item against the owner's POS catalog by
 *      lower-case substring (over the product `name` and `sku`), so the
 *      review UI can show "Adidas cap (red)" → "Adidas SKU JR-001".
 *
 * Returns ParseResult — never throws on AI failure; surfaces a "none"
 * source so the UI can ask the operator to enter the items manually.
 *
 * NOTE: an earlier version of this service ran a TrOCR "second-opinion"
 * pass on cropped digit regions. Testing on real customer photos showed
 * TrOCR-base fails consistently on bubbly red-marker scrawls overlaid on
 * product photos (it was trained on clean IAM cursive on white paper).
 * That pass was removed; quantity accuracy now rests entirely on the
 * vision model + operator review at the till.
 */
@Injectable()
export class OrderFromImageService implements OnModuleInit {
  private readonly logger = new Logger(OrderFromImageService.name);
  /** True while an Ollama pull is in flight — keeps duplicate clicks
   *  from queueing parallel downloads. */
  private pulling = false;

  constructor(
    private readonly ai: AiService,
    private readonly ocr: OcrService,
    private readonly config: ConfigService,
    @InjectRepository(PosProduct) private readonly products: Repository<PosProduct>,
  ) {}

  /** Check on boot that the configured vision model is actually present
   *  in Ollama. Logs a clear warning + the exact remediation steps if
   *  it's missing. Optionally auto-pulls in the background when
   *  AI_VISION_AUTO_PULL=true (off by default — pulling a 5 GB model
   *  on every dev restart would be surprising). */
  async onModuleInit() {
    const model = this.config.get<string>('AI_VISION_MODEL') || 'qwen2.5vl:7b';
    const autoPull = (this.config.get<string>('AI_VISION_AUTO_PULL') ?? 'false').toLowerCase() === 'true';
    try {
      const status = await this.ai.health();
      if (!status.running) {
        this.logger.warn(
          `Ollama is not reachable at ${this.config.get('OLLAMA_URL', 'http://localhost:11434')}. ` +
          `Order-from-image will fall back to Tesseract OCR until Ollama is started.`,
        );
        return;
      }
      if (status.models.includes(model)) {
        this.logger.log(`Vision model "${model}" is installed and ready.`);
        return;
      }
      this.logger.warn(`Vision model "${model}" is NOT installed in Ollama.`);
      this.logger.warn(
        `Order-from-image accuracy will be poor until the model is pulled. Three ways to install:`,
      );
      this.logger.warn(`  (a) on the server:  ollama pull ${model}`);
      this.logger.warn(`  (b) one-click from the UI: open Order from image and click "Install model"`);
      this.logger.warn(`  (c) auto-pull on boot: set AI_VISION_AUTO_PULL=true in .env and restart`);
      if (autoPull) {
        this.logger.log(`AI_VISION_AUTO_PULL=true — pulling ${model} in the background...`);
        void this.installVisionModel();
      }
    } catch (err) {
      this.logger.warn(`Vision model status check failed: ${(err as Error).message}`);
    }
  }

  /** Snapshot of the vision model's install state — drives the install
   *  banner in the desktop dialog and mobile screen. */
  async getVisionModelStatus(): Promise<VisionModelStatus> {
    const model = this.config.get<string>('AI_VISION_MODEL') || 'qwen2.5vl:7b';
    const status = await this.ai.health();
    return {
      model,
      installed: status.models.includes(model),
      pulling: this.pulling,
      ollamaRunning: status.running,
    };
  }

  /** Kick off an Ollama pull for the configured vision model. Returns
   *  immediately — the actual download (~5 GB, can take 5–30 min)
   *  continues in the background. Frontend polls getVisionModelStatus()
   *  to know when it's ready. */
  installVisionModel(): { started: boolean; alreadyPulling: boolean; model: string } {
    const model = this.config.get<string>('AI_VISION_MODEL') || 'qwen2.5vl:7b';
    if (this.pulling) return { started: false, alreadyPulling: true, model };
    this.pulling = true;
    this.logger.log(`Pulling vision model ${model} in the background (5–30 min for ~5 GB)...`);
    void (async () => {
      try {
        const result = await this.ai.pullModel(model);
        if (result.success) this.logger.log(`Vision model ${model} pulled successfully.`);
        else this.logger.warn(`Vision model pull failed: ${result.message}`);
      } catch (err) {
        this.logger.warn(`Vision model pull threw: ${(err as Error).message}`);
      } finally {
        this.pulling = false;
      }
    })();
    return { started: true, alreadyPulling: false, model };
  }

  /** Best-effort vision parse. Never throws; returns source='none' on
   *  full failure so the operator can fall back to manual entry.
   *  Pulls the owner's POS catalog (name + sku + imageUrl) up-front so
   *  the vision model can pick the matching SKU directly instead of
   *  the service guessing from a free-text label afterwards. */
  async parseImage(ownerId: string, image: Buffer): Promise<ParseResult> {
    if (!image || image.length === 0) {
      throw new BadRequestException('Image is empty');
    }

    // Catalog snapshot — used both as context for the vision prompt
    // and for the fallback text matcher below.
    let catalog: PosProduct[] = [];
    try {
      catalog = await this.products.find({ where: { ownerId }, order: { name: 'ASC' } });
    } catch (err) {
      this.logger.warn(`Catalog read failed: ${(err as Error).message}`);
    }
    const catalogStats = {
      total: catalog.length,
      withImage: catalog.filter((p) => Boolean(p.imageUrl?.trim())).length,
    };

    // Try vision model first. qwen2.5vl:7b is materially better at
    // handwritten digit recognition than llava:7b — same chat-with-images
    // API on Ollama, swap the env var to switch.
    const visionModel = this.config.get<string>('AI_VISION_MODEL') || 'qwen2.5vl:7b';
    let visionResult: { items: ParsedItem[]; rawSummary: string; hasAnnotations: boolean } | null = null;
    try {
      visionResult = await this.runVision(image, visionModel, catalog);
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

    // Catalog match. The vision prompt already returned a `matchedSku`
    // for each item when it could; this fills in the rest by text and
    // resolves the SKU back to the full product row for the UI.
    items = items.map((it) => matchProduct(it, catalog));

    return {
      hasAnnotations,
      items,
      rawSummary: summary,
      ocrText: ocrText || undefined,
      model: source === 'ollama' ? visionModel : undefined,
      source,
      catalogStats,
    };
  }

  private async runVision(
    image: Buffer,
    model: string,
    catalog: PosProduct[],
  ): Promise<{ items: ParsedItem[]; rawSummary: string; hasAnnotations: boolean }> {
    const base64 = image.toString('base64');
    // Compact catalog block — gives the model the candidate list so it
    // can pick the matching SKU directly. Capped to 80 lines to keep
    // the prompt small; for larger catalogs we still fall back to
    // text matching against the full list after the model returns.
    const catalogBlock = catalog
      .slice(0, 80)
      .map((p) => `- ${p.sku} | ${p.name} | TZS ${p.price}`)
      .join('\n');
    const userPrompt = catalog.length === 0
      ? 'A customer has annotated this product photo to indicate what they want. Identify which items they selected and how many of each. Return ONLY the JSON in the schema.'
      :
`A customer has annotated this product photo to indicate what they want.
Identify which items they selected and how many of each.

CATALOG (pick the matching SKU for each detected item when you can):
${catalogBlock}

Return ONLY the JSON in the schema. Include "matchedSku" when you can confidently match a detected item to a SKU above.`;

    const result = await this.ai.chatCompletion({
      model,
      temperature: 0.2,
      maxTokens: 1000,
      messages: [
        { role: 'system', content: ORDER_FROM_IMAGE_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt, images: [base64] },
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
    const parsed = JSON.parse(body) as {
      hasAnnotations?: boolean;
      items?: Array<{
        name?: string;
        quantity?: number;
        notes?: string;
        matchedSku?: string | null;
      }>;
    };
    const items: ParsedItem[] = (parsed.items ?? [])
      .filter((it): it is {
        name: string;
        quantity?: number;
        notes?: string;
        matchedSku?: string | null;
      } =>
        typeof it?.name === 'string' && !!it.name.trim(),
      )
      .map((it) => ({
        name: String(it.name).trim().slice(0, 120),
        quantity: Math.max(1, Math.floor(Number(it.quantity) || 1)),
        notes: it.notes ? String(it.notes).slice(0, 200) : undefined,
        matchedSku: typeof it.matchedSku === 'string' && it.matchedSku.trim() ? it.matchedSku.trim() : undefined,
        // Higher confidence when the model returned its own SKU pick —
        // it actually had the catalog to compare against rather than
        // guessing a label.
        confidence: typeof it.matchedSku === 'string' && it.matchedSku.trim() ? 0.95 : 0.85,
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

/** Resolve a parsed item to a catalog row. If the vision model already
 *  returned `matchedSku`, honour that (case-insensitive lookup against
 *  the SKU column) — the model could see both the customer photo AND
 *  the catalog and picked one, that's stronger evidence than text-only
 *  matching. Otherwise fall back to token-overlap scoring on name+sku.
 *
 *  Always merges the resolved product's imageUrl so the review UI can
 *  show a thumbnail next to the picked row. */
function matchProduct(item: ParsedItem, catalog: PosProduct[]): ParsedItem {
  if (catalog.length === 0) return item;

  // 1. Honour vision-model SKU pick.
  if (item.matchedSku) {
    const needle = item.matchedSku.toLowerCase();
    const exact = catalog.find((p) => (p.sku || '').toLowerCase() === needle);
    if (exact) {
      return {
        ...item,
        matchedProductId: exact.id,
        matchedSku: exact.sku,
        matchedName: exact.name,
        matchedPrice: Number(exact.price),
        matchedImageUrl: exact.imageUrl || null,
        confidence: 0.95,
      };
    }
  }

  // 2. Fuzzy text match.
  const needle = item.name.toLowerCase();
  let best: { score: number; product: PosProduct } | null = null;
  for (const p of catalog) {
    const name = (p.name || '').toLowerCase();
    const sku  = (p.sku  || '').toLowerCase();
    let score = 0;
    if (sku && (needle === sku || needle.includes(sku))) score = 100;
    else {
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
    matchedImageUrl: best.product.imageUrl || null,
    confidence: Math.min(1, Math.max(item.confidence, best.score / 100)),
  };
}
