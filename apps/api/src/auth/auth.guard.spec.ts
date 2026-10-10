import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { User } from '../generated/prisma/client';
import { AccountStatus, Role } from '../generated/prisma/enums';
import type { UsersService } from '../users/users.service';
import { AuthErrorCode } from './auth-error-code';
import { AuthGuard } from './auth.guard';
import type { JwtVerifierService } from './jwt-verifier.service';

const IDENTITY = { id: '3f2b8c1e-5d4a-4c6b-9a7e-1b2c3d4e5f60', email: 'candidate@example.com' };

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: IDENTITY.id,
    email: IDENTITY.email,
    role: Role.USER,
    accountStatus: AccountStatus.ACTIVE,
    displayName: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createContext(authorization?: string): {
  context: ExecutionContext;
  request: Record<string, unknown>;
} {
  const request: Record<string, unknown> = {
    headers: authorization ? { authorization } : {},
  };
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  return { context, request };
}

describe('AuthGuard', () => {
  const getAllAndOverride = jest.fn();
  const verify = jest.fn();
  const findOrCreate = jest.fn();
  let guard: AuthGuard;

  beforeEach(() => {
    jest.resetAllMocks();
    getAllAndOverride.mockReturnValue(false);
    guard = new AuthGuard(
      { getAllAndOverride } as unknown as Reflector,
      { verify } as unknown as JwtVerifierService,
      { findOrCreate } as unknown as UsersService,
    );
  });

  it('lets a public route through without looking at any token', async () => {
    getAllAndOverride.mockReturnValue(true);
    const { context } = createContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(verify).not.toHaveBeenCalled();
  });

  it('rejects a request without an Authorization header', async () => {
    const { context } = createContext();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(verify).not.toHaveBeenCalled();
  });

  it('rejects an Authorization header that is not a Bearer token', async () => {
    const { context } = createContext('Basic abc');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(verify).not.toHaveBeenCalled();
  });

  it('rejects a request whose token is invalid, without touching the database', async () => {
    verify.mockRejectedValue(new UnauthorizedException());
    const { context } = createContext('Bearer bad-token');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findOrCreate).not.toHaveBeenCalled();
  });

  it('attaches the user to the request, with the role read from the database', async () => {
    verify.mockResolvedValue(IDENTITY);
    findOrCreate.mockResolvedValue(buildUser({ role: Role.ADMIN }));
    const { context, request } = createContext('Bearer good-token');

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(findOrCreate).toHaveBeenCalledWith(IDENTITY.id, IDENTITY.email);
    expect(request.user).toEqual({
      id: IDENTITY.id,
      email: IDENTITY.email,
      role: Role.ADMIN,
      accountStatus: AccountStatus.ACTIVE,
    });
  });

  it('rejects a suspended account with the ACCOUNT_SUSPENDED code', async () => {
    verify.mockResolvedValue(IDENTITY);
    findOrCreate.mockResolvedValue(buildUser({ accountStatus: AccountStatus.SUSPENDED }));
    const { context, request } = createContext('Bearer good-token');

    const error: unknown = await guard.canActivate(context).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toMatchObject({
      code: AuthErrorCode.AccountSuspended,
    });
    expect(request.user).toBeUndefined();
  });
});
