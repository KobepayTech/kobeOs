import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Warehouse } from './warehouse.entity';
import { CreateWarehouseDto, UpdateWarehouseDto } from './dto/warehouse.dto';

@Injectable()
export class WarehousesService {
  constructor(@InjectRepository(Warehouse) private readonly repo: Repository<Warehouse>) {}

  list(uid: string) {
    return this.repo.find({ where: { ownerId: uid }, order: { isDefault: 'DESC', name: 'ASC' } });
  }

  async get(uid: string, id: string) {
    const wh = await this.repo.findOne({ where: { id, ownerId: uid } });
    if (!wh) throw new NotFoundException();
    return wh;
  }

  async create(uid: string, dto: CreateWarehouseDto) {
    if (dto.isDefault) await this.clearDefault(this.repo, uid);
    return this.repo.save(this.repo.create({ ...dto, ownerId: uid }));
  }

  async update(uid: string, id: string, dto: UpdateWarehouseDto) {
    const wh = await this.get(uid, id);
    if (dto.isDefault) await this.clearDefault(this.repo, uid);
    Object.assign(wh, dto);
    return this.repo.save(wh);
  }

  async remove(uid: string, id: string) {
    const wh = await this.get(uid, id);
    if (wh.isDefault) {
      throw new BadRequestException('Cannot delete the default warehouse; promote another first');
    }
    await this.repo.remove(wh);
    return { id };
  }

  /**
   * Return the user's default warehouse, creating a "Main" warehouse on
   * the fly the first time it's needed. Used by item create + pick ticket
   * create so single-warehouse users never have to think about it.
   */
  async getOrCreateDefault(tx: EntityManager, uid: string): Promise<Warehouse> {
    const repo = tx.getRepository(Warehouse);
    const existing = await repo.findOne({ where: { ownerId: uid, isDefault: true } });
    if (existing) return existing;
    return repo.save(
      repo.create({
        ownerId: uid,
        code: 'MAIN',
        name: 'Main Warehouse',
        location: '',
        isDefault: true,
        active: true,
      }),
    );
  }

  private async clearDefault(repo: Repository<Warehouse>, uid: string) {
    await repo.update({ ownerId: uid, isDefault: true }, { isDefault: false });
  }
}
