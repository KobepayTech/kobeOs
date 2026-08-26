import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { basename, extname } from 'path';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { MediaAsset } from './media.entity';
import { MediaInboxItem } from './media-inbox.entity';
import { MediaAssetsService } from './media.service';
import { PosProduct } from '../pos/pos.entity';
import { AiService } from '../ai/ai.service';
import {
  ProcessMediaInboxDto,
  SuggestMediaMetadataDto,
  UpdateMediaInboxItemDto,
} from './dto/media-inbox.dto';

export interface UploadResult {
  item: MediaInboxItem;
  duplicate: boolean;
}

export interface ImportUrlResult {
  url: string;
  ok: boolean;
  duplicate: boolean;
  item?: MediaInboxItem;
  error?: string;
}

/** A file the service can store, whether it came from multipart upload or a
 *  server-side URL fetch. Mirrors the subset of Express.Multer.File we use. */
interface StorableFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

const MAX_REMOTE_BYTES = 100 * 1024 * 1024; // 100MB, same ceiling as upload
const FETCH_TIMEOUT_MS = 90_000;
const QUICK_ADD_SOURCE_TYPES = ['QUICK_ADD_PHOTO', 'QUICK_ADD_SCREENSHOT', 'QUICK_ADD_MESSAGE', 'QUICK_ADD_IMPORT'] as const;
type QuickAddSourceType = (typeof QUICK_ADD_SOURCE_TYPES)[number];

function quickAddSourceType(value: unknown): QuickAddSourceType {
  return QUICK_ADD_SOURCE_TYPES.includes(value as QuickAddSourceType)
    ? value as QuickAddSourceType
    : 'QUICK_ADD_PHOTO';
}

/** Block SSRF: reject private / loopback / link-local / cloud-metadata targets. */
function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const p = ip.split('.').map(Number);
    if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true;
    const [a, b] = p;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;        // link-local + AWS/GCP metadata
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true;                        // multicast/reserved
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::' ) return true;
  if (lower.startsWith('fe80') || lower.startsWith('fc') || lower.startsWith('fd')) return true; // link-local / ULA
  if (lower.startsWith('::ffff:')) return isPrivateIp(lower.slice(7)); // IPv4-mapped
  return false;
}

/** Validate a user-supplied URL is a public http(s) endpoint (defeats SSRF). */
async function assertPublicHttpUrl(raw: string): Promise<void> {
  let u: URL;
  try { u = new URL(raw); } catch { throw new BadRequestException('Invalid URL'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new BadRequestException('Only http(s) links are allowed');
  }
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new BadRequestException('That link points to a private address');
    return;
  }
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
    throw new BadRequestException('That link points to a private host');
  }
  let addrs: Array<{ address: string }>;
  try { addrs = await lookup(host, { all: true }); } catch { throw new BadRequestException('Could not resolve the link host'); }
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) {
    throw new BadRequestException('That link resolves to a private address');
  }
}

/** Pull a Google Drive file id out of the many shapes a Drive link can take. */
function driveFileId(url: string): string | null {
  if (!/(?:drive|docs)\.google\.com|drive\.usercontent\.google\.com/.test(url)) return null;
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]{10,})/,   // /file/d/<id>/view
    /[?&]id=([a-zA-Z0-9_-]{10,})/,       // open?id=<id> / uc?id=<id>
    /\/d\/([a-zA-Z0-9_-]{10,})/,         // /d/<id>
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

/** Best-effort filename from a URL path, so imported items have a real name. */
function nameFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    const base = decodeURIComponent(path.split('/').filter(Boolean).pop() || '');
    if (base && /\.[a-z0-9]{2,5}$/i.test(base)) return base;
  } catch { /* not a parseable URL */ }
  return '';
}

/** Sniff an image/video mime from magic bytes when the server sent none. */
function sniffMime(buf: Buffer): string {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.length >= 6 && buf.toString('ascii', 0, 6).startsWith('GIF8')) return 'image/gif';
  if (buf.length >= 12 && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buf.length >= 12 && buf.toString('ascii', 4, 8) === 'ftyp') return 'video/mp4';
  return '';
}

function extForMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif',
    'image/webp': '.webp', 'image/heic': '.heic', 'video/mp4': '.mp4',
    'video/quicktime': '.mov', 'video/webm': '.webm',
  };
  return map[mime] || '';
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}
function number(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
}
function cleanName(filename: string): string {
  return basename(filename, extname(filename))
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'New product';
}
function slug(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 42) || 'ITEM';
}

@Injectable()
export class MediaInboxService {
  constructor(
    @InjectRepository(MediaInboxItem)
    private readonly inbox: Repository<MediaInboxItem>,
    @InjectRepository(MediaAsset)
    private readonly assets: Repository<MediaAsset>,
    @InjectRepository(PosProduct)
    private readonly products: Repository<PosProduct>,
    private readonly media: MediaAssetsService,
    private readonly ai: AiService,
    private readonly dataSource: DataSource,
  ) {}

  async upload(ownerId: string, files: Express.Multer.File[]): Promise<UploadResult[]> {
    if (!files.length) throw new BadRequestException('Select at least one image or video');
    if (files.length > 100) throw new BadRequestException('Upload at most 100 files per batch');

    const results: UploadResult[] = [];
    for (const file of files) {
      const isImage = !!file.mimetype?.startsWith('image/');
      const isVideo = !!file.mimetype?.startsWith('video/');
      if (!isImage && !isVideo) {
        throw new BadRequestException(`${file.originalname} is not an image or video`);
      }
      results.push(await this.storeFile(ownerId, file));
    }
    return results;
  }

  /** Dedupe by content hash, store the asset, and create the inbox row. Shared
   *  by multipart upload and URL import so both behave identically. */
  private async storeFile(ownerId: string, file: StorableFile): Promise<UploadResult> {
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const duplicate = await this.inbox.findOne({ where: { ownerId, sha256 } });
    if (duplicate) return { item: duplicate, duplicate: true };

    const isVideo = !!file.mimetype?.startsWith('video/');
    const asset = await this.media.createFromUpload(ownerId, file, isVideo ? 'video' : 'image');
    const item = await this.inbox.save(this.inbox.create({
      ownerId,
      assetId: asset.id,
      sha256,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      width: null,
      height: null,
      url: asset.src,
      status: 'UNPROCESSED',
      folder: 'unprocessed',
      metadata: {},
      aiSuggestions: {},
      error: '',
    }));
    return { item, duplicate: false };
  }

  /** Import images/videos from a list of URLs (paste-a-list bulk add). Each URL
   *  is fetched server-side and stored like an upload. Google Drive links are
   *  normalised to a direct-download form; private links surface a clear hint. */
  async importFromUrls(ownerId: string, urls: string[]): Promise<ImportUrlResult[]> {
    const cleaned = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];
    if (!cleaned.length) throw new BadRequestException('Paste at least one link');
    if (cleaned.length > 200) throw new BadRequestException('Import at most 200 links per batch');

