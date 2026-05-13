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

  async getProfile(id: string) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    const { passwordHash: _ph, ...rest } = user;
    return rest;
  }

  create(data: Pick<User, 'email' | 'passwordHash' | 'displayName'>) {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.repo.update(id, dto);
    return this.getProfile(id);
  }
}
