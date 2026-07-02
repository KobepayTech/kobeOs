import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { randomBytes, createHash } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshToken } from './refresh-token.entity';

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
  ) {}

  async register(dto: RegisterDto): Promise<IssuedTokens> {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already registered');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.users.create({
      email: dto.email,
      passwordHash,
      displayName: dto.displayName ?? dto.email.split('@')[0],
    });
    return this.issue(user.id, user.email);
  }

  async login(dto: LoginDto): Promise<IssuedTokens> {
    const user = await this.users.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    return this.issue(user.id, user.email);
  }

  /**
   * Verify a manager's credentials without issuing JWTs. Used by the POS
   * "inline approve" flow when a discount exceeds the auto-approval
   * threshold and a manager needs to authorise the cashier's checkout
   * without switching the logged-in user on the till.
   *
   * Enforces role ∈ {admin, manager, owner} — a cashier cannot
   * self-approve their own over-threshold discount even if they know
   * their own credentials.
   *
   * Runs bcrypt.compare against a fixed dummy hash on the miss path
   * so the response time doesn't reveal whether the email exists.
   */
  async verifyManager(
    email: string,
    password: string,
  ): Promise<{ id: string; email: string; displayName: string; role: string }> {
    const user = await this.users.findByEmail(email);
    // Compare against a fixed hash when the email doesn't exist so the
    // timing profile matches the real-user path (~100ms bcrypt cost).
    // Prevents email enumeration via response-time analysis.
    const passwordHash = user?.passwordHash ?? AuthService.DUMMY_HASH;
    const ok = await bcrypt.compare(password, passwordHash);
    if (!user || !ok) throw new UnauthorizedException('Invalid manager credentials');
    const APPROVER_ROLES = new Set(['admin', 'manager', 'owner']);
    if (!APPROVER_ROLES.has(user.role)) {
      throw new UnauthorizedException(
        'This account cannot authorise discounts — a manager or owner must sign in',
      );
    }
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    };
  }

  /**
   * Precomputed bcrypt hash of a random 32-byte secret. Never matches
   * any real password. Used to normalise the timing of verifyManager
   * on cache-miss so email existence isn't leaked via response time.
   */
  private static readonly DUMMY_HASH =
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

  /**
   * Exchange a refresh token for a new access + refresh pair. The presented
   * token is revoked atomically so a leaked refresh token is single-use.
   */
  async refresh(rawToken: string): Promise<IssuedTokens> {
    if (!rawToken) throw new UnauthorizedException('Missing refresh token');
    const tokenHash = sha256(rawToken);
    const record = await this.refreshTokens.findOne({ where: { tokenHash } });
    if (!record) throw new UnauthorizedException('Invalid refresh token');
    if (record.revoked) throw new UnauthorizedException('Refresh token revoked');
    if (record.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }
    const user = await this.users.findById(record.userId);
    if (!user) throw new UnauthorizedException('User no longer exists');

    record.revoked = true;
    record.revokedAt = new Date();
    await this.refreshTokens.save(record);

    return this.issue(user.id, user.email);
  }

  async logout(rawToken: string): Promise<{ ok: true }> {
    if (!rawToken) return { ok: true };
    const tokenHash = sha256(rawToken);
    await this.refreshTokens.update({ tokenHash }, { revoked: true, revokedAt: new Date() });
    return { ok: true };
  }

  async revokeAllForUser(userId: string) {
    await this.refreshTokens.update(
      { userId, revoked: false },
      { revoked: true, revokedAt: new Date() },
    );
  }

  private async issue(sub: string, email: string): Promise<IssuedTokens> {
    const accessExpires = this.config.get<string>('JWT_EXPIRES_IN', '15m');
    const refreshDays = Number(this.config.get<string>('REFRESH_EXPIRES_DAYS', '30'));

    const accessToken = await this.jwt.signAsync(
      { sub, email },
      { expiresIn: accessExpires },
    );

    const refreshToken = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + refreshDays * 24 * 60 * 60 * 1000);
    await this.refreshTokens.save(
      this.refreshTokens.create({
        userId: sub,
        tokenHash: sha256(refreshToken),
        expiresAt,
        revoked: false,
      }),
    );

    return { accessToken, refreshToken, user: { id: sub, email } };
  }

  /** Nightly job: remove expired and revoked refresh tokens older than 7 days. */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async pruneRefreshTokens(): Promise<void> {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const result = await this.refreshTokens.delete({
      expiresAt: LessThan(cutoff),
    });
    const revokedResult = await this.refreshTokens
      .createQueryBuilder()
      .delete()
      .where('revoked = true AND "revokedAt" < :cutoff', { cutoff })
      .execute();
    const total = (result.affected ?? 0) + (revokedResult.affected ?? 0);
    if (total > 0) {
      new Logger('AuthService').log(`Pruned ${total} stale refresh tokens`);
    }
  }
}
