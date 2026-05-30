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
