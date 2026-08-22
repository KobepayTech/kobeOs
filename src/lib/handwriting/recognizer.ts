/**
 * Offline handwritten-digit recognition for the "write a quantity" overlay.
 *
 * It works from the actual pointer STROKES (not a screenshot / OCR), which is
 * both more reliable and fully offline — no AI request per write. Strokes are
 * segmented into digits by horizontal gaps, each digit is rasterised to a
 * normalised, centred grid, and classified by cosine similarity against
 * prototype grids rendered from the system font at runtime (buildFontPrototypes)
 * or supplied by the caller. The deterministic pieces (segmentation,
 * rasterisation, cosine, clamping) are pure and unit-tested; the classifier is a
 * v1 baseline that reports a confidence so the UI can fall back to the keypad
 * when unsure.
 */

export interface Pt { x: number; y: number; t?: number }
export type Stroke = Pt[];

export interface DigitResult { digit: number; confidence: number; alt?: number }
export interface NumberResult { value: number | null; confidence: number; digits: DigitResult[] }

export const GRID = 20; // NxN raster grid

/** Bounding box of a set of strokes. */
function bbox(strokes: Stroke[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of strokes) for (const p of s) {
    if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Split strokes into left-to-right digit groups. A stroke starts a new digit
 * when its horizontal span sits clearly to the right of the current group
 * (gap > tolerance), so "12" becomes two groups. Strokes that horizontally
 * overlap the current group (e.g. the two strokes of a 4, or a dotted 5) stay
 * together.
 */
export function segmentDigits(strokes: Stroke[], gapRatio = 0.35): Stroke[][] {
  const withX = strokes
    .filter((s) => s.length > 0)
    .map((s) => {
      const xs = s.map((p) => p.x);
      return { s, minX: Math.min(...xs), maxX: Math.max(...xs) };
    })
    .sort((a, b) => a.minX - b.minX);
  if (!withX.length) return [];

  const full = bbox(strokes);
  const width = Math.max(1, full.maxX - full.minX);
  // A typical digit is ~half its height wide; use the overall width to derive a
  // sensible gap tolerance that scales with how big the person wrote.
  const gap = width * gapRatio;

  const groups: Array<{ strokes: Stroke[]; maxX: number }> = [];
  for (const item of withX) {
    const cur = groups[groups.length - 1];
    if (cur && item.minX <= cur.maxX + gap) {
      cur.strokes.push(item.s);
      cur.maxX = Math.max(cur.maxX, item.maxX);
    } else {
      groups.push({ strokes: [item.s], maxX: item.maxX });
    }
  }
  return groups.map((g) => g.strokes);
}

/**
 * Rasterise strokes into a normalised GRID×GRID ink map (0..1 per cell),
 * centred by bounding box and scaled to fill ~80% of the grid — the same
 * normalisation applied to prototypes, so comparisons are scale/position
 * invariant. Strokes are interpolated so fast writing doesn't leave gaps.
 */
export function rasterize(strokes: Stroke[], grid = GRID): number[] {
  const cells = new Array(grid * grid).fill(0);
  const pts = strokes.flat();
  if (pts.length === 0) return cells;

  const { minX, minY, maxX, maxY } = bbox(strokes);
  const w = Math.max(1e-6, maxX - minX);
  const h = Math.max(1e-6, maxY - minY);
  const scale = (grid * 0.8) / Math.max(w, h);
  const offX = (grid - w * scale) / 2;
  const offY = (grid - h * scale) / 2;
  const tx = (p: Pt) => ({ x: (p.x - minX) * scale + offX, y: (p.y - minY) * scale + offY });

  const plot = (x: number, y: number) => {
    const cx = Math.floor(x), cy = Math.floor(y);
    if (cx < 0 || cy < 0 || cx >= grid || cy >= grid) return;
    cells[cy * grid + cx] = 1;
  };

  for (const s of strokes) {
    if (s.length === 1) { const p = tx(s[0]); plot(p.x, p.y); continue; }
    for (let i = 1; i < s.length; i++) {
      const a = tx(s[i - 1]), b = tx(s[i]);
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
      for (let k = 0; k <= steps; k++) plot(a.x + ((b.x - a.x) * k) / steps, a.y + ((b.y - a.y) * k) / steps);
    }
  }
  return cells;
}

/** Cosine similarity of two equal-length vectors (0..1 for non-negative inputs). */
export function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

/** Classify one digit's strokes against prototype grids (index 0..9). */
export function classifyDigit(strokes: Stroke[], prototypes: number[][]): DigitResult {
  const v = rasterize(strokes);
  const scored = prototypes
    .map((proto, digit) => ({ digit, score: cosineSim(v, proto) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0], second = scored[1];
  // Confidence blends absolute match quality with the margin over the runner-up,
  // so an ambiguous "3 vs 8" reports low confidence and the UI can ask.
  const margin = best.score - (second?.score ?? 0);
  const confidence = Math.max(0, Math.min(1, best.score * 0.6 + margin * 4 * 0.4));
  return { digit: best.digit, confidence: +confidence.toFixed(3), alt: second?.digit };
}

/** Recognise a whole handwritten number (1..multi-digit) from strokes. */
export function recognizeNumber(strokes: Stroke[], prototypes: number[][]): NumberResult {
  const groups = segmentDigits(strokes);
  if (!groups.length || prototypes.length < 10) return { value: null, confidence: 0, digits: [] };
  const digits = groups.map((g) => classifyDigit(g, prototypes));
  const value = Number(digits.map((d) => d.digit).join(''));
  const confidence = digits.reduce((m, d) => Math.min(m, d.confidence), 1);
  return { value: Number.isFinite(value) ? value : null, confidence: +confidence.toFixed(3), digits };
}

/**
 * Apply a written quantity to the cart's SET semantics with stock/limit
 * clamping. Returns the new quantity plus a flag when the request was clamped
 * to available stock (so the UI can prompt "only 34 available — add 34?").
 */
export function clampQuantity(written: number, stock: number, max = 99): { quantity: number; clampedToStock: boolean; overMax: boolean } {
  const overMax = written > max;
  const capped = Math.min(written, max);
  const clampedToStock = capped > stock;
  const quantity = Math.max(0, Math.min(capped, Math.max(0, stock)));
  return { quantity, clampedToStock, overMax };
}
