import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';

/**
 * Machine-to-machine auth for the continuity sync endpoints.
 *
 * A shared secret rather than a user JWT: the peer is a server, not a person,
 * and a user token would carry an owner identity that has no meaning for a
 * process replicating every owner's catalogue.
 *
 * Refuses when CONTINUITY_SYNC_TOKEN is unset. These routes move the whole
 * catalogue and every unsynced transaction, so an unconfigured deployment must
 * expose nothing rather than default to open.
 */
@Injectable()
export class SyncTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('CONTINUITY_SYNC_TOKEN');
    if (!expected || expected.length < 32) {
      throw new UnauthorizedException('Continuity sync is not configured on this instance.');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers['x-continuity-token'];
    const presented = Array.isArray(header) ? header[0] : header;
    if (typeof presented !== 'string' || !presented) {
      throw new UnauthorizedException('Missing continuity sync token.');
    }

    // Constant-time, and length-checked first because timingSafeEqual throws
    // on a length mismatch — which would itself leak the expected length.
    const a = Buffer.from(presented);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid continuity sync token.');
    }
    return true;
  }
}
