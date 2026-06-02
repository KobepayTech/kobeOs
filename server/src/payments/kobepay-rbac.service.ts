import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KobePayAuditEvent, KobePayRole, KobePayUser } from './kobepay-rbac.entity';

/**
 * Permission keys recognised across KobePay. Each role gets a default
 * set; the Admin role gets everything, the Auditor only read access,
 * cashiers narrowly scoped to their station.
 */
export const PERMISSIONS = [
  'user.manage',
  'permission.manage',
  'rate.manage',
  'rate.override',
  'rate.setReal',
  'deposit.create',
  'deposit.confirm',
  'deposit.reverse',
  'payout.create',
  'payout.advance',
  'payout.confirm',
  'payout.markPaid',
  'payout.reverse',
  'allocation.create',
  'customer.create',
  'customer.read',
  'customer.update',
  'customer.delete',
  'supplier.create',
  'supplier.read',
  'supplier.update',
  'supplier.delete',
  'receipt.read',
  'report.profit.view',
  'report.cashier.view',
  'report.risk.view',
  'audit.view',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_DEFAULTS: Record<KobePayRole, Permission[]> = {
  Admin: [...PERMISSIONS],
  Manager: [
    'deposit.create', 'deposit.confirm', 'deposit.reverse',
    'payout.create', 'payout.advance', 'payout.confirm', 'payout.markPaid',
    'allocation.create',
    'customer.create', 'customer.read', 'customer.update',
    'supplier.create', 'supplier.read', 'supplier.update',
    'receipt.read', 'report.profit.view', 'report.cashier.view', 'report.risk.view', 'audit.view',
  ],
  'Cashier TZ': [
    'deposit.create', 'customer.create', 'customer.read', 'customer.update',
    'allocation.create', 'receipt.read',
  ],
  'Cashier China': [
    'payout.advance', 'payout.confirm', 'payout.markPaid',
    'supplier.read', 'receipt.read',
  ],
  Auditor: [
    'customer.read', 'supplier.read', 'receipt.read',
    'report.profit.view', 'report.cashier.view', 'report.risk.view', 'audit.view',
  ],
};

export interface AuditContext {
  user?: KobePayUser | null;
  actorName?: string;
}

@Injectable()
export class KobePayRbacService {
  constructor(
    @InjectRepository(KobePayUser) private readonly users: Repository<KobePayUser>,
    @InjectRepository(KobePayAuditEvent) private readonly audits: Repository<KobePayAuditEvent>,
  ) {}

  /* ── User CRUD ── */
  list(uid: string) {
    return this.users.find({ where: { ownerId: uid }, order: { role: 'ASC', name: 'ASC' } });
  }

  async create(uid: string, dto: { name: string; role: KobePayRole; pin: string; phone?: string }) {
    if (!/^\d{4}$/.test(dto.pin)) throw new BadRequestException('Pin must be exactly 4 digits');
    const dupe = await this.users.findOne({ where: { ownerId: uid, pin: dto.pin } });
    if (dupe) throw new BadRequestException('Pin already in use; pick a different 4 digits');
    return this.users.save(this.users.create({
      ownerId: uid, name: dto.name, role: dto.role, pin: dto.pin,
      phone: dto.phone ?? '', active: true,
    }));
  }

  async update(uid: string, id: string, dto: { name?: string; role?: KobePayRole; phone?: string; active?: boolean; permissions?: Record<string, boolean> | null }) {
    const u = await this.users.findOne({ where: { id, ownerId: uid } });
    if (!u) throw new NotFoundException();
    Object.assign(u, dto);
    return this.users.save(u);
  }

  async remove(uid: string, id: string) {
    const u = await this.users.findOne({ where: { id, ownerId: uid } });
    if (!u) throw new NotFoundException();
    await this.users.remove(u);
    return { id };
  }

  /** Resolve the actor for an incoming request. Header X-KobePay-Pin
   *  identifies which cashier is at the till; absent = no sub-user
   *  context (anonymous Admin from the JWT). */
  async resolveActor(uid: string, pin?: string): Promise<KobePayUser | null> {
    if (!pin) return null;
    const u = await this.users.findOne({ where: { ownerId: uid, pin, active: true } });
    return u ?? null;
  }

  /**
   * Permission check. Admin always allowed. Otherwise checks per-user
   * overrides first, then role defaults. When no actor is supplied
   * we trust the JWT (the business owner) and allow.
   */
  ensure(actor: KobePayUser | null, permission: Permission): void {
    if (!actor) return; // No sub-user => trust the owner JWT.
    if (actor.role === 'Admin') return;
    const overrides = actor.permissions ?? {};
    if (overrides[permission] === false) {
      throw new ForbiddenException(`Cashier '${actor.name}' lacks permission ${permission}`);
    }
    if (overrides[permission] === true) return;
    const defaults = ROLE_DEFAULTS[actor.role] ?? [];
    if (!defaults.includes(permission)) {
      throw new ForbiddenException(`Role ${actor.role} cannot perform ${permission}`);
    }
  }

  /** Record an audit event. Best-effort — failures don't block the action. */
  async record(uid: string, ctx: AuditContext, action: string, resourceType: string, resourceId: string | null, metadata?: unknown) {
    try {
      await this.audits.save(this.audits.create({
        ownerId: uid,
        actorUserId: ctx.user?.id ?? null,
        actorName: ctx.user?.name ?? (ctx.actorName ?? 'owner'),
        actorRole: ctx.user?.role ?? 'Owner',
        action,
        resourceType,
        resourceId: resourceId ?? null,
        metadata: (metadata ?? null) as Record<string, unknown> | null,
      }));
    } catch { /* swallow */ }
  }

  listAudit(uid: string, limit = 200) {
    return this.audits.find({
      where: { ownerId: uid },
      order: { createdAt: 'DESC' },
      take: Math.min(1000, Math.max(1, limit)),
    });
  }
}
