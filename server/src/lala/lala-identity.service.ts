import { BadRequestException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LalaPhoneChallenge } from './lala-phone-challenge.entity';
import { createHash, randomBytes, randomInt } from 'crypto';
import { BeemService } from '../notifications/beem.service';
import { normalizePhone } from '../commerce/commerce.rules';

const digest = (phone: string, value: string) => createHash('sha256').update(`${phone}:${value}`).digest('hex');

@Injectable()
export class LalaIdentityService {
  constructor(private readonly ds: DataSource, private readonly sms: BeemService) {}
  private phone(raw: string) {
    const phone = normalizePhone(raw);
    if (!/^\+\d{10,15}$/.test(phone)) throw new BadRequestException('Enter a valid phone number.');
    return phone;
  }
  async request(raw: string) {
    const phone = this.phone(raw);
    const code = String(randomInt(100000, 1000000));
    const codeHash = digest(phone, code);
    await this.ds.transaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`lala-otp:${phone}`]);
      const repo = tx.getRepository(LalaPhoneChallenge);
      const previous = await repo.findOneBy({ phone });
      if (previous && Date.now() - previous.sentAt.getTime() < 60000) throw new BadRequestException('Wait one minute before requesting another code.');
      await repo.save({ phone, codeHash, attempts: 0, proofHash: null, sentAt: new Date(), expiresAt: new Date(Date.now() + 300000) });
    });
    const result = await this.sms.sendSms(phone, `Your Lala verification code is ${code}. Expires in 5 minutes. Do not share it.`).catch(() => ({ ok: false }));
    if (!result.ok) {
      await this.ds.getRepository(LalaPhoneChallenge).update({ phone, codeHash }, { codeHash: '', expiresAt: new Date(0) });
      throw new ServiceUnavailableException('Verification SMS could not be sent. Please try again later.');
    }
    return { sent: true };
  }
  async verify(raw: string, code: string) {
    const phone = this.phone(raw);
    const proof = randomBytes(32).toString('base64url');
    const valid = await this.ds.transaction(async (tx) => {
      const repo = tx.getRepository(LalaPhoneChallenge);
      const row = await repo.findOne({ where: { phone }, lock: { mode: 'pessimistic_write' } });
      if (!row || row.proofHash || row.expiresAt <= new Date() || row.attempts >= 5) return false;
      row.attempts++;
      const matched = digest(phone, String(code).trim()) === row.codeHash;
      if (matched) { row.codeHash = ''; row.proofHash = digest(phone, proof); row.expiresAt = new Date(Date.now() + 600000); }
      // Persist failed attempts before throwing outside the transaction.
      await repo.save(row);
      return matched;
    });
    if (!valid) throw new UnauthorizedException('Invalid or expired code. Request a new code if needed.');
    return { phoneToken: proof, phone };
  }
  async authorize(raw: string, proof?: string) {
    const phone = this.phone(raw);
    if (!proof) throw new UnauthorizedException('Verify your phone before creating or recovering a Lala passport.');
    const row = await this.ds.getRepository(LalaPhoneChallenge).findOneBy({ phone, proofHash: digest(phone, proof) });
    if (!row || row.expiresAt <= new Date()) throw new UnauthorizedException('Phone verification expired. Please verify again.');
    return phone;
  }
}
