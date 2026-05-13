import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MediaAsset, Playlist } from './media.entity';
import { OwnedCrudService } from '../common/owned.service';

@Injectable()
export class MediaAssetsService extends OwnedCrudService<MediaAsset> {
  constructor(@InjectRepository(MediaAsset) repo: Repository<MediaAsset>) { super(repo); }
  listByKind(uid: string, kind: MediaAsset['kind']) {
    return this.repo.find({ where: { ownerId: uid, kind }, order: { createdAt: 'DESC' } });
  }
}

@Injectable()
export class PlaylistsService extends OwnedCrudService<Playlist> {
  constructor(@InjectRepository(Playlist) repo: Repository<Playlist>) { super(repo); }
}
