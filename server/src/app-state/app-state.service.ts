import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppState } from './app-state.entity';

@Injectable()
export class AppStateService {
  constructor(
    @InjectRepository(AppState) private readonly repo: Repository<AppState>,
  ) {}

  async get(ownerId: string, key: string): Promise<{ key: string; value: unknown; updatedAt: Date | null }> {
    const row = await this.repo.findOne({ where: { ownerId, key } });
    return { key, value: row ? row.value : null, updatedAt: row ? row.updatedAt : null };
  }

  async put(ownerId: string, key: string, value: unknown) {
    let row = await this.repo.findOne({ where: { ownerId, key } });
    if (!row) row = this.repo.create({ ownerId, key });
    row.value = value ?? {};
    const saved = await this.repo.save(row);
    return { key, value: saved.value, updatedAt: saved.updatedAt };
  }
}
