import { ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './user.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(@InjectRepository(User) private readonly repo: Repository<User>) {}

  /**
   * Create the first self-hosted admin only when the operator explicitly
   * supplies bootstrap credentials. The variables should be removed after
   * the first successful boot; existing users are never promoted implicitly.
   */
  async onModuleInit(): Promise<void> {
    const email = process.env.KOBEOS_BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.KOBEOS_BOOTSTRAP_ADMIN_PASSWORD;
    if (!email && !password) return;
    if (!email || !password) {
      throw new Error('KOBEOS_BOOTSTRAP_ADMIN_EMAIL and KOBEOS_BOOTSTRAP_ADMIN_PASSWORD must be set together');
    }
    if (password.length < 12) {
      throw new Error('KOBEOS_BOOTSTRAP_ADMIN_PASSWORD must contain at least 12 characters');
    }

    const existing = await this.findByEmail(email);
    if (existing) {
      this.logger.warn(`Bootstrap admin skipped because ${email} already exists; no role or password was changed`);
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await this.repo.save(this.repo.create({
      email,
      passwordHash,
      displayName: process.env.KOBEOS_BOOTSTRAP_ADMIN_DISPLAY_NAME?.trim() || 'KobeOS Admin',
      role: 'admin',
    }));
    this.logger.log(`Bootstrap admin ${email} created; remove KOBEOS_BOOTSTRAP_ADMIN_* after signing in`);
  }

  findByEmail(email: string) {
    return this.repo.findOne({ where: { email: email.trim().toLowerCase() } });
  }

  findByPhone(phone: string) {
    return this.repo.findOne({ where: { phone } });
  }

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  findAll() {
    return this.repo.find({
      select: ['id', 'email', 'phone', 'displayName', 'avatarUrl', 'role', 'createdAt'],
      order: { createdAt: 'DESC' },
    });
  }

  async getProfile(id: string) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    const { passwordHash: _passwordHash, ...rest } = user;
    return rest;
  }

  create(data: Pick<User, 'email' | 'passwordHash' | 'displayName'> & Partial<Pick<User, 'phone' | 'avatarUrl'>>) {
    return this.repo.save(this.repo.create(data));
  }

  async createByAdmin(dto: CreateUserDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.findByEmail(email);
    if (existing) throw new ConflictException('A user with that email already exists');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.repo.save(
      this.repo.create({
        email,
        passwordHash,
        displayName: dto.displayName?.trim() ?? '',
        role: dto.role ?? 'user',
      }),
    );
    return this.getProfile(user.id);
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.repo.update(id, dto);
    return this.getProfile(id);
  }

  async adminUpdate(id: string, dto: AdminUpdateUserDto) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    const patch: Partial<User> = {};
    if (dto.displayName !== undefined) patch.displayName = dto.displayName.trim();
    if (dto.role !== undefined) patch.role = dto.role;
    if (Object.keys(patch).length) await this.repo.update(id, patch);
    return this.getProfile(id);
  }

  async setPasswordHash(id: string, passwordHash: string) {
    await this.repo.update(id, { passwordHash });
  }

  async remove(id: string) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException();
    await this.repo.remove(user);
    return { id };
  }
}
