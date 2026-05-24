import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Company } from '../companies/company.entity';
import { Subscription } from '../subscriptions/subscription.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)         private readonly users: Repository<User>,
    @InjectRepository(Company)      private readonly companies: Repository<Company>,
    @InjectRepository(Subscription) private readonly subscriptions: Repository<Subscription>,
  ) {}

  // ── Stats ─────────────────────────────────────────────────────────────────

  async getStats() {
    const [totalUsers, totalCompanies, totalSubs] = await Promise.all([
      this.users.count(),
      this.companies.count(),
      this.subscriptions.count(),
    ]);
    const activeSubs   = await this.subscriptions.count({ where: { status: 'Active' } });
    const trialSubs    = await this.subscriptions.count({ where: { status: 'Trial' } });
    const expiredSubs  = await this.subscriptions.count({ where: { status: 'Expired' } });
    const adminUsers   = await this.users.count({ where: { role: 'admin' } });
    const activeComps  = await this.companies.count({ where: { status: 'Active' } });
    const suspComps    = await this.companies.count({ where: { status: 'Suspended' } });

    // Monthly revenue estimate from active subscriptions
    const activeSubs_ = await this.subscriptions.find({ where: { status: 'Active' } });
    const mrr = activeSubs_.reduce((s, sub) => s + Number(sub.price), 0);

    return {
      users:         { total: totalUsers, admins: adminUsers, regular: totalUsers - adminUsers },
      companies:     { total: totalCompanies, active: activeComps, suspended: suspComps },
      subscriptions: { total: totalSubs, active: activeSubs, trial: trialSubs, expired: expiredSubs },
      mrr,
    };
  }

  // ── Users (global) ────────────────────────────────────────────────────────

  listUsers(page = 1, limit = 50) {
    return this.users.find({
      select: ['id', 'email', 'displayName', 'avatarUrl', 'role', 'createdAt'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async getUser(id: string) {
    const u = await this.users.findOne({ where: { id }, select: ['id', 'email', 'displayName', 'avatarUrl', 'role', 'createdAt'] });
    if (!u) throw new NotFoundException('User not found');
    return u;
  }

  async updateUserRole(id: string, role: 'user' | 'admin') {
    const u = await this.users.findOne({ where: { id } });
    if (!u) throw new NotFoundException('User not found');
    u.role = role;
    await this.users.save(u);
    const { passwordHash: _, ...rest } = u;
    return rest;
  }

  async deleteUser(id: string) {
    const u = await this.users.findOne({ where: { id } });
    if (!u) throw new NotFoundException('User not found');
    await this.users.remove(u);
    return { id };
  }

  // ── Companies (global) ────────────────────────────────────────────────────

  listCompanies(page = 1, limit = 50) {
    return this.companies.find({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async getCompany(id: string) {
    const c = await this.companies.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Company not found');
    return c;
  }

  async createCompany(dto: { name: string; email: string; country?: string; phone?: string; ownerId?: string }) {
    return this.companies.save(this.companies.create({
      ...dto,
      ownerId: dto.ownerId ?? '00000000-0000-0000-0000-000000000000',
      status: 'Active',
    }));
  }

  async updateCompanyStatus(id: string, status: string) {
    const c = await this.getCompany(id);
    (c as any).status = status;
    return this.companies.save(c);
  }

  async deleteCompany(id: string) {
    const c = await this.getCompany(id);
    await this.companies.remove(c);
    return { id };
  }

  // ── Subscriptions (global) ────────────────────────────────────────────────

  listSubscriptions(page = 1, limit = 50) {
    return this.subscriptions.find({
      relations: ['company'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async cancelSubscription(id: string) {
    const s = await this.subscriptions.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Subscription not found');
    s.status = 'Cancelled';
    s.autoRenew = false;
    return this.subscriptions.save(s);
  }

  async updateSubscription(id: string, dto: { status?: string; endDate?: string; autoRenew?: boolean }) {
    const s = await this.subscriptions.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Subscription not found');
    if (dto.status)   s.status = dto.status as typeof s.status;
    if (dto.endDate)  s.endDate = new Date(dto.endDate) as unknown as Date;
    if (dto.autoRenew !== undefined) s.autoRenew = dto.autoRenew;
    return this.subscriptions.save(s);
  }
}
