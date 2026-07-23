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

  /** Unit of sale — drives how quantities are presented and entered.
   *  "piece" / "pcs" for everyday SKUs; "m", "kg", "litre", "bag",
   *  "sheet" for hardware where customers ask for fractional amounts
   *  ("2.5 m of cable"). Stored as a free-string so any vertical can
   *  add its own without a schema migration. */
  @Column({ default: 'piece' })
  unit!: string;

  /** Whether this SKU allows fractional quantities (decimal). False by
   *  default — most retail items are whole-count. Set true for cut-to-
   *  length cable, weight-priced cement, bulk fluids, etc. The mobile
   *  POS uses this to decide whether the qty input accepts decimals. */
  @Column({ default: false })
  decimalQuantity!: boolean;

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

  // Free-form extra attributes (bulk-import metadata: supplier, cost, sizes,
  // colours, subcategory, source, etc.). Keeps the core columns lean.
  @Column({ type: 'jsonb', default: {} })
  customData!: Record<string, unknown>;

  /** Jersey-specific product details — team, type, season, badges, size, kit type, name/number printing */
  @Column({ type: 'jsonb', default: {} })
  jerseyDetails!: {
    teamClub?: string;
    jerseyType?: 'fan' | 'match' | 'retro' | 'player' | 'kids';
    season?: string;
    badgeOptions?: string[];
    nameNumber?: string;
    size?: string;
    kitType?: 'jersey-only' | 'shorts-socks' | 'full-kit';
  };

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

  /** Where the order is in the fulfillment pipeline — drives the
   *  in-store / warehouse "Kitchen Display System" TV and the
   *  mobile-app order-prepare workflow. Independent of payment
   *  `status` above: an order can be COMPLETED (paid) but still
   *  NEW (not yet picked from shelves). */
  @Index()
  @Column({ default: 'NEW' })
  fulfillmentStatus!: 'NEW' | 'PREPARING' | 'READY' | 'COLLECTED';

  @Column({ type: 'timestamptz', nullable: true })
  preparingAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  readyAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  collectedAt?: Date | null;

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

  /** Quantity sold on this line. Decimal so cut-to-length / weight-based
   *  SKUs (cable in metres, cement in kg) work. Whole-number SKUs still
   *  store integers — the column type just doesn't prevent decimals. */
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 1 })
  quantity!: number;

  /** Snapshot of the product's unit at order time ("piece", "m", "kg",
   *  etc). Stored on the line so receipts + reports render correctly
   *  even if the catalog unit changes later. */
  @Column({ default: 'piece' })
  unit!: string;

  @Column({ nullable: true, type: 'varchar' })
  shelf?: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  lineTotal!: number;

  /** Negotiated unit price when a manager applied a per-line discount.
   *  Null = sold at catalog price. Stored so commission / loyalty /
   *  per-product margin reports can attribute the discount correctly
   *  instead of inferring from the aggregate order.discountAmount. */
  @Column({ type: 'decimal', precision: 18, scale: 4, nullable: true })
  negotiatedPrice?: number | null;
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
