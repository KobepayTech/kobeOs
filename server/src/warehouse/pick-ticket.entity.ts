import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

export type PickTicketStatus = 'PENDING' | 'PICKING' | 'PACKED' | 'DISPATCHED' | 'CANCELLED';

@Entity('warehouse_pick_tickets')
export class WarehousePickTicket extends OwnedEntity {
  @Index()
  @Column()
  ticketNumber!: string;

  @Index()
  @Column('uuid', { nullable: true })
  orderId?: string | null;

  @Column({ default: 'PENDING' })
  status!: PickTicketStatus;

  @Column({ nullable: true, type: 'varchar' })
  customerName?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  pickedBy?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  note?: string | null;
}

@Entity('warehouse_pick_ticket_items')
export class WarehousePickTicketItem extends OwnedEntity {
  @Index()
  @Column('uuid')
  ticketId!: string;

  @Column()
  sku!: string;

  @Column()
  name!: string;

  @Column()
  quantity!: number;

  @Column({ nullable: true, type: 'varchar' })
  location?: string | null;

  @Column({ default: false })
  picked!: boolean;
}
