import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import sharp from 'sharp';
import { IntakeItem, IntakeSession } from './intake.entity';
import {
  INTAKE_KINDS, MAX_IMAGES_PER_SESSION, displayName, progressOf, questionsFor,
  suggestionToAnswers, validateAnswers,
  type IntakeItemStatus, type IntakeKind, type IntakeProgress, type IntakeQuestion,
  type VariantAnswer,
} from './intake.rules';
import { CommerceProductMedia } from '../commerce/commerce.entity';
import { CommerceService } from '../commerce/commerce.service';
import { HotelMenuItem, HotelRoom } from '../hotel/hotel.entity';
import { PosProduct } from '../pos/pos.entity';
import { In } from 'typeorm';
import { AiService } from '../ai/ai.service';

export interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

export interface IntakeStep {
  sessionId: string;
  kind: IntakeKind;
  item: {
    id: string;
    position: number;
    imageUrl: string;
    /** What the model read from the photo, for the person to accept or correct. */
    prefill: Record<string, string>;
    /** True when a model was asked and had nothing, or was unavailable. */
    suggestionUnavailable: boolean;
  } | null;
  questions: IntakeQuestion[];
  progress: IntakeProgress;
}

/**
 * Guided catalogue intake.
 *
 * Upload the photos once, then answer two or three questions per photo with
 * the photo in front of you. Each answer creates a real catalogue entry
 * through the same path the single-item flow uses, so nothing here is a second
 * way to make a product.
 */
@Injectable()
export class IntakeService {
  private readonly logger = new Logger(IntakeService.name);

  constructor(
    @InjectRepository(IntakeSession) private readonly sessions: Repository<IntakeSession>,
    @InjectRepository(IntakeItem) private readonly items: Repository<IntakeItem>,
    @InjectRepository(CommerceProductMedia) private readonly media: Repository<CommerceProductMedia>,
    @InjectRepository(HotelRoom) private readonly rooms: Repository<HotelRoom>,
    @InjectRepository(HotelMenuItem) private readonly menu: Repository<HotelMenuItem>,
    @InjectRepository(PosProduct) private readonly products: Repository<PosProduct>,
    private readonly commerce: CommerceService,
    private readonly ai: AiService,
  ) {}

  /**
   * Take a batch of photos and build the queue.
   *
   * Images are converted and stored immediately, before any question is asked,
   * so the upload is the only thing that depends on a good connection. Once it
   * returns, the rest of the work is answering questions against rows that are
   * already saved.
   */
  async start(
    ownerId: string,
    kind: string,
    files: UploadedImage[],
    contextId?: string,
  ): Promise<IntakeStep> {
    if (!INTAKE_KINDS.includes(kind as IntakeKind)) {
      throw new BadRequestException(`Unknown intake kind: ${kind}`);
    }
    if (!files?.length) throw new BadRequestException('Upload at least one photo.');
    if (files.length > MAX_IMAGES_PER_SESSION) {
      throw new BadRequestException(
        `Upload at most ${MAX_IMAGES_PER_SESSION} photos at a time. Start another batch for the rest.`,
      );
    }
    const bad = files.find((file) => !file?.buffer?.length || !file.mimetype?.startsWith('image/'));
    if (bad) throw new BadRequestException(`${bad.originalname || 'One file'} is not an image.`);

    // Check the prerequisite before a single photo is stored. Shop products
    // need a business to belong to, and discovering that after someone has
    // uploaded eighty photos and described one of them is the wrong place to
    // find out.
    if (kind === 'SHOP_PRODUCT') {
      try {
        await this.commerce.businessForOwner(ownerId);
      } catch {
        throw new BadRequestException(
          'Set up your shop first, then come back to add stock from photos.',
        );
      }
    }

    const session = await this.sessions.save(this.sessions.create({
      ownerId, kind: kind as IntakeKind, status: 'OPEN', contextId: contextId ?? null,
    }));

    for (const [position, file] of files.entries()) {
      const token = randomBytes(24).toString('base64url');
      // webp at the same quality quick-add uses, so a phone photo does not
      // carry its full size through the catalogue and the sync.
      const binary = await sharp(file.buffer).rotate().webp({ quality: 88 }).toBuffer();
      await this.media.save(this.media.create({
        // No product yet — this photo becomes one once it has been described.
        productId: '00000000-0000-0000-0000-000000000000',
        url: `/api/commerce-public/media/${token}`,
        kind: 'IMAGE', sortOrder: position, crop: {},
        publicToken: token, mimeType: 'image/webp', contentBinary: binary,
      } as Partial<CommerceProductMedia>));

      await this.items.save(this.items.create({
        ownerId, sessionId: session.id, position, imageToken: token, status: 'PENDING',
      }));
    }

    this.logger.log(`Intake ${session.id}: ${files.length} photos queued for ${kind}.`);
    return this.step(ownerId, session.id);
  }

