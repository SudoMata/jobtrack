import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccountStatus } from '../generated/prisma/enums';
import { UsersService } from '../users/users.service';
import { AuthErrorCode } from './auth-error-code';
import { AuthenticatedRequest } from './authenticated-request';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import { extractBearerToken } from './extract-bearer-token';
import { JwtVerifierService } from './jwt-verifier.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtVerifier: JwtVerifierService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    const identity = await this.jwtVerifier.verify(token);
    const user = await this.usersService.findOrCreate(identity.id, identity.email);

    if (user.accountStatus === AccountStatus.SUSPENDED) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Account suspended',
        code: AuthErrorCode.AccountSuspended,
      });
    }

    request.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      accountStatus: user.accountStatus,
    };

    return true;
  }
}
