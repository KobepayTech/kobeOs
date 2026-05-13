import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { WarehouseItem, WarehouseMovement } from './warehouse.entity';
import { CreateItemDto, MovementDto, UpdateItemDto } from './dto/warehouse.dto';
import { OwnedCrudService } from '../common/owned.service';

@Injectable()
export class WarehouseItemsService extends OwnedCrudService<WarehouseItem> {
  constructor(@InjectRepository(WarehouseItem) repo: Repository<WarehouseItem>) { super(repo); }
}

@Injectable()
export class MovementsService {
  constructor(
    @InjectRepository(WarehouseItem) private readonly items: Repository<WarehouseItem>,
    @InjectRepository(WarehouseMovement) private readonly movements: Repository<WarehouseMovement>,
    private readonly ds: DataSource,
  ) {}

  list(uid: string) {
    return this.movements.find({ where: { ownerId: uid }, order: { createdAt: 'DESC' } });
  }

  async record(uid: string, dto: MovementDto) {
    return this.ds.transaction(async (tx) => {
      const itemRepo = tx.getRepository(WarehouseItem);
      const movRepo = tx.getRepository(WarehouseMovement);
      const item = await itemRepo.findOne({ where: { id: dto.itemId, ownerId: uid } });
      if (!item) throw new NotFoundException('Item not found');

      const delta =
        dto.type === 'IN' ? dto.quantity :
        dto.type === 'OUT' ? -dto.quantity :
        dto.quantity - item.quantity;

      if (item.quantity + delta < 0) throw new BadRequestException('Insufficient stock');
      item.quantity += delta;
      await itemRepo.save(item);

      return movRepo.save(movRepo.create({ ...dto, ownerId: uid }));
    });
  }
}

export { CreateItemDto, UpdateItemDto };
