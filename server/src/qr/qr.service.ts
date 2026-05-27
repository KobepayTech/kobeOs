import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QrCode, QrType } from './qr.entity';

@Injectable()
export class QrService {
  constructor(
    @InjectRepository(QrCode) private readonly repo: Repository<QrCode>,
  ) {}

  /** Generate a cryptographically random 6-char alphanumeric short code. */
  private generateShortCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I ambiguity
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  /** Ensure uniqueness — retry up to 10 times on collision. */
  private async uniqueShortCode(): Promise<string> {
    for (let i = 0; i < 10; i++) {
      const code = this.generateShortCode();
      const exists = await this.repo.findOne({ where: { shortCode: code } });
      if (!exists) return code;
    }
    throw new Error('Short code generation failed after 10 attempts');
  }

  async generate(params: {
    ownerId: string;
    type: QrType;
    reference: string;
    label: string;
    amount: number;
    currency: string;
    meta?: Record<string, unknown>;
  }): Promise<QrCode> {
    const shortCode = await this.uniqueShortCode();
    const payload = JSON.stringify({
      type: params.type,
      ref: params.reference,
      code: shortCode,
      amount: params.amount,
      currency: params.currency,
      label: params.label,
      ...params.meta,
    });

    const qr = this.repo.create({
      ownerId: params.ownerId,
      type: params.type,
      reference: params.reference,
      shortCode,
      payload,
      label: params.label,
      amount: params.amount,
      currency: params.currency,
      meta: params.meta ?? {},
    });
    return this.repo.save(qr);
  }

  /** Generate both customer and supplier QR codes for a deposit in one call. */
  async generatePair(params: {
    ownerId: string;
    reference: string;
    amount: number;
    currency: string;
    customerName: string;
    supplierName: string;
    supplierNumber: string;
    country?: string;
  }): Promise<{ customer: QrCode; supplier: QrCode }> {
    const [customer, supplier] = await Promise.all([
      this.generate({
        ownerId: params.ownerId,
        type: 'customer',
        reference: params.reference,
        label: params.customerName,
        amount: params.amount,
        currency: params.currency,
        meta: { customerName: params.customerName, country: params.country },
      }),
      this.generate({
        ownerId: params.ownerId,
        type: 'supplier',
        reference: params.reference,
        label: params.supplierName,
        amount: params.amount,
        currency: params.currency,
        meta: {
          supplierName: params.supplierName,
          supplierNumber: params.supplierNumber,
          country: params.country,
        },
      }),
    ]);
    return { customer, supplier };
  }

  /** Public lookup by short code — used by the cashier portal. */
  async lookupByShortCode(code: string): Promise<{
    found: boolean;
    qr?: QrCode;
  }> {
    if (!code || code.length < 4) return { found: false };
    const qr = await this.repo.findOne({
      where: { shortCode: code.toUpperCase() },
    });
    return qr ? { found: true, qr } : { found: false };
  }

  /** Mark a QR code as used (cashier confirmed payout). */
  async markUsed(shortCode: string): Promise<QrCode> {
    const qr = await this.repo.findOne({ where: { shortCode } });
    if (!qr) throw new NotFoundException('QR code not found');
    qr.used = true;
    qr.usedAt = new Date();
    return this.repo.save(qr);
  }

  listByOwner(ownerId: string) {
    return this.repo.find({
      where: { ownerId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  listByReference(reference: string) {
    return this.repo.find({ where: { reference }, order: { type: 'ASC' } });
  }
}
