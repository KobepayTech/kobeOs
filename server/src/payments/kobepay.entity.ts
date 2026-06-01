import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

/* ============ KobePay customers (deposit holders) ============ */
@Entity('kobepay_customers')
@Index(['ownerId', 'phone'], { unique: true })
export class PaymentCustomer extends OwnedEntity {
  @Column()
  name!: string;

  @Column()
  phone!: string;

  @Column({ default: '' })
  email!: string;

  @Column({ default: '' })
  idNumber!: string;

  @Column({ default: '' })
  company!: string;

  @Column({ default: '' })
  notes!: string;

  /** Running USD balance the customer has on deposit with KobePay. */
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  balance!: number;
}

/* ============ KobePay suppliers (payout recipients) ============ */
@Entity('kobepay_suppliers')
export class PaymentSupplier extends OwnedEntity {
  @Column()
  name!: string;

  @Column({ default: '' })
  country!: string;

  @Column({ default: '' })
  contact!: string;

  @Column({ default: '' })
  phone!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  balance!: number;

  @Column({ default: 0 })
  orders!: number;

  @Column({ default: 'Active' })
  status!: 'Active' | 'Inactive';
}

/* ============ Deposits (customer → KobePay) ============ */
export type DepositStatus = 'Pending' | 'Confirmed';
export type DepositTxnType = 'Deposit' | 'Goods on Delivery';

export interface DepositSupplierLine {
  supplierNumber: string;
  supplierName: string;
  amount: number;
}

@Entity('kobepay_deposits')
export class PaymentDeposit extends OwnedEntity {
  @Index()
  @Column('uuid')
  customerId!: string;

  @Column()
  customerName!: string;

  @Column()
  phone!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  amount!: number;

  @Column({ default: 'USD' })
  currency!: string;

  @Column({ default: 'Cash' })
  method!: string;

  @Column({ default: '' })
  reference!: string;

  @Column({ default: 'Pending' })
  status!: DepositStatus;

  @Column({ default: 'Deposit' })
  txnType!: DepositTxnType;

  /** Goods-on-delivery deposits carry a per-supplier breakdown. */
  @Column({ type: 'simple-json', nullable: true })
  suppliers?: DepositSupplierLine[] | null;

  /* ── Profit accounting (Owner Profit Dashboard) ────────────────
   * targetCurrency + targetAmount describe what the supplier will be
   * paid in (e.g. 5,000 CNY). salesRate is the rate the TZ cashier
   * quoted the customer (1 CNY = 400 TZS). collectedTzs is the actual
   * TZS the customer handed over (defaults to targetAmount × salesRate
   * + serviceFee). serviceFee is the TZS fee KobePay charged on top.
   */
  @Column({ default: 'CNY' })
  targetCurrency!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  targetAmount!: number;

  @Column({ type: 'decimal', precision: 18, scale: 6, default: 0 })
  salesRate!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  collectedTzs!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  serviceFee!: number;

  @Column({ default: '' })
  cashierName!: string;
}

/* ============ Payouts (KobePay → supplier) ============ */
export type PayoutStatus = 'INITIATED' | 'SENT' | 'CONFIRMED' | 'PAID' | 'REJECTED';

@Entity('kobepay_payouts')
export class PaymentPayout extends OwnedEntity {
  @Index()
  @Column('uuid')
  supplierId!: string;

  @Column()
  supplierName!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  amount!: number;

  @Column({ default: 'CNY' })
  currency!: string;

  @Column({ default: 'Bank' })
  method!: string;

  @Column({ default: 'INITIATED' })
  status!: PayoutStatus;

  @Column({ default: '' })
  initiatedBy!: string;

  @Column({ default: '' })
  confirmedBy!: string;

  @Column({ default: '' })
  notes!: string;

  /* ── Profit accounting ────────────────────────────────────────
   * depositId links the payout to the deposit it's fulfilling so the
   * profit dashboard can pair sales-side TZS in with cost-side TZS out.
   * actualRate is the real cost rate Cashier China paid (1 CNY = 380
   * TZS); actualCostTzs is what the payout actually cost us.
   * Everything else is fee breakdown that subtracts from net profit.
   */
  @Index()
  @Column('uuid', { nullable: true })
  depositId?: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 6, default: 0 })
  actualRate!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  actualCostTzs!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  transactionFees!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  bankCharges!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  mobileMoneyCharges!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  agentCommission!: number;
}

/* ============ Allocations (customer balance → supplier order) ============ */
@Entity('kobepay_allocations')
export class PaymentAllocation extends OwnedEntity {
  @Index()
  @Column('uuid')
  customerId!: string;

  @Column()
  customerName!: string;

  @Index()
  @Column('uuid')
  supplierId!: string;

  @Column()
  supplierName!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  amount!: number;

  @Column({ default: '' })
  orderRef!: string;

  @Column({ default: 'Deposit' })
  type!: 'Deposit' | 'Full';
}
