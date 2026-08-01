import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { DeveloperProject } from './developer-project.entity';
import { CreateDeveloperProjectDto } from './dto/developer-project.dto';

export interface DeveloperProjectView {
  id: string;
  name: string;
  slug: string;
  keyPrefix: string;
  allowedOrigins: string[];
  status: 'active' | 'suspended';
  usageCount: number;
  lastUsedAt: number | null;
  createdAt: number;
}

@Injectable()
export class DeveloperPlatformService {
  constructor(
    @InjectRepository(DeveloperProject)
    private readonly repo: Repository<DeveloperProject>,
  ) {}

  private hash(raw: string) {
    return createHash('sha256').update(raw).digest('hex');
  }

  private issueKey() {
    return `kobe_sk_${randomBytes(32).toString('base64url')}`;
  }

  private slugify(name: string) {
    const base = name.toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'app';
    return `${base}-${randomBytes(3).toString('hex')}`;
  }

  private view(project: DeveloperProject): DeveloperProjectView {
    return {
      id: project.id,
      name: project.name,
      slug: project.slug,
      keyPrefix: project.apiKeyPrefix,
      allowedOrigins: project.allowedOrigins ?? [],
      status: project.status,
      usageCount: project.usageCount,
      lastUsedAt: project.lastUsedAt?.getTime() ?? null,
      createdAt: project.createdAt.getTime(),
    };
  }

  async list(userId: string): Promise<DeveloperProjectView[]> {
    const projects = await this.repo.find({ where: { userId }, order: { createdAt: 'DESC' } });
    return projects.map((project) => this.view(project));
  }

  async create(userId: string, dto: CreateDeveloperProjectDto) {
    const apiKey = this.issueKey();
    const allowedOrigins = (dto.allowedOrigins ?? []).map((origin) => new URL(origin).origin);
    const project = await this.repo.save(this.repo.create({
      userId,
      name: dto.name.trim(),
      slug: this.slugify(dto.name),
      apiKeyHash: this.hash(apiKey),
      apiKeyPrefix: `${apiKey.slice(0, 15)}…`,
      allowedOrigins,
      status: 'active',
      usageCount: 0,
    }));
    return { project: this.view(project), apiKey };
  }

  async rotate(userId: string, projectId: string) {
    const project = await this.repo.findOne({ where: { id: projectId, userId } });
    if (!project) throw new NotFoundException('Developer project not found.');
    const apiKey = this.issueKey();
    project.apiKeyHash = this.hash(apiKey);
    project.apiKeyPrefix = `${apiKey.slice(0, 15)}…`;
    await this.repo.save(project);
    return { project: this.view(project), apiKey };
  }

  async authenticate(authorization?: string, requestOrigin?: string): Promise<DeveloperProject> {
    const raw = authorization?.replace(/^Bearer\s+/i, '').trim() ?? '';
    if (!raw.startsWith('kobe_sk_')) {
      throw new UnauthorizedException('A Kobe developer API key is required.');
    }
    const project = await this.repo.findOne({ where: { apiKeyHash: this.hash(raw) } });
    if (!project || project.status !== 'active') {
      throw new UnauthorizedException('Developer API key is invalid or suspended.');
    }
    if (requestOrigin) {
      let origin: string;
      try {
        origin = new URL(requestOrigin).origin;
      } catch {
        throw new ForbiddenException('The request origin is invalid.');
      }
      if (!project.allowedOrigins?.includes(origin)) {
        throw new ForbiddenException(
          'This web origin is not allowed for the developer project.',
        );
      }
    }
    project.usageCount += 1;
    project.lastUsedAt = new Date();
    await this.repo.save(project);
    return project;
  }
}
