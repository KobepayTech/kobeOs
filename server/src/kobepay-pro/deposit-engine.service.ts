import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KpBankDeposit, KpStudent, DepositSource } from './kobepay-pro.entity';
import { WalletService } from './wallet.service';
import { parseMpesaSms } from './mpesa-parser';

export interface IngestResult {
  ok: boolean;
  status: KpBankDeposit['status'];
  depositId?: string;
  transactionId?: string;
  matchedStudentId?: string | null;
  reason?: string;
}

/**
 * The deposit engine turns incoming bank/mobile-money transactions into student
 * wallet credits. It is idempotent on `bankTransactionId` (globally unique) so
 * a re-forwarded SMS or webhook retry can never credit a wallet twice, and it
 * auto-matches deposits to a student by the reference on the transfer.
 */
@Injectable()
export class DepositEngineService {
  private readonly logger = new Logger(DepositEngineService.name);

  constructor(
    @InjectRepository(KpBankDeposit) private readonly deposits: Repository<KpBankDeposit>,
    @InjectRepository(KpStudent) private readonly students: Repository<KpStudent>,
    private readonly wallets: WalletService,
  ) {}

  /** Ingest a raw M-Pesa SMS forwarded by the phone bridge. */
  async ingestSms(ownerId: string, message: string): Promise<IngestResult> {
    const parsed = parseMpesaSms(message);
    if (!parsed) return { ok: false, status: 'REJECTED', reason: 'Not a recognisable M-Pesa payment SMS' };
    if (parsed.direction === 'SENT') {
      return { ok: false, status: 'REJECTED', reason: 'Outgoing payment SMS ignored' };
    }
    return this.record(ownerId, {
      bankTransactionId: parsed.transactionId,
      amount: parsed.amount,
      senderName: parsed.senderName,
      senderPhone: parsed.senderPhone,
      reference: parsed.reference,
      source: 'MPESA_SMS',
      raw: parsed.raw,
    });
  }

  /**
   * Record a deposit idempotently and auto-credit if it matches a student.
   * A duplicate bankTransactionId short-circuits without any wallet change.
   */
  async record(
    ownerId: string,
    input: {
      bankTransactionId: string; amount: number; senderName?: string; senderPhone?: string;
      reference?: string; source?: DepositSource; raw?: string;
    },
  ): Promise<IngestResult> {
    const txId = input.bankTransactionId?.trim().toUpperCase();
    if (!txId) return { ok: false, status: 'REJECTED', reason: 'Missing transaction id' };
    if (!(input.amount > 0)) return { ok: false, status: 'REJECTED', reason: 'Missing/invalid amount' };

    const existing = await this.deposits.findOne({ where: { bankTransactionId: txId } });
    if (existing) {
      // Already processed — never credit twice.
      return {
        ok: true, status: 'DUPLICATE', depositId: existing.id,
        matchedStudentId: existing.matchedStudentId ?? null, reason: 'Duplicate transaction id',
      };
    }

    let deposit: KpBankDeposit;
    try {
      deposit = await this.deposits.save(this.deposits.create({
        ownerId,
        bankTransactionId: txId,
        amount: input.amount,
        senderName: input.senderName ?? '',
        senderPhone: input.senderPhone ?? '',
        reference: (input.reference ?? '').toUpperCase(),
        source: input.source ?? 'MANUAL',
        rawMessage: input.raw ?? '',
        status: 'UNMATCHED',
      }));
    } catch (e) {
      // Unique-constraint race: another request inserted the same id first.
      const again = await this.deposits.findOne({ where: { bankTransactionId: txId } });
      if (again) return { ok: true, status: 'DUPLICATE', depositId: again.id, reason: 'Duplicate transaction id' };
      throw e;
    }

    const student = await this.findStudentByReference(ownerId, deposit.reference, deposit.senderPhone);
    if (!student) {
      this.logger.log(`Deposit ${txId} unmatched (ref="${deposit.reference}") — queued for review`);
      return { ok: true, status: 'UNMATCHED', depositId: deposit.id, matchedStudentId: null };
    }

    return this.postDeposit(ownerId, deposit, student);
  }

  /** Manually match an unmatched deposit to a student (reconciliation queue). */
  async matchToStudent(ownerId: string, depositId: string, studentId: string): Promise<IngestResult> {
    const deposit = await this.deposits.findOne({ where: { ownerId, id: depositId } });
    if (!deposit) throw new NotFoundException('Deposit not found');
    if (deposit.status === 'POSTED') throw new BadRequestException('Deposit already posted');
    const student = await this.students.findOne({ where: { ownerId, id: studentId } });
    if (!student) throw new NotFoundException('Student not found');
    return this.postDeposit(ownerId, deposit, student);
  }

  async listUnmatched(ownerId: string): Promise<KpBankDeposit[]> {
    return this.deposits.find({ where: { ownerId, status: 'UNMATCHED' }, order: { createdAt: 'DESC' }, take: 200 });
  }

  private async postDeposit(ownerId: string, deposit: KpBankDeposit, student: KpStudent): Promise<IngestResult> {
    const txn = await this.wallets.applyDeposit(ownerId, student.id, deposit.amount, {
      bankTransactionId: deposit.bankTransactionId,
      schoolId: student.schoolId,
      description: `Deposit from ${deposit.senderName || deposit.senderPhone || 'parent'}`,
      source: deposit.source,
    });
    deposit.matchedStudentId = student.id;
    deposit.status = 'POSTED';
    await this.deposits.save(deposit);
    this.logger.log(`Deposit ${deposit.bankTransactionId} → ${student.name} (${deposit.amount})`);
    return {
      ok: true, status: 'POSTED', depositId: deposit.id,
      transactionId: txn.id, matchedStudentId: student.id,
    };
  }

  private async findStudentByReference(
    ownerId: string, reference: string, senderPhone: string,
  ): Promise<KpStudent | null> {
    if (reference) {
      // The reference may carry a KBP prefix around the student code.
      const code = reference.replace(/^KBP[- ]?/i, '').toUpperCase();
      const byCode = await this.students.findOne({ where: { ownerId, studentCode: code } })
        || await this.students.findOne({ where: { ownerId, studentCode: reference.toUpperCase() } });
      if (byCode) return byCode;
    }
    // Fall back to a single unambiguous parent-phone match.
    if (senderPhone) {
      const norm = senderPhone.replace(/^\+?255/, '0');
      const byPhone = await this.students.find({ where: { ownerId, parentPhone: norm } });
      if (byPhone.length === 1) return byPhone[0];
    }
    return null;
  }
}
