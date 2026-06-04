import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

/**
 * Product variant — a single size/colour/style combo under one parent product.
 * Stored inline on PosProduct as JSON because variants are sparse and there's
 * no foreign-key access pattern (no joins, no per-variant indexes).
 */
export interface ProductVariant {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  price?: number;
  stock?: number;
  attributes?: Record<string, string>;
  imageUrl?: string;
}

@Entity('pos_products')
export class PosProduct extends OwnedEntity {
  @Index({ unique: false })
  @Column()
  sku!: string;

  @Column({ nullable: true, type: 'varchar' })
  barcode?: string | null;

  @Column()
  name!: string;

  @Column({ type: 'text', default: '' })
  description!: string;

  @Column({ default: '' })
  category!: string;

  @Column({ nullable: true, type: 'varchar' })
  brand?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  supplier?: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  price!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, nullable: true })
  compareAtPrice?: number | null;

  @Column({ type: 'decimal', precision: 18, scale: 4, nullable: true })
  cost?: number | null;

  @Column({ default: 'TZS' })
  currency!: string;

  @Column({ type: 'decimal', precision: 6, scale: 4, default: 0 })
  taxRate!: number;

  @Column({ default: 0 })
  stock!: number;

  @Column({ default: 0 })
  reservedStock!: number;

  /**
   * Cashier-visible estimate when warehouse hasn't reconciled yet, e.g. a
   * fresh container that hasn't been unloaded. The storefront uses this to
   * show "available soon" instead of "out of stock".
   */
  @Column({ default: 0 })
  estimatedStock!: number;

  @Column({ nullable: true, type: 'varchar' })
  shelf?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  warehouseId?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  imageUrl?: string | null;

  @Column({ type: 'jsonb', default: [] })
  imageUrls!: string[];

  @Column({ nullable: true, type: 'varchar' })
  videoUrl?: string | null;

  @Column({ type: 'jsonb', default: [] })
  variants!: ProductVariant[];

  @Column({ type: 'jsonb', default: [] })
  tags!: string[];

  @Column({ default: true })
  active!: boolean;

  @Column({ default: false })
  featured!: boolean;

  /** Drives the "New Arrivals" collection — set by the create endpoint. */
  @Column({ type: 'timestamptz', nullable: true })
  publishedAt?: Date | null;

  @Column({ default: 0 })
  unitsSold!: number;
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

  @Column({ type: 'text', nullable: true })
  receiptText?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  pickTicketId?: string | null;
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
