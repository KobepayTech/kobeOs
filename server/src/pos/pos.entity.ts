import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

@Entity('pos_products')
export class PosProduct extends OwnedEntity {
  @Index({ unique: false })
  @Column()
  sku!: string;

  @Column()
  name!: string;

  @Column({ default: '' })
  category!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  price!: number;

  @Column({ default: 'TZS' })
  currency!: string;

  @Column({ default: 0 })
  stock!: number;

  @Column({ default: 0 })
  reservedStock!: number;

  @Column({ nullable: true, type: 'varchar' })
  shelf?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  warehouseId?: string | null;

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

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  subtotal!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  taxAmount!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  discountAmount!: number;

  @Column({ nullable: true, type: 'varchar' })
  discountCode?: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  total!: number;

  @Column({ default: 'TZS' })
  currency!: string;

  @Column({ default: 'PENDING' })
  status!: 'PENDING' | 'COMPLETED' | 'REFUNDED' | 'CANCELLED';

  @Column({ default: 'CASH' })
  paymentMethod!: string;

  @Column({ default: false })
  bnplApproved!: boolean;

  @Column({ nullable: true, type: 'varchar' })
  bnplPlan?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  customerName?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  customerPhone?: string | null;

  @Column({ default: false })
  isBnpl!: boolean;

  @Index()
  @Column('uuid', { nullable: true })
  receivableId?: string | null;
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

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  unitPrice!: number;

  @Column({ default: 1 })
  quantity!: number;

  @Column({ nullable: true, type: 'varchar' })
  shelf?: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  lineTotal!: number;
}

@Entity('pos_customer_credit_profiles')
export class PosCustomerCreditProfile extends OwnedEntity {
  @Index()
  @Column()
  phone!: string;

  @Column({ nullable: true, type: 'varchar' })
  name?: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  creditLimit!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  usedCredit!: number;

  @Column({ default: 'B' })
  score!: 'A+' | 'A' | 'B' | 'C' | 'D';
}
