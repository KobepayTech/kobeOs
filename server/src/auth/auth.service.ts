import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { randomBytes, createHash } from 'crypto';
import * as bcrypt from 'bcryptjs';
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

    // Best-effort housekeeping: drop ancient rows so the table doesn't grow forever.
    void this.refreshTokens
      .delete({ expiresAt: LessThan(new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)) })
      .catch(() => undefined);

    return { accessToken, refreshToken, user: { id: sub, email } };
  }
}
