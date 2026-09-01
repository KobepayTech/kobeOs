import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomBytes, randomInt } from 'crypto';
import { RemittanceClaim, RemittanceSupplierQr, RemittancePayout } from './remittance.entity';

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I/L
const CODE_LEN = 8;
const EPS = 1e-6;

function genCode(): string {
  for (;;) {
    const code = Array.from({ length: CODE_LEN }, () => CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)]).join('');
    if (/[A-Z]/.test(code) && /[0-9]/.test(code)) return code;
  }
}

export interface RedeemInput { amountReceived: number; cashierId?: string; idempotencyKey?: string }

/**
 * KobePay cross-border remittance. A claim holds one shared balance; the master
 * QR and every supplier child-QR draw it down. The invariant — the sum of all
 * cash-outs can NEVER exceed the balance — is enforced by locking the claim row
 * for the whole redeem, capping each redemption at the remaining balance (and,
 * for a supplier QR, at its fixed authorizedAmount), and de-duplicating retries
 * with an idempotency key.
 */
@Injectable()
export class RemittanceService {
  constructor(
    @InjectRepository(RemittanceClaim) private readonly claims: Repository<RemittanceClaim>,
    @InjectRepository(RemittanceSupplierQr) private readonly suppliers: Repository<RemittanceSupplierQr>,
    @InjectRepository(RemittancePayout) private readonly payouts: Repository<RemittancePayout>,
    private readonly ds: DataSource,
  ) {}

  private async uniqueCode(check: (code: string) => Promise<boolean>): Promise<string> {
    for (let i = 0; i < 8; i++) { const c = genCode(); if (!(await check(c))) return c; }
    throw new BadRequestException('Could not allocate a unique code, retry.');
  }

  /** Create a claim from a receive-receipt. Returns master code + portal token. */
  async createClaim(ownerId: string, dto: {
    amount: number; currency?: string; senderName?: string; senderPhone?: string; recipientCountry?: string;
  }): Promise<RemittanceClaim> {
    const amount = Number(dto.amount);
    if (!(amount > 0)) throw new BadRequestException('amount must be > 0');
    const masterCode = await this.uniqueCode(async (c) => !!(await this.claims.findOne({ where: { masterCode: c } })));
    const portalToken = randomBytes(24).toString('base64url');
    return this.claims.save(this.claims.create({
      ownerId, masterCode, portalToken,
      senderName: dto.senderName ?? '', senderPhone: dto.senderPhone ?? '',
      recipientCountry: dto.recipientCountry ?? '', currency: dto.currency ?? 'USD',
      amount, balance: amount, status: 'OPEN',
    }));
  }

  /** Sender adds a supplier → a fixed-amount child QR linked to the claim. */
  async addSupplier(ownerId: string, claimId: string, dto: {
    supplierName?: string; supplierPhone?: string; authorizedAmount: number;
  }): Promise<RemittanceSupplierQr> {
    const claim = await this.claims.findOne({ where: { ownerId, id: claimId } });
    if (!claim) throw new NotFoundException('Claim not found');
    if (claim.status !== 'OPEN') throw new BadRequestException(`Claim is ${claim.status.toLowerCase()}`);
    const authorized = Number(dto.authorizedAmount);
    if (!(authorized > 0)) throw new BadRequestException('authorizedAmount must be > 0');
    // A supplier can't be authorised for more than the whole claim.
    if (authorized > Number(claim.amount) + EPS) throw new BadRequestException('authorizedAmount exceeds the claim amount');
    const code = await this.uniqueCode(async (c) => !!(await this.suppliers.findOne({ where: { code: c } })));
    return this.suppliers.save(this.suppliers.create({
      ownerId, claimId, code,
      supplierName: dto.supplierName ?? '', supplierPhone: dto.supplierPhone ?? '',
      authorizedAmount: authorized, redeemedAmount: 0, status: 'ACTIVE', redeemedKeys: [],
    }));
  }

  /** Sender adds a supplier from their live portal (authorised by portalToken). */
  async addSupplierByPortal(portalToken: string, dto: { supplierName?: string; supplierPhone?: string; authorizedAmount: number }): Promise<RemittanceSupplierQr> {
    const claim = await this.claims.findOne({ where: { portalToken } });
    if (!claim) throw new NotFoundException('Invalid portal link');
    return this.addSupplier(claim.ownerId, claim.id, dto);
  }

