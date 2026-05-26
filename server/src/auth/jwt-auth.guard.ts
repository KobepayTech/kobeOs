import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../common/public.decorator';

/** Stable synthetic owner id for the single-user embedded desktop edition. */
const DESKTOP_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'desktop@kobeos.local',
  role: 'admin' as const,
};

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Embedded desktop edition: the backend runs as a local Electron child
    // process (KOBEOS_DESKTOP=true) bound to localhost with no cloud login.
    // Treat every request as one local admin so the bundled apps work offline
    // without an auth flow. The hosted server never sets this env var.
    if (process.env.KOBEOS_DESKTOP === 'true') {
      context.switchToHttp().getRequest().user = DESKTOP_USER;
      return true;
    }

    return super.canActivate(context);
  }
}
