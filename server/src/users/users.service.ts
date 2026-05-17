import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { UpdateUserDto } from './dto/update-user.dto';

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
