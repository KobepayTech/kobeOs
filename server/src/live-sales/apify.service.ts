import { Injectable, Logger } from '@nestjs/common';

export interface PolledComment { externalId: string; buyerHandle: string; text: string }

/**
 * Apify integration for NON-LIVE selling — polling comments on an ad/post
 * (not a livestream). Apify is a batch scraper, which is fine for posts (poll
 * every few minutes) but wrong for lives (use the realtime connector instead).
 *
 * Configure with APIFY_TOKEN and, optionally, the actor ids to use
 * (APIFY_TIKTOK_COMMENTS_ACTOR / APIFY_IG_COMMENTS_ACTOR) since actor
 * availability changes over time. Fields are mapped defensively because
 * different actors name them differently.
 */
@Injectable()
export class ApifyService {
  private readonly logger = new Logger(ApifyService.name);

  isConfigured(): boolean {
    return !!process.env.APIFY_TOKEN;
  }

  private actorFor(platform: string): string {
    if (platform === 'tiktok') return process.env.APIFY_TIKTOK_COMMENTS_ACTOR || 'clockworks~tiktok-comments-scraper';
    return process.env.APIFY_IG_COMMENTS_ACTOR || 'apify~instagram-comment-scraper';
  }

  /** Run an actor synchronously and return its dataset items. */
  async run(actorId: string, input: Record<string, unknown>): Promise<unknown[]> {
    const token = process.env.APIFY_TOKEN;
    if (!token) return [];
    const url = `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 120_000);
    try {
      const res = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input), signal: ctrl.signal,
      }).finally(() => clearTimeout(timer));
      if (!res.ok) { this.logger.warn(`Apify actor ${actorId} -> HTTP ${res.status}`); return []; }
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      this.logger.warn(`Apify run failed: ${(e as Error).message}`);
      return [];
    }
  }

  /** Fetch comments on a post/ad and normalise to {externalId, buyerHandle, text}. */
  async fetchPostComments(postUrl: string, platform: string, limit = 100): Promise<PolledComment[]> {
    if (!this.isConfigured() || !postUrl) return [];
    const items = await this.run(this.actorFor(platform), {
      postURLs: [postUrl], directUrls: [postUrl], resultsLimit: limit, maxComments: limit,
    });
    const out: PolledComment[] = [];
    for (const raw of items) {
      const it = raw as Record<string, unknown>;
      const text = String(it.text ?? it.comment ?? it.commentText ?? '').trim();
      if (!text) continue;
      const handle = String(
        (it.ownerUsername as string) ?? (it.username as string) ?? (it.uniqueId as string) ??
        ((it.user as { username?: string })?.username) ?? '',
      ).trim();
      const externalId = String(it.id ?? it.cid ?? it.commentId ?? `${handle}:${text}`).trim();
      out.push({ externalId, buyerHandle: handle, text });
    }
    return out;
  }
}
