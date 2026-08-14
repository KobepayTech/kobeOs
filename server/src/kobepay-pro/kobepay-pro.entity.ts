import { Column, Entity, Index, Unique } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { OwnedEntity } from '../common/owned.entity';

/**
 * Kobepay Pro — a programmable school financial OS.
 *
 * Design notes:
 *  - The real money lives in a bank/mobile-money account. Kobepay keeps the
 *    STUDENT-LEVEL LEDGER that explains who owns what portion of that balance.
 *  - Money is programmable: a student's balance is split across four logical
 *    pools — Available, Restricted (per category), Reserved (group orders) and
 *    Savings — and the rule engine decides whether a purchase is allowed.
 *  - Every value movement is a balanced double-entry transaction (KpTransaction
 *    + KpLedgerLine[]), so the books always reconcile:
 *        BANK = Σ student owed + Σ merchant payable + fees + escrow
 */

// pg `numeric` comes back as a string; coerce to number on read.
const numeric = {
  to: (v: number) => v,
  from: (v: string | null) => (v == null ? 0 : parseFloat(v)),
};

export type BankModel = 'KOBEPAY' | 'SCHOOL';
export type StudentStatus = 'ACTIVE' | 'SUSPENDED' | 'GRADUATED';
export type MerchantStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED';
export type KpAccountType =
  | 'BANK' | 'FEES' | 'ESCROW' | 'STUDENT' | 'MERCHANT' | 'SUPPLIER' | 'EXTERNAL';
export type KpTxnKind =
  | 'DEPOSIT' | 'PAYMENT' | 'SETTLEMENT' | 'FEE' | 'RESERVE' | 'RELEASE'
  | 'CAPTURE' | 'REVERSAL' | 'ADJUSTMENT';

export type SupplierStatus = 'ACTIVE' | 'SUSPENDED';
export type GroupStatus =
  | 'OPEN' | 'ORDERED' | 'PRODUCTION' | 'IN_TRANSIT' | 'DELIVERED' | 'VERIFIED' | 'COMPLETED' | 'CANCELLED';
export type GroupOrderStatus =
  | 'RESERVED' | 'RELEASED' | 'CAPTURED' | 'COLLECTED' | 'CANCELLED';
export type KpTxnStatus = 'POSTED' | 'REVERSED';
export type BankDepositStatus = 'UNMATCHED' | 'MATCHED' | 'POSTED' | 'DUPLICATE' | 'REJECTED';
export type DepositSource = 'MPESA_SMS' | 'WEBHOOK' | 'MANUAL';
export type SpendCategory =
  | 'AVAILABLE' | 'FOOD' | 'TRANSPORT' | 'BOOKS' | 'SUPPLIES' | 'ONLINE' | 'GROUP' | 'SAVINGS';

/** A school tenant. ownerId = the KobeOS account operating this Kobepay deployment. */
@Entity('kp_schools')
@Index(['ownerId', 'code'], { unique: true })
export class KpSchool extends OwnedEntity {
  @Column() name!: string;
  @Column({ length: 24 }) code!: string;
  /** KOBEPAY = money sits in a Kobepay bank account; SCHOOL = school's own account. */
  @Column({ default: 'KOBEPAY' }) bankModel!: BankModel;
  @Column({ default: '' }) bankAccountRef!: string;
  @Column({ default: 'TZS' }) currency!: string;
  @Column({ type: 'jsonb', default: {} }) settings!: Record<string, unknown>;
}

