import { ConflictException } from '@nestjs/common';
import { AccountStatus, Role } from '../generated/prisma/enums';
import type { LockedUser } from './lock-users-for-change';

export function isActiveAdmin(user: Pick<LockedUser, 'role' | 'accountStatus'>): boolean {
  return user.role === Role.ADMIN && user.accountStatus === AccountStatus.ACTIVE;
}

/**
 * The platform must never be left without an active administrator (TECHNICAL_SPEC.md, section 16.1).
 * An operation breaks this when it takes the last active administrator out of the active
 * administrators: by demoting them or by suspending them.
 *
 * `activeAdminIds` are the active administrators BEFORE the change, read under a row lock.
 */
export function assertAnActiveAdminRemains(input: {
  activeAdminIds: string[];
  target: LockedUser;
  nextRole: Role;
  nextAccountStatus: AccountStatus;
}): void {
  const staysActiveAdmin = isActiveAdmin({
    role: input.nextRole,
    accountStatus: input.nextAccountStatus,
  });

  if (isActiveAdmin(input.target) && !staysActiveAdmin && input.activeAdminIds.length <= 1) {
    throw new ConflictException('The platform must keep at least one active administrator');
  }
}
