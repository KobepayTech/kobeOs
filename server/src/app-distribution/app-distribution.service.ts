import { BadRequestException, ForbiddenException, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { PosProduct } from '../pos/pos.entity';
import { DeveloperAppInstall, DeveloperAppListing, DeveloperAppRelease } from './app-distribution.entity';
import { compareVersions, PackageSigner, packageDigest, packagePayload, validatePackage } from './app-package';
import { InstallDeveloperAppDto, ReviewDeveloperAppDto } from './app-distribution.dto';

@Injectable()
export class AppDistributionService {
  private readonly signer: PackageSigner;
  constructor(private readonly db: DataSource, config: ConfigService, private readonly audit: AuditService) {
    this.signer = new PackageSigner(config.getOrThrow('JWT_SECRET'));
  }
  trust() { return { apiVersion: 1, keyId: this.signer.keyId, publicKey: this.signer.publicKey }; }
  private view(r: DeveloperAppRelease) { return { id: r.id, manifest: r.manifest, publisherId: r.publisherId, status: r.status, reviewNote: r.reviewNote, createdAt: r.createdAt, digest: r.digest }; }
  private check(r: DeveloperAppRelease) {
    if (packageDigest(packagePayload(r.manifest, r.html)) !== r.digest) throw new ConflictException('App files do not match the reviewed package.');
  }
  private log(tx: EntityManager, userId: string, action: 'CREATE' | 'UPDATE' | 'DELETE', entityId: string, metadata: Record<string, unknown>) {
    return this.audit.log({ userId, action, entityType: 'developer-app', entityId, metadata }, tx);
  }
  async catalogue() {
    const rows = await this.db.getRepository(DeveloperAppRelease).find({ where: { status: 'approved' }, take: 1000 });
    const latest = new Map<string, DeveloperAppRelease>();
    for (const r of rows) if (!latest.has(r.appId) || compareVersions(r.version, latest.get(r.appId)!.version) > 0) latest.set(r.appId, r);
    return [...latest.values()].map(r => this.view(r));
  }
  async mine(userId: string) { return (await this.db.getRepository(DeveloperAppRelease).find({ where: { publisherId: userId }, order: { createdAt: 'DESC' }, take: 200 })).map(r => this.view(r)); }
  async reviews() { return (await this.db.getRepository(DeveloperAppRelease).find({ order: { createdAt: 'DESC' }, take: 200 })).map(r => this.view(r)); }
  async submit(userId: string, input: unknown) {
    const { manifest, html } = validatePackage(input);
    try {
      return await this.db.transaction(async tx => {
        const listings = tx.getRepository(DeveloperAppListing);
        await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`app-publisher:${userId}`]);
        const known = await listings.findOneBy({ appId: manifest.id });
        if (!known && await listings.countBy({ publisherId: userId }) >= 25) throw new BadRequestException('This publisher has reached the preview app limit.');
        await listings.createQueryBuilder().insert().values({ appId: manifest.id, publisherId: userId }).orIgnore().execute();
        const listing = await listings.findOne({ where: { appId: manifest.id }, lock: { mode: 'pessimistic_write' } });
        if (!listing || listing.publisherId !== userId) throw new ForbiddenException('That app ID belongs to another publisher.');
        const releases = tx.getRepository(DeveloperAppRelease);
        const previous = await releases.find({ where: { appId: manifest.id } });
        if (previous.length >= 50) throw new BadRequestException('This app has reached the preview release limit.');
        if (previous.some(r => compareVersions(manifest.version, r.version) <= 0)) throw new ConflictException('Upload a higher version; submitted releases are immutable.');
        const r = await releases.save(releases.create({ appId: manifest.id, publisherId: userId, version: manifest.version, manifest, html, digest: packageDigest(packagePayload(manifest, html)), status: 'pending', reviewerId: null, reviewNote: '' }));
        await this.log(tx, userId, 'CREATE', r.id, { appId: r.appId, version: r.version, digest: r.digest });
        return this.view(r);
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw new ConflictException('That app release already exists.');
      throw error;
    }
  }
  async review(reviewerId: string, id: string, dto: ReviewDeveloperAppDto) {
    return this.db.transaction(async tx => {
      const repo = tx.getRepository(DeveloperAppRelease);
      const r = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!r) throw new NotFoundException();
      if (r.publisherId === reviewerId) throw new ForbiddenException('A different administrator must review this publisher’s app.');
      if (dto.decision === 'revoke' ? r.status !== 'approved' : r.status !== 'pending') throw new ConflictException('This release is not eligible for that decision.');
      if (!dto.note?.trim()) throw new BadRequestException('Add a review note.');
      this.check(r); r.status = dto.decision === 'approve' ? 'approved' : dto.decision === 'reject' ? 'rejected' : 'revoked';
      r.reviewerId = reviewerId; r.reviewNote = dto.note.trim();
      await repo.save(r); await this.log(tx, reviewerId, 'UPDATE', r.id, { decision: dto.decision, note: r.reviewNote });
      return this.view(r);
    });
  }
  async reviewPackage(id: string) {
    const r = await this.db.getRepository(DeveloperAppRelease).findOneBy({ id });
    if (!r) throw new NotFoundException(); this.check(r);
    return this.signer.attest(packagePayload(r.manifest, r.html));
  }
  async publisherPackage(userId: string, id: string) {
    const r = await this.db.getRepository(DeveloperAppRelease).findOneBy({ id, publisherId: userId });
    if (!r) throw new NotFoundException(); this.check(r);
    return this.signer.attest(packagePayload(r.manifest, r.html));
  }
  async installs(userId: string) {
    const rows = await this.db.getRepository(DeveloperAppInstall).find({ where: { ownerId: userId } });
    return Promise.all(rows.map(async r => {
      const release = await this.db.getRepository(DeveloperAppRelease).findOneBy({ id: r.releaseId });
      return { appId: r.appId, releaseId: r.releaseId, grants: r.grants, release: release ? this.view(release) : null };
    }));
  }
  async install(userId: string, dto: InstallDeveloperAppDto) {
    return this.db.transaction(async tx => {
      const r = await tx.getRepository(DeveloperAppRelease).findOne({ where: { id: dto.releaseId }, lock: { mode: 'pessimistic_read' } });
      if (!r || r.status !== 'approved') throw new ForbiddenException('Only reviewed, approved releases can be installed.');
      this.check(r);
      if (dto.grants.length !== r.manifest.permissions.length || r.manifest.permissions.some(p => !dto.grants.includes(p))) throw new ForbiddenException('Explicitly approve the app’s declared permissions.');
      const repo = tx.getRepository(DeveloperAppInstall);
      await repo.upsert({ ownerId: userId, appId: r.appId, releaseId: r.id, grants: [...dto.grants] }, ['ownerId', 'appId']);
      await this.log(tx, userId, 'UPDATE', r.id, { appId: r.appId, operation: 'install', version: r.version, grants: dto.grants });
      return { appId: r.appId, releaseId: r.id, grants: dto.grants, release: this.view(r) };
    });
  }
  async uninstall(userId: string, appId: string) {
    await this.db.transaction(async tx => {
      await tx.getRepository(DeveloperAppInstall).delete({ ownerId: userId, appId });
      await this.log(tx, userId, 'DELETE', appId, { operation: 'uninstall' });
    });
    return { removed: true };
  }
  private async installedRelease(userId: string, appId: string) {
    const install = await this.db.getRepository(DeveloperAppInstall).findOneBy({ ownerId: userId, appId });
    if (!install) throw new ForbiddenException('This app is not installed.');
    const r = await this.db.getRepository(DeveloperAppRelease).findOneBy({ id: install.releaseId });
    if (!r || r.status !== 'approved') throw new ForbiddenException('This release has been withdrawn.');
    this.check(r); return { install, r };
  }
  async installedPackage(userId: string, appId: string) {
    const { r } = await this.installedRelease(userId, appId);
    return this.signer.attest(packagePayload(r.manifest, r.html));
  }
  async inventory(userId: string, appId: string, version: string) {
    const { install, r } = await this.installedRelease(userId, appId);
    if (r.version !== version) throw new ForbiddenException('This app was updated. Close it and open the installed version.');
    if (!install.grants.includes('inventory.read') || !r.manifest.permissions.includes('inventory.read')) throw new ForbiddenException('Inventory access was not granted.');
    const rows = await this.db.getRepository(PosProduct).find({ where: { ownerId: userId }, select: { id: true, name: true, sku: true, stock: true, unit: true }, order: { name: 'ASC' }, take: 1001 });
    return { items: rows.slice(0, 1000), hasMore: rows.length > 1000 };
  }
}
