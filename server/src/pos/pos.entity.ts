import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

@Entity('pos_products')
export class PosProduct extends OwnedEntity {
  @Column()
  sku!: string;

  @Column()
  name!: string;

  @Column({ default: '' })
  category!: string;

  @Column({ type: 'float' })
  price!: number;

  @Column({ default: 'TZS' })
  currency!: string;

  @Column({ default: 0 })
  stock!: number;

  @Column({ nullable: true, type: 'varchar' })
  imageUrl?: string | null;

  @Column({ default: true })
  active!: boolean;
}

@Entity('pos_orders')
export class PosOrder extends OwnedEntity {
  @Index()
  @Column()
  orderNumber!: string;

  @Column({ type: 'float', default: 0 })
  subtotal!: number;

  @Column({ type: 'float', default: 0 })
  taxAmount!: number;

  @Column({ type: 'float', default: 0 })
  discountAmount!: number;

  @Column({ type: 'float', default: 0 })
  total!: number;

  @Column({ default: 'TZS' })
  currency!: string;

  @Column({ default: 'PENDING' })
  status!: 'PENDING' | 'COMPLETED' | 'REFUNDED' | 'CANCELLED';

  @Column({ default: 'CASH' })
  paymentMethod!: string;

  @Column({ nullable: true, type: 'varchar' })
  customerName?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  customerPhone?: string | null;
}

@Entity('pos_order_items')
export class PosOrderItem extends OwnedEntity {
  @Index()
  @Column('uuid')
  orderId!: string;

  @Index()
  @Column('uuid')
  productId!: string;

  @Column()
  productName!: string;

  @Column({ type: 'float' })
  unitPrice!: number;

  @Column({ default: 1 })
  quantity!: number;

  @Column({ type: 'float', default: 0 })
  lineTotal!: number;
}
