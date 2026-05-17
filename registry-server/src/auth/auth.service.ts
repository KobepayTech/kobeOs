import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { RegistryUser } from './user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(RegistryUser)
    private readonly users: Repository<RegistryUser>,
    private readonly jwt: JwtService,
  ) {}

  async register(email: string, password: string): Promise<{ token: string }> {
    const existing = await this.users.findOne({ where: { email } });
    if (existing) throw new ConflictException('Email already registered');
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await this.users.save(this.users.create({ email, passwordHash }));
    return { token: this.jwt.sign({ sub: user.id, email: user.email }) };
  }

  async login(email: string, password: string): Promise<{ token: string }> {
    const user = await this.users.findOne({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    return { token: this.jwt.sign({ sub: user.id, email: user.email }) };
  }

  async findById(id: string): Promise<RegistryUser | null> {
    return this.users.findOne({ where: { id } });
  }
}