/** A student with a controlled pocket-money account. */
@Entity('kp_students')
@Index(['ownerId', 'schoolId'])
@Index(['ownerId', 'studentCode'], { unique: true })
export class KpStudent extends OwnedEntity {
  @Column('uuid') schoolId!: string;
  @Column() name!: string;
  @Column({ length: 32 }) studentCode!: string;
  @Column({ default: '' }) className!: string;
  /** Card / identification tokens for tap-to-pay. */
  @Index() @Column({ default: '' }) nfcCardId!: string;
  @Index() @Column({ default: '' }) qrToken!: string;
  @Column({ default: '' }) parentName!: string;
  @Column({ default: '' }) parentPhone!: string;
  @Column({ default: 'ACTIVE' }) status!: StudentStatus;
  /** Parent/school spending rules. See RuleEngineService for the schema. */
  @Column({ type: 'jsonb', default: {} }) controls!: Record<string, unknown>;
}

/** An approved merchant (cafeteria, shop, supplier, online service). */
@Entity('kp_merchants')
@Index(['ownerId', 'merchantCode'], { unique: true })
export class KpMerchant extends OwnedEntity {
  @Column() name!: string;
  @Column({ length: 32 }) merchantCode!: string;
  /** Spending category this merchant sells into (FOOD, BOOKS, ONLINE, ...). */
  @Column({ default: 'AVAILABLE' }) category!: SpendCategory;
  @Column({ default: '' }) settlementAccount!: string;
  @Column({ default: 'mobile' }) settlementMethod!: string;
  @Column('numeric', { precision: 5, scale: 2, default: 0, transformer: numeric }) commissionPct!: number;
  @Column({ default: 'PENDING' }) status!: MerchantStatus;
  @Column({ default: false }) online!: boolean;
  /** Kobepay Connect: sha256 of the merchant's API key (never store the key). */
  @Column({ default: '' }) apiKeyHash!: string;
  @Column({ default: '' }) apiKeyLast4!: string;
}

/** Per-school merchant whitelist — a school approves which merchants its students may use. */
@Entity('kp_merchant_approvals')
@Unique('UQ_kp_merchant_approval', ['schoolId', 'merchantId'])
export class KpMerchantApproval extends OwnedEntity {
  @Column('uuid') schoolId!: string;
  @Column('uuid') merchantId!: string;
  @Column({ default: true }) allowed!: boolean;
}

/**
 * A ledger account. `balance` is stored raw as (debits − credits); every posted
 * transaction is balanced, so Σ of all account balances is always 0. Asset
 * accounts (BANK) are debit-normal (positive); liability accounts (STUDENT,
 * MERCHANT, SUPPLIER, ESCROW, FEES) are credit-normal (their raw balance is
 * negative and the amount owed is −balance).
 */
@Entity('kp_accounts')
@Unique('UQ_kp_account', ['ownerId', 'type', 'refId'])
export class KpAccount extends OwnedEntity {
  @Column() type!: KpAccountType;
  /** Points at the student/merchant/supplier id; empty for singletons (BANK/FEES/ESCROW). */
  @Column({ default: '' }) refId!: string;
  @Column({ default: 'TZS' }) currency!: string;
  @Column('numeric', { precision: 18, scale: 4, default: 0, transformer: numeric }) balance!: number;
}

/** A business transaction; groups a balanced set of ledger lines. */
@Entity('kp_transactions')
@Index(['ownerId', 'createdAt'])
@Index(['ownerId', 'studentId'])
@Index(['ownerId', 'merchantId'])
export class KpTransaction extends OwnedEntity {
  @Column({ length: 16 }) reference!: string;
  @Column() kind!: KpTxnKind;
  @Column({ default: 'POSTED' }) status!: KpTxnStatus;
  @Column('uuid', { nullable: true }) schoolId?: string | null;
  @Column('uuid', { nullable: true }) studentId?: string | null;
  @Column('uuid', { nullable: true }) merchantId?: string | null;
  @Column({ default: 'AVAILABLE' }) category!: SpendCategory;
  @Column('numeric', { precision: 18, scale: 4, default: 0, transformer: numeric }) amount!: number;
  @Column({ default: 'TZS' }) currency!: string;
  @Column({ default: '' }) device!: string;
  @Column({ default: '' }) approvalRule!: string;
  @Column({ default: '' }) description!: string;
  /** Idempotency: link to the bank transaction that funded a deposit. */
  @Index() @Column({ default: '' }) bankTransactionId!: string;
  @Column({ type: 'jsonb', default: {} }) metadata!: Record<string, unknown>;
}

