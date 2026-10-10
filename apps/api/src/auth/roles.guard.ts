import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './decorators/roles.decorator';
import { AuthenticatedUser } from './authenticated-user';
import { Role } from 'src/generated/prisma/enums';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles(...): any authenticated user may use the route.
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // The role comes from the user attached by the AuthGuard, itself read from the database.
    const { user } = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();

    // Denied by default: a missing user (for instance a route that is both @Public()
    // and @Roles(...)) must never open the route.
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
