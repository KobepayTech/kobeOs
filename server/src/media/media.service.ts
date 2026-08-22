import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, timingSafeEqual } from 'crypto';
import { Repository } from 'typeorm';
import { MediaAsset, Playlist } from './media.entity';
import { OwnedCrudService } from '../common/owned.service';

@Injectable()
export class MediaAssetsService extends OwnedCrudService<MediaAsset> {
  constructor(@InjectRepository(MediaAsset) repo: Repository<MediaAsset>) {
    super(repo);
  }

  listByKind(uid: string, kind: MediaAsset['kind']) {
    return this.repo.find({ where: { ownerId: uid, kind }, order: { createdAt: 'DESC' } });
  }

  async createFromUpload(
    uid: string,
    file: { originalname: string; mimetype: string; buffer: Buffer; size: number },
    kind: MediaAsset['kind'] = 'audio',
  ): Promise<MediaAsset> {
    const asset = this.repo.create({
      ownerId: uid,
      kind,
      name: file.originalname,
      mimeType: file.mimetype,
      src: '', // patched after save once the id is known
      contentBinary: file.buffer,
      size: file.size,
    });
    const saved = await this.repo.save(asset);
    saved.src = `/api/media/blob/${saved.id}`;
    return this.repo.save(saved);
  }

  async getBlob(uid: string, id: string): Promise<MediaAsset> {
    const asset = await this.repo.findOne({ where: { id, ownerId: uid } });
    if (!asset || !asset.contentBinary) throw new NotFoundException();
    return asset;
  }

  private signingSecret(): string {
    const secret = (process.env.MEDIA_PUBLIC_SIGNING_SECRET || process.env.JWT_SECRET || '').trim();
    if (!secret) throw new BadRequestException('Media public delivery is not configured');
    return secret;
  }

  private sign(id: string, exp: number): string {
    return createHmac('sha256', this.signingSecret()).update(`${id}.${exp}`).digest('base64url');
  }

  /**
   * Create a short-lived, unauthenticated URL for a private uploaded asset.
   * Social networks need to fetch media from a public HTTPS URL when publishing
   * on the owner's behalf, but the asset itself remains private at rest.
   */
  async createPublicUrl(uid: string, id: string, ttlSeconds = 3600): Promise<string> {
    const asset = await this.getBlob(uid, id);
    if (!asset.contentBinary) throw new NotFoundException();
    const base = (process.env.APP_PUBLIC_URL || '').trim().replace(/\/$/, '');
    if (!base) throw new BadRequestException('APP_PUBLIC_URL is required for social publishing');
    const ttl = Math.min(24 * 60 * 60, Math.max(60, Number(ttlSeconds) || 3600));
    const exp = Math.floor(Date.now() / 1000) + ttl;
    const sig = this.sign(id, exp);
    return `${base}/api/media/public/${encodeURIComponent(id)}?exp=${exp}&sig=${encodeURIComponent(sig)}`;
  }

  /** Resolve a signed public-delivery request without exposing the owner JWT. */
  async getPublicBlob(id: string, expRaw: string, signature: string): Promise<MediaAsset> {
    const exp = Number(expRaw);
    if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
      throw new BadRequestException('Media delivery URL has expired');
    }
    if (exp > Math.floor(Date.now() / 1000) + 24 * 60 * 60 + 60) {
      throw new BadRequestException('Invalid media delivery expiry');
    }
    const expected = this.sign(id, exp);
    const a = Buffer.from(String(signature || ''));
    const b = Buffer.from(expected);
    if (!a.length || a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new BadRequestException('Invalid media delivery signature');
    }
    const asset = await this.repo.findOne({ where: { id } });
    if (!asset || !asset.contentBinary) throw new NotFoundException();
    return asset;
  }
}

@Injectable()
export class PlaylistsService extends OwnedCrudService<Playlist> {
  constructor(@InjectRepository(Playlist) repo: Repository<Playlist>) {
    super(repo);
  }
}