  /** The next photo to describe, with whatever the model could read from it. */
  async step(ownerId: string, sessionId: string): Promise<IntakeStep> {
    const session = await this.sessionFor(ownerId, sessionId);
    const all = await this.items.find({ where: { sessionId }, order: { position: 'ASC' } });
    const progress = progressOf(all.map((item) => item.status as IntakeItemStatus));
    const pending = all.find((item) => item.status === 'PENDING');

    if (!pending) {
      if (session.status === 'OPEN' && progress.complete) {
        session.status = 'FINISHED';
        await this.sessions.save(session);
      }
      return {
        sessionId, kind: session.kind, item: null,
        questions: questionsFor(session.kind), progress,
      };
    }

    const suggestion = await this.suggestionFor(pending, session.kind);
    return {
      sessionId,
      kind: session.kind,
      item: {
        id: pending.id,
        position: pending.position,
        imageUrl: `/api/commerce-public/media/${pending.imageToken}`,
        prefill: { ...suggestionToAnswers(session.kind, suggestion), ...(pending.answers as Record<string, string>) },
        suggestionUnavailable: pending.suggestionAttempted && !suggestion,
      },
      questions: questionsFor(session.kind),
      progress,
    };
  }

  /**
   * Record the answers for one photo and create the catalogue entry.
   *
   * Validation happens before anything is created, so a mistyped price does
   * not leave a half-made product behind. The item is marked FAILED rather
   * than lost if creation itself fails, because the photo is still in the
   * queue and the person can try again.
   */
  async answer(
    ownerId: string,
    itemId: string,
    answers: Record<string, unknown>,
  ): Promise<IntakeStep & { created: { id: string; name: string } | null; problems: Array<{ field: string; message: string }> }> {
    const item = await this.items.findOne({ where: { id: itemId, ownerId } });
    if (!item) throw new NotFoundException('That photo is not in your queue.');
    const session = await this.sessionFor(ownerId, item.sessionId);

    const problems = validateAnswers(session.kind, answers ?? {});
    if (problems.length) {
      // Keep what was typed, so a correction does not start from an empty form.
      item.answers = { ...(item.answers ?? {}), ...(answers ?? {}) };
      await this.items.save(item);
      return { ...(await this.step(ownerId, session.id)), created: null, problems };
    }

    item.answers = answers ?? {};
    let created: { id: string; name: string } | null = null;
    try {
      created = await this.create(session, item, answers ?? {});
      item.status = 'DONE';
      item.createdId = created.id;
      item.lastError = '';
    } catch (error) {
      item.status = 'FAILED';
      item.lastError = String((error as Error)?.message ?? error).slice(0, 500);
      this.logger.error(`Intake item ${item.id} failed: ${item.lastError}`);
    }
    await this.items.save(item);

    return { ...(await this.step(ownerId, session.id)), created, problems: [] };
  }

