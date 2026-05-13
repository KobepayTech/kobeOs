import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { PasswordReset } from './password-reset.entity';
import { AuthService, sha256 } from './auth.service';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger('PasswordReset');

  constructor(
    @InjectRepository(PasswordReset) private readonly repo: Repository<PasswordReset>,
    private readonly users: UsersService,
    private readonly auth: AuthService,
  ) {}

  /**
   * Issue a one-time reset token. The raw token is returned so dev/integration
   * tests can use it directly; in production it should be delivered via email
   * and the response should always return `{ ok: true }` regardless of whether
   * the email exists, to avoid account enumeration.
   */
  async createToken(email: string): Promise<{ ok: true; resetToken?: string }> {
    const user = await this.users.findByEmail(email);
    if (!user) return { ok: true };

    const raw = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await this.repo.save(
      this.repo.create({
        userId: user.id,
        tokenHash: sha256(raw),
        expiresAt,
        used: false,
      }),
    );
    this.logger.log(`Password reset issued for ${email}`);
    return { ok: true, resetToken: raw };
  }

  async reset(token: string, newPassword: string): Promise<{ ok: true }> {
    if (!token) throw new BadRequestException('Missing token');
    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }
    const record = await this.repo.findOne({ where: { tokenHash: sha256(token) } });
    if (!record) throw new NotFoundException('Reset token not found');
    if (record.used) throw new BadRequestException('Token already used');
    if (record.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Token expired');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.users.setPasswordHash(record.userId, passwordHash);

    record.used = true;
    await this.repo.save(record);

    // Force re-auth on every device: revoke all refresh tokens.
    await this.auth.revokeAllForUser(record.userId);
    return { ok: true };
  }
}
