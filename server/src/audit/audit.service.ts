import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit.entity';

@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>) {}

  async log(data: Omit<AuditLog, 'id' | 'createdAt'>): Promise<AuditLog> {
    return this.repo.save(this.repo.create(data));
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
