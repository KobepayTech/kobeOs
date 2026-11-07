import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { assertOwnerAction } from '../business-foundations/business-scope';
import { MovementsService } from './warehouse.service';
import { WarehouseItem } from './warehouse.entity';
import { StockTransfer } from './stock-transfer.entity';

@Injectable()
export class StockTransferService {
  constructor(private readonly db: DataSource, private readonly movements: MovementsService) {}
  async transfer(ownerId: string, role: string, input: { requestKey: string; fromItemId: string; toItemId: string; quantity: number }) {
    assertOwnerAction(ownerId, ownerId, role);
    if (!input.requestKey?.trim() || input.requestKey.length > 100 || !Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 2147483647 || input.fromItemId === input.toItemId) {
      throw new BadRequestException('Choose two stock records, a positive whole quantity and a request ID.');
    }
    return this.db.transaction(async tx => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [JSON.stringify(['stock-transfer', ownerId, input.requestKey])]);
      const prior = await tx.findOne(StockTransfer, { where: { ownerId, requestKey: input.requestKey } });
      if (prior) {
        if (prior.fromItemId !== input.fromItemId || prior.toItemId !== input.toItemId || prior.quantity !== input.quantity) throw new ConflictException('Request ID already used for another transfer.');
        return prior;
      }
      const records = new Map<string, WarehouseItem>();
      for (const id of [input.fromItemId, input.toItemId].sort()) {
        const row = await tx.findOne(WarehouseItem, { where: { id, ownerId }, lock: { mode: 'pessimistic_write' } });
        if (!row) throw new NotFoundException('Stock record not found.');
        records.set(id, row);
      }
      const from = records.get(input.fromItemId)!;
      const to = records.get(input.toItemId)!;
      if (from.sku !== to.sku || from.unit !== to.unit || !from.sku.trim()) throw new BadRequestException('Transfers require matching SKU and stock unit.');
      if (!from.warehouseId || !to.warehouseId || from.warehouseId === to.warehouseId) throw new BadRequestException('Choose records in two different warehouses.');
      if (to.quantity + input.quantity > 2147483647) throw new BadRequestException('Destination quantity exceeds the supported range.');
      const transfer = await tx.save(StockTransfer, { ownerId, ...input });
      await this.movements.recordInTransaction(tx, ownerId, { itemId: from.id, type: 'OUT', quantity: input.quantity, reference: `transfer:${transfer.id}` });
      await this.movements.recordInTransaction(tx, ownerId, { itemId: to.id, type: 'IN', quantity: input.quantity, reference: `transfer:${transfer.id}` });
      return transfer;
    });
  }
}
