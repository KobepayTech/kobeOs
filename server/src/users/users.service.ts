import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './user.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly repo: Repository<User>) {}

  findByEmail(email: string) {
    return this.repo.findOne({ where: { email } });
  }

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  findAll() {
    return this.repo.find({ select: ['id', 'email', 'displayName', 'avatarUrl', 'role', 'createdAt'] });
  }

  async getProfile(id: string) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...rest } = user;
    return rest;
  }

  create(data: Pick<User, 'email' | 'passwordHash' | 'displayName'>) {
    return this.repo.save(this.repo.create(data));
  }

  /**
   * Admin creates a full account and sets its initial password. The password
   * is hashed here (never stored in the clear); the caller returns the safe
   * profile (no passwordHash). Rejects a duplicate email up front so the admin
   * gets a clear 409 instead of a raw unique-constraint error.
   */
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
