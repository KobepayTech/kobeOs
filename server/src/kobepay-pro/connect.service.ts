import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { KpMerchant } from './kobepay-pro.entity';
import { PaymentService } from './payment.service';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/**
 * Kobepay Connect — lets an approved external seller (online tutoring, past
 * papers, data bundles …) charge a student through the school's rules using a
 * merchant API key. The seller never sees the student's balance or bank data;
 * Connect just returns approved / declined / needs-approval.
 */
@Injectable()
export class ConnectService {
  constructor(
    @InjectRepository(KpMerchant) private readonly merchants: Repository<KpMerchant>,
    private readonly payments: PaymentService,
  ) {}

  /** Admin: (re)issue a merchant's API key. The plaintext is shown once. */
  async issueApiKey(ownerId: string, merchantId: string) {
    const merchant = await this.merchants.findOne({ where: { ownerId, id: merchantId } });
    if (!merchant) throw new NotFoundException('Merchant not found');
    const key = `kbc_${randomBytes(24).toString('base64url')}`;
    merchant.apiKeyHash = sha256(key);
    merchant.apiKeyLast4 = key.slice(-4);
    await this.merchants.save(merchant);
    return { apiKey: key, last4: merchant.apiKeyLast4, merchantId: merchant.id };
  }

  /** Connect charge: authenticate by API key, then run the normal pay flow. */
  async charge(apiKey: string, body: {
    studentCode?: string; nfcCardId?: string; qrToken?: string;
    amount: number; description?: string; reference?: string;
  }) {
    if (!apiKey) throw new UnauthorizedException('Missing API key');
    const merchant = await this.merchants.findOne({ where: { apiKeyHash: sha256(apiKey) } });
    if (!merchant) throw new UnauthorizedException('Invalid API key');
    if (!(body.amount > 0)) throw new BadRequestException('amount must be positive');

    const receipt = await this.payments.pay(merchant.ownerId, {
      studentCode: body.studentCode, nfcCardId: body.nfcCardId, qrToken: body.qrToken,
      merchantId: merchant.id, amount: body.amount,
      device: 'connect-api', description: body.description || `Connect: ${merchant.name}`,
    });
    // Return only what an external caller should see.
    return {
      status: receipt.status,
      reason: receipt.reason,
      reference: receipt.reference ?? null,
      amount: receipt.amount,
      merchant: merchant.name,
      externalReference: body.reference ?? null,
    };
  }
}