    const results: ImportUrlResult[] = [];
    for (const url of cleaned) {
      try {
        const file = await this.fetchRemote(url);
        const stored = await this.storeFile(ownerId, file);
        results.push({ url, ok: true, duplicate: stored.duplicate, item: stored.item });
      } catch (error) {
        results.push({ url, ok: false, duplicate: false, error: error instanceof Error ? error.message : String(error) });
      }
    }
    return results;
  }

  /** Fetch a remote image/video into memory, following the shape of the link. */
  private async fetchRemote(url: string): Promise<StorableFile> {
    let target = url;
    const driveId = driveFileId(url);
    if (driveId) {
      // confirm=t skips Drive's "can't scan for viruses" interstitial for
      // large public files; private files still return a sign-in HTML page.
      target = `https://drive.usercontent.google.com/download?id=${driveId}&export=download&confirm=t`;
    }

    // Follow redirects manually so every hop (incl. redirect targets) is
    // re-validated against the SSRF allowlist — a public URL can 302 to an
    // internal one. Cap the streamed body so a huge endpoint can't exhaust heap.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      let current = target;
      let hops = 0;
      for (;;) {
        await assertPublicHttpUrl(current);
        res = await fetch(current, { redirect: 'manual', signal: controller.signal });
        if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
          if (++hops > 4) throw new Error('Too many redirects');
          current = new URL(res.headers.get('location')!, current).toString();
          continue;
        }
        break;
      }
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof BadRequestException) throw e;
      throw new Error(`Could not reach the link (${(e as Error).message})`);
    }
    let contentType = '';
    let buffer: Buffer = Buffer.alloc(0);
    try {
      if (!res.ok) throw new Error(`Link returned HTTP ${res.status}`);

      contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (contentType.startsWith('text/html')) {
        if (driveId) {
          throw new Error('Google Drive did not return the file — set the file\'s sharing to "Anyone with the link" and try again');
        }
        throw new Error('Link returned a web page, not an image');
      }
      const declared = Number(res.headers.get('content-length') || '0');
      if (declared > MAX_REMOTE_BYTES) throw new Error(`File is larger than ${MAX_REMOTE_BYTES / 1024 / 1024}MB`);

      // Stream with a hard cap so a lying/absent Content-Length can't OOM us.
      const chunks: Buffer[] = [];
      let total = 0;
      const body = res.body as AsyncIterable<Uint8Array> | null;
      if (body) {
        for await (const chunk of body) {
          total += chunk.length;
          if (total > MAX_REMOTE_BYTES) { controller.abort(); throw new Error(`File is larger than ${MAX_REMOTE_BYTES / 1024 / 1024}MB`); }
          chunks.push(Buffer.from(chunk));
        }
      }
      buffer = Buffer.concat(chunks);
      if (!buffer.length) throw new Error('The link returned an empty file');
    } finally {
      clearTimeout(timer);
    }

    let mime = contentType;
    if (!mime.startsWith('image/') && !mime.startsWith('video/')) {
      mime = sniffMime(buffer); // octet-stream / missing header → sniff magic bytes
    }
    if (!mime.startsWith('image/') && !mime.startsWith('video/')) {
      throw new Error('That link is not an image or video');
    }

    // Prefer the server-provided filename, then the URL, then a synthesised one.
    let name = '';
    const disposition = res.headers.get('content-disposition') || '';
    const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
    if (match) name = decodeURIComponent(match[1].trim());
    if (!name) name = nameFromUrl(url);
    if (!name) name = `import-${createHash('sha256').update(buffer).digest('hex').slice(0, 10)}${extForMime(mime)}`;
    if (!/\.[a-z0-9]{2,5}$/i.test(name)) name += extForMime(mime);

    return { originalname: name, mimetype: mime, buffer, size: buffer.length };
  }

  async list(
    ownerId: string,
    options: { status?: MediaInboxItem['status']; moduleId?: string; q?: string } = {},
  ) {
    const qb = this.inbox.createQueryBuilder('item')
      .where('item.ownerId = :ownerId', { ownerId })
      .orderBy('item.createdAt', 'DESC')
      .take(1000);
    if (options.status) qb.andWhere('item.status = :status', { status: options.status });
    if (options.moduleId) qb.andWhere('item.moduleId = :moduleId', { moduleId: options.moduleId });
    if (options.q?.trim()) {
      qb.andWhere('(LOWER(item.originalName) LIKE :q OR LOWER(item.category) LIKE :q OR LOWER(item.subcategory) LIKE :q)', {
        q: `%${options.q.trim().toLowerCase()}%`,
      });
    }
    return qb.getMany();
  }

  async update(ownerId: string, id: string, dto: UpdateMediaInboxItemDto) {
    const item = await this.inbox.findOne({ where: { ownerId, id } });
    if (!item) throw new NotFoundException('Media item not found');
    if (item.status === 'PROCESSED') throw new BadRequestException('Processed media metadata is read-only');
    if (dto.category !== undefined) item.category = dto.category.trim();
    if (dto.subcategory !== undefined) item.subcategory = dto.subcategory.trim();
    if (dto.metadata !== undefined) item.metadata = { ...item.metadata, ...dto.metadata };
    return this.inbox.save(item);
  }

  async remove(ownerId: string, id: string) {
    const item = await this.inbox.findOne({ where: { ownerId, id } });
    if (!item) return { deleted: false };
    if (item.status === 'PROCESSING') throw new BadRequestException('Wait for processing to finish');
    const asset = await this.assets.findOne({ where: { ownerId, id: item.assetId } });
    await this.inbox.remove(item);
    if (asset) await this.media.remove(ownerId, asset.id);
    return { deleted: true };
  }

  async suggest(ownerId: string, dto: SuggestMediaMetadataDto) {
    const items = await this.inbox.find({ where: { ownerId, id: In(dto.itemIds) } });
    if (items.length !== dto.itemIds.length) throw new NotFoundException('One or more media items were not found');
    const results: Array<{ itemId: string; suggestions: Record<string, unknown> }> = [];
    for (const item of items) {
      let suggestions: Record<string, unknown> = {
        name: cleanName(item.originalName),
        category: dto.categoryHint || item.category || '',
        tags: [],
      };
      try {
        const asset = await this.assets.findOne({ where: { ownerId, id: item.assetId } });
        if (asset?.contentBinary && asset.contentBinary.length <= 8 * 1024 * 1024 && item.mimeType.startsWith('image/')) {
          // Use the local vision model when the original image bytes are
          // available. This makes Quick Add useful for supplier photos and
          // screenshots instead of relying only on filenames.
          const vision = await this.ai.describeProductImage(asset.contentBinary.toString('base64'));
          suggestions = {
            ...suggestions,
            name: vision.name || suggestions.name,
            category: vision.category || suggestions.category,
            description: vision.description || '',
            tags: vision.tags,
            colours: vision.colours,
            sizes: vision.sizes,
          };
        } else {
          const response = await this.ai.complete(
            `Suggest product metadata from this uploaded image filename and context.\nFilename: ${item.originalName}\nModule: ${dto.moduleId || 'erp'}\nCategory hint: ${dto.categoryHint || 'none'}\nReturn JSON only: {"name":"","category":"","subcategory":"","colour":"","description":"","tags":[""]}. Do not publish or invent prices.`,
            'You create conservative catalogue suggestions. Return valid JSON only and mark uncertain values with empty strings.',
          );
          const parsed = JSON.parse(response.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')) as Record<string, unknown>;
          suggestions = { ...suggestions, ...parsed };
        }
      } catch {
        // Deterministic filename suggestion remains available offline.
      }
      item.aiSuggestions = suggestions;
      await this.inbox.save(item);
      results.push({ itemId: item.id, suggestions });
    }
    return results;
  }

  /**
   * One-tap bulk catalogue: turn every unprocessed image into a generic,
   * PUBLISHED product (name from the filename, price 0, active) while keeping
   * the image attached. Processed in chunks so a large box never runs one giant
   * transaction. Failed items can be retried with includeFailed.
   */
  async generateGenericProducts(
    ownerId: string,
    opts: { category?: string; includeFailed?: boolean; sourceType?: 'QUICK_ADD_PHOTO' | 'QUICK_ADD_SCREENSHOT' | 'QUICK_ADD_MESSAGE' | 'QUICK_ADD_IMPORT' } = {},
  ): Promise<{ processed: number; results: unknown[] }> {
    const statuses = (opts.includeFailed
      ? ['UNPROCESSED', 'FAILED']
      : ['UNPROCESSED']) as MediaInboxItem['status'][];
    const items = await this.inbox.find({ where: { ownerId, status: In(statuses) } });
    if (!items.length) return { processed: 0, results: [] };
    const ids = items.map((item) => item.id);
    let processed = 0;
    const results: unknown[] = [];
    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100);
      const r = await this.process(ownerId, {
        itemIds: batch,
        moduleId: 'erp',
        entityType: 'product',
        createEntities: true,
        category: opts.category?.trim() || 'General',
        // Generic + published: active defaults true, a placeholder price/stock.
        defaults: { price: 0, stock: 0, active: true },
        sourceType: quickAddSourceType(opts.sourceType),
      });
      processed += r.processed;
      results.push(...r.results);
    }
    return { processed, results };
  }

  async process(ownerId: string, dto: ProcessMediaInboxDto) {
    const items = await this.inbox.find({ where: { ownerId, id: In(dto.itemIds) } });
    if (items.length !== dto.itemIds.length) throw new NotFoundException('One or more selected images were not found');
    const unavailable = items.find((item) => item.status !== 'UNPROCESSED' && item.status !== 'FAILED');
    if (unavailable) throw new BadRequestException(`${unavailable.originalName} is already ${unavailable.status.toLowerCase()}`);

    const overrideMap = new Map((dto.overrides ?? []).map((entry) => [entry.itemId, entry.metadata ?? {}]));
    await this.inbox.update({ ownerId, id: In(dto.itemIds) }, { status: 'PROCESSING', error: '' });

    try {
      const created = await this.dataSource.transaction(async (manager) => {
        const inboxRepo = manager.getRepository(MediaInboxItem);
        const productRepo = manager.getRepository(PosProduct);
        const results: Array<{ itemId: string; entityId: string | null; entityType: string }> = [];

        for (const item of items) {
          const metadata = {
            ...(dto.defaults ?? {}),
            ...item.aiSuggestions,
            ...item.metadata,
            ...(overrideMap.get(item.id) ?? {}),
          };
          let entityId = dto.entityId ?? null;

          if (dto.moduleId === 'erp' && dto.entityType === 'product' && dto.createEntities !== false) {
            const baseName = text(metadata.name, cleanName(item.originalName));
            const requestedSku = text(metadata.sku);
            let sku = requestedSku || `${slug(baseName)}-${randomBytes(3).toString('hex').toUpperCase()}`;
            const existing = await productRepo.findOne({ where: { ownerId, sku } });
            if (existing) sku = `${slug(sku)}-${randomBytes(3).toString('hex').toUpperCase()}`;
            const category = text(metadata.category, dto.category || item.category || 'Uncategorised');
            const subcategory = text(metadata.subcategory, dto.subcategory || item.subcategory);
            const product = await productRepo.save(productRepo.create({
              ownerId,
              sku,
              name: baseName,
              description: text(metadata.description),
              category,
              price: number(metadata.price),
              stock: Math.floor(number(metadata.stock)),
              imageUrl: item.url,
              imageUrls: [item.url],
              active: metadata.active !== false,
              taxRate: number(metadata.taxRate),
              unit: text(metadata.unit, 'pcs'),
              // Real first-class columns.
              tags: stringArray(metadata.tags),
              variants: Array.isArray(metadata.variants) ? (metadata.variants as PosProduct['variants']) : [],
              // Everything else the importer captures lives in customData
              // (PosProduct has no dedicated barcode/cost/minStock/etc. columns).
              customData: {
                barcode: text(metadata.barcode),
                cost: number(metadata.cost),
                minStock: Math.floor(number(metadata.minStock)),
                reorderLevel: Math.floor(number(metadata.reorderLevel)),
                subcategory,
                sizes: stringArray(metadata.sizes),
                colours: stringArray(metadata.colours ?? metadata.colors),
                supplier: text(metadata.supplier),
                weight: metadata.weight ?? null,
                dimensions: metadata.dimensions ?? null,
                sourceMediaInboxId: item.id,
              },
              sourceType: quickAddSourceType(dto.sourceType),
            }));
            entityId = product.id;
          }

          if (!entityId && dto.createEntities === false) {
            throw new BadRequestException('Select a target entity or enable entity creation');
          }

          item.status = 'PROCESSED';
          item.moduleId = dto.moduleId;
          item.entityType = dto.entityType;
          item.entityId = entityId;
          item.category = dto.category?.trim() || text(metadata.category, item.category);
          item.subcategory = dto.subcategory?.trim() || text(metadata.subcategory, item.subcategory);
          item.metadata = metadata;
          item.folder = `processed/${dto.moduleId}/${dto.entityType}`;
          item.processedAt = new Date();
          item.error = '';
          await inboxRepo.save(item);
          results.push({ itemId: item.id, entityId, entityType: dto.entityType });
        }
        return results;
      });
      return { processed: created.length, results: created };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.inbox.update({ ownerId, id: In(dto.itemIds) }, { status: 'FAILED', error: message });
      throw error;
    }
  }
}
