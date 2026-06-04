import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

/**
 * Records a batch of goods transferred from a warehouse to a shop.
 * The total value and piece count form the basis for value-ratio stock estimation.
 */
@Entity('shop_stock_allocations')
export class ShopStockAllocation extends OwnedEntity {
  /** Human-readable reference, e.g. "WH-DAR-2026-001" */
  @Index()
  @Column()
  allocationNumber!: string;

  @Column({ nullable: true, type: 'varchar' })
  shopId?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  shopName?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  warehouseId?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  warehouseName?: string | null;

  /** Total cost value of goods in this allocation (e.g. 20,000,000 TZS) */
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  totalValue!: number;

  /** Total piece count dispatched from warehouse */
  @Column({ default: 0 })
  totalPieces!: number;

  /**
   * Derived: totalValue / totalPieces.
   * Stored for fast reads; recalculated on every save.
   */
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  averagePieceValue!: number;

  @Column({ default: 'TZS' })
  currency!: string;

  @Column({ default: 'OPEN' })
  status!: 'OPEN' | 'CLOSED' | 'RECONCILED';

  @Column({ nullable: true, type: 'varchar' })
  notes?: string | null;
}

/**
 * A point-in-time snapshot of estimated stock for an allocation,
 * driven by cumulative sales value reported against that allocation.
 */
@Entity('shop_stock_estimates')
export class ShopStockEstimate extends OwnedEntity {
  @Index()
  @Column('uuid')
  allocationId!: string;

  /** Cumulative sales value applied against this allocation */
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  salesValue!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  estimatedSoldPieces!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  estimatedRemainingPieces!: number;

  /**
   * Positive when salesValue > allocation totalValue.
   * Represents revenue earned beyond the allocated goods cost.
   */
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  superProfit!: number;

  /** Always 'ESTIMATE' — signals this is not an exact count */
  @Column({ default: 'ESTIMATE' })
  accuracy!: 'ESTIMATE';
}

/**
 * Physical count reconciliation against an allocation's estimated stock.
 */
@Entity('shop_stock_reconciliations')
export class ShopStockReconciliation extends OwnedEntity {
  @Index()
  @Column('uuid')
  allocationId!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  estimatedPieces!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  physicalCount!: number;

  /** estimatedPieces - physicalCount (positive = shrinkage, negative = surplus) */
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  variance!: number;

  /**
   * Classification of the variance.
   * SHRINKAGE: goods lost/stolen/damaged.
   * SURPLUS: more stock found than estimated (e.g. unrecorded returns).
   * UNRECORDED_SALE: likely sold but not captured in POS.
   * ERROR: data entry or system error.
   */
  @Column({ default: 'SHRINKAGE' })
  varianceType!: 'SHRINKAGE' | 'SURPLUS' | 'UNRECORDED_SALE' | 'ERROR';

  @Column({ nullable: true, type: 'varchar' })
  notes?: string | null;
}
