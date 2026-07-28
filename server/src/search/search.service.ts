import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SearchDoc } from './search.entity';
import { PosProduct } from '../pos/pos.entity';
import { Tenant } from '../property/property.entity';
import { ProductReview } from '../store/product-review.entity';
import { AiService } from '../ai/ai.service';

export function cosine(a: number[], b: number[]): number {
  if (!a?.length || a.length !== b?.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

export interface SearchHit { kind: string; refId: string; text: string; score: number; vec?: number; kw?: number }

/** Split a string into lowercase word tokens (letters/digits), dropping tiny stopwords. */
export function tokenize(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length > 1);
}

/**
 * Keyword relevance of a document to the query — the "exact match" half of
 * hybrid search that vectors miss (SKUs, phone numbers, exact names). Counts
 * how many query tokens appear in the doc, with a strong bonus when the whole
 * query appears as a substring.
 */
export function keywordScore(qTokens: string[], rawQuery: string, text: string): number {
  if (!qTokens.length) return 0;
  const hay = text.toLowerCase();
  let hits = 0;
  for (const t of qTokens) if (hay.includes(t)) hits += 1;
  const coverage = hits / qTokens.length;
  const phraseBonus = rawQuery.trim().length >= 3 && hay.includes(rawQuery.trim().toLowerCase()) ? 1 : 0;
  return coverage + phraseBonus; // 0 … 2
}

/** Map each item's index to its 1-based rank (best = 1) by a numeric key, descending. */
export function rankByDesc(scores: number[]): number[] {
  const order = scores.map((s, i) => ({ s, i })).sort((a, b) => b.s - a.s);
  const rank = new Array(scores.length).fill(scores.length + 1);
  order.forEach((o, idx) => { rank[o.i] = idx + 1; });
  return rank;
}

/**
 * Semantic search: embeds products/tenants/reviews once (reindex) and finds the
 * closest matches to a natural-language query by meaning. Uses the local Ollama
 * embed model (nomic-embed-text if installed, else the active chat model), so it
 * works offline.
 */
@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @InjectRepository(SearchDoc) private readonly repo: Repository<SearchDoc>,
    @InjectRepository(PosProduct) private readonly products: Repository<PosProduct>,
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    @InjectRepository(ProductReview) private readonly reviews: Repository<ProductReview>,
    private readonly ai: AiService,
  ) {}

  private embedModel(): string {
    return process.env.OLLAMA_EMBED_MODEL || this.ai.getActiveModel();
  }

  private embed(text: string): Promise<number[]> {
    return this.ai.generateEmbedding(text.slice(0, 2000), this.embedModel());
  }

  /** Re-embed all searchable records for an owner. Returns how many were indexed. */
  async reindex(ownerId: string): Promise<{ indexed: number }> {
    const items: Array<{ kind: string; refId: string; text: string }> = [];
    for (const p of await this.products.find({ where: { ownerId }, take: 3000 })) {
      items.push({ kind: 'product', refId: p.id, text: [p.name, p.category, p.description].filter(Boolean).join(' — ') });
    }
    for (const t of await this.tenants.find({ where: { ownerId }, take: 3000 })) {
      items.push({ kind: 'tenant', refId: t.id, text: [t.name, t.phone, t.email].filter(Boolean).join(' — ') });
    }
    for (const r of await this.reviews.find({ where: { ownerId }, take: 3000 })) {
      if (r.comment) items.push({ kind: 'review', refId: r.id, text: r.comment });
    }

    const model = this.embedModel();
    let indexed = 0;
    for (const it of items) {
      if (!it.text.trim()) continue;
      try {
        const vector = await this.embed(it.text);
        if (!vector.length) continue;
        const existing = await this.repo.findOne({ where: { ownerId, kind: it.kind, refId: it.refId } });
        if (existing) { existing.text = it.text; existing.vector = vector; existing.model = model; await this.repo.save(existing); }
        else await this.repo.save(this.repo.create({ ownerId, kind: it.kind, refId: it.refId, text: it.text, vector, model }));
        indexed += 1;
      } catch (e) { this.logger.warn(`embed failed (${it.kind} ${it.refId}): ${(e as Error).message}`); }
    }
    this.logger.log(`reindex ${ownerId}: ${indexed}/${items.length} docs`);
    return { indexed };
  }

  /** Nightly: keep every owner's index fresh (03:00). */
  @Cron('0 3 * * *')
  async reindexAll(): Promise<void> {
    const owners = new Set<string>();
    for (const r of await this.products.createQueryBuilder('p').select('DISTINCT p."ownerId"', 'ownerId').getRawMany()) owners.add(r.ownerId);
    for (const r of await this.tenants.createQueryBuilder('t').select('DISTINCT t."ownerId"', 'ownerId').getRawMany()) owners.add(r.ownerId);
    for (const ownerId of owners) {
      try { await this.reindex(ownerId); } catch (e) { this.logger.warn(`nightly reindex ${ownerId} failed: ${(e as Error).message}`); }
    }
  }

  /**
   * Hybrid + corrective retrieval.
   *
   * HYBRID: fuse semantic (cosine) and keyword ranks with Reciprocal Rank
   * Fusion, so exact matches (a SKU, a phone number, an exact name) surface
   * alongside meaning-based matches. RRF is scale-free, so we don't have to
   * tune weights between two very different score distributions.
   *
   * CORRECTIVE: if the embedding model is offline we still return keyword
   * results (search never goes dark), and we expose a `weak` flag + `confidence`
   * so the assistant can say "no strong match" instead of hallucinating over a
   * poor retrieval. The 1-based RRF constant K damps the tyranny of rank #1.
   */
  async search(
    ownerId: string,
    query: string,
    limit = 10,
    kind?: string,
  ): Promise<{ results: SearchHit[]; weak: boolean; confidence: number; note?: string }> {
    const q = (query || '').trim();
    if (!q) return { results: [], weak: true, confidence: 0 };

    const where: Record<string, unknown> = { ownerId };
    if (kind) where.kind = kind;
    let docs = await this.repo.find({ where, take: 10000 });
    // Self-bootstrap: build the index on the first search for this owner.
    if (!docs.length) {
      await this.reindex(ownerId);
      docs = await this.repo.find({ where, take: 10000 });
    }
    if (!docs.length) return { results: [], weak: true, confidence: 0, note: 'Nothing to search yet.' };

    // Keyword scores — always available, even without the model.
    const qTokens = tokenize(q);
    const kw = docs.map((d) => keywordScore(qTokens, q, d.text));

    // Vector scores — best-effort; null if the embed model is unavailable.
    let qv: number[] | null = null;
    try { const v = await this.embed(q); qv = v.length ? v : null; } catch { qv = null; }
    const vec = qv ? docs.map((d) => cosine(qv!, d.vector)) : docs.map(() => 0);

    const vecRank = rankByDesc(vec);
    const kwRank = rankByDesc(kw);
    const K = 60;

    const fused = docs
      .map((d, i) => {
        const hasVec = !!qv && vec[i] > 0.05;
        const hasKw = kw[i] > 0;
        if (!hasVec && !hasKw) return null;
        const rrf = (hasVec ? 1 / (K + vecRank[i]) : 0) + (hasKw ? 1 / (K + kwRank[i]) : 0);
        return { kind: d.kind, refId: d.refId, text: d.text, score: +rrf.toFixed(6), vec: +vec[i].toFixed(4), kw: +kw[i].toFixed(3) };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Corrective confidence: the strongest semantic hit if the model ran, else
    // keyword coverage of the top hit. Weak → tell the caller to hedge.
    const bestVec = fused.reduce((m, r) => Math.max(m, r.vec ?? 0), 0);
    const bestKw = fused.reduce((m, r) => Math.max(m, r.kw ?? 0), 0);
    const confidence = qv ? +bestVec.toFixed(4) : +Math.min(1, bestKw / 2).toFixed(4);
    const weak = qv ? bestVec < 0.35 : bestKw < 1;
    const note = !qv
      ? 'Semantic model offline — keyword results only.'
      : weak
        ? 'No strong match — these are the closest guesses; confirm before relying on them.'
        : undefined;

    return { results: fused, weak, confidence, note };
  }
}
