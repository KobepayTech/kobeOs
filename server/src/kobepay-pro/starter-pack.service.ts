import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import {
  KpGroupOrder, KpPurchaseGroup, KpStarterPack, KpStudent,
} from './kobepay-pro.entity';
import { WalletService } from './wallet.service';

const CENTS = 1e4;
const round = (n: number) => Math.round(n * CENTS) / CENTS;
const ALPHA = 'ACDEFGHJKMNPQRTUVWXY34679';
const short = (n: number) => {
  const b = randomBytes(n); let s = '';
  for (let i = 0; i < n; i++) s += ALPHA[b[i] % ALPHA.length];
  return s;
};

@Injectable()
export class StarterPackService {
  constructor(
    @InjectRepository(KpStarterPack) private readonly packs: Repository<KpStarterPack>,
    @InjectRepository(KpPurchaseGroup) private readonly groups: Repository<KpPurchaseGroup>,
    @InjectRepository(KpGroupOrder) private readonly orders: Repository<KpGroupOrder>,
    @InjectRepository(KpStudent) private readonly students: Repository<KpStudent>,
    private readonly wallets: WalletService,
    private readonly dataSource: DataSource,
  ) {}

  async createPack(ownerId: string, dto: {
    schoolId: string; name: string; className?: string; description?: string;
    items: Array<{ groupId: string; qty?: number }>;
  }) {
    if (!dto.name?.trim()) throw new BadRequestException('Pack name is required');
    const items = (dto.items ?? []).map((i) => ({ groupId: i.groupId, qty: Math.max(1, Math.floor(i.qty ?? 1)) }));
    if (!items.length) throw new BadRequestException('Add at least one item (a purchase group)');
    // Validate the referenced groups belong to this owner/school.
    const groups = await this.groups.find({ where: { ownerId, id: In(items.map((i) => i.groupId)) } });
    if (groups.length !== new Set(items.map((i) => i.groupId)).size) throw new BadRequestException('One or more groups were not found');
    return this.packs.save(this.packs.create({
      ownerId, schoolId: dto.schoolId, name: dto.name, className: dto.className || '',
      description: dto.description || '', items, active: true,
    }));
  }

  listPacks(ownerId: string, schoolId?: string) {
    return this.packs.find({ where: { ownerId, ...(schoolId ? { schoolId } : {}) }, order: { createdAt: 'DESC' } });
  }

  async getPack(ownerId: string, id: string) {
    const pack = await this.packs.findOne({ where: { ownerId, id } });
    if (!pack) throw new NotFoundException('Starter pack not found');
    const groups = await this.groups.find({ where: { ownerId, id: In(pack.items.map((i) => i.groupId)) } });
    const items = pack.items.map((i) => {
      const g = groups.find((x) => x.id === i.groupId);
      return {
        groupId: i.groupId, qty: i.qty,
        title: g?.title ?? 'Item', productName: g?.productName ?? '',
        unitPrice: g?.groupPrice ?? 0, normalPrice: g?.normalPrice ?? 0,
        lineTotal: round((g?.groupPrice ?? 0) * i.qty), status: g?.status ?? 'MISSING',
      };
    });
    return {
      pack: { id: pack.id, name: pack.name, className: pack.className, description: pack.description, active: pack.active, schoolId: pack.schoolId },
      items,
      total: round(items.reduce((s, x) => s + x.lineTotal, 0)),
      normalTotal: round(items.reduce((s, x) => s + x.normalPrice * x.qty, 0)),
    };
  }

  async setActive(ownerId: string, id: string, active: boolean) {
    const pack = await this.packs.findOne({ where: { ownerId, id } });
    if (!pack) throw new NotFoundException('Starter pack not found');
    pack.active = active;
    return this.packs.save(pack);
  }

  /**
   * Buy the whole pack for a student in one atomic transaction: reserve money
   * into each referenced group's escrow and create a group order per item. If
   * any item fails (closed group, already joined, insufficient balance) the
   * whole purchase rolls back.
   */
  async buyPack(ownerId: string, packId: string, dto: { studentId: string }) {
    return this.dataSource.transaction(async (m) => {
      const pack = await m.findOne(KpStarterPack, { where: { ownerId, id: packId } });
      if (!pack) throw new NotFoundException('Starter pack not found');
      if (!pack.active) throw new BadRequestException('This pack is not available');
      const student = await m.findOne(KpStudent, { where: { ownerId, id: dto.studentId } });
      if (!student) throw new NotFoundException('Student not found');

      const created: Array<{ groupId: string; reference: string; amount: number }> = [];
      for (const item of pack.items) {
        const group = await m.findOne(KpPurchaseGroup, { where: { ownerId, id: item.groupId } });
        if (!group) throw new BadRequestException('A pack item is no longer available');
        if (group.status !== 'OPEN') throw new BadRequestException(`${group.title} is no longer open to join`);
        if (group.deadline && group.deadline.getTime() < Date.now()) throw new BadRequestException(`${group.title}: the join deadline has passed`);
        const dup = await m.findOne(KpGroupOrder, { where: { ownerId, groupId: group.id, studentId: student.id, status: 'RESERVED' } });
        if (dup) continue; // already in this group — skip, don't double-charge
        const amount = round(group.groupPrice * item.qty);
        const hold = await this.wallets.reserveIn(m, ownerId, student.id, amount, `Pack: ${pack.name} — ${group.title}`, group.id);
        const order = await m.save(m.create(KpGroupOrder, {
          ownerId, groupId: group.id, schoolId: group.schoolId, studentId: student.id,
          reference: `KO${short(6)}`, qty: item.qty, unitPrice: group.groupPrice, amount,
          holdId: hold.id, status: 'RESERVED',
        }));
        created.push({ groupId: group.id, reference: order.reference, amount });
      }
      return {
        bought: created.length,
        total: round(created.reduce((s, c) => s + c.amount, 0)),
        orders: created,
      };
    });
  }
}
