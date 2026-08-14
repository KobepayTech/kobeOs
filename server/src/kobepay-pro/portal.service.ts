import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KpGroupOrder, KpPurchaseGroup, KpStarterPack, KpStudent, KpTransaction } from './kobepay-pro.entity';
import { WalletService } from './wallet.service';
import { GroupsService } from './groups.service';
import { StarterPackService } from './starter-pack.service';

/**
 * Parent/student portal — public, accessed by the student's QR token (a
 * capability, no login). Shows the wallet (Available/Restricted/Reserved/
 * Savings), history, how to top up, joinable purchase groups, starter packs,
 * and the student's orders with collection status.
 */
@Injectable()
export class PortalService {
  constructor(
    @InjectRepository(KpStudent) private readonly students: Repository<KpStudent>,
    @InjectRepository(KpTransaction) private readonly txns: Repository<KpTransaction>,
    @InjectRepository(KpPurchaseGroup) private readonly groups: Repository<KpPurchaseGroup>,
    @InjectRepository(KpGroupOrder) private readonly orders: Repository<KpGroupOrder>,
    @InjectRepository(KpStarterPack) private readonly packs: Repository<KpStarterPack>,
    private readonly wallets: WalletService,
    private readonly groupsSvc: GroupsService,
    private readonly packsSvc: StarterPackService,
  ) {}

  private async resolve(token: string): Promise<KpStudent> {
    const student = await this.students.findOne({ where: { qrToken: token } });
    if (!student) throw new NotFoundException('Student link not found');
    return student;
  }

  async portal(token: string) {
    const s = await this.resolve(token);
    const wallet = await this.wallets.view(s.ownerId, s.id);
    const history = await this.txns.find({ where: { ownerId: s.ownerId, studentId: s.id }, order: { createdAt: 'DESC' }, take: 40 });
    const openGroups = await this.groups.find({ where: { ownerId: s.ownerId, schoolId: s.schoolId, status: 'OPEN' }, order: { createdAt: 'DESC' } });
    const myOrders = await this.orders.find({ where: { ownerId: s.ownerId, studentId: s.id }, order: { createdAt: 'DESC' }, take: 50 });
    const groupById = new Map(openGroups.map((g) => [g.id, g]));
    const joinedIds = new Set(myOrders.filter((o) => o.status === 'RESERVED').map((o) => o.groupId));
    const activePacks = await this.packs.find({ where: { ownerId: s.ownerId, schoolId: s.schoolId, active: true } });

    return {
      student: { name: s.name, code: s.studentCode, className: s.className },
      // How a parent tops up: deposit to the school account with this reference.
      topUp: { reference: `KBP${s.studentCode}`, note: 'Use this reference on your M-Pesa/bank deposit so it credits automatically.' },
      wallet,
      history: history.map((t) => ({ kind: t.kind, category: t.category, amount: t.amount, description: t.description, at: t.createdAt })),
      groups: openGroups.map((g) => ({
        id: g.id, title: g.title, productName: g.productName, groupPrice: g.groupPrice, normalPrice: g.normalPrice,
        deadline: g.deadline, deliveryLocation: g.deliveryLocation, joined: joinedIds.has(g.id),
      })),
      packs: activePacks.map((p) => ({ id: p.id, name: p.name, className: p.className, items: p.items.length })),
      orders: myOrders.map((o) => ({
        reference: o.reference, groupTitle: groupById.get(o.groupId)?.title ?? 'Order', qty: o.qty, amount: o.amount,
        status: o.status, collected: !!o.collectedAt, collectedAt: o.collectedAt,
      })),
      currency: wallet.currency,
    };
  }

  async join(token: string, groupId: string, qty?: number) {
    const s = await this.resolve(token);
    await this.groupsSvc.joinGroup(s.ownerId, groupId, { studentId: s.id, qty });
    return this.portal(token);
  }

  async buyPack(token: string, packId: string) {
    const s = await this.resolve(token);
    await this.packsSvc.buyPack(s.ownerId, packId, { studentId: s.id });
    return this.portal(token);
  }
}
