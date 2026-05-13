import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FsNode } from './file.entity';
import { CreateNodeDto, MoveNodeDto, UpdateNodeDto } from './dto/file.dto';

function normalize(p: string): string {
  if (!p.startsWith('/')) p = '/' + p;
  return p.replace(/\/+$/g, '') || '/';
}

function parentOf(p: string): string | null {
  const n = normalize(p);
  if (n === '/') return null;
  const idx = n.lastIndexOf('/');
  return idx <= 0 ? '/' : n.slice(0, idx);
}

function basename(p: string): string {
  const n = normalize(p);
  if (n === '/') return '/';
  return n.slice(n.lastIndexOf('/') + 1);
}

@Injectable()
export class FilesService {
  constructor(@InjectRepository(FsNode) private readonly repo: Repository<FsNode>) {}

  list(ownerId: string, parentPath = '/') {
    return this.repo.find({
      where: { ownerId, parentPath: normalize(parentPath) },
      order: { type: 'ASC', name: 'ASC' },
    });
  }

  async get(ownerId: string, path: string) {
    const node = await this.repo.findOne({ where: { ownerId, path: normalize(path) } });
    if (!node) throw new NotFoundException('Not found');
    return node;
  }

  /** Create `path` (and any missing ancestors) as directories, idempotently. */
  async ensureDir(ownerId: string, path: string): Promise<void> {
    const resolved = normalize(path);
    if (resolved === '/') return;
    const segments = resolved.slice(1).split('/');
    let acc = '';
    for (const seg of segments) {
      acc += '/' + seg;
      const existing = await this.repo.findOne({ where: { ownerId, path: acc } });
      if (existing) {
        if (existing.type !== 'directory') throw new BadRequestException(`${acc} is not a directory`);
        continue;
      }
      await this.repo.save(
        this.repo.create({
          ownerId,
          path: acc,
          parentPath: parentOf(acc),
          name: basename(acc),
          type: 'directory',
        }),
      );
    }
  }

  async create(ownerId: string, dto: CreateNodeDto) {
    const path = normalize(dto.path);
    const existing = await this.repo.findOne({ where: { ownerId, path } });
    if (existing) throw new ConflictException('Path already exists');

    const parentPath = parentOf(path);
    if (parentPath && parentPath !== '/') {
      const parent = await this.repo.findOne({ where: { ownerId, path: parentPath } });
      if (!parent) throw new BadRequestException('Parent directory does not exist');
      if (parent.type !== 'directory') throw new BadRequestException('Parent is not a directory');
    }

    const node = this.repo.create({
      ownerId,
      path,
      parentPath,
      name: basename(path),
      type: dto.type,
      mimeType: dto.mimeType ?? null,
      content: dto.type === 'file' ? dto.content ?? null : null,
      contentBinary: dto.type === 'file' && dto.contentBase64 ? Buffer.from(dto.contentBase64, 'base64') : null,
      size: dto.content ? dto.content.length : dto.contentBase64 ? Buffer.from(dto.contentBase64, 'base64').length : 0,
    });
    return this.repo.save(node);
  }

  async update(ownerId: string, path: string, dto: UpdateNodeDto) {
    const node = await this.get(ownerId, path);
    if (node.type !== 'file') throw new BadRequestException('Cannot write to a directory');
    if (dto.content !== undefined) {
      node.content = dto.content;
      node.contentBinary = null;
      node.size = dto.content.length;
    }
    if (dto.contentBase64 !== undefined) {
      const buf = Buffer.from(dto.contentBase64, 'base64');
      node.contentBinary = buf;
      node.content = null;
      node.size = buf.length;
    }
    if (dto.mimeType !== undefined) node.mimeType = dto.mimeType;
    return this.repo.save(node);
  }

  async remove(ownerId: string, path: string) {
    const node = await this.get(ownerId, path);
    if (node.type === 'directory') {
      const descendants = await this.repo
        .createQueryBuilder('n')
        .where('n.ownerId = :ownerId', { ownerId })
        .andWhere('n.path LIKE :prefix', { prefix: `${node.path}/%` })
        .getMany();
      await this.repo.remove([...descendants, node]);
    } else {
      await this.repo.remove(node);
    }
    return { path: node.path };
  }

  /**
   * Upload (or overwrite) a file at `path` using the bytes from a multipart
   * upload. Auto-creates the parent if it doesn't exist yet.
   */
  async upload(
    ownerId: string,
    path: string,
    file: { originalname: string; mimetype: string; buffer: Buffer; size: number },
  ) {
    const resolved = normalize(path);
    const parentPath = parentOf(resolved);
    if (parentPath && parentPath !== '/') {
      // Auto-create the parent chain so uploads can drop files into a path
      // without forcing the caller to mkdir every intermediate folder first.
      await this.ensureDir(ownerId, parentPath);
    }
    const existing = await this.repo.findOne({ where: { ownerId, path: resolved } });
    if (existing) {
      if (existing.type !== 'file') {
        throw new BadRequestException('Path is a directory');
      }
      existing.mimeType = file.mimetype;
      existing.contentBinary = file.buffer;
      existing.content = null;
      existing.size = file.size;
      return this.repo.save(existing);
    }
    return this.repo.save(
      this.repo.create({
        ownerId,
        path: resolved,
        parentPath,
        name: basename(resolved),
        type: 'file',
        mimeType: file.mimetype,
        contentBinary: file.buffer,
        size: file.size,
      }),
    );
  }

  async readBlob(ownerId: string, path: string): Promise<FsNode> {
    const node = await this.get(ownerId, path);
    if (node.type !== 'file') throw new BadRequestException('Not a file');
    return node;
  }

  async move(ownerId: string, path: string, dto: MoveNodeDto) {
    const node = await this.get(ownerId, path);
    const toPath = normalize(dto.toPath);
    if (await this.repo.findOne({ where: { ownerId, path: toPath } })) {
      throw new ConflictException('Destination already exists');
    }
    if (node.type === 'directory') {
      const descendants = await this.repo
        .createQueryBuilder('n')
        .where('n.ownerId = :ownerId', { ownerId })
        .andWhere('n.path LIKE :prefix', { prefix: `${node.path}/%` })
        .getMany();
      for (const d of descendants) {
        d.path = toPath + d.path.slice(node.path.length);
        d.parentPath = parentOf(d.path);
      }
      node.path = toPath;
      node.parentPath = parentOf(toPath);
      node.name = basename(toPath);
      await this.repo.save([node, ...descendants]);
    } else {
      node.path = toPath;
      node.parentPath = parentOf(toPath);
      node.name = basename(toPath);
      await this.repo.save(node);
    }
    return node;
  }
}
