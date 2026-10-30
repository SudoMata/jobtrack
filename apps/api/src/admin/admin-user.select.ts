import type { Prisma } from '../generated/prisma/client';

/**
 * The only columns of a user that an administrator can read: account metadata.
 * Chosen one by one, so that a column added to the table later is not exposed by accident
 * (TECHNICAL_SPEC.md, sections 17 and 23).
 */
export const ADMIN_USER_SELECT = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  accountStatus: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type AdminUser = Prisma.UserGetPayload<{ select: typeof ADMIN_USER_SELECT }>;
