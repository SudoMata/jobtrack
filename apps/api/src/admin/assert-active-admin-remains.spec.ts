import { ConflictException } from '@nestjs/common';
import { AccountStatus, Role } from '../generated/prisma/enums';
import { assertAnActiveAdminRemains, isActiveAdmin } from './assert-active-admin-remains';
import type { LockedUser } from './lock-users-for-change';

const user = (role: Role, accountStatus: AccountStatus): LockedUser => ({
  id: 'target',
  role,
  accountStatus,
});

describe('isActiveAdmin', () => {
  it('is true only for an administrator whose account is active', () => {
    expect(isActiveAdmin({ role: 'ADMIN', accountStatus: 'ACTIVE' })).toBe(true);
    expect(isActiveAdmin({ role: 'ADMIN', accountStatus: 'SUSPENDED' })).toBe(false);
    expect(isActiveAdmin({ role: 'USER', accountStatus: 'ACTIVE' })).toBe(false);
  });
});

describe('assertAnActiveAdminRemains', () => {
  const lastAdmin = user('ADMIN', 'ACTIVE');

  it('refuses to demote the last active administrator', () => {
    expect(() =>
      assertAnActiveAdminRemains({
        activeAdminIds: ['target'],
        target: lastAdmin,
        nextRole: 'USER',
        nextAccountStatus: 'ACTIVE',
      }),
    ).toThrow(ConflictException);
  });

  it('refuses to suspend the last active administrator', () => {
    expect(() =>
      assertAnActiveAdminRemains({
        activeAdminIds: ['target'],
        target: lastAdmin,
        nextRole: 'ADMIN',
        nextAccountStatus: 'SUSPENDED',
      }),
    ).toThrow(ConflictException);
  });

  it('allows removing an active administrator when another one remains', () => {
    expect(() =>
      assertAnActiveAdminRemains({
        activeAdminIds: ['target', 'someone-else'],
        target: lastAdmin,
        nextRole: 'USER',
        nextAccountStatus: 'ACTIVE',
      }),
    ).not.toThrow();
  });

  it('does not count a suspended administrator as one that is lost', () => {
    expect(() =>
      assertAnActiveAdminRemains({
        activeAdminIds: ['someone-else'],
        target: user('ADMIN', 'SUSPENDED'),
        nextRole: 'USER',
        nextAccountStatus: 'SUSPENDED',
      }),
    ).not.toThrow();
  });

  it('ignores a target that is not an administrator', () => {
    expect(() =>
      assertAnActiveAdminRemains({
        activeAdminIds: [],
        target: user('USER', 'ACTIVE'),
        nextRole: 'USER',
        nextAccountStatus: 'SUSPENDED',
      }),
    ).not.toThrow();
  });

  it('allows a change that keeps the target an active administrator, or makes it one', () => {
    expect(() =>
      assertAnActiveAdminRemains({
        activeAdminIds: ['target'],
        target: lastAdmin,
        nextRole: 'ADMIN',
        nextAccountStatus: 'ACTIVE',
      }),
    ).not.toThrow();
    expect(() =>
      assertAnActiveAdminRemains({
        activeAdminIds: [],
        target: user('USER', 'ACTIVE'),
        nextRole: 'ADMIN',
        nextAccountStatus: 'ACTIVE',
      }),
    ).not.toThrow();
  });
});
