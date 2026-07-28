import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiService } from './ai.service';
import { AiDocument, AiDocChunk } from './ai-document.entity';
import { cosine, tokenize, keywordScore, rankByDesc } from '../search/search.service';

export interface DocPassage { documentId: string; title: string; idx: number; text: string; score: number; vec: number }

/**
 * "Chat with your documents" — ingest a document's text, embed it in passages,
 * and retrieve the passages most relevant to a question. Hybrid (semantic +
 * keyword) and offline-safe, mirroring SearchService so answers stay grounded
 * in the owner's own paperwork instead of the model's imagination.
 */
@Injectable()
export class AiDocsService {
  private readonly logger = new Logger(AiDocsService.name);

  constructor(
    @InjectRepository(AiDocument) private readonly docs: Repository<AiDocument>,
    @InjectRepository(AiDocChunk) private readonly chunks: Repository<AiDocChunk>,
    private readonly ai: AiService,
  ) {}

  private embedModel(): string {
    return process.env.OLLAMA_EMBED_MODEL || this.ai.getActiveModel();
  }

  /** Split text into overlapping passages (~900 chars, 120 overlap) on sensible boundaries. */
  private chunk(text: string, size = 900, overlap = 120): string[] {
    const clean = text.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').trim();
    if (clean.length <= size) return clean ? [clean] : [];
    const out: string[] = [];
    let i = 0;
    while (i < clean.length) {
      let end = Math.min(i + size, clean.length);
      if (end < clean.length) {
        // Prefer to break on a paragraph/sentence boundary near the window end.
        const slice = clean.slice(i, end);
        const br = Math.max(slice.lastIndexOf('\n\n'), slice.lastIndexOf('. '), slice.lastIndexOf('\n'));
        if (br > size * 0.5) end = i + br + 1;
      }
      const passage = clean.slice(i, end).trim();
      if (passage) out.push(passage);
      if (end >= clean.length) break;
      i = end - overlap;
    }
    return out;
  }

  /** Ingest a document: chunk, embed, and store. Returns the parent row. */
  async ingest(ownerId: string, title: string, text: string, source = ''): Promise<AiDocument> {
    const cleanTitle = (title || 'Untitled document').trim().slice(0, 200);
    const passages = this.chunk(text || '');
    const doc = await this.docs.save(this.docs.create({
      ownerId, title: cleanTitle, source: source.slice(0, 200), chunkCount: 0, charCount: (text || '').length,
    }));

    const model = this.embedModel();
    let saved = 0;
    for (let idx = 0; idx < passages.length; idx++) {
      const passage = passages[idx];
      let vector: number[] = [];
      try { vector = await this.ai.generateEmbedding(passage.slice(0, 2000), model); }
      catch (e) { this.logger.warn(`embed chunk ${idx} failed: ${(e as Error).message}`); }
      await this.chunks.save(this.chunks.create({
        ownerId, documentId: doc.id, title: cleanTitle, idx, text: passage, vector, model,
      }));
      saved++;
    }
    doc.chunkCount = saved;
    await this.docs.save(doc);
    this.logger.log(`ingested "${cleanTitle}" for ${ownerId}: ${saved} passages`);
    return doc;
  }

  async list(ownerId: string): Promise<AiDocument[]> {
    return this.docs.find({ where: { ownerId }, order: { createdAt: 'DESC' }, take: 500 });
  }

  async remove(ownerId: string, id: string): Promise<{ removed: boolean }> {
    const doc = await this.docs.findOne({ where: { ownerId, id } });
    if (!doc) return { removed: false };
    await this.chunks.delete({ ownerId, documentId: id });
    await this.docs.delete({ ownerId, id });
    return { removed: true };
  }

  /**
   * Retrieve the passages most relevant to a query. Hybrid RRF (semantic +
   * keyword), offline-safe: keyword-only if the embed model is down. `weak`
   * tells the assistant to hedge instead of over-trusting a poor match.
   */
  async search(
    ownerId: string,
    query: string,
    limit = 6,
    documentId?: string,
  ): Promise<{ passages: DocPassage[]; weak: boolean; note?: string }> {
    const q = (query || '').trim();
    if (!q) return { passages: [], weak: true };
    const where: Record<string, unknown> = { ownerId };
    if (documentId) where.documentId = documentId;
    const rows = await this.chunks.find({ where, take: 20000 });
    if (!rows.length) return { passages: [], weak: true, note: 'No documents uploaded yet.' };

    const qTokens = tokenize(q);
    const kw = rows.map((r) => keywordScore(qTokens, q, r.text));
    let qv: number[] | null = null;
    try { const v = await this.ai.generateEmbedding(q.slice(0, 2000), this.embedModel()); qv = v.length ? v : null; }
    catch { qv = null; }
    const vec = qv ? rows.map((r) => cosine(qv!, r.vector)) : rows.map(() => 0);
    const vecRank = rankByDesc(vec);
    const kwRank = rankByDesc(kw);
    const K = 60;

    const passages = rows
      .map((r, i) => {
        const hasVec = !!qv && vec[i] > 0.05;
        const hasKw = kw[i] > 0;
        if (!hasVec && !hasKw) return null;
        const rrf = (hasVec ? 1 / (K + vecRank[i]) : 0) + (hasKw ? 1 / (K + kwRank[i]) : 0);
        return { documentId: r.documentId, title: r.title, idx: r.idx, text: r.text, score: +rrf.toFixed(6), vec: +vec[i].toFixed(4) };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    const bestVec = passages.reduce((m, r) => Math.max(m, r.vec), 0);
    const bestKw = kw.reduce((m, v) => Math.max(m, v), 0);
    const weak = qv ? bestVec < 0.35 : bestKw < 1;
    const note = !qv
      ? 'Semantic model offline — keyword passages only.'
      : weak ? 'No strong match in the documents — confirm before relying on this.' : undefined;
    return { passages, weak, note };
  }
}
