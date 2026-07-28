import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { basename, extname } from 'path';
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
    if (!files.length) throw new BadRequestException('Select at least one image');
    if (files.length > 100) throw new BadRequestException('Upload at most 100 images per batch');

    const results: UploadResult[] = [];
    for (const file of files) {
      if (!file.mimetype?.startsWith('image/')) {
        throw new BadRequestException(`${file.originalname} is not an image`);
      }
      const sha256 = createHash('sha256').update(file.buffer).digest('hex');
      const duplicate = await this.inbox.findOne({ where: { ownerId, sha256 } });
      if (duplicate) {
        results.push({ item: duplicate, duplicate: true });
        continue;
      }
      const asset = await this.media.createFromUpload(ownerId, file, 'image');
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
      results.push({ item, duplicate: false });
    }
    return results;
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
        const response = await this.ai.complete(
          `Suggest product metadata from this uploaded image filename and context.\nFilename: ${item.originalName}\nModule: ${dto.moduleId || 'erp'}\nCategory hint: ${dto.categoryHint || 'none'}\nReturn JSON only: {"name":"","category":"","subcategory":"","colour":"","description":"","tags":[""]}. Do not publish or invent prices.`,
          'You create conservative catalogue suggestions. Return valid JSON only and mark uncertain values with empty strings.',
        );
        const parsed = JSON.parse(response.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')) as Record<string, unknown>;
        suggestions = { ...suggestions, ...parsed };
      } catch {
        // Deterministic filename suggestion remains available offline.
      }
      item.aiSuggestions = suggestions;
      await this.inbox.save(item);
      results.push({ itemId: item.id, suggestions });
    }
    return results;
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
