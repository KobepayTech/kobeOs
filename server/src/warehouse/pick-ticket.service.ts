import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { PickTicketStatus, WarehousePickTicket, WarehousePickTicketItem } from './pick-ticket.entity';
import { WarehouseItem, WarehouseMovement } from './warehouse.entity';
import { UpdatePickTicketStatusDto } from './dto/pick-ticket.dto';

export interface PickTicketLineInput {
  sku: string;
  name: string;
  quantity: number;
}

export interface CreatePickTicketInput {
  ticketNumber: string;
  orderId?: string | null;
  customerName?: string | null;
  lines: PickTicketLineInput[];
}

const ALLOWED_TRANSITIONS: Record<PickTicketStatus, PickTicketStatus[]> = {
  PENDING: ['PICKING', 'CANCELLED'],
  PICKING: ['PACKED', 'CANCELLED'],
  PACKED: ['DISPATCHED', 'CANCELLED'],
  DISPATCHED: [],
  CANCELLED: [],
};

@Injectable()
export class PickTicketService {
  constructor(
    @InjectRepository(WarehousePickTicket) private readonly tickets: Repository<WarehousePickTicket>,
    @InjectRepository(WarehousePickTicketItem) private readonly items: Repository<WarehousePickTicketItem>,
  ) {}

  /**
   * Create a pick ticket within an existing transaction. Called by the POS
   * order flow so the ticket + warehouse stock deduction commit atomically
   * with the sale. Also records a WarehouseMovement OUT for every SKU that
   * exists in the warehouse so inventory stays consistent across modules.
   */
  async createInTransaction(tx: EntityManager, uid: string, input: CreatePickTicketInput) {
    const ticketRepo = tx.getRepository(WarehousePickTicket);
    const itemRepo = tx.getRepository(WarehousePickTicketItem);
    const warehouseRepo = tx.getRepository(WarehouseItem);
    const movementRepo = tx.getRepository(WarehouseMovement);

    // Resolve the warehouse from the first matching SKU so multi-warehouse
    // shops route pick tickets to whichever site holds the stock.
    let resolvedWarehouseId: string | null = null;
    for (const line of input.lines) {
      const first = await warehouseRepo.findOne({ where: { sku: line.sku, ownerId: uid } });
      if (first?.warehouseId) { resolvedWarehouseId = first.warehouseId; break; }
    }

    const ticket = await ticketRepo.save(
      ticketRepo.create({
        ownerId: uid,
        ticketNumber: input.ticketNumber,
        orderId: input.orderId ?? null,
        warehouseId: resolvedWarehouseId,
        customerName: input.customerName ?? null,
        status: 'PENDING',
      }),
    );

    const ticketItems: WarehousePickTicketItem[] = [];
    for (const line of input.lines) {
      const wh = await warehouseRepo.findOne({ where: { sku: line.sku, ownerId: uid } });
      ticketItems.push(
        itemRepo.create({
          ownerId: uid,
          ticketId: ticket.id,
          sku: line.sku,
          name: line.name,
          quantity: line.quantity,
          location: wh?.location ?? null,
        }),
      );

      if (wh) {
        wh.quantity = Number(wh.quantity) - line.quantity;
        await warehouseRepo.save(wh);
        await movementRepo.save(
          movementRepo.create({
            ownerId: uid,
            itemId: wh.id,
            type: 'OUT',
            quantity: line.quantity,
            reference: input.ticketNumber,
            note: `POS pick ticket ${input.ticketNumber}`,
          }),
        );
      }
    }
    await itemRepo.save(ticketItems);

    return { ...ticket, items: ticketItems };
  }

  list(uid: string, status?: PickTicketStatus) {
    return this.tickets.find({
      where: status ? { ownerId: uid, status } : { ownerId: uid },
      order: { createdAt: 'DESC' },
    });
  }

  async get(uid: string, id: string) {
    const ticket = await this.tickets.findOne({ where: { id, ownerId: uid } });
    if (!ticket) throw new NotFoundException();
    const items = await this.items.find({ where: { ticketId: id, ownerId: uid } });
    return { ...ticket, items };
  }

  async updateStatus(uid: string, id: string, dto: UpdatePickTicketStatusDto) {
    const ticket = await this.tickets.findOne({ where: { id, ownerId: uid } });
    if (!ticket) throw new NotFoundException();
    const allowed = ALLOWED_TRANSITIONS[ticket.status];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(`Cannot transition from ${ticket.status} to ${dto.status}`);
    }
    ticket.status = dto.status;
    if (dto.pickedBy !== undefined) ticket.pickedBy = dto.pickedBy;
    if (dto.note !== undefined) ticket.note = dto.note;
    return this.tickets.save(ticket);
  }
}
