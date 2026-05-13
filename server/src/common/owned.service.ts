import { NotFoundException } from '@nestjs/common';
import { DeepPartial, FindOptionsOrder, FindOptionsWhere, Repository } from 'typeorm';
import { OwnedEntity } from './owned.entity';

export interface ListOptions<T> {
  page?: number;
  limit?: number;
  where?: FindOptionsWhere<T>;
}

export abstract class OwnedCrudService<T extends OwnedEntity> {
  protected constructor(protected readonly repo: Repository<T>) {}

  protected defaultOrder(): FindOptionsOrder<T> {
    return { createdAt: 'DESC' } as FindOptionsOrder<T>;
  }

  list(ownerId: string, options: ListOptions<T> = {}) {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 50));
    return this.repo.find({
      where: { ...(options.where ?? {}), ownerId } as FindOptionsWhere<T>,
      order: this.defaultOrder(),
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  count(ownerId: string, where?: FindOptionsWhere<T>) {
    return this.repo.count({ where: { ...(where ?? {}), ownerId } as FindOptionsWhere<T> });
  }

  async get(ownerId: string, id: string) {
    const item = await this.repo.findOne({
      where: { id, ownerId } as FindOptionsWhere<T>,
    });
    if (!item) throw new NotFoundException();
    return item;
  }

  create(ownerId: string, data: DeepPartial<T>) {
    const entity = this.repo.create({ ...data, ownerId } as DeepPartial<T>);
    return this.repo.save(entity);
  }

  async update(ownerId: string, id: string, data: DeepPartial<T>) {
    const existing = await this.get(ownerId, id);
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      if (v !== undefined) (existing as Record<string, unknown>)[k] = v;
    }
    return this.repo.save(existing);
  }

  async remove(ownerId: string, id: string) {
    const existing = await this.get(ownerId, id);
    await this.repo.remove(existing);
    return { id };
  }
}
