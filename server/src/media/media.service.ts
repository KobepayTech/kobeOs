import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
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
}

@Injectable()
export class PlaylistsService extends OwnedCrudService<Playlist> {
  constructor(@InjectRepository(Playlist) repo: Repository<Playlist>) {
    super(repo);
  }
}
