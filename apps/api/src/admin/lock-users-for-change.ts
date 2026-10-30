import type { Prisma } from '../generated/prisma/client';
import type { AccountStatus, Role } from '../generated/prisma/enums';

export interface LockedUser {
  id: string;
  role: Role;
  accountStatus: AccountStatus;
}

/**
 * Locks the rows an administrative change depends on: the target user and every active
 * administrator. Another transaction that needs one of these rows waits until this one is
 * finished, then reads the up-to-date state. This is what stops two administrators from
 * removing each other at the same moment (TECHNICAL_SPEC.md, section 16.1).
 *
 * Rows are locked in id order, always the same, so that two transactions cannot block each other.
 */
export function lockUsersForChange(
  tx: Prisma.TransactionClient,
  targetId: string,
): Promise<LockedUser[]> {
  return tx.$queryRaw<LockedUser[]>`
    SELECT "id", "role", "account_status" AS "accountStatus"
    FROM "users"
    WHERE "id" = ${targetId}::uuid
       OR ("role" = 'ADMIN' AND "account_status" = 'ACTIVE')
    ORDER BY "id"
    FOR UPDATE`;
}
