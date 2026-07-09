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

export interface SearchHit { kind: string; refId: string; text: string; score: number }

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

  async search(ownerId: string, query: string, limit = 10, kind?: string): Promise<{ results: SearchHit[]; note?: string }> {
    const q = (query || '').trim();
    if (!q) return { results: [] };
    let qv: number[];
    try { qv = await this.embed(q); } catch { return { results: [], note: 'Embedding model unavailable — is Ollama running?' }; }
    if (!qv.length) return { results: [], note: 'Embedding model returned nothing.' };

    const where: Record<string, unknown> = { ownerId };
    if (kind) where.kind = kind;
    let docs = await this.repo.find({ where, take: 10000 });
    // Self-bootstrap: build the index on the first search for this owner.
    if (!docs.length) {
      await this.reindex(ownerId);
      docs = await this.repo.find({ where, take: 10000 });
    }
    if (!docs.length) return { results: [], note: 'Nothing to search yet.' };

    const results = docs
      .map((d) => ({ kind: d.kind, refId: d.refId, text: d.text, score: +cosine(qv, d.vector).toFixed(4) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    return { results };
  }
}
