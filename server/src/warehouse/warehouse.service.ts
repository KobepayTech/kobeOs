import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { WarehouseItem, WarehouseMovement } from './warehouse.entity';
import { CreateItemDto, MovementDto, UpdateItemDto } from './dto/warehouse.dto';
import { OwnedCrudService } from '../common/owned.service';
import { WarehousesService } from './warehouses.service';
import { PlatformEventsService } from '../platform/platform.service';

@Injectable()
export class WarehouseItemsService extends OwnedCrudService<WarehouseItem> {
  constructor(
    @InjectRepository(WarehouseItem) repo: Repository<WarehouseItem>,
    private readonly warehouses: WarehousesService,
    private readonly ds: DataSource,
  ) { super(repo); }

  /** Auto-assign the default warehouse when the caller doesn't pick one. */
  async create(uid: string, dto: CreateItemDto): Promise<WarehouseItem> {
    return this.ds.transaction(async (tx) => {
      const warehouseId = dto.warehouseId
        ?? (await this.warehouses.getOrCreateDefault(tx, uid)).id;
      const repo = tx.getRepository(WarehouseItem);
      return repo.save(repo.create({ ...dto, warehouseId, ownerId: uid }));
    });
  }

  listByWarehouse(uid: string, warehouseId?: string) {
    return super.list(uid, warehouseId ? { where: { warehouseId } } : {});
  }
}

@Injectable()
export class MovementsService {
  constructor(
    @InjectRepository(WarehouseItem) private readonly items: Repository<WarehouseItem>,
    @InjectRepository(WarehouseMovement) private readonly movements: Repository<WarehouseMovement>,
    private readonly ds: DataSource,
    private readonly events: PlatformEventsService,
  ) {}

  list(uid: string) {
    return this.movements.find({ where: { ownerId: uid }, order: { createdAt: 'DESC' } });
  }

  async record(uid: string, dto: MovementDto) {
    return this.ds.transaction(tx => this.recordInTransaction(tx, uid, dto));
  }

  async recordInTransaction(tx: EntityManager, uid: string, dto: MovementDto) {
      if (!['IN', 'OUT', 'ADJUST'].includes(dto.type) || !Number.isInteger(dto.quantity) || dto.quantity < 0 || dto.quantity > 2147483647) throw new BadRequestException('Invalid stock movement quantity or type');
      if (!tx.queryRunner?.isTransactionActive) throw new BadRequestException('Stock movements require an active transaction');
      const itemRepo = tx.getRepository(WarehouseItem);
      const movRepo = tx.getRepository(WarehouseMovement);
      const item = await itemRepo.findOne({ where: { id: dto.itemId, ownerId: uid }, lock: { mode: 'pessimistic_write' } });
      if (!item) throw new NotFoundException('Item not found');

      const delta =
        dto.type === 'IN' ? dto.quantity :
        dto.type === 'OUT' ? -dto.quantity :
        dto.quantity - item.quantity;

      if (item.quantity + delta < 0) throw new BadRequestException('Insufficient stock');
      const previousQuantity = item.quantity;
      item.quantity += delta;
      await itemRepo.save(item);

      const movement = await movRepo.save(movRepo.create({ ...dto, ownerId: uid }));
      const payload = { itemId: item.id, movementId: movement.id, previousQuantity, quantity: item.quantity, reorderLevel: item.reorderLevel };
      await this.events.recordInTransaction(tx, { ownerId: uid, eventName: 'inventory.stock.changed', aggregateType: 'WarehouseItem', aggregateId: item.id, idempotencyKey: `movement:${movement.id}`, correlationId: movement.id, payload });
      if (previousQuantity > item.reorderLevel && item.quantity <= item.reorderLevel) {
        await this.events.recordInTransaction(tx, { ownerId: uid, eventName: 'inventory.stock.low', aggregateType: 'WarehouseItem', aggregateId: item.id, idempotencyKey: `movement:${movement.id}`, correlationId: movement.id, payload });
      }
      return movement;
  }
}

export { CreateItemDto, UpdateItemDto };
