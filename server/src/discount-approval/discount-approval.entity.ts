import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

// ─── Status enum ─────────────────────────────────────────────────────────────

export type DiscountRequestStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'APPROVED'
  | 'COUNTERED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'COMPLETED';

// ─── DiscountRequest ─────────────────────────────────────────────────────────

/**
 * One row per seller discount request.
 *
 * ownerId = the business owner (tenant). sellerId is the staff member who
 * created the request. This lets the owner see all requests across their shop.
 *
 * State machine:
 *   DRAFT → PENDING → APPROVED → COMPLETED
 *                   → COUNTERED → APPROVED → COMPLETED
 *                              → REJECTED
 *                   → REJECTED
 *                   → EXPIRED
 */
@Entity('discount_requests')
export class DiscountRequest extends OwnedEntity {
  // ── Product / variant ──────────────────────────────────────────────────────
  @Index()
  @Column('uuid')
  productId!: string;

  @Column({ nullable: true, type: 'varchar' })
  productName!: string | null;

  @Column({ nullable: true, type: 'uuid' })
  variantId!: string | null;

  // ── Customer ───────────────────────────────────────────────────────────────
  @Column({ nullable: true, type: 'uuid' })
  customerId!: string | null;

  @Column({ nullable: true, type: 'varchar' })
  customerName!: string | null;

  // ── Seller ─────────────────────────────────────────────────────────────────
  @Index()
  @Column('uuid')
  sellerId!: string;

  @Column({ nullable: true, type: 'varchar' })
  sellerName!: string | null;

  // ── Approver (set when owner acts) ────────────────────────────────────────
  @Column({ nullable: true, type: 'uuid' })
  approverId!: string | null;

  // ── Quantities & prices ────────────────────────────────────────────────────
  @Column({ default: 1 })
  quantity!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  standardPrice!: number;

  /** Unit cost — used for margin calculations */
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  unitCost!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  requestedPrice!: number;

  /** Set by owner on approve or counter */
  @Column({ nullable: true, type: 'decimal', precision: 18, scale: 4 })
  approvedPrice!: number | null;

  /** Owner's counter price (set when status → COUNTERED) */
  @Column({ nullable: true, type: 'decimal', precision: 18, scale: 4 })
  counterPrice!: number | null;

  @Column({ default: 'TZS' })
  currency!: string;

  // ── State ──────────────────────────────────────────────────────────────────
  @Index()
  @Column({ default: 'DRAFT' })
  status!: DiscountRequestStatus;

  // ── Text fields ────────────────────────────────────────────────────────────
  @Column({ nullable: true, type: 'text' })
  reason!: string | null;

  @Column({ nullable: true, type: 'text' })
  approverNote!: string | null;

  @Column({ nullable: true, type: 'text' })
  photoUrl!: string | null;

  // ── Timestamps ─────────────────────────────────────────────────────────────
  @Column({ nullable: true, type: 'timestamptz' })
  expiresAt!: Date | null;

  @Column({ nullable: true, type: 'timestamptz' })
  respondedAt!: Date | null;

  @Column({ nullable: true, type: 'timestamptz' })
  completedAt!: Date | null;

  // ── Linked sale (set on COMPLETED) ────────────────────────────────────────
  @Column({ nullable: true, type: 'uuid' })
  saleId!: string | null;

  // ── Idempotency key — prevents duplicate sale creation on retries ──────────
  @Index({ unique: true })
  @Column({ nullable: true, type: 'varchar' })
  idempotencyKey!: string | null;
}

// ─── DiscountLog ─────────────────────────────────────────────────────────────

/**
 * Immutable reporting record written once when a discount sale completes.
 * Never updated after creation.
 */
@Entity('discount_logs')
export class DiscountLog extends OwnedEntity {
  @Index()
  @Column('uuid')
  discountRequestId!: string;

  @Column('uuid')
  saleId!: string;

  @Column('uuid')
  productId!: string;

  @Column({ nullable: true, type: 'uuid' })
  variantId!: string | null;

  @Column({ nullable: true, type: 'uuid' })
  customerId!: string | null;

  @Column('uuid')
  sellerId!: string;

  @Column({ nullable: true, type: 'uuid' })
  approverId!: string | null;

  @Column({ default: 1 })
  quantity!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  standardPrice!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  approvedPrice!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  unitCost!: number;

  // Computed at write time and stored for fast reporting
  @Column({ type: 'decimal', precision: 18, scale: 4 })
  standardValue!: number;       // quantity * standardPrice

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  actualValue!: number;         // quantity * approvedPrice

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  discountAmount!: number;      // standardValue - actualValue

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  discountPercent!: number;     // ((standardPrice - approvedPrice) / standardPrice) * 100

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  standardMargin!: number;      // ((standardPrice - unitCost) / standardPrice) * 100

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  actualMargin!: number;        // ((approvedPrice - unitCost) / approvedPrice) * 100

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  profit!: number;              // (approvedPrice - unitCost) * quantity

  @Column({ default: 'TZS' })
  currency!: string;
}

// ─── DiscountApprovalRule ─────────────────────────────────────────────────────

/**
 * Auto-approval rules evaluated in priority order (ascending).
 * If ALL conditions on a rule match, the request is auto-approved.
 * If no rule matches, the request goes to the owner.
 */
@Entity('discount_approval_rules')
export class DiscountApprovalRule extends OwnedEntity {
  @Column()
  ruleName!: string;

  @Column({ nullable: true, type: 'text' })
  description!: string | null;

  /** Maximum discount % this rule allows (e.g. 10 = up to 10% off) */
  @Column({ nullable: true, type: 'decimal', precision: 5, scale: 2 })
  maxDiscountPercent!: number | null;

  /** Minimum margin % that must remain after discount */
  @Column({ nullable: true, type: 'decimal', precision: 5, scale: 2 })
  minMarginPercent!: number | null;

  /** Minimum customer tier required (e.g. 'VIP') */
  @Column({ nullable: true, type: 'varchar' })
  minCustomerTier!: string | null;

  /** Minimum quantity in the request */
  @Column({ nullable: true, type: 'integer' })
  minQuantity!: number | null;

  /** Seller roles allowed to trigger this rule (stored as JSON array) */
  @Column({ nullable: true, type: 'jsonb' })
  allowedSellerRoles!: string[] | null;

  @Column({ default: true })
  isActive!: boolean;

  /** Lower number = evaluated first */
  @Column({ default: 100 })
  priority!: number;

  /** Per-tenant expiry override in minutes (null = use system default of 5) */
  @Column({ nullable: true, type: 'integer' })
  expiryMinutes!: number | null;
}
