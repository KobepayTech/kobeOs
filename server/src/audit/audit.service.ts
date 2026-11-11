import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AuditLog } from './audit.entity';

@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>) {}

  async log(data: Omit<AuditLog, 'id' | 'createdAt'>, manager?: EntityManager): Promise<AuditLog> {
    const repo = manager ? manager.getRepository(AuditLog) : this.repo;
    return repo.save(repo.create(data));
  }

  async findByEntity(entityType: string, entityId: string, limit = 50) {
    return this.repo.find({
      where: { entityType, entityId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async findByUser(userId: string, limit = 50) {
    return this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
