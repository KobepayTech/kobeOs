import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { User } from '../users/user.entity';
import { AiOperatingAudit } from '../ai/ai-operating.entity';
import { assertOwnerAction, ownerScope } from './business-scope';
import { WorkspaceMember } from './workspace-member.entity';

export async function workspaceScope(tx: EntityManager, actorId: string, role: string, ownerId = actorId) {
  if (ownerId === actorId) return ownerScope(actorId, role);
  // Read the live grant for every request. Global admin does not bypass it.
  const grant = await tx.findOne(WorkspaceMember, { where: { ownerId, memberId: actorId, status: 'ACTIVE' } });
  if (!grant) throw new ForbiddenException('Accept an active workspace invitation before viewing this business.');
  return { ownerId, actorId, role: 'viewer', identityModel: 'owner-account-v1' as const,
    capabilities: { readOwnBusiness: true, approveOwnActions: false, delegatedBusinessAccess: true } };
}

@Injectable()
export class WorkspaceAccessService {
  constructor(private readonly db: DataSource) {}

  list(actorId: string) {
    return this.db.getRepository(WorkspaceMember).find({ where: [{ ownerId: actorId }, { memberId: actorId }], order: { createdAt: 'DESC' }, take: 500 });
  }

  async invite(ownerId: string, role: string, memberId: string) {
    assertOwnerAction(ownerId, ownerId, role);
    if (ownerId === memberId) throw new BadRequestException('The owner already has access.');
    return this.db.transaction(async tx => {
      if (!await tx.exists(User, { where: { id: memberId } })) throw new NotFoundException('Account not found');
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [JSON.stringify(['workspace', ownerId, memberId])]);
      const prior = await tx.findOne(WorkspaceMember, { where: { ownerId, memberId } });
      if (prior && prior.status !== 'REVOKED') return prior;
      const row = await tx.save(WorkspaceMember, { ...(prior || {}), ownerId, memberId, role: 'viewer', status: 'INVITED', acceptedAt: null });
      await this.audit(tx, row, ownerId, 'WORKSPACE_INVITED');
      return row;
    });
  }

  async decide(actorId: string, role: string, id: string, action: 'accept' | 'revoke') {
    return this.db.transaction(async tx => {
      const row = await tx.findOne(WorkspaceMember, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!row || ![row.memberId, row.ownerId].includes(actorId)) throw new NotFoundException('Invitation not found');
      if (action === 'accept') {
        if (row.memberId !== actorId || row.status !== 'INVITED') throw new ForbiddenException('Only the invited account can accept a pending invitation.');
        row.status = 'ACTIVE'; row.acceptedAt = new Date();
      } else {
        if (row.ownerId === actorId) assertOwnerAction(row.ownerId, actorId, role);
        row.status = 'REVOKED';
      }
      await tx.save(row);
      await this.audit(tx, row, actorId, action === 'accept' ? 'WORKSPACE_ACCEPTED' : 'WORKSPACE_REVOKED');
      return row;
    });
  }

  private audit(tx: EntityManager, row: WorkspaceMember, actorId: string, eventType: string) {
    return tx.save(AiOperatingAudit, { ownerId: row.ownerId, actorId, eventType, module: 'workspace', action: row.status,
      metadata: { membershipId: row.id, memberId: row.memberId, role: row.role, scope: 'ALL_OWNER_ACCOUNT_RECORDS' } });
  }
}