  /**
   * Cash out against a code (master OR supplier QR). Atomic: locks the claim,
   * caps at the shared balance (and the supplier's fixed cap), idempotent.
   */
  async redeem(code: string, input: RedeemInput): Promise<{
    claimBalance: number; paidNow: number; currency: string; claimStatus: string; via: 'master' | 'supplier';
    supplierRemaining?: number;
  }> {
    const amount = Number(input.amountReceived);
    if (!(amount > 0)) throw new BadRequestException('amountReceived must be > 0');
    const key = input.idempotencyKey?.trim();

    return this.ds.transaction(async (tx) => {
      const claimRepo = tx.getRepository(RemittanceClaim);
      const supRepo = tx.getRepository(RemittanceSupplierQr);
      const payRepo = tx.getRepository(RemittancePayout);

      // Resolve the code to a claim (+ optional supplier), then LOCK the claim
      // row so all redemptions against this claim serialise.
      let supplier = await supRepo.createQueryBuilder('s').where('s.code = :code', { code }).getOne();
      const claimId = supplier ? supplier.claimId : undefined;
      const claim = await claimRepo.createQueryBuilder('c')
        .setLock('pessimistic_write')
        .where(supplier ? 'c.id = :claimId' : 'c.masterCode = :code', supplier ? { claimId } : { code })
        .getOne();
      if (!claim) throw new NotFoundException('Code not found');
      // Re-read the supplier inside the lock (its counters may have changed).
      if (supplier) {
        supplier = await supRepo.createQueryBuilder('s').setLock('pessimistic_write').where('s.id = :id', { id: supplier.id }).getOne();
      }
      if (claim.status !== 'OPEN') throw new BadRequestException(`Claim is ${claim.status.toLowerCase()}`);

      // Idempotency: a repeated key against the same target is a no-op.
      const seen = supplier ? supplier.redeemedKeys : (await payRepo.find({ where: { claimId: claim.id } })).map((p) => p.idempotencyKey);
      if (key && Array.isArray(seen) && seen.includes(key)) {
        return {
          claimBalance: Number(claim.balance), paidNow: 0, currency: claim.currency,
          claimStatus: claim.status, via: supplier ? 'supplier' : 'master',
          supplierRemaining: supplier ? Math.max(0, Number(supplier.authorizedAmount) - Number(supplier.redeemedAmount)) : undefined,
        };
      }

      if (supplier && supplier.status !== 'ACTIVE') throw new BadRequestException(`Supplier QR is ${supplier.status.toLowerCase()}`);

      // Caps: never exceed the shared balance; a supplier also can't exceed its
      // fixed authorised amount.
      if (amount > Number(claim.balance) + EPS) {
        throw new BadRequestException(`Amount exceeds the remaining balance (${Number(claim.balance)} ${claim.currency})`);
      }
      if (supplier) {
        const supRemaining = Number(supplier.authorizedAmount) - Number(supplier.redeemedAmount);
        if (amount > supRemaining + EPS) throw new BadRequestException(`Amount exceeds this supplier's authorised amount (${Math.max(0, supRemaining)} ${claim.currency})`);
      }

      // Apply.
      claim.balance = +(Number(claim.balance) - amount).toFixed(4);
      if (claim.balance <= EPS) { claim.balance = 0; claim.status = 'SETTLED'; }
      await claimRepo.save(claim);

      if (supplier) {
        supplier.redeemedAmount = +(Number(supplier.redeemedAmount) + amount).toFixed(4);
        if (Number(supplier.redeemedAmount) >= Number(supplier.authorizedAmount) - EPS) supplier.status = 'USED';
        if (key) supplier.redeemedKeys = [...(supplier.redeemedKeys ?? []), key];
        await supRepo.save(supplier);
      }

      await payRepo.save(payRepo.create({
        ownerId: claim.ownerId, claimId: claim.id, supplierQrId: supplier?.id ?? null,
        amount, cashierId: input.cashierId ?? '', idempotencyKey: key ?? '',
      }));

      return {
        claimBalance: Number(claim.balance), paidNow: amount, currency: claim.currency,
        claimStatus: claim.status, via: supplier ? 'supplier' : 'master',
        supplierRemaining: supplier ? Math.max(0, Number(supplier.authorizedAmount) - Number(supplier.redeemedAmount)) : undefined,
      };
    });
  }

  /** Sender's live portal (secret token) — balance + suppliers + payout ledger. */
  async portal(portalToken: string) {
    const claim = await this.claims.findOne({ where: { portalToken } });
    if (!claim) throw new NotFoundException('Invalid portal link');
    const [suppliers, payouts] = await Promise.all([
      this.suppliers.find({ where: { ownerId: claim.ownerId, claimId: claim.id }, order: { createdAt: 'DESC' } }),
      this.payouts.find({ where: { ownerId: claim.ownerId, claimId: claim.id }, order: { createdAt: 'DESC' }, take: 200 }),
    ]);
    return {
      masterCode: claim.masterCode,
      amount: Number(claim.amount), balance: Number(claim.balance), currency: claim.currency,
      status: claim.status, senderName: claim.senderName, recipientCountry: claim.recipientCountry,
      suppliers: suppliers.map((s) => ({
        code: s.code, supplierName: s.supplierName, supplierPhone: s.supplierPhone,
        authorizedAmount: Number(s.authorizedAmount), redeemedAmount: Number(s.redeemedAmount), status: s.status,
      })),
      payouts: payouts.map((p) => ({ amount: Number(p.amount), supplierQrId: p.supplierQrId, at: p.createdAt })),
    };
  }

  /** Cashier's view of a scanned code (master or supplier) — what's payable now. */
  async lookup(code: string) {
    const supplier = await this.suppliers.findOne({ where: { code } });
    const claim = await this.claims.findOne({ where: supplier ? { id: supplier.claimId } : { masterCode: code } });
    if (!claim) throw new NotFoundException('Code not found');
    const supRemaining = supplier ? Math.max(0, Number(supplier.authorizedAmount) - Number(supplier.redeemedAmount)) : undefined;
    const payable = supplier ? Math.min(Number(claim.balance), supRemaining!) : Number(claim.balance);
    const phone = claim.senderPhone?.trim() ?? '';
    const senderPhoneMasked = phone
      ? phone.length <= 6
        ? '••••'
        : `${phone.slice(0, 3)}••••${phone.slice(-3)}`
      : '';

    return {
      via: supplier ? 'supplier' : 'master', currency: claim.currency, claimStatus: claim.status,
      claimBalance: Number(claim.balance), payableNow: Number(payable.toFixed(4)),
      senderName: claim.senderName, senderPhoneMasked, recipientCountry: claim.recipientCountry,
      supplierName: supplier?.supplierName, supplierStatus: supplier?.status,
    };
  }
}
