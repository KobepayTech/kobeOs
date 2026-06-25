import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { KobeToken } from './kobe-token.entity';

/** Unambiguous alphabet — same as the client. No O/0/I/1/L so
 *  a code written on a paper backup can't be misread. */
const ALPHA = 'ACDEFGHJKMNPQRSTUVWXYZ23456789';

function genCode(): string {
  let s = '';
  for (let i = 0; i < 6; i++) {
    s += ALPHA[crypto.randomInt(0, ALPHA.length)];
  }
  return 'KOB-' + s;
}

function hashPin(pin: string): string {
  const salt = crypto.randomBytes(8).toString('hex');
  const h = crypto.createHash('sha256').update(salt + ':' + pin).digest('hex');
  return `${salt}:${h}`;
}

function verifyPin(pin: string, stored: string): boolean {
  const [salt, h] = stored.split(':');
  if (!salt || !h) return false;
  const candidate = crypto.createHash('sha256').update(salt + ':' + pin).digest('hex');
  // Timing-safe compare so PIN guessers can't measure response time.
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(h, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export interface IssueTokenInput {
  amount: number;
  currency?: string;
  senderName: string;
  senderPhone?: string;
  receiverName: string;
  receiverPhone?: string;
  purpose?: string;
  agent?: string;
  issuedByName?: string;
  expiresInHours?: number;
  /** Operator's tenant id (from JWT) when issued through KobePay.
   *  Null for anonymous public /tuma issues. */
  issuedOwnerId?: string | null;
}

export interface RedeemTokenInput {
  pin: string;
  paidByName: string;
  paidOwnerId?: string | null;
}

export interface PublicTokenView {
  code: string;
  amount: number;
  currency: string;
  status: KobeToken['status'];
  senderName: string;
  receiverName: string;
  receiverPhone: string;
  purpose: string;
  agent: string;
  issuedByName: string;
  paidByName: string;
  paidAt?: string | null;
  expiresAt?: string | null;
}

/**
 * Service for the Kobe Token (Tuma voucher) cross-border flow.
 * Issuing and redeeming both happen here; the controller is a thin
 * REST surface and the React client (Tuma.tsx, KobePay dialog) just
 * calls it.
 *
 * PINs are hashed with sha256(salt + pin); plain PIN never persists.
 * Redeem uses timing-safe compare. After 5 wrong PIN attempts the
 * token is auto-cancelled — protects against an attacker who has a
 * shoulder-surfed code but is guessing the PIN.
 */
@Injectable()
export class KobeTokensService {
  /** Per-token wrong-PIN counter held in memory (cleared on a
   *  successful redeem or service restart). Persisting it would let
   *  an attacker probe across restarts; the in-memory window is
   *  good enough for the threat model. */
  private readonly pinAttempts = new Map<string, number>();
  private static readonly MAX_PIN_ATTEMPTS = 5;

  constructor(
    @InjectRepository(KobeToken) private readonly repo: Repository<KobeToken>,
  ) {}

  async issue(input: IssueTokenInput): Promise<{ token: PublicTokenView; pin: string }> {
    if (!input.amount || input.amount <= 0) throw new BadRequestException('amount must be > 0');
    if (!input.senderName?.trim()) throw new BadRequestException('senderName is required');
    if (!input.receiverName?.trim()) throw new BadRequestException('receiverName is required');

    // Collision-retry on the off-chance the random 6-char code is
    // already taken. Probability per attempt is ~1/30^6 = 1/729M.
    let code = '';
    for (let i = 0; i < 5; i++) {
      const candidate = genCode();
      const exists = await this.repo.findOne({ where: { code: candidate } });
      if (!exists) { code = candidate; break; }
    }
    if (!code) throw new Error('Could not generate a unique token code — try again');

    // 4-digit PIN matches the client UI. Generated server-side for
    // entropy quality (crypto.randomInt vs Math.random).
    const pin = String(crypto.randomInt(0, 10000)).padStart(4, '0');
    const expiresAt = input.expiresInHours && input.expiresInHours > 0
      ? new Date(Date.now() + input.expiresInHours * 3600_000)
      : null;

    const saved = await this.repo.save(this.repo.create({
      code,
      pinHash: hashPin(pin),
      amount: input.amount,
      currency: input.currency ?? 'TZS',
      senderName: input.senderName.trim(),
      senderPhone: input.senderPhone ?? '',
      receiverName: input.receiverName.trim(),
      receiverPhone: input.receiverPhone ?? '',
      purpose: input.purpose ?? '',
      agent: input.agent ?? '',
      status: 'PENDING',
      issuedOwnerId: input.issuedOwnerId ?? null,
      issuedByName: input.issuedByName ?? '',
      expiresAt,
    }));

    return { token: this.toPublic(saved), pin };
  }

  /** Lookup by code — public, no PIN required. The PIN is not
   *  returned (only the hash exists on the row anyway). */
  async lookup(code: string): Promise<PublicTokenView> {
    const t = await this.repo.findOne({ where: { code: this.normalize(code) } });
    if (!t) throw new NotFoundException('Token not found');
    // Auto-expire on lookup if the deadline has passed.
    if (t.status === 'PENDING' && t.expiresAt && t.expiresAt < new Date()) {
      t.status = 'EXPIRED';
      await this.repo.save(t);
    }
    return this.toPublic(t);
  }

  async redeem(code: string, input: RedeemTokenInput): Promise<PublicTokenView> {
    const norm = this.normalize(code);
    const t = await this.repo.findOne({ where: { code: norm } });
    if (!t) throw new NotFoundException('Token not found');

    if (t.status === 'PAID') {
      throw new BadRequestException(`Token already paid by ${t.paidByName || 'someone'} on ${t.paidAt?.toISOString?.() ?? 'unknown date'}`);
    }
    if (t.status === 'EXPIRED' || (t.expiresAt && t.expiresAt < new Date())) {
      t.status = 'EXPIRED';
      await this.repo.save(t);
      throw new BadRequestException('Token has expired');
    }
    if (t.status === 'CANCELLED') {
      throw new BadRequestException('Token has been cancelled');
    }

    const attempts = this.pinAttempts.get(norm) ?? 0;
    if (attempts >= KobeTokensService.MAX_PIN_ATTEMPTS) {
      // Persistent cancel so even after restart the token is dead.
      t.status = 'CANCELLED';
      await this.repo.save(t);
      throw new UnauthorizedException('Too many wrong PIN attempts — token cancelled');
    }

    if (!verifyPin(input.pin ?? '', t.pinHash)) {
      this.pinAttempts.set(norm, attempts + 1);
      throw new UnauthorizedException(`Wrong PIN (${KobeTokensService.MAX_PIN_ATTEMPTS - attempts - 1} attempts left)`);
    }

    if (!input.paidByName?.trim()) {
      throw new BadRequestException('paidByName is required to mark the token PAID');
    }

    t.status = 'PAID';
    t.paidAt = new Date();
    t.paidByName = input.paidByName.trim();
    t.paidOwnerId = input.paidOwnerId ?? null;
    await this.repo.save(t);
    this.pinAttempts.delete(norm);
    return this.toPublic(t);
  }

  /** Operator ledger — tokens this tenant issued or redeemed.
   *  Sorted newest first. */
  async listForOwner(ownerId: string, limit = 100): Promise<PublicTokenView[]> {
    const rows = await this.repo
      .createQueryBuilder('t')
      .where('t.issuedOwnerId = :uid OR t.paidOwnerId = :uid', { uid: ownerId })
      .orderBy('t.createdAt', 'DESC')
      .limit(limit)
      .getMany();
    return rows.map((r) => this.toPublic(r));
  }

  private normalize(code: string): string {
    let c = (code ?? '').trim().toUpperCase().replace(/\s+/g, '');
    if (c && !c.startsWith('KOB-')) {
      c = c.startsWith('KOB') ? 'KOB-' + c.slice(3) : 'KOB-' + c;
    }
    return c;
  }

  private toPublic(t: KobeToken): PublicTokenView {
    return {
      code: t.code,
      amount: Number(t.amount),
      currency: t.currency,
      status: t.status,
      senderName: t.senderName,
      receiverName: t.receiverName,
      receiverPhone: t.receiverPhone,
      purpose: t.purpose,
      agent: t.agent,
      issuedByName: t.issuedByName,
      paidByName: t.paidByName,
      paidAt: t.paidAt?.toISOString?.() ?? null,
      expiresAt: t.expiresAt?.toISOString?.() ?? null,
    };
  }
}
