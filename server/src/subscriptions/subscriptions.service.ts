import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from './subscription.entity';
import { CreateSubscriptionDto, UpdateSubscriptionDto } from './dto/subscription.dto';
import { CompaniesService } from '../companies/companies.service';

const PLAN_PRICES: Record<string, number> = { Basic: 49, Pro: 149, Enterprise: 499 };

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription) private readonly repo: Repository<Subscription>,
    private readonly companiesService: CompaniesService,
  ) {}

  /** List all subscriptions for companies owned by this user */
  async list(ownerId: string) {
    const companies = await this.companiesService.list(ownerId);
    const companyIds = companies.map((c) => c.id);
    if (!companyIds.length) return [];
    return this.repo.find({
      where: companyIds.map((id) => ({ companyId: id })),
      relations: ['company'],
      order: { createdAt: 'DESC' },
    });
  }

  async get(ownerId: string, id: string) {
    const sub = await this.repo.findOne({ where: { id }, relations: ['company'] });
    if (!sub) throw new NotFoundException('Subscription not found');
    // Verify ownership via company
    await this.companiesService.get(ownerId, sub.companyId);
    return sub;
  }

  async create(ownerId: string, dto: CreateSubscriptionDto) {
    // Verify the company belongs to this user
    await this.companiesService.get(ownerId, dto.companyId);
    const sub = this.repo.create({
      ...dto,
      price: dto.price ?? PLAN_PRICES[dto.plan] ?? 49,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      status: 'Trial',
      autoRenew: dto.autoRenew ?? false,
      enabledModules: dto.enabledModules ?? [],
    });
    return this.repo.save(sub);
  }

  async update(ownerId: string, id: string, dto: UpdateSubscriptionDto) {
    const sub = await this.get(ownerId, id);
    if (dto.startDate) (dto as Record<string, unknown>).startDate = new Date(dto.startDate);
    if (dto.endDate) (dto as Record<string, unknown>).endDate = new Date(dto.endDate);
    Object.assign(sub, dto);
    return this.repo.save(sub);
  }

  async remove(ownerId: string, id: string) {
    const sub = await this.get(ownerId, id);
    await this.repo.remove(sub);
    return { id };
  }

  /** Expire subscriptions whose endDate has passed */
  async expireOverdue() {
    const now = new Date();
    await this.repo
      .createQueryBuilder()
      .update(Subscription)
      .set({ status: 'Expired' })
      .where('endDate < :now AND status IN (:...active)', { now, active: ['Trial', 'Active'] })
      .execute();
  }
}
