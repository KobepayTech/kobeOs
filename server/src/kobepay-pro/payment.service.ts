import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { KpMerchant, KpStudent, SpendCategory } from './kobepay-pro.entity';
import { LedgerService, PostLine } from './ledger.service';
import { WalletService } from './wallet.service';
import { RuleEngineService } from './rule-engine.service';

const CENTS = 1e4;
const round = (n: number) => Math.round(n * CENTS) / CENTS;

export interface PayInput {
  studentId?: string;
  nfcCardId?: string;
  qrToken?: string;
  studentCode?: string;
  merchantId: string;
  amount: number;
  device?: string;
  description?: string;
}

export interface PayReceipt {
  status: 'APPROVED' | 'DECLINED' | 'NEEDS_APPROVAL';
  reason: string;
  rule: string;
  reference?: string;
  transactionId?: string;
  student?: { id: string; name: string };
  merchant?: { id: string; name: string };
  amount: number;
  fee?: number;
  merchantNet?: number;
  category?: SpendCategory;
}

/**
 * Executes an approved-merchant payment. Runs the rule engine, then in a single
 * DB transaction deducts the student's wallet and posts the double-entry:
 *   Dr STUDENT amount / Cr MERCHANT net / Cr FEES commission.
 * No bank movement — that happens later at settlement.
 */
@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(KpStudent) private readonly students: Repository<KpStudent>,
    @InjectRepository(KpMerchant) private readonly merchants: Repository<KpMerchant>,
    private readonly rules: RuleEngineService,
    private readonly ledger: LedgerService,
    private readonly wallets: WalletService,
    private readonly dataSource: DataSource,
  ) {}

  async pay(ownerId: string, input: PayInput): Promise<PayReceipt> {
    const amount = round(input.amount);
    const student = await this.resolveStudent(ownerId, input);
    const merchant = await this.merchants.findOne({ where: { ownerId, id: input.merchantId } });
    if (!merchant) throw new NotFoundException('Merchant not found');

    const category = merchant.category;
    const decision = await this.rules.authorize(ownerId, student, merchant, category, amount);
    if (!decision.approved) {
      return {
        status: decision.requiresApproval ? 'NEEDS_APPROVAL' : 'DECLINED',
        reason: decision.reason, rule: decision.rule, amount,
        student: { id: student.id, name: student.name },
        merchant: { id: merchant.id, name: merchant.name },
        category,
      };
    }

    const fee = round(amount * (merchant.commissionPct || 0) / 100);
    const merchantNet = round(amount - fee);

    const txn = await this.dataSource.transaction(async (m) => {
      // Deduct from the student's wallet (category bucket first, then Available).
      await this.wallets.spendFrom(m, ownerId, student.id, category, amount);
      // Post double-entry: student owes less, merchant is owed net, Kobepay earns the fee.
      const lines: PostLine[] = [
        { type: 'STUDENT', refId: student.id, debit: amount },
        { type: 'MERCHANT', refId: merchant.id, credit: merchantNet },
      ];
      if (fee > 0) lines.push({ type: 'FEES', refId: '', credit: fee });
      return this.ledger.post(m, {
        ownerId, kind: 'PAYMENT', amount, currency: merchant ? 'TZS' : 'TZS',
        schoolId: student.schoolId, studentId: student.id, merchantId: merchant.id,
        category, device: input.device ?? '', approvalRule: decision.rule,
        description: input.description || `Payment to ${merchant.name}`,
        metadata: { fee, merchantNet },
      }, lines);
    });

    return {
      status: 'APPROVED', reason: 'Approved', rule: decision.rule,
      reference: txn.reference, transactionId: txn.id,
      student: { id: student.id, name: student.name },
      merchant: { id: merchant.id, name: merchant.name },
      amount, fee, merchantNet, category,
    };
  }

  private async resolveStudent(ownerId: string, input: PayInput): Promise<KpStudent> {
    const where = input.studentId ? { ownerId, id: input.studentId }
      : input.nfcCardId ? { ownerId, nfcCardId: input.nfcCardId }
      : input.qrToken ? { ownerId, qrToken: input.qrToken }
      : input.studentCode ? { ownerId, studentCode: input.studentCode.toUpperCase() }
      : null;
    if (!where) throw new BadRequestException('Provide a student id, NFC card, QR token or student code');
    const student = await this.students.findOne({ where });
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }
}