/** One side of a double-entry posting. */
@Entity('kp_ledger_lines')
@Index(['transactionId'])
@Index(['accountId'])
export class KpLedgerLine extends BaseEntity {
  @Index() @Column('uuid') ownerId!: string;
  @Column('uuid') transactionId!: string;
  @Column('uuid') accountId!: string;
  @Column('numeric', { precision: 18, scale: 4, default: 0, transformer: numeric }) debit!: number;
  @Column('numeric', { precision: 18, scale: 4, default: 0, transformer: numeric }) credit!: number;
  /** Account balance immediately after this line, for audit. */
  @Column('numeric', { precision: 18, scale: 4, default: 0, transformer: numeric }) balanceAfter!: number;
}

/** The student's spendable overlay on top of the ledger. */
@Entity('kp_wallets')
@Unique('UQ_kp_wallet_student', ['studentId'])
export class KpWallet extends OwnedEntity {
  @Column('uuid') studentId!: string;
  @Column('numeric', { precision: 18, scale: 4, default: 0, transformer: numeric }) available!: number;
  @Column('numeric', { precision: 18, scale: 4, default: 0, transformer: numeric }) savings!: number;
  @Column({ default: 'TZS' }) currency!: string;
  @Column('numeric', { precision: 18, scale: 4, default: 0, transformer: numeric }) spentToday!: number;
  @Column({ type: 'date', nullable: true }) spentDay?: string | null;
}

/** A restricted (category-locked) allocation of a student's money. */
@Entity('kp_buckets')
@Unique('UQ_kp_bucket', ['studentId', 'category'])
export class KpBucket extends OwnedEntity {
  @Column('uuid') studentId!: string;
  @Column() category!: SpendCategory;
  @Column('numeric', { precision: 18, scale: 4, default: 0, transformer: numeric }) balance!: number;
}

/** Money reserved (escrowed) for a group order — unavailable for normal spend. */
@Entity('kp_reserved_holds')
@Index(['ownerId', 'studentId', 'status'])
export class KpReservedHold extends OwnedEntity {
  @Column('uuid') studentId!: string;
  @Column({ default: '' }) purpose!: string;
  @Column('uuid', { nullable: true }) groupId?: string | null;
  @Column('numeric', { precision: 18, scale: 4, default: 0, transformer: numeric }) amount!: number;
  @Column({ default: 'RESERVED' }) status!: 'RESERVED' | 'RELEASED' | 'CAPTURED';
}

/**
 * An incoming bank/mobile-money deposit. `bankTransactionId` is globally unique
 * so the same M-Pesa SMS can never credit a wallet twice.
 */
@Entity('kp_bank_deposits')
@Index(['ownerId', 'status'])
export class KpBankDeposit extends OwnedEntity {
  @Index()
  @Column({ unique: true })
  bankTransactionId!: string;
  @Column('numeric', { precision: 18, scale: 4, default: 0, transformer: numeric }) amount!: number;
  @Column({ default: 'TZS' }) currency!: string;
  @Column({ default: '' }) senderName!: string;
  @Column({ default: '' }) senderPhone!: string;
  @Column({ default: '' }) reference!: string;
  @Column('uuid', { nullable: true }) matchedStudentId?: string | null;
  @Column({ default: 'UNMATCHED' }) status!: BankDepositStatus;
  @Column({ default: 'MPESA_SMS' }) source!: DepositSource;
  @Column({ type: 'text', default: '' }) rawMessage!: string;
}

