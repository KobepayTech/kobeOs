import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

@Entity('warehouses')
@Index(['ownerId', 'code'], { unique: true })
export class Warehouse extends OwnedEntity {
  @Column()
  code!: string;

  @Column()
  name!: string;

  @Column({ default: '' })
  location!: string;

  @Column({ default: false })
  isDefault!: boolean;

  @Column({ default: true })
  active!: boolean;
}

@Entity('warehouse_items')
export class WarehouseItem extends OwnedEntity {
  @Index()
  @Column('uuid', { nullable: true })
  warehouseId?: string | null;

  @Index({ unique: false })
  @Column()
  sku!: string;

  @Column()
  name!: string;

  @Column({ default: '' })
  category!: string;

  @Column({ default: 'pcs' })
  unit!: string;

  @Column({ default: 0 })
  quantity!: number;

  @Column({ default: 0 })
  reorderLevel!: number;

  @Column({ nullable: true, type: 'varchar' })
  location?: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  unitCost!: number;
}

@Entity('warehouse_movements')
export class WarehouseMovement extends OwnedEntity {
  @Index()
  @Column('uuid')
  itemId!: string;

  @Column()
  type!: 'IN' | 'OUT' | 'ADJUST';

  @Column()
  quantity!: number;

  @Column({ nullable: true, type: 'varchar' })
  reference?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  note?: string | null;
}
// NOTE: the WarehousePickTicket entity lives in ./pick-ticket.entity.ts — that is
// the one every service/module imports. A second, unused WarehousePickTicket that
// also mapped @Entity('warehouse_pick_tickets') used to sit here; because the
// entity glob still loaded it, two classes claimed the same table and corrupted
// schema generation. Removed as dead code so the table has one canonical shape.
