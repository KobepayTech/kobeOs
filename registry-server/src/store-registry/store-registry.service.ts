import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StoreRegistration } from './store-registration.entity';
import { ClaimDto, HeartbeatDto } from './dto/registry.dto';
import { CloudflareService } from './cloudflare.service';
import { ConfigService } from '@nestjs/config';

const RESERVED = new Set([
  'www','api','admin','mail','smtp','imap','pop','pop3','ftp','sftp',
  'ssh','vpn','cdn','static','assets','support','help','status','dev',
  'staging','beta','app','dashboard','panel','portal','auth','login',
  'signup','registry','store','stores','kobeos','kobe',
]);

@Injectable()
export class StoreRegistryService {
  private readonly logger = new Logger(StoreRegistryService.name);

  constructor(
    @InjectRepository(StoreRegistration)
    private readonly repo: Repository<StoreRegistration>,
    private readonly cf: CloudflareService,
    private readonly cfg: ConfigService,
  ) {}

  private get domain() { return this.cfg.get('CF_DOMAIN', 'kobeapptz.com'); }

  async check(slug: string): Promise<{ available: boolean; reason?: string }> {
    if (RESERVED.has(slug)) return { available: false, reason: 'reserved' };
    const existing = await this.repo.findOne({ where: { slug } });
    return existing ? { available: false, reason: 'taken' } : { available: true };
  }

  async claim(ownerId: string, dto: ClaimDto): Promise<StoreRegistration> {
    const slug = dto.slug.toLowerCase();
    if (RESERVED.has(slug)) throw new BadRequestException(`"${slug}" is reserved`);

    const existing = await this.repo.findOne({ where: { slug } });

    if (existing) {
      if (existing.ownerId !== ownerId) throw new ConflictException(`"${slug}" is already taken`);
      if (existing.serverIp !== dto.serverIp && existing.cfRecordId) {
        await this.cf.updateARecord(existing.cfRecordId, slug, dto.serverIp);
        existing.serverIp = dto.serverIp;
      }
      existing.serverPort = dto.serverPort ?? existing.serverPort;
      existing.storeName = dto.storeName ?? existing.storeName;
      existing.status = 'active';
      existing.lastSeenAt = new Date();
      return this.repo.save(existing);
    }

    const cfRecordId = await this.cf.createARecord(slug, dto.serverIp);
    return this.repo.save(this.repo.create({
      slug,
      serverIp: dto.serverIp,
      serverPort: dto.serverPort ?? 3000,
      cfRecordId,
      status: 'active',
      ownerId,
      storeName: dto.storeName ?? slug,
      lastSeenAt: new Date(),
    }));
  }

  async unpublish(ownerId: string, slug: string): Promise<{ ok: boolean }> {
    const reg = await this.repo.findOne({ where: { slug, ownerId } });
    if (!reg) throw new NotFoundException('Registration not found');
    if (reg.cfRecordId) await this.cf.deleteARecord(reg.cfRecordId);
    reg.status = 'inactive';
    reg.cfRecordId = null;
    await this.repo.save(reg);
    return { ok: true };
  }

  async heartbeat(ownerId: string, dto: HeartbeatDto): Promise<{ ok: boolean }> {
    const reg = await this.repo.findOne({ where: { slug: dto.slug, ownerId } });
    if (!reg) return { ok: false };
    if (reg.serverIp !== dto.serverIp && reg.cfRecordId) {
      await this.cf.updateARecord(reg.cfRecordId, dto.slug, dto.serverIp);
      reg.serverIp = dto.serverIp;
    }
    reg.lastSeenAt = new Date();
    reg.status = 'active';
    await this.repo.save(reg);
    return { ok: true };
  }

  list(ownerId: string): Promise<StoreRegistration[]> {
    return this.repo.find({ where: { ownerId }, order: { createdAt: 'DESC' } });
  }

  /** List all active stores — public, used by the wildcard proxy */
  listAll(): Promise<StoreRegistration[]> {
    return this.repo.find({ where: { status: 'active' } });
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async markStale(): Promise<void> {
    const cutoff = new Date(Date.now() - 10 * 60 * 1000);
    const stale = await this.repo
      .createQueryBuilder('r')
      .where('r.status = :s', { s: 'active' })
      .andWhere('r.lastSeenAt < :c', { c: cutoff })
      .getMany();
    if (!stale.length) return;
    for (const r of stale) r.status = 'inactive';
    await this.repo.save(stale);
    this.logger.log(`Marked ${stale.length} stale registration(s) inactive`);
  }
}