  /** Leave a photo undescribed and move on. */
  async skip(ownerId: string, itemId: string): Promise<IntakeStep> {
    const item = await this.items.findOne({ where: { id: itemId, ownerId } });
    if (!item) throw new NotFoundException('That photo is not in your queue.');
    item.status = 'SKIPPED';
    await this.items.save(item);
    return this.step(ownerId, item.sessionId);
  }

  /** Put a failed or skipped photo back in the queue. */
  async retry(ownerId: string, itemId: string): Promise<IntakeStep> {
    const item = await this.items.findOne({ where: { id: itemId, ownerId } });
    if (!item) throw new NotFoundException('That photo is not in your queue.');
    if (item.status === 'DONE') {
      throw new BadRequestException('That photo has already become a catalogue entry.');
    }
    item.status = 'PENDING';
    item.lastError = '';
    await this.items.save(item);
    return this.step(ownerId, item.sessionId);
  }

  /** Open sessions, so a half-finished batch can be found again after a reload. */
  async openSessions(ownerId: string) {
    const sessions = await this.sessions.find({
      where: { ownerId, status: 'OPEN' }, order: { createdAt: 'DESC' },
    });
    return Promise.all(sessions.map(async (session) => {
      const statuses = (await this.items.find({ where: { sessionId: session.id } }))
        .map((item) => item.status as IntakeItemStatus);
      return {
        id: session.id,
        kind: session.kind,
        startedAt: session.createdAt,
        progress: progressOf(statuses),
      };
    }));
  }

  private async sessionFor(ownerId: string, sessionId: string): Promise<IntakeSession> {
    const session = await this.sessions.findOne({ where: { id: sessionId, ownerId } });
    if (!session) throw new NotFoundException('Intake session not found.');
    return session;
  }

  /**
   * Ask the model about a photo once, and remember the answer.
   *
   * Vision is slow and the same photo is shown again when someone steps back,
   * so asking twice would make the queue feel broken. A model that is missing
   * or offline is recorded as attempted with nothing, because retrying it on
   * every poll would stall the queue for a feature that is optional.
   */
  private async suggestionFor(
    item: IntakeItem,
    kind: IntakeKind,
  ): Promise<{ name?: string; category?: string; sizes?: string[] } | null> {
    if (item.suggestionAttempted) {
      return Object.keys(item.suggestion ?? {}).length ? (item.suggestion as never) : null;
    }

    let suggestion: Record<string, unknown> = {};
    try {
      const row = await this.media.findOne({ where: { publicToken: item.imageToken } });
      if (row?.contentBinary?.length) {
        suggestion = await this.ai.describeProductImage(
          Buffer.from(row.contentBinary).toString('base64'),
        ) as unknown as Record<string, unknown>;
      }
    } catch (error) {
      // No model installed, or it is offline. The questions still work; they
      // just start empty.
      this.logger.debug(`No photo suggestion for ${item.id}: ${String((error as Error)?.message).slice(0, 120)}`);
    }

    item.suggestion = suggestion ?? {};
    item.suggestionAttempted = true;
    await this.items.save(item);
    void kind;
    return Object.keys(item.suggestion).length ? (item.suggestion as never) : null;
  }

  /**
   * Build the sellable combinations for a product, each with its own SKU so
   * the till can tell which one was bought.
   */
  private variantsFor(productId: string, raw: unknown) {
    if (!Array.isArray(raw)) return [];
    return (raw as VariantAnswer[]).map((variant, index) => {
      const size = String(variant.size ?? '').trim();
      const color = String(variant.color ?? '').trim();
      const attributes: Record<string, string> = {};
      if (size) attributes.size = size;
      if (color) attributes.color = color;
      return {
        id: `${productId}-${index}`,
        sku: `PHOTO-${productId.slice(0, 8)}-${index + 1}`,
        name: [color, size].filter(Boolean).join(' / '),
        price: Number(variant.price ?? 0),
        stock: Math.max(0, Math.floor(Number(variant.stock ?? 0))),
        attributes,
      };
    });
  }

