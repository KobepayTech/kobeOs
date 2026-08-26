import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { In, LessThan, Repository } from 'typeorm';
import { randomBytes } from 'crypto';

const RESERVE_MINUTES = 5;
const CODE_ALPHABET = 'ACDEFGHJKMNPQRTUVWXY34679'; // no ambiguous 0/O/1/I/L/B8/S5/2Z
/** Short human reservation code the moderator reads out, e.g. "K7Q4M9".
 *  6 chars over a 25-char alphabet (~2.4e8) + a 5-min TTL + active-only lookup
 *  makes guessing a live reservation infeasible. */
function genReservationCode(): string {
  return Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
}
import { LiveSession, LivePin, LiveComment } from './live-sale.entity';
import { PosOrder, PosProduct } from '../pos/pos.entity';
import { StoreSettings } from '../store-settings/store-settings.entity';
import { OrdersService } from '../pos/pos.service';
import { PalmPesaService } from '../creators/palmpesa.service';
import { ApifyService } from './apify.service';

const num = (v: unknown) => Number(v) || 0;

export interface IngestInput {
  source?: string;
  buyerHandle?: string;
  buyerContact?: string;
  text: string;
}

@Injectable()
export class LiveSaleService {
  private readonly logger = new Logger(LiveSaleService.name);

  // ── In-memory moderation (per live, resets on restart) ─────────────────────
  private readonly recentByHandle = new Map<string, number[]>();   // handle -> timestamps
  private readonly recentText = new Map<string, number>();          // handle|text -> last ts
  private static readonly RATE_MAX = 6;        // comments …
  private static readonly RATE_WINDOW_MS = 8_000;  // … per 8s per handle
  private static readonly DUP_WINDOW_MS = 20_000;  // identical text suppressed for 20s
  private blockWords: string[] | null = null;

  private getBlockWords(): string[] {
    if (this.blockWords) return this.blockWords;
    const extra = (process.env.LIVE_BLOCK_WORDS || '').toLowerCase().split(',').map((w) => w.trim()).filter(Boolean);
    this.blockWords = [...extra];
    return this.blockWords;
  }

  /** Spam/abuse gate: block-words, per-handle flood, and duplicate text. */
  private moderate(handle: string, text: string): { blocked: boolean; reason?: string } {
    const clean = (text || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!clean) return { blocked: true, reason: 'empty' };
    for (const w of this.getBlockWords()) if (w && clean.includes(w)) return { blocked: true, reason: 'blocked-word' };
    const h = handle || '_anon';
    const now = Date.now();
    // Duplicate identical text from the same handle.
    const dupKey = `${h}|${clean}`;
    const lastDup = this.recentText.get(dupKey);
    if (lastDup && now - lastDup < LiveSaleService.DUP_WINDOW_MS) return { blocked: true, reason: 'duplicate' };
    this.recentText.set(dupKey, now);
    // Flood: too many from one handle in the window.
    const stamps = (this.recentByHandle.get(h) || []).filter((t) => now - t < LiveSaleService.RATE_WINDOW_MS);
    stamps.push(now);
    this.recentByHandle.set(h, stamps);
    if (stamps.length > LiveSaleService.RATE_MAX) return { blocked: true, reason: 'flood' };
    // Opportunistic cleanup so the maps don't grow forever.
    if (this.recentText.size > 5000) for (const [k, t] of this.recentText) if (now - t > LiveSaleService.DUP_WINDOW_MS) this.recentText.delete(k);
    return { blocked: false };
  }

  constructor(
    @InjectRepository(LiveSession) private readonly sessions: Repository<LiveSession>,
    @InjectRepository(LivePin) private readonly pins: Repository<LivePin>,
    @InjectRepository(LiveComment) private readonly comments: Repository<LiveComment>,
    @InjectRepository(PosProduct) private readonly products: Repository<PosProduct>,
    @InjectRepository(PosOrder) private readonly posOrders: Repository<PosOrder>,
    @InjectRepository(StoreSettings) private readonly settings: Repository<StoreSettings>,
    private readonly orders: OrdersService,
    private readonly palmpesa: PalmPesaService,
    private readonly apify: ApifyService,
  ) {}