/** A supplier who fulfils bulk purchase groups. */
@Entity('kp_suppliers')
@Index(['ownerId', 'code'], { unique: true })
export class KpSupplier extends OwnedEntity {
  @Column() name!: string;
  @Column({ length: 32 }) code!: string;
  @Column({ default: '' }) contactPhone!: string;
  @Column({ default: '' }) contactEmail!: string;
  @Column({ default: '' }) settlementAccount!: string;
  @Column({ default: 'mobile' }) settlementMethod!: string;
  /** Capability token for the public supplier portal (no login). */
  @Index() @Column({ unique: true }) portalToken!: string;
  @Column({ default: 'ACTIVE' }) status!: SupplierStatus;
}

/**
 * A bulk purchase group: the school offers a product at a group price; parents
 * join and money is reserved (escrow) until enough participants join, then it
 * consolidates into ONE supplier order, is delivered, verified, collected and
 * finally the supplier is paid from escrow.
 */
@Entity('kp_purchase_groups')
@Index(['ownerId', 'schoolId', 'status'])
export class KpPurchaseGroup extends OwnedEntity {
  @Column('uuid') schoolId!: string;
  @Column({ length: 16 }) reference!: string;
  @Column() title!: string;
  @Column({ default: '' }) productName!: string;
  @Column({ type: 'text', default: '' }) description!: string;
  @Column({ default: '' }) imageUrl!: string;
  @Column('numeric', { precision: 18, scale: 4, default: 0, transformer: numeric }) normalPrice!: number;
  @Column('numeric', { precision: 18, scale: 4, default: 0, transformer: numeric }) groupPrice!: number;
  @Column({ default: 'TZS' }) currency!: string;
  @Column({ type: 'int', default: 1 }) minParticipants!: number;
  @Column({ type: 'timestamptz', nullable: true }) deadline?: Date | null;
  @Column({ default: '' }) deliveryLocation!: string;
  @Column('uuid', { nullable: true }) supplierId?: string | null;
  /** Unit price paid to the supplier (the margin becomes Kobepay/school fees). */
  @Column('numeric', { precision: 18, scale: 4, default: 0, transformer: numeric }) supplierUnitCost!: number;
  @Column({ default: 'OPEN' }) status!: GroupStatus;
  @Column({ type: 'timestamptz', nullable: true }) orderedAt?: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) deliveredAt?: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) verifiedAt?: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) completedAt?: Date | null;
}

/**
 * A starter pack: a named bundle of purchase groups (books + uniform +
 * calculator …) a parent buys in one tap. Each item references a purchase
 * group, so escrow/supplier/delivery all reuse the Groups engine.
 */
@Entity('kp_starter_packs')
@Index(['ownerId', 'schoolId'])
export class KpStarterPack extends OwnedEntity {
  @Column('uuid') schoolId!: string;
  @Column() name!: string;
  @Column({ default: '' }) className!: string;
  @Column({ type: 'text', default: '' }) description!: string;
  /** [{ groupId, qty }] — each references a KpPurchaseGroup. */
  @Column({ type: 'jsonb', default: [] }) items!: Array<{ groupId: string; qty: number }>;
  @Column({ default: true }) active!: boolean;
}

/** One participant's order inside a purchase group. */
@Entity('kp_group_orders')
@Index(['ownerId', 'groupId'])
@Index(['ownerId', 'studentId'])
export class KpGroupOrder extends OwnedEntity {
  @Column('uuid') groupId!: string;
  @Column('uuid') schoolId!: string;
  @Column('uuid') studentId!: string;
  @Column({ length: 16 }) reference!: string;
  @Column({ type: 'int', default: 1 }) qty!: number;
  @Column('numeric', { precision: 18, scale: 4, default: 0, transformer: numeric }) unitPrice!: number;
  @Column('numeric', { precision: 18, scale: 4, default: 0, transformer: numeric }) amount!: number;
  @Column('uuid', { nullable: true }) holdId?: string | null;
  @Column({ default: 'RESERVED' }) status!: GroupOrderStatus;
  @Column({ type: 'timestamptz', nullable: true }) collectedAt?: Date | null;
  @Column({ default: '' }) collectedBy!: string;
}
