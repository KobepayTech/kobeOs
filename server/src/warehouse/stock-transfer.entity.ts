import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';
@Entity('warehouse_stock_transfers')
@Index('UQ_stock_transfer_source', ['ownerId', 'requestKey'], { unique: true })
export class StockTransfer extends OwnedEntity {
  @Column({ length: 100 }) requestKey!: string;
  @Column('uuid') fromItemId!: string;
  @Column('uuid') toItemId!: string;
  @Column('integer') quantity!: number;
}