  /** Absolute tracked storefront URL used in comment replies and private DMs.
   * The reservation token is the proof later used to attribute the full cart. */
  private async storefrontCheckoutUrl(ownerId: string, session: LiveSession, checkoutToken: string): Promise<string> {
    const store = await this.settings.findOne({ where: { ownerId } });
    const configured = store?.publishedUrl?.trim() || store?.customDomain?.trim() || '';
    const base = configured
      ? (/^https?:\/\//i.test(configured) ? configured : `https://${configured}`)
      : `https://${store?.domainSlug || 'shop'}.${process.env.TENANT_BASE_DOMAIN || process.env.CF_DOMAIN || 'kobeapptz.com'}`;
    const url = new URL(base.replace(/\/$/, '') + '/');
    url.searchParams.set('live', checkoutToken);
    url.searchParams.set('utm_source', session.platform);
    url.searchParams.set('utm_medium', session.kind === 'post' ? 'social-post' : 'social-live');
    url.searchParams.set('utm_campaign', session.id);
    return url.toString();
  }

  /* ── Sessions ── */

  async startSession(uid: string, dto: { title?: string; platform?: string; currency?: string; kind?: string; postUrl?: string; socialAccountId?: string }) {
    const kind: LiveSession['kind'] = dto.kind === 'post' ? 'post' : 'live';
    return this.sessions.save(this.sessions.create({
      ownerId: uid,
      title: dto.title?.trim() || (kind === 'post' ? 'Post / Ad Sale' : 'Live Sale'),
      platform: (dto.platform as LiveSession['platform']) || 'other',
      socialAccountId: dto.socialAccountId || null,
      currency: dto.currency || 'TZS',
      status: 'LIVE',
      kind,
      postUrl: dto.postUrl?.trim() || '',
      ingestToken: randomBytes(12).toString('hex'),
    }));
  }

  /**
   * Poll ad/post campaigns for new BUY comments via Apify (non-live channel).
   * Runs every 3 minutes over open 'post' sessions that have a postUrl. New
   * comments (by external id) are fed through the same reserve/checkout engine,
   * tagged source 'post-{platform}' so the KDS/admin can separate them.
   */
  @Cron('0 */3 * * * *')
  async pollPostCampaigns(): Promise<void> {
    if (!this.apify.isConfigured()) return;
    const campaigns = await this.sessions.find({ where: { status: 'LIVE', kind: 'post' } });
    for (const c of campaigns) {
      if (!c.postUrl) continue;
      try {
        const comments = await this.apify.fetchPostComments(c.postUrl, c.platform);
        for (const cm of comments) {
          await this.ingestComment(c.ownerId, c.id, {
            source: `post-${c.platform}`, buyerHandle: cm.buyerHandle, text: cm.text, externalId: cm.externalId,
          }).catch(() => undefined);
        }
      } catch (e) { this.logger.warn(`post campaign poll ${c.id} failed: ${(e as Error).message}`); }
    }
  }

  listSessions(uid: string) {
    return this.sessions.find({ where: { ownerId: uid }, order: { createdAt: 'DESC' }, take: 200 });
  }

  async operatorContext(uid: string) {
    const store = await this.settings.findOne({ where: { ownerId: uid } });
    if (!store) return { storefrontSlug: '', storefrontUrl: '', catalogUrl: '' };
    const baseDomain = (process.env.TENANT_BASE_DOMAIN || process.env.CF_DOMAIN || 'kobeapptz.com')
      .trim()
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '');
    const storefrontUrl = store.customDomain
      ? `https://${store.customDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')}`
      : `https://${store.domainSlug}.${baseDomain}`;
    return {
      storefrontSlug: store.domainSlug,
      storefrontUrl,
      catalogUrl: `${storefrontUrl}/live`,
    };
  }

  async getSession(uid: string, id: string) {
    const s = await this.sessions.findOne({ where: { ownerId: uid, id } });
    if (!s) throw new NotFoundException('Session not found');
    return s;
  }