  /** Create the catalogue entry this photo describes. */
  private async create(
    session: IntakeSession,
    item: IntakeItem,
    answers: Record<string, unknown>,
  ): Promise<{ id: string; name: string }> {
    const name = displayName(session.kind, answers);
    const imageUrl = `/api/commerce-public/media/${item.imageToken}`;
    const price = Number(answers.price ?? 0);

    if (session.kind === 'SHOP_PRODUCT') {
      // The existing quick-add path, so a product made here is identical to
      // one made singly: same media, same catalogue sync.
      const result = await this.commerce.quickAdd(session.ownerId, {
        name,
        caption: String(answers.caption ?? ''),
        imageUrl,
        panelCount: 1,
        category: String(answers.category ?? ''),
        price,
        stock: Math.max(0, Math.floor(Number(answers.stock ?? 0))),
      });
      const product = result.products?.[0];
      if (!product) throw new Error('The product was not created.');

      const variants = this.variantsFor(product.id, answers.variants);
      const discount = answers.discountPrice;
      if (variants.length || (discount !== undefined && discount !== null && String(discount) !== '')) {
        // Each combination is its own SKU, and the product's stock becomes the
        // sum of them: a shelf holding four blue M and two red L has six, and
        // a single figure typed against the photo would contradict that.
        const patch: Record<string, unknown> = {};
        if (variants.length) {
          patch.variants = variants;
          patch.stock = variants.reduce((total, variant) => total + variant.stock, 0);
          const required = ['size', 'color']
            .filter((key) => variants.length > 1
              && variants.every((variant) => (variant.attributes as Record<string, string>)[key]));
          patch.customData = { ...(product.customData ?? {}), requiredOptions: required };
        }
        if (discount !== undefined && discount !== null && String(discount) !== '') {
          patch.discountReferencePrice = Number(discount);
        }
        await this.products.update(product.id, patch as never);
      }
      return { id: product.id, name: product.name };
    }

    if (session.kind === 'HOTEL_ROOM') {
      // A photo is usually of a room type, and a hotel has several identical
      // rooms, so one photo can become several. Without numbers it becomes
      // one room named by the answer.
      const numbers = Array.isArray(answers.roomNumbers)
        ? (answers.roomNumbers as unknown[]).map((value) => String(value ?? '').trim()).filter(Boolean)
        : [];
      const roomNumbers = numbers.length ? numbers : [name];
      const base = {
        ownerId: session.ownerId,
        hotelId: session.contextId ?? null,
        type: String(answers.roomType ?? 'Double'),
        rate: price,
        currency: 'TZS',
        capacity: Math.max(1, Math.floor(Number(answers.capacity ?? 2))),
        status: 'available' as const,
        imageUrl,
      };

      return this.rooms.manager.transaction(async (tx) => {
        const repo = tx.getRepository(HotelRoom);
        // Serialise room-number checks for this owner, including across two
        // photos being described at once: a check followed by an insert is a
        // race, and two rooms called 101 cannot both be booked.
        await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`intake-rooms:${session.ownerId}`]);
        const clash = await repo.findOne({
          where: { ownerId: session.ownerId, roomNumber: In(roomNumbers) },
        });
        if (clash) {
          throw new BadRequestException(`Room ${clash.roomNumber} already exists. Use another number.`);
        }
        const created = await repo.save(
          roomNumbers.map((roomNumber) => repo.create({ ...base, roomNumber } as Partial<HotelRoom>)),
        );
        return {
          id: created[0].id,
          name: created.length > 1 ? `${created.length} rooms (${roomNumbers.join(', ')})` : created[0].roomNumber,
        };
      });
    }

    const dish = await this.menu.save(this.menu.create({
      ownerId: session.ownerId,
      hotelId: session.contextId ?? null,
      name,
      category: String(answers.category ?? 'Mains'),
      price,
      currency: 'TZS',
      available: true,
      imageUrl,
    } as Partial<HotelMenuItem>));
    return { id: dish.id, name: dish.name };
  }
}
