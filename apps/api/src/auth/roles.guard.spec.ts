import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../generated/prisma/enums';
import { RolesGuard } from './roles.guard';

function createContext(user?: { role: Role }): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const getAllAndOverride = jest.fn();
  let guard: RolesGuard;

  beforeEach(() => {
    jest.resetAllMocks();
    guard = new RolesGuard({ getAllAndOverride } as unknown as Reflector);
  });

  it('lets any authenticated user through when the route requires no role', () => {
    getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(createContext({ role: Role.USER }))).toBe(true);
  });

  it('lets through a user who has the required role', () => {
    getAllAndOverride.mockReturnValue([Role.ADMIN]);

    expect(guard.canActivate(createContext({ role: Role.ADMIN }))).toBe(true);
  });

  it('rejects a user who does not have the required role', () => {
    getAllAndOverride.mockReturnValue([Role.ADMIN]);

    expect(() => guard.canActivate(createContext({ role: Role.USER }))).toThrow(ForbiddenException);
  });

  it('accepts any role from a list of allowed roles', () => {
    getAllAndOverride.mockReturnValue([Role.USER, Role.ADMIN]);

    expect(guard.canActivate(createContext({ role: Role.USER }))).toBe(true);
  });

  it('denies by default when a role is required but no user is attached', () => {
    getAllAndOverride.mockReturnValue([Role.ADMIN]);

    expect(() => guard.canActivate(createContext(undefined))).toThrow(ForbiddenException);
  });
});
