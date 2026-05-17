import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RegistryUser } from './user.entity';

export const CurrentUser = createParamDecorator(
  (field: keyof RegistryUser | undefined, ctx: ExecutionContext) => {
    const user = ctx.switchToHttp().getRequest().user as RegistryUser;
    return field ? user?.[field] : user;
  },
);