  async endSession(uid: string, id: string) {
    const s = await this.getSession(uid, id);
    s.status = 'ENDED';
    s.endedAt = new Date();
    return this.sessions.save(s);
  }

  /** Toggle whether this live shows as a shoppable banner on the storefront. */
  async setStorefront(uid: string, id: string, show: boolean) {
    const s = await this.getSession(uid, id);
    s.showOnStorefront = show;
    return this.sessions.save(s);
  }

  /**
   * Public: the active, storefront-enabled live for a shop slug, with its
   * pinned products (live price + remaining stock). Powers the "LIVE" banner
   * on the online storefront so web shoppers can buy the live too. Returns
   * { live: false } when nothing is running.
   */
  async publicLive(slug: string) {
    const s =
      (await this.settings.findOne({ where: { domainSlug: slug } })) ??
      (await this.settings.findOne({ where: { customDomain: slug } }));
    if (!s) return { live: false as const };
    const session = await this.sessions.findOne({
      where: { ownerId: s.ownerId, status: 'LIVE', showOnStorefront: true },
      order: { createdAt: 'DESC' },
    });
    if (!session) return { live: false as const };
    const pins = await this.pins.find({ where: { ownerId: s.ownerId, sessionId: session.id }, order: { code: 'ASC' } });
    const products: Array<{ productId: string; code: string; name: string; livePrice: number; catalogPrice: number; stock: number; currency: string; imageUrl: string | null; isFeatured: boolean }> = [];
    for (const p of pins) {
      const prod = await this.products.findOne({ where: { ownerId: s.ownerId, id: p.productId } });
      if (!prod) continue;
      products.push({
        productId: p.productId, code: p.code, name: p.name,
        livePrice: num(p.livePrice) > 0 ? num(p.livePrice) : num(prod.price),
        catalogPrice: num(prod.price),
        stock: Number(prod.stock), currency: session.currency,
        imageUrl: (prod as { imageUrl?: string }).imageUrl ?? null,
        isFeatured: !!p.isFeatured,
      });
    }
    // "NOW SHOWING" — the featured product (or the first) leads the catalog.
    const featured = products.find((p) => p.isFeatured) ?? products[0] ?? null;
    const configured = s.publishedUrl?.trim() || s.customDomain?.trim() || '';
    const storefrontUrl = configured
      ? (/^https?:\/\//i.test(configured) ? configured : `https://${configured}`)
      : `https://${s.domainSlug}.${process.env.TENANT_BASE_DOMAIN || process.env.CF_DOMAIN || 'kobeapptz.com'}`;
    return {
      live: true as const,
      sessionId: session.id,
      title: session.title,
      currency: session.currency,
      platform: session.platform,
      kind: session.kind,
      storefrontUrl: storefrontUrl.replace(/\/$/, ''),
      featured,
      products,
    };
  }

  /** Seller sets the "NOW SHOWING" product; the catalog updates live. */
  async setFeatured(uid: string, sessionId: string, pinId: string) {
    await this.getSession(uid, sessionId);
    await this.pins.update({ ownerId: uid, sessionId }, { isFeatured: false });
    const res = await this.pins.update({ ownerId: uid, sessionId, id: pinId }, { isFeatured: true });
    if (!res.affected) throw new NotFoundException('Pinned product not found');
    return { ok: true, featuredPinId: pinId };
  }

  /**
   * Buyer reserves a product straight from the live catalog (method 1). Resolves
   * the active session by storefront slug, holds stock softly for RESERVE_MINUTES,
   * and returns a short reservation code + the checkout token/link.
   */
  async reserveFromCatalog(slug: string, dto: { code: string; qty?: number; buyerHandle?: string; variation?: string }) {
    const live = await this.publicLive(slug);
    if (!live.live) throw new BadRequestException('No live sale is running right now');
    const code = (dto.code || '').toUpperCase();
    const pin = await this.pins.findOne({ where: { sessionId: live.sessionId, code } });
    if (!pin) throw new NotFoundException('That product code is not in this live');
    const product = await this.products.findOne({ where: { id: pin.productId } });
    if (!product) throw new NotFoundException('Product no longer exists');
    const qty = Math.max(1, Math.min(Number(dto.qty) || 1, 99));
    if (Number(product.stock) < qty) throw new BadRequestException(`Only ${Number(product.stock)} left`);

    const reservationCode = genReservationCode();
    const checkoutToken = randomBytes(16).toString('base64url');
    const saved = await this.comments.save(this.comments.create({
      ownerId: pin.ownerId, sessionId: live.sessionId, source: 'catalog',
      buyerHandle: dto.buyerHandle?.trim() || '',
      text: `Catalog reserve ${code} x${qty}${dto.variation ? ` (${dto.variation})` : ''}`,
      matchedCode: code, matchedProductId: pin.productId, qty,
      status: 'RESERVED', checkoutToken, reservationCode,
      note: dto.variation?.slice(0, 120) || '',
      reservedUntil: new Date(Date.now() + RESERVE_MINUTES * 60_000),
    }));
    const session = await this.sessions.findOneOrFail({ where: { id: live.sessionId, ownerId: pin.ownerId } });
    const storefrontUrl = await this.storefrontCheckoutUrl(pin.ownerId, session, checkoutToken);
    return {
      reservationCode,
      checkoutToken,
      checkoutPath: `/live/pay/${checkoutToken}`,
      storefrontPath: `/?live=${encodeURIComponent(checkoutToken)}&utm_source=${encodeURIComponent(session.platform)}&utm_medium=${session.kind === 'post' ? 'social-post' : 'social-live'}&utm_campaign=${encodeURIComponent(session.id)}`,
      storefrontUrl,
      expiresInSeconds: RESERVE_MINUTES * 60,
      qty,
      sessionId: live.sessionId,
      id: saved.id,
    };
  }

  /** Look up a reservation by its short code (method 2 — the moderator's K7Q4). */
  async checkoutByCode(code: string) {
    // Only an ACTIVE reservation is resolvable by its short code (an already
    // converted/expired/ignored comment must not be reachable by guessing).
    const c = await this.comments.findOne({ where: { reservationCode: (code || '').toUpperCase(), status: 'RESERVED' } });
    if (!c || !c.checkoutToken) throw new NotFoundException('Reservation code not found or expired');
    return this.checkoutByToken(c.checkoutToken);
  }

  /* ── Pins ── */

  async pinProduct(uid: string, sessionId: string, dto: { productId: string; code: string; livePrice?: number }) {
    await this.getSession(uid, sessionId);
    const product = await this.products.findOne({ where: { ownerId: uid, id: dto.productId } });
    if (!product) throw new NotFoundException('Product not found');
    const code = dto.code.trim().toUpperCase();
    if (!code) throw new BadRequestException('A buy-code is required');
    const dupe = await this.pins.findOne({ where: { sessionId, code } });
    if (dupe) throw new BadRequestException(`Code "${code}" is already used in this session`);
    return this.pins.save(this.pins.create({
      ownerId: uid, sessionId, productId: product.id, code,
      name: product.name, livePrice: num(dto.livePrice),
    }));
  }

  async listPins(uid: string, sessionId: string) {
    const pins = await this.pins.find({ where: { ownerId: uid, sessionId }, order: { code: 'ASC' } });
    // Enrich with live remaining stock + catalog price.
    const out: Array<{ id: string; code: string; productId: string; name: string; livePrice: number; catalogPrice: number; stock: number; soldQty: number; isFeatured: boolean }> = [];
    for (const p of pins) {
      const prod = await this.products.findOne({ where: { ownerId: uid, id: p.productId } });
      out.push({
        id: p.id, code: p.code, productId: p.productId, name: p.name,
        livePrice: num(p.livePrice), catalogPrice: prod ? num(prod.price) : 0,
        stock: prod ? Number(prod.stock) : 0, soldQty: p.soldQty, isFeatured: p.isFeatured,
      });
    }
    return out;
  }

  async unpin(uid: string, sessionId: string, pinId: string) {
    const p = await this.pins.findOne({ where: { ownerId: uid, sessionId, id: pinId } });
    if (!p) throw new NotFoundException('Pin not found');
    await this.pins.remove(p);
    return { removed: true };
  }

  /* ── Comment ingest + parsing ── */

  /** Parse a comment against the session's pins. Finds the first pin whose
   *  code appears as a token, and a quantity if one sits next to it. */
  private async parse(uid: string, sessionId: string, text: string) {
    const pins = await this.pins.find({ where: { ownerId: uid, sessionId } });
    const upper = ` ${text.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ')} `;
    for (const p of pins) {
      const idx = upper.indexOf(` ${p.code} `);
      if (idx >= 0) {
        // Quantity: a number immediately after the code, else 1.
        const after = upper.slice(idx + p.code.length + 2);
        const m = after.match(/^\s*(?:X\s*)?(\d{1,3})\b/);
        const qty = m ? Math.max(1, parseInt(m[1], 10)) : 1;
        return { code: p.code, productId: p.productId, qty };
      }
    }
    return null;
  }

  async ingestComment(uid: string, sessionId: string, dto: IngestInput & { externalId?: string }) {
    const session = await this.getSession(uid, sessionId);
    // Live sessions are gated by LIVE status; post/ad campaigns stay open.
    if (session.kind !== 'post' && session.status !== 'LIVE') throw new BadRequestException('Session has ended');
    // De-dupe polled (Apify) comments by their platform comment id.
    if (dto.externalId) {
      const seen = await this.comments.findOne({ where: { ownerId: uid, sessionId, externalId: dto.externalId } });
      if (seen) return seen;
    }
    const match = await this.parse(uid, sessionId, dto.text || '');
    const handle = dto.buyerHandle?.trim() || '';

    // Moderation: drop spam/flood/blocked comments (store as IGNORED so the
    // console shows they were filtered) — but never filter a genuine BUY match,
    // so a fast repeat buyer is still served (BUY dedupe handles that below).
    if (!match) {
      const mod = this.moderate(handle, dto.text || '');
      if (mod.blocked) {
        return this.comments.save(this.comments.create({
          ownerId: uid, sessionId, source: dto.source || 'manual', buyerHandle: handle,
          text: dto.text || '', status: 'IGNORED', note: `filtered: ${mod.reason}`,
          externalId: dto.externalId || '',
        }));
      }
    }

    // A BUY that matches a pinned product is auto-RESERVED: the buyer gets a
    // checkout link and stock is held (softly) for RESERVE_MINUTES. Duplicate
    // BUYs from the same handle for the same product reuse the live reservation
    // instead of stacking orders.
    let status: LiveComment['status'] = match ? 'MATCHED' : 'NEW';
    let checkoutToken = '';
    let reservationCode = '';
    let reservedUntil: Date | null = null;
    if (match && handle) {
      const existing = await this.comments.findOne({
        where: { ownerId: uid, sessionId, buyerHandle: handle, matchedProductId: match.productId, status: 'RESERVED' },
      });
      if (existing && existing.reservedUntil && existing.reservedUntil.getTime() > Date.now()) {
        return existing; // idempotent: same buyer already holds this product
      }
      status = 'RESERVED';
      checkoutToken = randomBytes(16).toString('base64url');
      reservationCode = genReservationCode();
      reservedUntil = new Date(Date.now() + RESERVE_MINUTES * 60_000);
    }

    const saved = await this.comments.save(this.comments.create({
      ownerId: uid, sessionId,
      source: dto.source || 'manual',
      buyerHandle: handle,
      buyerContact: dto.buyerContact?.trim() || '',
      text: dto.text || '',
      matchedCode: match?.code || '',
      matchedProductId: match?.productId || null,
      qty: match?.qty || 1,
      status,
      checkoutToken,
      reservationCode,
      reservedUntil,
      externalId: dto.externalId || '',
    }));

    // Auto-reply text the connector/moderator posts back into the live chat
    // (or the IG private reply) so the buyer knows how to complete the order.
    let reply: string | undefined;
    if (status === 'RESERVED') {
      const who = handle ? `@${handle.replace(/^@/, '')} ` : '';
      const shopUrl = await this.storefrontCheckoutUrl(uid, session, checkoutToken);
      reply = `${who}${match!.code} reserved${saved.qty > 1 ? ` x${saved.qty}` : ''} for ${RESERVE_MINUTES} min. Add anything else you want and checkout here: ${shopUrl}`;
    }
    return { ...saved, reply } as LiveComment & { reply?: string };
  }

  /** Public checkout page data for a reservation token (buyer opens /live/pay/{token}). */
  async checkoutByToken(token: string) {
    const c = await this.comments.findOne({ where: { checkoutToken: token } });
    if (!c || !token) throw new NotFoundException('Reservation not found');
    const session = await this.sessions.findOne({ where: { id: c.sessionId } });
    const pin = c.matchedProductId
      ? await this.pins.findOne({ where: { ownerId: c.ownerId, sessionId: c.sessionId, productId: c.matchedProductId } })
      : null;
    const product = c.matchedProductId ? await this.products.findOne({ where: { ownerId: c.ownerId, id: c.matchedProductId } }) : null;
    const expired = c.status === 'EXPIRED' || (c.reservedUntil ? c.reservedUntil.getTime() <= Date.now() : true);
    return {
      token,
      status: c.status,
      expired: c.status !== 'CONVERTED' && expired,
      reservedUntil: c.reservedUntil,
      qty: c.qty,
      buyerHandle: c.buyerHandle,
      product: product ? {
        id: product.id,
        sku: product.sku,
        name: product.name,
        imageUrl: (product as { imageUrl?: string }).imageUrl ?? null,
      } : null,
      unitPrice: num(pin?.livePrice) || num(product?.price),
      currency: session?.currency || 'TZS',
      sessionTitle: session?.title || 'Live Sale',
      sessionId: session?.id || c.sessionId,
      platform: session?.platform || c.source || 'other',
      kind: session?.kind || 'live',
      reservationCode: c.reservationCode,
      storefrontPath: `/?live=${encodeURIComponent(token)}`,
    };
  }

  /** Buyer self-checkout from the reservation link. Reuses the operator convert
   *  path (atomic stock + payment), keyed by the public checkout token. */
  async payByToken(token: string, dto: { buyerContact?: string }) {
    const c = await this.comments.findOne({ where: { checkoutToken: token } });
    if (!c || !token) throw new NotFoundException('Reservation not found');
    if (c.status === 'CONVERTED') return { ok: true, alreadyPaid: true };
    if (c.status === 'EXPIRED' || (c.reservedUntil ? c.reservedUntil.getTime() <= Date.now() : true)) {
      throw new BadRequestException('This reservation has expired — comment BUY again to get a new link.');
    }
    return this.convert(c.ownerId, c.id, { buyerContact: dto.buyerContact });
  }

  /** Release soft reservations that were never paid, so stock frees up. */
  @Cron('30 * * * * *')
  async releaseExpiredReservations(): Promise<void> {
    const res = await this.comments.update(
      { status: 'RESERVED', reservedUntil: LessThan(new Date()) },
      { status: 'EXPIRED', note: 'Reservation expired unpaid' },
    );
    if (res.affected) this.logger.log(`released ${res.affected} expired live reservation(s)`);
  }

  listComments(uid: string, sessionId: string) {
    return this.comments.find({ where: { ownerId: uid, sessionId }, order: { createdAt: 'DESC' }, take: 300 });
  }

  async ignoreComment(uid: string, commentId: string) {
    const c = await this.comments.findOne({ where: { ownerId: uid, id: commentId } });
    if (!c) throw new NotFoundException('Comment not found');
    c.status = 'IGNORED';
    return this.comments.save(c);
  }

  /* ── The sale: comment → order → stock decrement → payment ── */

  async convert(uid: string, commentId: string, dto: { qty?: number; buyerContact?: string; code?: string }) {
    const c = await this.comments.findOne({ where: { ownerId: uid, id: commentId } });
    if (!c) throw new NotFoundException('Comment not found');
    if (c.status === 'CONVERTED') throw new BadRequestException('Already converted to a sale');

    // Resolve the pin — allow an operator override of the code.
    const code = (dto.code || c.matchedCode || '').toUpperCase();
    const pin = code
      ? await this.pins.findOne({ where: { ownerId: uid, sessionId: c.sessionId, code } })
      : (c.matchedProductId ? await this.pins.findOne({ where: { ownerId: uid, sessionId: c.sessionId, productId: c.matchedProductId } }) : null);
    if (!pin) throw new BadRequestException('No product matched — set a buy-code first');

    const qty = Math.max(1, Number(dto.qty) || c.qty || 1);
    const product = await this.products.findOne({ where: { ownerId: uid, id: pin.productId } });
    if (!product) throw new NotFoundException('Product no longer exists');
    const catalog = num(product.price);
    const live = num(pin.livePrice);
    // negotiatedPrice can't exceed catalog (OrdersService rejects markups).
    const negotiatedPrice = live > 0 && live <= catalog ? live : undefined;
    const contact = (dto.buyerContact || c.buyerContact || '').trim();
    const session = await this.getSession(uid, c.sessionId);

    // Atomically claim this comment so a concurrent pay (buyer double-tap /
    // auto+manual) can't create two orders + two payment requests. Only the
    // request that flips the status proceeds; a failed order reverts it below.
    const claim = await this.comments.createQueryBuilder()
      .update(LiveComment).set({ status: 'CONVERTED' })
      .where('id = :id AND ownerId = :uid AND status != :done', { id: c.id, uid, done: 'CONVERTED' })
      .execute();
    if (!claim.affected) throw new BadRequestException('Already converted to a sale');

    let order;
    try {
      order = await this.orders.create(uid, {
        orderNumber: `LIVE-${Date.now().toString().slice(-8)}-${randomBytes(2).toString('hex')}`,
        lines: [{ productId: pin.productId, quantity: qty, negotiatedPrice }],
        paymentMethod: 'live',
        customerName: c.buyerHandle || 'Live buyer',
        customerPhone: contact,
        salesChannel: `${session.platform || c.source || 'other'}-${session.kind || 'live'}`,
        liveSessionId: c.sessionId,
        liveCommentId: c.id,
        attributionCode: c.reservationCode,
      } as Parameters<OrdersService['create']>[1]);
    } catch (e) {
      c.status = 'FAILED';
      c.note = (e as Error).message;
      await this.comments.save(c);
      throw new BadRequestException((e as Error).message || 'Could not create the sale');
    }

    // Mark everything sold.
    const unit = negotiatedPrice ?? (live > 0 ? live : catalog);
    const lineTotal = unit * qty;
    pin.soldQty += qty;
    await this.pins.save(pin);
    c.status = 'CONVERTED';
    c.orderId = (order as { id: string }).id;
    c.qty = qty;
    c.buyerContact = contact;
    await this.comments.save(c);
    session.totalSales = num(session.totalSales) + lineTotal;
    session.orderCount += 1;
    await this.sessions.save(session);

    // Best-effort PalmPesa payment request to the buyer's phone.
    let payment: { requested: boolean; message: string } = { requested: false, message: 'Sale recorded. Collect payment manually.' };
    if (contact) {
      try {
        await this.palmpesa.initiatePayment({
          name: c.buyerHandle || 'Live buyer', email: '', phone: contact,
          amountTzs: lineTotal, transactionId: `LIVE-${c.id}`,
          description: `${pin.name} x${qty} (live sale)`,
        });
        payment = { requested: true, message: 'Payment request sent to the buyer’s phone.' };
      } catch { /* gateway down — manual collection */ }
    }

    return {
      ok: true,
      order,
      lineTotal,
      remainingStock: product ? Number(product.stock) - qty : null,
      payment,
    };
  }

  /* ── Stats ── */

  async stats(uid: string, sessionId: string) {
    const session = await this.getSession(uid, sessionId);
    const pins = await this.listPins(uid, sessionId);
    const comments = await this.comments.find({ where: { ownerId: uid, sessionId } });
    const converted = comments.filter((c) => c.status === 'CONVERTED');
    // Per-platform breakdown (source = 'tiktok' | 'instagram' | 'bridge' | ...).
    const byPlatform: Record<string, { comments: number; reserved: number; sold: number }> = {};
    for (const c of comments) {
      const p = (c.source || 'other').toLowerCase();
      byPlatform[p] = byPlatform[p] || { comments: 0, reserved: 0, sold: 0 };
      byPlatform[p].comments += 1;
      if (c.status === 'RESERVED') byPlatform[p].reserved += 1;
      if (c.status === 'CONVERTED') byPlatform[p].sold += 1;
    }
    return {
      session,
      totalSales: num(session.totalSales),
      orderCount: session.orderCount,
      pendingComments: comments.filter((c) => c.status === 'MATCHED' || c.status === 'NEW').length,
      reservedComments: comments.filter((c) => c.status === 'RESERVED').length,
      convertedComments: converted.length,
      byPlatform,
      pins,
    };
  }

  /**
   * Unified sales feed for the admin (KDS board + mobile PWA): every reservation
   * and sale across the owner's live AND post/ad campaigns, split by channel so
   * the KDS can show non-live sales in a separate list. Newest first.
   */
  async salesFeed(uid: string, limit = 200) {
    const rows = await this.comments.find({
      where: [
        { ownerId: uid, status: 'RESERVED' },
        { ownerId: uid, status: 'CONVERTED' },
      ],
      order: { createdAt: 'DESC' }, take: limit,
    });
    const sessionIds = Array.from(new Set(rows.map((r) => r.sessionId)));
    const sessions = sessionIds.length ? await this.sessions.find({ where: { ownerId: uid, id: In(sessionIds) } }) : [];
    const byId = new Map(sessions.map((s) => [s.id, s]));
    const orderIds = rows.map((r) => r.orderId).filter((id): id is string => !!id);
    const orders = orderIds.length ? await this.posOrders.find({ where: { ownerId: uid, id: In(orderIds) } }) : [];
    const ordersById = new Map(orders.map((order) => [order.id, order]));
    const items = rows.map((r) => {
      const s = byId.get(r.sessionId);
      const order = r.orderId ? ordersById.get(r.orderId) : undefined;
      return {
        id: r.id, channel: (s?.kind ?? 'live') as LiveSession['kind'],
        platform: (r.source || s?.platform || 'other').replace(/^post-/, ''),
        sessionTitle: s?.title ?? 'Sale', sessionId: r.sessionId,
        code: r.matchedCode, qty: r.qty, status: r.status,
        buyerHandle: r.buyerHandle, buyerContact: r.buyerContact,
        reservationCode: r.reservationCode, checkoutToken: r.checkoutToken,
        reservedUntil: r.reservedUntil, orderId: r.orderId, createdAt: r.createdAt,
        orderNumber: order?.orderNumber ?? null,
        orderTotal: order ? num(order.total) : null,
        currency: order?.currency ?? s?.currency ?? 'TZS',
        salesChannel: order?.salesChannel ?? `${s?.platform || r.source || 'other'}-${s?.kind || 'live'}`,
      };
    });
    return {
      live: items.filter((i) => i.channel === 'live'),
      nonLive: items.filter((i) => i.channel === 'post'),
      counts: { live: items.filter((i) => i.channel === 'live').length, nonLive: items.filter((i) => i.channel === 'post').length },
    };
  }

  /* ── Public bridge ingest (token-scoped, no JWT) ── */

  async ingestByToken(token: string, dto: IngestInput) {
    const session = await this.sessions.findOne({ where: { ingestToken: token } });
    if (!session) throw new NotFoundException('Invalid ingest token');
    if (session.status !== 'LIVE') throw new BadRequestException('Session has ended');
    return this.ingestComment(session.ownerId, session.id, { ...dto, source: dto.source || 'bridge' });
  }

}
