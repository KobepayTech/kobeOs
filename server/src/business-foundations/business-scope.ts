import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

export function ownerScope(actorId: string, role: string, requestedOwnerId = actorId) {
  if (!actorId) throw new UnauthorizedException();
  // An administrator is not a wildcard across businesses. Existing modules are
  // owner-account scoped; organization delegation needs explicit memberships.
  if (requestedOwnerId !== actorId) throw new ForbiddenException('This account cannot access another owner’s business scope.');
  return { ownerId: actorId, actorId, role, identityModel: 'owner-account-v1' as const,
    capabilities: { readOwnBusiness: true, approveOwnActions: ['user', 'admin'].includes(role), delegatedBusinessAccess: false },
  };
}
export function assertOwnerAction(ownerId: string, actorId: string, role: string) {
  const scope = ownerScope(actorId, role, ownerId);
  if (!scope.capabilities.approveOwnActions) throw new ForbiddenException('This role cannot approve or execute business actions.');
  return scope;
}
